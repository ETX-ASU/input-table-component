import { useCallback, useEffect, useRef, useState } from "react";
import { ROW_HEADER_WIDTH } from "../lib/constants";
import useSpreadsheetStore, { CellCoordinates, CellData } from "../lib/store";
import { isSameCell } from "../lib/utils";
import { Cell } from "./cell";
import { InputCell, LinkCell, SelectCell } from "./cell-types";
import { ContextMenu } from "./context-menu";
import { Icon } from "./Icon";
import { ColumnHeaders, RowHeader } from "./spreadsheet-headers";

// Context menu types
type ContextMenuType = "row" | "column" | null;
type NavigationDirection = "up" | "down" | "left" | "right";

interface ContextMenuState {
  type: ContextMenuType;
  index: number;
  x: number;
  y: number;
}

export function SpreadsheetGrid() {
  const [isMouseSelecting, setIsMouseSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<CellCoordinates | null>(
    null,
  );

  const {
    data,
    activeCell,
    columnWidths,
    isResizing,
    isResizingRow,
    appMode,
    selectedCells,
    setActiveCell,
    updateResize,
    endResize,
    updateRowResize,
    endRowResize,
    deleteRow,
    deleteColumn,
    getData,
    setSelectedCells,
    clearCellSelection,
  } = useSpreadsheetStore();

  const spreadsheetRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isSelectCellActive, setIsSelectCellActive] = useState(false);
  const [openSelectCells, setOpenSelectCells] = useState<
    Record<string, boolean>
  >({});

  const isPreviewMode = appMode === "preview";

  const calculateSelectionRange = (
    start: { row: number; col: number },
    end: { row: number; col: number },
  ) => {
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const cells: { row: number; col: number }[] = [];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        cells.push({ row, col });
      }
    }
    return cells;
  };

  const handleCellClick = (row: number, col: number) => {
    setActiveCell(row, col);

    if (!isMouseSelecting && selectedCells.length > 0) {
      clearCellSelection();
    }
  };

  const handleCellMouseDown = (
    e: React.MouseEvent,
    row: number,
    col: number,
  ) => {
    // Only handle left mouse button
    if (e.button !== 0) return;

    // In preview mode, don't select disabled cells
    if (isPreviewMode && data[row][col].disabled) {
      return;
    }

    // Only allow selection to start from the currently active cell
    if (activeCell && (activeCell.row !== row || activeCell.col !== col)) {
      // If clicking on a different cell, just set it as active and return
      setActiveCell(row, col);
      clearCellSelection();
      return;
    }

    e.preventDefault();

    clearCellSelection();

    setSelectionStart(activeCell);

    setIsMouseSelecting(true);
  };

  // Add mouse enter handler for updating selection:
  const handleCellMouseEnter = (row: number, col: number) => {
    if (!selectionStart) return;

    const hasMoved = selectionStart.row !== row || selectionStart.col !== col;

    if (hasMoved && !isMouseSelecting) {
      // Start mouse selection on first movement
      setIsMouseSelecting(true);
    }

    if (isMouseSelecting && hasMoved) {
      if (isPreviewMode && data[row][col].disabled) {
        return;
      }

      // Calculate and update selection
      const selectedRange = calculateSelectionRange(selectionStart, {
        row,
        col,
      });
      setSelectedCells(selectedRange);
    }
  };

  const handleMouseUp = useCallback(() => {
    if (isMouseSelecting) {
      setIsMouseSelecting(false);
    }
    setSelectionStart(null);
  }, [isMouseSelecting]);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseUp]);

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
      const cellInput = cellRefs.current[key];

      if (cellInput) cellInput.focus();
    }
  }, [activeCell, getData]);

  // Navigate to a specific cell, handling disabled cells in preview mode
  const navigateToCell = useCallback(
    (direction: NavigationDirection) => {
      if (!activeCell) return;

      const { row, col } = activeCell;
      const rowCount = data.length;
      const colCount = data[0].length;

      let newRow = row;
      let newCol = col;

      switch (direction) {
        case "up":
          newRow = Math.max(0, row - 1);
          break;
        case "down":
          newRow = Math.min(rowCount - 1, row + 1);
          break;
        case "left":
          newCol = Math.max(0, col - 1);
          break;
        case "right":
          newCol = Math.min(colCount - 1, col + 1);
          break;
      }

      // Only update if the cell position has changed
      if (newRow !== row || newCol !== col) {
        setActiveCell(newRow, newCol);
      }
    },
    [activeCell, data, setActiveCell],
  );

  // Handle keyboard events for input cells
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) => {
    const input = e.currentTarget;
    const { selectionStart, selectionEnd, value, type } = input;

    clearCellSelection();

    // For Tab and Enter, always prevent default and handle navigation
    if (["Tab", "Enter"].includes(e.key)) {
      e.preventDefault();

      if (e.key === "Tab") {
        // Handle Tab navigation with row wrapping
        if (col === data[0].length - 1 && !e.shiftKey) {
          // At the end of row, move to first cell of next row
          if (row < data.length - 1) {
            setActiveCell(row + 1, 0);
          }
        } else if (col === 0 && e.shiftKey) {
          // At the beginning of row, move to last cell of previous row
          if (row > 0) {
            setActiveCell(row - 1, data[0].length - 1);
          }
        } else {
          // Normal left/right navigation within a row
          navigateToCell(e.shiftKey ? "left" : "right");
        }
      } else if (e.key === "Enter") {
        navigateToCell(e.shiftKey ? "up" : "down");
      }
      return;
    }

    // For arrow keys, check if we should navigate within the text or between cells
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      // For text navigation within the cell
      if (e.key === "ArrowLeft" && type === "text" && selectionStart !== 0) {
        // If cursor is not at the beginning, allow normal text navigation
        return;
      }
      if (
        e.key === "ArrowRight" &&
        type === "text" &&
        selectionEnd !== value.length
      ) {
        // If cursor is not at the end, allow normal text navigation
        return;
      }

      // For vertical arrows, always navigate between cells
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }

      // Map arrow keys to directions
      const directionMap: Record<string, NavigationDirection> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };

      if (Object.keys(openSelectCells).length) return;

      navigateToCell(directionMap[e.key]);
    }
  };

  // Global keyboard event handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle navigation if we have an active cell and it's a select cell
      if (!activeCell || !isSelectCellActive) return;

      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLButtonElement
      ) {
        return;
      }

      // Handle arrow keys for select cells
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();

        // Map arrow keys to directions
        const directionMap: Record<string, NavigationDirection> = {
          ArrowUp: "up",
          ArrowDown: "down",
          ArrowLeft: "left",
          ArrowRight: "right",
        };

        if (Object.keys(openSelectCells).length) return;

        navigateToCell(directionMap[e.key]);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [activeCell, isSelectCellActive, navigateToCell, openSelectCells]);

  // Update isSelectCellActive when activeCell changes
  useEffect(() => {
    if (activeCell) {
      const { row, col } = activeCell;
      const cell = data[row][col];
      setIsSelectCellActive(cell.contentType === "select");
    } else {
      setIsSelectCellActive(false);
    }
  }, [activeCell, data]);

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
    const isActive = isSameCell(activeCell, { row: rowIndex, col: colIndex });

    const coordinates: CellCoordinates = { row: rowIndex, col: colIndex };

    // If cell has a link and is not being edited, show a link display
    if (cell.link && !isActive) {
      return <LinkCell cell={cell} coordinates={coordinates} />;
    }

    switch (cell.contentType) {
      case "not-editable":
        return (
          <InputCell
            inputMode="text"
            coordinates={coordinates}
            ref={(el) => {
              cellRefs.current[`${rowIndex}-${colIndex}`] = el;
            }}
            handleKeyDown={handleInputKeyDown}
          />
        );
      case "number":
        return (
          <InputCell
            inputMode="numeric"
            coordinates={coordinates}
            ref={(el) => {
              cellRefs.current[`${rowIndex}-${colIndex}`] = el;
            }}
            handleKeyDown={handleInputKeyDown}
          />
        );
      case "select":
        return (
          <SelectCell
            coordinates={coordinates}
            ref={(el) => {
              cellRefs.current[`${rowIndex}-${colIndex}`] =
                el as HTMLInputElement;
            }}
            handleKeyDown={handleInputKeyDown}
            onSelectClick={(isOpen) =>
              setOpenSelectCells((prev) => {
                if (isOpen) {
                  return { ...prev, [`${rowIndex}-${colIndex}`]: isOpen };
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { [`${rowIndex}-${colIndex}`]: _, ...rest } = prev;
                return rest;
              })
            }
            isOpen={openSelectCells[`${rowIndex}-${colIndex}`] ?? false}
          />
        );
      default: // text
        return (
          <InputCell
            inputMode="text"
            coordinates={coordinates}
            ref={(el) => {
              cellRefs.current[`${rowIndex}-${colIndex}`] = el;
            }}
            handleKeyDown={handleInputKeyDown}
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
        className="relative overflow-auto pb-2"
        style={{ maxWidth: "100%", maxHeight: "500px" }}
      >
        <div className="relative">
          <table
            className="table-fixed border-collapse border-spacing-0"
            style={{ width: totalWidth }}
          >
            <thead>
              {appMode === "config" && (
                <>
                  <tr>
                    {/* Top-left corner cell */}
                    <th className="sticky top-0 left-0 z-30 w-10 border border-light-gray-80 bg-light-gray-20" />

                    <ColumnHeaders onContextMenu={handleColumnContextMenu} />
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {appMode === "config" && (
                    <RowHeader
                      rowIndex={rowIndex}
                      onContextMenu={handleRowContextMenu}
                    />
                  )}
                  {row.map((cell, colIndex) => (
                    <Cell
                      key={colIndex}
                      coordinates={{ row: rowIndex, col: colIndex }}
                      onCellClick={handleCellClick}
                      handleCellMouseDown={handleCellMouseDown}
                      handleCellMouseEnter={handleCellMouseEnter}
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
                    icon: <Icon name="delete-row" className="h-10 w-10" />,
                    onClick: () => deleteRow(contextMenu.index),
                  },
                ]
              : [
                  {
                    label: "Delete Column",
                    icon: <Icon name="delete-column" className="h-10 w-10" />,
                    onClick: () => deleteColumn(contextMenu.index),
                  },
                ]
          }
        />
      )}
    </div>
  );
}
