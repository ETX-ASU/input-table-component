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

export const capi = {
  defaults: {
    [CapiFields.Mode]: "preview",
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
      type: 5, // "Enum"
      allowedValues: ["preview", "config"],
      alias: CapiFields.Mode,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.InitialConfig]: {
      alias: CapiFields.InitialConfig,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.TableJSON]: {
      alias: CapiFields.TableJSON,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.IsModified]: {
      alias: CapiFields.IsModified,
      readonly: true,
      writeonly: false,
    },
    [CapiFields.IsComplete]: {
      alias: CapiFields.IsComplete,
      readonly: true,
      writeonly: false,
    },
    [CapiFields.IsCorrect]: {
      alias: CapiFields.IsCorrect,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.Enabled]: {
      alias: CapiFields.Enabled,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.ShowHints]: {
      alias: CapiFields.ShowHints,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.CSS]: {
      alias: CapiFields.CSS,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.Title]: {
      alias: CapiFields.Title,
      readonly: false,
      writeonly: false,
    },
    [CapiFields.Summary]: {
      alias: CapiFields.Summary,
      readonly: false,
      writeonly: false,
    },
  },
};
