import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND } from "../src/content/island.js";
import { checkPlacement, layout } from "../src/sim/placement.js";
import { RECIPES } from "../src/sim/recipes.js";
import { stateHash } from "../src/sim/replay.js";
import { advanceWorld, createWorld, reasonOf, statusOf } from "../src/sim/world.js";
import { byId, run, runUntil } from "./helpers.js";
import { forever, go, make, pickUp, program, repeat, unload } from "./programs.js";

// Placing buildings (PLAN.md §11, Phase 6): a blueprint fits only on open
// ground clear of everything, and never cuts a robot off from anything it can
// reach, now or once the bridges are built; its construction site runs a
// starter program, builds the building when robots have brought its
// materials, and becomes it. The workshop makes a kit from two planks and a
// stone (docs/campaign-plan.md, mission 25).

const island = () => createWorld(ISLAND);
const workshop = (x, z, facing = "south") => ({ blueprint: "workshop", x, z, facing });
const problem = (world, request) => checkPlacement(world, request).problem ?? null;

test("a blueprint's footprint turns with it, and its front is the row of cells it faces", () => {
  assert.deepEqual(layout(workshop(4, 4, "south")), {
    area: { x: 4, z: 4, w: 3, d: 2 },
    front: [
      [4, 6],
      [5, 6],
      [6, 6],
    ],
  });
  assert.deepEqual(layout(workshop(4, 4, "north")).front, [
    [4, 3],
    [5, 3],
    [6, 3],
  ]);
  assert.deepEqual(layout(workshop(4, 4, "east")), {
    area: { x: 4, z: 4, w: 2, d: 3 },
    front: [
      [6, 4],
      [6, 5],
      [6, 6],
    ],
  });
  assert.deepEqual(layout(workshop(4, 4, "west")).front, [
    [3, 4],
    [3, 5],
    [3, 6],
  ]);
});

test("on the island, a workshop fits on open ground, east of the stream too, before the bridge is built", () => {
  const world = island();
  assert.deepEqual(checkPlacement(world, workshop(24, 17)), {
    area: { x: 24, z: 17, w: 3, d: 2 },
    access: [
      [24, 19],
      [25, 19],
      [26, 19],
    ].map(([x, z]) => z * 32 + x),
  });
  assert.deepEqual(problem(world, workshop(1, 1)), { code: "place.ground" }, "the sea");
  assert.deepEqual(problem(world, workshop(30, 30)), { code: "place.ground" }, "off the map");
  assert.deepEqual(problem(world, workshop(19, 14)), { code: "place.ground" }, "the stream");
  assert.deepEqual(problem(world, workshop(13, 5)), { code: "place.taken", thing: "sawmill" });
  assert.deepEqual(problem(world, workshop(12, 8)), { code: "place.blocks", thing: "sawmill" }, "in front of it, where robots use it");
  assert.deepEqual(problem(world, workshop(9, 16, "east")), { code: "place.taken", thing: "camp" });
});

test("a building that would cut a robot off from something it can reach can't be placed", () => {
  // A passage three cells high between a robot and a grove; a workshop facing
  // east fills it.
  const world = createWorld({
    id: "test",
    version: 1,
    terrain: ["~~~~~~~~~~~~~", "~...~~~~~...~", "~...........~", "~...........~", "~...........~", "~...~~~~~...~", "~~~~~~~~~~~~~"],
    entities: [{ id: "r1", type: "helper", name: "r1", cell: [2, 3] }],
    nodes: [{ id: "woods", type: "grove", name: "woods", area: { x: 10, z: 1, w: 1, d: 1 }, access: [[10, 2]], items: { wood: 1 }, caps: { wood: 1 } }],
  });
  assert.deepEqual(problem(world, workshop(5, 2, "east")), { code: "place.cutOff", thing: "woods" });
  assert.equal(problem(world, workshop(5, 2, "south")), null, "facing south it leaves a row open");
  // Where no robot can get, now or ever.
  const islet = createWorld({
    id: "test",
    version: 1,
    terrain: ["~~~~~~~~~~~~", "~...~......~", "~...~......~", "~...~......~", "~...~......~", "~~~~~~~~~~~~"],
    entities: [{ id: "r1", type: "helper", name: "r1", cell: [2, 2] }],
    nodes: [],
  });
  assert.deepEqual(problem(islet, workshop(6, 1)), { code: "place.unreachable" });
  // A robot stepping onto it counts as standing there.
  const field = createWorld({
    id: "test",
    version: 1,
    terrain: ["~~~~~~~~~~", "~........~", "~........~", "~........~", "~........~", "~~~~~~~~~~"],
    programs: [],
    entities: [{ id: "r1", type: "helper", name: "r1", cell: [1, 1], script: { steps: [{ type: "goTo", target: "far" }] } }],
    nodes: [{ id: "far", type: "grove", name: "far", area: { x: 8, z: 4, w: 1, d: 1 }, access: [[7, 4]], items: { wood: 1 }, caps: { wood: 1 } }],
  });
  assert.deepEqual(problem(field, workshop(1, 1)), { code: "place.robot", robot: "r1" }, "standing there");
  run(field, 3);
  assert.equal(field.entities[0].cell, 1 * 10 + 1, "still on its first cell, on its way to the next");
  const next = field.entities[0].action.path[1];
  const [nx, nz] = [next % 10, Math.floor(next / 10)];
  assert.deepEqual(problem(field, workshop(nx, nz, "south")), { code: "place.robot", robot: "r1" });
});

test("placing a workshop makes a construction site running its builder, and robots find their ways round it", () => {
  const world = island();
  run(world, 20);
  const nav = world.nav;
  const [trace] = run(world, 1, { [world.tick + 1]: [{ type: "place", ...workshop(24, 17), program: "build-workshop" }] });
  assert.deepEqual(trace.commands, [{ ok: true }]);
  const site = byId(world, "workshop");
  assert.equal(site.type, "site");
  assert.equal(site.blueprint, "workshop");
  assert.deepEqual(site.name, { key: "entity.workshopSite" });
  assert.deepEqual(site.store.caps, RECIPES.workshop.inputs);
  assert.equal(site.own, "build-workshop");
  assert.equal(site.runtime.block, "build-workshop-build", "it starts at once, and waits for its materials");
  assert.equal(world.nav, nav + 1, "the ways change");
  run(world, 1);
  assert.deepEqual(reasonOf(byId(world, "workshop")), { code: "wait.item", item: "plank", at: "workshop", need: 4, have: 0 });
  // A second one gets the next id; one in the same place doesn't fit.
  const [t2] = run(world, 1, { [world.tick + 1]: [{ type: "place", ...workshop(24, 17), program: "build-workshop" }, { type: "place", ...workshop(24, 12), program: "build-workshop" }] });
  assert.deepEqual(
    t2.commands.map((c) => c.ok),
    [false, true],
  );
  assert.deepEqual(byId(world, "workshop-2").name, { key: "entity.workshopSiteN", params: { n: 2 } });
  // The bridge's site can't build a workshop, nor a workshop's site a bridge.
  assert.equal(byId(world, "site").blueprint, "bridge");
});

test("the site builds the workshop from four planks and two stone, and becomes it; the workshop makes a kit from two planks and a stone", () => {
  const world = island();
  const at = (tick, ...commands) => ({ [tick]: commands });
  run(world, 1, at(1, { type: "place", ...workshop(24, 17), program: "build-workshop" }));
  const traces = run(world, 1, at(2, { type: "stock", at: "workshop", item: "plank", count: 4 }, { type: "stock", at: "workshop", item: "stone", count: 2 }));
  const site = byId(world, "workshop");
  while (site.type !== "workshop") traces.push(...run(world, 1));
  const started = traces.find((t) => t.started.some((s) => s.entity === "workshop")).tick;
  assert.equal(world.tick - started, RECIPES.workshop.ticks, "building takes the recipe's steps");
  assert.deepEqual(site.name, { key: "entity.workshop" });
  assert.deepEqual(site.store, { items: {}, caps: { plank: 4, stone: 2, kit: 4 }, in: {}, out: {} });
  assert.equal("blueprint" in site, false);
  assert.equal(site.own, null);
  assert.equal(site.runtime.program, "kits", "the workshop's own type's program starts");
  assert.equal(site.runtime.block, "kits-forever", "and takes its first block in the same tick");
  run(world, 1);
  assert.deepEqual(reasonOf(site), { code: "wait.item", item: "plank", at: "workshop", need: 2, have: 0 });
  // Two kits' worth.
  run(world, 1, at(world.tick + 1, { type: "stock", at: "workshop", item: "plank", count: 4 }, { type: "stock", at: "workshop", item: "stone", count: 2 }));
  runUntil(world, () => (site.store.items.kit ?? 0) === 2 && statusOf(site) === "waiting");
  assert.deepEqual(site.store.items, { kit: 2 });
  assert.deepEqual(reasonOf(site), { code: "wait.item", item: "plank", at: "workshop", need: 2, have: 0 });
});

test("mission 25's chain: one robot brings four planks in two trips, another two stone in one, and the workshop makes two kits", () => {
  const twoTrips = program(repeat("trips", 2, go("g1", "mill"), repeat("picks", 2, pickUp("p", "plank")), go("g2", "shop"), unload("u")));
  const stoneTrip = program(go("g1", "pit"), repeat("takes", 2, pickUp("c", "stone")), go("g2", "shop"), unload("u"));
  const world = createWorld({
    id: "test",
    version: 1,
    terrain: ["~~~~~~~~~~~~", "~..........~", "~..........~", "~..........~", "~..........~", "~~~~~~~~~~~~"],
    programs: [
      { id: "planks", source: twoTrips },
      { id: "stone", source: stoneTrip },
      { id: "kits", source: program(repeat("two", 2, make("m", "kit"))) },
    ],
    defaults: [{ type: "workshop", program: "kits" }],
    entities: [
      { id: "a", type: "helper", name: "a", cell: [2, 2], program: "planks" },
      { id: "b", type: "helper", name: "b", cell: [2, 3], program: "stone" },
      { id: "mill", type: "sawmill", name: "mill", area: { x: 1, z: 1, w: 1, d: 1 }, access: [[2, 1]], items: { plank: 4 }, caps: { wood: 4, plank: 4 } },
      { id: "shop", type: "workshop", name: "shop", area: { x: 8, z: 1, w: 3, d: 2 }, access: [[8, 3], [9, 3], [10, 3]], caps: { plank: 4, stone: 2, kit: 4 } },
    ],
    nodes: [{ id: "pit", type: "quarry", name: "pit", area: { x: 1, z: 4, w: 1, d: 1 }, access: [[2, 4]], items: { stone: 4 }, caps: { stone: 4 } }],
  });
  const shop = byId(world, "shop");
  const tick = runUntil(world, () => shop.runtime.ended, 2000);
  assert.deepEqual(shop.store.items, { kit: 2 }, "four planks and two stone made two kits");
  assert.deepEqual(byId(world, "mill").store.items, {});
  assert.deepEqual(byId(world, "pit").store.items, { stone: 2 });
  assert.ok(tick < 300, `done at step ${tick}`);
});

test("a world with a workshop being built saves and loads exactly, and the same commands give the same world", () => {
  const log = {
    5: [{ type: "place", ...workshop(24, 17), program: "build-workshop" }],
    9: [
      { type: "stock", at: "workshop", item: "plank", count: 4 },
      { type: "stock", at: "workshop", item: "stone", count: 2 },
    ],
  };
  const play = (world, ticks) => {
    for (let i = 0; i < ticks; i++) advanceWorld(world, log[world.tick + 1] ?? []);
    return world;
  };
  const a = play(island(), 40);
  assert.equal(byId(a, "workshop").action?.type, "make", "mid-build");
  const loaded = JSON.parse(JSON.stringify(a));
  play(a, 120);
  play(loaded, 120);
  assert.deepEqual(loaded, a);
  assert.equal(stateHash(play(island(), 160)), stateHash(a));
  assert.equal(byId(a, "workshop").type, "workshop");
});
