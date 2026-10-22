import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";
import { createMission, goalProblem, goalProgress } from "../src/sim/objectives.js";
import { checkWorld } from "../src/sim/validate.js";
import { advanceWorld, createWorld, statusOf } from "../src/sim/world.js";
import { byId, run, runUntil } from "./helpers.js";
import { forever, go, make, my, pickUp, program, repeat, unload } from "./programs.js";

// The mission engine of Phase 7 (src/sim/objectives.js; docs/campaign-plan.md,
// “Checkpoints, resources, and reliable goals”): goals count work that has
// ended, never work begun; different kinds unloaded together count as one
// basket; an exact order is judged once the work is over, and one too many
// fails it; a robot that was to set off only when things were ready fails if
// it waits; a steady goal holds a count for a while; and a mission, from its
// one start, is done at the tick its last goal is met.

// A field with a pile of wood at the west, a depot at the east and a sawmill
// in the middle; robots between. `mission` is the world's mission.
const FIELD = ["~~~~~~~~~~~~", "~..........~", "~..........~", "~..........~", "~~~~~~~~~~~~"];
const pile = { id: "pile", type: "grove", name: "pile", area: { x: 1, z: 1, w: 1, d: 1 }, access: [[2, 1]], items: { wood: 9 }, caps: { wood: 9 } };
const depot = { id: "depot", type: "depot", name: "depot", area: { x: 10, z: 1, w: 1, d: 1 }, access: [[9, 1]], caps: { wood: 20, plank: 20 } };
const mill = (items = {}) => ({ id: "mill", type: "sawmill", name: "mill", area: { x: 6, z: 3, w: 1, d: 1 }, access: [[6, 2]], items, caps: { wood: 4, plank: 4 } });
const bot = (id, cell, program, extra = {}) => ({ id, type: "helper", name: id, cell, program, ...extra });

function world({ entities, programs, mission }) {
  return createWorld({
    id: "test",
    version: 1,
    terrain: FIELD,
    entities: [depot, mill(), ...entities],
    nodes: [pile],
    programs: Object.entries(programs).map(([id, source]) => ({ id, source })),
    mission: { id: "m", ...mission },
  });
}
const goal = (w, id) => w.mission.goals.find((g) => g.id === id);

// Brings wood from the pile to the depot, `n` trips of `take` each.
const trips = (n, take = 1) => program(repeat("r", n, go("g1", "pile"), repeat("t", take, pickUp("c")), go("g2", "depot"), unload("u")));

test("a delivery counts once the unload has ended, by item, by robot, and in full baskets only when asked", () => {
  const w = world({
    entities: [bot("a", [3, 1], "p"), bot("b", [3, 2], "q")],
    programs: { p: trips(1), q: trips(1, 2) },
    mission: {
      goals: [
        { id: "all", type: "delivered", to: "depot", item: "wood", count: 3 },
        { id: "a", type: "delivered", to: "depot", by: "a", count: 1 },
        { id: "full", type: "delivered", to: "depot", item: "wood", count: 2, load: 2 },
        { id: "trips", type: "trips", by: "b", count: 1 },
      ],
    },
  });
  let unloading = null;
  runUntil(w, (it) => {
    if (!unloading && it.entities.some((e) => e.action?.type === "unload")) unloading = it.tick;
    return it.mission.done !== null;
  });
  assert.ok(goal(w, "all").done > unloading, "not while an unload is under way");
  assert.deepEqual(goalProgress(w, goal(w, "all")), { have: 3, need: 3, done: true, failed: false });
  assert.equal(goalProgress(w, goal(w, "full")).have, 2, "only the two that came together");
  assert.equal(goalProgress(w, goal(w, "a")).have, 1);
  assert.equal(goalProgress(w, goal(w, "trips")).have, 1);
  assert.deepEqual(w.mission.collected, { wood: 3 }, "what came from the deposits");
});

test("different kinds unloaded together count as one basket, by robot; one kind twice doesn't", () => {
  const mixed = program(go("g1", "pile"), pickUp("c"), go("g2", "mill"), pickUp("k", "plank"), go("g3", "depot"), unload("u"));
  const w = world({
    entities: [bot("a", [3, 1], "p"), bot("b", [3, 2], "q")],
    programs: { p: mixed, q: trips(1, 2) },
    mission: {
      goals: [
        { id: "any", type: "together", to: "depot", items: ["wood", "plank"] },
        { id: "a", type: "together", to: "depot", by: "a", items: ["plank", "wood"] },
        { id: "b", type: "together", to: "depot", by: "b", items: ["plank", "wood"] },
      ],
    },
  });
  byId(w, "mill").store.items = { plank: 1 };
  runUntil(w, (it) => it.entities.every((e) => statusOf(e) === "stopped"));
  assert.ok(goal(w, "any").done && goal(w, "a").done, "Robo a's basket held a plank and a wood");
  assert.equal(goal(w, "b").done, null, "two wood aren't two kinds");
  assert.deepEqual(goalProgress(w, goal(w, "b")), { have: 0, need: 1, done: false, failed: false });
  assert.deepEqual(checkWorld(w), []);
});

test("an exact order is judged once the work is over, and one too many fails it", () => {
  const exact = (n, p) =>
    world({ entities: [bot("a", [3, 1], "p")], programs: { p }, mission: { goals: [{ id: "three", type: "delivered", to: "depot", item: "wood", count: n, exact: true }] } });
  const right = exact(3, trips(3));
  runUntil(right, (w) => w.mission.done !== null);
  assert.equal(statusOf(byId(right, "a")), "stopped", "met only once Robo a's program is over");

  // Forever never stops: three are there, but more are on their way.
  const going = exact(3, program(forever("f", go("g1", "pile"), pickUp("c"), go("g2", "depot"), unload("u"))));
  runUntil(going, (w) => goalProgress(w, w.mission.goals[0]).have === 3);
  assert.equal(going.mission.goals[0].done, null);
  runUntil(going, (w) => w.mission.goals[0].failed !== null);
  assert.equal(goalProgress(going, going.mission.goals[0]).have, 4);
  run(going, 200);
  assert.equal(going.mission.done, null, "failed for good");
  assert.deepEqual(checkWorld(going), []);
});

test("a robot that was to set off only once things were ready fails if it waits to pick up", () => {
  const goals = [{ id: "both", type: "delivered", to: "depot", item: "plank", by: "a", count: 2, load: 2, exact: true, noWait: true }];
  const fetch = program(go("g", "mill"), pickUp("p1", "plank"), pickUp("p2", "plank"), go("g2", "depot"), unload("u"));
  // One plank on the shelf: the robot waits there for a second that never comes.
  const early = world({ entities: [bot("a", [3, 1], "p")], programs: { p: fetch }, mission: { goals } });
  byId(early, "mill").store.items = { plank: 1 };
  runUntil(early, (w) => w.mission.goals[0].failed !== null || w.tick > 100, 200);
  assert.ok(early.mission.goals[0].failed, "it waited for the second plank");
  assert.equal(early.mission.tally.waited.a > 0, true);

  const ready = world({ entities: [bot("a", [3, 1], "p")], programs: { p: fetch }, mission: { goals } });
  byId(ready, "mill").store.items = { plank: 2 };
  runUntil(ready, (w) => w.mission.done !== null);
  assert.equal(ready.mission.goals[0].failed, null);
});

test("a building that was to start only once it was ready fails if it waits to make", () => {
  const goals = [{ id: "two", type: "made", at: "mill", item: "plank", count: 2, noWait: true }];
  const making = (wood) => {
    const w = createWorld({
      id: "test",
      version: 1,
      terrain: FIELD,
      entities: [depot, { ...mill({ wood }), program: "m" }],
      nodes: [pile],
      programs: [{ id: "m", source: program(repeat("r", 2, make("k"))) }],
      mission: { id: "m", goals },
    });
    runUntil(w, (it) => it.mission.done !== null || it.mission.goals[0].failed !== null, 200);
    return w;
  };
  const short = making(1);
  assert.ok(short.mission.goals[0].failed, "the second plank waited for its wood");
  assert.equal(short.mission.tally.waited.mill > 0, true);
  assert.equal(making(2).mission.goals[0].failed, null);
  assert.equal(goalProblem(goals[0]), null, "a made goal names its building: no `by`");
});

test("an order counts each item's deliveries up to what it orders, together", () => {
  const w = world({
    entities: [bot("a", [3, 1], "p")],
    programs: { p: program(go("g", "mill"), repeat("t", 2, pickUp("k", "plank")), go("g2", "depot"), unload("u"), go("g3", "pile"), repeat("w", 2, pickUp("c")), go("g4", "depot"), unload("u2")) },
    mission: { goals: [{ id: "order", type: "order", to: "depot", items: { plank: 1, wood: 2 } }] },
  });
  byId(w, "mill").store.items = { plank: 2 };
  runUntil(w, (it) => it.mission.tally.unloads["depot|*|plank"]);
  assert.deepEqual(goalProgress(w, goal(w, "order")), { have: 1, need: 3, done: false, failed: false }, "two planks count as the one ordered");
  runUntil(w, (it) => it.mission.done !== null);
  assert.deepEqual(goalProgress(w, goal(w, "order")).have, 3);
  assert.match(goalProblem({ id: "a", type: "order", to: "depot", items: { plank: 0 } }), /has items/);
});

test("a steady goal holds a count for a while, once what it waits for has stopped", () => {
  const w = world({
    entities: [bot("a", [3, 1], "p")],
    programs: { p: program(repeat("r", 2, go("g", "mill"), pickUp("k", "plank"), go("g2", "depot"), unload("u"))) },
    mission: { goals: [{ id: "two", type: "steady", at: "mill", item: "plank", count: 2, ticks: 30, after: "a" }] },
  });
  byId(w, "mill").store.items = { plank: 4 };
  const stopped = runUntil(w, (it) => statusOf(byId(it, "a")) === "stopped");
  assert.equal(w.mission.goals[0].since, stopped, "two left once Robo a is done");
  runUntil(w, (it) => it.mission.done !== null);
  assert.equal(w.mission.done, stopped + 30);
});

test("a goal of making nothing at all is met once the work is over, and making one fails it", () => {
  const none = (p) =>
    createWorld({
      id: "test",
      version: 1,
      terrain: FIELD,
      entities: [depot, { ...mill({ wood: 1 }), program: "m" }],
      nodes: [pile],
      programs: [{ id: "m", source: p }],
      mission: { id: "m", goals: [{ id: "none", type: "made", at: "mill", item: "plank", count: 0, exact: true }] },
    });
  const idle = none(program());
  assert.equal(runUntil(idle, (w) => w.mission.done !== null, 10), 1, "its program is over at once");
  const busy = none(program(make("k")));
  runUntil(busy, (w) => w.mission.goals[0].failed !== null, 100);
  assert.equal(busy.mission.done, null);
});

test("a mission is done at the tick its goal is met, and the clock runs on: there's no second start", () => {
  const w = world({ entities: [bot("a", [3, 1], "p")], programs: { p: trips(2) }, mission: { goals: [{ id: "one", type: "delivered", to: "depot", item: "wood", count: 1 }] } });
  const game = createGame(w);
  game.run();
  let now = 0;
  while (w.mission.done === null) game.frame((now += 100));
  assert.equal(game.trace.done, true);
  assert.equal(w.mission.done, goal(w, "one").done, "done with its goal");
  assert.equal(game.clock.running, true, "the world goes on");
  const delivered = goalProgress(w, goal(w, "one")).have;
  runUntil(w, (it) => statusOf(byId(it, "a")) === "stopped");
  assert.equal(goalProgress(w, goal(w, "one")).have, delivered + 1, "Robo a's second trip still counts, from the same start");
  assert.deepEqual(checkWorld(w), []);
});

test("goals are checked as they're written", () => {
  assert.equal(goalProblem({ id: "a", type: "delivered", to: "depot", count: 2 }), null);
  assert.match(goalProblem({ id: "a", type: "wished" }), /no goal type/);
  assert.match(goalProblem({ id: "a", type: "delivered", count: 2 }), /needs to/);
  assert.match(goalProblem({ id: "a", type: "delivered", to: "depot", count: 0 }), /counts 0/, "nothing at all needs exact");
  assert.match(goalProblem({ id: "a", type: "delivered", to: "depot", count: 2, load: 3 }), /load 3/);
  assert.match(goalProblem({ id: "a", type: "delivered", to: "depot", count: 2, noWait: true }), /noWait without by/);
  assert.match(goalProblem({ id: "a", type: "made", at: "mill", item: "plank", count: 1, colour: "red" }), /has colour/);
  assert.match(goalProblem({ id: "a", type: "together", to: "depot", items: ["wood"] }), /has items/, "together is of two kinds at least");
  assert.throws(() => createMission({ id: "m", goals: [] }), /no goals/);
});

test("a robot stopped because a setting wasn't chosen goes on once it is", () => {
  const w = world({ entities: [bot("a", [3, 1], "p")], programs: { p: program(go("g", my("s", "source")), pickUp("c")) }, mission: { goals: [{ id: "w", type: "holds", robot: "a", item: "wood", count: 1 }] } });
  run(w, 2);
  assert.deepEqual(byId(w, "a").error, { code: "error.setting", setting: "source", block: "s" });
  run(w, 1, { [w.tick + 1]: [{ type: "settings", entity: "a", settings: { destination: "depot" } }] });
  assert.ok(byId(w, "a").error, "another setting changes nothing");
  run(w, 1, { [w.tick + 1]: [{ type: "settings", entity: "a", settings: { source: "pile" } }] });
  assert.equal(byId(w, "a").error, null);
  runUntil(w, (it) => it.mission.done !== null, 100);
});

test("the sandbox adds a robot where robots can walk, with nothing to do yet", () => {
  const w = world({ entities: [], programs: {}, mission: { goals: [{ id: "x", type: "built", at: "mill" }] } });
  const add = (robot) => advanceWorld(w, [{ type: "add", robot }]).commands[0].ok;
  assert.equal(add({ id: "r9", name: { key: "entity.robo", params: { n: 9 } }, cell: [4, 2] }), true);
  assert.deepEqual([byId(w, "r9").runtime, byId(w, "r9").role, byId(w, "r9").store.items], [null, null, {}]);
  assert.equal(add({ id: "r9", name: "again", cell: [4, 3] }), false, "an id that's taken");
  assert.equal(add({ id: "r8", name: "wet", cell: [0, 0] }), false, "water");
  assert.equal(add({ id: "r8", name: "under", cell: [6, 3] }), false, "under the sawmill");
  assert.deepEqual(checkWorld(w), []);

  // With a program for every helper, a new one runs it.
  const typed = createWorld({
    id: "test",
    version: 1,
    terrain: FIELD,
    entities: [depot],
    nodes: [pile],
    programs: [{ id: "h", source: program(go("g", "pile")) }],
    defaults: [{ type: "helper", program: "h" }],
  });
  assert.equal(advanceWorld(typed, [{ type: "add", robot: { id: "r1", name: "r1", cell: [4, 2] } }]).commands[0].ok, true);
  assert.equal(byId(typed, "r1").runtime.program, "h");
  assert.deepEqual(checkWorld(typed), []);
});
