import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CONTENT_ALIGN,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_FAMILY,
} from "./constants";
import { CellData } from "./store";

const buildDefaultCell = (): CellData => ({
  content: "",
  isBold: false,
  isItalic: false,
  isStrikethrough: false,
  textAlign: DEFAULT_CONTENT_ALIGN,
  textColor: DEFAULT_FONT_COLOR,
  borderWidth: DEFAULT_BORDER_WIDTH,
  borderColor: DEFAULT_BORDER_COLOR,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  fontFamily: DEFAULT_FONT_FAMILY,
  contentType: "text",
  selectOptions: [],
  link: null,
});

export { buildDefaultCell };
