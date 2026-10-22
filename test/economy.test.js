import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../src/programming/expressions.js";
import { applyCommand } from "../src/sim/commands.js";
import { stateHash } from "../src/sim/replay.js";
import { SUPPLY_IDLE, needs } from "../src/sim/supply.js";
import { checkWorld } from "../src/sim/validate.js";
import { createWorld, reasonOf, statusOf } from "../src/sim/world.js";
import { byId, run, runUntil } from "./helpers.js";
import { go, pickUp, program, unload } from "./programs.js";

// Water, food and charge packs (docs/campaign-planv2.md, chapters 7–9;
// SKIRMISH_PLAN.md §3, §4, §7): the well, the farm and the fuel station make
// them by recipe; the camp pays planks and a pack for a new robot, within the
// island's limit; and Supply brings what a building's order still needs, as an
// ordinary courier would, never counting one item twice. Then industry
// (chapters 10–12): stone blocks, charcoal, iron ore and iron bars.

// A field 12 by 5, x 1–10 and z 1–3 walkable: a farm and a well at its west, a
// fuel station and the camp at its east, a spring in the middle.
const FIELD = ["~~~~~~~~~~~~", "~..........~", "~..........~", "~..........~", "~~~~~~~~~~~~"];
const building = (id, type, [x, z], [ax, az], caps, extra = {}) => ({ id, type, name: id, area: { x, z, w: 1, d: 1 }, access: [[ax, az]], caps, ...extra });
const farm = (extra) => building("farm", "farm", [1, 1], [2, 1], { water: 2, food: 4 }, extra);
const well = (extra) => building("well", "well", [1, 3], [2, 3], { water: 2 }, extra);
const station = (extra) => building("station", "station", [10, 1], [9, 1], { food: 4, water: 2, pack: 4 }, extra);
const camp = (extra) => building("camp", "camp", [10, 3], [9, 3], { plank: 4, pack: 2, water: 4 }, extra);
const spring = { id: "spring", type: "spring", name: "spring", area: { x: 5, z: 1, w: 1, d: 1 }, access: [[5, 2]], items: { water: 3 }, caps: { water: 3 } };
const helper = (id, cell, steps, extra = {}) => ({ id, type: "helper", name: id, cell, script: { steps, loop: false }, ...extra });
const scripted = (steps) => ({ script: { steps, loop: false } });

const world = ({ entities, nodes = [], roles = [], programs = {}, limit }) =>
  createWorld({ id: "test", version: 1, terrain: FIELD, entities, nodes, roles, limit, programs: Object.entries(programs).map(([id, source]) => ({ id, source })) });

test("the well draws water from nothing, the farm grows two food from one water, and the fuel station makes two charge packs from two food and a water", () => {
  const w = world({
    entities: [
      well(scripted([{ type: "make", recipe: "water" }, { type: "make", recipe: "water" }, { type: "make", recipe: "water" }])),
      farm({ items: { water: 1 }, ...scripted([{ type: "make", recipe: "food" }]) }),
      station({ items: { food: 2, water: 1 }, ...scripted([{ type: "make", recipe: "pack" }]) }),
    ],
  });
  run(w, 70);
  assert.deepEqual(byId(w, "well").store.items, { water: 2 }, "two buckets, then no room for a third");
  assert.equal(reasonOf(byId(w, "well")).code, "wait.space");
  assert.deepEqual(byId(w, "farm").store.items, { food: 2 }, "the water is used up");
  assert.deepEqual(byId(w, "station").store.items, { pack: 2 });
});

test("the camp pays two planks and a charge pack for a new robot, who stands at its front, on the team it was made for, and does the team's job", () => {
  const job = program(go("g", "spring"), pickUp("p", "water"), go("h", "camp"), unload("u"));
  const w = world({
    entities: [helper("r1", [3, 2], []), camp({ items: { plank: 2, pack: 1 }, ...scripted([{ type: "make", recipe: "helper", role: "water-team" }]) })],
    nodes: [spring],
    roles: [{ id: "water-team", name: "water team", program: "job" }],
    programs: { job },
  });
  run(w, 1);
  assert.equal(byId(w, "camp").action.type, "make");
  assert.equal(byId(w, "camp").action.role, "water-team");
  assert.deepEqual(byId(w, "camp").store.out, { plank: 2, pack: 1 }, "it holds what it pays while it works");
  runUntil(w, (it) => byId(it, "r2"));
  const r2 = byId(w, "r2");
  assert.equal(w.tick, 61, "60 steps of work");
  assert.deepEqual(byId(w, "camp").store.items, {}, "paid for once");
  assert.deepEqual(r2.name, { key: "entity.robo", params: { n: 2 } });
  assert.equal(r2.cell, byId(w, "camp").access[0]);
  assert.equal(r2.role, "water-team");
  assert.equal(r2.runtime.program, "job");
  assert.deepEqual(r2.store.items, {});
  assert.equal(w.entities.findIndex((e) => e.id === "r2"), 2, "kept in order of id");
  runUntil(w, (it) => byId(it, "camp").store.items.water === 1);
  assert.deepEqual(checkWorld(w), []);
});

test("a new robot waits for room under the island's limit, which counts the robots being made", () => {
  const twice = [
    { type: "make", recipe: "helper", role: "team" },
    { type: "make", recipe: "helper", role: "team" },
  ];
  const w = world({
    entities: [helper("r1", [3, 2], []), camp({ items: { plank: 4, pack: 2 }, ...scripted(twice) })],
    roles: [{ id: "team", name: "team", program: null }],
    limit: 2,
  });
  run(w, 1);
  assert.equal(byId(w, "camp").action.type, "make", "one more fits");
  runUntil(w, (it) => byId(it, "r2"));
  run(w, 1);
  assert.deepEqual(reasonOf(byId(w, "camp")), { code: "wait.limit", limit: 2 });
  assert.deepEqual(byId(w, "camp").store.items, { plank: 2, pack: 1 }, "nothing is paid while it waits");
  // With room for one more, it goes on.
  w.limit = 3;
  run(w, 1);
  assert.equal(byId(w, "camp").action?.type, "make");
});

test("making a robot for a team there isn't is an error", () => {
  const w = world({ entities: [camp({ items: { plank: 2, pack: 1 }, ...scripted([{ type: "make", recipe: "helper", role: "nobody" }]) })] });
  run(w, 1);
  assert.deepEqual(byId(w, "camp").error, { code: "error.team", team: "nobody" });
});

// The station orders one batch: two food and a water.
const ORDER = { food: 2, water: 1 };

test("Supply brings what a building's order needs most, from the first place in its list that has it, in a load the basket holds; then its block ends", () => {
  const supply = { type: "supply", to: "station", from: ["spring", "farm", "well"] };
  const w = world({
    entities: [farm({ items: { food: 4 } }), well({ items: { water: 2 } }), station({ order: ORDER }), helper("r1", [5, 3], [supply, supply, supply])],
    nodes: [spring],
  });
  const [first] = run(w, 1);
  const r1 = byId(w, "r1");
  assert.deepEqual(r1.supply, {
    to: "station",
    from: "farm",
    item: "food",
    n: 2,
    steps: [{ type: "goTo", target: "farm" }, { type: "pickUp", item: "food" }, { type: "pickUp", item: "food" }, { type: "goTo", target: "station" }, { type: "unload" }],
    step: 0,
  });
  assert.deepEqual(first.started, [{ entity: "r1", type: "move" }], "its first step starts as the block does");
  assert.equal(needs(w, byId(w, "station"), "food"), 0, "what it's bringing isn't needed again");
  assert.equal(needs(w, byId(w, "station"), "water"), 1);
  // The plan is over with its unload, and the next block, in the same tick,
  // makes the next: the water, from the spring, first in the list.
  runUntil(w, (it) => byId(it, "r1").runtime.at === 1);
  assert.deepEqual(byId(w, "station").store.items, { food: 2 });
  assert.deepEqual([r1.supply.from, r1.supply.item, r1.supply.n], ["spring", "water", 1]);
  runUntil(w, (it) => byId(it, "r1").runtime.at === 2);
  assert.deepEqual(byId(w, "station").store.items, { food: 2, water: 1 });
  // And then nothing is needed: it says so, waits a moment, and its block ends.
  run(w, 1);
  assert.deepEqual(r1.supply, { to: "station", idle: { code: "supply.full", to: "station" }, steps: [], step: 0 });
  assert.equal(statusOf(r1), "waiting");
  assert.deepEqual(reasonOf(r1), { code: "supply.full", to: "station" });
  run(w, SUPPLY_IDLE);
  assert.equal(r1.supply, undefined);
  assert.equal(r1.runtime.at, 3);
});

test("two robots supplying one building never bring one need twice", () => {
  const supply = { type: "supply", to: "station", from: ["farm", "well"] };
  const w = world({
    entities: [farm({ items: { food: 4 } }), well({ items: { water: 2 } }), station({ order: ORDER }), helper("r1", [5, 3], [supply]), helper("r2", [6, 3], [supply])],
  });
  run(w, 1);
  assert.deepEqual([byId(w, "r1").supply.item, byId(w, "r1").supply.n], ["food", 2]);
  assert.deepEqual([byId(w, "r2").supply.item, byId(w, "r2").supply.n], ["water", 1], "the second takes what's left");
  runUntil(w, (it) => !byId(it, "r1").supply && !byId(it, "r2").supply);
  assert.deepEqual(byId(w, "station").store.items, { food: 2, water: 1 });
});

test("with nothing it may take, Supply says what's missing; with no order, that there's none", () => {
  const again = (id, cell, to) => ({ id, type: "helper", name: id, cell, script: { steps: [{ type: "supply", to, from: ["farm"] }], loop: true } });
  const w = world({
    entities: [farm({ items: { food: 4 } }), station({ order: ORDER, items: { food: 2 } }), building("depot", "depot", [5, 1], [5, 2], { food: 4 }), again("r1", [5, 3], "station"), again("r2", [6, 3], "depot")],
  });
  run(w, 1);
  assert.deepEqual(reasonOf(byId(w, "r1")), { code: "supply.none", item: "water", to: "station" });
  assert.deepEqual(reasonOf(byId(w, "r2")), { code: "supply.noOrder", to: "depot" });
  run(w, SUPPLY_IDLE);
  assert.ok(w.stall, "with nothing else going on, nothing can change: a stall");
});

test("Supply can't take from the building it supplies", () => {
  const w = world({ entities: [station({ order: ORDER, items: { food: 2 } }), helper("r1", [5, 3], [{ type: "supply", to: "station", from: ["station"] }])] });
  run(w, 1);
  assert.deepEqual(byId(w, "r1").error, { code: "error.source", target: "station" });
});

test("a building at work uses what it reserved: its order needs it again, so Supply can bring the next batch's while it works", () => {
  const w = world({ entities: [station({ order: ORDER, items: { food: 2, water: 1 }, ...scripted([{ type: "make", recipe: "pack" }]) })] });
  const s = byId(w, "station");
  assert.equal(needs(w, s, "food"), 0);
  run(w, 1);
  assert.deepEqual([needs(w, s, "food"), needs(w, s, "water")], [2, 1]);
});

test("a robot stopped while supplying drops its plan, and what it was bringing is needed again", () => {
  const w = world({ entities: [farm({ items: { food: 4 } }), station({ order: ORDER }), helper("r1", [5, 3], [{ type: "supply", to: "station", from: ["farm"] }])] });
  runUntil(w, (it) => byId(it, "r1").action?.type === "pickUp");
  assert.equal(needs(w, byId(w, "station"), "food"), 0);
  assert.equal(applyCommand(w, { type: "restart", entity: "r1" }).ok, true);
  assert.equal(byId(w, "r1").supply, undefined);
  assert.equal(needs(w, byId(w, "station"), "food"), 2);
  assert.deepEqual(checkWorld(w), []);
});

test("a world in the middle of a Supply and of making a robot saves and loads exactly, and goes on the same", () => {
  const make = () =>
    world({
      entities: [farm({ items: { food: 4 } }), station({ order: ORDER }), camp({ items: { plank: 2, pack: 1 }, ...scripted([{ type: "make", recipe: "helper", role: "team" }]) }), helper("r1", [5, 3], [{ type: "supply", to: "station", from: ["farm"] }])],
      roles: [{ id: "team", name: "team", program: null }],
      limit: 3,
    });
  const w = make();
  run(w, 12);
  const copy = JSON.parse(JSON.stringify(w));
  run(w, 80);
  run(copy, 80);
  assert.equal(stateHash(copy), stateHash(w));
  assert.ok(byId(w, "r2"));
});

// --- Industry (docs/campaign-planv2.md, chapters 10–12) ------------------------
//
// The stonecutter, the kiln and the smelter, in the field's middle row: the
// smelter's batch takes all its ingredients at once; Ready to Make reads
// whether one could start; the smelter is built of planks and stone blocks.

const stonecutter = (extra) => building("stonecutter", "stonecutter", [3, 1], [3, 2], { stone: 4, block: 4 }, extra);
const kiln = (extra) => building("kiln", "kiln", [5, 3], [5, 2], { wood: 4, charcoal: 4 }, extra);
const smelter = (extra) => building("smelter", "smelter", [7, 1], [7, 2], { ironOre: 6, charcoal: 3, water: 3, iron: 6 }, extra);
const mine = { id: "mine", type: "mine", name: "mine", area: { x: 9, z: 3, w: 1, d: 1 }, access: [[9, 2]], items: { ironOre: 2 }, caps: { ironOre: 2 } };

test("the stonecutter cuts two stones into a stone block, the kiln burns two wood into two charcoal, and the smelter makes two iron bars from two ore, a charcoal and a water, taken at once", () => {
  const w = world({
    entities: [
      stonecutter({ items: { stone: 2 }, ...scripted([{ type: "make", recipe: "block" }]) }),
      kiln({ items: { wood: 2 }, ...scripted([{ type: "make", recipe: "charcoal" }]) }),
      smelter({ items: { ironOre: 2, charcoal: 1, water: 1 }, ...scripted([{ type: "make", recipe: "iron" }, { type: "make", recipe: "iron" }]) }),
    ],
  });
  run(w, 1);
  assert.deepEqual(byId(w, "smelter").store.out, { ironOre: 2, charcoal: 1, water: 1 }, "every ingredient held at once");
  assert.deepEqual(byId(w, "smelter").store.in, { iron: 2 }, "and room for the whole batch");
  run(w, 60);
  assert.deepEqual(byId(w, "stonecutter").store.items, { block: 1 });
  assert.deepEqual(byId(w, "kiln").store.items, { charcoal: 2 });
  assert.deepEqual(byId(w, "smelter").store.items, { iron: 2 });
  assert.deepEqual(reasonOf(byId(w, "smelter")), { code: "wait.item", item: "ironOre", at: "smelter", need: 2, have: 0 }, "a second batch needs ore again");
});

test("ore is picked up at the iron mine, a basket space each; bars aren't", () => {
  const w = world({ entities: [helper("r1", [9, 2], [{ type: "pickUp", item: "ironOre" }, { type: "pickUp", item: "iron" }])], nodes: [mine] });
  run(w, 6);
  assert.deepEqual(byId(w, "r1").store.items, { ironOre: 1 });
  assert.deepEqual(byId(w, "r1").error, { code: "error.notHere", action: "pickUp" });
});

test("Ready to Make is true only with every ingredient there and room for the whole batch, and holds nothing; a building without the recipe can't ask", () => {
  const w = world({ entities: [smelter({ items: { ironOre: 2, charcoal: 1 } }), kiln()] });
  const s = byId(w, "smelter");
  const ready = (e) => evaluate({ op: "ready", block: "r", item: "iron" }, e, w);
  assert.equal(ready(s), false, "no water");
  s.store.items.water = 1;
  assert.equal(ready(s), true);
  assert.deepEqual([s.store.in, s.store.out], [{}, {}], "it holds nothing");
  s.store.items.iron = 5;
  assert.equal(ready(s), false, "two more bars won't fit beside five");
  assert.throws(() => ready(byId(w, "kiln")), (e) => e.problem?.code === "error.cannot");
});

test("the smelter's construction site takes planks and stone blocks, not stone, and becomes the smelter", () => {
  const site = building("smelter", "site", [7, 1], [7, 2], { plank: 4, block: 2 }, { blueprint: "smelter", items: { plank: 4, block: 1 }, ...scripted([{ type: "make", recipe: "smelter" }]) });
  const w = world({ entities: [site, helper("r1", [7, 2], [{ type: "unload" }], { items: { stone: 2 } })] });
  run(w, 1);
  assert.deepEqual(reasonOf(byId(w, "r1")), { code: "wait.space", item: "stone", at: "smelter", need: 2, free: 0 }, "no room for stone");
  assert.deepEqual(reasonOf(byId(w, "smelter")), { code: "wait.item", item: "block", at: "smelter", need: 2, have: 1 });
  byId(w, "smelter").store.items.block = 2;
  runUntil(w, (it) => byId(it, "smelter").type === "smelter");
  const built = byId(w, "smelter");
  assert.deepEqual([built.store.items, built.store.caps, "blueprint" in built], [{}, { ironOre: 6, charcoal: 3, water: 3, iron: 6 }, false]);
});
