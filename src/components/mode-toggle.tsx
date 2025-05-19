import { Eye, Settings } from "lucide-react";
import useSpreadsheetStore from "../lib/store";
import { Button } from "./ui/button";

export function ModeToggle() {
  const { appMode, toggleAppMode, permissionLevel } = useSpreadsheetStore();

  if (permissionLevel === "student") return null;

  return (
    <Button
      size="sm"
      onClick={toggleAppMode}
      className="flex items-center gap-1"
      tooltip={appMode === "config" ? "Preview Mode" : "Config Mode"}
    >
      {appMode === "config" ? (
        <>
          <Eye className="h-4 w-4" />
          <span>Preview Mode</span>
        </>
      ) : (
        <>
          <Settings className="h-4 w-4" />
          <span>Config Mode</span>
        </>
      )}
    </Button>
  );
}
