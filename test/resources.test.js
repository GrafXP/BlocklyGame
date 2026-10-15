import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceWorld, createWorld, statusOf } from "../src/sim/world.js";
import { cancel } from "../src/sim/actions.js";
import { available } from "../src/sim/inventory.js";
import { stateHash } from "../src/sim/replay.js";
import { cellAt } from "../src/sim/terrain.js";
import { ISLAND } from "../src/content/island.js";
import { byId, robot, run, runUntil, tinyWorld } from "./helpers.js";

// Resources, reservations and waiting (PLAN.md §4, §12). On the field: a wood
// pile at (6, 1), reached from (5, 1), and a sawmill at (6, 3), from (5, 3).
const pile = (wood, extra = {}) => ({ id: "pile", type: "grove", name: "pile", area: { x: 6, z: 1, w: 1, d: 1 }, access: [[5, 1]], items: { wood }, caps: { wood: 10 }, ...extra });
const mill = (items = {}, steps = null) => ({
  id: "mill",
  type: "sawmill",
  name: "mill",
  area: { x: 6, z: 3, w: 1, d: 1 },
  access: [[5, 3]],
  caps: { wood: 4, plank: 4 },
  items,
  ...(steps && { script: { steps, loop: true } }),
});
const collect = { type: "collect", item: "wood" };

test("collecting and unloading move items from deposit to basket to building, each when its action ends", () => {
  const world = tinyWorld({
    entities: [robot("r1", [5, 1], [collect, collect, { type: "goTo", target: "mill" }, { type: "unload" }]), mill()],
    nodes: [pile(3)],
  });
  const [r1, p, m] = ["r1", "pile", "mill"].map((id) => byId(world, id));
  run(world, 1);
  assert.deepEqual([p.store.items, p.store.out, r1.store.in], [{ wood: 3 }, { wood: 1 }, { wood: 1 }], "promised, not yet moved");
  run(world, 5); // tick 6: the first collect (5 ticks) ends, the second starts
  assert.deepEqual([p.store.items, r1.store.items], [{ wood: 2 }, { wood: 1 }]);
  run(world, 5); // tick 11
  assert.deepEqual([p.store.items, r1.store.items], [{ wood: 1 }, { wood: 2 }]);
  run(world, 6); // tick 17: two cells south
  assert.equal(r1.cell, cellAt(world.terrain, 5, 3));
  assert.deepEqual(m.store.in, { wood: 2 });
  run(world, 3); // tick 20: unloaded
  assert.deepEqual([r1.store.items, m.store.items, m.store.in, r1.store.out], [{}, { wood: 2 }, {}, {}]);
  assert.equal(statusOf(r1), "stopped");
});

test("on the island, no item is made or lost but by recipes, and every rule holds every tick", () => {
  // Without the grove growing back, every wood is still wood, a plank, or one of
  // the bridge's four planks.
  const world = createWorld({ ...ISLAND, nodes: ISLAND.nodes.map(({ regrow, ...n }) => n) });
  const total = (item) => [...world.entities, ...world.nodes].reduce((n, t) => n + (t.store.items[item] ?? 0), 0);
  const wood = () => total("wood") + total("plank") + (byId(world, "site").built ? 4 : 0);
  const start = { wood: wood(), stone: total("stone") };
  for (let i = 0; i < 3000; i++) {
    run(world, 1);
    assert.equal(wood(), start.wood, `wood at tick ${world.tick}`);
    assert.equal(total("stone"), start.stone, `stone at tick ${world.tick}`);
  }
  assert.ok(byId(world, "site").built, "the bridge was built");
  assert.equal(byId(world, "depot").store.items.stone, 8, "and all the stone carried across it");
});

test("two robots after the last item: the first in id order gets it, the other waits, and gets the next", () => {
  const world = tinyWorld({ entities: [robot("r1", [5, 1], [collect]), robot("r2", [5, 1], [collect])], nodes: [pile(1)] });
  const traces = run(world, 2, { 3: [{ type: "stock", at: "pile", item: "wood", count: 2 }] });
  assert.deepEqual(traces[0].started, [{ entity: "r1", type: "collect" }]);
  assert.deepEqual(byId(world, "r2").pending.reason, { code: "wait.item", item: "wood", at: "pile", need: 1, have: 0 });
  assert.equal(byId(world, "pile").store.items.wood, 1, "still there, but promised to r1");
  const [third] = run(world, 1, { 3: [{ type: "stock", at: "pile", item: "wood", count: 2 }] });
  assert.deepEqual(third.started, [{ entity: "r2", type: "collect" }]);
});

test("intents waiting for the same thing are served in the order they began to wait, whatever the ids", () => {
  const late = [{ type: "wait", steps: 2 }, collect];
  const world = tinyWorld({ entities: [robot("r1", [5, 1], late), robot("r2", [5, 1], late), robot("r3", [5, 1], [collect])], nodes: [pile(0)] });
  run(world, 4); // r3 waits from tick 1, r1 and r2 from tick 3
  assert.deepEqual(
    world.entities.map((e) => e.pending?.since),
    [3, 3, 1],
  );
  const [t5] = run(world, 1, { 5: [{ type: "stock", at: "pile", item: "wood", count: 1 }] });
  assert.deepEqual(t5.started, [{ entity: "r3", type: "collect" }]);
  const [t6] = run(world, 1, { 6: [{ type: "stock", at: "pile", item: "wood", count: 2 }] });
  assert.deepEqual(t6.started, [{ entity: "r1", type: "collect" }], "r1 and r2 began to wait together; r1 is first by id");
});

test("a building's work reserves its inputs and room for its output, so no one else can take them", () => {
  const world = tinyWorld({ entities: [mill({ wood: 1 }, [{ type: "make", recipe: "plank" }]), robot("r1", [5, 3], [{ type: "pickUp", item: "wood" }])] });
  const m = byId(world, "mill");
  run(world, 1);
  assert.equal(m.action.type, "make");
  assert.deepEqual([m.store.items, m.store.out, m.store.in], [{ wood: 1 }, { wood: 1 }, { plank: 1 }]);
  assert.equal(available(m.store, "wood"), 0);
  assert.deepEqual(byId(world, "r1").pending.reason, { code: "wait.item", item: "wood", at: "mill", need: 1, have: 0 });
  run(world, 20); // the plank takes 20 ticks
  assert.deepEqual([m.store.items, m.store.out, m.store.in], [{ plank: 1 }, {}, {}]);
  assert.deepEqual(m.pending.reason, { code: "wait.item", item: "wood", at: "mill", need: 1, have: 0 }, "and waits for more wood");
});

test("a waiting block stays the active one, and runs when the world is ready, skipping nothing", () => {
  const world = tinyWorld({ entities: [robot("r1", [5, 1], [collect, { type: "wait", steps: 1 }])], nodes: [pile(0)] });
  const r1 = byId(world, "r1");
  run(world, 10);
  assert.equal(statusOf(r1), "waiting");
  assert.equal(r1.runtime.at, 0);
  assert.equal(r1.pending.since, 1);
  const traces = run(world, 7, { 11: [{ type: "stock", at: "pile", item: "wood", count: 1 }] });
  assert.deepEqual(traces[0].started, [{ entity: "r1", type: "collect" }]);
  assert.deepEqual(traces[5].started, [{ entity: "r1", type: "wait" }], "then the next step");
  assert.deepEqual(r1.store.items, { wood: 1 });
});

test("unloading into a full store waits until everything fits, then all goes in at once", () => {
  const world = tinyWorld({ entities: [robot("r1", [5, 3], [{ type: "unload" }], { items: { wood: 2 } }), mill({ wood: 3 }, [{ type: "make", recipe: "plank" }])] });
  const r1 = byId(world, "r1");
  run(world, 1);
  assert.deepEqual(r1.pending.reason, { code: "wait.space", item: "wood", at: "mill", need: 2, free: 1 });
  // The mill's plank ends in tick 21 and frees a place for wood: now two fit.
  runUntil(world, () => r1.action);
  assert.equal(world.tick, 21);
  run(world, 3);
  assert.deepEqual(r1.store.items, {});
});

test("cancelling lets go of what an action held and moves nothing; finished work stays done", () => {
  const world = tinyWorld({ entities: [robot("r1", [5, 1], [collect, collect]), mill({ wood: 1 }, [{ type: "make", recipe: "plank" }])], nodes: [pile(5)] });
  const [r1, p, m] = ["r1", "pile", "mill"].map((id) => byId(world, id));
  run(world, 8); // r1 has one wood and is collecting the second; the mill is making a plank
  assert.deepEqual(r1.store.items, { wood: 1 });
  const traces = run(world, 1, {
    9: [
      { type: "restart", entity: "r1" },
      { type: "restart", entity: "mill" },
    ],
  });
  // Nothing moved, the wood collected before stays, and the only holds left are
  // those of the new actions: both start again from their first step in the same
  // tick. (Had the old holds stayed, the pile would promise 2 wood.)
  assert.deepEqual(
    traces[0].started.map((s) => s.entity),
    ["mill", "r1"],
  );
  assert.equal(r1.action.start, 9);
  assert.deepEqual([p.store.items, p.store.out, r1.store.items, r1.store.in], [{ wood: 4 }, { wood: 1 }, { wood: 1 }, { wood: 1 }]);
  assert.deepEqual([m.store.items, m.store.out], [{ wood: 1 }, { wood: 1 }], "the plank's wood is still there");
});

test("a robot stopped between cells ends on the nearer one, or on the one it left when halfway", () => {
  const world = tinyWorld({ entities: [robot("r1", [1, 2], [])] });
  const r1 = byId(world, "r1");
  const [a, b] = [cellAt(world.terrain, 1, 2), cellAt(world.terrain, 2, 2)];
  const stopAt = (tick, perCell) => {
    r1.cell = a;
    r1.action = { type: "move", target: "x", path: [a, b], start: 0, end: perCell, perCell, nav: 0 };
    world.tick = tick;
    cancel(world, r1);
    return r1.cell === a ? "left" : "next";
  };
  assert.equal(stopAt(1, 3), "left");
  assert.equal(stopAt(2, 3), "next");
  assert.equal(stopAt(2, 4), "left", "halfway: the cell it left");
  assert.equal(stopAt(3, 4), "next");
});

test("a robot with no way waits, is tried again only when the ways change, and goes when the bridge is built", () => {
  const world = createWorld(ISLAND);
  const r3 = byId(world, "r3");
  run(world, 2); // its Forever, then its Go To
  assert.deepEqual(r3.pending.reason, { code: "wait.route", target: "quarry" });
  const order = r3.pending.order;
  run(world, 19);
  assert.deepEqual([r3.pending.order, r3.pending.since, r3.pending.nav, world.nav], [order, 2, 0, 0]);
  // Four planks at the site: it builds the bridge in 40 ticks, the ways change,
  // and r3 sets off in that same tick.
  run(world, 1, { 22: [{ type: "stock", at: "site", item: "plank", count: 4 }] });
  const built = runUntil(world, () => byId(world, "site").built);
  assert.equal(built, 22 + 40);
  assert.equal(world.nav, 1);
  assert.equal(r3.action?.type, "move");
  assert.equal(r3.action.start, built);
  // Robots already on their way find their way again at their next cell.
  run(world, 3);
  for (const e of world.entities) if (e.action?.type === "move") assert.equal(e.action.nav, 1, e.id);
  runUntil(world, () => byId(world, "quarry").access.includes(r3.cell));
});

test("when nothing is under way and every robot left is waiting, the world reports a stall, until something changes", () => {
  const world = tinyWorld({ entities: [robot("r1", [5, 1], [collect])], nodes: [pile(0)] });
  run(world, 5);
  assert.deepEqual(world.stall, { since: 1 });
  run(world, 1, { 6: [{ type: "stock", at: "pile", item: "wood", count: 1 }] });
  assert.equal(world.stall, null);
  run(world, 10);
  assert.equal(statusOf(byId(world, "r1")), "stopped");
  assert.equal(world.stall, null, "stopped with nothing to wait for isn't a stall");

  const growing = tinyWorld({ entities: [robot("r1", [5, 1], [collect])], nodes: [pile(0, { regrow: { every: 10 } })] });
  run(growing, 5);
  assert.equal(growing.stall, null, "the pile is growing back");
});

test("a deposit grows back one item every so many ticks, up to its cap", () => {
  const world = tinyWorld({ nodes: [pile(0, { caps: { wood: 2 }, regrow: { every: 10 } })] });
  const counts = [];
  for (let i = 0; i < 4; i++) {
    run(world, 10);
    counts.push(byId(world, "pile").store.items.wood ?? 0);
  }
  assert.deepEqual(counts, [1, 2, 2, 2]);
});

test("what can't work as written is an error, with its reason, until a restart", () => {
  const world = tinyWorld({
    entities: [
      robot("r1", [1, 1], [collect]),
      robot("r2", [1, 2], [{ type: "goTo", target: "nowhere" }]),
      robot("r3", [1, 3], [{ type: "unload" }]),
      mill({}, [{ type: "goTo", target: "pile" }]),
    ],
    nodes: [pile(1)],
  });
  run(world, 1);
  assert.deepEqual(
    world.entities.map((e) => e.error),
    [
      { code: "error.cannot", action: "goTo" },
      { code: "error.notHere", action: "collect" },
      { code: "error.target", target: "nowhere" },
      { code: "error.notHere", action: "unload" },
    ],
  );
  assert.ok(world.entities.every((e) => statusOf(e) === "error"));
  run(world, 5);
  assert.ok(world.entities.every((e) => !e.action && !e.pending), "nothing more happens");
  run(world, 1, { 7: [{ type: "script", entity: "r1", steps: [{ type: "goTo", target: "pile" }, collect] }] });
  assert.equal(byId(world, "r1").error, null);
  assert.equal(byId(world, "r1").action.type, "move");
});

test("a command that doesn't fit the world changes nothing, and says so", () => {
  const world = createWorld(ISLAND);
  const control = createWorld(ISLAND);
  const bad = [{ type: "fly" }, { type: "restart", entity: "nobody" }, { type: "stock", at: "grove", item: "gold", count: 1 }, { type: "stock", at: "grove", item: "wood", count: -1 }, { type: "script", entity: "grove", steps: [] }];
  const trace = advanceWorld(world, bad);
  advanceWorld(control);
  assert.deepEqual(
    trace.commands.map((c) => c.ok),
    [false, false, false, false, false],
  );
  assert.deepEqual(trace.commands[0].reason, { code: "command.invalid", type: "fly" });
  assert.equal(stateHash(world), stateHash(control));
});
