import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ROW_HEADER_WIDTH } from "../lib/constants";
import useSpreadsheetStore, { CellCoordinates, CellData } from "../lib/store";
import { Cell } from "./cell";
import { InputCell, LinkCell, SelectCell } from "./cell-types";
import { ContextMenu } from "./context-menu";
import { ColumnHeaders, RowHeader } from "./spreadsheet-headers";

// Context menu types
type ContextMenuType = "row" | "column" | null;

interface ContextMenuState {
  type: ContextMenuType;
  index: number;
  x: number;
  y: number;
}

export function SpreadsheetGrid() {
  const {
    data,
    activeCell,
    columnWidths,
    isResizing,
    isResizingRow,
    appMode,
    setActiveCell,
    updateCellContent,
    updateResize,
    endResize,
    updateRowResize,
    endRowResize,
    deleteRow,
    deleteColumn,
    getData,
    canInteractWithCell,
  } = useSpreadsheetStore();

  const spreadsheetRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [openSelectCell, setOpenSelectCell] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const isPreviewMode = appMode === "preview";

  const handleCellClick = (row: number, col: number) => {
    if (!canInteractWithCell({ row, col })) return;
    setActiveCell(row, col);
  };

  const handleOpenSelectDropdown = (
    cellKey: string | null,
    coordinates: CellCoordinates,
  ) => {
    if (!canInteractWithCell(coordinates)) return;

    setOpenSelectCell(cellKey);
  };

  const handleCellChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateCellContent(e.target.value);
  };

  const handleSelectChange = (value: string, row: number, col: number) => {
    if (!canInteractWithCell({ row, col })) return;

    setActiveCell(row, col);
    updateCellContent(value);
  };

  const handleRowContextMenu = (e: React.MouseEvent, rowIndex: number) => {
    if (isPreviewMode) return;

    e.preventDefault();
    setContextMenu({
      type: "row",
      index: rowIndex,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleColumnContextMenu = (e: React.MouseEvent, colIndex: number) => {
    if (isPreviewMode) return;

    e.preventDefault();
    setContextMenu({
      type: "column",
      index: colIndex,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Focus the active cell
  useEffect(() => {
    if (activeCell) {
      const key = `${activeCell.row}-${activeCell.col}`;
      const cell = getData(activeCell);

      // Only focus input elements, not select elements
      if (cell.contentType !== "select") {
        const cellInput = cellRefs.current[key];
        if (cellInput) {
          cellInput.focus();
        }
      }
    }
  }, [activeCell, getData]);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) => {
    const rowCount = data.length;
    const colCount = data[0].length;
    const input = e.currentTarget;
    const { selectionStart, selectionEnd, value } = input;

    // For Tab and Enter, always prevent default and handle navigation
    if (["Tab", "Enter"].includes(e.key)) {
      // Allow default behavior for Tab if we're at the edge of the grid
      if (e.key === "Tab" && col === colCount - 1 && !e.shiftKey) {
        return;
      }
      if (e.key === "Tab" && col === 0 && e.shiftKey) {
        return;
      }

      e.preventDefault();
    }

    // For arrow keys, check if we should navigate within the text or between cells
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      // For text navigation within the cell
      if (e.key === "ArrowLeft" && selectionStart !== 0) {
        // If cursor is not at the beginning, allow normal text navigation
        return;
      }
      if (e.key === "ArrowRight" && selectionEnd !== value.length) {
        // If cursor is not at the end, allow normal text navigation
        return;
      }

      // For vertical arrows, always navigate between cells
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }
    }

    let newRow = row;
    let newCol = col;

    switch (e.key) {
      case "ArrowUp":
        newRow = Math.max(0, row - 1);
        break;
      case "ArrowDown":
        newRow = Math.min(rowCount - 1, row + 1);
        break;
      case "ArrowLeft":
        // Only navigate to previous cell if at the beginning of text
        if (selectionStart === 0) {
          newCol = Math.max(0, col - 1);
        }
        break;
      case "ArrowRight":
        // Only navigate to next cell if at the end of text
        if (selectionEnd === value.length) {
          newCol = Math.min(colCount - 1, col + 1);
        }
        break;
      case "Tab":
        if (e.shiftKey) {
          // Shift+Tab: move left
          if (col > 0) {
            newCol = col - 1;
          } else if (row > 0) {
            // Move to the end of the previous row
            newRow = row - 1;
            newCol = colCount - 1;
          }
        } else {
          // Tab: move right
          if (col < colCount - 1) {
            newCol = col + 1;
          } else if (row < rowCount - 1) {
            // Move to the beginning of the next row
            newRow = row + 1;
            newCol = 0;
          }
        }
        break;
      case "Enter":
        if (e.shiftKey) {
          // Shift+Enter: move up
          if (row > 0) {
            newRow = row - 1;
          } else {
            // If at the top row, wrap to the bottom of the previous column
            if (col > 0) {
              newCol = col - 1;
              newRow = rowCount - 1;
            }
          }
        } else {
          // Enter: move down
          if (row < rowCount - 1) {
            newRow = row + 1;
          } else {
            // If at the bottom row, wrap to the top of the next column
            if (col < colCount - 1) {
              newCol = col + 1;
              newRow = 0;
            }
          }
        }
        break;
      default:
        return; // Exit for other keys
    }

    // Only update if the cell position has changed
    if (newRow !== row || newCol !== col) {
      // In preview mode, skip disabled cells
      if (!canInteractWithCell({ row: newRow, col: newCol })) {
        let foundNonDisabled = false;
        let attempts = 0;
        const maxAttempts = rowCount * colCount;

        const movingDown = newRow > row;
        const movingUp = newRow < row;
        const movingRight = newCol > col;
        const movingLeft = newCol < col;

        // Store original target position
        const [originalNewRow, originalNewCol] = [newRow, newCol];

        while (!foundNonDisabled && attempts < maxAttempts) {
          attempts++;

          if (movingDown) {
            newRow++;
            if (newRow >= rowCount) {
              newRow = 0;
              newCol = (newCol + 1) % colCount;
            }
          } else if (movingUp) {
            newRow--;
            if (newRow < 0) {
              newRow = rowCount - 1;
              newCol = (newCol - 1 + colCount) % colCount;
            }
          } else if (movingRight) {
            newCol++;
            if (newCol >= colCount) {
              newCol = 0;
              newRow = (newRow + 1) % rowCount;
            }
          } else if (movingLeft) {
            newCol--;
            if (newCol < 0) {
              newCol = colCount - 1;
              newRow = (newRow - 1 + rowCount) % rowCount;
            }
          }

          if (newRow === row && newCol === col) {
            return;
          }

          if (
            newRow >= 0 &&
            newRow < rowCount &&
            newCol >= 0 &&
            newCol < colCount
          ) {
            if (!data[newRow][newCol].disabled) {
              foundNonDisabled = true;
            }
          }

          if (attempts >= maxAttempts) {
            newRow = originalNewRow;
            newCol = originalNewCol;
            return;
          }
        }
      }

      setActiveCell(newRow, newCol);
    }
  };

  // Handle mouse move during resize
  useEffect(() => {
    const handleMouseMove = ({ clientX, clientY }: MouseEvent) => {
      if (isResizing !== null) updateResize(clientX);
      if (isResizingRow !== null) updateRowResize(clientY);
    };

    const handleMouseUp = () => {
      if (isResizing !== null) endResize();
      if (isResizingRow !== null) endRowResize();
    };

    if (isResizing !== null || isResizingRow !== null) {
      const controller = new AbortController();
      const { signal } = controller;

      document.addEventListener("mousemove", handleMouseMove, { signal });
      document.addEventListener("mouseup", handleMouseUp, { signal });

      return () => {
        controller.abort();
      };
    }
  }, [
    isResizing,
    isResizingRow,
    updateResize,
    endResize,
    updateRowResize,
    endRowResize,
  ]);

  const renderCellContent = (
    cell: CellData,
    rowIndex: number,
    colIndex: number,
  ) => {
    const isActive =
      activeCell?.row === rowIndex && activeCell?.col === colIndex;
    const interactable = canInteractWithCell({
      row: rowIndex,
      col: colIndex,
    });

    // If cell has a link and is not being edited, show a link display
    if (cell.link && !isActive) {
      return <LinkCell cell={cell} canInteractWithCell={interactable} />;
    }

    switch (cell.contentType) {
      case "number":
        return (
          <InputCell
            inputMode="numeric"
            canInteractWithCell={interactable}
            cell={cell}
            coordinates={{ row: rowIndex, col: colIndex }}
            cellRefs={cellRefs}
            handleCellChange={handleCellChange}
            handleKeyDown={handleKeyDown}
          />
        );
      case "select":
        return (
          <SelectCell
            cell={cell}
            canInteractWithCell={interactable}
            coordinates={{ row: rowIndex, col: colIndex }}
            openSelectCell={openSelectCell}
            onCellClick={handleCellClick}
            onOpenSelectDropdown={(cellKey) =>
              handleOpenSelectDropdown(cellKey, {
                row: rowIndex,
                col: colIndex,
              })
            }
            onSelectChange={handleSelectChange}
          />
        );
      default: // text
        return (
          <InputCell
            inputMode="text"
            canInteractWithCell={interactable}
            cell={cell}
            coordinates={{ row: rowIndex, col: colIndex }}
            cellRefs={cellRefs}
            handleCellChange={handleCellChange}
            handleKeyDown={handleKeyDown}
          />
        );
    }
  };

  const totalWidth =
    columnWidths.reduce((sum, width) => sum + width, 0) + ROW_HEADER_WIDTH;

  return (
    <div id="spreadsheet-grid">
      <div
        ref={spreadsheetRef}
        className="relative overflow-auto"
        style={{ maxWidth: "100%", maxHeight: "500px" }}
      >
        <div className="relative">
          <table
            className="table-fixed border-separate border-spacing-0"
            style={{ width: totalWidth }}
          >
            <thead>
              <tr>
                {/* Top-left corner cell */}
                <th className="sticky top-0 left-0 z-30 w-10 border border-gray-300 bg-gray-100" />

                <ColumnHeaders onContextMenu={handleColumnContextMenu} />
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <RowHeader
                    rowIndex={rowIndex}
                    onContextMenu={handleRowContextMenu}
                  />
                  {row.map((cell, colIndex) => (
                    <Cell
                      key={colIndex}
                      coordinates={{ row: rowIndex, col: colIndex }}
                      onCellClick={handleCellClick}
                    >
                      {renderCellContent(cell, rowIndex, colIndex)}
                    </Cell>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Menu - Positioned outside the spreadsheet container */}
      {contextMenu && !isPreviewMode && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          options={
            contextMenu.type === "row"
              ? [
                  {
                    label: "Delete Row",
                    icon: <Trash2 className="mr-2 h-4 w-4" />,
                    onClick: () => deleteRow(contextMenu.index),
                  },
                ]
              : [
                  {
                    label: "Delete Column",
                    icon: <Trash2 className="mr-2 h-4 w-4" />,
                    onClick: () => deleteColumn(contextMenu.index),
                  },
                ]
          }
        />
      )}
    </div>
  );
}
