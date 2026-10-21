import { ACTIONS } from "../sim/actions.js";
import { reason } from "../sim/codes.js";
import { SETTINGS } from "../sim/entities.js";
import { MESSAGES, takeMessage } from "../sim/messages.js";
import { LIMITS } from "./compiler.js";
import { evaluate, Fault } from "./expressions.js";

// Running a compiled program (compiler.js) on one robot or building (PLAN.md §6,
// §7). Each entity has its own runtime, so robots sharing a program can be at
// different blocks with different loop counts. Its state is plain data on the
// entity, entity.runtime:
//
//   { kind: "program", program, revision, compiler, at, loops: [{ at, count, times }],
//     block, evaluated: { block, tick } | null, wait, ended, parked?, vars?, frames? }
//
// - `program` and `revision`: the compiled program it runs, in world.programs;
//   `compiler` the COMPILER_VERSION that compiled it.
// - `at`: the instruction it's at, an index into the program's code.
// - `loops`: the Repeat blocks it's inside, innermost last: which instruction,
//   how many rounds have begun, and how many there are.
// - `block`: the active block, the visible block it evaluated last, for as long
//   as that lasts: an action's block while the action runs or waits, a Wait
//   Until's while its condition is false. Null before the start and after the end.
// - `evaluated`: the visible block it evaluated last, and in which tick.
// - `wait`: why it's waiting at a Wait Until (wait.until), or null.
// - `ended`: whether the program is over.
// - `parked`: true for a program the entity has but hasn't started, such as a
//   robot waiting for its job. It takes no steps, and counts as stopped, until
//   it's assigned the program again: when the player applies the program, or a
//   mission gives the job as its reward. Its program can still be edited. A
//   runtime that isn't parked has no `parked`.
// - `vars`: what its variables hold, { [variable id]: number }, once one is set
//   or changed. A variable never set holds 0. They're this entity's own: robots
//   sharing a program each have theirs (PLAN.md §7, memory).
// - `frames`: the routines it's inside, innermost last, while it's inside one:
//   { call, back, routine, args }, the block that used it, where to go on after
//   it, its definition's block, and what the use gave its input, by the input's
//   id. Routines never use themselves, so these are at most LIMITS.calls deep.
// A start, or a start again, forgets the variables and routines: a program
// always starts from the same place (PLAN.md §11, Phase 8).
//
// The world calls it through the interface every runtime has (src/sim/runtimes.js).

// The most instructions a runtime may go through in one tick. Only one of them
// is visible, and compiled programs need a handful of jumps at most to reach it,
// so this is never reached by a program made of blocks; it keeps a damaged one
// from freezing the game.
export const MAX_OPS = 64;

export const programOf = (world, id) => world.programs.find((p) => p.id === id) ?? null;

// A runtime for `program`, an entry of world.programs, at its start; `parked`,
// not started.
export const startProgram = (program, { parked = false } = {}) => ({
  kind: "program",
  program: program.id,
  revision: program.revision,
  compiler: program.compiler,
  at: 0,
  loops: [],
  block: null,
  evaluated: null,
  wait: null,
  ended: false,
  ...(parked && { parked: true }),
});

// Each visible instruction, evaluated: what the tick's trace records of it,
// with the intent of an action. Each moves `at` on, or leaves it where it is.
const VISIBLE = {
  // The program stays at an action until it ends (done, below). What its
  // inputs work out, such as a setting, is part of the intent, as it is now.
  act(run, ins, entity, world) {
    const intent = { ...ins.intent };
    for (const [key, expr] of Object.entries(ins.args ?? {})) intent[key] = evaluate(expr, entity, world);
    return { intent };
  },

  // A false condition keeps the block active, to be tried again next tick; a
  // true one lets the next block run, next tick.
  until(run, ins, entity, world) {
    const test = evaluate(ins.test, entity, world);
    if (test) run.at++;
    else run.wait = reason("wait.until", { block: ins.block });
    return { test };
  },

  // Coming from above, the count is worked out once and a loop begins; coming
  // back from the end of the body, the next round begins, or the loop is over.
  repeat(run, ins, entity, world) {
    let loop = run.loops.at(-1);
    if (loop?.at !== run.at) {
      loop = { at: run.at, count: 0, times: evaluate(ins.times, entity, world) };
      run.loops.push(loop);
    }
    if (loop.count < loop.times) {
      loop.count++;
      run.at++;
      return { round: loop.count };
    }
    run.loops.pop();
    run.at = ins.exit;
    return { round: 0 };
  },

  forever(run) {
    run.at++;
    return {};
  },

  if(run, ins, entity, world) {
    const branch = ins.branches.findIndex((b) => evaluate(b.test, entity, world));
    run.at = branch >= 0 ? ins.branches[branch].to : ins.otherwise;
    return { branch };
  },

  set(run, ins, entity, world) {
    return remember(run, ins.var, evaluate(ins.value, entity, world));
  },

  change(run, ins, entity, world) {
    return remember(run, ins.var, (run.vars?.[ins.var] ?? 0) + evaluate(ins.by, entity, world));
  },

  // Into the routine, with what this use gives its input, worked out here, in
  // the caller's frame. Its blocks begin next tick.
  call(run, ins, entity, world) {
    if ((run.frames?.length ?? 0) >= LIMITS.calls) throw new Fault(reason("error.busy", { block: ins.block }));
    const args = {};
    for (const { param, value } of ins.args) args[param] = evaluate(value, entity, world);
    (run.frames ??= []).push({ call: ins.block, back: run.at + 1, routine: ins.routine, args });
    run.at = ins.to;
    return {};
  },

  // A message there is taken, and the next block runs next tick; with none,
  // the block stays active, to look again next tick.
  receive(run, ins, entity) {
    const taken = takeMessage(entity, ins.message);
    if (!taken) {
      run.wait = reason("wait.message", { message: ins.message, block: ins.block });
      return { received: null };
    }
    run.at++;
    return { received: { message: taken.message, from: taken.from } };
  },
};

// Variable `id` holds `value` from now on, kept within LIMITS.number either
// side of 0.
function remember(run, id, value) {
  const kept = Math.max(-LIMITS.number, Math.min(LIMITS.number, value));
  (run.vars ??= {})[id] = kept;
  run.at++;
  return { value: kept };
}

// Back from the routine run's innermost frame, to after its call.
function back(run) {
  const frame = run.frames.pop();
  if (!run.frames.length) delete run.frames;
  run.at = frame.back;
}

export const programRuntime = {
  // Goes through bookkeeping to the next visible instruction, and evaluates it:
  // one a tick at most (PLAN.md §6). Returns null when the program is over, or
  // { block, intent?, error?, … } for the block evaluated.
  next(entity, world, now) {
    const run = entity.runtime;
    if (run.ended || run.parked) return null;
    const { code } = programOf(world, run.program);
    for (let ops = 0; ops < MAX_OPS; ops++) {
      const ins = code[run.at];
      if (ins.op === "jump") {
        run.at = ins.to;
        continue;
      }
      if (ins.op === "return") {
        back(run);
        continue;
      }
      if (ins.op === "end") {
        Object.assign(run, { ended: true, block: null, wait: null });
        return null;
      }
      Object.assign(run, { block: ins.block, evaluated: { block: ins.block, tick: now }, wait: null });
      try {
        return { block: ins.block, ...VISIBLE[ins.op](run, ins, entity, world) };
      } catch (e) {
        if (e instanceof Fault) return { block: ins.block, error: e.problem };
        throw e;
      }
    }
    return { block: run.block, error: reason("error.busy", { block: run.block }) };
  },
  // The action of the active block has ended.
  done(entity) {
    entity.runtime.at++;
  },
  restart(entity) {
    Object.assign(entity.runtime, { at: 0, loops: [], block: null, evaluated: null, wait: null, ended: false });
    delete entity.runtime.vars;
    delete entity.runtime.frames;
  },
  finished: (entity) => entity.runtime.ended || !!entity.runtime.parked,
  waiting: (entity) => entity.runtime.wait,
  active: (entity) => entity.runtime.block,
};

// --- Checking compiled programs ----------------------------------------------

const ROUTES = { goTo: "target", pickUp: "item", make: "recipe" };
const CMPS = ["EQ", "NEQ", "LT", "LTE", "GT", "GTE"];
const isId = (value) => typeof value === "string" && value.length > 0;

// What's wrong with compiled program `program`, for a developer to read; [] when
// it's sound: every instruction one the runtime knows, with its fields, every
// jump to an instruction there is, and no way to run off the end. A program that
// comes from outside the compiler (a command, a save) is checked before it runs.
export function checkProgram(program) {
  const problems = [];
  const { code } = program ?? {};
  if (!Array.isArray(code) || !code.length) return ["no instructions"];
  const fail = (i, text) => problems.push(`instruction ${i}: ${text}`);
  const inCode = (to) => Number.isInteger(to) && to >= 0 && to < code.length;

  function expression(i, e, depth) {
    if (depth > LIMITS.expression + 1) return fail(i, "an expression too deep");
    if (!isId(e?.block)) return fail(i, "an expression without a block");
    if (e.op === "number" && Number.isInteger(e.value)) return;
    if (["stock", "needs", "space"].includes(e.op) && isId(e.item) && isId(e.at)) return;
    if (e.op === "basket") return;
    if ((e.op === "place" || e.op === "item") && isId(e.value)) return;
    if (e.op === "setting" && e.slot in SETTINGS) return;
    if (e.op === "var" && isId(e.var)) return;
    if (e.op === "arg" && isId(e.param)) return;
    if (e.op === "compare" && CMPS.includes(e.cmp)) {
      expression(i, e.a, depth + 1);
      expression(i, e.b, depth + 1);
      return;
    }
    fail(i, `no expression ${JSON.stringify(e)}`);
  }

  code.forEach((ins, i) => {
    if (ins?.op === "jump") {
      if (!inCode(ins.to)) fail(i, `a jump to ${ins.to}`);
      return;
    }
    if (ins?.op === "end" || ins?.op === "return") return;
    if (!isId(ins?.block)) return fail(i, `${ins?.op} without a block`);
    if (i + 1 >= code.length) fail(i, "runs off the end");
    switch (ins.op) {
      case "act": {
        const { type } = ins.intent ?? {};
        const args = ins.args ?? {};
        if (!ACTIONS.includes(type)) fail(i, `no action ${type}`);
        else if (args === null || typeof args !== "object" || Array.isArray(args)) fail(i, "args that aren't an object");
        else if (ROUTES[type] && !isId(ins.intent[ROUTES[type]]) && !(ROUTES[type] in args)) fail(i, `${type} without its ${ROUTES[type]}`);
        else if (type === "wait" && !(Number.isInteger(ins.intent.steps) && ins.intent.steps >= 1)) fail(i, "a wait without its steps");
        else if (type === "send" && !(MESSAGES.includes(ins.intent.message) && isId(ins.intent.to))) fail(i, "a send without its message or recipient");
        else if (type === "supply" && !(isId(ins.intent.to) && Array.isArray(ins.intent.from) && ins.intent.from.length && ins.intent.from.every(isId))) fail(i, "a supply without its building or places");
        else if (type === "make" && "role" in ins.intent && !isId(ins.intent.role)) fail(i, "a new robot without its team");
        else for (const [key, e] of Object.entries(args)) {
          if (key !== ROUTES[type] || key in ins.intent) fail(i, `an arg ${key}`);
          else if (!["place", "item", "setting", "arg"].includes(e?.op)) fail(i, `an arg ${key} that isn't a place or item`);
          else expression(i, e, 1);
        }
        break;
      }
      case "until":
        expression(i, ins.test, 1);
        break;
      case "repeat":
        expression(i, ins.times, 1);
        if (!inCode(ins.exit)) fail(i, `an exit at ${ins.exit}`);
        break;
      case "forever":
        break;
      case "set":
        if (!isId(ins.var)) fail(i, "a set without its variable");
        expression(i, ins.value, 1);
        break;
      case "change":
        if (!isId(ins.var)) fail(i, "a change without its variable");
        expression(i, ins.by, 1);
        break;
      case "call":
        if (!inCode(ins.to) || !isId(ins.routine)) fail(i, `a call of ${ins.to}`);
        if (!Array.isArray(ins.args)) fail(i, "a call without its inputs");
        else
          for (const arg of ins.args) {
            if (!isId(arg?.param)) fail(i, "an input without its name");
            else expression(i, arg.value, 1);
          }
        break;
      case "receive":
        if (!MESSAGES.includes(ins.message)) fail(i, `a wait for ${ins.message}`);
        break;
      case "if":
        if (!Array.isArray(ins.branches) || !ins.branches.length) fail(i, "an if without branches");
        else
          for (const b of ins.branches) {
            expression(i, b.test, 1);
            if (!inCode(b.to)) fail(i, `a branch to ${b.to}`);
          }
        if (!inCode(ins.otherwise)) fail(i, `an otherwise at ${ins.otherwise}`);
        break;
      default:
        fail(i, `no instruction ${ins.op}`);
    }
  });
  if (program.variables !== undefined && !(Array.isArray(program.variables) && program.variables.length && program.variables.every((v) => isId(v?.id) && typeof v.name === "string"))) {
    problems.push("variables that aren't a list of names");
  }
  return problems;
}
