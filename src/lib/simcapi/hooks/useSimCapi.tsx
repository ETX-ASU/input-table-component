import { cloneDeep, isEqual } from "lodash";
import { useEffect, useRef } from "react";
import { simModel } from "..";
import { useOnce } from "../../../hooks/useOnce";
import useSpreadsheetStore, {
  CellCoordinates,
  CellData,
  SpreadsheetState,
} from "../../store";
import { injectCSS } from "../../utils";

const addCapiEventListener = (value: string, handler: () => void) => {
  simModel.on("change:" + value, handler);
  return () => {
    simModel.off("change:" + value, handler);
  };
};

const appModeHandlers = {
  stateChange: (mode: "config" | "preview") => {
    if (mode === "config") {
      simModel.set("Mode", "Config");
    } else {
      simModel.set("Mode", "Preview");
    }
  },
  capiChange: () => {
    const mode = simModel.get("Mode");
    const zustandMode = mode === "Config" ? "config" : "preview";
    if (useSpreadsheetStore.getState().appMode !== zustandMode) {
      useSpreadsheetStore.setState({ appMode: zustandMode });
    }
  },
};

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

const initialConfigHandler = {
  stateChange: (state: Partial<SpreadsheetState>) => {
    simModel.set("InitialConfig", stringifyState(state));
  },
  capiChange: () => {
    const strInitialConfig = simModel.get("InitialConfig");
    const initialConfig = parseState(strInitialConfig);
    if (initialConfig) {
      useSpreadsheetStore.setState(initialConfig);
    }
  },
};
const permissionLevelHandlers = {
  capiChange: () => {
    const capiMode = window.simcapi.Transporter.getConfig().context;
    const zustandMode = capiMode === "AUTHOR" ? "ld" : "student";
    appModeHandlers.stateChange(zustandMode === "ld" ? "config" : "preview");
    if (useSpreadsheetStore.getState().permissionLevel !== zustandMode) {
      useSpreadsheetStore.setState({ permissionLevel: zustandMode });
    }
  },
};

const jsonTableHandlers = {
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
};

const isModifiedHandlers = {
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
};

const isCompletedHandlers = {
  stateChange: (state: SpreadsheetState) => {
    const isCompleted = state.data.every((row) =>
      row
        .filter((cell) => !cell.disabled)
        .every((cell) => cell.content.trim() !== ""),
    );
    if (isCompleted) simModel.set("IsCompleted", true);
  },
};

const permissionLevelHandler = () => {
  const { context } = window.simcapi.Transporter.getConfig() || {};
  const env = process.env.NODE_ENV;

  if (env === "development") {
    useSpreadsheetStore.setState({ permissionLevel: "ld" });
    appModeHandlers.stateChange("config");
    return;
  }

  if (context === "AUTHOR") {
    useSpreadsheetStore.setState({ permissionLevel: "ld" });
    appModeHandlers.stateChange("config");
  } else {
    useSpreadsheetStore.setState({ permissionLevel: "student" });
    appModeHandlers.stateChange("preview");
  }
};

const titleHandler = {
  capiChange: () => {
    const title = simModel.get("Title");
    useSpreadsheetStore.setState({ title });
  },
};

const subtitleHandler = {
  capiChange: () => {
    const subtitle = simModel.get("Subtitle");
    useSpreadsheetStore.setState({ subtitle });
  },
};

const handleCSS = {
  capiChange: () => {
    const css = simModel.get("CSS");
    injectCSS(css);
  },
};

export const useSimCapi = () => {
  const prevData = useRef(cloneDeep(useSpreadsheetStore.getState().data));
  useOnce(permissionLevelHandler);

  useEffect(() => {
    const unsub = useSpreadsheetStore.subscribe((state, prevState) => {
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

      if (changedKeys.includes("appMode")) {
        appModeHandlers.stateChange(state.appMode);
      }

      initialConfigHandler.stateChange(clonedState);
      jsonTableHandlers.stateChange(clonedState);
      isModifiedHandlers.stateChange(prevData.current, state.data);
      isCompletedHandlers.stateChange(state);

      prevData.current = cloneDeep(clonedState.data as CellData[][]);
    });

    const unsubMode = addCapiEventListener(
      "Mode",
      permissionLevelHandlers.capiChange,
    );
    const unsubInitialConfig = addCapiEventListener(
      "InitialConfig",
      initialConfigHandler.capiChange,
    );
    const unsubJsonTable = addCapiEventListener(
      "JsonTable",
      jsonTableHandlers.capiChange,
    );
    const unsubCSS = addCapiEventListener("CSS", handleCSS.capiChange);
    const unsubTitle = addCapiEventListener("Title", titleHandler.capiChange);
    const unsubSubtitle = addCapiEventListener(
      "Subtitle",
      subtitleHandler.capiChange,
    );

    return () => {
      unsub();
      unsubMode();
      unsubInitialConfig();
      unsubJsonTable();
      unsubCSS();
      unsubTitle();
      unsubSubtitle();
    };
  }, []);
};
