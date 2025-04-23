import clsx from "clsx";
import { ChevronDown, ExternalLink } from "lucide-react";
import { FC, RefObject } from "react";
import { DEFAULT_ROW_HEIGHT } from "../lib/constants";
import { CellCoordinates, CellData, TextAlign } from "../lib/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const buildCellKey = ({ col, row }: CellCoordinates) => `${row}-${col}`;

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

const buildCommonClasses = (cell: CellData) =>
  clsx(
    "h-full w-full bg-transparent px-2 py-1 focus:outline-none",
    buildAlignmentClass(cell.textAlign),
    cell.isBold && "font-bold",
    cell.isItalic && "italic",
    cell.isStrikethrough && "line-through",
  );

type LinkCellProps = {
  cell: CellData;
};

const LinkCell: FC<LinkCellProps> = ({ cell }) => (
  <div
    className={clsx(
      buildCommonClasses(cell),
      "flex items-center gap-1 overflow-hidden text-blue-600 underline",
    )}
    style={{ ...buildCommonStyles(cell), height: DEFAULT_ROW_HEIGHT - 1 }}
  >
    <span className="truncate">{cell.content}</span>
    <a href={cell.link!} target="_blank" rel="noopener noreferrer">
      <ExternalLink className="h-3 w-3" />
    </a>
  </div>
);

type InputCellProps = {
  inputMode: "numeric" | "text";
  cell: CellData;
  coordinates: CellCoordinates;
  cellRefs: RefObject<Record<string, HTMLInputElement | null>>;
  handleCellChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) => void;
};

const InputCell: FC<InputCellProps> = ({
  inputMode,
  cell,
  coordinates,
  cellRefs,
  handleCellChange,
  handleKeyDown,
}) => {
  const { row, col } = coordinates;
  const key = buildCellKey(coordinates);

  return (
    <input
      ref={(el) => {
        cellRefs.current[key] = el;
      }}
      type="text"
      inputMode={inputMode}
      value={cell.content}
      onChange={handleCellChange}
      onKeyDown={(e) => handleKeyDown(e, row, col)}
      className={buildCommonClasses(cell)}
      style={buildCommonStyles(cell)}
    />
  );
};

type SelectCellProps = {
  cell: CellData;
  coordinates: CellCoordinates;
  openSelectCell: string | null;
  onCellClick: (row: number, col: number) => void;
  onOpenSelectDropdown: (cellKey: string | null) => void;
  onSelectChange: (value: string, row: number, col: number) => void;
};

const SelectCell: FC<SelectCellProps> = ({
  cell,
  coordinates,
  openSelectCell,
  onCellClick,
  onOpenSelectDropdown,
  onSelectChange,
}) => {
  const { row, col } = coordinates;
  const key = buildCellKey(coordinates);

  return (
    <div
      className={clsx(
        buildCommonClasses(cell),
        "relative flex h-full cursor-pointer items-center",
      )}
      style={buildCommonStyles(cell)}
      onClick={() => onCellClick(row, col)}
    >
      <div className="flex-1 truncate">{cell.content}</div>
      <div
        className="ml-1 flex-shrink-0 rounded p-0.5 hover:bg-gray-100"
        onClick={() => onOpenSelectDropdown(key)}
      >
        <ChevronDown className="h-3 w-3" />
      </div>
      {/* Hidden Select component that opens when dropdown icon is clicked */}
      <Select
        value={cell.content}
        onValueChange={(value) => onSelectChange(value, row, col)}
        open={openSelectCell === key}
        onOpenChange={(open) => !open && onOpenSelectDropdown(null)}
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

export { InputCell, LinkCell, SelectCell };
