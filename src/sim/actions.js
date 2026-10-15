import { reason } from "./codes.js";
import { ITEMS, TYPES, can, typeOf } from "./entities.js";
import { available, reserve, release, room, settle } from "./inventory.js";
import { findPath } from "./navigation.js";
import { RECIPES } from "./recipes.js";
import { setKind } from "./terrain.js";
import { thing, thingAt } from "./things.js";

// Actions: what a robot or building is doing, over whole ticks (PLAN.md §4, §6).
// An entity's runtime asks for one with an intent, such as { type: "collect",
// item: "wood" }. If the world is ready, the action starts: it reserves what it
// will take and the room for what it will leave, and keeps those holds until it
// ends. Started in tick T with duration d (at least 1), it ends in tick T + d,
// when everything it promised happens at once. If the world isn't ready, the
// intent waits, with the reason; if it can't work at all, it's an error.
//
// Action data is plain and serializable:
//
//   { type: "move", target, path: [cells], start, end, perCell, nav }
//   { type: "collect" | "pickUp", from, item, start, end, holds }
//   { type: "unload", to, start, end, holds }
//   { type: "make", recipe, start, end, holds }
//   { type: "wait", start, end }
//
// A robot's position along a move is derived from `path`, `start` and `perCell`;
// it only ever stands on one cell, entity.cell, which changes as each is reached.

const action = (type, now, ticks, data) => ({ type, ...data, start: now, end: now + Math.max(1, ticks) });

// Starts `intent` for `entity` in tick `now`: { action }, { wait: reason } or
// { error: reason }. ACTIONS lists the intents there are.
export function tryStart(world, entity, intent, now) {
  const start = STARTS[intent.type];
  if (!start || !can(entity, intent.type)) return { error: reason("error.cannot", { action: intent.type }) };
  return start(world, entity, intent, now);
}

const STARTS = {
  goTo(world, robot, { target }, now) {
    const place = thing(world, target);
    if (!place?.access) return { error: reason("error.target", { target }) };
    const path = findPath(world, robot.cell, place.access);
    if (!path) return { wait: reason("wait.route", { target }) };
    const { perCell } = typeOf(robot);
    return { action: action("move", now, (path.length - 1) * perCell, { target, path, perCell, nav: world.nav }) };
  },

  collect(world, robot, { item }, now) {
    const node = thingAt(world, robot.cell, (t) => t.kind === "node" && TYPES[t.type].yields === item);
    if (!node) return { error: reason("error.notHere", { action: "collect" }) };
    return take(world, robot, node, item, now, "collect", typeOf(robot).collectTicks);
  },

  pickUp(world, robot, { item }, now) {
    const building = thingAt(world, robot.cell, (t) => t.kind === "building" && (t.store.caps?.[item] ?? 0) > 0);
    if (!building) return { error: reason("error.notHere", { action: "pickUp" }) };
    return take(world, robot, building, item, now, "pickUp", typeOf(robot).pickUpTicks);
  },

  // Everything in the basket goes into the building here, or nothing does.
  unload(world, robot, intent, now) {
    const building = thingAt(world, robot.cell, (t) => t.kind === "building");
    if (!building) return { error: reason("error.notHere", { action: "unload" }) };
    const items = ITEMS.filter((item) => robot.store.items[item]);
    for (const item of items) {
      const need = robot.store.items[item];
      const free = room(building.store, item);
      if (free < need) return { wait: reason("wait.space", { item, at: building.id, need, free: Math.max(0, free) }) };
    }
    const holds = items.flatMap((item) => {
      const n = robot.store.items[item];
      return [reserve(world, robot.id, "out", item, n), reserve(world, building.id, "in", item, n)];
    });
    return { action: action("unload", now, typeOf(robot).unloadTicks, { to: building.id, holds }) };
  },

  make(world, building, { recipe }, now) {
    const r = RECIPES[recipe];
    if (!r || !typeOf(building).recipes?.includes(recipe) || (r.builds && building.built)) return { error: reason("error.cannot", { action: "make" }) };
    for (const [item, need] of Object.entries(r.inputs)) {
      const have = available(building.store, item);
      if (have < need) return { wait: reason("wait.item", { item, at: building.id, need, have }) };
    }
    for (const [item, need] of Object.entries(r.outputs)) {
      const free = room(building.store, item);
      if (free < need) return { wait: reason("wait.space", { item, at: building.id, need, free: Math.max(0, free) }) };
    }
    const holds = [
      ...Object.entries(r.inputs).map(([item, n]) => reserve(world, building.id, "out", item, n)),
      ...Object.entries(r.outputs).map(([item, n]) => reserve(world, building.id, "in", item, n)),
    ];
    return { action: action("make", now, r.ticks, { recipe, holds }) };
  },

  wait(world, entity, { steps }, now) {
    return { action: action("wait", now, Math.trunc(steps) || 1, {}) };
  },
};

export const ACTIONS = Object.keys(STARTS);

// One `item` from `from` into the robot's basket.
function take(world, robot, from, item, now, type, ticks) {
  const have = available(from.store, item);
  if (have < 1) return { wait: reason("wait.item", { item, at: from.id, need: 1, have: Math.max(0, have) }) };
  const free = room(robot.store, item);
  if (free < 1) return { wait: reason("wait.space", { item, at: robot.id, need: 1, free: Math.max(0, free) }) };
  const holds = [reserve(world, from.id, "out", item, 1), reserve(world, robot.id, "in", item, 1)];
  return { action: action(type, now, ticks, { from: from.id, item, holds }) };
}

// Moves `entity`'s action on to tick `now`: "done" when it has ended (call
// finish), "going" while it hasn't, or { wait } when a move finds its way gone.
// A moving robot reaches a cell every perCell ticks. If the ways have changed
// since it set off (world.nav), it finds its way again from each cell it
// reaches: a new bridge can make it shorter, a new building can block it.
export function progress(world, entity, now) {
  const a = entity.action;
  if (a.type === "move") {
    const walked = now - a.start;
    if (walked > 0 && walked % a.perCell === 0) {
      entity.cell = a.path[walked / a.perCell];
      if (a.nav !== world.nav && entity.cell !== a.path[a.path.length - 1]) {
        const path = findPath(world, entity.cell, thing(world, a.target).access);
        if (!path) {
          entity.action = null;
          return { wait: reason("wait.route", { target: a.target }) };
        }
        Object.assign(a, { path, start: now, end: now + Math.max(1, (path.length - 1) * a.perCell), nav: world.nav });
        return path.length === 1 ? "done" : "going";
      }
    }
  }
  return now >= a.end ? "done" : "going";
}

// Ends `entity`'s action: what it promised happens, all at once.
export function finish(world, entity) {
  const a = entity.action;
  if (a.holds) settle(world, a.holds);
  if (a.type === "make" && RECIPES[a.recipe].builds) build(world, entity);
  entity.action = null;
}

// A construction site's work is done: its gap becomes walkable, and every way
// is found again (PLAN.md §4: a bridge is a walkable connection).
function build(world, site) {
  setKind(world.terrain, site.gap, "+");
  site.built = true;
  world.nav++;
}

// Stops `entity`'s action before it ends, at the tick boundary after tick
// world.tick: its holds are let go and nothing moves. A robot stopped between two
// cells ends on the nearer, or on the one it left when it's halfway (PLAN.md §5).
export function cancel(world, entity) {
  const a = entity.action;
  if (!a) return;
  if (a.holds) release(world, a.holds);
  if (a.type === "move") {
    const walked = world.tick - a.start;
    const leg = Math.floor(walked / a.perCell);
    const into = walked % a.perCell;
    entity.cell = a.path[into * 2 > a.perCell ? leg + 1 : leg];
  }
  entity.action = null;
}
