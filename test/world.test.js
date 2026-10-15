import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceWorld, createWorld, statusOf } from "../src/sim/world.js";
import { stateHash } from "../src/sim/replay.js";
import { checkWorld } from "../src/sim/validate.js";
import { cellAt } from "../src/sim/terrain.js";
import { ISLAND } from "../src/content/island.js";
import { byId, robot, run, runUntil, tinyWorld } from "./helpers.js";

// The fixed-step contract (PLAN.md §6, §12).

test("a new world is at tick 0, keeps its rules, and lists things in order of id", () => {
  const world = createWorld(ISLAND);
  assert.equal(world.tick, 0);
  assert.deepEqual(checkWorld(world), []);
  assert.deepEqual(
    world.entities.map((e) => e.id),
    ["camp", "depot", "r1", "r2", "r3", "sawmill", "site"],
  );
  assert.deepEqual(
    world.nodes.map((n) => n.id),
    ["grove", "quarry"],
  );
  assert.ok(world.entities.every((e) => statusOf(e) === (e.runtime ? "ready" : "stopped")));
});

test("each tick advances the world by exactly one, and every free entity tries its next step in it", () => {
  const world = createWorld(ISLAND);
  const trace = advanceWorld(world);
  assert.equal(world.tick, 1);
  assert.equal(trace.tick, 1);
  assert.deepEqual(
    trace.evaluated.map((e) => e.entity),
    ["r1", "r2", "r3", "sawmill", "site"],
  );
  assert.deepEqual(
    trace.started.map((s) => `${s.entity} ${s.type}`),
    ["r1 move", "r2 move"],
  );
  // The sawmill has no wood and the site no planks, and the stone pit is across
  // the stream: they wait, with their reasons.
  assert.deepEqual(
    trace.waiting.map((w) => `${w.entity} ${w.reason.code}`),
    ["r3 wait.route", "sawmill wait.item", "site wait.item"],
  );
});

test("an action started in tick T for d ticks ends in tick T + d, and its entity takes its next step in that same tick", () => {
  const world = tinyWorld({
    entities: [
      robot("r1", [1, 1], [
        { type: "wait", steps: 5 },
        { type: "goTo", target: "box" },
        { type: "wait", steps: 1 },
      ]),
      { id: "box", type: "depot", name: "box", area: { x: 6, z: 1, w: 1, d: 1 }, access: [[5, 1]], caps: {} },
    ],
  });
  const traces = run(world, 20);
  const at = (tick) => traces[tick - 1];
  const r1 = byId(world, "r1");
  assert.deepEqual(at(1).started, [{ entity: "r1", type: "wait" }]);
  assert.deepEqual(at(6).ended, [{ entity: "r1", type: "wait" }], "5 ticks after tick 1");
  assert.deepEqual(at(6).started, [{ entity: "r1", type: "move" }], "and the next step starts in tick 6");
  // Four cells east at 3 ticks a cell: 12 ticks.
  assert.deepEqual(at(18).ended, [{ entity: "r1", type: "move" }]);
  assert.equal(r1.cell, cellAt(world.terrain, 5, 1));
  assert.deepEqual(at(18).started, [{ entity: "r1", type: "wait" }]);
  assert.deepEqual(at(19).ended, [{ entity: "r1", type: "wait" }], "even a wait of 1 takes a tick");
  assert.equal(statusOf(r1), "stopped");
});

test("a robot on its way reaches a cell every perCell ticks", () => {
  const world = tinyWorld({ entities: [robot("r1", [1, 2], [{ type: "goTo", target: "box" }]), { id: "box", type: "depot", name: "box", area: { x: 8, z: 1, w: 1, d: 1 }, access: [[4, 2]], caps: {} }] });
  const r1 = byId(world, "r1");
  const seen = [];
  for (let i = 0; i < 10; i++) {
    run(world, 1);
    seen.push(r1.cell % world.terrain.width);
  }
  // Started in tick 1: cell 2 at tick 4, 3 at 7, 4 at 10.
  assert.deepEqual(seen, [1, 1, 1, 2, 2, 2, 3, 3, 3, 4]);
  assert.equal(r1.action, null);
});

test("the same world and commands give the same world, tick for tick", () => {
  const a = createWorld(ISLAND);
  const b = createWorld(ISLAND);
  const commands = { 50: [{ type: "restart", entity: "r1" }], 120: [{ type: "stock", at: "sawmill", item: "wood", count: 4 }] };
  for (let i = 0; i < 600; i++) {
    advanceWorld(a, commands[a.tick + 1] ?? []);
    advanceWorld(b, commands[b.tick + 1] ?? []);
    if (a.tick % 50 === 0) assert.equal(stateHash(a), stateHash(b), `tick ${a.tick}`);
  }
  assert.deepEqual(a, b);
});

test("a world saved in the middle of everything, and loaded, goes on exactly as the original", () => {
  const world = createWorld(ISLAND);
  // A moment with a robot between two cells, the sawmill at work and an intent waiting.
  runUntil(
    world,
    (w) =>
      w.entities.some((e) => e.action?.type === "move" && (w.tick - e.action.start) % e.action.perCell) &&
      byId(w, "sawmill").action?.type === "make" &&
      w.entities.some((e) => e.pending),
  );
  const loaded = JSON.parse(JSON.stringify(world));
  run(world, 900);
  run(loaded, 900);
  assert.deepEqual(loaded, world);
});

test("the world holds ids, numbers and codes, never words to show", () => {
  const world = createWorld(ISLAND);
  run(world, 1200);
  const words = [];
  const visit = (value, path) => {
    if (typeof value === "string") {
      if (!/^[A-Za-z0-9._-]*$/.test(value)) words.push(`${path}: ${value}`);
    } else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) visit(v, `${path}.${k}`);
  };
  const { terrain, ...rest } = world; // the map's characters, which aren't words either
  visit(rest, "world");
  assert.deepEqual(words, []);
  assert.deepEqual(world.entities[0].name, { key: "entity.camp" }, "names are messages to word when shown");
});
