import { cloneDeep, compact, uniq } from "lodash";
import { create } from "zustand";
import {
  DEFAULT_COLUMN_COUNT,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_COUNT,
  DEFAULT_ROW_HEIGHT,
  MAX_HISTORY_LENGTH,
} from "./constants";
import { capi, CapiFields } from "./simcapi/model";
import { buildDefaultCell, isSameCell } from "./utils";

export type TextAlign = "left" | "center" | "right";
export type CellContentType = "text" | "number" | "select" | "not-editable";
export type CellCoordinates = { row: number; col: number };
export type AppMode = "config" | "preview";
export type PermissionLevel = "student" | "ld";

export interface CellData {
  isCorrect?: boolean;
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
  fontSize: number;
  contentType: CellContentType;
  selectOptions: string[];
  link: string | null;
  disabled: boolean;
  correctAnswer: string | null;
}

interface HistoryEntry {
  data: CellData[][];
  activeCell: CellCoordinates | null;
  columnWidths: number[];
  rowHeights: number[];
}

export interface SpreadsheetState {
  isLoading: boolean;

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

  isModified: boolean;
  showHints: boolean;
  setShowHints: (showHints: boolean) => void;
  unsetCorrectnessFromCell: (coordinates: CellCoordinates) => void;
  showCorrectAnswers: boolean;
  permissionLevel: PermissionLevel;
  enableTable: boolean;
  appMode: AppMode;
  toggleAppMode: VoidFunction;

  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  isUndoRedo: boolean;
  lastHistoryId: number;

  isSelectOptionsDialogOpen: boolean;
  setIsSelectOptionsDialogOpen: (isOpen: boolean) => void;
  selectedCells: CellCoordinates[];
  setSelectedCells: (cells: CellCoordinates[]) => void;
  clearCellSelection: () => void;
  addCellToSelection: (cell: CellCoordinates) => void;

  title: string | null;
  summary: string | null;
  setTitle: (title: string | null) => void;
  setSummary: (summary: string | null) => void;

  resetTable: VoidFunction;

  removeActiveCell: VoidFunction;
  setActiveCell: (row: number, col: number) => void;
  updateCellContent: (content: string) => void;
  toggleFormat: (format: "isBold" | "isItalic" | "isStrikethrough") => void;
  setAlignment: (alignment: TextAlign) => void;
  setTextColor: (color: string) => void;
  setBorderWidth: (width: number) => void;
  setBorderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setContentType: (contentType: CellContentType) => void;
  setSelectOptions: (options: string[]) => void;
  setAllCellsSelected: VoidFunction;
  setLink: (url: string | null) => void;
  addRow: VoidFunction;
  addColumn: VoidFunction;
  deleteRow: (rowIndex: number) => void;
  deleteColumn: (colIndex: number) => void;

  startResize: (index: number, clientX: number) => void;
  updateResize: (clientX: number) => void;
  endResize: VoidFunction;

  startRowResize: (index: number, clientY: number) => void;
  updateRowResize: (clientY: number) => void;
  endRowResize: VoidFunction;

  pushToHistory: VoidFunction;
  undo: VoidFunction;
  redo: VoidFunction;
  canUndo: () => boolean;
  canRedo: () => boolean;

  updateCorrectAnswer: (correctAnswer: string) => void;

  getData: (cell: CellCoordinates) => CellData;
  canInteractWithCell: (cell: CellCoordinates) => boolean;
}

const createInitialData = (rows: number, cols: number): CellData[][] => {
  return Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0).map(buildDefaultCell));
};

const updateCells = (
  data: CellData[][],
  cellsCoordinates: (CellCoordinates | null)[],
  updates: Partial<CellData>,
) => {
  uniq(compact(cellsCoordinates)).forEach(({ row, col }) => {
    data[row][col] = { ...data[row][col], ...updates };
  });
  return data;
};

const useSpreadsheetStore = create<SpreadsheetState>((set, get) => {
  return {
    isLoading: true,

    data: createInitialData(DEFAULT_ROW_COUNT, DEFAULT_COLUMN_COUNT),
    activeCell: null,
    columnWidths: Array(DEFAULT_COLUMN_COUNT).fill(DEFAULT_COLUMN_WIDTH),
    rowHeights: Array(DEFAULT_ROW_COUNT).fill(DEFAULT_ROW_HEIGHT),
    isResizing: null,
    isResizingRow: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,

    isModified: false,
    showCorrectAnswers: capi.defaults[CapiFields.IsComplete],
    enableTable: capi.defaults[CapiFields.Enabled],
    showHints: capi.defaults[CapiFields.ShowHints],
    permissionLevel: "student",
    title: null,
    setTitle: (title) => set({ title }),
    summary: null,
    setSummary: (summary) => set({ summary }),
    appMode: capi.defaults[CapiFields.Mode],
    toggleAppMode: () =>
      set((state) => ({
        appMode: state.appMode === "config" ? "preview" : "config",
        activeCell: null,
        selectedCells: [],
      })),

    undoStack: [],
    redoStack: [],
    isUndoRedo: false,
    lastHistoryId: 0,

    isSelectOptionsDialogOpen: false,
    setIsSelectOptionsDialogOpen: (isOpen: boolean) =>
      set({ isSelectOptionsDialogOpen: isOpen }),
    selectedCells: [],
    setSelectedCells: (cells) => set({ selectedCells: cells }),
    setAllCellsSelected: () =>
      set((state) => {
        const cells = state.data
          .map((row, rowIdx) =>
            row.map((_, colIdx) => ({ row: rowIdx, col: colIdx })),
          )
          .flat();
        return { selectedCells: cells, activeCell: null };
      }),
    clearCellSelection: () => set({ selectedCells: [] }),
    addCellToSelection: (coordinates) =>
      set((state) => {
        const cellExists = state.selectedCells.some((cell) =>
          isSameCell(cell, coordinates),
        );
        if (!cellExists) {
          return { selectedCells: [...state.selectedCells, coordinates] };
        }
        return state;
      }),

    unsetCorrectnessFromCell: (coordinates) =>
      set((state) => {
        return {
          data: updateCells(state.data, [coordinates], {
            isCorrect: undefined,
          }),
        };
      }),

    setShowHints: (showHints) =>
      set((state) => {
        const newData = cloneDeep(state.data);

        newData.forEach((row, rowIdx) => {
          row.forEach((cell, colIdx) => {
            if (cell.contentType !== "not-editable" && cell.correctAnswer) {
              if (showHints) {
                newData[rowIdx][colIdx].isCorrect =
                  cell.content === cell.correctAnswer ||
                  +cell.content === +cell.correctAnswer;
              } else {
                newData[rowIdx][colIdx].isCorrect = undefined;
              }
            }
          });
        });

        return {
          showHints,
          data: newData,
        };
      }),

    updateCorrectAnswer: (correctAnswer) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;

        const newData = cloneDeep(state.data);
        const cell = state.getData(state.activeCell);

        // Validate answer based on content type
        let validatedAnswer: string | null = correctAnswer;
        if (cell.contentType === "number") {
          if (correctAnswer === "" || !isNaN(Number(correctAnswer))) {
            validatedAnswer = correctAnswer;
          } else {
            // If invalid number, keep the previous content
            validatedAnswer = cell.correctAnswer;
          }
        }

        if (correctAnswer === cell.correctAnswer) return state;

        newData[state.activeCell.row][state.activeCell.col] = {
          ...cell,
          correctAnswer: validatedAnswer,
        };

        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    getData: (cell) => {
      const { row, col } = cell;
      return get().data[row][col];
    },

    resetTable: () => {
      if (get().appMode === "preview") return;

      const newData = createInitialData(
        DEFAULT_ROW_COUNT,
        DEFAULT_COLUMN_COUNT,
      );
      const newColumnWidths =
        Array(DEFAULT_COLUMN_COUNT).fill(DEFAULT_COLUMN_WIDTH);
      const newRowHeights = Array(DEFAULT_ROW_COUNT).fill(DEFAULT_ROW_HEIGHT);

      // Push to history before resetting
      get().pushToHistory();

      return set({
        data: newData,
        activeCell: null,
        columnWidths: newColumnWidths,
        rowHeights: newRowHeights,
        selectedCells: [],
      });
    },

    pushToHistory: () =>
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
      }),

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

    removeActiveCell: () => set({ activeCell: null }),
    setActiveCell: (row, col) => set({ activeCell: { row, col } }),

    updateCellContent: (content) =>
      set((state) => {
        if (!state.activeCell) return state;

        const cell = state.getData(state.activeCell);

        if (!state.canInteractWithCell(state.activeCell)) {
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
        const result = {
          data: newData,
          isModified: state.permissionLevel === "student",
        };
        get().pushToHistory();
        return result;
      }),

    toggleFormat: (format) =>
      set((state) => {
        const { activeCell, getData, selectedCells } = state;

        const currentCell = activeCell
          ? getData(activeCell)
          : getData(selectedCells[0]);

        const newData = updateCells(
          state.data,
          [...state.selectedCells, state.activeCell],
          {
            [format]: !currentCell[format],
          },
        );

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setAlignment: (alignment) =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = updateCells(
          state.data,
          [...state.selectedCells, state.activeCell],
          {
            textAlign: alignment,
          },
        );

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setTextColor: (color) =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = updateCells(
          state.data,
          [...state.selectedCells, state.activeCell],
          {
            textColor: color,
          },
        );

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setBorderWidth: (width) =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = updateCells(
          state.data,
          [...state.selectedCells, state.activeCell],
          {
            borderWidth: width,
          },
        );

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setBorderColor: (color) =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = updateCells(
          state.data,
          [...state.selectedCells, state.activeCell],
          {
            borderColor: color,
          },
        );

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setBackgroundColor: (color) =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = updateCells(
          state.data,
          [...state.selectedCells, state.activeCell],
          {
            backgroundColor: color,
          },
        );

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setFontFamily: (fontFamily) =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = updateCells(
          state.data,
          [...state.selectedCells, state.activeCell],
          {
            fontFamily,
          },
        );

        // Push to history immediately
        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setFontSize: (fontSize) =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = updateCells(
          state.data,
          [...state.selectedCells, state.activeCell],
          {
            fontSize,
          },
        );

        const result = { data: newData };
        get().pushToHistory();
        return result;
      }),

    setContentType: (contentType) =>
      set((state) => {
        if (!state.activeCell || state.appMode === "preview") return state;
        if (state.getData(state.activeCell).contentType === contentType)
          return state;

        const newData = [...state.data];
        const cell = state.getData(state.activeCell);

        newData[state.activeCell.row][state.activeCell.col] = {
          ...cell,
          contentType,
          content: "",
          correctAnswer: null,
          disabled: contentType === "not-editable",
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

        newData[state.activeCell.row][state.activeCell.col] = {
          ...cell,
          selectOptions: options,
          content: "",
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
        get().pushToHistory();

        const newData = cloneDeep(state.data);
        const newRow = newData[0].map(() => buildDefaultCell());
        newData.push(newRow);

        const newRowHeights = [...state.rowHeights, DEFAULT_ROW_HEIGHT];

        // Push to history immediately
        return {
          data: newData,
          rowHeights: newRowHeights,
          selectedCells: [],
        };
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
        const result = {
          data: newData,
          rowHeights: newRowHeights,
          activeCell,
          selectedCells: [],
        };
        get().pushToHistory();
        return result;
      }),

    addColumn: () =>
      set((state) => {
        if (state.appMode === "preview") return state;

        const newData = state.data.map((row) => [...row, buildDefaultCell()]);

        const newColumnWidths = [...state.columnWidths, DEFAULT_COLUMN_WIDTH];

        // Push to history immediately
        const result = {
          data: newData,
          columnWidths: newColumnWidths,
          selectedCells: [],
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
          selectedCells: [],
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

    canInteractWithCell: (coordinates) => {
      const state = get();
      const cell = state.getData(coordinates);

      if (state.appMode === "config" && state.permissionLevel === "ld")
        return true;

      const tableIsDisabledForStudents =
        !state.enableTable && state.permissionLevel === "student";

      const isDisabled =
        cell.disabled || tableIsDisabledForStudents || state.showCorrectAnswers;

      return !isDisabled;
    },
  };
});

export default useSpreadsheetStore;
