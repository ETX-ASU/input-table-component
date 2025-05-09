import { cloneDeep, isEmpty, isEqual, omit } from "lodash";
import { MutableRefObject, useEffect, useRef } from "react";
import {
  cellModelKey,
  dinamicallyAddToSimModel,
  dinamicallyRemoveFromSimModel,
  simModel,
} from "../lib/simcapi";
import { CapiFields } from "../lib/simcapi/model";
import useSpreadsheetStore, {
  CellCoordinates,
  CellData,
  SpreadsheetState,
} from "../lib/store";
import { injectCSS } from "../lib/utils";
import { useOnce } from "./useOnce";

const stringifyState = (state: Partial<SpreadsheetState>) => {
  let strInitialConfig;
  try {
    strInitialConfig = JSON.stringify(state);
  } catch {
    strInitialConfig = "";
  }
  return strInitialConfig;
};

const getCapiContext = () => {
  const { context } = window.simcapi.Transporter.getConfig() || {};

  return context;
};

const parseState = (str: string) => {
  let state: Partial<SpreadsheetState> | null;
  try {
    state = JSON.parse(str);
  } catch {
    state = null;
    console.error("Error parsing initial config");
  }
  return state;
};

const addCapiEventListener = (value: string, handler: VoidFunction) => {
  simModel.on("change:" + value, () => {
    handler();
  });
  return () => {
    simModel.off("change:" + value, handler);
  };
};

const addDynamicCellsEventListener = (
  cells: { name: string; coordinates: CellCoordinates }[],
): VoidFunction[] =>
  cells.map((cell) =>
    addCapiEventListener(cell.name, () => {
      const { data } = useSpreadsheetStore.getState();
      const { row, col } = cell.coordinates;

      if (!simModel.has(cell.name)) return;
      if (data?.[row]?.[col] === undefined) return;

      const newValue = simModel.get(cell.name);
      const prevValue = data[row][col].content;

      if (isEqual(prevValue, newValue)) return;

      const newData = cloneDeep(data);
      newData[row][col].content = newValue;
      useSpreadsheetStore.setState({ data: newData });
    }),
  );

const handlers = {
  [CapiFields.Mode]: {
    capiChange: () => () => {
      const mode = simModel.get(CapiFields.Mode);
      if (["preview", "config"].includes(mode)) {
        useSpreadsheetStore.setState({
          appMode: mode,
          permissionLevel: mode === "preview" ? "student" : "ld",
        });
      }
    },
  },
  [CapiFields.InitialConfig]: {
    stateChange: (state: Partial<SpreadsheetState>) => {
      // const currentCapiInitialConfig = simModel.get(CapiFields.InitialConfig);
      // const { data: prevData } = parseState(currentCapiInitialConfig) || {};
      simModel.set(CapiFields.InitialConfig, stringifyState(state));
      // if (getCapiContext() === "AUTHOR") {
      //   const nextState = merge(cloneDeep(state), {
      //     data: prevData,
      //   });
      //   simModel.set(CapiFields.InitialConfig, stringifyState(nextState));
      // } else {
      //   simModel.set(CapiFields.InitialConfig, stringifyState(state));
      // }
    },
    capiChange:
      ({ dataRef }: { dataRef: MutableRefObject<CellData[][] | null> }) =>
      () => {
        const strInitialConfig = simModel.get(CapiFields.InitialConfig);
        const initialConfig = parseState(strInitialConfig);
        const curr = useSpreadsheetStore.getState();

        if (initialConfig) {
          if (isEqual(curr, initialConfig)) return;
          dataRef.current = initialConfig.data || null;
          useSpreadsheetStore.setState(initialConfig);
        }
      },
  },
  PermissionLevel: {
    capiChange: () => () => {
      const tryGetContext = (delayMs = 100) => {
        const context = getCapiContext();
        const env = process.env.NODE_ENV;

        if (!context && env !== "development") {
          setTimeout(() => tryGetContext(delayMs), delayMs);
          return;
        }

        if (env === "development") {
          return useSpreadsheetStore.setState({
            permissionLevel: "ld",
            appMode: "config",
            isLoading: false,
          });
        }

        if (context !== "AUTHOR") {
          return useSpreadsheetStore.setState({
            permissionLevel: "student",
            appMode: "preview",
            isLoading: false,
          });
        }

        const mode = simModel.get(CapiFields.Mode);
        if (mode === "preview") {
          // If you are an author and the mode is preview, is because you're testing the component
          // So we set the permission level to student
          useSpreadsheetStore.setState({
            permissionLevel: "student",
            appMode: "preview",
            isLoading: false,
          });
        } else {
          useSpreadsheetStore.setState({
            permissionLevel: "ld",
            appMode: "config",
            isLoading: false,
          });
        }
      };

      // Start the retry process
      tryGetContext();
    },
  },
  [CapiFields.TableJSON]: {
    stateChange: (state: Partial<SpreadsheetState>) => {
      simModel.set(CapiFields.TableJSON, stringifyState(state));
    },
    capiChange: () => () => {
      const strTableJson = simModel.get(CapiFields.TableJSON);
      const tableJson = parseState(strTableJson);
      const curr = useSpreadsheetStore.getState();

      if (tableJson) {
        if (isEqual(curr, tableJson)) return;
        useSpreadsheetStore.setState(tableJson);
      }
    },
  },
  [CapiFields.IsModified]: {
    stateChange: (prevCells: CellData[][], newCells: CellData[][]) => {
      let isModified = false;
      for (let i = 0; i < prevCells.length; i++) {
        if (isModified) break;
        for (let j = 0; j < prevCells[i].length; j++) {
          if (!isEqual(prevCells[i][j], newCells[i][j])) {
            isModified = true;
            break;
          }
        }
      }

      simModel.set(CapiFields.IsComplete, isModified);
    },
  },
  [CapiFields.IsComplete]: {
    stateChange: (state: SpreadsheetState) => {
      const isComplete = state.data.every((row) =>
        row
          .filter((cell) => !cell.disabled)
          .every((cell) => cell.content.trim() !== ""),
      );

      simModel.set(CapiFields.IsComplete, isComplete);
    },
    capiChange: () => () => {
      const isComplete = simModel.get(CapiFields.IsComplete);
      useSpreadsheetStore.setState({ showCorrectAnswers: isComplete });
    },
  },
  [CapiFields.IsCorrect]: {
    stateChange: (data: CellData[][]) => {
      const isCorrect = data
        .flatMap((row) => row)
        .filter(
          (cell) => cell.contentType !== "not-editable" && cell.correctAnswer,
        )
        .every((cell) => cell.content === cell.correctAnswer);

      simModel.set(CapiFields.IsCorrect, isCorrect);
    },
  },
  [CapiFields.ShowHints]: {
    capiChange: () => () => {
      const showHints = simModel.get(CapiFields.ShowHints);
      useSpreadsheetStore.setState({ showHints });
    },
  },
  [CapiFields.Title]: {
    capiChange: () => () => {
      const title = simModel.get(CapiFields.Title);
      useSpreadsheetStore.setState({ title });
    },
  },
  [CapiFields.Summary]: {
    capiChange: () => () => {
      const summary = simModel.get(CapiFields.Summary);
      useSpreadsheetStore.setState({ summary });
    },
  },
  [CapiFields.CSS]: {
    capiChange: () => () => {
      const css = simModel.get(CapiFields.CSS);
      injectCSS(css);
    },
  },
  [CapiFields.Enabled]: {
    capiChange: () => () => {
      const enableTable = simModel.get(CapiFields.Enabled);
      useSpreadsheetStore.setState({ enableTable });
    },
  },
};

const dynamicCellHandlers = {
  setup: (): VoidFunction[] => {
    const { data, permissionLevel, getData } = useSpreadsheetStore.getState();

    if (permissionLevel === "student") return [];

    const toAdd = data
      .flatMap((row, rowIdx) =>
        row.map((_, colIdx) => ({ row: rowIdx, col: colIdx })),
      )
      .map((coordinates) => ({
        name: cellModelKey(coordinates),
        defaultValue: getData(coordinates).content,
        coordinates,
      }));

    dinamicallyAddToSimModel(toAdd);
    return addDynamicCellsEventListener(toAdd);
  },
  addedCells: (cellsToAdd: CellCoordinates[]): VoidFunction[] => {
    const { getData, permissionLevel } = useSpreadsheetStore.getState();

    if (permissionLevel === "student") return [];

    const toAdd = cellsToAdd
      .filter((coordinates) => !simModel.has(cellModelKey(coordinates)))
      .map((coordinates) => ({
        name: cellModelKey(coordinates),
        defaultValue: getData(coordinates).content,
        coordinates,
      }));

    dinamicallyAddToSimModel(toAdd);

    return toAdd.map((cell) =>
      addCapiEventListener(cell.name, () => {
        const { data } = useSpreadsheetStore.getState();
        const { row, col } = cell.coordinates;

        const newValue = simModel.get(cell.name);
        const prevValue = data[row][col].content;

        if (isEqual(prevValue, newValue)) return;

        const newData = cloneDeep(data);
        newData[row][col].content = newValue;
        useSpreadsheetStore.setState({ data: newData });
      }),
    );
  },
  removedCells: (cellsToRemove: CellCoordinates[]) => {
    const { permissionLevel } = useSpreadsheetStore.getState();

    if (permissionLevel === "student") return;

    const toRemove = cellsToRemove
      .filter((cell) => simModel.has(cellModelKey(cell)))
      .map(cellModelKey);

    dinamicallyRemoveFromSimModel(toRemove);
  },
  stateChange: (modifiedCells: CellCoordinates[]) => {
    const { getData } = useSpreadsheetStore.getState();

    modifiedCells.forEach((cell) => {
      const key = cellModelKey(cell);
      const value = getData(cell).content;
      const prevValue = simModel.get(key);

      if (!isEqual(prevValue, value)) simModel.set(key, value);
    });
  },
};

export const useSimCapi = () => {
  const initialData = useRef<CellData[][] | null>(null); // Only used to calculate isModified
  const prevData = useRef(cloneDeep(useSpreadsheetStore.getState().data));
  const { isLoading } = useSpreadsheetStore.getState();
  useOnce(handlers.PermissionLevel.capiChange());

  useEffect(() => {
    let unsub: VoidFunction[] = [];
    if (!isLoading) {
      unsub = dynamicCellHandlers.setup();
    }

    return () => {
      unsub.forEach((unsub) => unsub());
    };
  }, [isLoading]);

  useEffect(() => {
    let unsubAddedCells: VoidFunction[] = [];
    const unsubState = useSpreadsheetStore.subscribe((state, prevState) => {
      if (isEqual(prevState, state)) return;

      // const modifiedKeys = Object.keys(state).filter((k) => {
      //   const key = k as keyof SpreadsheetState;
      //   return !isEqual(state[key], prevState[key]);
      // });

      const addedCells: CellCoordinates[] = [];
      const removedCells: CellCoordinates[] = [];
      const modifiedCells: CellCoordinates[] = [];

      // First check for removed cells by comparing previous state dimensions
      prevData.current?.forEach((row, rowIndex) => {
        row.forEach((_, colIndex) => {
          if (
            !state.data[rowIndex] ||
            state.data[rowIndex][colIndex] === undefined
          ) {
            removedCells.push({ row: rowIndex, col: colIndex });
          }
        });
      });

      // Then check for added and modified cells
      state.data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (
            !prevData.current?.[rowIndex] ||
            prevData.current?.[rowIndex][colIndex] === undefined
          ) {
            addedCells.push({ row: rowIndex, col: colIndex });
          } else if (!isEqual(cell, prevData.current?.[rowIndex][colIndex])) {
            modifiedCells.push({ row: rowIndex, col: colIndex });
          }
        });
      });

      const keysToOmit = [
        "activeCell",
        "undoStack",
        "lastHistoryId",
        "isLoading",
        "isResizing",
        "isUndoRedo",
        "isResizingRow",
        "isSelectOptionsDialogOpen",
      ] as const;

      const noCellsChanged = [addedCells, removedCells, modifiedCells].every(
        isEmpty,
      );

      const statesAreTheSame = isEqual(
        cloneDeep(omit(state, keysToOmit)),
        cloneDeep(omit(prevState, keysToOmit)),
      );

      Object.keys(state).forEach((key) => {
        if (
          !isEqual(
            state[key as keyof SpreadsheetState],
            prevState[key as keyof SpreadsheetState],
          )
        ) {
          console.log(
            key,
            state[key as keyof SpreadsheetState],
            prevState[key as keyof SpreadsheetState],
          );
        }
      });

      if (noCellsChanged && statesAreTheSame) return;

      console.log("updating");
      const clonedState: Partial<SpreadsheetState> = omit(
        cloneDeep(state),
        keysToOmit,
      );

      clonedState.data?.forEach((rowArr, ridx) => {
        rowArr.forEach((cell, cidx) => {
          if (cell.contentType !== "not-editable") {
            clonedState.data![ridx][cidx].content = "";
          }
        });
      });

      handlers.InitialConfig.stateChange(clonedState);
      handlers.TableJSON.stateChange(clonedState);

      if (state.permissionLevel === "student" && state.appMode === "preview") {
        handlers.IsCorrect.stateChange(state.data);
        handlers.IsModified.stateChange(prevData.current, state.data);
        handlers.IsComplete.stateChange(state);
      }

      unsubAddedCells = dynamicCellHandlers.addedCells(addedCells);
      dynamicCellHandlers.removedCells(removedCells);
      dynamicCellHandlers.stateChange(modifiedCells);

      prevData.current = cloneDeep(clonedState.data!);
    });

    const unsubsCapi = (
      [
        CapiFields.Mode,
        CapiFields.InitialConfig,
        CapiFields.TableJSON,
        CapiFields.CSS,
        CapiFields.Title,
        CapiFields.Summary,
        CapiFields.Enabled,
        CapiFields.ShowHints,
        CapiFields.IsComplete,
      ] as const
    ).map((key) =>
      addCapiEventListener(
        key,
        handlers[key].capiChange({ dataRef: initialData }),
      ),
    );

    return () => {
      unsubState();
      unsubsCapi.forEach((unsub) => unsub());
      unsubAddedCells.forEach((unsub) => unsub());
    };
  }, []);
};
