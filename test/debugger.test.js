import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND } from "../src/content/island.js";
import { createGame, NEXT_BLOCK_TICKS, tookNewStep } from "../src/game.js";
import { applyDraft, createLibrary, setDraft } from "../src/programming/programs.js";
import { stateHash } from "../src/sim/replay.js";
import { runtimeOf } from "../src/sim/runtimes.js";
import { createWorld } from "../src/sim/world.js";
import { takeSnapshot, entryIn } from "../src/ui/snapshot.js";
import { bot, byId, tinyWorld } from "./helpers.js";
import { collect, compare, go, num, program, stock, until, wait, when } from "./programs.js";

// The world-wide debugger (PLAN.md §6, §8, §11 Phase 4): Step to Next Block on
// the one clock, and the snapshot every execution view draws from.

const island = () => createGame(createWorld(ISLAND));
const pile = (wood) => ({ id: "pile", type: "grove", name: "pile", area: { x: 6, z: 1, w: 1, d: 1 }, access: [[5, 1]], items: { wood }, caps: { wood: 10 } });

// Steps `game` one tick at a time until entity `id` (or anyone, for null) takes
// a new step, as Next Block should, for NEXT_BLOCK_TICKS at most: the ticks it
// took.
function stepByHand(game, id) {
  const watched = id ? [byId(game.world, id)] : game.world.entities;
  for (let n = 1; n < NEXT_BLOCK_TICKS; n++) {
    const before = watched.map((e) => runtimeOf(e)?.active(e) ?? null);
    game.step();
    if (game.world.stall || watched.some((e, i) => tookNewStep(game.trace, e.id, before[i]))) return n;
  }
  game.step();
  return NEXT_BLOCK_TICKS;
}

test("Next block stops when the chosen robot takes its next block, a long walk included", () => {
  const game = island();
  const at = () => [game.world.tick, byId(game.world, "r1").runtime.block];
  const seen = [];
  for (let i = 0; i < 4; i++) {
    game.nextBlock("r1");
    seen.push(at());
  }
  assert.deepEqual(seen, [
    [1, "collector-forever"],
    [2, "collector-go-grove"],
    [26, "collector-repeat"], // eight cells to the grove
    [27, "collector-take"],
  ]);
  assert.equal(game.clock.running, false, "and leaves the world paused");
});

test("every other entity moves on in the same ticks, exactly as if Step were pressed that often", () => {
  const jumped = island();
  const stepped = island();
  const took = [];
  for (const id of ["r1", "sawmill", null, "r2", "site", null, "r1", "r3", null]) {
    const ticks = jumped.nextBlock(id);
    took.push(ticks);
    assert.equal(stepByHand(stepped, id), ticks, `next block for ${id}`);
    assert.equal(stateHash(jumped.world), stateHash(stepped.world), `the same world after next block for ${id}`);
  }
  assert.ok(took.includes(NEXT_BLOCK_TICKS), "the site waits longer for its planks than Next block goes on for");
});

test("a Wait Until tried again and still false isn't a new block: Next block runs on until it holds", () => {
  const game = island();
  game.nextBlock("sawmill");
  game.nextBlock("sawmill");
  assert.deepEqual([game.world.tick, byId(game.world, "sawmill").runtime.block], [2, "planks-until"], "arriving at it is");
  const ticks = game.nextBlock("sawmill");
  assert.ok(ticks > 30, `${ticks} ticks, until wood came to the sawmill`);
  assert.deepEqual(
    game.trace.evaluated.find((e) => e.entity === "sawmill"),
    { entity: "sawmill", block: "planks-until", test: true },
  );
  game.nextBlock("sawmill");
  assert.equal(byId(game.world, "sawmill").runtime.block, "planks-make");
});

test("with nothing chosen, or one that can't go on, Next block stops when anyone takes a new step", () => {
  const world = tinyWorld({
    entities: [bot("r1", [1, 1], "short"), bot("r2", [1, 2], "long")],
    programs: { short: program(go("g", "nowhere-near")), long: program(wait("w", 40), wait("v", 1)) },
    nodes: [{ ...pile(5), id: "nowhere-near" }],
  });
  const game = createGame(world);
  assert.equal(game.nextBlock(null), 1, "both took their first block");
  byId(world, "r1").error = { code: "error.target", target: "x", block: "g" };
  assert.equal(game.nextBlock("r1"), 40, "r1 has stopped, so it waits for r2's next block");
  assert.equal(byId(world, "r2").runtime.block, "v");
});

test("Next block stops when the whole world stalls, and gives up after its limit", () => {
  const stalled = createGame(tinyWorld({ entities: [bot("r1", [5, 1], "p")], nodes: [pile(0)], programs: { p: program(collect("c")) } }));
  assert.equal(stalled.nextBlock("r1"), 1);
  assert.ok(stalled.world.stall, "collecting at an empty pile, with nothing else going on");
  assert.equal(stalled.nextBlock("r1"), 1, "stalled: nothing can change, so it stops at once");

  const waiting = createGame(tinyWorld({ entities: [bot("r1", [5, 1], "p")], programs: { p: program(wait("w", 900)) } }));
  waiting.nextBlock("r1");
  assert.equal(waiting.nextBlock("r1", 50), 50);
  assert.equal(waiting.nextBlock("r1"), 600, "a minute of play at most");
});

// --- The snapshot ------------------------------------------------------------

test("the snapshot says, for every robot and building, its state, program, block and whether it took it this tick", () => {
  const game = island();
  const before = takeSnapshot(game.world, null);
  assert.equal(before.tick, 0);
  const nothingMore = { memory: [], inside: [], inbox: [], listens: false };
  assert.deepEqual(entryIn(before, "r1"), { id: "r1", kind: "robot", state: "ready", reason: null, program: "collector", revision: 1, block: null, fresh: false, round: null, readings: {}, ...nothingMore });
  assert.deepEqual(entryIn(before, "camp"), { id: "camp", kind: "building", state: "stopped", reason: null, program: null, revision: null, block: null, fresh: false, round: null, readings: {}, ...nothingMore });
  assert.deepEqual(
    before.programs.map((p) => [p.id, p.runners]),
    [
      ["bridge", ["site"]],
      ["collector", ["r1"]],
      ["courier", ["r2"]],
      ["planks", ["sawmill"]],
      ["stones", ["r3"]],
    ],
  );

  game.step();
  game.step();
  const two = takeSnapshot(game.world, null);
  assert.deepEqual(
    [entryIn(two, "r1").state, entryIn(two, "r1").block, entryIn(two, "r1").fresh],
    ["moving", "collector-go-grove", true],
  );
  assert.deepEqual(entryIn(two, "site").reason, { code: "wait.item", item: "plank", at: "site", need: 4, have: 0 });
  game.step();
  assert.equal(entryIn(takeSnapshot(game.world, null), "r1").fresh, false, "a long walk keeps its block, but took it in an earlier tick");
  assert.equal(entryIn(takeSnapshot(game.world, null), "r1").block, "collector-go-grove");
});

test("the snapshot has what a block's conditions read, and how far round a Repeat it is", () => {
  const game = island();
  game.step();
  game.step();
  const sawmill = entryIn(takeSnapshot(game.world, null), "sawmill");
  assert.equal(sawmill.block, "planks-until");
  assert.deepEqual(sawmill.readings, { "planks-compare": false, "planks-wood": 0 });
  assert.deepEqual(sawmill.reason, { code: "wait.until", block: "planks-until" });

  game.nextBlock("r1");
  game.nextBlock("r1");
  const r1 = entryIn(takeSnapshot(game.world, null), "r1");
  assert.equal(r1.block, "collector-take");
  assert.deepEqual(r1.round, { block: "collector-repeat", count: 1, times: 2 });
  assert.deepEqual(r1.readings, {}, "an action reads nothing");

  // An If reads its conditions in order, as far as the first that holds.
  const world = tinyWorld({
    entities: [bot("r1", [5, 1], "p")],
    nodes: [pile(3)],
    programs: { p: program(when("if", [[compare("a", stock("s1", "wood", "pile"), "GT", num("n1", 5)), [wait("x", 1)]], [compare("b", stock("s2", "wood", "pile"), "GT", num("n2", 1)), [wait("y", 1)]], [compare("c", stock("s3", "wood", "pile"), "GT", num("n3", 0)), [wait("z", 1)]]])) },
  });
  createGame(world).step();
  assert.deepEqual(entryIn(takeSnapshot(world, null), "r1").readings, { a: false, s1: 3, b: true, s2: 3 });
});

test("the snapshot names the newest revision applied, while the world still runs the one before", () => {
  const library = createLibrary(ISLAND.programs);
  const game = island();
  setDraft(library, "planks", JSON.parse(JSON.stringify(library.programs.find((p) => p.id === "planks").draft).replace('"OP":"GT"', '"OP":"GTE"')));
  game.queue(applyDraft(library, "planks", { types: ["sawmill"] }).command);
  assert.deepEqual(takeSnapshot(game.world, library).programs.find((p) => p.id === "planks"), { id: "planks", revision: 1, newest: 2, runners: ["sawmill"] });
  game.step();
  const after = takeSnapshot(game.world, library);
  assert.deepEqual(after.programs.find((p) => p.id === "planks"), { id: "planks", revision: 2, newest: 2, runners: ["sawmill"] });
  assert.equal(entryIn(after, "sawmill").revision, 2);
});

test("a snapshot is plain data, and stays as it was while the world moves on", () => {
  const game = island();
  for (let i = 0; i < 40; i++) game.step();
  const snapshot = takeSnapshot(game.world, null);
  const copy = JSON.parse(JSON.stringify(snapshot));
  assert.deepEqual(snapshot, copy);
  for (let i = 0; i < 40; i++) game.step();
  assert.deepEqual(snapshot, copy);
  assert.equal(snapshot.tick, 40);
});
