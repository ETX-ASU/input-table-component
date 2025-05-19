import { Eye, Settings } from "lucide-react";
import useSpreadsheetStore from "../lib/store";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function ModeToggle() {
  const { appMode, toggleAppMode, permissionLevel } = useSpreadsheetStore();

  if (permissionLevel === "student") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          onClick={toggleAppMode}
          className="flex items-center gap-1"
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
      </TooltipTrigger>
      <TooltipContent>Toggle between Config and Preview modes</TooltipContent>
    </Tooltip>
  );
}
