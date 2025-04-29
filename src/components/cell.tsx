import { FC, PropsWithChildren } from "react";
import {
  BACKGROUND_COLOR_LIGHT_BLUE,
  BACKGROUND_COLOR_LIGHT_GRAY,
  BACKGROUND_COLOR_SUBTLE_GRAY,
} from "../lib/constants";
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
  const isPreviewMode = appMode === "preview";

  const isActive = row === activeCell?.row && col === activeCell?.col;
  // Base background color
  const bgColor = cell.backgroundColor || "transparent";

  if (isActive) {
    return bgColor !== "transparent"
      ? `${bgColor}dd`
      : BACKGROUND_COLOR_LIGHT_BLUE;
  }

  // In preview mode, add a stronger visual for disabled cells
  if (!canInteractWithCell) {
    return bgColor !== "transparent"
      ? `${bgColor}80`
      : BACKGROUND_COLOR_LIGHT_GRAY;
  }

  // In config mode, add a subtle visual for disabled cells
  if (!isPreviewMode && cell.disabled) {
    return bgColor !== "transparent" ? bgColor : BACKGROUND_COLOR_SUBTLE_GRAY;
  }

  return bgColor;
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
