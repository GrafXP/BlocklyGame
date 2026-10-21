import { reason } from "./codes.js";
import { ITEMS, TYPES } from "./entities.js";
import { available, room } from "./inventory.js";
import { isAt, thing } from "./things.js";

// Supply (SKIRMISH_PLAN.md §4, §7; docs/campaign-planv2.md, chapter 9): one
// delivery for what a building's order still needs, made of the actions a
// robot's own program would use, a walk, pick-ups, a walk and an unload, with
// the same times, basket and waiting. It brings nothing from nowhere.
//
// A building's order is what it wants on its shelf, building.order = { item: n },
// as a mission's setup declares it (staging.js, `orders`); a building without
// one orders nothing. What it still needs of an item is its order, less what it
// has that isn't promised to leave, less what's on its way, so one item is never
// counted twice: neither as stock and on its way, nor by two robots supplying it.
//
// A robot supplying a building has its plan, while its Supply block runs:
//
//   robot.supply = { to, from, item, n, steps: [intent, …], step }
//       bringing `n` of `item` from `from` to `to`, through `steps`, at `step`
//   robot.supply = { to, idle: reason, steps: [], step: 0 }
//       nothing to bring, and why: it waits a moment (SUPPLY_IDLE), and its
//       block ends, so the program can look again
//
// The plan is made when the block's turn comes to start (world.js, phase 5),
// from the world as it stands then; the item is the one the order is shortest
// of, in the order of ITEMS when two are as short, and the source is the first
// place in the block's list that has some. Each step is an ordinary intent,
// started and waited for as any is; the plan ends with its unload, or, when it's
// stopped, with what stopped it (actions.js, cancel).

export const SUPPLY_IDLE = 10;

// Whether thing `t` gives `item` to a robot's Pick Up: a deposit that yields it,
// or a building that keeps it.
export const offers = (t, item) => (t.kind === "node" ? TYPES[t.type].yields === item : t.kind === "building" && (t.store.caps?.[item] ?? 0) > 0);

// How many of `item` are on their way to building `to`: in the baskets of
// robots supplying it, until they unload, and promised by unloads under way.
export function incoming(world, to, item) {
  let n = to.store.in[item] ?? 0;
  for (const r of world.entities) {
    const p = r.supply;
    if (p && !p.idle && p.to === to.id && p.item === item && r.action?.type !== "unload") n += p.n;
  }
  return n;
}

// How many more of `item` thing `to`'s order asks for; 0 with no order.
export function needs(world, to, item) {
  const want = to.order?.[item] ?? 0;
  return want ? Math.max(0, want - available(to.store, item) - incoming(world, to, item)) : 0;
}

// Robot `robot`'s plan for a Supply of building `to` from the places `from`:
// { plan }, { idle: reason } with nothing to bring, or { error: reason }.
export function planSupply(world, robot, { to, from }) {
  const dest = thing(world, to);
  if (dest?.kind !== "building") return { error: reason("error.target", { target: to }) };
  const sources = [];
  for (const id of from) {
    const s = thing(world, id);
    if (!s?.access?.length) return { error: reason("error.target", { target: id }) };
    if (s === dest) return { error: reason("error.source", { target: id }) };
    sources.push(s);
  }
  // Shortest first; sort keeps ITEMS' order between two as short.
  const wanted = ITEMS.map((item) => ({ item, n: needs(world, dest, item) }))
    .filter((w) => w.n > 0)
    .sort((a, b) => b.n - a.n);
  if (!wanted.length) return { idle: reason(dest.order ? "supply.full" : "supply.noOrder", { to }) };
  for (const { item, n } of wanted) {
    const source = sources.find((s) => offers(s, item) && available(s.store, item) > 0);
    if (!source) continue;
    const take = Math.min(n, room(robot.store, item), available(source.store, item));
    if (take < 1) return { idle: reason("supply.basket", { to }) };
    const steps = [
      ...(isAt(world, robot, source.id) ? [] : [{ type: "goTo", target: source.id }]),
      ...Array.from({ length: take }, () => ({ type: "pickUp", item })),
      { type: "goTo", target: dest.id },
      { type: "unload" },
    ];
    return { plan: { to, from: source.id, item, n: take, steps, step: 0 } };
  }
  return { idle: reason("supply.none", { item: wanted[0].item, to }) };
}

// The step robot `robot`'s plan is at, when it has one with steps left; else null.
export const supplyStep = (robot) => robot.supply?.steps[robot.supply.step] ?? null;
