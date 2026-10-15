import { compile } from "../programming/compiler.js";
import { startProgram } from "../programming/runtime.js";
import { finish, progress, tryStart } from "./actions.js";
import { applyCommand } from "./commands.js";
import { TYPES } from "./entities.js";
import { count, makeStore } from "./inventory.js";
import { runtimeOf } from "./runtimes.js";
import { script } from "./script.js";
import { cellAt, inside, parseTerrain } from "./terrain.js";

// The world and its clock (PLAN.md §6). advanceWorld moves the world from tick T
// to tick T + 1, and nothing else changes it: not the frame rate, timers, dates or
// chance. The state is plain data, whole numbers, strings, booleans, arrays and
// objects, so it saves and loads exactly; robots, buildings and deposits are kept
// in order of id, and nothing depends on the order of an object's keys.
//
//   { sim, content, tick, terrain, nav, serial, programs, entities, nodes, stall }
//
// `nav` is the navigation revision, counted up whenever the ways change; `serial`
// numbers waiting intents in the order they started waiting; `programs` are the
// compiled programs entities run, { id, revision, …compiled } in order of id
// (src/programming/compiler.js); `stall` is { since } while nothing can happen
// (codes.js).
//
// An entity (robot or building) is
//
//   { id, kind, type, name, cell | area + access, store, action, pending, error, runtime }
//
// with `action` what it's doing (actions.js), `pending` an intent that's waiting
// to start { intent, order, since, reason, nav }, `error` the reason its program
// stopped, and `runtime` what decides its next intent: a program's runtime state
// (src/programming/runtime.js), or a script (runtimes.js). `name` is a message
// reference, worded only when shown (PLAN.md §8).

// Bumped whenever a deliberate change makes the same commands give a different
// world; the golden replays (test/golden/) are then recorded again: npm run golden.
export const SIM_VERSION = 2;

// Ticks in a second of play at 1× speed. Every duration is a whole number of
// ticks, so this is part of the simulation (PLAN.md §1).
export const TICKS_PER_SECOND = 10;

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// A world at tick 0 from `content` (src/content/island.js shows the shape). Its
// programs are compiled here, each as its `revision`, 1 unless said (a world
// started again keeps the programs the player applied: src/programming/
// programs.js), and an entity with a program starts at its start; one with a
// script follows the script.
export function createWorld(content) {
  const terrain = parseTerrain(content.terrain);
  const cell = ([x, z]) => {
    if (!inside(terrain, x, z)) throw new Error(`${content.id}: cell ${x}, ${z} is off the map`);
    return cellAt(terrain, x, z);
  };
  const places = [...content.entities, ...content.nodes].map((t) => t.id);
  const programs = (content.programs ?? []).map(({ id, source, revision = 1 }) => {
    const { program, errors } = compile(source, { places });
    if (!program) throw new Error(`${content.id}: program ${id} doesn't compile: ${JSON.stringify(errors)}`);
    if (!Number.isInteger(revision) || revision < 1) throw new Error(`${content.id}: program ${id} has revision ${revision}`);
    return { id, revision, ...program };
  });
  const runtime = (e) => {
    if (e.script) return script(e.script.steps.map((s) => ({ ...s })), { loop: !!e.script.loop });
    if (!e.program) return null;
    const program = programs.find((p) => p.id === e.program);
    if (!program) throw new Error(`${content.id}: ${e.id} runs program ${e.program}, which there isn't`);
    const missing = program.needs.filter((ability) => !TYPES[e.type].can?.includes(ability));
    if (missing.length) throw new Error(`${content.id}: ${e.id} can't run program ${e.program}: it can't ${missing.join(", ")}`);
    return startProgram(program);
  };
  const runner = (e) => ({ action: null, pending: null, error: null, runtime: runtime(e) });
  const entities = content.entities.map((e) => {
    const type = TYPES[e.type];
    if (!type || type.kind === "node") throw new Error(`${content.id}: ${e.id} has no robot or building type "${e.type}"`);
    const base = { id: e.id, kind: type.kind, type: e.type, name: e.name };
    if (type.kind === "robot") return { ...base, cell: cell(e.cell), store: makeStore({ items: e.items, total: type.basket }), ...runner(e) };
    return {
      ...base,
      area: { ...e.area },
      access: e.access.map(cell),
      store: makeStore({ items: e.items, caps: e.caps }),
      ...(e.gap && { gap: e.gap.map(cell), built: false }),
      ...runner(e),
    };
  });
  const nodes = content.nodes.map((n) => {
    if (TYPES[n.type]?.kind !== "node") throw new Error(`${content.id}: ${n.id} has no deposit type "${n.type}"`);
    return {
      id: n.id,
      kind: "node",
      type: n.type,
      name: n.name,
      area: { ...n.area },
      access: n.access.map(cell),
      store: makeStore({ items: n.items, caps: n.caps }),
      ...(n.regrow && { regrow: { ...n.regrow } }),
    };
  });
  return {
    sim: SIM_VERSION,
    content: { id: content.id, version: content.version },
    tick: 0,
    terrain,
    nav: 0,
    serial: 0,
    programs: programs.sort(byId),
    entities: entities.sort(byId),
    nodes: nodes.sort(byId),
    stall: null,
  };
}

// Moves `world` on by one tick, applying the player's `commands` first. Returns
// the tick's trace, the debugger's account of the tick (it isn't part of the
// world):
//
//   { tick, commands, evaluated, started, ended, waiting, errors, states }
//
// - commands: what each command did, { ok, reason? }.
// - evaluated: each entity that evaluated a step, { entity, block?, … }: the
//   block, and what came of it: an action's `intent`, a Wait Until's `test`, an
//   If's `branch` (its index, or -1 for none), a Repeat's `round` (from 1, or 0
//   when it's over). A script's step has an intent and no block.
// - started, ended: actions, { entity, type }.
// - waiting: intents that couldn't start, { entity, reason }.
// - errors: entities whose program stopped, { entity, reason }.
// - states: every robot and building after the tick, { entity, state, block }:
//   statusOf's word and the active block.
//
// The phases, in order (PLAN.md §6):
// 1. The player's commands.
// 2. Actions under way move on; those that end settle their holds, in order of
//    entity id. Then deposits grow back.
// 3. Messages are delivered (from Phase 8). From here to phase 5 the world is
//    read, not changed: runtimes see it as it stands after phase 2.
// 4. Each entity that's free, in order of id, evaluates its runtime's next
//    visible step, one at most: an action's block gives an intent, which is only
//    noted here; a loop, a condition or a Wait Until only moves the runtime on.
// 5. Intents are settled: first those already waiting, in the order they began
//    to, then this tick's, in order of entity id. Each starts if the world is
//    ready for it, reserving what it needs, so an earlier one has first pick;
//    otherwise it waits, with the reason, and is tried again next tick. A wait
//    for a way somewhere is only tried again once the ways have changed.
// 6. Whether the world has stalled; then the tick is done. (Objectives come with
//    missions.)
export function advanceWorld(world, commands = []) {
  const now = world.tick + 1;
  const trace = { tick: now, commands: [], evaluated: [], started: [], ended: [], waiting: [], errors: [] };

  // 1. Commands.
  for (const command of commands) trace.commands.push(applyCommand(world, command));

  // 2. Actions under way, then deposits.
  for (const entity of world.entities) {
    if (!entity.action) continue;
    const state = progress(world, entity, now);
    if (state === "done") {
      trace.ended.push({ entity: entity.id, type: entity.action.type });
      finish(world, entity);
      runtimeOf(entity)?.done(entity);
    } else if (state.wait) {
      // The way is gone: the move waits to start again from where the robot is.
      entity.pending = { intent: { type: "goTo", target: state.wait.target }, order: world.serial++, since: now, reason: state.wait, nav: world.nav };
    }
  }
  for (const node of world.nodes) {
    if (growing(node) && now % node.regrow.every === 0) node.store.items[TYPES[node.type].yields] = count(node.store, TYPES[node.type].yields) + 1;
  }

  // 3. Messages come with Phase 8.

  // 4. Runtimes.
  const intents = [];
  for (const entity of world.entities) {
    if (entity.action || entity.pending || entity.error) continue;
    const step = runtimeOf(entity)?.next(entity, world, now);
    if (!step) continue;
    const { intent, error, ...seen } = step;
    trace.evaluated.push({ entity: entity.id, ...seen, ...(intent && { intent }) });
    if (error) {
      entity.error = error;
      trace.errors.push({ entity: entity.id, reason: error });
    } else if (intent) intents.push({ entity, intent });
  }

  // 5. Settling intents.
  const queue = world.entities
    .filter((e) => e.pending)
    .sort((a, b) => a.pending.order - b.pending.order)
    .map((entity) => ({ entity, intent: entity.pending.intent, pending: entity.pending }));
  for (const { entity, intent, pending } of [...queue, ...intents]) {
    if (pending?.reason.code === "wait.route" && pending.nav === world.nav) {
      trace.waiting.push({ entity: entity.id, reason: pending.reason });
      continue;
    }
    const result = tryStart(world, entity, intent, now);
    if (result.action) {
      entity.action = result.action;
      entity.pending = null;
      trace.started.push({ entity: entity.id, type: result.action.type });
    } else if (result.wait) {
      entity.pending = { intent, order: pending?.order ?? world.serial++, since: pending?.since ?? now, reason: result.wait, nav: world.nav };
      trace.waiting.push({ entity: entity.id, reason: result.wait });
    } else {
      entity.pending = null;
      entity.error = blame(entity, result.error);
      trace.errors.push({ entity: entity.id, reason: entity.error });
    }
  }

  // 6. Stalled? Then the tick is done.
  world.stall = stalled(world) ? (world.stall ?? { since: now }) : null;
  world.tick = now;
  trace.states = world.entities.map((e) => ({ entity: e.id, state: statusOf(e), block: runtimeOf(e)?.active(e) ?? null }));
  return trace;
}

// An action's error, from a program, names the block whose action it was.
function blame(entity, problem) {
  const block = runtimeOf(entity)?.active(entity);
  return block ? { ...problem, block } : problem;
}

// Nothing under way, nothing growing back, somebody waiting, and nobody ready to
// go on: everyone else has stopped or failed, so nothing can change until the
// player does something. (A program going round a loop of conditions without
// acting is ready, not waiting: it isn't stalled, though it changes nothing.)
function stalled(world) {
  if (world.entities.some((e) => e.action) || world.nodes.some(growing)) return false;
  const states = world.entities.map(statusOf);
  return states.includes("waiting") && !states.includes("ready");
}

// A deposit that grows back, one item every regrow.every ticks, up to its cap.
function growing(node) {
  const item = TYPES[node.type].yields;
  return !!node.regrow && count(node.store, item) < node.store.caps[item];
}

// What an entity is doing, in the plan's terms (PLAN.md §8): "error", "waiting"
// (for the world, on purpose with Wait N Steps, or at a Wait Until), "moving",
// "working", "ready" (it has more to do, and goes on next tick) or "stopped"
// (nothing more to do).
export function statusOf(entity) {
  if (entity.error) return "error";
  const runtime = runtimeOf(entity);
  if (entity.pending || entity.action?.type === "wait" || runtime?.waiting(entity)) return "waiting";
  if (entity.action?.type === "move") return "moving";
  if (entity.action) return "working";
  return runtime && !runtime.finished(entity) ? "ready" : "stopped";
}

// Why `entity` stopped or waits, a code with values (codes.js), or null.
export const reasonOf = (entity) => entity.error ?? entity.pending?.reason ?? runtimeOf(entity)?.waiting(entity) ?? null;
