import { blue, gray, lightGray } from "../components/color-picker";
import { WebSafeFont } from "../components/font-selector";
import { TextAlign } from "./store";

export const DEFAULT_BORDER_WIDTH = 0.5;
export const DEFAULT_BORDER_COLOR = lightGray[60];

export const DEFAULT_BACKGROUND_COLOR = "transparent";
export const BACKGROUND_COLOR_LIGHT_BLUE = blue[20];
export const BACKGROUND_COLOR_LIGHT_GRAY = lightGray[20];
export const BACKGROUND_COLOR_SUBTLE_GRAY = lightGray[20];

export const DEFAULT_FONT_FAMILY: WebSafeFont = WebSafeFont.Arial;
export const DEFAULT_FONT_SIZE = 12;
export const DEFAULT_FONT_COLOR = gray[100];

export const DEFAULT_ROW_HEIGHT = 28;
export const DEFAULT_COLUMN_WIDTH = 100;
export const DEFAULT_COLUMN_COUNT = 5;
export const DEFAULT_ROW_COUNT = 5;

export const DEFAULT_CONTENT_ALIGN: TextAlign = "left";

export const MAX_HISTORY_LENGTH = 50;
export const ROW_HEADER_WIDTH = 40;

export const DEFAULT_CELL_BACKGROUND_COLOR = "transparent";
