import useSpreadsheetStore from "../lib/store";
import { SpreadsheetGrid } from "./spreadsheet-grid";
import { SpreadsheetToolbar } from "./spreadsheet-toolbar";

export default function Spreadsheet() {
  const { permissionLevel } = useSpreadsheetStore();
  return (
    <div className="relative flex flex-col gap-4">
      {permissionLevel === "ld" && <SpreadsheetToolbar />}
      <SpreadsheetGrid />
    </div>
  );
}
