import clsx from "clsx";
import { useCallback, useEffect } from "react";
import { Button } from "../components/ui/button";
import useSpreadsheetStore from "../lib/store";
import { Icon } from "./Icon";

export function UndoRedo({ invisible = false }: { invisible?: boolean }) {
  const { undo, redo, canUndo, canRedo, pushToHistory, lastHistoryId } =
    useSpreadsheetStore();

  // Initialize history with the initial state
  useEffect(() => {
    // Only push to history once on initial load
    if (lastHistoryId === 0) {
      pushToHistory();
    }
  }, [pushToHistory, lastHistoryId]);

  // Memoize the handlers to prevent unnecessary re-renders
  const handleUndo = useCallback(() => {
    if (canUndo()) {
      undo();
    }
  }, [undo, canUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo()) {
      redo();
    }
  }, [redo, canRedo]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Z (Undo)
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Check for Ctrl+Y or Ctrl+Shift+Z (Redo)
      if (
        (e.key === "y" && (e.ctrlKey || e.metaKey)) ||
        (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div
      id="undo-redo"
      className={clsx("flex items-center gap-1", invisible && "invisible")}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={handleUndo}
        disabled={!canUndo()}
        tooltip="Undo"
      >
        <Icon name="undo" className="h-8 w-8" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={handleRedo}
        disabled={!canRedo()}
        tooltip="Redo"
      >
        <Icon name="redo" className="h-8 w-8" />
      </Button>
    </div>
  );
}
