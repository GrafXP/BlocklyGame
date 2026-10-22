import { cancel } from "./actions.js";
import { HOMES, typeOf } from "./entities.js";
import { walkable } from "./navigation.js";
import { xOf, zOf } from "./terrain.js";
import { thing } from "./things.js";

// Guards, shields and pulses (SKIRMISH_PLAN.md §4, §7; docs/campaign-planv2.md,
// chapters 13–14). Every robot has a side (entities.js, SIDES) and a shield of
// segments, robot.shield, whole at its type's `shield`. A guard's Guard and
// Advance are short actions, one walk of a few cells, one pulse or one watch,
// so its program comes back to its conditions between them (actions.js):
//
//   { type: "fire", at, start, end }   a pulse at robot `at`, which lands as it ends
//   { type: "watch", start, end }      looking out, with nothing to do
//   { type: "repair", start, end }     at its home, its shield made whole
//   { type: "reboot", start, end }     knocked out: at its home, starting up again
//
// A pulse lands if, as it ends, its robot is still there, not rebooting, and in
// RANGE; every pulse that ends in a tick lands together, after every action of
// the tick has moved on, so the order robots are listed in never decides a
// fight (world.js, phase 2). A robot whose shield is gone is knocked out: what
// it was doing stops, its holds let go, and it's at its home, rebooting, with
// what it carries. After REBOOT_TICKS its shield is whole, and its program
// starts again from its start; a visitor, following a script, has had its
// visit: it stays at its landing. No program given to it cuts its reboot short
// (bindings.js, stop). Repair is free: the camp's packs aren't used.
//
// Distances are between cells, squared, so they're whole numbers: a robot
// within RANGE of another is no more than RANGE cells from it as the crow
// flies.

export const RANGE = 3; // cells a pulse reaches
export const AREA = 4; // cells round a place that a guard protects
export const DANGER = 6; // cells within which an opponent is near
export const SEGMENT = 2; // cells one Guard or Advance walks at most
export const WATCH_TICKS = 10;
export const REPAIR_TICKS = 20; // for each segment of shield made whole, at least one
export const REBOOT_TICKS = 100;

// How far apart cells `a` and `b` are, squared.
export function apart(world, a, b) {
  const { terrain } = world;
  const dx = xOf(terrain, a) - xOf(terrain, b);
  const dz = zOf(terrain, a) - zOf(terrain, b);
  return dx * dx + dz * dz;
}

const within = (world, a, b, cells) => apart(world, a, b) <= cells * cells;

// Whether robot `r` is on the island and can be hit: not rebooting.
export const active = (r) => r.kind === "robot" && r.action?.type !== "reboot";

// The robots of the other side than robot `robot`'s within `cells` of it that
// can be hit and `fit`, nearest first, then in order of id.
export function foesNear(world, robot, cells, fit = () => true) {
  return world.entities
    .filter((e) => e.kind === "robot" && e.side !== robot.side && active(e) && within(world, robot.cell, e.cell, cells) && fit(e))
    .sort((a, b) => apart(world, robot.cell, a.cell) - apart(world, robot.cell, b.cell) || (a.id < b.id ? -1 : 1));
}

// Whether robot `r` is within `cells` of place `place`: of one of the cells it's
// used from.
export const nearPlace = (world, r, place, cells) => place.access.some((cell) => within(world, r.cell, cell, cells));

// Robot `robot`'s home, where it repairs and reboots: its side's camp, or the
// visitors' landing; null when the island has none.
export const homeOf = (world, robot) => world.entities.concat(world.nodes).find((t) => t.type === HOMES[robot.side] && t.access?.length) ?? null;

// Whether robot `robot`'s shield is low: half or less of a whole one.
export const isLow = (robot) => robot.shield * 2 <= typeOf(robot).shield;

// Whether an opponent of robot `robot` is near: within DANGER of it.
export const inDanger = (world, robot) => foesNear(world, robot, DANGER).length > 0;

// The pulse of robot `shooter`'s fire action, ending now: { by, at } if it lands
// on its robot, else null. Read once every action of the tick has moved on.
export function lands(world, { by, at }) {
  const shooter = thing(world, by);
  const target = thing(world, at);
  return shooter && target && active(target) && within(world, shooter.cell, target.cell, RANGE) ? { by, at } : null;
}

// The pulses `hits` land, together, at the end of phase 2 of tick `now`: each
// takes a segment of its robot's shield, and a robot left with none is knocked
// out. The mission counts each robot's pulses landed and segments lost
// (objectives.js). Returns the robots knocked out, whose runtimes are the
// world's to start again (world.js).
export function strike(world, hits, now) {
  const tally = world.mission?.tally;
  for (const { by, at } of hits) {
    const target = thing(world, at);
    target.shield = Math.max(0, target.shield - 1);
    if (tally) {
      tally.hits[by] = (tally.hits[by] ?? 0) + 1;
      tally.hurt[at] = (tally.hurt[at] ?? 0) + 1;
    }
  }
  const out = [];
  for (const id of [...new Set(hits.map((h) => h.at))].sort()) {
    const target = thing(world, id);
    if (target.shield === 0 && active(target)) {
      knockOut(world, target, now);
      out.push(target);
    }
  }
  return out;
}

// Robot `robot` is knocked out in tick `now`: it stops, keeping what it
// carries, and reboots at its home. (Its program starts again from its start,
// shown as it reboots, and a script is over: the world sees to its runtime,
// world.js.)
export function knockOut(world, robot, now) {
  cancel(world, robot);
  robot.pending = null;
  robot.error = null;
  robot.shield = 0;
  goHome(world, robot);
  robot.action = { type: "reboot", start: now, end: now + REBOOT_TICKS };
}

// Robot `robot` at its home: on its first front cell no other robot stands on,
// or its first; where it is when there's no home.
export function goHome(world, robot) {
  const home = homeOf(world, robot);
  if (!home) return;
  if (home.access.includes(robot.cell)) return;
  const walk = walkable(world);
  const taken = new Set(world.entities.filter((e) => e.kind === "robot" && e !== robot).map((e) => e.cell));
  robot.cell = home.access.find((cell) => walk[cell] && !taken.has(cell)) ?? home.access[0];
}
