import { colorPalette } from "../components/color-picker";
import { WebSafeFont } from "../components/font-selector";
import { TextAlign } from "./store";

export const DEFAULT_BORDER_WIDTH = 0.5;
export const DEFAULT_BORDER_COLOR = colorPalette.lightGray[60];

export const DEFAULT_BACKGROUND_COLOR = "transparent";
export const BACKGROUND_COLOR_LIGHT_BLUE = colorPalette.blue[20];
export const BACKGROUND_COLOR_LIGHT_GRAY = colorPalette.lightGray[20];
export const BACKGROUND_COLOR_SUBTLE_GRAY = colorPalette.lightGray[20];

export const DEFAULT_FONT_FAMILY: WebSafeFont = WebSafeFont.Arial;
export const DEFAULT_FONT_SIZE = 12;
export const DEFAULT_FONT_COLOR = colorPalette.gray[100];

export const DEFAULT_ROW_HEIGHT = 46;
export const DEFAULT_COLUMN_WIDTH = 150;
export const DEFAULT_COLUMN_COUNT = 5;
export const DEFAULT_ROW_COUNT = 5;

export const DEFAULT_CONTENT_ALIGN: TextAlign = "left";

export const MAX_HISTORY_LENGTH = 50;
export const ROW_HEADER_WIDTH = 40;

export const DEFAULT_CELL_BACKGROUND_COLOR = "transparent";
