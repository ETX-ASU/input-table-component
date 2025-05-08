export const capi = {
  defaults: {
    Mode: "preview",
    InitialConfig: "", // Captures the current config of the table, including any student input values in cells.
    TableJSON: "", // Current configuration including what a student might change
    IsModifed: false, // Indicates if the student has modified any table cell.
    IsComplete: false, // Indicates if the student has modified every table cell.
    IsCorrect: false, // If the LD sets this to true, then the correct answers should be shown
    Enabled: true, // Indicated whether the table is enabled or disabled for students to interact with it
    ShowHints: false, // When true, highlights correct cells in green and incorrect cells in red.
    CSS: "",
    Title: "",
    Summary: "",
  },

  exposeWith: {
    Mode: {
      type: 5, // "Enum"
      allowedValues: ["preview", "config"],
      alias: "Mode",
      readonly: false,
      writeonly: false,
    },
    InitialConfig: {
      alias: "InitialConfig",
      readonly: false,
      writeonly: false,
    },
    TableJSON: {
      alias: "TableJSON",
      readonly: false,
      writeonly: false,
    },
    IsModifed: {
      alias: "IsModifed",
      readonly: true,
      writeonly: false,
    },
    IsComplete: {
      alias: "IsComplete",
      readonly: true,
      writeonly: false,
    },
    IsCorrect: {
      alias: "IsCorrect",
      readonly: false,
      writeonly: false,
    },
    Enabled: {
      alias: "Enabled",
      readonly: false,
      writeonly: false,
    },
    ShowHints: {
      alias: "ShowHints",
      readonly: false,
      writeonly: false,
    },
    CSS: {
      alias: "CSS",
      readonly: false,
      writeonly: false,
    },
    Title: {
      alias: "Title",
      readonly: false,
      writeonly: false,
    },
    Summary: {
      alias: "Summary",
      readonly: false,
      writeonly: false,
    },
  },
};
