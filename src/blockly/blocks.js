import { ICONS } from "./icons.js";

// The game's own blocks, as Blockly JSON definitions. Their words are message
// references (%{BKY_…}, src/i18n/en/blocks.js), so a block's definition is the
// same in every language, and so are the stable ids its dropdowns store (grove,
// wood): only their labels are translated. This is the Phase 0 set, enough to
// judge how blocks look; the real set and its rules come with the compiler
// (PLAN.md §7).
//
// Styles name a colour family (src/blockly/treatments.js), not a colour, so each
// visual treatment colours every block.

const icon = (name) => ({ type: "field_image", src: ICONS[name], width: 24, height: 24, alt: "" });

export const PLACES = [
  ["%{BKY_PLACE_GROVE}", "grove"],
  ["%{BKY_PLACE_SAWMILL}", "sawmill"],
  ["%{BKY_PLACE_DEPOT}", "depot"],
  ["%{BKY_PLACE_CAMP}", "camp"],
];
const RAW = [
  ["%{BKY_ITEM_WOOD}", "wood"],
  ["%{BKY_ITEM_STONE}", "stone"],
];
const MADE = [
  ["%{BKY_ITEM_PLANK}", "plank"],
  ["%{BKY_ITEM_KIT}", "kit"],
];

export const BLOCKS = [
  {
    type: "island_when_started",
    message0: "%{BKY_ISLAND_WHEN_STARTED}",
    args0: [icon("start")],
    nextStatement: null,
    style: "entry_blocks",
    tooltip: "%{BKY_ISLAND_WHEN_STARTED_TOOLTIP}",
  },
  {
    type: "robot_go_to",
    message0: "%{BKY_ROBOT_GO_TO}",
    args0: [icon("go"), { type: "field_dropdown", name: "PLACE", options: PLACES }],
    previousStatement: null,
    nextStatement: null,
    style: "robot_blocks",
    tooltip: "%{BKY_ROBOT_GO_TO_TOOLTIP}",
  },
  {
    type: "robot_collect",
    message0: "%{BKY_ROBOT_COLLECT}",
    args0: [icon("collect"), { type: "field_dropdown", name: "ITEM", options: RAW }],
    previousStatement: null,
    nextStatement: null,
    style: "robot_blocks",
    tooltip: "%{BKY_ROBOT_COLLECT_TOOLTIP}",
  },
  {
    type: "robot_unload",
    message0: "%{BKY_ROBOT_UNLOAD}",
    args0: [icon("unload")],
    previousStatement: null,
    nextStatement: null,
    style: "robot_blocks",
    tooltip: "%{BKY_ROBOT_UNLOAD_TOOLTIP}",
  },
  {
    type: "building_make",
    message0: "%{BKY_BUILDING_MAKE}",
    args0: [icon("make"), { type: "field_dropdown", name: "ITEM", options: MADE }],
    previousStatement: null,
    nextStatement: null,
    style: "building_blocks",
    tooltip: "%{BKY_BUILDING_MAKE_TOOLTIP}",
  },
  {
    type: "control_wait_steps",
    message0: "%{BKY_CONTROL_WAIT_STEPS}",
    args0: [icon("wait"), { type: "field_number", name: "STEPS", value: 5, min: 1, max: 999, precision: 1 }],
    previousStatement: null,
    nextStatement: null,
    style: "loop_blocks",
    tooltip: "%{BKY_CONTROL_WAIT_STEPS_TOOLTIP}",
  },
  {
    type: "control_forever",
    message0: "%{BKY_CONTROL_FOREVER}",
    args0: [icon("forever")],
    message1: "%1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    style: "loop_blocks",
    tooltip: "%{BKY_CONTROL_FOREVER_TOOLTIP}",
  },
  {
    type: "sense_stock",
    message0: "%{BKY_SENSE_STOCK}",
    args0: [
      { type: "field_dropdown", name: "ITEM", options: [...RAW, ...MADE] },
      { type: "field_dropdown", name: "PLACE", options: PLACES },
    ],
    output: "Number",
    style: "sensing_blocks",
    tooltip: "%{BKY_SENSE_STOCK_TOOLTIP}",
  },
];
