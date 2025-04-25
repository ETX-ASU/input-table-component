import { cloneDeep, isEqual } from "lodash";
import { useEffect, useRef } from "react";
import useSpreadsheetStore, { SpreadsheetState } from "../../store";

export const useSimCapi = () => {
  const prevData = useRef(cloneDeep(useSpreadsheetStore.getState().data));

  useEffect(() => {
    useSpreadsheetStore.subscribe((state, prevState) => {
      if (isEqual(prevState, state)) return;

      Object.keys(state).forEach((key) => {
        if (
          !isEqual(
            state[key as keyof SpreadsheetState],
            prevState[key as keyof SpreadsheetState],
          )
        ) {
          // This one should be updated in the simcapi model
          // state[key]
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
  }, []);
};
