export const capi = {
  defaults: {
    InitialConfig: "", // Captures the current config of the table, including any student input values in cells.
    TableJSON: "", // Current configuration including what a student might change
    IsModifed: false, // Indicates if the student has modified every table cell.
    IsComplete: false, // If the LD sets this to true, then the correct answers should be shown
    IsCorrect: false, // If the LD sets this to true, then the correct answers should be shown
    Enabled: true, // Indicated whether the table is enabled or disabled for students to interact with it
    ShowHints: false, // When true, highlights correct cells in green and incorrect cells in red.
    CSVImport: "", // Allows importing table structure and data from a formatted CSV string. (Stretch Goal)
    Reset: false, // When set to true, resets the table to its default state.
    Color: "", // Could be hex, color name, etc
    CSS: "",
    Title: "",
    Summary: "",
  },

  exposeWith: {
    InitialConfig: {
      type: "string",
      alias: "InitialConfig",
      readonly: false,
      writeonly: false,
    },
    TableJSON: {
      type: "string",
      alias: "TableJSON",
      readonly: false,
      writeonly: false,
    },
    IsModifed: {
      type: "boolean",
      alias: "IsModifed",
      readonly: true,
      writeonly: false,
    },
    IsComplete: {
      type: "boolean",
      alias: "IsComplete",
      readonly: true,
      writeonly: false,
    },
    IsCorrect: {
      type: "boolean",
      alias: "IsCorrect",
      readonly: false,
      writeonly: false,
    },
    Enabled: {
      type: "boolean",
      alias: "Enabled",
      readonly: false,
      writeonly: false,
    },
    ShowHints: {
      type: "boolean",
      alias: "ShowHints",
      readonly: false,
      writeonly: false,
    },
    CSVImport: {
      type: "string",
      alias: "CSVImport",
      readonly: false,
      writeonly: false,
    },
    Reset: {
      type: "boolean",
      alias: "Reset",
      readonly: false,
      writeonly: false,
    },
    Color: {
      type: "string",
      alias: "Color",
      readonly: false,
      writeonly: false,
    },
    CSS: {
      type: "string",
      alias: "CSS",
      readonly: false,
      writeonly: false,
    },
    Title: {
      type: "string",
      alias: "Title",
      readonly: false,
      writeonly: false,
    },
    Summary: {
      type: "string",
      alias: "Summary",
      readonly: false,
      writeonly: false,
    },
  },
};
