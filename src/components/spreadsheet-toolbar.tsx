import clsx from "clsx";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Paintbrush,
  Plus,
  Square,
  Type,
} from "lucide-react";
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BORDER_COLOR,
  DEFAULT_FONT_COLOR,
} from "../lib/constants";
import useSpreadsheetStore from "../lib/store";
import { buildDefaultCell } from "../lib/utils";
import { BorderWidthSelector } from "./border-width-selector";
import { CellTypeSelector } from "./cell-type-selector";
import { ColorPicker } from "./color-picker";
import { FontSelector } from "./font-selector";
import { LinkButton } from "./link-button";
import { ModeToggle } from "./mode-toggle";
import { ResetTableButton } from "./reset-table-button";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Toggle } from "./ui/toggle";
import { UndoRedo } from "./undo-redo";

export function SpreadsheetToolbar() {
  const {
    appMode,
    activeCell,
    toggleFormat,
    setAlignment,
    setTextColor,
    setBorderWidth,
    setBorderColor,
    setBackgroundColor,
    setFontFamily,
    setContentType,
    setSelectOptions,
    setLink,
    addRow,
    addColumn,
    getData,
    updateCorrectAnswer,
  } = useSpreadsheetStore();

  // Get formatting state for the active cell
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();

  const isPreviewMode = appMode === "preview";
  const actionsDisabled = !activeCell || isPreviewMode;

  return (
    <div id="spreadsheet-toolbar">
      <div id="mode-toggle">
        <ModeToggle />
      </div>
      <div
        className={clsx(
          "relative z-40 mb-4 flex flex-wrap items-center gap-2",
          isPreviewMode && "hidden",
        )}
      >
        <Separator orientation="vertical" className="h-8" />

        <UndoRedo />

        <Separator orientation="vertical" className="h-8" />

        <CellTypeSelector
          value={cell.contentType}
          onChange={setContentType}
          selectOptions={cell.selectOptions}
          onSelectOptionsChange={setSelectOptions}
          correctAnswer={cell.correctAnswer}
          onCorrectAnswerChange={updateCorrectAnswer}
          disabled={actionsDisabled}
        />

        <Separator orientation="vertical" className="h-8" />

        <FontSelector
          value={cell.fontFamily}
          onChange={setFontFamily}
          disabled={actionsDisabled}
        />

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-1 rounded-md border p-1">
          <Toggle
            aria-label="Toggle bold"
            pressed={cell.isBold}
            onPressedChange={() => toggleFormat("isBold")}
            disabled={actionsDisabled}
            id="toggle-bold"
          >
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle
            aria-label="Toggle italic"
            pressed={cell.isItalic}
            onPressedChange={() => toggleFormat("isItalic")}
            disabled={actionsDisabled}
            id="toggle-italic"
          >
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle
            aria-label="Toggle strikethrough"
            pressed={cell.isStrikethrough}
            onPressedChange={() => toggleFormat("isStrikethrough")}
            disabled={actionsDisabled}
            id="toggle-strikethrough"
          >
            <Type className="h-4 w-4" />
          </Toggle>

          <LinkButton
            link={cell.link}
            disabled={actionsDisabled}
            onSave={setLink}
          />

          <ColorPicker
            value={cell.textColor}
            onChange={setTextColor}
            disabled={actionsDisabled}
            defaultColor={DEFAULT_FONT_COLOR}
            label="Text Color"
          />
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className={clsx("flex items-center gap-1 rounded-md border p-1")}>
          <Toggle
            aria-label="Align left"
            pressed={cell.textAlign === "left"}
            onPressedChange={() => setAlignment("left")}
            disabled={actionsDisabled}
            id="toggle-align-left"
          >
            <AlignLeft className="h-4 w-4" />
          </Toggle>
          <Toggle
            aria-label="Align center"
            pressed={cell.textAlign === "center"}
            onPressedChange={() => setAlignment("center")}
            disabled={actionsDisabled}
            id="toggle-align-center"
          >
            <AlignCenter className="h-4 w-4" />
          </Toggle>
          <Toggle
            aria-label="Align right"
            pressed={cell.textAlign === "right"}
            onPressedChange={() => setAlignment("right")}
            disabled={actionsDisabled}
            id="toggle-align-right"
          >
            <AlignRight className="h-4 w-4" />
          </Toggle>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className={clsx("flex items-center gap-1 rounded-md border p-1")}>
          <BorderWidthSelector
            value={cell.borderWidth}
            onChange={setBorderWidth}
            disabled={actionsDisabled}
          />
          <div className="relative">
            <ColorPicker
              value={cell.borderColor}
              onChange={setBorderColor}
              disabled={actionsDisabled}
              defaultColor={DEFAULT_BORDER_COLOR}
              label="Border Color"
            />
            <div className="absolute -top-1 -right-1">
              <Square className="h-3 w-3 text-gray-500" />
            </div>
          </div>
          <div className="relative">
            <ColorPicker
              value={cell.backgroundColor}
              onChange={setBackgroundColor}
              disabled={actionsDisabled}
              defaultColor={DEFAULT_BACKGROUND_COLOR}
              label="Background Color"
            />
            <div className="absolute -top-1 -right-1">
              <Paintbrush className="h-3 w-3 text-gray-500" />
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div id="add-row" className={clsx("flex items-center gap-1")}>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1 h-4 w-4" /> Row
          </Button>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div id="add-column" className={clsx("flex items-center gap-1")}>
          <Button variant="outline" size="sm" onClick={addColumn}>
            <Plus className="mr-1 h-4 w-4" /> Column
          </Button>
        </div>

        {/* Add this after the last Separator */}
        <Separator orientation="vertical" className="h-8" />

        <ResetTableButton />
      </div>
    </div>
  );
}
