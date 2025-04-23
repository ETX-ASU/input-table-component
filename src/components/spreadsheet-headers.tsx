import clsx from "clsx";
import { FC } from "react";
import { ROW_HEADER_WIDTH } from "../lib/constants";
import useSpreadsheetStore from "../lib/store";

// Helper function to convert column index to Excel-style column label (A, B, ..., Z, AA, AB, etc.)
const getColumnLabel = (index: number): string => {
  let label = "";

  // Convert to base-26 (Excel column style)
  let n = index;
  while (n >= 0) {
    const remainder = n % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor(n / 26) - 1;
  }

  return label;
};

type ColumnHeadersProps = {
  onContextMenu: (e: React.MouseEvent, colIndex: number) => void;
};

const ColumnHeaders: FC<ColumnHeadersProps> = ({ onContextMenu }) => {
  const { columnWidths, data, activeCell, startResize } = useSpreadsheetStore();
  const columnsLength = data[0].length;

  return Array.from({ length: columnsLength }).map((_, idx) => (
    <th
      key={idx}
      className={clsx(
        "sticky top-0 z-20 border-t border-r border-b border-gray-300 select-none",
        activeCell?.col === idx ? "bg-gray-200" : "bg-gray-100",
      )}
      style={{ width: columnWidths[idx] }}
      onContextMenu={(e) => onContextMenu(e, idx)}
    >
      <div className="flex items-center justify-center px-2 py-1">
        <span>{getColumnLabel(idx)}</span>
        <div
          className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
          onMouseDown={(e) => startResize(idx, e.clientX)}
        ></div>
      </div>
    </th>
  ));
};

type RowHeaderProps = {
  rowIndex: number;
  onContextMenu: (e: React.MouseEvent, rowIndex: number) => void;
};

const RowHeader: FC<RowHeaderProps> = ({ rowIndex, onContextMenu }) => {
  const { rowHeights, activeCell, startRowResize } = useSpreadsheetStore();

  return (
    <td
      className={clsx(
        "sticky left-0 z-10 border-x border-b border-gray-300 text-center",
        activeCell?.row === rowIndex ? "bg-gray-200" : "bg-gray-100",
      )}
      style={{
        height: rowHeights[rowIndex],
        width: ROW_HEADER_WIDTH,
      }}
      onContextMenu={(e) => onContextMenu(e, rowIndex)}
    >
      <div className="flex h-full items-center justify-center">
        {rowIndex + 1}
      </div>

      {/* Row resize handle */}
      <div
        className="absolute right-0 bottom-0 left-0 h-1 cursor-row-resize"
        onMouseDown={(e) => startRowResize(rowIndex, e.clientY)}
      />
    </td>
  );
};

export { ColumnHeaders, RowHeader };
