import { useRef } from "react";

export const useOnce = (fn: VoidFunction) => {
  const hasRun = useRef(false);
  if (!hasRun.current) {
    fn();
    hasRun.current = true;
  }
};
