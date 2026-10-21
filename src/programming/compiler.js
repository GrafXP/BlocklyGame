import { BLOCKS, SETTING_BLOCKS } from "../blockly/blocks.js";
import { reason } from "../sim/codes.js";
import { TYPES } from "../sim/entities.js";
import { nameText, readWorkspace } from "./adapter.js";

// The compiler (PLAN.md §7): a program's Blockly workspace, as JSON, to the game's
// instructions. The game never runs generated JavaScript; the runtime
// (runtime.js) steps through these instructions with a program counter. Every
// instruction a child can see happen keeps the id of the block it came from, so
// the debugger can mark it.
//
// A compiled program is plain data, kept in the world (world.programs):
//
//   { compiler, start, code: [instruction, …], needs: [capability, …], variables? }
//
// `start` is the When Started block's id; `needs` what the program asks of the
// robot or building that runs it (entities.js, `can`); `variables`, when it
// has any, its variables, [{ id, name }], for the debugger to show their
// values. The instructions:
//
//   { op: "act", block, intent, args? }                an action: go to, pick up, make, send…
//   { op: "until", block, test }                       Wait Until: stays here while `test` is false
//   { op: "repeat", block, times, exit }               Repeat N: into the next instruction, or on to `exit`
//   { op: "forever", block }                           Forever: into the next instruction
//   { op: "if", block, branches: [{ test, to }], otherwise }   If / else if / else
//   { op: "set", block, var, value }                   Set: the variable `var` is `value` from now on
//   { op: "change", block, var, by }                   Change: `var` goes up by `by` (down, when it's less than 0)
//   { op: "call", block, to, routine, args: [{ param, value }] }
//                                                      a block of the player's own (a routine): into
//                                                      its instructions at `to`, and back after it
//   { op: "receive", block, message }                  Wait For: takes message `message` from the inbox,
//                                                      or stays here until there is one
//   { op: "jump", to }                                 the end of a loop's body or a branch
//   { op: "return" }                                   the end of a routine: back to after its call
//   { op: "end" }                                      the program is over
//
// The first nine are visible: each is one step a child sees, and takes a tick.
// Jumps, returns and the end are bookkeeping, done on the way to the next
// visible one. The program's own instructions come first, ending at its end;
// each routine's follow, ending at its return.
//
// An action's place or item that the blocks give outright is in its `intent`,
// { type: "goTo", target: "grove" }; one worked out as the action's block runs,
// such as a robot's setting, is an expression in `args`, by the intent's field:
// { target: { op: "setting", … } }. Expressions, in a test, a count or an
// action's input, are trees evaluated as part of their instruction
// (expressions.js):
//
//   { op: "number", block, value }                     a whole number
//   { op: "stock", block, item, at }                   how many of `item` thing `at` has
//   { op: "basket", block }                            how many items are in my basket
//   { op: "compare", block, cmp, a, b }                cmp: EQ NEQ LT LTE GT GTE, of two numbers
//   { op: "place", block, value }                      a place: a thing's id
//   { op: "item", block, value }                       an item
//   { op: "setting", block, slot }                     my setting `slot` (src/sim/entities.js)
//   { op: "var", block, var }                          what variable `var` holds: a number, 0 until set
//   { op: "arg", block, param }                        what this use of the routine gave its input `param`
//
// Each has a type: "number", "boolean", "place" or "item".
//
// Variables (PLAN.md §7, memory) hold whole numbers. Each robot or building
// running the program has its own (runtime.js), so robots sharing a program
// count apart; they start at 0 whenever the program does.
//
// A routine is a block the player makes, Blockly's “procedure”: a definition
// with a name and at most one input, and blocks that use it by its name. Its
// input is a place, a number or an item, whichever its definition uses it as;
// each use gives it one. A routine never uses itself, through others or
// directly: there's no recursion (PLAN.md §7).
//
// What can't work as written is an error, a code with the block's id and values
// (src/sim/codes.js), and there's no program; a stack that won't run is a
// warning. compile() finds every error it can, not just the first, so the editor
// can mark them all.

// Bumped whenever the same blocks compile to different instructions. A runtime's
// position is an index into its program's instructions, so a world saved by
// another compiler restarts its programs from their start (PLAN.md §10).
// 2: actions take their place or item from an input, which a setting can fill.
// (Variables, routines and messages are new blocks: the blocks before them
// compile as they did.)
export const COMPILER_VERSION = 2;

export const LIMITS = {
  nesting: 10, // blocks inside blocks, such as a Repeat in an If in a Forever
  expression: 8, // values inside values, such as a sense in a comparison
  number: 99999, // the largest a typed number may be, either side of 0, and a variable
  inputs: 1, // inputs a routine may have
  calls: 8, // routines inside routines: a use of one in another's, and so on
};

const options = (type, field) =>
  BLOCKS.find((b) => b.type === type)
    .args0.find((a) => a.name === field)
    .options.map(([, value]) => value);
const fieldNumber = (type, field) => BLOCKS.find((b) => b.type === type).args0.find((a) => a.name === field);

// The robot and building actions: the intent each block asks for, from its
// fields and inputs. A field's value must be one its dropdown offers; a place
// can be any id, checked against the world when there is one (context.places).
// An input gives an expression (`input`), put into the intent or its args below.
const ACTIONS = {
  robot_go_to: ({ input }, node) => ({ type: "goTo", target: input(node, "PLACE", "place") }),
  robot_pick_up: ({ input }, node) => ({ type: "pickUp", item: input(node, "ITEM", "item") }),
  robot_unload: () => ({ type: "unload" }),
  building_make: ({ field }, node) => ({ type: "make", recipe: field.choice(node, "ITEM") }),
  building_build: ({ field }, node) => ({ type: "make", recipe: field.choice(node, "BLUEPRINT") }),
  control_wait_steps: ({ field }, node) => {
    const { min, max } = fieldNumber("control_wait_steps", "STEPS");
    return { type: "wait", steps: field.whole(node, node.fields.STEPS, min, max) };
  },
  message_send: ({ field }, node) => ({ type: "send", message: field.choice(node, "MESSAGE"), to: field.place(node, "TO") }),
};

// Expressions whose value is known as the program is compiled.
const CONSTANT = new Set(["place", "item"]);
const WANT = { number: "program.wantNumber", boolean: "program.wantTest", place: "program.wantPlace", item: "program.wantItem" };

// A routine's name as Blockly matches a use to its definition: whatever the
// letters' case.
const nameKey = (name) => name.toLowerCase();

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
  const used = new Set(); // the ids of the variables the program uses
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

  // --- Routines ------------------------------------------------------------
  //
  // Each definition: { name, key, block, body, params: [{ id, name, type }],
  // at, calls }, `type` what its input is used as, found as its blocks are
  // compiled (null while it isn't used), `at` where its instructions begin,
  // `calls` the routines its blocks use, by key.

  const isStart = (stack) => stack[0].type === "island_when_started";
  const isRoutine = (stack) => stack[0].type === "procedures_defnoreturn";
  const routines = new Map();
  for (const [def] of tree.stacks.filter(isRoutine)) {
    const name = nameText(def.fields.NAME)?.trim() ?? "";
    const params = Array.isArray(def.extra?.params) ? def.extra.params : [];
    if (!name || !params.every((p) => typeof p?.id === "string" && p.id && nameText(p.name) !== null)) {
      fail("program.unsupported", { block: def.id, type: def.type });
      continue;
    }
    if (routines.has(nameKey(name))) {
      fail("program.twoRoutines", { block: def.id, name });
      continue;
    }
    if (params.length > LIMITS.inputs) fail("program.inputs", { block: def.id, limit: LIMITS.inputs });
    routines.set(nameKey(name), { name, key: nameKey(name), block: def.id, body: def.inputs.STACK ?? [], params: params.map((p) => ({ id: p.id, name: nameText(p.name), type: null })), at: -1, calls: new Set() });
  }
  let scope = null; // the routine whose blocks are being compiled, or null for the program's own
  const calls = []; // [{ at, routine }]: each call's instruction, to point at its routine
  const passes = []; // [{ block, routine, i, type, from }]: each input given, to check once types are known

  // The variable variable block `node` names: { id, param } with `param` the
  // input of the routine being compiled it is, or null.
  function variableOf(node) {
    const v = node.fields.VAR;
    if (!v || typeof v.id !== "string" || !v.id) {
      fail("program.unsupported", { block: node.id, type: node.type });
      return null;
    }
    return { id: v.id, param: scope?.params.find((p) => p.id === v.id) ?? null };
  }

  // --- Values --------------------------------------------------------------

  // The value in input `name` of `parent`, which must be of type `want`
  // ("number", "boolean", "place" or "item"), at expression depth `depth`.
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
    // A routine's input not used before is what its first use here wants.
    if (compiled.type === null && compiled.param) compiled.param.type = compiled.type = want;
    if (compiled.type !== want) {
      fail(WANT[want], { block: parent.id });
      return null;
    }
    return compiled.expr;
  }

  // { expr, type, param? } for value block `node`, or null when it can't be
  // compiled. A routine's input has `param`, and type null until it's used.
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
      case "value_place":
        return { expr: { op: "place", block, value: field.place(node, "PLACE") }, type: "place" };
      case "value_item":
        return { expr: { op: "item", block, value: field.choice(node, "ITEM") }, type: "item" };
      case "setting_source":
      case "setting_item":
      case "setting_destination": {
        const { slot, output } = SETTING_BLOCKS[node.type];
        need("settings", block);
        return { expr: { op: "setting", block, slot }, type: output.toLowerCase() };
      }
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
      case "variables_get": {
        const v = variableOf(node);
        if (!v) return null;
        if (v.param) return { expr: { op: "arg", block, param: v.id }, type: v.param.type, param: v.param };
        used.add(v.id);
        return { expr: { op: "var", block, var: v.id }, type: "number" };
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
      const input = (parent, name, want) => value(parent, name, want, 1);
      const asked = ACTIONS[node.type]({ field, input }, node);
      need(asked.type, block);
      const recipes = type?.can?.includes("make") ? type.recipes : null;
      if (recipes && asked.type === "make" && asked.recipe && !recipes.includes(asked.recipe)) fail("program.cannot", { block, action: "make" });
      // Values known now go into the intent; the rest are worked out as the
      // block runs.
      const intent = {};
      const args = {};
      for (const [key, v] of Object.entries(asked)) {
        if (v === null || typeof v !== "object") intent[key] = v;
        else if (CONSTANT.has(v.op)) intent[key] = v.value;
        else args[key] = v;
      }
      emit({ op: "act", block, intent, ...(Object.keys(args).length && { args }) });
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
      case "variables_set":
      case "math_change": {
        const v = variableOf(node);
        if (!v) return;
        if (v.param) {
          fail("program.setInput", { block });
          return;
        }
        used.add(v.id);
        if (node.type === "variables_set") emit({ op: "set", block, var: v.id, value: value(node, "VALUE", "number", 1) });
        else emit({ op: "change", block, var: v.id, by: value(node, "DELTA", "number", 1) });
        return;
      }
      case "procedures_callnoreturn": {
        const name = nameText(node.extra?.name) ?? "";
        const routine = routines.get(nameKey(name));
        if (!routine) {
          fail("program.noRoutine", { block, name });
          return;
        }
        scope?.calls.add(routine.key);
        if (!scope) mainCalls.add(routine.key);
        const args = routine.params.map((param, i) => {
          const [arg] = node.inputs[`ARG${i}`] ?? [];
          if (!arg) {
            fail("program.empty", { block });
            return null;
          }
          const compiled = expression(arg, 1);
          if (!compiled) return null;
          passes.push({ block, routine, i, type: compiled.type, from: compiled.param ?? null });
          return { param: param.id, value: compiled.expr };
        });
        calls.push({ at: emit({ op: "call", block, to: -1, routine: routine.block, args }), routine });
        return;
      }
      case "message_wait":
        emit({ op: "receive", block, message: field.choice(node, "MESSAGE") });
        return;
      default:
        fail("program.unsupported", { block, type: node.type });
    }
  }

  // --- The program ---------------------------------------------------------

  const mainCalls = new Set();
  const starts = tree.stacks.filter(isStart);
  for (const stack of tree.stacks) if (!isStart(stack) && !isRoutine(stack)) warnings.push(reason("program.unused", { block: stack[0].id }));
  for (const extra of starts.slice(1)) fail("program.twoStarts", { block: extra[0].id });
  if (!starts.length) fail("program.noStart");
  else {
    statements(starts[0].slice(1), 0);
    emit({ op: "end" });
  }
  for (const routine of routines.values()) {
    scope = routine;
    routine.at = code.length;
    statements(routine.body, 0);
    emit({ op: "return" });
  }
  scope = null;
  for (const { at, routine } of calls) code[at].to = routine.at;

  // What each use gives its routine's input must be what the routine uses it
  // as. An input given on from another routine's input takes its type.
  for (const pass of passes) {
    const param = pass.routine.params[pass.i];
    if (pass.from && pass.from.type === null) pass.from.type = param.type;
    const given = pass.from ? pass.from.type : pass.type;
    if (param.type && given && given !== param.type) fail(WANT[param.type], { block: pass.block });
  }

  // No routine may use itself, and uses inside uses go LIMITS.calls deep at
  // most.
  const depth = new Map(); // key → how deep its uses go, once known
  const visiting = new Set();
  function deepest(routine) {
    if (depth.has(routine.key)) return depth.get(routine.key);
    if (visiting.has(routine.key)) {
      fail("program.recursive", { block: routine.block, name: routine.name });
      depth.set(routine.key, 0);
      return 0;
    }
    visiting.add(routine.key);
    let most = 0;
    for (const key of routine.calls) most = Math.max(most, deepest(routines.get(key)));
    visiting.delete(routine.key);
    depth.set(routine.key, most + 1);
    return most + 1;
  }
  for (const routine of routines.values()) deepest(routine);
  for (const key of mainCalls) {
    const routine = routines.get(key);
    if (deepest(routine) > LIMITS.calls) fail("program.tooDeep", { block: routine.block, limit: LIMITS.calls });
  }

  if (errors.length) return { program: null, errors, warnings };
  const variables = tree.variables.filter((v) => used.has(v.id));
  for (const id of used) if (!variables.some((v) => v.id === id)) variables.push({ id, name: id });
  return {
    program: { compiler: COMPILER_VERSION, start: starts[0][0].id, code, needs: [...needs].sort(), ...(variables.length && { variables }) },
    errors,
    warnings,
  };
}
