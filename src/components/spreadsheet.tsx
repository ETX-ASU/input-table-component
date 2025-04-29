import useSpreadsheetStore from "../lib/store";
import { SpreadsheetGrid } from "./spreadsheet-grid";
import { SpreadsheetToolbar } from "./spreadsheet-toolbar";

export default function Spreadsheet() {
  const { permissionLevel, title, summary } = useSpreadsheetStore();
  return (
    <div className="relative flex flex-col gap-4">
      {title && <h1 className="sr-only">{title}</h1>}
      {summary && <p className="sr-only">{summary}</p>}

      {permissionLevel === "ld" && <SpreadsheetToolbar />}
      <SpreadsheetGrid />
    </div>
  );
}
