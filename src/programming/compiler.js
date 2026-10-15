import { BLOCKS } from "../blockly/blocks.js";
import { reason } from "../sim/codes.js";
import { TYPES } from "../sim/entities.js";
import { readWorkspace } from "./adapter.js";

// The compiler (PLAN.md §7): a program's Blockly workspace, as JSON, to the game's
// instructions. The game never runs generated JavaScript; the runtime
// (runtime.js) steps through these instructions with a program counter. Every
// instruction a child can see happen keeps the id of the block it came from, so
// the debugger can mark it.
//
// A compiled program is plain data, kept in the world (world.programs):
//
//   { compiler, start, code: [instruction, …], needs: [capability, …] }
//
// `start` is the When Started block's id; `needs` what the program asks of the
// robot or building that runs it (entities.js, `can`). The instructions:
//
//   { op: "act", block, intent }                       an action: go to, collect, make, wait N steps…
//   { op: "until", block, test }                       Wait Until: stays here while `test` is false
//   { op: "repeat", block, times, exit }               Repeat N: into the next instruction, or on to `exit`
//   { op: "forever", block }                           Forever: into the next instruction
//   { op: "if", block, branches: [{ test, to }], otherwise }   If / else if / else
//   { op: "jump", to }                                 the end of a loop's body or a branch
//   { op: "end" }                                      the program is over
//
// The first five are visible: each is one step a child sees, and takes a tick.
// Jumps and the end are bookkeeping, done on the way to the next visible one.
// Expressions, in a test or a count, are trees evaluated as part of their
// instruction (expressions.js):
//
//   { op: "number", block, value }                     a whole number
//   { op: "stock", block, item, at }                   how many of `item` thing `at` has
//   { op: "basket", block }                            how many items are in my basket
//   { op: "compare", block, cmp, a, b }                cmp: EQ NEQ LT LTE GT GTE, of two numbers
//
// What can't work as written is an error, a code with the block's id and values
// (src/sim/codes.js), and there's no program; a stack that won't run is a
// warning. compile() finds every error it can, not just the first, so the editor
// can mark them all.

// Bumped whenever the same blocks compile to different instructions. A runtime's
// position is an index into its program's instructions, so a world saved by
// another compiler restarts its programs from their start (PLAN.md §10).
export const COMPILER_VERSION = 1;

export const LIMITS = {
  nesting: 10, // blocks inside blocks, such as a Repeat in an If in a Forever
  expression: 8, // values inside values, such as a sense in a comparison
  number: 99999, // the largest a typed number may be, either side of 0
};

const options = (type, field) =>
  BLOCKS.find((b) => b.type === type)
    .args0.find((a) => a.name === field)
    .options.map(([, value]) => value);
const fieldNumber = (type, field) => BLOCKS.find((b) => b.type === type).args0.find((a) => a.name === field);

// The robot and building actions: the intent each block asks for, from its
// fields. A field's value must be one its dropdown offers; a place can be any
// id, checked against the world when there is one (context.places).
const ACTIONS = {
  robot_go_to: (field, node) => ({ type: "goTo", target: field.place(node, "PLACE") }),
  robot_collect: (field, node) => ({ type: "collect", item: field.choice(node, "ITEM") }),
  robot_pick_up: (field, node) => ({ type: "pickUp", item: field.choice(node, "ITEM") }),
  robot_unload: () => ({ type: "unload" }),
  building_make: (field, node) => ({ type: "make", recipe: field.choice(node, "ITEM") }),
  building_build: (field, node) => ({ type: "make", recipe: field.choice(node, "BLUEPRINT") }),
  control_wait_steps: (field, node) => {
    const { min, max } = fieldNumber("control_wait_steps", "STEPS");
    return { type: "wait", steps: field.whole(node, node.fields.STEPS, min, max) };
  },
};

// Compiles `source`, a workspace's JSON. `context`, when given, is what the
// program will run on: `type`, a robot or building type (entities.js), whose
// abilities it's checked against, and `places`, the ids of the things on the
// island to check places against. Returns { program, errors, warnings }, with
// `program` null when there are errors.
export function compile(source, context = {}) {
  const { tree, problem } = readWorkspace(source);
  if (problem) return { program: null, errors: [problem], warnings: [] };

  const errors = [];
  const warnings = [];
  const code = [];
  const needs = new Set();
  const type = context.type ? TYPES[context.type] : null;
  const places = context.places ? new Set(context.places) : null;
  const fail = (what, values) => errors.push(reason(what, values));
  const emit = (instruction) => code.push(instruction) - 1;

  // What the program asks of its robot or building: `ability`, for `block`.
  const need = (ability, block) => {
    needs.add(ability);
    if (type && !type.can?.includes(ability)) fail("program.cannot", { block, action: ability });
  };

  // A block's fields, read and checked.
  const field = {
    choice(node, field) {
      const value = node.fields[field];
      if (options(node.type, field).includes(value)) return value;
      fail("program.unsupported", { block: node.id, type: node.type });
      return null;
    },
    place(node, field) {
      const value = node.fields[field];
      if (typeof value !== "string" || !/^[a-z][a-z0-9-]*$/.test(value)) {
        fail("program.unsupported", { block: node.id, type: node.type });
        return null;
      }
      if (places && !places.has(value)) fail("program.target", { block: node.id, target: value });
      return value;
    },
    whole(node, raw, min, max) {
      const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
      if (Number.isInteger(value) && value >= min && value <= max) return value;
      fail("program.whole", { block: node.id, min, max });
      return min;
    },
  };

  // --- Values --------------------------------------------------------------

  // The value in input `name` of `parent`, which must be of type `want`
  // ("number" or "boolean"), at expression depth `depth`.
  function value(parent, name, want, depth) {
    const [node] = parent.inputs[name] ?? [];
    if (!node) {
      fail("program.empty", { block: parent.id });
      return null;
    }
    if (depth > LIMITS.expression) {
      fail("program.tooDeep", { block: node.id, limit: LIMITS.expression });
      return null;
    }
    const compiled = expression(node, depth);
    if (!compiled) return null;
    if (compiled.type !== want) {
      fail(want === "number" ? "program.wantNumber" : "program.wantTest", { block: parent.id });
      return null;
    }
    return compiled.expr;
  }

  // { expr, type } for value block `node`, or null when it can't be compiled.
  function expression(node, depth) {
    const block = node.id;
    switch (node.type) {
      case "math_number":
        return { expr: { op: "number", block, value: field.whole(node, node.fields.NUM, -LIMITS.number, LIMITS.number) }, type: "number" };
      case "sense_stock": {
        const item = field.choice(node, "ITEM");
        const at = field.place(node, "PLACE");
        return { expr: { op: "stock", block, item, at }, type: "number" };
      }
      case "sense_basket":
        need("basket", block);
        return { expr: { op: "basket", block }, type: "number" };
      case "logic_compare": {
        const cmp = node.fields.OP;
        if (!["EQ", "NEQ", "LT", "LTE", "GT", "GTE"].includes(cmp)) {
          fail("program.unsupported", { block, type: node.type });
          return null;
        }
        const a = value(node, "A", "number", depth + 1);
        const b = value(node, "B", "number", depth + 1);
        return a && b ? { expr: { op: "compare", block, cmp, a, b }, type: "boolean" } : null;
      }
      default:
        fail("program.unsupported", { block, type: node.type });
        return null;
    }
  }

  // --- Statements ----------------------------------------------------------

  // The blocks of `chain`, one after another, `depth` blocks deep.
  function statements(chain, depth) {
    for (const node of chain) statement(node, depth);
  }

  function statement(node, depth) {
    const block = node.id;
    if (ACTIONS[node.type]) {
      const intent = ACTIONS[node.type](field, node);
      need(intent.type, block);
      const recipes = type?.can?.includes("make") ? type.recipes : null;
      if (recipes && intent.type === "make" && intent.recipe && !recipes.includes(intent.recipe)) fail("program.cannot", { block, action: "make" });
      emit({ op: "act", block, intent });
      return;
    }
    const body = (name) => {
      if (depth + 1 > LIMITS.nesting) {
        if (node.inputs[name]?.length) fail("program.tooDeep", { block: node.inputs[name][0].id, limit: LIMITS.nesting });
      } else statements(node.inputs[name] ?? [], depth + 1);
    };
    switch (node.type) {
      case "control_wait_until":
        emit({ op: "until", block, test: value(node, "UNTIL", "boolean", 1) });
        return;
      case "control_forever": {
        const at = emit({ op: "forever", block });
        body("DO");
        emit({ op: "jump", to: at });
        return;
      }
      case "controls_repeat_ext": {
        const at = emit({ op: "repeat", block, times: value(node, "TIMES", "number", 1), exit: -1 });
        body("DO");
        emit({ op: "jump", to: at });
        code[at].exit = code.length;
        return;
      }
      case "controls_if": {
        const elseIfs = Number.isInteger(node.extra?.elseIfCount) && node.extra.elseIfCount > 0 ? node.extra.elseIfCount : 0;
        const at = emit({ op: "if", block, branches: [], otherwise: -1 });
        const ends = [];
        for (let i = 0; i <= elseIfs; i++) {
          code[at].branches.push({ test: value(node, `IF${i}`, "boolean", 1), to: code.length });
          body(`DO${i}`);
          ends.push(emit({ op: "jump", to: -1 }));
        }
        code[at].otherwise = code.length;
        if (node.extra?.hasElse) body("ELSE");
        for (const end of ends) code[end].to = code.length;
        return;
      }
      default:
        fail("program.unsupported", { block, type: node.type });
    }
  }

  // --- The program ---------------------------------------------------------

  const isStart = (stack) => stack[0].type === "island_when_started";
  const starts = tree.stacks.filter(isStart);
  for (const stack of tree.stacks) if (!isStart(stack)) warnings.push(reason("program.unused", { block: stack[0].id }));
  for (const extra of starts.slice(1)) fail("program.twoStarts", { block: extra[0].id });
  if (!starts.length) fail("program.noStart");
  else {
    statements(starts[0].slice(1), 0);
    emit({ op: "end" });
  }

  if (errors.length) return { program: null, errors, warnings };
  return { program: { compiler: COMPILER_VERSION, start: starts[0][0].id, code, needs: [...needs].sort() }, errors, warnings };
}
