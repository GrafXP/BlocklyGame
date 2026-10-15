import { TYPES } from "../sim/entities.js";
import { RECIPES } from "../sim/recipes.js";
import { choicesFor } from "./choices.js";

const block = (type, extra = {}) => ({ kind: "block", type, ...extra });
const number = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const category = (name, style, contents) => ({ kind: "category", name: `%{BKY_${name}}`, categorystyle: `${style}_category`, contents });

// The lab's toolbox: every Phase 0 block, in the categories children will see.
export const LAB_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    category("CAT_START", "entry", [block("island_when_started")]),
    category("CAT_ROBOT", "robot", [block("robot_go_to"), block("robot_collect"), block("robot_unload")]),
    category("CAT_BUILDING", "building", [block("building_make")]),
    category("CAT_CONTROL", "control", [
      block("controls_repeat_ext", { inputs: { TIMES: number(3) } }),
      block("control_forever"),
      block("controls_if"),
      block("controls_if", { extraState: { hasElse: true } }),
      block("control_wait_steps"),
    ]),
    category("CAT_SENSING", "sensing", [block("sense_stock")]),
    category("CAT_VALUES", "values", [block("math_number", { fields: { NUM: 4 } }), block("logic_compare", { inputs: { A: number(0), B: number(4) } })]),
  ],
};

// --- The game's toolboxes ------------------------------------------------------
//
// The editor offers only the blocks the robot or building whose program it is
// can use (PLAN.md §7): a robot's actions to robots, a building's to buildings,
// and Make only to a building with a recipe. A block's dropdowns start at a
// choice that fits (choices.js). Mission unlocks narrow this further from
// Phase 7.

const can = (type, ability) => TYPES[type]?.can?.includes(ability) ?? false;
const recipes = (type) => TYPES[type]?.recipes ?? [];

// Each block's use, from the robot or building type: whether it can use it.
const USE = {
  robot_go_to: (type) => can(type, "goTo"),
  robot_collect: (type) => can(type, "collect"),
  robot_pick_up: (type) => can(type, "pickUp"),
  robot_unload: (type) => can(type, "unload"),
  building_make: (type) => can(type, "make") && recipes(type).some((r) => !RECIPES[r].builds),
  building_build: (type) => can(type, "make") && recipes(type).some((r) => RECIPES[r].builds),
  control_wait_steps: (type) => can(type, "wait"),
  sense_basket: (type) => can(type, "basket"),
};

const GAME = [
  ["CAT_START", "entry", [block("island_when_started")]],
  ["CAT_ROBOT", "robot", [block("robot_go_to"), block("robot_collect"), block("robot_pick_up"), block("robot_unload")]],
  ["CAT_BUILDING", "building", [block("building_make"), block("building_build")]],
  [
    "CAT_CONTROL",
    "control",
    [
      block("controls_repeat_ext", { inputs: { TIMES: number(3) } }),
      block("control_forever"),
      block("controls_if"),
      block("controls_if", { extraState: { hasElse: true } }),
      block("control_wait_steps"),
      block("control_wait_until"),
    ],
  ],
  ["CAT_SENSING", "sensing", [block("sense_stock"), block("sense_basket")]],
  ["CAT_VALUES", "values", [block("math_number", { fields: { NUM: 4 } }), block("logic_compare", { inputs: { A: number(0), B: number(4) } })]],
];

// The fields a toolbox block starts with for `type`: a Make or Build at the
// first thing the building makes or builds.
function startingFields(b, type) {
  const list = { building_make: ["ITEM", "makes"], building_build: ["BLUEPRINT", "builds"] }[b.type];
  const first = list && choicesFor(list[1], { type })[0];
  return first ? { ...b, fields: { [list[0]]: first[1] } } : b;
}

// The toolbox for a program run by robots or buildings of `types`: the blocks
// every one of them can use, in categories; a category with none left out.
export function toolboxFor(types) {
  const usable = (b) => types.every((type) => USE[b.type]?.(type) ?? true);
  return {
    kind: "categoryToolbox",
    contents: GAME.map(([name, style, blocks]) => category(name, style, blocks.filter(usable).map((b) => (types.length === 1 ? startingFields(b, types[0]) : b)))).filter(
      (c) => c.contents.length,
    ),
  };
}
