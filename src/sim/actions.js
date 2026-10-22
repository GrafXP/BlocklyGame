import { reason } from "./codes.js";
import { insertById, makeThing } from "./content.js";
import { ITEMS, can, typeOf } from "./entities.js";
import { available, reserve, release, room, settle } from "./inventory.js";
import { INBOX_SIZE, deliver, queued } from "./messages.js";
import { findPath } from "./navigation.js";
import { BLUEPRINTS, placedName } from "./placement.js";
import { RECIPES } from "./recipes.js";
import { SUPPLY_IDLE, offers, planSupply } from "./supply.js";
import { setKind } from "./terrain.js";
import { thing, thingAt } from "./things.js";

// Actions: what a robot or building is doing, over whole ticks (PLAN.md §4, §6).
// An entity's runtime asks for one with an intent, such as { type: "pickUp",
// item: "wood" }. If the world is ready, the action starts: it reserves what it
// will take and the room for what it will leave, and keeps those holds until it
// ends. Started in tick T with duration d (at least 1), it ends in tick T + d,
// when everything it promised happens at once. If the world isn't ready, the
// intent waits, with the reason; if it can't work at all, it's an error.
//
// Action data is plain and serializable:
//
//   { type: "move", target, path: [cells], start, end, perCell, nav }
//   { type: "pickUp", from, item, start, end, holds }  from a deposit or a building
//   { type: "unload", to, start, end, holds }
//   { type: "make", recipe, role?, start, end, holds }  role: a new robot's team
//   { type: "wait", start, end }
//   { type: "send", to, message, start, end }      a message on its way (messages.js)
//
// A robot's position along a move is derived from `path`, `start` and `perCell`;
// it only ever stands on one cell, entity.cell, which changes as each is reached.

const action = (type, now, ticks, data) => ({ type, ...data, start: now, end: now + Math.max(1, ticks) });

// Starts `intent` for `entity` in tick `now`: { action }, { wait: reason } or
// { error: reason }; a Supply's result also has `intent`, the step of its plan
// it started or waits to start (supply.js). ACTIONS lists the intents there are.
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

  // One `item` from whatever here has it: a building that stores it, or a
  // deposit that yields it. Taking from a deposit takes longer.
  pickUp(world, robot, { item }, now) {
    const from = thingAt(world, robot.cell, (t) => offers(t, item));
    if (!from) return { error: reason("error.notHere", { action: "pickUp" }) };
    return take(world, robot, from, item, now, typeOf(robot).pickUpTicks[from.kind]);
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

  // A recipe that makes a robot also needs a team for it, and room under the
  // island's robot limit (world.limit): it holds a place there while it works.
  make(world, building, { recipe, role }, now) {
    const r = RECIPES[recipe];
    const wrong = r?.builds && (building.blueprint !== r.builds || building.built);
    if (!r || !typeOf(building).recipes?.includes(recipe) || wrong) return { error: reason("error.cannot", { action: "make" }) };
    if (r.assembles && !world.roles.some((t) => t.id === role)) return { error: reason("error.team", { team: role ?? "" }) };
    const short = shortOf(building, r);
    if (short) return { wait: short };
    if (r.assembles && world.limit !== null && robotsCounted(world) >= world.limit) return { wait: reason("wait.limit", { limit: world.limit }) };
    const holds = [
      ...Object.entries(r.inputs).map(([item, n]) => reserve(world, building.id, "out", item, n)),
      ...Object.entries(r.outputs).map(([item, n]) => reserve(world, building.id, "in", item, n)),
    ];
    return { action: action("make", now, r.ticks, { recipe, ...(r.assembles && { role }), holds }) };
  },

  // A Supply makes its plan, and starts its first step; with nothing to bring,
  // it waits a moment instead (supply.js).
  supply(world, robot, intent, now) {
    const { plan, idle, error } = planSupply(world, robot, intent);
    if (error) return { error };
    if (idle) {
      robot.supply = { to: intent.to, idle, steps: [], step: 0 };
      return { action: action("wait", now, SUPPLY_IDLE, {}) };
    }
    robot.supply = plan;
    const step = plan.steps[0];
    return { ...tryStart(world, robot, step, now), intent: step };
  },

  wait(world, entity, { steps }, now) {
    return { action: action("wait", now, Math.trunc(steps) || 1, {}) };
  },

  // A message to robot or building `to`, there when the action ends, next
  // tick. A Send keeps a place in the recipient's inbox while it's on its way.
  send(world, entity, { message, to }, now) {
    const recipient = thing(world, to);
    if (!recipient || recipient.kind === "node") return { error: reason("error.recipient", { target: to }) };
    if (queued(world, recipient) >= INBOX_SIZE) return { wait: reason("wait.mailbox", { to }) };
    return { action: action("send", now, 1, { to, message }) };
  },
};

export const ACTIONS = Object.keys(STARTS);

// What `building` lacks to start recipe `r`: the reason it would wait, an
// ingredient short or no room for the whole batch, or null when it's ready
// (the Ready to Make condition reads this too: src/programming/expressions.js).
export function shortOf(building, r) {
  for (const [item, need] of Object.entries(r.inputs)) {
    const have = available(building.store, item);
    if (have < need) return reason("wait.item", { item, at: building.id, need, have });
  }
  for (const [item, need] of Object.entries(r.outputs)) {
    const free = room(building.store, item);
    if (free < need) return reason("wait.space", { item, at: building.id, need, free: Math.max(0, free) });
  }
  return null;
}

// The robots counted against the island's limit: those there are, and those a
// building is making.
export const robotsCounted = (world) =>
  world.entities.filter((e) => e.kind === "robot").length + world.entities.filter((e) => e.action?.type === "make" && RECIPES[e.action.recipe].assembles).length;

// One `item` from `from` into the robot's basket.
function take(world, robot, from, item, now, ticks) {
  const have = available(from.store, item);
  if (have < 1) return { wait: reason("wait.item", { item, at: from.id, need: 1, have: Math.max(0, have) }) };
  const free = room(robot.store, item);
  if (free < 1) return { wait: reason("wait.space", { item, at: robot.id, need: 1, free: Math.max(0, free) }) };
  const holds = [reserve(world, from.id, "out", item, 1), reserve(world, robot.id, "in", item, 1)];
  return { action: action("pickUp", now, ticks, { from: from.id, item, holds }) };
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

// Ends `entity`'s action: what it promised happens, all at once. Returns null,
// or what else came of it: { became: true } when the entity has become another
// thing, as a construction site becomes the building it was for: then its
// program is over, and it needs the one its new type runs (bindings.js);
// { born } when it has made robot `born`, which needs its team's program.
export function finish(world, entity) {
  const a = entity.action;
  if (a.holds) settle(world, a.holds);
  if (a.type === "send") deliver(thing(world, a.to), { message: a.message, from: entity.id, sent: a.start });
  entity.action = null;
  const r = a.type === "make" ? RECIPES[a.recipe] : null;
  if (r?.assembles) return { born: assemble(world, entity, a.role) };
  if (!r?.builds) return null;
  if (r.builds === "bridge") {
    bridge(world, entity);
    return null;
  }
  become(entity, r.builds);
  return { became: true };
}

// A new helper, made by `building` for team `role`: Robo n, the first number
// no robot has, at the building's first front cell no robot stands on (or its
// first), with nothing chosen in its settings and an empty basket.
function assemble(world, building, role) {
  let n = 1;
  while (thing(world, `r${n}`)) n++;
  const taken = new Set(world.entities.filter((e) => e.kind === "robot").map((e) => e.cell));
  const cell = building.access.find((c) => !taken.has(c)) ?? building.access[0];
  const { width } = world.terrain;
  const robot = makeThing(world.terrain, { id: `r${n}`, type: "helper", name: { key: "entity.robo", params: { n } }, cell: [cell % width, Math.floor(cell / width)], role });
  insertById(world.entities, robot);
  return robot;
}

// A bridge's construction site has built it: its gap becomes walkable, and
// every way is found again (PLAN.md §4: a bridge is a walkable connection).
function bridge(world, site) {
  setKind(world.terrain, site.gap, "+");
  site.built = true;
  world.nav++;
}

// A building's construction site has built it: the site is the building now,
// with the same id, footprint and front, and the building's store, empty since
// the work took everything the site held. Its own program, the one that built
// it, is over. Nothing about the ways changes.
function become(site, what) {
  const n = site.id === what ? 1 : Number(site.id.slice(what.length + 1)) || 1;
  site.type = what;
  if (typeof site.name !== "string") site.name = placedName(what, n, false);
  site.store.caps = { ...BLUEPRINTS[what].caps };
  delete site.blueprint;
  delete site.built;
  site.own = null;
}

// Stops `entity`'s action before it ends, at the tick boundary after tick
// world.tick: its holds are let go and nothing moves. A robot stopped between two
// cells ends on the nearer, or on the one it left when it's halfway (PLAN.md §5).
// A message on its way still arrives: it was sent, and messages are never lost
// (PLAN.md §7).
export function cancel(world, entity) {
  delete entity.supply;
  const a = entity.action;
  if (!a) return;
  if (a.holds) release(world, a.holds);
  if (a.type === "send") deliver(thing(world, a.to), { message: a.message, from: entity.id, sent: a.start });
  if (a.type === "move") {
    const walked = world.tick - a.start;
    const leg = Math.floor(walked / a.perCell);
    const into = walked % a.perCell;
    entity.cell = a.path[into * 2 > a.perCell ? leg + 1 : leg];
  }
  entity.action = null;
}
