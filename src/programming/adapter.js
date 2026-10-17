import { reason } from "../sim/codes.js";

// From Blockly to the compiler (PLAN.md §7): Blockly's JSON serialization of a
// workspace, read into a normalized program tree. It reads the JSON, never live
// Blockly objects, so programs compile in Node and in tests without Blockly. The
// JSON already has everything: each block's id, type, fields, inputs, the next
// block, and a mutator's extraState.
//
// The tree is plain data:
//
//   { stacks: [[node, …], …], count, variables: [{ id, name }, …] }
//   node = { id, type, fields: { NAME: value }, inputs: { NAME: [node, …] }, extra, shadow }
//
// `variables` are the workspace's, as Blockly lists them: a variable field
// holds { id }, and the adapter adds its `name` from this list, so the
// compiler and the words for a block (src/ui/chips.js) have it. A routine's
// inputs are variables too (Blockly's procedure blocks).
//
// A stack is a chain of blocks joined top to bottom, in the order Blockly saved
// the workspace's top blocks. Every input is a chain too: a statement input's
// blocks one after another, a value input's one block, an empty input none.
// Blockly doesn't say which input is which kind; the compiler knows from each
// block's type. A shadow block (the number in a new Repeat) stands in for a
// missing block, as in Blockly. Disabled blocks are left out, with whatever is
// inside them, as Blockly's own code generators leave them out: the block after
// one still follows on.

// The most blocks a program may have. Children's programs have dozens; this
// keeps a pasted or imported one from tying the game up.
export const MAX_BLOCKS = 400;

class Unreadable extends Error {
  constructor(problem) {
    super(problem.code);
    this.problem = problem;
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// A name the program holds: the player's words, or a message reference the
// game wrote in a starter ({ key, params? }), which the game words as it gives
// the starter out (src/programming/programs.js, wordStarter). Run unworded, in
// the tests and verify:missions, a reference stands for itself, by its key.
// Returns null for anything else.
export function nameText(value) {
  if (typeof value === "string") return value;
  if (isObject(value) && typeof value.key === "string" && !("id" in value)) return value.params ? `${value.key} ${JSON.stringify(value.params)}` : value.key;
  return null;
}
const isDisabled = (json) => (Array.isArray(json.disabledReasons) && json.disabledReasons.length > 0) || json.enabled === false;

// Field values are strings, numbers or booleans; a variable field's is an object
// ({ id }), copied as it is.
function readField(value) {
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (isObject(value)) return JSON.parse(JSON.stringify(value));
  throw new Unreadable(reason("program.unreadable"));
}

// Reads `json`, the result of Blockly.serialization.workspaces.save(). Returns
// { tree } or { problem }: program.unreadable for what isn't a workspace's JSON,
// program.tooBig for one with more than MAX_BLOCKS blocks.
export function readWorkspace(json) {
  if (!isObject(json)) return { problem: reason("program.unreadable") };
  const top = json.blocks?.blocks ?? [];
  if (!Array.isArray(top)) return { problem: reason("program.unreadable") };
  const listed = json.variables ?? [];
  if (!Array.isArray(listed) || !listed.every((v) => isObject(v) && typeof v.id === "string" && v.id && nameText(v.name) !== null)) return { problem: reason("program.unreadable") };
  const variables = listed.map(({ id, name }) => ({ id, name: nameText(name) }));
  const names = new Map(variables.map((v) => [v.id, v.name]));

  const ids = new Set();
  let count = 0;

  function readBlock(b, shadow) {
    if (!isObject(b) || typeof b.type !== "string" || !b.type || typeof b.id !== "string" || !b.id) throw new Unreadable(reason("program.unreadable"));
    if (ids.has(b.id)) throw new Unreadable(reason("program.unreadable"));
    ids.add(b.id);
    if (++count > MAX_BLOCKS) throw new Unreadable(reason("program.tooBig", { limit: MAX_BLOCKS }));
    if (b.fields !== undefined && !isObject(b.fields)) throw new Unreadable(reason("program.unreadable"));
    if (b.inputs !== undefined && !isObject(b.inputs)) throw new Unreadable(reason("program.unreadable"));
    const fields = {};
    for (const [name, value] of Object.entries(b.fields ?? {})) {
      fields[name] = readField(value);
      if (isObject(fields[name]) && typeof fields[name].id === "string" && names.has(fields[name].id)) fields[name].name = names.get(fields[name].id);
    }
    const inputs = {};
    for (const [name, input] of Object.entries(b.inputs ?? {})) {
      if (!isObject(input)) throw new Unreadable(reason("program.unreadable"));
      // A block in an input covers its shadow, even when it's disabled.
      inputs[name] = input.block ? readChain(input.block, false) : input.shadow ? readChain(input.shadow, true) : [];
    }
    const extra = b.extraState === undefined ? null : JSON.parse(JSON.stringify(b.extraState));
    return { id: b.id, type: b.type, fields, inputs, extra, shadow };
  }

  // The blocks from `first` down, following `next`, in a loop rather than
  // calling itself, so a long stack can't run out of stack.
  function readChain(first, shadow) {
    const chain = [];
    for (let b = first; b; b = b.next?.block) {
      if (!isObject(b) || (b.next !== undefined && !isObject(b.next))) throw new Unreadable(reason("program.unreadable"));
      const node = readBlock(b, shadow);
      if (!isDisabled(b)) chain.push(node);
    }
    return chain;
  }

  try {
    const stacks = top.map((b) => readChain(b, false)).filter((stack) => stack.length);
    return { tree: { stacks, count, variables } };
  } catch (e) {
    if (e instanceof Unreadable) return { problem: e.problem };
    throw e;
  }
}

// Every block in `tree` by its id, inner blocks included.
export function blockIndex(tree) {
  const index = new Map();
  const visit = (chain) => {
    for (const node of chain) {
      index.set(node.id, node);
      for (const inner of Object.values(node.inputs)) visit(inner);
    }
  };
  for (const stack of tree.stacks) visit(stack);
  return index;
}
