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
  const { appMode } = useSpreadsheetStore();
  const isPreviewMode = appMode === "preview";
  const { columnWidths, data, activeCell, startResize, setSelectedCells } =
    useSpreadsheetStore();
  const columnsLength = data[0].length;

  return Array.from({ length: columnsLength }).map((_, idx) => (
    <th
      id={`column-header-${idx}`}
      key={idx}
      className={clsx(
        "sticky top-0 z-20 cursor-pointer border-t border-r border-b border-light-gray-80 select-none",
        activeCell?.col === idx ? "bg-light-gray-60" : "bg-light-gray-20",
      )}
      style={{ width: columnWidths[idx] }}
      onContextMenu={(e) => onContextMenu(e, idx)}
      onClick={() => {
        setSelectedCells(
          Array.from({ length: data.length }, (_, rowIndex) => ({
            row: rowIndex,
            col: idx,
          })),
        );
      }}
    >
      <div className="flex items-center justify-center px-2 py-1">
        <span>{getColumnLabel(idx)}</span>
        {!isPreviewMode && (
          <div
            className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
            onMouseDown={(e) => startResize(idx, e.clientX)}
          ></div>
        )}
      </div>
    </th>
  ));
};

type RowHeaderProps = {
  rowIndex: number;
  onContextMenu: (e: React.MouseEvent, rowIndex: number) => void;
};

const RowHeader: FC<RowHeaderProps> = ({ rowIndex, onContextMenu }) => {
  const { data, rowHeights, activeCell, startRowResize, setSelectedCells } =
    useSpreadsheetStore();
  const { appMode } = useSpreadsheetStore();
  const isPreviewMode = appMode === "preview";

  return (
    <td
      className={clsx(
        "sticky left-0 z-10 cursor-pointer border-x border-b border-light-gray-80 text-center select-none",
        activeCell?.row === rowIndex ? "bg-light-gray-60" : "bg-light-gray-20",
      )}
      style={{
        height: rowHeights[rowIndex],
        width: ROW_HEADER_WIDTH,
      }}
      onContextMenu={(e) => onContextMenu(e, rowIndex)}
      onClick={() => {
        setSelectedCells(
          Array.from({ length: data[0].length }, (_, colIndex) => ({
            row: rowIndex,
            col: colIndex,
          })),
        );
      }}
    >
      <div className="flex h-full items-center justify-center">
        {rowIndex + 1}
      </div>

      {/* Row resize handle */}
      {!isPreviewMode && (
        <div
          className="absolute right-0 bottom-0 left-0 h-1 cursor-row-resize"
          onMouseDown={(e) => startRowResize(rowIndex, e.clientY)}
        />
      )}
    </td>
  );
};

export { ColumnHeaders, RowHeader };
