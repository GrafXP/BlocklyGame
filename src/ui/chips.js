import { BLOCKS } from "../blockly/blocks.js";
import { BLOCK_STYLES, TREATMENTS } from "../blockly/treatments.js";
import { display, formatNumber } from "../i18n/index.js";
import { nameText } from "../programming/adapter.js";
import { esc } from "./dom.js";

// A block as a DOM chip, outside Blockly (PLAN.md §8): its colour, its picture
// and its words, so a list of every robot and building can show which block
// each is at without drawing a workspace. The words are the block's own, from
// the messages Blockly words blocks with in the player's language
// (i18n blocklyMessages(): Blockly's catalogue, the game's overrides, and the
// game's blocks), so a chip reads as the block does in the editor. Blockly
// itself isn't needed.

// The first line of each of Blockly's own blocks the game uses, as Blockly
// defines them (blockly/blocks), without the marks for right-to-left scripts.
const BUILT_IN = [
  { type: "controls_repeat_ext", message0: "%{BKY_CONTROLS_REPEAT_TITLE}", args0: [{ type: "input_value", name: "TIMES" }], style: "loop_blocks" },
  { type: "controls_if", message0: "%{BKY_CONTROLS_IF_MSG_IF} %1", args0: [{ type: "input_value", name: "IF0" }], style: "logic_blocks" },
  {
    type: "logic_compare",
    message0: "%1 %2 %3",
    args0: [
      { type: "input_value", name: "A" },
      {
        type: "field_dropdown",
        name: "OP",
        options: [
          ["=", "EQ"],
          ["≠", "NEQ"],
          ["<", "LT"],
          ["≤", "LTE"],
          [">", "GT"],
          ["≥", "GTE"],
        ],
      },
      { type: "input_value", name: "B" },
    ],
    style: "logic_blocks",
  },
  { type: "math_number", message0: "%1", args0: [{ type: "field_number", name: "NUM" }], style: "math_blocks" },
  // Memory: a variable's name is the player's, from the workspace's list
  // (src/programming/adapter.js puts it in the field).
  {
    type: "variables_set",
    message0: "%{BKY_VARIABLES_SET}",
    args0: [
      { type: "field_variable", name: "VAR" },
      { type: "input_value", name: "VALUE" },
    ],
    style: "variable_blocks",
  },
  {
    type: "math_change",
    message0: "%{BKY_MATH_CHANGE_TITLE}",
    args0: [
      { type: "field_variable", name: "VAR" },
      { type: "input_value", name: "DELTA" },
    ],
    style: "variable_blocks",
  },
  { type: "variables_get", message0: "%1", args0: [{ type: "field_variable", name: "VAR" }], style: "variable_blocks" },
  // Blocks of the player's own: the definition, “my block bring wood”, and a
  // use, “bring wood with: camp” (blockWords words these itself).
  { type: "procedures_defnoreturn", message0: "%{BKY_PROCEDURES_DEFNORETURN_TITLE} %1", args0: [{ type: "field_name", name: "NAME" }], style: "procedure_blocks" },
  { type: "procedures_callnoreturn", message0: "%1", args0: [{ type: "field_name", name: "NAME" }], style: "procedure_blocks" },
];
const DEFINITIONS = new Map([...BLOCKS, ...BUILT_IN].map((def) => [def.type, def]));

// A routine's name: the player's words, or a starter's message reference,
// worded (a starter's names are worded as it's given out, so only an unworded
// one, in the tests, gets here).
const routineName = (value) => (typeof value === "string" ? value : value?.key ? display(value) : (nameText(value) ?? ""));

// %{BKY_KEY} references in `text`, from `messages`.
const resolve = (text, messages) => text.replace(/%\{BKY_(\w+)\}/g, (all, key) => messages[key] ?? all);

// Block `node` (a normalized tree's, src/programming/adapter.js) in words: its
// first line, with dropdowns' labels, numbers, and the blocks in its inputs
// worded too; pictures and statement inputs left out. An empty input is "…",
// and a comparison inside a comparison is in brackets.
export function blockWords(node, messages) {
  const def = DEFINITIONS.get(node.type);
  if (!def) return node.type;
  const rows = [lineWords(node, def.message0, def.args0, messages)];
  // A second row of words, such as Send's “to Robo 2”; a statement input's
  // row has none.
  if (def.message1) rows.push(lineWords(node, def.message1, def.args1, messages));
  return rows.join(" ").replace(/\s+/g, " ").trim();
}

function lineWords(node, message, args, messages) {
  if (node.type === "procedures_callnoreturn") {
    const name = routineName(node.extra?.name) || "…";
    const arg = node.inputs.ARG0?.[0];
    return arg ? `${name} ${resolve("%{BKY_PROCEDURES_CALL_BEFORE_PARAMS}", messages)} ${blockWords(arg, messages)}` : name;
  }
  const text = resolve(message, messages).replace(/%(\d+)/g, (all, n) => {
    const arg = args[n - 1];
    const value = node.fields[arg?.name];
    switch (arg?.type) {
      case "field_dropdown":
      case "field_choice": {
        const option = arg.options.find(([, v]) => v === value);
        return option ? resolve(option[0], messages) : String(value ?? "");
      }
      case "field_number":
        return typeof value === "number" ? formatNumber(value) : String(value ?? "");
      case "field_variable":
        return value?.name ?? "…";
      case "field_name":
        return routineName(value) || "…";
      case "input_value": {
        const inner = node.inputs[arg.name]?.[0];
        if (!inner) return "…";
        const words = blockWords(inner, messages);
        return inner.type === "logic_compare" && node.type === "logic_compare" ? `(${words})` : words;
      }
      default:
        return "";
    }
  });
  return text.replace(/\s+/g, " ").trim();
}

// The colour a block has in the Calm treatment, the one recommended in Phase 0.
export function blockColour(type) {
  const family = BLOCK_STYLES[DEFINITIONS.get(type)?.style];
  return TREATMENTS.calm.colours[family]?.primary ?? "#d9dee5";
}

// The picture of a block of type `type`, a data URI, or null for one with none.
export const blockIcon = (type) => DEFINITIONS.get(type)?.args0.find((a) => a.type === "field_image")?.src ?? null;

// Block `node` as a chip's markup, with its picture when it has one, and a
// tooltip `title` if given.
export function blockChip(node, messages, { className = "", title = "" } = {}) {
  const def = DEFINITIONS.get(node.type);
  const image = def?.args0.find((a) => a.type === "field_image");
  return (
    `<span class="chip ${className}" style="--chip:${blockColour(node.type)}" data-block="${esc(node.id)}"${title ? ` title="${esc(title)}"` : ""}>` +
    (image ? `<img src="${image.src}" alt="" width="16" height="16">` : "") +
    `${esc(blockWords(node, messages))}</span>`
  );
}
