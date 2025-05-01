import { cloneDeep, isEqual } from "lodash";
import { useEffect, useRef } from "react";
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
  simModel.on("change:" + value, handler);
  return () => {
    simModel.off("change:" + value, handler);
  };
};

const handlers = {
  InitialConfig: {
    stateChange: (state: Partial<SpreadsheetState>) => {
      if (state.permissionLevel === "ld") {
        simModel.set("InitialConfig", stringifyState(state));
      }
    },
    capiChange: () => {
      const strInitialConfig = simModel.get("InitialConfig");
      const initialConfig = parseState(strInitialConfig);
      simModel.set("TableJSON", strInitialConfig);
      if (initialConfig) {
        useSpreadsheetStore.setState(initialConfig);
      }
    },
  },
  PermissionLevel: {
    capiChange: () => {
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
    capiChange: () => {
      const strTableJson = simModel.get("TableJSON");
      const tableJson = parseState(strTableJson);
      if (tableJson) {
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
  IsCompleted: {
    stateChange: (state: SpreadsheetState) => {
      const isCompleted = state.data.every((row) =>
        row
          .filter((cell) => !cell.disabled)
          .every((cell) => cell.content.trim() !== ""),
      );
      if (isCompleted) simModel.set("IsCompleted", true);
    },
  },
  Title: {
    capiChange: () => {
      const title = simModel.get("Title");
      useSpreadsheetStore.setState({ title });
    },
  },
  Summary: {
    capiChange: () => {
      const summary = simModel.get("Summary");
      useSpreadsheetStore.setState({ summary });
    },
  },
  CSS: {
    capiChange: () => {
      const css = simModel.get("CSS");
      injectCSS(css);
    },
  },
  Enabled: {
    capiChange: () => {
      const enableTable = !!JSON.parse(simModel.get("Enabled"));
      useSpreadsheetStore.setState({ enableTable });
    },
  },
};

const handleAddedCells = (addedCells: CellCoordinates[]) => {
  const { getData, permissionLevel } = useSpreadsheetStore.getState();

  if (permissionLevel === "student") return;

  const toAdd = addedCells
    .filter((cell) => !simModel.has(cellModelKey(cell)))
    .map((cell) => ({
      name: cellModelKey(cell),
      defaultValue: getData(cell).content,
    }));

  dinamicallyAddToSimModel(toAdd);
};

const handleRemovedCells = (removedCells: CellCoordinates[]) => {
  const { permissionLevel } = useSpreadsheetStore.getState();

  if (permissionLevel === "student") return;

  const toRemove = removedCells
    .filter((cell) => simModel.has(cellModelKey(cell)))
    .map((cell) => ({
      name: cellModelKey(cell),
    }));

  dinamicallyRemoveFromSimModel(toRemove);
};

const handleModifiedCells = (modifiedCells: CellCoordinates[]) => {
  const { getData } = useSpreadsheetStore.getState();

  modifiedCells.forEach((cell) => {
    simModel.set(cellModelKey(cell), getData(cell).content);
  });
};

const setupCells = () => {
  const { data, permissionLevel, getData } = useSpreadsheetStore.getState();

  if (permissionLevel === "student") return;

  const toAdd = data
    .flatMap((row, rowIdx) =>
      row.map((_, colIdx) => ({ row: rowIdx, col: colIdx })),
    )
    .filter((cell) => !simModel.has(cellModelKey(cell)))
    .map((coordinates) => ({
      name: cellModelKey(coordinates),
      defaultValue: getData(coordinates).content,
    }));

  dinamicallyAddToSimModel(toAdd);
};

export const useSimCapi = () => {
  const prevData = useRef(cloneDeep(useSpreadsheetStore.getState().data));
  useOnce(handlers.PermissionLevel.capiChange);
  useOnce(setupCells);

  useEffect(() => {
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

      const clonedState: Partial<SpreadsheetState> = cloneDeep(state);
      delete clonedState.activeCell;
      delete clonedState.undoStack;
      delete clonedState.lastHistoryId;
      delete clonedState.isLoading;
      delete clonedState.isResizing;
      delete clonedState.isUndoRedo;
      delete clonedState.isResizingRow;

      handlers.InitialConfig.stateChange(clonedState);
      handlers.TableJSON.stateChange(clonedState);
      handlers.IsModified.stateChange(prevData.current, state.data);
      handlers.IsCompleted.stateChange(state);

      handleAddedCells(addedCells);
      handleRemovedCells(removedCells);
      handleModifiedCells(modifiedCells);

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
      ] as const
    ).map((key) => addCapiEventListener(key, handlers[key].capiChange));

    return () => {
      unsubState();
      unsubsCapi.forEach((unsub) => unsub());
    };
  }, []);
};
