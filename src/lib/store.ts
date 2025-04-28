import { cloneDeep } from "lodash";
import { create } from "zustand";
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  MAX_HISTORY_LENGTH,
} from "./constants";
import { buildDefaultCell } from "./utils";

export type TextAlign = "left" | "center" | "right";
export type CellContentType = "text" | "number" | "select";
export type CellCoordinates = { row: number; col: number };
export type AppMode = "config" | "preview";
export type PermissionLevel = "student" | "ld";

export interface CellData {
  content: string;
  isBold: boolean;
  isItalic: boolean;
  isStrikethrough: boolean;
  textAlign: TextAlign;
  textColor: string;
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  fontFamily: string;
  contentType: CellContentType;
  selectOptions: string[];
  link: string | null;
  disabled: boolean;
}

interface HistoryEntry {
  data: CellData[][];
  activeCell: CellCoordinates | null;
  columnWidths: number[];
  rowHeights: number[];
}

export interface SpreadsheetState {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;

  data: CellData[][];
  activeCell: CellCoordinates | null;
  columnWidths: number[];
  rowHeights: number[];
  isResizing: number | null;
  isResizingRow: number | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;

  permissionLevel: PermissionLevel;
  setPermissionLevel: (level: PermissionLevel) => void;
  appMode: AppMode;
  toggleAppMode: () => void;

  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  isUndoRedo: boolean;
  lastHistoryId: number;

  setActiveCell: (row: number, col: number) => void;
  updateCellContent: (content: string) => void;
  toggleFormat: (format: "isBold" | "isItalic" | "isStrikethrough") => void;
  setAlignment: (alignment: TextAlign) => void;
  setTextColor: (color: string) => void;
  setBorderWidth: (width: number) => void;
  setBorderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setFontFamily: (fontFamily: string) => void;
  setContentType: (contentType: CellContentType) => void;
  setSelectOptions: (options: string[]) => void;
  setLink: (url: string | null) => void;
  toggleCellDisabled: () => void;
  addRow: () => void;
  removeRow: () => void;
  addColumn: () => void;
  removeColumn: () => void;

  deleteRow: (rowIndex: number) => void;
  deleteColumn: (colIndex: number) => void;

  startResize: (index: number, clientX: number) => void;
  updateResize: (clientX: number) => void;
  endResize: () => void;

  startRowResize: (index: number, clientY: number) => void;
  updateRowResize: (clientY: number) => void;
  endRowResize: () => void;

  pushToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  getData: (cell: CellCoordinates) => CellData;
}

const createInitialData = (rows: number, cols: number): CellData[][] => {
  return Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0).map(buildDefaultCell));
};

const useSpreadsheetStore = create<SpreadsheetState>((set, get) => {
  const initialData = createInitialData(5, 5);

  return {
    isLoading: false,
    setIsLoading: (isLoading: boolean) => set({ isLoading }),

    data: initialData,
    activeCell: null,
    columnWidths: Array(initialData[0].length).fill(DEFAULT_COLUMN_WIDTH),
    rowHeights: Array(initialData.length).fill(DEFAULT_ROW_HEIGHT),
    isResizing: null,
    isResizingRow: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,

    permissionLevel: "student",
    setPermissionLevel: (level: PermissionLevel) =>
      set({ permissionLevel: level }),
    appMode: "config",
    toggleAppMode: () =>
      set((state) => ({
        appMode: state.appMode === "config" ? "preview" : "config",
      })),

    undoStack: [],
    redoStack: [],
    isUndoRedo: false,
    lastHistoryId: 0,

    getData: (cell: CellCoordinates) => {
      const { row, col } = cell;
      return get().data[row][col];
    },

    pushToHistory: () => {
      set((state) => {
        if (state.isUndoRedo) return state;

        const currentState: HistoryEntry = {
          data: cloneDeep(state.data),
          activeCell: state.activeCell ? { ...state.activeCell } : null,
          columnWidths: [...state.columnWidths],
          rowHeights: [...state.rowHeights],
        };

        const newUndoStack = [currentState, ...state.undoStack].slice(
          0,
          MAX_HISTORY_LENGTH,
        );

        return {
          undoStack: newUndoStack,
          redoStack: [],
          lastHistoryId: state.lastHistoryId + 1,
        };
      });
    },

    // Undo the ast action
    undo: () => {
      const canUndo = get().canUndo();
      if (!canUndo) return;

      set((state) => {
        // Get the current state before applying undo
        const currentState: HistoryEntry = {
          data: cloneDeep(state.data),
          activeCell: state.activeCell ? { ...state.activeCell } : null,
          columnWidths: [...state.columnWidths],
          rowHeights: [...state.rowHeights],
        };

        // Get the state to restore from the undo stack
        const [stateToRestore, ...newUndoStack] = state.undoStack;

        return {
          // Restore the previous state
          data: cloneDeep(stateToRestore.data),
          activeCell: stateToRestore.activeCell
            ? { ...stateToRestore.activeCell }
            : null,
          columnWidths: [...stateToRestore.columnWidths],
          rowHeights: [...stateToRestore.rowHeights],

          // Update the stacks
          undoStack: newUndoStack,
          redoStack: [currentState, ...state.redoStack],
          isUndoRedo: true,
          lastHistoryId: state.lastHistoryId + 1,
        };
      });

      // Reset the isUndoRedo flag after the operation
      setTimeout(() => set({ isUndoRedo: false }), 0);
    },

    redo: () => {
      const canRedo = get().canRedo();
      if (!canRedo) return;

      set((state) => {
        // Get the current state before applying redo
        const currentState: HistoryEntry = {
          data: cloneDeep(state.data),
          activeCell: state.activeCell ? { ...state.activeCell } : null,
          columnWidths: [...state.columnWidths],
          rowHeights: [...state.rowHeights],
        };

        // Get the state to restore from the redo stack
        const [stateToRestore, ...newRedoStack] = state.redoStack;

        return {
          // Restore the next state
          data: cloneDeep(stateToRestore.data),
          activeCell: stateToRestore.activeCell
            ? { ...stateToRestore.activeCell }
            : null,
          columnWidths: [...stateToRestore.columnWidths],
          rowHeights: [...stateToRestore.rowHeights],

          // Update the stacks
          redoStack: newRedoStack,
          undoStack: [currentState, ...state.undoStack],
          isUndoRedo: true,
          lastHistoryId: state.lastHistoryId + 1,
        };
      });

      // Reset the isUndoRedo flag after the operation
      setTimeout(() => set({ isUndoRedo: false }), 0);
    },

    canUndo: () => {
      return get().undoStack.length > 0;
    },

    canRedo: () => {
      return get().redoStack.length > 0;
    },

    setActiveCell: (row, col) => set({ activeCell: { row, col } }),

    updateCellContent: (content) =>
      set((state) => {
        if (!state.activeCell) return state;

        const cell = state.data[state.activeCell.row][state.activeCell.col];

        if (state.appMode === "preview" && cell.disabled) {
          return state;
        }

        const newData = [...state.data];

        // Validate content based on content type
        let validatedContent = content;
        if (cell.contentType === "number") {
          if (content === "" || !isNaN(Number(content))) {
            validatedContent = content;
          } else {
            // If invalid number, keep the previous content
            validatedContent = cell.content;
          }
        }

        // Only update if content actually changed
        if (validatedContent === cell.content) return state;

        newData[state.activeCell.row][state.activeCell.col] = {
          ...cell,
          content: validatedContent,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    toggleCellDisabled: () =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        const currentCell = newData[state.activeCell.row][state.activeCell.col];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...currentCell,
          disabled: !currentCell.disabled,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    toggleFormat: (format) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        const currentCell = newData[state.activeCell.row][state.activeCell.col];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...currentCell,
          [format]: !currentCell[format],
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setAlignment: (alignment) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...newData[state.activeCell.row][state.activeCell.col],
          textAlign: alignment,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setTextColor: (color) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...newData[state.activeCell.row][state.activeCell.col],
          textColor: color,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setBorderWidth: (width) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...newData[state.activeCell.row][state.activeCell.col],
          borderWidth: width,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setBorderColor: (color) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...newData[state.activeCell.row][state.activeCell.col],
          borderColor: color,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setBackgroundColor: (color) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...newData[state.activeCell.row][state.activeCell.col],
          backgroundColor: color,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setFontFamily: (fontFamily) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...newData[state.activeCell.row][state.activeCell.col],
          fontFamily,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setContentType: (contentType) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        const cell = newData[state.activeCell.row][state.activeCell.col];

        // Clear content if changing to a different type
        let content = cell.content;
        if (contentType === "number" && cell.contentType !== "number") {
          // If switching to number, ensure content is valid or clear it
          content = content === "" || !isNaN(Number(content)) ? content : "";
        }

        newData[state.activeCell.row][state.activeCell.col] = {
          ...cell,
          contentType,
          content,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setSelectOptions: (options) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        const cell = newData[state.activeCell.row][state.activeCell.col];

        // Clear content if the current value is not in the new options
        let content = cell.content;
        if (cell.contentType === "select" && !options.includes(content)) {
          content = options.length > 0 ? options[0] : "";
        }

        newData[state.activeCell.row][state.activeCell.col] = {
          ...cell,
          selectOptions: options,
          content,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setLink: (url) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = [...state.data];
        newData[state.activeCell.row][state.activeCell.col] = {
          ...newData[state.activeCell.row][state.activeCell.col],
          link: url,
        };

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    addRow: () =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newRow = Array(state.data[0].length)
          .fill(0)
          .map(buildDefaultCell);

        const newData = [...state.data, newRow];
        const newRowHeights = [...state.rowHeights, DEFAULT_ROW_HEIGHT];

        // Push to history immediately
        const result = { data: newData, rowHeights: newRowHeights };
        get().pushToHistory();
        return result;
      }),

    removeRow: () =>
      set((state) => {
        if (state.data.length <= 1 || state.appMode === "preview") return state;

        const newData = [...state.data];
        newData.pop();

        const newRowHeights = [...state.rowHeights];
        newRowHeights.pop();

        // Reset active cell if it's in the removed row
        let activeCell = state.activeCell;
        if (activeCell && activeCell.row >= newData.length) {
          activeCell = null;
        }

        // Push to history immediately
        const result = { data: newData, rowHeights: newRowHeights, activeCell };
        get().pushToHistory();
        return result;
      }),

    deleteRow: (rowIndex) =>
      set((state) => {
        // Don't delete if it's the last row
        if (state.data.length <= 1 || state.appMode === "preview") return state;

        // Create new data array without the specified row
        const newData = [...state.data];
        newData.splice(rowIndex, 1);

        // Remove the height of the deleted row
        const newRowHeights = [...state.rowHeights];
        newRowHeights.splice(rowIndex, 1);

        // Reset active cell if it's in the deleted row or adjust its position
        let activeCell = state.activeCell;
        if (activeCell) {
          if (activeCell.row === rowIndex) {
            activeCell = null;
          } else if (activeCell.row > rowIndex) {
            // Adjust row index for cells below the deleted row
            activeCell = { row: activeCell.row - 1, col: activeCell.col };
          }
        }

        // Push to history immediately
        const result = { data: newData, rowHeights: newRowHeights, activeCell };
        get().pushToHistory();
        return result;
      }),

    addColumn: () =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = state.data.map((row) => [...row, buildDefaultCell()]);

        const newColumnWidths = [...state.columnWidths, DEFAULT_COLUMN_WIDTH];

        // Push to history immediately
        const result = { data: newData, columnWidths: newColumnWidths };
        get().pushToHistory();
        return result;
      }),

    removeColumn: () =>
      set((state) => {
        if (state.data[0].length <= 1 || state.appMode === "preview")
          return state;

        const newData = state.data.map((row) => {
          const newRow = [...row];
          newRow.pop();
          return newRow;
        });

        const newColumnWidths = [...state.columnWidths];
        newColumnWidths.pop();

        // Reset active cell if it's in the removed column
        let activeCell = state.activeCell;
        if (activeCell && activeCell.col >= newData[0].length) {
          activeCell = null;
        }

        // Push to history immediately
        const result = {
          data: newData,
          columnWidths: newColumnWidths,
          activeCell,
        };
        get().pushToHistory();
        return result;
      }),

    deleteColumn: (colIndex) =>
      set((state) => {
        // Don't delete if it's the last column
        if (state.data[0].length <= 1 || state.appMode === "preview")
          return state;

        // Create new data array without the specified column
        const newData = state.data.map((row) => {
          const newRow = [...row];
          newRow.splice(colIndex, 1);
          return newRow;
        });

        // Remove the width of the deleted column
        const newColumnWidths = [...state.columnWidths];
        newColumnWidths.splice(colIndex, 1);

        // Reset active cell if it's in the deleted column or adjust its position
        let activeCell = state.activeCell;
        if (activeCell) {
          if (activeCell.col === colIndex) {
            activeCell = null;
          } else if (activeCell.col > colIndex) {
            // Adjust column index for cells to the right of the deleted column
            activeCell = { row: activeCell.row, col: activeCell.col - 1 };
          }
        }

        // Push to history immediately
        const result = {
          data: newData,
          columnWidths: newColumnWidths,
          activeCell,
        };
        get().pushToHistory();
        return result;
      }),

    startResize: (index, clientX) => {
      set((state) => {
        if (state.appMode === "preview") return state;
        return {
          isResizing: index,
          startX: clientX,
          startWidth: get().columnWidths[index],
        };
      });
    },

    updateResize: (clientX) =>
      set((state) => {
        if (state.isResizing === null || state.appMode === "preview")
          return state;

        const diff = clientX - state.startX;
        const newWidth = Math.max(50, state.startWidth + diff); // Minimum width of 50px

        const newColumnWidths = [...state.columnWidths];
        newColumnWidths[state.isResizing] = newWidth;

        return { columnWidths: newColumnWidths };
      }),

    endResize: () => {
      if (get().appMode === "preview") return set({});

      const result = { isResizing: null };
      get().pushToHistory();
      return set(result);
    },

    startRowResize: (index, clientY) =>
      set((state) => {
        if (state.appMode === "preview") return state;
        return {
          isResizingRow: index,
          startY: clientY,
          startHeight: get().rowHeights[index],
        };
      }),

    updateRowResize: (clientY) =>
      set((state) => {
        if (state.isResizingRow === null || state.appMode === "preview")
          return state;

        const diff = clientY - state.startY;
        const newHeight = Math.max(20, state.startHeight + diff); // Minimum height of 20px

        const newRowHeights = [...state.rowHeights];
        newRowHeights[state.isResizingRow] = newHeight;

        return { rowHeights: newRowHeights };
      }),

    endRowResize: () => {
      if (get().appMode === "preview") return set({});

      const result = { isResizingRow: null };
      get().pushToHistory();
      return set(result);
    },
  };
});

export default useSpreadsheetStore;
