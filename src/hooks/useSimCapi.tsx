import { cloneDeep, isEqual, omit } from "lodash";
import { MutableRefObject, useEffect, useRef } from "react";
import {
  cellModelKey,
  dinamicallyAddToSimModel,
  dinamicallyRemoveFromSimModel,
  simModel,
} from "../lib/simcapi";
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
  InitialConfig: {
    stateChange: (state: Partial<SpreadsheetState>) => {
      if (state.permissionLevel === "ld") {
        simModel.set("InitialConfig", stringifyState(state));
      }
    },
    capiChange:
      ({ dataRef }: { dataRef: MutableRefObject<CellData[][] | null> }) =>
      () => {
        const strInitialConfig = simModel.get("InitialConfig");
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
        const { context } = window.simcapi.Transporter.getConfig() || {};
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

        if (context === "AUTHOR") {
          useSpreadsheetStore.setState({
            permissionLevel: "ld",
            appMode: "config",
            isLoading: false,
          });
        } else {
          useSpreadsheetStore.setState({
            permissionLevel: "student",
            appMode: "preview",
            isLoading: false,
          });
        }
      };

      // Start the retry process
      tryGetContext();
    },
  },
  TableJSON: {
    stateChange: (state: Partial<SpreadsheetState>) => {
      simModel.set("TableJSON", stringifyState(state));
    },
    capiChange: () => () => {
      const strTableJson = simModel.get("TableJSON");
      const tableJson = parseState(strTableJson);
      const curr = useSpreadsheetStore.getState();

      if (tableJson) {
        if (isEqual(curr, tableJson)) return;
        useSpreadsheetStore.setState(tableJson);
      }
    },
  },
  IsModified: {
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

      if (isModified) simModel.set("IsModified", true);
    },
  },
  IsComplete: {
    stateChange: (state: SpreadsheetState) => {
      const isComplete = state.data.every((row) =>
        row
          .filter((cell) => !cell.disabled)
          .every((cell) => cell.content.trim() !== ""),
      );
      if (isComplete) simModel.set("IsComplete", true);
    },
    capiChange: () => () => {
      const isComplete = !!JSON.parse(simModel.get("IsComplete"));
      useSpreadsheetStore.setState({ showCorrectAnswers: isComplete });
    },
  },
  IsCorrect: {
    stateChange: (data: CellData[][]) => {
      const currIsCorrect = simModel.get("IsCorrect");

      const isCorrect = data
        .flatMap((row) => row)
        .filter(
          (cell) =>
            !cell.disabled &&
            cell.contentType !== "not-editable" &&
            cell.correctAnswer,
        )
        .every((cell) => cell.content === cell.correctAnswer);

      if (isCorrect !== currIsCorrect) simModel.set("IsCorrect", isCorrect);
    },
  },
  ShowHints: {
    capiChange: () => () => {
      const showHints = !!JSON.parse(simModel.get("ShowHints"));
      useSpreadsheetStore.setState({ showHints });
    },
  },
  Title: {
    capiChange: () => () => {
      const title = simModel.get("Title");
      useSpreadsheetStore.setState({ title });
    },
  },
  Summary: {
    capiChange: () => () => {
      const summary = simModel.get("Summary");
      useSpreadsheetStore.setState({ summary });
    },
  },
  CSS: {
    capiChange: () => () => {
      const css = simModel.get("CSS");
      injectCSS(css);
    },
  },
  Enabled: {
    capiChange: () => () => {
      const enableTable = !!JSON.parse(simModel.get("Enabled"));
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

      const modifiedKeys = Object.keys(state).filter((k) => {
        const key = k as keyof SpreadsheetState;
        return !isEqual(state[key], prevState[key]);
      });

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

      // Avoid unnecessary updates
      if (
        !isEqual(modifiedKeys, ["activeCell"]) &&
        ![...addedCells, ...removedCells, ...modifiedCells].length
      )
        return;

      const clonedState: Partial<SpreadsheetState> = omit(cloneDeep(state), [
        "activeCell",
        "undoStack",
        "lastHistoryId",
        "isLoading",
        "isResizing",
        "isUndoRedo",
        "isResizingRow",
        "isSelectOptionsDialogOpen",
      ]);

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
        "InitialConfig",
        "TableJSON",
        "CSS",
        "Title",
        "Summary",
        "Enabled",
        "ShowHints",
        "IsComplete",
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
