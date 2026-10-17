// Blockly's own words in English: its catalogue, which words the built-in blocks
// (repeat, if, compare), menus and screen-reader announcements, and any of its
// messages the game words differently (PLAN.md §8, Languages).
export const load = () => import("blockly/msg/en");

export const overrides = {
  // A block of the player's own: “my block bring wood”, rather than Blockly's
  // “to bring wood”. Its definition gets no comment to fill in.
  PROCEDURES_DEFNORETURN_TITLE: "my block",
  PROCEDURES_DEFNORETURN_PROCEDURE: "new block",
  PROCEDURES_DEFNORETURN_COMMENT: "",
  PROCEDURES_DEFNORETURN_TOOLTIP: "A block of your own: the blocks inside run wherever you use it.",
  PROCEDURES_CALLNORETURN_TOOLTIP: "Run the blocks of your own block “%1”.",
  PROCEDURES_BEFORE_PARAMS: "with:",
  PROCEDURES_MUTATORCONTAINER_TITLE: "input",
  PROCEDURES_MUTATORARG_TITLE: "input name:",
  // A variable remembers a number.
  VARIABLES_SET_TOOLTIP: "Remember this number from now on.",
  VARIABLES_GET_TOOLTIP: "The number this remembers.",
  MATH_CHANGE_TOOLTIP: "Add this number to “%1”. A number below 0 takes away.",
  NEW_VARIABLE: "New variable…",
};
