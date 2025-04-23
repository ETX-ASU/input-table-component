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
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Toggle } from "./ui/toggle";
import { UndoRedo } from "./undo-redo";

export function SpreadsheetToolbar() {
  const {
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
  } = useSpreadsheetStore();

  // Get formatting state for the active cell
  const cell = activeCell ? getData(activeCell) : buildDefaultCell();

  return (
    <div className="relative z-40 mb-4 flex flex-wrap items-center gap-2">
      <UndoRedo />

      <Separator orientation="vertical" className="h-8" />

      <CellTypeSelector
        value={cell.contentType}
        onChange={setContentType}
        selectOptions={cell.selectOptions}
        onSelectOptionsChange={setSelectOptions}
        disabled={!activeCell}
      />

      <Separator orientation="vertical" className="h-8" />

      <FontSelector
        value={cell.fontFamily}
        onChange={setFontFamily}
        disabled={!activeCell}
      />

      <Separator orientation="vertical" className="h-8" />

      <div className="flex items-center gap-1 rounded-md border p-1">
        <Toggle
          aria-label="Toggle bold"
          pressed={cell.isBold}
          onPressedChange={() => toggleFormat("isBold")}
          disabled={!activeCell}
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          aria-label="Toggle italic"
          pressed={cell.isItalic}
          onPressedChange={() => toggleFormat("isItalic")}
          disabled={!activeCell}
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          aria-label="Toggle strikethrough"
          pressed={cell.isStrikethrough}
          onPressedChange={() => toggleFormat("isStrikethrough")}
          disabled={!activeCell}
        >
          <Type className="h-4 w-4" />
        </Toggle>

        <LinkButton link={cell.link} disabled={!activeCell} onSave={setLink} />

        <ColorPicker
          value={cell.textColor}
          onChange={setTextColor}
          disabled={!activeCell}
          defaultColor={DEFAULT_FONT_COLOR}
          label="Text Color"
        />
      </div>

      <Separator orientation="vertical" className="h-8" />

      <div className="flex items-center gap-1 rounded-md border p-1">
        <Toggle
          aria-label="Align left"
          pressed={cell.textAlign === "left"}
          onPressedChange={() => setAlignment("left")}
          disabled={!activeCell}
        >
          <AlignLeft className="h-4 w-4" />
        </Toggle>
        <Toggle
          aria-label="Align center"
          pressed={cell.textAlign === "center"}
          onPressedChange={() => setAlignment("center")}
          disabled={!activeCell}
        >
          <AlignCenter className="h-4 w-4" />
        </Toggle>
        <Toggle
          aria-label="Align right"
          pressed={cell.textAlign === "right"}
          onPressedChange={() => setAlignment("right")}
          disabled={!activeCell}
        >
          <AlignRight className="h-4 w-4" />
        </Toggle>
      </div>

      <Separator orientation="vertical" className="h-8" />

      <div className="flex items-center gap-1 rounded-md border p-1">
        <BorderWidthSelector
          value={cell.borderWidth}
          onChange={setBorderWidth}
          disabled={!activeCell}
        />
        <div className="relative">
          <ColorPicker
            value={cell.borderColor}
            onChange={setBorderColor}
            disabled={!activeCell}
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
            disabled={!activeCell}
            defaultColor={DEFAULT_BACKGROUND_COLOR}
            label="Background Color"
          />
          <div className="absolute -top-1 -right-1">
            <Paintbrush className="h-3 w-3 text-gray-500" />
          </div>
        </div>
      </div>

      <Separator orientation="vertical" className="h-8" />

      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" /> Row
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={addColumn}>
          <Plus className="mr-1 h-4 w-4" /> Column
        </Button>
      </div>
    </div>
  );
}
