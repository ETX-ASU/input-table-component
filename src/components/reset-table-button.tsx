import clsx from "clsx";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import useSpreadsheetStore from "../lib/store";
import { ConfirmationDialog } from "./confirmation-dialog";
import { Button } from "./ui/button";

const ResetTableButton = () => {
  const { appMode, resetTable } = useSpreadsheetStore();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const isPreviewMode = appMode === "preview";

  return (
    <>
      <div
        id="reset-table-button"
        className={clsx(
          "flex items-center gap-1",
          isPreviewMode ? "pointer-events-none" : "",
        )}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsResetDialogOpen(true)}
          disabled={isPreviewMode}
          className="border-red-200 bg-red-50 hover:bg-red-100"
        >
          <RefreshCw className="mr-1 h-4 w-4 text-red-500" /> Reset Table
        </Button>
      </div>
      <ConfirmationDialog
        isOpen={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
        onConfirm={resetTable}
        title="Reset Table"
        description="Are you sure you want to reset the table? This will clear all data and formatting."
        confirmText="Reset"
        cancelText="Cancel"
      />
    </>
  );
};

export { ResetTableButton };
