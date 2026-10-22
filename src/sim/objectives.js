import { applyCommand } from "./commands.js";
import { count } from "./inventory.js";
import { RECIPES } from "./recipes.js";

import { statusOf } from "./status.js";
import { isAt, thing } from "./things.js";

// A mission's goals (PLAN.md §9): what must have happened in the world for the
// mission to be done, checked in the last phase of every tick (world.js). Goals
// look at what the world has become, never at a program's blocks, so any
// program that gets there counts; and only at work that has ended, never at
// work begun (docs/campaign-plan.md, “Judge completed actions”). The mission is
// part of the world, plain data:
//
//   world.mission = { id, goals: [goal, …], tally, collected, reward: [command, …], done }
//
// A mission has one start, its setup (staging.js), and is played from it once.
// There are no trials, starting variations played one after another (decided
// 19 October 2026: a child couldn't tell which one was being judged, nor why a
// goal met in the first didn't end the mission). A campaign mission has one
// goal (src/campaign.js, missionProblems).
//
// - goals: the goals as they stand: each goal's spec with `done`, the tick it
//   was met, for good, and `failed`, the tick it could no longer be met (too
//   many delivered for an exact order, a robot that waited when it was to come
//   only once things were ready), or null.
// - tally: the work completed, which goals count (recordWork); collected: the
//   raw materials taken from deposits, by item, against the mission's budget
//   (scripts/verify-missions.js).
// - reward: commands (commands.js) applied at the end of the tick the last
//   goal is met, when the mission is `done`: the boundary before the next
//   tick, like any command.
//
// A world without a mission has mission null.
//
// The goals there are, as content writes them:
//
//   { type: "built", at }                      site `at` has built its bridge
//   { type: "placed", blueprint, count? }      a site for `blueprint` stands on the island, or the
//        building it became: placed with the Build tool, or there from the start
//   { type: "constructed", blueprint, count? } a `blueprint` building stands, finished on its site
//   { type: "reached", robot, at, hits?, repairs? }
//        robot stands at place `at`, not on its way, having landed at least
//        `hits` pulses on the way, or been repaired at least `repairs` times
//        (missions 63, 65)
//   { type: "hits", by, count }                pulses robot `by` landed on opponents
//   { type: "repaired", robot, count? }        repairs robot `robot` finished at home
//   { type: "holds", robot, item, count }      robot has at least `count` of `item` in its basket
//   { type: "delivered", to, item?, by?, count, load?, exact?, noWait?, safe? }
//        items unloaded into building `to`: of `item` (any when left out), by
//        robot `by` (anyone's when left out), counting only loads of at least
//        `load` items (1 or 2: two full baskets, not four trips)
//   { type: "together", to, items, by?, count? }
//        unloads into building `to` (by robot `by`) that held every kind of
//        `items` at once, in one basket (mission 22)
//   { type: "order", to, items: { item: n }, by? }
//        an order of several items unloaded into building `to` (by robot `by`):
//        at least n of each; counted as each item's deliveries up to its n
//        (mission 60)
//   { type: "trips", by, to?, count, exact? }  unloads robot `by` finished (with something in them)
//   { type: "made", at, item, count, exact?, noWait?, safe? }  items building `at` made
//   { type: "assembled", at, count? }          robots building `at` made (missions 38–40, 67)
//   { type: "steady", at, item, count, ticks, after? }
//        building `at` has kept exactly `count` of `item` for `ticks` ticks, once
//        `after` (a robot or building) has stopped: a settled cycle, not the
//        instant a count is reached (missions 17 and 20)
//   { type: "remembers", robot, count }
//        once robot `robot` has stopped, a variable of its program holds `count`
//        (missions 27, 29, 30): whichever variable, so no name is required
//        (docs/campaign-plan.md: learning evidence without fixed names)
//
// Every goal has an `id`. An `exact` count is judged once the work is over:
// when `by` (or for `made`, the building `at`; else every robot and building)
// has stopped, so an extra delivery under way can't pass unnoticed; one too
// many fails it. So an exact goal is only for a job that ends: a Forever never
// stops, and its goal would never be judged. `noWait` fails the goal if robot
// `by` ever waits at a building for something to pick up, or for room to
// unload: it was to set off only once things were ready (missions 19, 20, 44);
// on a `made` goal, if building `at` ever waits to make, for an ingredient or
// room for the batch: it was to start only once it was ready (mission 56).
// `safe`, a robot, fails it if that robot is ever hit by a pulse: it was to
// be kept safe (missions 69, 70).

const tallied = (world, part, id) => world.mission.tally[part][id] ?? 0;

// Each goal's measure: a number its count is about (1 or 0 for yes or no).
const MEASURES = {
  built: (world, g) => (thing(world, g.at)?.built === true ? 1 : 0),
  placed: (world, g) => world.entities.filter((e) => e.type === g.blueprint || (e.type === "site" && e.blueprint === g.blueprint)).length,
  constructed: (world, g) => world.entities.filter((e) => e.type === g.blueprint).length,
  reached: (world, g) => {
    const r = thing(world, g.robot);
    if (tallied(world, "hits", g.robot) < (g.hits ?? 0) || tallied(world, "repairs", g.robot) < (g.repairs ?? 0)) return 0;
    return r?.kind === "robot" && r.action?.type !== "move" && isAt(world, r, g.at) ? 1 : 0;
  },
  hits: (world, g) => tallied(world, "hits", g.by),
  repaired: (world, g) => tallied(world, "repairs", g.robot),
  holds: (world, g) => {
    const r = thing(world, g.robot);
    return r?.kind === "robot" ? count(r.store, g.item) : 0;
  },
  delivered: (world, g) => unloads(world, g)[(g.load ?? 1) > 1 ? "doubles" : "items"],
  together: (world, g) =>
    Object.entries(world.mission.tally.together)
      .filter(([key]) => {
        const [to, by, kinds] = key.split("|");
        return to === g.to && by === (g.by ?? "*") && g.items.every((item) => kinds.split("+").includes(item));
      })
      .reduce((n, [, times]) => n + times, 0),
  order: (world, g) => Object.entries(g.items).reduce((n, [item, want]) => n + Math.min(want, unloads(world, { ...g, item }).items), 0),
  trips: (world, g) => unloads(world, g).trips,
  made: (world, g) => world.mission.tally.made[`${g.at}|${g.item}`] ?? 0,
  assembled: (world, g) => ["helper", "guard"].reduce((n, robot) => n + (world.mission.tally.made[`${g.at}|${robot}`] ?? 0), 0),
  steady: (world, g) => {
    const t = thing(world, g.at);
    return t ? count(t.store, g.item) : 0;
  },
  // The variable that has got furthest: the count, in a program with one.
  remembers: (world, g) => {
    const values = Object.values(thing(world, g.robot)?.runtime?.vars ?? {});
    return values.length ? Math.max(0, ...values) : 0;
  },
};
export const GOALS = Object.keys(MEASURES);

// What each type of goal must name, and may.
const FIELDS = {
  built: [["at"], []],
  placed: [["blueprint"], ["count"]],
  constructed: [["blueprint"], ["count"]],
  reached: [["robot", "at"], ["hits", "repairs"]],
  hits: [["by", "count"], []],
  repaired: [["robot"], ["count"]],
  holds: [["robot", "item"], ["count"]],
  delivered: [["to", "count"], ["item", "by", "load", "exact", "noWait", "safe"]],
  together: [["to", "items"], ["by", "count"]],
  order: [["to", "items"], ["by"]],
  trips: [["by", "count"], ["to", "exact"]],
  made: [["at", "item", "count"], ["exact", "noWait", "safe"]],
  assembled: [["at"], ["count"]],
  steady: [["at", "item", "count", "ticks"], ["after"]],
  remembers: [["robot", "count"], []],
};

const isMap = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const ZERO = { items: 0, trips: 0, doubles: 0 };
const unloads = (world, g) => world.mission.tally.unloads[`${g.to ?? "*"}|${g.by ?? "*"}|${g.item ?? "*"}`] ?? ZERO;

// How many goal `goal` asks for: an order's items together.
export const needOf = (goal) => goal.count ?? (goal.type === "order" ? Object.values(goal.items).reduce((a, b) => a + b, 0) : 1);

// How far goal `goal` has got in `world`: { have, need, done, failed }.
export function goalProgress(world, goal) {
  return { have: MEASURES[goal.type](world, goal), need: needOf(goal), done: goal.done !== null, failed: goal.failed !== null };
}

// Whether goal spec `goal` is one (a developer's error otherwise).
export function goalProblem(goal) {
  const fields = FIELDS[goal?.type];
  if (!fields) return `no goal type "${goal?.type}"`;
  if (typeof goal.id !== "string" || !goal.id) return "a goal without an id";
  const [needs, may] = fields;
  for (const key of Object.keys(goal)) if (!["id", "type", ...needs, ...may].includes(key)) return `goal ${goal.id} has ${key}`;
  for (const key of needs) if (goal[key] == null) return `goal ${goal.id} needs ${key}`;
  if ("count" in goal && !(Number.isInteger(goal.count) && goal.count >= (goal.exact ? 0 : 1))) return `goal ${goal.id} counts ${goal.count}`;
  if ("load" in goal && ![1, 2].includes(goal.load)) return `goal ${goal.id} has load ${goal.load}`;
  if (goal.noWait && !goal.by && goal.type !== "made") return `goal ${goal.id} has noWait without by`;
  if ("safe" in goal && !(typeof goal.safe === "string" && goal.safe)) return `goal ${goal.id} keeps ${goal.safe} safe`;
  for (const key of ["hits", "repairs"]) if (key in goal && !(Number.isInteger(goal[key]) && goal[key] >= 1)) return `goal ${goal.id} has ${key} ${goal[key]}`;
  if (goal.type === "together" && !(Array.isArray(goal.items) && goal.items.length >= 2 && goal.items.every((i) => typeof i === "string" && i))) return `goal ${goal.id} has items ${JSON.stringify(goal.items)}`;
  if (goal.type === "order" && !(isMap(goal.items) && Object.keys(goal.items).length >= 1 && Object.values(goal.items).every((n) => Number.isInteger(n) && n >= 1))) return `goal ${goal.id} has items ${JSON.stringify(goal.items)}`;
  if ("ticks" in goal && !(Number.isInteger(goal.ticks) && goal.ticks >= 1)) return `goal ${goal.id} has ticks ${goal.ticks}`;
  return null;
}

const copy = (value) => JSON.parse(JSON.stringify(value));
const fresh = (goals) => goals.map((g) => ({ ...copy(g), done: null, failed: null, ...(g.type === "steady" && { since: null }) }));
export const emptyTally = () => ({ unloads: {}, together: {}, made: {}, waited: {}, hits: {}, hurt: {}, repairs: {} });

// The mission in a world made from content's `mission`: { id, goals, reward }.
// Its start is the caller's to make (staging.js, enter).
export function createMission({ id, goals, reward = [] }) {
  if (!goals?.length) throw new Error(`mission ${id}: no goals`);
  for (const goal of goals) {
    const problem = goalProblem(goal);
    if (problem) throw new Error(`mission ${id}: ${problem}`);
  }
  return {
    id,
    goals: fresh(goals),
    tally: emptyTally(),
    collected: {},
    reward: copy(reward),
    done: null,
  };
}

// Whether the work goal `goal` waits for is over: its robot or building has
// stopped, or, when it names none, every robot and building has.
function settled(world, goal) {
  const who = goal.by ?? (goal.type === "made" ? goal.at : goal.type === "remembers" ? goal.robot : null);
  const actors = who ? [thing(world, who)].filter(Boolean) : world.entities;
  return actors.every((e) => statusOf(e) === "stopped");
}

function holds(world, goal, now) {
  const have = MEASURES[goal.type](world, goal);
  if (goal.type === "steady") {
    const after = goal.after ? thing(world, goal.after) : null;
    if (have === goal.count && (!after || statusOf(after) === "stopped")) {
      goal.since ??= now;
      return now - goal.since >= goal.ticks;
    }
    goal.since = null;
    return false;
  }
  if (goal.type === "remembers") return have === needOf(goal) && settled(world, goal);
  return goal.exact ? have === needOf(goal) && settled(world, goal) : have >= needOf(goal);
}

function fails(world, goal) {
  if (goal.exact && MEASURES[goal.type](world, goal) > needOf(goal)) return true;
  if (goal.safe && tallied(world, "hurt", goal.safe) > 0) return true;
  return !!goal.noWait && (world.mission.tally.waited[goal.by ?? goal.at] ?? 0) > 0;
}

// Checks the goals of `world`'s mission at the end of tick `now`. Returns the
// ids of the goals met in this tick, and whether the mission was done in it,
// its last goal met: { met, done }.
export function checkGoals(world, now) {
  const mission = world.mission;
  const result = { met: [], done: false };
  if (!mission || mission.done !== null) return result;
  for (const goal of mission.goals) {
    if (goal.done !== null || goal.failed !== null) continue;
    if (fails(world, goal)) goal.failed = now;
    else if (holds(world, goal, now)) {
      goal.done = now;
      result.met.push(goal.id);
    }
  }
  if (mission.goals.some((goal) => goal.done === null)) return result;
  mission.done = now;
  result.done = true;
  for (const command of mission.reward) applyCommand(world, command);
  return result;
}


// --- What's counted ---------------------------------------------------------

function addUnload(unloads, key, n) {
  const entry = (unloads[key] ??= { items: 0, trips: 0, doubles: 0 });
  entry.items += n;
  entry.trips += 1;
  if (n >= 2) entry.doubles += n;
}

// Notes in the mission's tally the work `entity`'s action did, as it ends:
// before the world settles it (world.js, phase 2). An unload counts what went
// into the building, by item and in all, for the robot and for anyone, and an
// unload of several kinds the kinds it held together; a make what it made, a
// robot as `helper` or `guard`; a pick-up from a deposit what it took; a
// repair the robot's repairs. (Pulses that land, and the shield they take, are
// counted as they land: combat.js, strike.)
export function recordWork(world, entity) {
  const tally = world.mission?.tally;
  const a = entity.action;
  if (!tally || !a) return;
  if (a.type === "repair") tally.repairs[entity.id] = (tally.repairs[entity.id] ?? 0) + 1;
  else if (a.type === "unload") {
    const items = {};
    for (const { at, dir, item, n } of a.holds) if (at === a.to && dir === "in") items[item] = (items[item] ?? 0) + n;
    const total = Object.values(items).reduce((x, y) => x + y, 0);
    if (!total) return;
    for (const to of [a.to, "*"]) {
      for (const by of [entity.id, "*"]) {
        addUnload(tally.unloads, `${to}|${by}|*`, total);
        for (const [item, n] of Object.entries(items)) addUnload(tally.unloads, `${to}|${by}|${item}`, n);
      }
    }
    const kinds = Object.keys(items).sort().join("+");
    if (kinds.includes("+")) for (const by of [entity.id, "*"]) tally.together[`${a.to}|${by}|${kinds}`] = (tally.together[`${a.to}|${by}|${kinds}`] ?? 0) + 1;
  } else if (a.type === "make") {
    const { outputs, assembles } = RECIPES[a.recipe];
    for (const [item, n] of Object.entries(assembles ? { [assembles]: 1 } : outputs)) tally.made[`${entity.id}|${item}`] = (tally.made[`${entity.id}|${item}`] ?? 0) + n;
  } else if (a.type === "pickUp" && thing(world, a.from)?.kind === "node") {
    const { collected } = world.mission;
    collected[a.item] = (collected[a.item] ?? 0) + 1;
  }
}

// Robot `entity` waited this tick at `at` for something to pick up, or for room
// to unload, or building `entity` waited to make, for an ingredient or room for
// its batch (at itself): counted at a building, not at a deposit growing back.
export function recordWait(world, entity, at) {
  const tally = world.mission?.tally;
  if (tally && thing(world, at)?.kind === "building") tally.waited[entity.id] = (tally.waited[entity.id] ?? 0) + 1;
}
