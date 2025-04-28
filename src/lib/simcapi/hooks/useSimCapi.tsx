import { cloneDeep, isEqual } from "lodash";
import { useEffect, useRef } from "react";
import { simModel } from "..";
import useSpreadsheetStore, { SpreadsheetState } from "../../store";

console.log(simModel);

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

export const useSimCapi = () => {
  const prevData = useRef(cloneDeep(useSpreadsheetStore.getState().data));

  useEffect(() => {
    const unsub = useSpreadsheetStore.subscribe((state, prevState) => {
      if (isEqual(prevState, state)) return;

      Object.keys(state).forEach((k) => {
        const key = k as keyof SpreadsheetState;
        if (!isEqual(state[key], prevState[key])) {
          if (key === "appMode") appModeHandlers.stateChange(state[key]);
        }
      });

      state.data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (!isEqual(cell, prevData.current[rowIndex][colIndex])) {
            // This one should be updated in the simcapi model
            // data[rowIndex][colIndex]
          }
        });
      });

      prevData.current = cloneDeep(state.data);
    });

    simModel.on("change:Mode", appModeHandlers.capiChange);

    return () => {
      unsub();
      simModel.off("change:Mode", appModeHandlers.capiChange);
    };
  }, []);
};
