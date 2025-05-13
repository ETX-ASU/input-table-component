import { FC, PropsWithChildren } from "react";
import useSpreadsheetStore, { CellCoordinates } from "../lib/store";
import { colorPalette } from "./color-picker";

type CellProps = {
  onCellClick: (rowIndex: number, colIndex: number) => void;
  coordinates: CellCoordinates;
};

const Cell: FC<PropsWithChildren<CellProps>> = ({
  onCellClick,
  coordinates,
  children,
}) => {
  const { activeCell, columnWidths, rowHeights, getData } =
    useSpreadsheetStore();
  const { row, col } = coordinates;
  const cell = getData(coordinates);

  const isActiveCell = activeCell?.row === row && activeCell?.col === col;

  return (
    <td
      id={`cell-${row}-${col}`}
      className="border-solid p-2"
      onClick={() => onCellClick(row, col)}
      style={{
        width: columnWidths[col],
        height: rowHeights[row],
        borderWidth: cell.borderWidth,
        borderColor: isActiveCell ? colorPalette.blue[80] : cell.borderColor,
        backgroundColor: cell.backgroundColor || "transparent",
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
