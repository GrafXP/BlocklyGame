import { applyCommand } from "./commands.js";
import { count } from "./inventory.js";
import { RECIPES } from "./recipes.js";
import { stageTrial } from "./staging.js";
import { statusOf } from "./status.js";
import { isAt, thing } from "./things.js";

// A mission's goals (PLAN.md §9): what must have happened in the world for the
// mission to be done, checked in the last phase of every tick (world.js). Goals
// look at what the world has become, never at a program's blocks, so any
// program that gets there counts; and only at work that has ended, never at
// work begun (docs/campaign-plan.md, “Judge completed actions”). The mission is
// part of the world, plain data:
//
//   world.mission = { id, trials: [{ stage, goals }], trial, passed: [tick, …],
//                     goals: [goal, …], tally, collected, reward: [command, …], done }
//
// - trials: each a starting variation of the mission, such as one plank on the
//   shelf and then two (missions 16–19), with its own goals. `stage` is what
//   changes for it (staging.js); the first trial's is the mission's start. A
//   mission with one trial is just its goals.
// - trial: the trial under way, from 0; passed: the tick each earlier one was
//   passed. When the last goal of a trial is met, the next trial is staged at
//   the end of that tick, programs starting again from their start, so the
//   player watches the same programs meet the next variation.
// - goals: the trial's goals as they stand: each goal's spec with `done`, the
//   tick it was met, for good, and `failed`, the tick it could no longer be met
//   in this trial (too many delivered for an exact order, a robot that waited
//   when it was to come only once things were ready), or null.
// - tally: the work completed in this trial, which goals count (recordWork);
//   collected: the raw materials taken from deposits in the whole mission, by
//   item, against its budget (scripts/verify-missions.js).
// - reward: commands (commands.js) applied at the end of the tick the last
//   trial is passed, when the mission is `done`: the boundary before the next
//   tick, like any command.
//
// A world without a mission has mission null.
//
// The goals there are, as content writes them:
//
//   { type: "built", at }                      site `at` has built its bridge
//   { type: "reached", robot, at }             robot stands at place `at`, not on its way
//   { type: "holds", robot, item, count }      robot has at least `count` of `item` in its basket
//   { type: "delivered", to, item?, by?, count, load?, exact?, noWait? }
//        items unloaded into building `to` in this trial: of `item` (any when left
//        out), by robot `by` (anyone's when left out), counting only loads of at
//        least `load` items (1 or 2: two full baskets, not four trips)
//   { type: "trips", by, to?, count, exact? }  unloads robot `by` finished (with something in them)
//   { type: "made", at, item, count, exact? }  items building `at` made in this trial
//   { type: "steady", at, item, count, ticks, after? }
//        building `at` has kept exactly `count` of `item` for `ticks` ticks, once
//        `after` (a robot or building) has stopped: a settled cycle, not the
//        instant a count is reached (missions 20 and 28)
//   { type: "remembers", robot, count }
//        once robot `robot` has stopped, a variable of its program holds `count`
//        (missions 27, 29, 30): whichever variable, so no name is required
//        (docs/campaign-plan.md: learning evidence without fixed names)
//
// Every goal has an `id`. An `exact` count is judged once the work is over:
// when `by` (or for `made`, the building `at`; else every robot and building)
// has stopped, so an extra delivery under way can't pass unnoticed; one too
// many fails it. `noWait` fails the goal if robot `by` ever waits at a building
// for something to pick up: it was to set off only once things were ready.

// Each goal's measure: a number its count is about (1 or 0 for yes or no).
const MEASURES = {
  built: (world, g) => (thing(world, g.at)?.built === true ? 1 : 0),
  reached: (world, g) => {
    const r = thing(world, g.robot);
    return r?.kind === "robot" && r.action?.type !== "move" && isAt(world, r, g.at) ? 1 : 0;
  },
  holds: (world, g) => {
    const r = thing(world, g.robot);
    return r?.kind === "robot" ? count(r.store, g.item) : 0;
  },
  delivered: (world, g) => unloads(world, g)[(g.load ?? 1) > 1 ? "doubles" : "items"],
  trips: (world, g) => unloads(world, g).trips,
  made: (world, g) => world.mission.tally.made[`${g.at}|${g.item}`] ?? 0,
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
  reached: [["robot", "at"], []],
  holds: [["robot", "item"], ["count"]],
  delivered: [["to", "count"], ["item", "by", "load", "exact", "noWait"]],
  trips: [["by", "count"], ["to", "exact"]],
  made: [["at", "item", "count"], ["exact"]],
  steady: [["at", "item", "count", "ticks"], ["after"]],
  remembers: [["robot", "count"], []],
};

const ZERO = { items: 0, trips: 0, doubles: 0 };
const unloads = (world, g) => world.mission.tally.unloads[`${g.to ?? "*"}|${g.by ?? "*"}|${g.item ?? "*"}`] ?? ZERO;

// How many goal `goal` asks for.
export const needOf = (goal) => goal.count ?? 1;

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
  if (goal.noWait && !goal.by) return `goal ${goal.id} has noWait without by`;
  if ("ticks" in goal && !(Number.isInteger(goal.ticks) && goal.ticks >= 1)) return `goal ${goal.id} has ticks ${goal.ticks}`;
  return null;
}

const copy = (value) => JSON.parse(JSON.stringify(value));
const fresh = (goals) => goals.map((g) => ({ ...copy(g), done: null, failed: null, ...(g.type === "steady" && { since: null }) }));
export const emptyTally = () => ({ unloads: {}, made: {}, waited: {} });

// The mission in a world made from content's `mission`: { id, trials: [{
// stage?, goals }], reward } or, with one trial, { id, goals, reward }. The
// first trial's stage is the caller's to make (staging.js, startMission).
export function createMission({ id, trials, goals, reward = [] }) {
  const list = trials ?? [{ goals }];
  if (!list.length) throw new Error(`mission ${id}: no trials`);
  for (const trial of list) {
    if (!trial.goals?.length) throw new Error(`mission ${id}: a trial without goals`);
    for (const goal of trial.goals) {
      const problem = goalProblem(goal);
      if (problem) throw new Error(`mission ${id}: ${problem}`);
    }
  }
  return {
    id,
    trials: list.map((t) => ({ stage: copy(t.stage ?? null), goals: copy(t.goals) })),
    trial: 0,
    passed: [],
    goals: fresh(list[0].goals),
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
  return !!goal.noWait && (world.mission.tally.waited[goal.by] ?? 0) > 0;
}

// Checks the goals of `world`'s mission at the end of tick `now`. Returns the
// ids of the goals met in this tick, the trial passed in it (its index) or
// null, and whether the mission was done in it: { met, passed, done }.
export function checkGoals(world, now) {
  const mission = world.mission;
  const result = { met: [], passed: null, done: false };
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
  mission.passed.push(now);
  result.passed = mission.trial;
  if (mission.trial + 1 < mission.trials.length) {
    mission.trial++;
    beginTrial(world);
    return result;
  }
  mission.done = now;
  result.done = true;
  for (const command of mission.reward) applyCommand(world, command);
  return result;
}

// The current trial from its start: its goals fresh, nothing counted yet, and
// its stage made, everyone's program starting again (staging.js).
export function beginTrial(world) {
  const mission = world.mission;
  const { stage, goals } = mission.trials[mission.trial];
  mission.goals = fresh(goals);
  mission.tally = emptyTally();
  if (stage) stageTrial(world, stage);
}

// --- What's counted ---------------------------------------------------------

function addUnload(unloads, key, n) {
  const entry = (unloads[key] ??= { items: 0, trips: 0, doubles: 0 });
  entry.items += n;
  entry.trips += 1;
  if (n >= 2) entry.doubles += n;
}

// Notes in the trial's tally the work `entity`'s action did, as it ends:
// before the world settles it (world.js, phase 2). An unload counts what went
// into the building, by item and in all, for the robot and for anyone; a make
// what it made; a collect what it took from the deposit.
export function recordWork(world, entity) {
  const tally = world.mission?.tally;
  const a = entity.action;
  if (!tally || !a) return;
  if (a.type === "unload") {
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
  } else if (a.type === "make") {
    for (const [item, n] of Object.entries(RECIPES[a.recipe].outputs)) tally.made[`${entity.id}|${item}`] = (tally.made[`${entity.id}|${item}`] ?? 0) + n;
  } else if (a.type === "collect") {
    const { collected } = world.mission;
    collected[a.item] = (collected[a.item] ?? 0) + 1;
  }
}

// Robot `entity` waited this tick at a building for something to pick up.
export function recordWait(world, entity) {
  const tally = world.mission?.tally;
  if (tally) tally.waited[entity.id] = (tally.waited[entity.id] ?? 0) + 1;
}
