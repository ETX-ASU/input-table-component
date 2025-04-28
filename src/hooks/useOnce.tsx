import { useRef } from "react";

export const useOnce = (fn: () => void) => {
  const hasRun = useRef(false);
  if (!hasRun.current) {
    fn();
    hasRun.current = true;
  }
};
