import clsx from "clsx";
import { FC, PropsWithChildren, useState } from "react";
import { Tooltip as InitTooltip } from "react-tooltip";
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
import { Tooltip } from "./ui/tooltip";
import { UndoRedo } from "./undo-redo";

const VerticalSeparator = () => (
  <div className="mx-px h-10 w-px min-w-px bg-black/20" />
);

const AddColumnButton = () => {
  const { addColumn, appMode } = useSpreadsheetStore();
  const actionsDisabled = appMode === "preview";
  return (
    <Button
      disabled={actionsDisabled}
      variant="outline"
      size="icon"
      onClick={addColumn}
      tooltip="Add Column"
      id="add-column"
    >
      <Icon name="add-col" className="h-4 w-4" />
    </Button>
  );
};

const AddRowButton = () => {
  const { addRow, appMode } = useSpreadsheetStore();
  const actionsDisabled = appMode === "preview";
  return (
    <Button
      disabled={actionsDisabled}
      variant="outline"
      size="icon"
      onClick={addRow}
      tooltip="Add Row"
      id="add-row"
    >
      <Icon name="add-row" className="h-4 w-4" />
    </Button>
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
    <Tooltip text="Cell Type Selector">
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
    </Tooltip>
  );
};

const FontFamilySelectorButton = ({ isHidden }: { isHidden?: boolean }) => {
  const { activeCell, appMode, setFontFamily, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();

  return (
    <Tooltip text="Font Family Selector">
      <FontFamilySelector
        value={cell.fontFamily}
        onChange={setFontFamily}
        disabled={actionsDisabled}
        invisible={isHidden}
      />
    </Tooltip>
  );
};

const FontSizeSelectorButton = ({ isHidden }: { isHidden?: boolean }) => {
  const { activeCell, appMode, setFontSize, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();

  return (
    <Tooltip text="Font Size Selector">
      <FontSizeSelector
        value={cell.fontSize}
        onChange={setFontSize}
        disabled={actionsDisabled}
        invisible={isHidden}
      />
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
      ? "Toggle Bold"
      : format === "isItalic"
        ? "Toggle Italic"
        : "Toggle Strikethrough";

  return (
    <Tooltip text={tooltipText}>
      <Toggle
        size="icon"
        aria-label={tooltipText}
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
          className="h-4 w-4"
        />
      </Toggle>
    </Tooltip>
  );
};

const TextColorPickerButton = () => {
  const { activeCell, appMode, setTextColor, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip text="Text Color Picker">
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
            className="h-4 w-4"
          />
        }
      />
    </Tooltip>
  );
};

const AlignToggleButton = ({ align }: { align: TextAlign }) => {
  const { activeCell, appMode, setAlignment, getData } = useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip text={`Align ${align}`}>
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
    </Tooltip>
  );
};

const CellBackgroundPickerButton = () => {
  const { activeCell, appMode, setBackgroundColor, getData } =
    useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip text="Background Color Picker">
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
            className="h-4 w-4"
          />
        }
      />
    </Tooltip>
  );
};

const CellBorderColorButton = () => {
  const { activeCell, appMode, setBorderColor, getData } =
    useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip text="Border Color">
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
            className="h-4 w-4"
          />
        }
      />
    </Tooltip>
  );
};

const CellBorderWidthButton = () => {
  const { activeCell, appMode, setBorderWidth, getData } =
    useSpreadsheetStore();
  const actionsDisabled = !activeCell || appMode === "preview";
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  return (
    <Tooltip text="Border Width">
      <BorderWidthSelector
        value={cell.borderWidth}
        onChange={setBorderWidth}
        disabled={actionsDisabled}
      />
    </Tooltip>
  );
};

const LinkButtonButton = () => {
  const { activeCell, appMode, setLink, getData } = useSpreadsheetStore();
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();
  const actionsDisabled =
    !activeCell || appMode === "preview" || cell.contentType !== "not-editable";

  return (
    <Tooltip text="Link">
      <LinkButton
        link={cell.link}
        disabled={actionsDisabled}
        onSave={setLink}
      />
    </Tooltip>
  );
};

export function SpreadsheetToolbar() {
  const { toolbarRef, hiddenItems } = useResponsiveToolbar();
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const Hidable: FC<PropsWithChildren<{ id: string; className?: string }>> = ({
    children,
    id,
    className,
  }) => {
    return (
      <div
        id={id}
        className={clsx(hiddenItems.has(id) && "invisible", className)}
      >
        {children}
      </div>
    );
  };

  return (
    <div id="spreadsheet-toolbar" className="w-full bg-light-gray-20">
      <InitTooltip
        id="app-tooltip"
        delayShow={1000}
        place="top"
        className="z-50 opacity-100"
      />
      <div className="mb-2 flex items-center justify-between">
        <ModeToggle />
        <ResetTableButton />
      </div>
      <div className="flex gap-1 py-1">
        <div
          ref={toolbarRef}
          className="flex items-center gap-1 overflow-x-hidden"
        >
          <UndoRedo invisible={hiddenItems.has("undo-redo")} />

          <Hidable id="add-column-row" className="flex shrink-0 gap-1">
            <VerticalSeparator />
            <AddColumnButton />
            <AddRowButton />
          </Hidable>

          <Hidable id="cell-type-selector" className="flex shrink-0 gap-1">
            <VerticalSeparator />
            <CellTypeSelectorButton />
          </Hidable>

          <Hidable id="font-size-selector" className="flex shrink-0 gap-1">
            <VerticalSeparator />
            <FontSizeSelectorButton />
          </Hidable>

          <Hidable id="font-family-selector" className="flex shrink-0 gap-1">
            <FontFamilySelectorButton />
          </Hidable>

          <Hidable id="text-format" className="flex shrink-0 gap-1">
            <TextFormatButton format="isBold" />
            <TextFormatButton format="isItalic" />
            <TextFormatButton format="isStrikethrough" />
          </Hidable>

          <Hidable id="text-color" className="flex shrink-0 gap-1">
            <TextColorPickerButton />
          </Hidable>

          <Hidable id="link-button" className="flex shrink-0 gap-1">
            <LinkButtonButton />
          </Hidable>

          <Hidable id="toggle-align" className="flex shrink-0 gap-1">
            <AlignToggleButton align="left" />
            <AlignToggleButton align="center" />
            <AlignToggleButton align="right" />
          </Hidable>

          <Hidable id="cell-styles" className="flex shrink-0 gap-1">
            <VerticalSeparator />
            <CellBackgroundPickerButton />
            <CellBorderColorButton />
            <CellBorderWidthButton />
          </Hidable>
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
              <div key={item} className="flex shrink-0 gap-1">
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
              </div>
            ))}
          </div>
          <div className="w-10" />
        </div>
      )}
    </div>
  );
}
