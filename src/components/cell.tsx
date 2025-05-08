import { FC, PropsWithChildren } from "react";
import useSpreadsheetStore, {
  AppMode,
  CellCoordinates,
  CellData,
} from "../lib/store";
import { colorPalette } from "./color-picker";

const buildCellBackgroundColor = (
  cell: CellData,
  appMode: AppMode,
  canInteractWithCell: boolean,
) => {
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
    return "transparent";
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
    cell,
    appMode,
    canInteractWithCell(coordinates),
  );

  const isActiveCell = activeCell?.row === row && activeCell?.col === col;

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
        borderColor: isActiveCell ? colorPalette.blue[80] : cell.borderColor,
        backgroundColor: bgColor,
        outline: isActiveCell
          ? `${cell.borderWidth + 1}px solid ${colorPalette.blue[80]}`
          : "none",
      }}
    >
      {children}
    </td>
  );
};

export { Cell };
