import clsx from "clsx";
import { useState } from "react";
import { useResponsiveToolbar } from "../hooks/use-responsive-toolbar";
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BORDER_COLOR,
  DEFAULT_FONT_COLOR,
} from "../lib/constants";
import useSpreadsheetStore, { TextAlign } from "../lib/store";
import { buildDefaultCell } from "../lib/utils";
import { BorderWidthSelector } from "./border-width-selector";
import { CellTypeSelector } from "./cell-type-selector";
import { ColorPicker } from "./color-picker";
import { FontFamilySelector } from "./font-family-selector";
import { FontSizeSelector } from "./font-size-selector";
import { Icon } from "./Icon";
import { LinkButton } from "./link-button";
import { ModeToggle } from "./mode-toggle";
import { ResetTableButton } from "./reset-table-button";
import { Button } from "./ui/button";
import { Toggle } from "./ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { UndoRedo } from "./undo-redo";

const VerticalSeparator = () => (
  <div className="mx-[10px] h-10 w-px min-w-px bg-black/20" />
);

const AddColumnButton = () => {
  const { addColumn, appMode } = useSpreadsheetStore();
  const actionsDisabled = appMode === "preview";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          disabled={actionsDisabled}
          variant="outline"
          size="icon"
          onClick={addColumn}
          title="Add Column"
          id="add-column"
        >
          <Icon name="add-col" className="h-10 w-10" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Add Column</TooltipContent>
    </Tooltip>
  );
};

const AddRowButton = () => {
  const { addRow, appMode } = useSpreadsheetStore();
  const actionsDisabled = appMode === "preview";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          disabled={actionsDisabled}
          variant="outline"
          size="icon"
          onClick={addRow}
          title="Add Row"
          id="add-row"
        >
          <Icon name="add-row" className="h-10 w-10" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Add Row</TooltipContent>
    </Tooltip>
  );
};

const CellTypeSelectorButton = ({ isHidden }: { isHidden?: boolean }) => {
  const {
    activeCell,
    appMode,
    setContentType,
    setSelectOptions,
    updateCorrectAnswer,
    getData,
  } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <CellTypeSelector
            value={cell.contentType}
            onChange={setContentType}
            selectOptions={cell.selectOptions}
            onSelectOptionsChange={setSelectOptions}
            correctAnswer={cell.correctAnswer}
            onCorrectAnswerChange={updateCorrectAnswer}
            disabled={actionsDisabled}
            invisible={isHidden}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>Select Cell Type</TooltipContent>
    </Tooltip>
  );
};

const FontFamilySelectorButton = ({ isHidden }: { isHidden?: boolean }) => {
  const { activeCell, appMode, setFontFamily, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <FontFamilySelector
            value={cell.fontFamily}
            onChange={setFontFamily}
            disabled={actionsDisabled}
            invisible={isHidden}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>Select Font Family</TooltipContent>
    </Tooltip>
  );
};

const FontSizeSelectorButton = ({ isHidden }: { isHidden?: boolean }) => {
  const { activeCell, appMode, setFontSize, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <FontSizeSelector
            value={cell.fontSize}
            onChange={setFontSize}
            disabled={actionsDisabled}
            invisible={isHidden}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>Select Font Size</TooltipContent>
    </Tooltip>
  );
};

const TextFormatButton = ({
  format,
}: {
  format: "isBold" | "isItalic" | "isStrikethrough";
}) => {
  const { activeCell, appMode, toggleFormat, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  const tooltipText =
    format === "isBold"
      ? "Bold"
      : format === "isItalic"
        ? "Italic"
        : "Strikethrough";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="icon"
          aria-label={`Toggle ${format}`}
          pressed={cell[format]}
          onPressedChange={() => toggleFormat(format)}
          disabled={actionsDisabled}
          id={`toggle-${format}`}
        >
          <Icon
            name={
              format === "isBold"
                ? "bold"
                : format === "isItalic"
                  ? "italic"
                  : "strike-through"
            }
          />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>Toggle {tooltipText}</TooltipContent>
    </Tooltip>
  );
};

const TextColorPickerButton = ({ isHidden }: { isHidden?: boolean }) => {
  const { activeCell, appMode, setTextColor, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <ColorPicker
            id="text-color"
            value={cell.textColor}
            onChange={setTextColor}
            disabled={actionsDisabled}
            defaultColor={DEFAULT_FONT_COLOR}
            label="Text Color"
            icon={
              <Icon
                name="font-color"
                color={cell.textColor || DEFAULT_FONT_COLOR}
                className="h-10 w-10"
              />
            }
            invisible={isHidden}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>Select Text Color</TooltipContent>
    </Tooltip>
  );
};

const AlignToggleButton = ({ align }: { align: TextAlign }) => {
  const { activeCell, appMode, setAlignment, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="icon"
          aria-label={`Align ${align}`}
          pressed={cell.textAlign === align}
          onPressedChange={() => setAlignment(align)}
          disabled={actionsDisabled}
          id={`toggle-align-${align}`}
        >
          <Icon name={`align-${align}`} className="h-4 w-4" />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>Align {align}</TooltipContent>
    </Tooltip>
  );
};

const CellBackgroundPickerButton = () => {
  const { activeCell, appMode, setBackgroundColor, getData } =
    useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <ColorPicker
            id="text-color"
            value={cell.backgroundColor}
            onChange={setBackgroundColor}
            disabled={actionsDisabled}
            defaultColor={DEFAULT_BACKGROUND_COLOR}
            label="Background Color"
            icon={
              <Icon
                name="cell-background-color"
                color={cell.backgroundColor || DEFAULT_BACKGROUND_COLOR}
                className="h-5 w-5"
              />
            }
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>Select Background Color</TooltipContent>
    </Tooltip>
  );
};

const CellBorderColorButton = () => {
  const { activeCell, appMode, setBorderColor, getData } =
    useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <ColorPicker
            id="border-color"
            value={cell.borderColor}
            onChange={setBorderColor}
            disabled={actionsDisabled}
            defaultColor={DEFAULT_BORDER_COLOR}
            label="Border Color"
            icon={
              <Icon
                name="cell-border-color"
                color={cell.borderColor || DEFAULT_BORDER_COLOR}
                className="h-5 w-5"
              />
            }
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>Select Border Color</TooltipContent>
    </Tooltip>
  );
};

const CellBorderWidthButton = () => {
  const { activeCell, appMode, setBorderWidth, getData } =
    useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <BorderWidthSelector
            value={cell.borderWidth}
            onChange={setBorderWidth}
            disabled={actionsDisabled}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>Select Border Width</TooltipContent>
    </Tooltip>
  );
};

const LinkButtonButton = ({ isHidden }: { isHidden?: boolean }) => {
  const { activeCell, appMode, setLink, getData } = useSpreadsheetStore();
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  const actionsDisabled =
    !activeCell || appMode === "preview" || cell.contentType !== "not-editable";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <LinkButton
            link={cell.link}
            disabled={actionsDisabled}
            onSave={setLink}
            invisible={!!isHidden}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>Select Link</TooltipContent>
    </Tooltip>
  );
};

export function SpreadsheetToolbar() {
  const { toolbarRef, hiddenItems } = useResponsiveToolbar();
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  return (
    <TooltipProvider delayDuration={750}>
      <div id="spreadsheet-toolbar" className="w-full bg-light-gray-20">
        <div className="mb-2 flex items-center justify-between">
          <ModeToggle />
          <ResetTableButton />
        </div>
        <div className="flex gap-1 py-1">
          <div ref={toolbarRef} className="flex items-center overflow-x-hidden">
            <UndoRedo invisible={hiddenItems.has("undo-redo")} />

            <VerticalSeparator />

            <div
              id="add-column-row"
              className={clsx(
                hiddenItems.has("add-column-row") && "invisible",
                "flex shrink-0 gap-1",
              )}
            >
              <AddColumnButton />
              <AddRowButton />
            </div>

            <VerticalSeparator />

            <CellTypeSelectorButton
              isHidden={hiddenItems.has("cell-type-selector")}
            />

            <VerticalSeparator />

            <FontSizeSelectorButton
              isHidden={hiddenItems.has("font-size-selector")}
            />

            <FontFamilySelectorButton
              isHidden={hiddenItems.has("font-family-selector")}
            />

            <div
              id="text-format"
              className={clsx(
                hiddenItems.has("text-format") && "invisible",
                "flex shrink-0 gap-1",
              )}
            >
              <TextFormatButton format="isBold" />
              <TextFormatButton format="isItalic" />
              <TextFormatButton format="isStrikethrough" />
            </div>

            <TextColorPickerButton isHidden={hiddenItems.has("text-color")} />

            <LinkButtonButton isHidden={hiddenItems.has("link-button")} />

            <div
              id="toggle-align"
              className={clsx(
                hiddenItems.has("toggle-align") && "invisible",
                "flex shrink-0 gap-1",
              )}
            >
              <AlignToggleButton align="left" />
              <AlignToggleButton align="center" />
              <AlignToggleButton align="right" />
            </div>

            <div
              id="cell-styles"
              className={clsx(
                hiddenItems.has("cell-styles") && "invisible",
                "flex shrink-0 gap-1",
              )}
            >
              <VerticalSeparator />
              <CellBackgroundPickerButton />
              <CellBorderColorButton />
              <CellBorderWidthButton />
            </div>
          </div>
          <div className="flex flex-1 items-center">
            {hiddenItems.size > 0 && (
              <Button
                variant="outline"
                size="icon"
                title="More Options"
                onClick={() => setShowMoreOptions(!showMoreOptions)}
              >
                <Icon name="more-options" className="h-10 w-10" />
              </Button>
            )}
          </div>
        </div>
        {showMoreOptions && (
          <div className="flex justify-end">
            <div className="flex flex-wrap justify-end gap-1">
              {Array.from(hiddenItems).map((item, index) => (
                <>
                  {index > 0 && <VerticalSeparator />}
                  {item === "add-column-row" && (
                    <>
                      <AddColumnButton />
                      <AddRowButton />
                    </>
                  )}
                  {item === "cell-type-selector" && <CellTypeSelectorButton />}
                  {item === "font-size-selector" && <FontSizeSelectorButton />}
                  {item === "font-family-selector" && (
                    <FontFamilySelectorButton />
                  )}
                  {item === "text-format" && (
                    <div className="flex shrink-0 gap-1">
                      <TextFormatButton format="isBold" />
                      <TextFormatButton format="isItalic" />
                      <TextFormatButton format="isStrikethrough" />
                    </div>
                  )}
                  {item === "text-color" && <TextColorPickerButton />}
                  {item === "link-button" && <LinkButtonButton />}
                  {item === "toggle-align" && (
                    <div className="flex shrink-0 gap-1">
                      <AlignToggleButton align="left" />
                      <AlignToggleButton align="center" />
                      <AlignToggleButton align="right" />
                    </div>
                  )}
                  {item === "cell-styles" && (
                    <div className="flex shrink-0 gap-1">
                      <CellBackgroundPickerButton />
                      <CellBorderColorButton />
                      <CellBorderWidthButton />
                    </div>
                  )}
                </>
              ))}
            </div>
            <div className="w-10" />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
