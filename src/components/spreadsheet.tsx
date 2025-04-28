import useSpreadsheetStore from "../lib/store";
import { SpreadsheetGrid } from "./spreadsheet-grid";
import { SpreadsheetToolbar } from "./spreadsheet-toolbar";

export default function Spreadsheet() {
  const { permissionLevel, title, subtitle } = useSpreadsheetStore();
  return (
    <div className="relative flex flex-col gap-4">
      {title && <h1 className="sr-only">{title}</h1>}
      {subtitle && <p className="sr-only">{subtitle}</p>}

      {permissionLevel === "ld" && <SpreadsheetToolbar />}
      <SpreadsheetGrid />
    </div>
  );
}
