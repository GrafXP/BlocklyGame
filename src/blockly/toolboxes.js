import { TYPES } from "../sim/entities.js";
import { RECIPES } from "../sim/recipes.js";
import { SETTING_BLOCKS, SHADOWS } from "./blocks.js";
import { choicesFor } from "./choices.js";

// A toolbox block; a robot action comes with its input's value as a shadow,
// at the dropdown's first choice.
const block = (type, extra = {}) => {
  const shadow = SHADOWS[type];
  return { kind: "block", type, ...(shadow && { inputs: { [shadow.input]: { shadow: { type: shadow.type } } } }), ...extra };
};
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
// choice that fits (choices.js). A mission narrows this further to the blocks
// it and the missions before it unlocked (src/content/missions/campaign.js),
// each named by its type, and the If with an else as "controls_if_else".

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
  ...Object.fromEntries(Object.keys(SETTING_BLOCKS).map((b) => [b, (type) => can(type, "settings")])),
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
  [
    "CAT_VALUES",
    "values",
    [block("math_number", { fields: { NUM: 4 } }), block("logic_compare", { inputs: { A: number(0), B: number(4) } }), ...Object.keys(SETTING_BLOCKS).map((b) => block(b))],
  ],
  ["CAT_MEMORY", "memory", "GAME_MEMORY"],
  ["CAT_ROUTINES", "routine", "GAME_ROUTINES"],
  ["CAT_MESSAGES", "message", [block("message_send"), block("message_wait")]],
];

// The categories whose blocks depend on the program (PLAN.md §7, Phase 8),
// filled as the editor opens them (src/blockly/workspace.js): Memory offers
// Set, Change and Get for each variable the program has, and a new variable;
// My blocks a new block of one's own, and a use of each the program has. Each
// offers the unlocks listed here that the play allows, its `offers`.
export const DYNAMIC = {
  GAME_MEMORY: ["variables_set", "math_change", "variables_get"],
  GAME_ROUTINES: ["procedures_defnoreturn", "procedures_callnoreturn"],
};

// The fields a toolbox block starts with for `type`: a Make or Build at the
// first thing the building makes or builds (of `builds`, the blueprints of the
// sites that run the program, when given).
function startingFields(b, type, builds) {
  const list = { building_make: ["ITEM", "makes"], building_build: ["BLUEPRINT", "builds"] }[b.type];
  const first = list && choicesFor(list[1], { type, builds })[0];
  return first ? { ...b, fields: { [list[0]]: first[1] } } : b;
}

// The name a toolbox block's unlock goes by.
export const unlockName = (b) => (b.type === "controls_if" && b.extraState?.hasElse ? "controls_if_else" : b.type);

// The toolbox for a program run by robots or buildings of `types`: the blocks
// every one of them can use, in categories; a category with none left out.
// `builds` is what the construction sites running it build, if they do;
// `blocks`, when given, the unlocks a mission allows (unlockName).
// A category filled as it's opened has `custom`, the name of what fills it
// (DYNAMIC), and `offers`, the unlocks it may offer; no contents.
export function toolboxFor(types, { builds = null, blocks = null } = {}) {
  const allowed = blocks && new Set(blocks);
  const usable = (b) => types.every((type) => USE[b.type]?.(type) ?? true) && (!allowed || allowed.has(unlockName(b)));
  return {
    kind: "categoryToolbox",
    contents: GAME.map(([name, style, blocks]) => {
      if (typeof blocks === "string") {
        const offers = DYNAMIC[blocks].filter((unlock) => !allowed || allowed.has(unlock));
        return offers.length ? { kind: "category", name: `%{BKY_${name}}`, categorystyle: `${style}_category`, custom: blocks, offers } : null;
      }
      const offered = category(name, style, blocks.filter(usable).map((b) => (types.length === 1 ? startingFields(b, types[0], builds) : b)));
      return offered.contents.length ? offered : null;
    }).filter(Boolean),
  };
}
