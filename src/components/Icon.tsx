import { FC, SVGProps } from "react";

// Import all SVGs
import AddColIcon from "../assets/svgs/add-col.svg?react";
import AddRowIcon from "../assets/svgs/add-row.svg?react";
import AlignCenterIcon from "../assets/svgs/align-center.svg?react";
import AlignLeftIcon from "../assets/svgs/align-left.svg?react";
import AlignRightIcon from "../assets/svgs/align-right.svg?react";
import BoldIcon from "../assets/svgs/bold.svg?react";
import CellBackgroundColorIcon from "../assets/svgs/cell-background-color.svg?react";
import CellBorderColorIcon from "../assets/svgs/cell-border-color.svg?react";
import CellBorderWidthIcon from "../assets/svgs/cell-border-width.svg?react";
import CellTypeIcon from "../assets/svgs/cell-type.svg?react";
import ChevronDownIcon from "../assets/svgs/chevron-down.svg?react";
import DeleteColumnIcon from "../assets/svgs/delete-column.svg?react";
import DeleteRowIcon from "../assets/svgs/delete-row.svg?react";
import FontColorIcon from "../assets/svgs/font-color.svg?react";
import InputDropdownIcon from "../assets/svgs/input-dropdown.svg?react";
import InputNumberIcon from "../assets/svgs/input-number.svg?react";
import InputTextIcon from "../assets/svgs/input-text.svg?react";
import ItalicIcon from "../assets/svgs/italic.svg?react";
import LinkIcon from "../assets/svgs/link.svg?react";
import MoreOptionsIcon from "../assets/svgs/more-options.svg?react";
import RedoIcon from "../assets/svgs/redo.svg?react";
import StrikethroughIcon from "../assets/svgs/strikethrough.svg?react";
import UndoIcon from "../assets/svgs/undo.svg?react";

// Map of icon names to their components
const icons = {
  undo: UndoIcon,
  redo: RedoIcon,
  "font-color": FontColorIcon,
  "add-row": AddRowIcon,
  "add-col": AddColIcon,
  bold: BoldIcon,
  italic: ItalicIcon,
  "strike-through": StrikethroughIcon,
  link: LinkIcon,
  "align-left": AlignLeftIcon,
  "align-center": AlignCenterIcon,
  "align-right": AlignRightIcon,
  "cell-type": CellTypeIcon,
  "more-options": MoreOptionsIcon,
  "delete-column": DeleteColumnIcon,
  "delete-row": DeleteRowIcon,
  "chevron-down": ChevronDownIcon,
  "cell-background-color": CellBackgroundColorIcon,
  "cell-border-color": CellBorderColorIcon,
  "cell-border-width": CellBorderWidthIcon,
  "input-dropdown": InputDropdownIcon,
  "input-number": InputNumberIcon,
  "input-text": InputTextIcon,
} as const;

type IconName = keyof typeof icons;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export const Icon: FC<IconProps> = ({ name, ...props }) => {
  const SvgComponent = icons[name];
  return <SvgComponent {...props} />;
};
