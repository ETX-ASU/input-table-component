import { FC, PropsWithChildren } from "react";
import useSpreadsheetStore, {
  AppMode,
  CellCoordinates,
  CellData,
} from "../lib/store";

const buildCellBackgroundColor = (
  coordinates: CellCoordinates,
  cell: CellData,
  activeCell: CellCoordinates | null,
  appMode: AppMode,
  canInteractWithCell: boolean,
) => {
  const { row, col } = coordinates;
  if (activeCell?.row === row && activeCell?.col === col) {
    return "#e6f0ff"; // Light blue
  }

  // Preview mode handling
  if (appMode === "preview" || !canInteractWithCell) {
    if (cell.disabled) {
      return "transparent"; // Disabled cells in preview mode are transparent
    } else {
      return "#f0f8ff"; // Enabled cells in preview mode are light blue
    }
  }

  // Config mode handling
  if (cell.disabled) {
    // In config mode, add a subtle visual for disabled cells
    return cell.backgroundColor !== "transparent"
      ? cell.backgroundColor
      : "#fafafa"; // Very subtle gray
  }

  // Default case: use the cell's background color
  return cell.backgroundColor !== "transparent"
    ? cell.backgroundColor
    : "transparent";
};

type CellProps = {
  onCellClick: (rowIndex: number, colIndex: number) => void;
  coordinates: CellCoordinates;
};

const Cell: FC<PropsWithChildren<CellProps>> = ({
  onCellClick,
  coordinates,
  children,
}) => {
  const {
    activeCell,
    appMode,
    columnWidths,
    rowHeights,
    getData,
    canInteractWithCell,
  } = useSpreadsheetStore();
  const { row, col } = coordinates;
  const cell = getData(coordinates);

  const bgColor = buildCellBackgroundColor(
    coordinates,
    cell,
    activeCell,
    appMode,
    canInteractWithCell(coordinates),
  );

  return (
    <td
      id={`cell-${row}-${col}`}
      className="p-0"
      onClick={() => onCellClick(row, col)}
      style={{
        width: columnWidths[col],
        height: rowHeights[row],
        borderWidth: cell.borderWidth,
        borderStyle: "solid",
        borderColor: cell.borderColor,
        backgroundColor: bgColor,
      }}
    >
      {children}
    </td>
  );
};

export { Cell };
