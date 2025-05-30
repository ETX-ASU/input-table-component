import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import { FC } from "react";
import useSpreadsheetStore, {
  CellCoordinates,
  CellData,
} from "../../lib/store";
import { replaceWithHtmlTags } from "../../lib/utils";
import { buildCommonClasses, buildCommonStyles } from "./utils";

type LinkCellProps = {
  cell: CellData;
  coordinates: CellCoordinates;
};

const PreviewLinkCell: FC<LinkCellProps> = ({ cell, coordinates }) => {
  const { canInteractWithCell } = useSpreadsheetStore();

  return (
    <a
      href={cell.link!}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        buildCommonClasses(cell, canInteractWithCell(coordinates)),
        "flex items-center gap-1 overflow-hidden text-blue-600 underline",
      )}
      style={{ ...buildCommonStyles(cell), cursor: "pointer" }}
    >
      <span
        className="flex-1 truncate"
        dangerouslySetInnerHTML={{ __html: replaceWithHtmlTags(cell.content) }}
      />

      <ExternalLink className="h-3 w-3" />
    </a>
  );
};

const ConfigLinkCell: FC<LinkCellProps> = ({ cell, coordinates }) => {
  const { canInteractWithCell } = useSpreadsheetStore();

  return (
    <div
      className={clsx(
        buildCommonClasses(cell, canInteractWithCell(coordinates)),
        "flex items-center gap-1 overflow-hidden text-blue-600 underline",
      )}
      style={{ ...buildCommonStyles(cell) }}
    >
      <span className="flex-1 truncate">{cell.content}</span>
      <a href={cell.link!} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
};

export { ConfigLinkCell, PreviewLinkCell };
export type { LinkCellProps };
