import clsx from "clsx";
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Lock,
} from "lucide-react";
import { FC, forwardRef, ReactNode, useState } from "react";
import { DEFAULT_ROW_HEIGHT } from "../lib/constants";
import useSpreadsheetStore, {
  CellCoordinates,
  CellData,
  TextAlign,
} from "../lib/store";
import { colorPalette } from "./color-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const buildAlignmentClass = (align: TextAlign) => {
  return {
    center: "text-center",
    right: "text-right",
    left: "text-left",
  }[align || "left"];
};

const buildCommonStyles = (cell: CellData) => ({
  color: cell.textColor,
  fontFamily: cell.fontFamily,
});

const buildCommonClasses = (cell: CellData, canInteractWithCell: boolean) =>
  clsx(
    "h-full w-full bg-transparent focus:outline-none",
    buildAlignmentClass(cell.textAlign),
    cell.isBold && "font-bold",
    cell.isItalic && "italic",
    cell.isStrikethrough && "line-through",
    !canInteractWithCell && "cursor-not-allowed",
  );

type CorrectnessIndicatorWrapperProps = {
  showIndicator: boolean;
  isCorrect: boolean;
  children: ReactNode;
  className?: string;
};

const CorrectnessIndicatorWrapper = ({
  showIndicator,
  isCorrect,
  children,
  className,
}: CorrectnessIndicatorWrapperProps) => {
  const correctIcon = (
    <CircleCheck stroke="white" fill={colorPalette.green[80]} className="h-6" />
  );
  const incorrectIcon = (
    <CircleAlert stroke="white" fill={colorPalette.red[100]} className="h-6" />
  );

  return (
    <div
      className={clsx("flex items-center gap-2 truncate px-2 py-1", className)}
    >
      {showIndicator && (
        <div className="flex-shrink-0 rounded">
          {isCorrect ? correctIcon : incorrectIcon}
        </div>
      )}
      {children}
    </div>
  );
};

type LinkCellProps = {
  cell: CellData;
  coordinates: CellCoordinates;
};

const LinkCell: FC<LinkCellProps> = ({ cell, coordinates }) => {
  const { canInteractWithCell } = useSpreadsheetStore();

  return (
    <div
      className={clsx(
        buildCommonClasses(cell, canInteractWithCell(coordinates)),
        "flex items-center gap-1 overflow-hidden text-blue-600 underline",
      )}
      style={{ ...buildCommonStyles(cell), height: DEFAULT_ROW_HEIGHT - 1 }}
    >
      <span className="flex-1 truncate">{cell.content}</span>
      <a href={cell.link!} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
};

type InputCellProps = {
  inputMode: "numeric" | "text";
  coordinates: CellCoordinates;
  handleKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) => void;
};

const ConfigInputCell = forwardRef<HTMLInputElement, InputCellProps>(
  ({ inputMode, coordinates, handleKeyDown }, ref) => {
    const {
      canInteractWithCell,
      getData,
      updateCellContent,
      updateCorrectAnswer,
      activeCell,
    } = useSpreadsheetStore();

    const cell = getData(coordinates);
    const { row, col } = coordinates;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (activeCell && cell.contentType === "not-editable") {
        updateCellContent(e.target.value);
      } else {
        updateCorrectAnswer(e.target.value);
      }
    };

    const placeholder = ["text", "number"].includes(cell.contentType)
      ? "Enter answer..."
      : undefined;

    const value =
      cell.contentType === "not-editable"
        ? cell.content
        : cell.correctAnswer || "";

    return (
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        inputMode={inputMode}
        value={value}
        onChange={handleInputChange}
        onKeyDown={(e) => handleKeyDown(e, row, col)}
        className={clsx(
          buildCommonClasses(cell, true),
          "placeholder:text-xs placeholder:text-gray-400 placeholder:italic",
          "focus:outline-none",
        )}
        style={buildCommonStyles(cell)}
        disabled={!canInteractWithCell(coordinates)}
      />
    );
  },
);

const PreviewInputCell = forwardRef<HTMLInputElement, InputCellProps>(
  ({ inputMode, coordinates, handleKeyDown }, ref) => {
    const {
      canInteractWithCell,
      getData,
      updateCellContent,
      showHints,
      showCorrectAnswers,
    } = useSpreadsheetStore();

    const cell = getData(coordinates);
    const { row, col } = coordinates;
    const showCorrectness =
      cell.contentType !== "not-editable" && (showHints || showCorrectAnswers);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (canInteractWithCell(coordinates)) {
        updateCellContent(e.target.value);
      }
    };

    const placeholder = canInteractWithCell(coordinates)
      ? inputMode === "numeric"
        ? "Enter a number..."
        : "Enter answer..."
      : undefined;

    const value = showCorrectAnswers
      ? cell.correctAnswer || cell.content
      : cell.content;

    return (
      <CorrectnessIndicatorWrapper
        showIndicator={showCorrectness}
        isCorrect={
          showCorrectAnswers ||
          (showHints && !!cell.content && cell.correctAnswer === cell.content)
        }
      >
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          inputMode={inputMode}
          value={value}
          onChange={handleInputChange}
          onKeyDown={(e) => handleKeyDown(e, row, col)}
          className={clsx(
            buildCommonClasses(cell, canInteractWithCell(coordinates)),
            "placeholder:text-xs placeholder:text-gray-400 placeholder:italic",
            "focus:outline-none",
          )}
          style={buildCommonStyles(cell)}
          disabled={!canInteractWithCell(coordinates)}
        />
      </CorrectnessIndicatorWrapper>
    );
  },
);

const InputCell = forwardRef<HTMLInputElement, InputCellProps>(
  ({ inputMode, coordinates, handleKeyDown }, ref) => {
    const { appMode } = useSpreadsheetStore();

    const InputCellComponent =
      appMode === "config" ? ConfigInputCell : PreviewInputCell;

    return (
      <InputCellComponent
        inputMode={inputMode}
        coordinates={coordinates}
        handleKeyDown={handleKeyDown}
        ref={ref}
      />
    );
  },
);

type SelectCellProps = {
  coordinates: CellCoordinates;
};

const PreviewSelectCell: FC<SelectCellProps> = ({ coordinates }) => {
  const {
    canInteractWithCell,
    getData,
    setActiveCell,
    updateCellContent,
    showHints,
    showCorrectAnswers,
  } = useSpreadsheetStore();

  const [open, setOpen] = useState(false);

  const cell = getData(coordinates);
  const { row, col } = coordinates;
  const showCorrectness = showCorrectAnswers || showHints;

  const handleValueChange = (value: string) => {
    if (!canInteractWithCell(coordinates)) return;

    setActiveCell(row, col);
    updateCellContent(value);
  };

  const handleOpenSelectDropdown = () => {
    if (!canInteractWithCell(coordinates)) return;

    setOpen(true);
  };

  const handleCellClick = () => {
    if (!canInteractWithCell(coordinates)) return;

    setActiveCell(row, col);
  };

  return (
    <div
      className={clsx(
        buildCommonClasses(cell, canInteractWithCell(coordinates)),
        "relative flex h-full items-center gap-2",
        !canInteractWithCell(coordinates) && "cursor-not-allowed",
      )}
      style={buildCommonStyles(cell)}
      onClick={handleCellClick}
    >
      <CorrectnessIndicatorWrapper
        showIndicator={showCorrectness}
        isCorrect={
          showCorrectAnswers ||
          (showHints && !!cell.content && cell.correctAnswer === cell.content)
        }
        className="flex-1"
      >
        <div
          className={clsx(
            "flex-1 truncate",
            !cell.content && !showCorrectAnswers && "text-xs text-gray-400",
          )}
        >
          {showCorrectAnswers
            ? cell.correctAnswer
            : cell.content || "Choose..."}
        </div>
      </CorrectnessIndicatorWrapper>
      <div
        className="ml-1 flex-shrink-0 rounded p-0.5 hover:bg-gray-100"
        onClick={handleOpenSelectDropdown}
      >
        {canInteractWithCell(coordinates) ? (
          <ChevronDown className="h-3 w-3 cursor-pointer" />
        ) : (
          <Lock className="h-3 w-3" />
        )}
      </div>
      {/* Hidden Select component that opens when dropdown icon is clicked */}
      <Select
        value={cell.content}
        onValueChange={handleValueChange}
        open={open}
        onOpenChange={(_open) => !_open && setOpen(false)}
        disabled={!canInteractWithCell(coordinates)}
      >
        <SelectTrigger className="sr-only">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {cell.selectOptions.map((option: string) => (
            <SelectItem
              key={option}
              value={option}
              style={{
                fontFamily: cell.fontFamily,
              }}
            >
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const ConfigSelectCell: FC<SelectCellProps> = ({ coordinates }) => {
  const {
    canInteractWithCell,
    setIsSelectOptionsDialogOpen,
    getData,
    setActiveCell,
    updateCellContent,
  } = useSpreadsheetStore();

  const [open, setOpen] = useState(false);

  const cell = getData(coordinates);
  const { row, col } = coordinates;

  const handleValueChange = (value: string) => {
    setActiveCell(row, col);
    updateCellContent(value);
  };

  const handleCellClick = () => {
    setActiveCell(row, col);
  };

  return (
    <div
      className={clsx(
        buildCommonClasses(cell, canInteractWithCell(coordinates)),
        "relative flex h-full items-center gap-2",
        !canInteractWithCell(coordinates) && "cursor-not-allowed",
      )}
      style={buildCommonStyles(cell)}
      onClick={handleCellClick}
    >
      <div className={clsx("flex-1 truncate")}>{cell.correctAnswer}</div>
      <div
        className="ml-1 flex-shrink-0 rounded p-0.5 hover:bg-gray-100"
        onClick={() => setIsSelectOptionsDialogOpen(true)}
      >
        <ChevronDown className="h-3 w-3 cursor-pointer" />
      </div>
      {/* Hidden Select component that opens when dropdown icon is clicked */}
      <Select
        value={cell.content}
        onValueChange={handleValueChange}
        open={open}
        onOpenChange={(_open) => !_open && setOpen(false)}
        disabled={!canInteractWithCell(coordinates)}
      >
        <SelectTrigger className="sr-only">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {cell.selectOptions.map((option: string) => (
            <SelectItem
              key={option}
              value={option}
              style={{
                fontFamily: cell.fontFamily,
              }}
            >
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const SelectCell: FC<SelectCellProps> = ({ coordinates }) => {
  const { appMode } = useSpreadsheetStore();

  const SelectCellComponent =
    appMode === "config" ? ConfigSelectCell : PreviewSelectCell;

  return <SelectCellComponent coordinates={coordinates} />;
};

ConfigInputCell.displayName = "ConfigInputCell";
InputCell.displayName = "InputCell";
export { InputCell, LinkCell, SelectCell };
