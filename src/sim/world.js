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
//   { sim, content, tick, terrain, nav, serial, entities, nodes, stall }
//
// `nav` is the navigation revision, counted up whenever the ways change; `serial`
// numbers waiting intents in the order they started waiting; `stall` is
// { since } while nothing can happen (codes.js).
//
// An entity (robot or building) is
//
//   { id, kind, type, name, cell | area + access, store, action, pending, error, runtime }
//
// with `action` what it's doing (actions.js), `pending` an intent that's waiting
// to start { intent, order, since, reason, nav }, `error` the reason its program
// stopped, and `runtime` what decides its next intent (runtimes.js). `name` is a
// message reference, worded only when shown (PLAN.md §8).

// Bumped whenever a deliberate change makes the same commands give a different
// world; the golden replays (test/golden/) are then recorded again: npm run golden.
export const SIM_VERSION = 1;

// Ticks in a second of play at 1× speed. Every duration is a whole number of
// ticks, so this is part of the simulation (PLAN.md §1).
export const TICKS_PER_SECOND = 10;

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// A world at tick 0 from `content` (src/content/island.js shows the shape).
export function createWorld(content) {
  const terrain = parseTerrain(content.terrain);
  const cell = ([x, z]) => {
    if (!inside(terrain, x, z)) throw new Error(`${content.id}: cell ${x}, ${z} is off the map`);
    return cellAt(terrain, x, z);
  };
  const runner = (e) => ({ action: null, pending: null, error: null, runtime: e.script ? script(e.script.steps.map((s) => ({ ...s })), { loop: !!e.script.loop }) : null });
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
    entities: entities.sort(byId),
    nodes: nodes.sort(byId),
    stall: null,
  };
}

// Moves `world` on by one tick, applying the player's `commands` first. Returns
// the tick's trace: what the commands did, which entities tried an intent, and
// which actions started, ended and waited. The trace is the debugger's account
// of the tick; it isn't part of the world.
//
// The phases, in order (PLAN.md §6):
// 1. The player's commands.
// 2. Actions under way move on; those that end settle their holds, in order of
//    entity id. Then deposits grow back.
// 3. Messages are delivered (from Phase 8). From here to phase 5 the world is
//    read, not changed: runtimes see it as it stands after phase 2.
// 4. Each entity that's free, in order of id, tries its runtime's next intent,
//    one at most. Intents are only noted here.
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
    const intent = runtimeOf(entity)?.next(entity, now);
    if (!intent) continue;
    intents.push({ entity, intent });
    trace.evaluated.push({ entity: entity.id, intent });
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
      entity.error = result.error;
      trace.errors.push({ entity: entity.id, reason: result.error });
    }
  }

  // 6. Stalled? Then the tick is done.
  world.stall = stalled(world) ? (world.stall ?? { since: now }) : null;
  world.tick = now;
  return trace;
}

// Nothing under way, nothing growing back, and somebody waiting: everyone else
// has stopped or failed (anyone free tried an intent in phase 4 and is now busy,
// waiting or failed), so nothing can change until the player does something.
function stalled(world) {
  if (world.entities.some((e) => e.action) || world.nodes.some(growing)) return false;
  return world.entities.some((e) => e.pending);
}

// A deposit that grows back, one item every regrow.every ticks, up to its cap.
function growing(node) {
  const item = TYPES[node.type].yields;
  return !!node.regrow && count(node.store, item) < node.store.caps[item];
}

// What an entity is doing, in the plan's terms (PLAN.md §8): "error", "waiting"
// (for the world, or on purpose with Wait N Steps), "moving", "working", "ready"
// (it has more to do and starts next tick) or "stopped" (nothing more to do).
export function statusOf(entity) {
  if (entity.error) return "error";
  if (entity.pending || entity.action?.type === "wait") return "waiting";
  if (entity.action?.type === "move") return "moving";
  if (entity.action) return "working";
  const runtime = runtimeOf(entity);
  return runtime && !runtime.finished(entity) ? "ready" : "stopped";
}
