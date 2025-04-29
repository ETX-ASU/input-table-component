import { cloneDeep, isEqual } from "lodash";
import { useEffect, useRef } from "react";
import { simModel } from "../lib/simcapi";
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
  // Mode: {
  //   stateChange: (mode: "config" | "preview") => {
  //     if (mode === "config") {
  //       simModel.set("Mode", "Config");
  //     } else {
  //       simModel.set("Mode", "Preview");
  //     }
  //   },
  //   capiChange: () => {
  //     const mode = simModel.get("Mode");
  //     const zustandMode = mode === "Config" ? "config" : "preview";
  //     if (useSpreadsheetStore.getState().appMode !== zustandMode) {
  //       useSpreadsheetStore.setState({ appMode: zustandMode });
  //     }
  //   },
  // },
  InitialConfig: {
    stateChange: (state: Partial<SpreadsheetState>) => {
      if (state.permissionLevel === "ld") {
        simModel.set("InitialConfig", stringifyState(state));
      }
    },
    capiChange: () => {
      const strInitialConfig = simModel.get("InitialConfig");
      const initialConfig = parseState(strInitialConfig);
      if (initialConfig) {
        useSpreadsheetStore.setState(initialConfig);
      }
    },
  },
  PermissionLevel: {
    capiChange: () => {
      const { context } = window.simcapi.Transporter.getConfig() || {};
      const env = process.env.NODE_ENV;

      if (env === "development") {
        return useSpreadsheetStore.setState({
          permissionLevel: "ld",
          appMode: "config",
        });
      }

      if (context === "AUTHOR") {
        useSpreadsheetStore.setState({
          permissionLevel: "ld",
          appMode: "config",
        });
      } else {
        useSpreadsheetStore.setState({
          permissionLevel: "student",
          appMode: "preview",
        });
      }
    },
  },
  JsonTable: {
    stateChange: (state: Partial<SpreadsheetState>) => {
      simModel.set("JsonTable", stringifyState(state));
    },
    capiChange: () => {
      const strJsonTable = simModel.get("JsonTable");
      const jsonTable = parseState(strJsonTable);
      if (jsonTable) {
        useSpreadsheetStore.setState(jsonTable);
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
  Subtitle: {
    capiChange: () => {
      const subtitle = simModel.get("Subtitle");
      useSpreadsheetStore.setState({ subtitle });
    },
  },
  CSS: {
    capiChange: () => {
      const css = simModel.get("CSS");
      injectCSS(css);
    },
  },
  Enable: {
    capiChange: () => {
      const enableTable = simModel.get("Enable");
      useSpreadsheetStore.setState({ enableTable });
    },
  },
};

export const useSimCapi = () => {
  const prevData = useRef(cloneDeep(useSpreadsheetStore.getState().data));
  useOnce(handlers.PermissionLevel.capiChange);

  useEffect(() => {
    const unsubState = useSpreadsheetStore.subscribe((state, prevState) => {
      if (isEqual(prevState, state)) return;

      const changedKeys = Object.keys(state).filter((k) => {
        const key = k as keyof SpreadsheetState;
        return !isEqual(state[key], prevState[key]);
      });

      const changedCells: CellCoordinates[] = [];
      state.data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (!isEqual(cell, prevData.current[rowIndex][colIndex])) {
            changedCells.push({ row: rowIndex, col: colIndex });
          }
        });
      });

      // Avoid unnecessary updates
      if (!isEqual(changedKeys, ["activeCell"]) && !changedCells.length) return;

      const clonedState: Partial<SpreadsheetState> = cloneDeep(state);
      delete clonedState.activeCell;
      delete clonedState.undoStack;
      delete clonedState.lastHistoryId;
      delete clonedState.isLoading;
      delete clonedState.isResizing;
      delete clonedState.isUndoRedo;
      delete clonedState.isResizingRow;

      handlers.InitialConfig.stateChange(clonedState);
      handlers.JsonTable.stateChange(clonedState);
      handlers.IsModified.stateChange(prevData.current, state.data);
      handlers.IsCompleted.stateChange(state);

      prevData.current = cloneDeep(clonedState.data!);
    });

    const unsubsCapi = (
      [
        /*"Mode",*/
        "InitialConfig",
        "JsonTable",
        "CSS",
        "Title",
        "Subtitle",
      ] as const
    ).map((key) => addCapiEventListener(key, handlers[key].capiChange));

    return () => {
      unsubState();
      unsubsCapi.forEach((unsub) => unsub());
    };
  }, []);
};
