import { SHADOWS } from "../blockly/blocks.js";

// Writing programs by hand, as Blockly's JSON serialization (PLAN.md §7): the
// island's starter programs, the editor lab's sample, and test programs. What
// these build is what Blockly saves, so Blockly loads it as it is, and the
// compiler reads it like any other.

// Block `type` with id `id`; `extra` holds its fields, inputs, extraState, and a
// top block's x and y.
export const block = (type, id, extra = {}) => ({ type, id, ...extra });

// `blocks` joined top to bottom, each the next of the one before. Returns the
// first.
export function chain(...blocks) {
  for (let i = blocks.length - 1; i > 0; i--) blocks[i - 1].next = { block: blocks[i] };
  return blocks[0];
}

// An input holding `blocks`: a statement input's blocks, or a value input's one.
export const input = (...blocks) => ({ block: chain(...blocks) });

// A number input with the number in a shadow block, as a toolbox gives it.
export const number = (n, id) => ({ shadow: { type: "math_number", id, fields: { NUM: n } } });

// The choice each shadow's dropdown starts at, as Blockly gives it: its first.
const FIRST = { value_place: "grove", value_raw: "wood", value_item: "plank" };

// Robot action `type` (go to, collect, pick up) with id `id`, its input
// holding `value`: a place or an item, in the shadow block the toolbox gives
// it, whose id is `id` and the input's name (`${id}-place`, `${id}-item`); or a
// block, such as a setting, over that shadow, which then holds `under`, the
// first choice unless said.
export function act(type, id, value, { under = null, ...extra } = {}) {
  const { input: name, type: shadowType, field } = SHADOWS[type];
  const shadow = (v) => ({ type: shadowType, id: `${id}-${name.toLowerCase()}`, fields: { [field]: v ?? FIRST[shadowType] } });
  const inputs = typeof value === "string" ? { [name]: { shadow: shadow(value) } } : { [name]: { shadow: shadow(under), block: value } };
  return block(type, id, { inputs, ...extra });
}

// Setting block `slot` (source, item, destination) with id `id`: “my source”…
export const mine = (id, slot) => block(`setting_${slot}`, id);

// A workspace of `stacks`, each a chain's first block.
export const workspace = (...stacks) => ({ blocks: { languageVersion: 0, blocks: stacks } });

// --- Memory, routines and messages (PLAN.md §7, Phase 8) ---------------------
//
// Variables are the workspace's, as Blockly lists them, and a block names one
// by its id; a name the game gives is a message reference, worded when the
// program is given out (src/programming/programs.js, wordStarter).

// Workspace `ws` with `variables`, [{ id, name }], Blockly's list of them.
export const withVariables = (ws, variables) => (variables.length ? { ...ws, variables: variables.map(({ id, name }) => ({ name, id })) } : ws);

// Set variable `v` ({ id }) to `value`, a block or a number.
export const setVar = (id, v, value) => block("variables_set", id, { fields: { VAR: { id: v.id } }, inputs: { VALUE: typeof value === "number" ? number(value, `${id}-n`) : input(value) } });
// Change variable `v` by `by`, a block or a number.
export const changeVar = (id, v, by) => block("math_change", id, { fields: { VAR: { id: v.id } }, inputs: { DELTA: typeof by === "number" ? number(by, `${id}-n`) : input(by) } });
// What variable `v` holds; or, inside a routine, what its input `v` was given.
export const getVar = (id, v) => block("variables_get", id, { fields: { VAR: { id: v.id } } });

// A routine's definition (Blockly's procedures_defnoreturn): its `name`, its
// one input `param` ({ id, name }, a variable) or null, and its blocks.
export const routine = (id, name, param, ...blocks) =>
  block("procedures_defnoreturn", id, {
    fields: { NAME: name },
    ...(param && { extraState: { params: [{ name: param.name, id: param.id }] } }),
    ...(blocks.length && { inputs: { STACK: input(...blocks) } }),
  });
// A use of routine `name`, whose input `param` (or null) is given `arg`: an
// input, as input() or number() make it, or null for a gap.
export const call = (id, name, param = null, arg = null) =>
  block("procedures_callnoreturn", id, { extraState: { name, ...(param && { params: [param.name] }) }, ...(arg && { inputs: { ARG0: arg } }) });

// Send message `message` to robot or building `to`; wait for message `message`.
export const send = (id, message, to) => block("message_send", id, { fields: { MESSAGE: message, TO: to } });
export const waitFor = (id, message) => block("message_wait", id, { fields: { MESSAGE: message } });
