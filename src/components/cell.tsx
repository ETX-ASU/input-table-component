import clsx from "clsx";
import { FC, PropsWithChildren } from "react";
import useSpreadsheetStore, { CellCoordinates } from "../lib/store";
import { isSameCell } from "../lib/utils";
import { colorPalette } from "./color-picker";

type CellProps = {
  onCellClick: (rowIndex: number, colIndex: number) => void;
  coordinates: CellCoordinates;
  handleCellMouseDown: (
    e: React.MouseEvent,
    rowIndex: number,
    colIndex: number,
  ) => void;
  handleCellMouseEnter: (rowIndex: number, colIndex: number) => void;
};

const Cell: FC<PropsWithChildren<CellProps>> = ({
  onCellClick,
  coordinates,
  children,
  handleCellMouseDown,
  handleCellMouseEnter,
}) => {
  const { activeCell, columnWidths, rowHeights, getData, selectedCells } =
    useSpreadsheetStore();
  const { row, col } = coordinates;
  const cell = getData(coordinates);

  const isActiveCell = isSameCell(activeCell, coordinates);

  const isSelectedNotActive =
    selectedCells.some((cell) => isSameCell(cell, coordinates)) &&
    !isActiveCell;

  return (
    <td
      id={`cell-${row}-${col}`}
      className={clsx("border-solid p-2 select-none")}
      onClick={() => onCellClick(row, col)}
      style={{
        width: columnWidths[col],
        height: rowHeights[row],
        borderWidth: cell.borderWidth,
        borderColor: isActiveCell ? colorPalette.blue[80] : cell.borderColor,

        backgroundColor: isSelectedNotActive
          ? cell.backgroundColor === "transparent"
            ? colorPalette.blue[20]
            : cell.backgroundColor
          : cell.backgroundColor || "transparent",

        opacity: isSelectedNotActive ? 0.75 : 1,
        outline: isActiveCell
          ? `${cell.borderWidth + 1}px solid ${colorPalette.blue[80]}`
          : "none",
      }}
      onMouseDown={(e) => handleCellMouseDown(e, row, col)}
      onMouseEnter={() => handleCellMouseEnter(row, col)}
    >
      {children}
    </td>
  );
};

export { Cell };
