import useSpreadsheetStore, { TextAlign } from "../../lib/store";

import clsx from "clsx";
import { CircleAlert, CircleCheck } from "lucide-react";
import { FC, ReactElement, ReactNode } from "react";
import { CellData } from "../../lib/store";
import { colorPalette } from "../color-picker";

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
  fontSize: cell.fontSize,
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
    <div className={clsx("flex items-center gap-2 truncate", className)}>
      {showIndicator && (
        <div className="flex-shrink-0 rounded">
          {isCorrect ? correctIcon : incorrectIcon}
        </div>
      )}
      {children}
    </div>
  );
};

const AppModeSwitcher: FC<{
  previewComponent: ReactElement;
  configComponent: ReactElement;
}> = ({ previewComponent, configComponent }) => {
  const { appMode } = useSpreadsheetStore();

  return appMode === "preview" ? previewComponent : configComponent;
};

export {
  AppModeSwitcher,
  buildAlignmentClass,
  buildCommonClasses,
  buildCommonStyles,
  CorrectnessIndicatorWrapper,
};
