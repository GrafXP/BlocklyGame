import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND } from "../src/content/island.js";
import { ISLAND_PROGRAMS } from "../src/content/programs.js";
import { SLICE } from "../src/content/missions/slice.js";
import { compile } from "../src/programming/compiler.js";
import { choicesOf, makeChoices, programFor } from "../src/sim/bindings.js";
import { applyCommand } from "../src/sim/commands.js";
import { stateHash } from "../src/sim/replay.js";
import { checkWorld } from "../src/sim/validate.js";
import { advanceWorld, createWorld, reasonOf, statusOf } from "../src/sim/world.js";
import { byId, run, runUntil, tinyWorld } from "./helpers.js";
import { collect, go, my, program, unload, wait } from "./programs.js";

// Who runs what (PLAN.md §5, §11 Phase 6): an entity's own program, else its
// team's, else its type's; a change to any of them starts again exactly those
// whose program changes, at the next tick; robots sharing a program keep their
// own runtime state and settings; and settings are read where a program uses
// them.

const copy = (value) => JSON.parse(JSON.stringify(value));
const island = () => createWorld(ISLAND);
const publish = (id, revision, edit = (json) => json) => {
  const source = JSON.parse(edit(JSON.stringify(ISLAND_PROGRAMS.find((p) => p.id === id).source)));
  return { type: "publish", program: { id, revision, ...compile(source).program } };
};

// A field with a wood pile at its west end and a stone pile at its east, a
// depot between them, and two robots running the shared fetch-once program,
// "f", each with its own settings.
const fetchOnce = program(go("gs", my("src", "source")), collect("c", my("it", "item")), go("gd", my("dst", "destination")), unload("u"));
function piles({ settings = {}, robots = ["a", "b"] } = {}) {
  const at = { a: [3, 2], b: [5, 2] };
  return createWorld({
    id: "test",
    version: 1,
    terrain: ["~~~~~~~~~~", "~........~", "~........~", "~........~", "~~~~~~~~~~"],
    programs: [{ id: "f", source: fetchOnce }],
    roles: [{ id: "team", name: "team", program: "f" }],
    entities: [
      ...robots.map((id) => ({ id, type: "helper", name: id, cell: at[id], role: "team", settings: settings[id] })),
      { id: "depot", type: "depot", name: "depot", area: { x: 4, z: 3, w: 2, d: 1 }, access: [[4, 2]], caps: { wood: 9, stone: 9 } },
    ],
    nodes: [
      { id: "woods", type: "grove", name: "woods", area: { x: 1, z: 1, w: 1, d: 1 }, access: [[2, 1]], items: { wood: 4 }, caps: { wood: 4 } },
      { id: "rocks", type: "quarry", name: "rocks", area: { x: 8, z: 1, w: 1, d: 1 }, access: [[7, 1]], items: { stone: 4 }, caps: { stone: 4 } },
    ],
  });
}

test("an entity runs its own program, else its team's, else its type's", () => {
  const world = island();
  const runs = () => Object.fromEntries(world.entities.map((e) => [e.id, e.runtime?.program ?? null]));
  assert.deepEqual(runs(), { camp: null, depot: null, r1: "collector", r2: "courier", r3: "stones", sawmill: "planks", site: "bridge" });
  for (const e of world.entities) assert.equal(programFor(world, e), runs()[e.id]);
  assert.deepEqual(
    world.roles.map((r) => [r.id, r.program]),
    [
      ["plank-team", "courier"],
      ["stone-team", "stones"],
      ["wood-team", "collector"],
    ],
  );
  // Its own program wins over its team's; without its team, the type's (none
  // for robots here).
  run(world, 1, { 1: [{ type: "assign", entity: "r1", program: "fetch" }] });
  assert.equal(byId(world, "r1").runtime.program, "fetch");
  run(world, 1, { 2: [{ type: "assign", entity: "r1", program: null }] });
  assert.equal(byId(world, "r1").runtime.program, "collector", "back to its team's");
  run(world, 1, { 3: [{ type: "role", entity: "r1", role: null }] });
  assert.equal(byId(world, "r1").runtime, null, "no team, no own program, no type's: none");
  assert.equal(statusOf(byId(world, "r1")), "stopped");
});

test("robots sharing a program each keep their own place in it, and each reads its own settings", () => {
  const world = piles({ settings: { a: { source: "woods", item: "wood", destination: "depot" }, b: { source: "rocks", item: "stone", destination: "depot" } } });
  const traces = [];
  const a = byId(world, "a");
  const b = byId(world, "b");
  while (!(a.runtime.ended && b.runtime.ended)) traces.push(...run(world, 1));
  assert.deepEqual(byId(world, "depot").store.items, { wood: 1, stone: 1 }, "one program, two jobs");
  assert.ok(
    traces.some((t) => {
      const [x, y] = t.states.filter((s) => s.entity === "a" || s.entity === "b").map((s) => s.block);
      return x && y && x !== y;
    }),
    "at some step they're at different blocks of the same program",
  );
  // The trace says where each robot's settings sent it.
  const intents = (id) => traces.flatMap((t) => t.evaluated.filter((e) => e.entity === id && e.intent).map((e) => e.intent));
  assert.deepEqual(intents("a"), [
    { type: "goTo", target: "woods" },
    { type: "collect", item: "wood" },
    { type: "goTo", target: "depot" },
    { type: "unload" },
  ]);
  assert.deepEqual(intents("b")[1], { type: "collect", item: "stone" });
});

test("a setting that isn't chosen stops the program at the block that reads it; one changed is read when the block next runs", () => {
  const world = piles({ settings: { a: { source: "woods", item: "wood" } }, robots: ["a"] });
  runUntil(world, (w) => byId(w, "a").error);
  const a = byId(world, "a");
  assert.deepEqual(a.error, { code: "error.setting", setting: "destination", block: "dst" });
  assert.equal(a.runtime.block, "gd", "the action whose input it is stays the active block");
  assert.deepEqual(reasonOf(a), a.error);
  // Choosing it, and starting again, it goes on; a change while it's on its way
  // doesn't turn it round: the walk was decided when its block ran.
  const commands = { [world.tick + 1]: [{ type: "settings", entity: "a", settings: { destination: "depot" } }, { type: "restart", entity: "a" }] };
  run(world, 1, commands);
  runUntil(world, (w) => byId(w, "a").action?.type === "move" && byId(w, "a").action.target === "depot");
  run(world, 1, { [world.tick + 1]: [{ type: "settings", entity: "a", settings: { destination: "woods" } }] });
  assert.equal(byId(world, "a").action.target, "depot");
  assert.equal(byId(world, "a").settings.destination, "woods");
  assert.deepEqual(checkWorld(world), []);
});

test("Apply to a shared program starts again exactly the robots that run it, at the next tick; the rest carry on as if nothing happened", () => {
  const world = island();
  run(world, 1, { 1: [{ type: "role", entity: "r2", role: "wood-team" }] });
  run(world, 80);
  const other = copy(world);
  const command = publish("collector", 2, (json) => json.replace('"PLACE":"sawmill"', '"PLACE":"depot"'));
  const [trace] = run(world, 1, { [world.tick + 1]: [command] });
  run(other, 1);
  assert.deepEqual(trace.commands, [{ ok: true }]);
  for (const id of ["r1", "r2"]) {
    const e = byId(world, id);
    assert.equal(e.runtime.revision, 2, id);
    assert.equal(e.runtime.block, "collector-forever", `${id} started again, and took its first block in that tick`);
    assert.deepEqual(e.store.items, {}, `${id} starts with an empty basket`);
  }
  for (const id of ["r3", "sawmill", "site", "camp", "depot"]) assert.deepEqual(byId(world, id), byId(other, id), `${id} carries on as it would have`);
});

test("giving a team or a type a program starts again exactly those whose program changes", () => {
  const world = island();
  run(world, 40);
  const before = copy(world);
  const [trace] = run(world, 1, {
    [world.tick + 1]: [
      { type: "role", entity: "r3", role: "wood-team" },
      { type: "default", role: "wood-team", program: "fetch" },
    ],
  });
  assert.deepEqual(trace.commands, [{ ok: true }, { ok: true }]);
  assert.equal(byId(world, "r1").runtime.program, "fetch");
  assert.equal(byId(world, "r3").runtime.program, "fetch");
  assert.equal(byId(world, "r1").runtime.block, "fetch-forever");
  assert.equal(byId(world, "r2").runtime.revision, byId(before, "r2").runtime.revision);
  assert.notEqual(byId(world, "r2").runtime.evaluated, null);
  // A type's program: every sawmill, and nothing else.
  const mill = byId(world, "sawmill").runtime;
  run(world, 1, { [world.tick + 1]: [{ type: "default", entityType: "sawmill", program: "planks" }] });
  assert.equal(byId(world, "sawmill").runtime.program, "planks");
  assert.equal(byId(world, "sawmill").runtime, mill, "the same program as before: it carries on, in the same runtime");
  // A type that had no program gets one, if its buildings can run it.
  const rest = { type: "publish", program: { id: "rest", revision: 1, ...compile(program(wait("w", 5))).program } };
  const [t2] = run(world, 1, { [world.tick + 1]: [{ type: "default", entityType: "depot", program: "planks" }, rest, { type: "default", entityType: "depot", program: "rest" }] });
  assert.deepEqual(
    t2.commands.map((c) => c.ok),
    [false, true, true],
    "a depot can't make planks",
  );
  assert.equal(byId(world, "depot").runtime.program, "rest");
  assert.deepEqual(
    world.defaults.map((d) => d.type),
    ["depot", "sawmill", "workshop"],
  );
});

test("a parked program starts when it's started, and a new revision of it stays parked", () => {
  const world = createWorld(SLICE.content);
  assert.equal(byId(world, "r3").runtime.parked, true);
  run(world, 1, { 1: [publish("stones", 2)] });
  assert.equal(byId(world, "r3").runtime.parked, true);
  assert.equal(byId(world, "r3").runtime.revision, 2);
  run(world, 1, { 2: [{ type: "start", entity: "r3" }] });
  assert.equal(byId(world, "r3").runtime.parked, undefined);
  assert.equal(byId(world, "r3").runtime.block, "stones-forever");
  assert.equal(byId(world, "r3").runtime.program, "stones", "starting it changes nothing about who runs what");
  assert.equal(byId(world, "r3").own, null);
});

test("a robot's name is a message until the player names it", () => {
  const world = island();
  assert.deepEqual(byId(world, "r1").name, { key: "entity.robo", params: { n: 1 } });
  const [trace] = run(world, 1, {
    1: [
      { type: "name", entity: "r1", name: "  Blinky  " },
      { type: "name", entity: "r2", name: "" },
      { type: "name", entity: "r2", name: "x".repeat(25) },
      { type: "name", entity: "sawmill", name: "Mill" },
    ],
  });
  assert.deepEqual(
    trace.commands.map((c) => c.ok),
    [true, false, false, false],
  );
  assert.equal(byId(world, "r1").name, "Blinky");
});

test("a command that doesn't fit changes nothing", () => {
  const world = island();
  run(world, 30);
  const before = stateHash(world);
  const bad = [
    { type: "assign", entity: "r1", program: "planks" }, // a robot can't make planks
    { type: "assign", entity: "r1", program: "nothing" },
    { type: "assign", entity: "r1" },
    { type: "role", entity: "sawmill", role: "wood-team" }, // buildings have no team
    { type: "role", entity: "r1", role: "no-team" },
    { type: "default", role: "wood-team", program: "planks" }, // its robots can't run it
    { type: "default", role: "no-team", program: "fetch" },
    { type: "default", entityType: "grove", program: "planks" },
    { type: "default", entityType: "depot", program: "no-program" },
    { type: "start", entity: "camp" },
    { type: "settings", entity: "r1", settings: { source: "moon" } },
    { type: "settings", entity: "r1", settings: { item: "gold" } },
    { type: "settings", entity: "r1", settings: { colour: "red" } },
    { type: "settings", entity: "sawmill", settings: { source: "grove" } },
    { type: "settings", entity: "r1", settings: { source: "grove", item: "gold" } },
  ];
  const world2 = copy(world);
  const traceOf = advanceWorld(world, bad);
  advanceWorld(world2, []);
  assert.deepEqual(
    traceOf.commands.map((c) => c.ok),
    bad.map(() => false),
  );
  assert.notEqual(before, stateHash(world));
  assert.equal(stateHash(world), stateHash(world2), "as if they'd never been given");
});

test("the player's choices carry over to a fresh start of the same world: teams, programs, settings and names", () => {
  const world = island();
  run(world, 1, {
    1: [
      { type: "role", entity: "r2", role: "wood-team" },
      { type: "assign", entity: "r3", program: "fetch" },
      { type: "settings", entity: "r3", settings: { destination: "camp" } },
      { type: "name", entity: "r1", name: "Blinky" },
      { type: "default", entityType: "sawmill", program: "planks" },
    ],
  });
  run(world, 200);
  const fresh = island();
  makeChoices(fresh, choicesOf(world));
  assert.deepEqual(checkWorld(fresh), []);
  assert.equal(fresh.tick, 0);
  assert.equal(byId(fresh, "r2").runtime.program, "collector");
  assert.equal(byId(fresh, "r2").runtime.at, 0, "from its start");
  assert.equal(byId(fresh, "r3").runtime.program, "fetch");
  assert.equal(byId(fresh, "r3").settings.destination, "camp");
  assert.equal(byId(fresh, "r1").name, "Blinky");
  assert.deepEqual(byId(fresh, "r1").runtime, byId(island(), "r1").runtime, "an unchanged robot is as a fresh world has it");
  // Choices that don't fit another world are left out: no such program, team
  // or place there.
  const slice = createWorld(SLICE.content);
  makeChoices(slice, choicesOf(world));
  assert.deepEqual(checkWorld(slice), []);
  assert.equal(byId(slice, "r3").own, null, "the slice has no Collector program");
  assert.equal(byId(slice, "r3").runtime.parked, true, "so Robo 3 keeps its parked program");
});

test("every robot's own settings stay plain ids, and a world with settings saves and loads exactly", () => {
  const world = piles({ settings: { a: { source: "woods", item: "wood", destination: "depot" }, b: { source: "rocks", item: "stone", destination: "depot" } } });
  run(world, 9);
  const loaded = JSON.parse(JSON.stringify(world));
  run(world, 40);
  run(loaded, 40);
  assert.deepEqual(loaded, world);
  assert.deepEqual(
    applyCommand(world, { type: "settings", entity: "a", settings: { source: null } }),
    { ok: true },
    "a setting can be cleared",
  );
  assert.equal(byId(world, "a").settings.source, null);
  assert.deepEqual(tinyWorld().roles, []);
});
