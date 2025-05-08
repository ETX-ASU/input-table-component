import { AppMode } from "../store";

export enum CapiFields {
  Mode = "Mode",
  InitialConfig = "InitialConfig",
  TableJSON = "TableJSON",
  IsModified = "IsModified",
  IsComplete = "IsComplete",
  IsCorrect = "IsCorrect",
  Enabled = "Enabled",
  ShowHints = "ShowHints",
  CSS = "CSS",
  Title = "Title",
  Summary = "Summary",
}

enum CapiTypes {
  ARRAY = 3,
  ARRAY_POINT = 7,
  BOOLEAN = 4,
  ENUM = 5,
  MATH_EXPR = 6,
  NUMBER = 1,
  STRING = 2,
}

export const capi = {
  defaults: {
    [CapiFields.Mode]: "config" as AppMode,
    [CapiFields.InitialConfig]: "", // Captures the current config of the table, including any student input values in cells.
    [CapiFields.TableJSON]: "", // Current configuration including what a student might change
    [CapiFields.IsModified]: false, // Indicates if the student has modified any table cell.
    [CapiFields.IsComplete]: false, // Indicates if the student has modified every table cell.
    [CapiFields.IsCorrect]: false, // If the LD sets this to true, then the correct answers should be shown
    [CapiFields.Enabled]: true, // Indicated whether the table is enabled or disabled for students to interact with it
    [CapiFields.ShowHints]: false, // When true, highlights correct cells in green and incorrect cells in red.
    [CapiFields.CSS]: "",
    [CapiFields.Title]: "",
    [CapiFields.Summary]: "",
  },

  exposeWith: {
    [CapiFields.Mode]: {
      type: CapiTypes.ENUM,
      allowedValues: ["preview", "config"],
      alias: CapiFields.Mode,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.InitialConfig]: {
      type: CapiTypes.STRING,
      alias: CapiFields.InitialConfig,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.TableJSON]: {
      type: CapiTypes.STRING,
      alias: CapiFields.TableJSON,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.IsModified]: {
      type: CapiTypes.BOOLEAN,
      alias: CapiFields.IsModified,
      readonly: true,
      writeonly: false,
    },
    [CapiFields.IsComplete]: {
      type: CapiTypes.BOOLEAN,
      alias: CapiFields.IsComplete,
      readonly: true,
      writeonly: false,
    },
    [CapiFields.IsCorrect]: {
      type: CapiTypes.BOOLEAN,
      alias: CapiFields.IsCorrect,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.Enabled]: {
      type: CapiTypes.BOOLEAN,
      alias: CapiFields.Enabled,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.ShowHints]: {
      type: CapiTypes.BOOLEAN,
      alias: CapiFields.ShowHints,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.CSS]: {
      type: CapiTypes.STRING,
      alias: CapiFields.CSS,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.Title]: {
      type: CapiTypes.STRING,
      alias: CapiFields.Title,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.Summary]: {
      type: CapiTypes.STRING,
      alias: CapiFields.Summary,
      readonly: false,
      writeonly: false,
    },
  },
};
