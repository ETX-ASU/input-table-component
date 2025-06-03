import clsx from "clsx";
import { isBoolean } from "lodash";
import { forwardRef } from "react";
import useSpreadsheetStore, { CellCoordinates } from "../../lib/store";
import { replaceWithHtmlTags } from "../../lib/utils";
import {
  buildCommonClasses,
  buildCommonStyles,
  CorrectnessIndicatorWrapper,
} from "./utils";

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
      ? "Enter answer"
      : undefined;

    const value =
      cell.contentType === "not-editable"
        ? cell.content
        : cell.correctAnswer || "";

    return (
      <input
        ref={ref}
        type={inputMode === "numeric" ? "number" : "text"}
        placeholder={placeholder}
        inputMode={inputMode}
        step="any"
        value={value}
        onChange={handleInputChange}
        onKeyDown={(e) => handleKeyDown(e, row, col)}
        className={clsx(
          buildCommonClasses(cell, true),
          "truncate placeholder:text-xs placeholder:text-gray-400 placeholder:italic",
          "focus:outline-none",
          cell.contentType !== "not-editable" &&
            "border border-light-gray-80 p-1",
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
      unsetCorrectnessFromCell,
      setActiveCell,
    } = useSpreadsheetStore();

    const cell = getData(coordinates);
    const { row, col } = coordinates;
    const showCorrectness =
      cell.contentType !== "not-editable" &&
      ((showHints && isBoolean(cell.isCorrect)) || showCorrectAnswers);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setActiveCell(row, col);
      if (canInteractWithCell(coordinates)) {
        unsetCorrectnessFromCell(coordinates);
        updateCellContent(e.target.value);
      }
    };

    const placeholder = canInteractWithCell(coordinates)
      ? inputMode === "numeric"
        ? "Enter number"
        : "Enter text"
      : undefined;

    const value = showCorrectAnswers
      ? cell.correctAnswer || cell.content
      : cell.content;

    return (
      <CorrectnessIndicatorWrapper
        showIndicator={showCorrectness}
        isCorrect={
          showCorrectAnswers || (showHints && !!cell.content && cell.isCorrect!)
        }
        className={clsx(
          cell.contentType !== "not-editable" &&
            "border border-light-gray-80 p-1",
          !showCorrectness && "px-2",
        )}
      >
        {cell.contentType === "not-editable" ? (
          <div className="relative w-full">
            <input
              onKeyDown={(e) => handleKeyDown(e, row, col)}
              ref={ref}
              className={clsx(
                "absolute caret-transparent",
                buildCommonClasses(cell, canInteractWithCell(coordinates)),
              )}
              value=""
              aria-label={`Cell content: ${cell.content}`}
              aria-readonly="true"
            />
            <div
              dangerouslySetInnerHTML={{
                __html: replaceWithHtmlTags(cell.content),
              }}
              className={clsx(
                "flex-1 truncate",
                buildCommonClasses(cell, canInteractWithCell(coordinates)),
              )}
              style={buildCommonStyles(cell)}
              aria-hidden="true"
            />
          </div>
        ) : (
          <input
            ref={ref}
            type={inputMode === "numeric" ? "number" : "text"}
            placeholder={placeholder}
            inputMode={inputMode}
            step="any"
            value={value}
            onChange={handleInputChange}
            onKeyDown={(e) => handleKeyDown(e, row, col)}
            className={clsx(
              buildCommonClasses(cell, canInteractWithCell(coordinates)),
              "placeholder:text-xs placeholder:text-gray-400 placeholder:italic",
              "focus:outline-none",
            )}
            aria-label={`Cell content: ${value}`}
            style={buildCommonStyles(cell)}
          />
        )}
      </CorrectnessIndicatorWrapper>
    );
  },
);

export { ConfigInputCell, PreviewInputCell };
export type { InputCellProps };
