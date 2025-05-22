import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CONTENT_ALIGN,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
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
  fontSize: DEFAULT_FONT_SIZE,
  contentType: "not-editable",
  selectOptions: [],
  link: null,
  disabled: true,
  correctAnswer: null,
});

const injectCSS = (cssString: string, styleId = "dynamic-style") => {
  let styleTag = document.getElementById(styleId);
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = cssString;
};

const replaceWithHtmlTags = (content: string): string =>
  content
    .replace(/\^([^^]+)\^/g, "<sup>$1</sup>")
    .replace(/_([^_]+)_/g, "<sub>$1</sub>");

export { buildDefaultCell, injectCSS, replaceWithHtmlTags };
