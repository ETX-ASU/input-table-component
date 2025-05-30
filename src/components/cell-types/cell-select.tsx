import clsx from "clsx";
import { isBoolean } from "lodash";
import { Lock } from "lucide-react";
import { forwardRef, Ref, useRef } from "react";
import useSpreadsheetStore, { CellCoordinates } from "../../lib/store";
import { Icon } from "../Icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  buildCommonClasses,
  buildCommonStyles,
  CorrectnessIndicatorWrapper,
} from "./utils";

type SelectCellProps = {
  coordinates: CellCoordinates;
  handleKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) => void;
  onSelectClick: (isOpen: boolean) => void;
  isOpen: boolean;
};

const PreviewSelectCell = forwardRef<HTMLDivElement, SelectCellProps>(
  ({ coordinates, handleKeyDown, onSelectClick, isOpen }, ref) => {
    const {
      canInteractWithCell,
      getData,
      setActiveCell,
      updateCellContent,
      unsetCorrectnessFromCell,
      showHints,
      showCorrectAnswers,
    } = useSpreadsheetStore();

    // const [open, setOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const cell = getData(coordinates);
    const { row, col } = coordinates;
    const showCorrectness =
      showCorrectAnswers || (showHints && isBoolean(cell.isCorrect));

    const handleValueChange = (value: string) => {
      if (!canInteractWithCell(coordinates)) return;

      unsetCorrectnessFromCell(coordinates);
      setActiveCell(row, col);
      updateCellContent(value);
    };

    const handleCellClick = () => {
      if (!canInteractWithCell(coordinates)) return;
      setActiveCell(row, col);
      onSelectClick(true);
    };

    return (
      <div
        className={clsx(
          buildCommonClasses(cell, canInteractWithCell(coordinates)),
          "relative flex h-full items-center gap-2 border border-light-gray-80 p-1",
          !canInteractWithCell(coordinates)
            ? "cursor-not-allowed"
            : "cursor-pointer",
          !showCorrectness && "px-2",
        )}
        style={buildCommonStyles(cell)}
        onClick={handleCellClick}
        onKeyDown={(e) =>
          handleKeyDown(e as React.KeyboardEvent<HTMLInputElement>, row, col)
        }
      >
        <CorrectnessIndicatorWrapper
          showIndicator={showCorrectness}
          isCorrect={
            showCorrectAnswers ||
            (showHints && !!cell.content && cell.isCorrect!)
          }
          className="flex-1"
        >
          <div
            className={clsx(
              "flex-1 truncate leading-none",
              !cell.content && !showCorrectAnswers && "text-xs text-gray-400",
            )}
          >
            {showCorrectAnswers
              ? cell.correctAnswer
              : cell.content || "Choose a correct answer"}
          </div>
        </CorrectnessIndicatorWrapper>
        <div className="ml-1 flex-shrink-0 rounded p-0.5 hover:bg-light-gray-20">
          {canInteractWithCell(coordinates) ? (
            <Icon name="chevron-down" className="h-3 w-3 cursor-pointer" />
          ) : (
            <Lock className="h-3 w-3" />
          )}
        </div>
        {/* Hidden Select component that opens when dropdown icon is clicked */}
        <Select
          value={cell.content}
          onValueChange={handleValueChange}
          open={isOpen}
          onOpenChange={(_open) => onSelectClick(_open)}
          disabled={!canInteractWithCell(coordinates)}
        >
          <SelectTrigger
            ref={ref as Ref<HTMLButtonElement>}
            className="sr-only focus:outline-none"
            onKeyDown={(e) => {
              e.preventDefault();

              if (e.key === " ") {
                onSelectClick(true);
                contentRef.current?.focus();
              }
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent ref={contentRef}>
            {cell.selectOptions.map((option: string) => (
              <SelectItem
                key={option}
                value={option}
                style={{
                  fontFamily: cell.fontFamily,
                }}
                className="focus:bg-light-gray-20"
              >
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  },
);

const ConfigSelectCell = forwardRef<HTMLDivElement, SelectCellProps>(
  ({ coordinates, onSelectClick, isOpen }, ref) => {
    const {
      canInteractWithCell,
      setIsSelectOptionsDialogOpen,
      getData,
      setActiveCell,
      updateCellContent,
    } = useSpreadsheetStore();

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
        ref={ref}
        className={clsx(
          buildCommonClasses(cell, canInteractWithCell(coordinates)),
          "relative flex h-full items-center gap-2 border border-light-gray-40 px-1",
          !canInteractWithCell(coordinates) && "cursor-not-allowed",
        )}
        style={buildCommonStyles(cell)}
        onClick={handleCellClick}
      >
        <div className={clsx("flex-1 truncate")}>{cell.correctAnswer}</div>
        <div
          className="ml-1 flex-shrink-0 rounded p-0.5 hover:bg-light-gray-20"
          onClick={() => setIsSelectOptionsDialogOpen(true)}
        >
          <Icon name="chevron-down" className="h-3 w-3 cursor-pointer" />
        </div>
        {/* Hidden Select component that opens when dropdown icon is clicked */}
        <Select
          value={cell.content}
          onValueChange={handleValueChange}
          open={isOpen}
          onOpenChange={(_open) => onSelectClick(_open)}
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
  },
);

export { ConfigSelectCell, PreviewSelectCell };
export type { SelectCellProps };
