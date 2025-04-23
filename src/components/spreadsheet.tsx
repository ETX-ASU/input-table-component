import { SpreadsheetGrid } from "./spreadsheet-grid";
import { SpreadsheetToolbar } from "./spreadsheet-toolbar";

export default function Spreadsheet() {
  return (
    <div className="relative flex flex-col gap-4">
      <SpreadsheetToolbar />
      <SpreadsheetGrid />
    </div>
  );
}
