import { TYPES } from "../sim/entities.js";
import { RECIPES } from "../sim/recipes.js";
import { BLOCKS, SETTING_BLOCKS, SHADOWS } from "./blocks.js";
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
    category("CAT_ROBOT", "robot", [block("robot_go_to"), block("robot_pick_up"), block("robot_unload")]),
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
  robot_pick_up: (type) => can(type, "pickUp"),
  robot_unload: (type) => can(type, "unload"),
  robot_supply: (type) => can(type, "supply"),
  supply_from: (type) => can(type, "supply"),
  robot_advance: (type) => can(type, "advance"),
  robot_guard: (type) => can(type, "guard"),
  robot_repair: (type) => can(type, "repair"),
  building_make: (type) => can(type, "make") && recipes(type).some((r) => !RECIPES[r].builds && !RECIPES[r].assembles),
  building_build: (type) => can(type, "make") && recipes(type).some((r) => RECIPES[r].builds),
  building_assemble: (type) => can(type, "make") && recipes(type).some((r) => RECIPES[r].assembles),
  control_wait_steps: (type) => can(type, "wait"),
  sense_basket: (type) => can(type, "basket"),
  sense_low: (type) => can(type, "shield"),
  sense_danger: (type) => can(type, "shield"),
  sense_ready: (type) => can(type, "make") && recipes(type).some((r) => !RECIPES[r].builds && !RECIPES[r].assembles),
  ...Object.fromEntries(Object.keys(SETTING_BLOCKS).map((b) => [b, (type) => can(type, "settings")])),
};

const GAME = [
  ["CAT_START", "entry", [block("island_when_started")]],
  [
    "CAT_ROBOT",
    "robot",
    [
      block("robot_go_to"),
      block("robot_pick_up"),
      block("robot_unload"),
      block("robot_supply", { inputs: { FROM: { block: { type: "supply_from" } } } }),
      block("supply_from"),
      block("robot_advance"),
      block("robot_guard"),
      block("robot_repair"),
    ],
  ],
  ["CAT_BUILDING", "building", [block("building_make"), block("building_build"), block("building_assemble")]],
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
  ["CAT_SENSING", "sensing", [block("sense_stock"), block("sense_basket"), block("sense_needs"), block("sense_space"), block("sense_ready"), block("sense_low"), block("sense_danger")]],
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

// What a toolbox block's dropdowns of choices (choices.js) start at, and the
// blocks and shadows in its inputs': the first thing each offers here. A Make
// or Build is at the first thing the building makes or builds (of `builds`,
// the blueprints of the sites that run the program, when given), and a new
// robot at the kind it makes, for one `type`; a place, an item or a team at
// the first `world` has, when it's known: “supply” at a building, not at the
// grove.
const BY_TYPE = new Set(["makes", "builds", "robots"]);
function startingFields(b, { type, builds, world }) {
  const def = BLOCKS.find((d) => d.type === b.type);
  const fields = { ...b.fields };
  for (const arg of [...(def?.args0 ?? []), ...(def?.args1 ?? [])]) {
    if (arg.type !== "field_choice" || arg.name in fields) continue;
    if (BY_TYPE.has(arg.choices) ? !type : !world) continue;
    const first = choicesFor(arg.choices, { type, builds, world })[0];
    if (first) fields[arg.name] = first[1];
  }
  const inputs = Object.fromEntries(
    Object.entries(b.inputs ?? {}).map(([name, input]) => [
      name,
      Object.fromEntries(Object.entries(input).map(([part, inner]) => [part, ["block", "shadow"].includes(part) ? startingFields(inner, { type, builds, world }) : inner])),
    ]),
  );
  return { ...b, ...(Object.keys(fields).length && { fields }), ...(b.inputs && { inputs }) };
}

// The name a toolbox block's unlock goes by.
export const unlockName = (b) => (b.type === "controls_if" && b.extraState?.hasElse ? "controls_if_else" : b.type);

// The toolbox for a program run by robots or buildings of `types`: the blocks
// every one of them can use, in categories; a category with none left out.
// `builds` is what the construction sites running it build, if they do;
// `blocks`, when given, the unlocks a mission allows (unlockName); `world`,
// when given, the island it runs on, whose places, items and teams the
// dropdowns start at.
// A category filled as it's opened has `custom`, the name of what fills it
// (DYNAMIC), and `offers`, the unlocks it may offer; no contents.
export function toolboxFor(types, { builds = null, blocks = null, world = null } = {}) {
  const allowed = blocks && new Set(blocks);
  const usable = (b) => types.every((type) => USE[b.type]?.(type) ?? true) && (!allowed || allowed.has(unlockName(b)));
  return {
    kind: "categoryToolbox",
    contents: GAME.map(([name, style, blocks]) => {
      if (typeof blocks === "string") {
        const offers = DYNAMIC[blocks].filter((unlock) => !allowed || allowed.has(unlock));
        return offers.length ? { kind: "category", name: `%{BKY_${name}}`, categorystyle: `${style}_category`, custom: blocks, offers } : null;
      }
      const context = { type: types.length === 1 ? types[0] : null, builds, world };
      const offered = category(name, style, blocks.filter(usable).map((b) => startingFields(b, context)));
      return offered.contents.length ? offered : null;
    }).filter(Boolean),
  };
}
