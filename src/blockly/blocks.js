import { ICONS } from "./icons.js";

// The game's own blocks, as Blockly JSON definitions. Their words are message
// references (%{BKY_…}, src/i18n/en/blocks.js), so a block's definition is the
// same in every language, and so are the stable ids its dropdowns store (grove,
// wood): only their labels are translated. The compiler reads the dropdowns'
// ids from here too (src/programming/compiler.js), so a program can hold only
// what its blocks offer.
//
// A dropdown of type "field_choice" offers what makes sense where the block is
// used (PLAN.md §7, valid-target dropdowns): the places on the island, what the
// building being programmed can make. Its `choices` names the list
// (src/blockly/choices.js); its `options` are every value it can hold, which the
// compiler checks against, and what it offers where there's no island to ask,
// as in the editor lab (src/blockly/fields.js).
//
// Styles name a colour family (src/blockly/treatments.js), not a colour, so each
// visual treatment colours every block.
//
// Variables, routines and Set, Change and Get are Blockly's own blocks
// (variables_set, math_change, variables_get, procedures_defnoreturn,
// procedures_callnoreturn), worded by Blockly's catalogue and the game's
// overrides (src/i18n/*/blockly.js); the messages' Send and Wait For are the
// game's, below.
//
// A robot action's place or item is an input, not a dropdown of its own (PLAN.md
// §5, §7): it holds a value block. Its shadow, a place or an item chosen from a
// dropdown, is there from the start, like the number in a new Repeat, and a
// setting such as “my destination” plugs in over it, so one program can do each
// robot's own job. Values have a type, as Blockly checks them: "Place" or
// "Item".

const icon = (name) => ({ type: "field_image", src: ICONS[name], width: 24, height: 24, alt: "" });

export const PLACES = [
  ["%{BKY_PLACE_GROVE}", "grove"],
  ["%{BKY_PLACE_SAWMILL}", "sawmill"],
  ["%{BKY_PLACE_SITE}", "site"],
  ["%{BKY_PLACE_DEPOT}", "depot"],
  ["%{BKY_PLACE_CAMP}", "camp"],
  ["%{BKY_PLACE_QUARRY}", "quarry"],
  ["%{BKY_PLACE_WORKSHOP}", "workshop"],
];
export const RAW = [
  ["%{BKY_ITEM_WOOD}", "wood"],
  ["%{BKY_ITEM_STONE}", "stone"],
];
export const MADE = [
  ["%{BKY_ITEM_PLANK}", "plank"],
  ["%{BKY_ITEM_KIT}", "kit"],
];
export const BLUEPRINTS = [
  ["%{BKY_BLUEPRINT_BRIDGE}", "bridge"],
  ["%{BKY_BLUEPRINT_WORKSHOP}", "workshop"],
];
// The messages there are (src/sim/messages.js, MESSAGES), in the same order.
export const MESSAGE_CHOICES = [
  ["%{BKY_MESSAGE_PLANKREADY}", "plankReady"],
  ["%{BKY_MESSAGE_KITREADY}", "kitReady"],
  ["%{BKY_MESSAGE_WOODPLEASE}", "woodPlease"],
  ["%{BKY_MESSAGE_PLANKPLEASE}", "plankPlease"],
  ["%{BKY_MESSAGE_STONEPLEASE}", "stonePlease"],
  ["%{BKY_MESSAGE_STONEDELIVERED}", "stoneDelivered"],
  ["%{BKY_MESSAGE_GO}", "go"],
];
// Who a message can go to: the island's robots and buildings. On an island,
// its own (src/blockly/choices.js, recipients); these where there's none.
export const RECIPIENTS = [
  ["%{BKY_ROBO_1}", "r1"],
  ["%{BKY_ROBO_2}", "r2"],
  ["%{BKY_ROBO_3}", "r3"],
  ...PLACES.filter(([, id]) => !["grove", "quarry"].includes(id)),
];

// The value block each action's input starts with, as its shadow: the input's
// name, the block's type, and its field.
export const SHADOWS = {
  robot_go_to: { input: "PLACE", type: "value_place", field: "PLACE" },
  robot_collect: { input: "ITEM", type: "value_raw", field: "ITEM" },
  robot_pick_up: { input: "ITEM", type: "value_item", field: "ITEM" },
};

// The setting blocks, each reading one of a robot's settings (src/sim/
// entities.js, SETTINGS), and the type of value it gives.
export const SETTING_BLOCKS = {
  setting_source: { slot: "source", output: "Place" },
  setting_item: { slot: "item", output: "Item" },
  setting_destination: { slot: "destination", output: "Place" },
};

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
    args0: [icon("go"), { type: "input_value", name: "PLACE", check: "Place" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "robot_blocks",
    tooltip: "%{BKY_ROBOT_GO_TO_TOOLTIP}",
  },
  {
    type: "robot_collect",
    message0: "%{BKY_ROBOT_COLLECT}",
    args0: [icon("collect"), { type: "input_value", name: "ITEM", check: "Item" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "robot_blocks",
    tooltip: "%{BKY_ROBOT_COLLECT_TOOLTIP}",
  },
  {
    type: "robot_pick_up",
    message0: "%{BKY_ROBOT_PICK_UP}",
    args0: [icon("pickUp"), { type: "input_value", name: "ITEM", check: "Item" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "robot_blocks",
    tooltip: "%{BKY_ROBOT_PICK_UP_TOOLTIP}",
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
    args0: [icon("make"), { type: "field_choice", name: "ITEM", options: MADE, choices: "makes" }],
    previousStatement: null,
    nextStatement: null,
    style: "building_blocks",
    tooltip: "%{BKY_BUILDING_MAKE_TOOLTIP}",
  },
  {
    type: "building_build",
    message0: "%{BKY_BUILDING_BUILD}",
    args0: [icon("build"), { type: "field_choice", name: "BLUEPRINT", options: BLUEPRINTS, choices: "builds" }],
    previousStatement: null,
    nextStatement: null,
    style: "building_blocks",
    tooltip: "%{BKY_BUILDING_BUILD_TOOLTIP}",
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
    type: "control_wait_until",
    message0: "%{BKY_CONTROL_WAIT_UNTIL}",
    args0: [icon("until"), { type: "input_value", name: "UNTIL", check: "Boolean" }],
    previousStatement: null,
    nextStatement: null,
    style: "loop_blocks",
    tooltip: "%{BKY_CONTROL_WAIT_UNTIL_TOOLTIP}",
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
  // Messages (src/sim/messages.js): send one to a robot or building, and wait
  // for one to come. Send is two rows, the message and whom it's for, so it
  // fits the toolbox in every language.
  {
    type: "message_send",
    message0: "%{BKY_MESSAGE_SEND}",
    args0: [icon("send"), { type: "field_dropdown", name: "MESSAGE", options: MESSAGE_CHOICES }],
    message1: "%{BKY_MESSAGE_SEND_TO}",
    args1: [{ type: "field_choice", name: "TO", options: RECIPIENTS, choices: "recipients" }],
    previousStatement: null,
    nextStatement: null,
    style: "message_blocks",
    tooltip: "%{BKY_MESSAGE_SEND_TOOLTIP}",
  },
  {
    type: "message_wait",
    message0: "%{BKY_MESSAGE_WAIT}",
    args0: [icon("mail"), { type: "field_dropdown", name: "MESSAGE", options: MESSAGE_CHOICES }],
    previousStatement: null,
    nextStatement: null,
    style: "message_blocks",
    tooltip: "%{BKY_MESSAGE_WAIT_TOOLTIP}",
  },
  {
    type: "sense_stock",
    message0: "%{BKY_SENSE_STOCK}",
    args0: [
      { type: "field_dropdown", name: "ITEM", options: [...RAW, ...MADE] },
      { type: "field_choice", name: "PLACE", options: PLACES, choices: "places" },
    ],
    output: "Number",
    style: "sensing_blocks",
    tooltip: "%{BKY_SENSE_STOCK_TOOLTIP}",
  },
  {
    type: "sense_basket",
    message0: "%{BKY_SENSE_BASKET}",
    args0: [],
    output: "Number",
    style: "sensing_blocks",
    tooltip: "%{BKY_SENSE_BASKET_TOOLTIP}",
  },
  // The values an action's input starts with: a place, an item to collect, an
  // item to pick up. They're the robot's colour, a lighter part of its block.
  {
    type: "value_place",
    message0: "%1",
    args0: [{ type: "field_choice", name: "PLACE", options: PLACES, choices: "places" }],
    output: "Place",
    style: "robot_blocks",
    tooltip: "%{BKY_VALUE_PLACE_TOOLTIP}",
  },
  {
    type: "value_raw",
    message0: "%1",
    args0: [{ type: "field_dropdown", name: "ITEM", options: RAW }],
    output: "Item",
    style: "robot_blocks",
    tooltip: "%{BKY_VALUE_ITEM_TOOLTIP}",
  },
  {
    type: "value_item",
    message0: "%1",
    args0: [{ type: "field_dropdown", name: "ITEM", options: [...MADE, ...RAW] }],
    output: "Item",
    style: "robot_blocks",
    tooltip: "%{BKY_VALUE_ITEM_TOOLTIP}",
  },
  // A robot's settings, read where its program uses them.
  ...Object.entries(SETTING_BLOCKS).map(([type, { output }]) => ({
    type,
    message0: `%{BKY_${type.toUpperCase()}}`,
    args0: [],
    output,
    style: "math_blocks",
    tooltip: `%{BKY_${type.toUpperCase()}_TOOLTIP}`,
  })),
];
