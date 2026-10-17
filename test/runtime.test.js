import { test } from "node:test";
import assert from "node:assert/strict";
import { blockIndex, readWorkspace } from "../src/programming/adapter.js";
import { COMPILER_VERSION, compile } from "../src/programming/compiler.js";
import { MAX_OPS } from "../src/programming/runtime.js";
import { installProgram } from "../src/sim/commands.js";
import { checkWorld } from "../src/sim/validate.js";
import { ISLAND } from "../src/content/island.js";
import { ISLAND_PROGRAMS } from "../src/content/programs.js";
import { createWorld, reasonOf, statusOf } from "../src/sim/world.js";
import { stateHash } from "../src/sim/replay.js";
import { bot, byId, run, runUntil, tinyWorld } from "./helpers.js";
import { basket, collect, compare, forever, go, make, num, program, repeat, stock, unload, until, wait, when } from "./programs.js";

// Programs on the world clock (PLAN.md §6, §7, §12): one visible block an
// entity a tick at most, long actions keeping their block, waits that wait, and
// every step traced to the block it came from.

// On the field (helpers.js): a wood pile at (6, 1), reached from (5, 1), and a
// sawmill at (6, 3), from (5, 3).
const pile = (wood) => ({ id: "pile", type: "grove", name: "pile", area: { x: 6, z: 1, w: 1, d: 1 }, access: [[5, 1]], items: { wood }, caps: { wood: 10 } });
const mill = (program, items = {}) => ({ id: "mill", type: "sawmill", name: "mill", area: { x: 6, z: 3, w: 1, d: 1 }, access: [[5, 3]], caps: { wood: 4, plank: 4 }, items, program });
const setWood = (count) => ({ type: "stock", at: "pile", item: "wood", count });

// What `entity` evaluated in each trace: its block, and a Repeat's round or an
// If's branch; "-" in a tick it evaluated nothing.
const seen = (traces, entity = "r1") =>
  traces.map((t) => {
    const e = t.evaluated.find((it) => it.entity === entity);
    if (!e) return "-";
    return e.block + (e.round !== undefined ? `:${e.round}` : "") + (e.branch !== undefined ? `:${e.branch}` : "");
  });

test("the start block takes no step; every other block takes one tick, loops and conditions too", () => {
  const world = tinyWorld({ entities: [bot("r1", [5, 1], "p")], programs: { p: program(forever("f", repeat("r", 2, wait("w", 1)))) } });
  const traces = run(world, 10);
  assert.deepEqual(seen(traces), ["f", "r:1", "w", "r:2", "w", "r:0", "f", "r:1", "w", "r:2"]);
  assert.ok(traces.every((t) => t.evaluated.length === 1), "one block a tick, never more");
});

test("a long action keeps its block active; the block after it runs in the very tick it ends", () => {
  const world = tinyWorld({ entities: [bot("r1", [1, 1], "p")], nodes: [pile(5)], programs: { p: program(go("g", "pile"), collect("c"), unload("u")) } });
  const traces = run(world, 18);
  const r1 = (t) => t.states.find((s) => s.entity === "r1");
  // Four cells at 3 ticks a cell: on the way from tick 1 to tick 13.
  assert.deepEqual(seen(traces).slice(0, 13), ["g", ...Array(11).fill("-"), "c"]);
  for (const t of traces.slice(0, 12)) assert.deepEqual(r1(t), { entity: "r1", state: "moving", block: "g" }, `tick ${t.tick}`);
  assert.deepEqual(r1(traces[12]), { entity: "r1", state: "working", block: "c" });
  assert.deepEqual(traces[12].ended, [{ entity: "r1", type: "move" }]);
  assert.deepEqual(traces[12].started, [{ entity: "r1", type: "collect" }], "collecting starts the tick the walk ends");
  // Collecting takes 5 ticks; then Unload, with no building here, can't work,
  // and the error names its block.
  assert.equal(seen(traces)[17], "u");
  assert.deepEqual(byId(world, "r1").error, { code: "error.notHere", action: "unload", block: "u" });
  assert.deepEqual(traces[17].errors, [{ entity: "r1", reason: { code: "error.notHere", action: "unload", block: "u" } }]);
  assert.deepEqual(r1(traces[17]), { entity: "r1", state: "error", block: "u" });
});

test("Wait Until stays active and waiting while its condition is false; the next block runs the tick after it holds", () => {
  const world = tinyWorld({
    entities: [bot("r1", [5, 1], "p")],
    nodes: [pile(0)],
    programs: { p: program(until("u", compare("c", stock("s", "wood", "pile"), "GT", num("n", 0))), collect("k")) },
  });
  const r1 = byId(world, "r1");
  const waiting = run(world, 5);
  assert.deepEqual(
    waiting.map((t) => t.evaluated[0]),
    waiting.map(() => ({ entity: "r1", block: "u", test: false })),
    "evaluated again every tick",
  );
  assert.equal(statusOf(r1), "waiting");
  assert.deepEqual(reasonOf(r1), { code: "wait.until", block: "u" });
  assert.deepEqual(world.stall, { since: 1 }, "nothing else can happen: a stall");

  const [holds] = run(world, 1, { 6: [setWood(1)] });
  assert.deepEqual(holds.evaluated, [{ entity: "r1", block: "u", test: true }]);
  assert.equal(statusOf(r1), "ready");
  assert.equal(world.stall, null);
  assert.deepEqual(holds.started, [], "not in the same tick");
  const [next] = run(world, 1);
  assert.deepEqual(next.evaluated, [{ entity: "r1", block: "k", intent: { type: "collect", item: "wood" } }]);
  assert.deepEqual(next.started, [{ entity: "r1", type: "collect" }]);
});

test("If takes the first branch whose condition holds, in order, or else the else", () => {
  const branches = [
    [compare("a", stock("s1", "wood", "pile"), "GTE", num("three", 3)), [wait("many", 1)]],
    [compare("b", stock("s2", "wood", "pile"), "GT", num("zero", 0)), [wait("some", 1)]],
  ];
  const world = tinyWorld({ entities: [bot("r1", [5, 1], "p")], nodes: [pile(5)], programs: { p: program(forever("f", when("i", branches, [wait("none", 1)]))) } });
  // Forever, If, a Wait, round again: the If in ticks 2, 5 and 8.
  const traces = run(world, 9, { 4: [setWood(1)], 7: [setWood(0)] });
  assert.deepEqual(seen(traces), ["f", "i:0", "many", "f", "i:1", "some", "f", "i:-1", "none"]);
});

test("loops inside loops keep their own counts, and a Repeat works its count out once, as it begins", () => {
  const world = tinyWorld({
    entities: [bot("r1", [5, 1], "p")],
    nodes: [pile(3)],
    programs: { p: program(repeat("outer", 2, repeat("inner", stock("s", "wood", "pile"), wait("w", 1))), wait("last", 1)) },
  });
  const r1 = byId(world, "r1");
  // The first inner loop counts 3 wood; changing the pile during it changes
  // nothing until the inner loop begins again.
  const traces = run(world, 20, { 4: [setWood(1)] });
  const blocks = seen(traces).filter((b) => b !== "-");
  assert.deepEqual(blocks, ["outer:1", "inner:1", "w", "inner:2", "w", "inner:3", "w", "inner:0", "outer:2", "inner:1", "w", "inner:0", "outer:0", "last"]);
  assert.equal(statusOf(r1), "stopped");
  assert.deepEqual(r1.runtime.loops, []);
  assert.equal(r1.runtime.ended, true);
  assert.equal(r1.runtime.block, null);
});

test("a program of nothing but loops can't freeze the world: it takes one block a tick, for ever", () => {
  const world = tinyWorld({
    entities: [bot("r1", [5, 1], "p"), bot("r2", [5, 2], "q")],
    programs: {
      p: program(forever("f")),
      q: program(forever("g", when("i", [[compare("c", basket("b"), "GT", num("n", 5)), [unload("u")]]]))),
    },
  });
  const began = performance.now();
  const traces = run(world, 3000);
  assert.ok(performance.now() - began < 5000);
  assert.ok(traces.every((t) => t.evaluated.length === 2));
  assert.deepEqual(seen(traces.slice(0, 4)), ["f", "f", "f", "f"]);
  assert.deepEqual(seen(traces.slice(0, 4), "r2"), ["g", "i:-1", "g", "i:-1"]);
  assert.equal(statusOf(byId(world, "r1")), "ready");
  assert.equal(world.stall, null, "going round isn't waiting");
});

test("a damaged program that never reaches a visible block stops with an error, instead of taking the tick for ever", () => {
  const world = tinyWorld({ entities: [bot("r1", [5, 1], "p")], programs: { p: program(wait("w", 1)) } });
  const damaged = { id: "p", revision: 2, compiler: COMPILER_VERSION, start: "start", code: [{ op: "jump", to: 0 }, { op: "end" }], needs: [] };
  const [trace] = run(world, 1, { 1: [{ type: "publish", program: damaged }] });
  assert.deepEqual(trace.commands, [{ ok: true }]);
  assert.deepEqual(byId(world, "r1").error, { code: "error.busy", block: null });
  assert.ok(MAX_OPS < 1000);
});

test("what a program senses is the world as it stood before any program ran this tick, whichever runs first", () => {
  // One robot collects from the pile; another waits until the pile has less.
  // The collect's wood leaves the pile when the collect ends, in tick 6, and the
  // other sees it go in that tick, whether it runs before the collector or after.
  for (const [collector, watcher] of [
    ["a", "b"],
    ["b", "a"],
  ]) {
    const world = tinyWorld({
      entities: [bot(collector, [5, 1], "take"), bot(watcher, [5, 1], "watch")],
      nodes: [pile(5)],
      programs: { take: program(collect("k")), watch: program(until("u", compare("c", stock("s", "wood", "pile"), "LT", num("five", 5))), wait("w", 1)) },
    });
    const traces = run(world, 7);
    const tests = traces.map((t) => t.evaluated.find((e) => e.entity === watcher)?.test);
    assert.deepEqual(tests, [false, false, false, false, false, true, undefined], `${collector} collects`);
  }
});

test("robots sharing a program each have their own place in it, and their own loop counts", () => {
  const world = tinyWorld({ entities: [bot("r1", [5, 1], "p"), bot("r2", [5, 2], "p")], programs: { p: program(repeat("r", 3, wait("w", 2))) } });
  // r2 is given the program again, from its start, in tick 4.
  const traces = run(world, 6, { 4: [{ type: "assign", entity: "r2", program: "p" }] });
  assert.deepEqual(seen(traces), ["r:1", "w", "-", "r:2", "w", "-"]);
  assert.deepEqual(seen(traces, "r2"), ["r:1", "w", "-", "r:1", "w", "-"]);
  assert.deepEqual(
    world.entities.map((e) => e.runtime.loops),
    [[{ at: 0, count: 2, times: 3 }], [{ at: 0, count: 1, times: 3 }]],
  );
});

test("publishing a new revision starts exactly the entities running it again, baskets emptied; their holds go and finished work stays", () => {
  const fresh = () =>
    tinyWorld({
      entities: [bot("r1", [5, 1], "p"), bot("r2", [5, 1], "q")],
      nodes: [pile(9)],
      programs: { p: program(collect("k1"), collect("k2")), q: program(forever("f", wait("w", 3))) },
    });
  const world = fresh();
  const twin = fresh(); // the same world, given nothing
  const r1 = byId(world, "r1");
  run(world, 8); // r1 has one wood and is collecting another
  run(twin, 9);
  assert.deepEqual([r1.store.items, r1.runtime.block, byId(world, "pile").store.out], [{ wood: 1 }, "k2", { wood: 1 }]);
  const revision = { id: "p", revision: 2, ...compile(program(wait("new", 1))).program };
  const [trace] = run(world, 1, { 9: [{ type: "publish", program: revision }] });
  assert.deepEqual(trace.commands, [{ ok: true }]);
  assert.deepEqual([r1.store.items, byId(world, "pile").store.out], [{}, {}], "the basket is emptied; the second's hold is gone");
  assert.deepEqual(byId(world, "pile").store.items, { wood: 8 }, "the wood collected left the pile for good");
  assert.equal(r1.runtime.revision, 2);
  assert.deepEqual(r1.runtime.evaluated, { block: "new", tick: 9 }, "from its start, in the same tick");
  assert.deepEqual(world.programs.map((p) => `${p.id} ${p.revision}`), ["p 2", "q 1"]);
  assert.deepEqual(byId(world, "r2"), byId(twin, "r2"), "r2 runs another program, and goes on as if nothing happened");
});

test("a robot given a program starts with an empty basket; a building keeps its stock; starting again from a checkpoint keeps what it gave", () => {
  const fresh = () =>
    tinyWorld({
      entities: [bot("r1", [5, 1], "p", { items: { wood: 2 } }), mill("m", { wood: 3 })],
      nodes: [pile(9)],
      programs: { p: program(wait("w", 3)), q: program(collect("k")), m: program(make("mk")) },
    });
  // Once it has begun its program, what it carries is that program's load.
  const assigned = fresh();
  run(assigned, 1);
  run(assigned, 1, { 2: [{ type: "assign", entity: "r1", program: "q" }] });
  assert.deepEqual(byId(assigned, "r1").store.items, {}, "assigned");

  const published = fresh();
  const mk = { id: "m", revision: 2, ...compile(program(make("mk2"))).program };
  const p2 = { id: "p", revision: 2, ...compile(program(wait("w2", 3))).program };
  run(published, 1);
  run(published, 1, { 2: [{ type: "publish", program: p2 }, { type: "publish", program: mk }] });
  assert.deepEqual(byId(published, "r1").store.items, {}, "a new revision of its program");
  assert.deepEqual(byId(published, "mill").store.items, { wood: 3 }, "a building keeps its stock");

  // Before it has taken a step, it carries what it was given, and keeps it.
  const unbegun = fresh();
  run(unbegun, 1, { 1: [{ type: "assign", entity: "r1", program: "q" }] });
  assert.deepEqual(byId(unbegun, "r1").store.items, { wood: 2 }, "given a program before its first step");

  // Start again from a checkpoint puts the programs in without emptying.
  const checkpoint = fresh();
  installProgram(checkpoint, p2, { fresh: false });
  assert.deepEqual(byId(checkpoint, "r1").store.items, { wood: 2 });
  assert.equal(byId(checkpoint, "r1").runtime.revision, 2);
  assert.deepEqual(checkWorld(checkpoint), []);
});

test("a parked program takes no steps and counts as stopped; a publish keeps it parked, an assign starts it", () => {
  const world = createWorld({
    id: "test",
    version: 1,
    terrain: ["~~~~~~~~~~", "~........~", "~........~", "~........~", "~~~~~~~~~~"],
    entities: [{ ...bot("r1", [5, 1], "p", { items: { wood: 1 } }), parked: true }],
    nodes: [pile(9)],
    programs: [{ id: "p", source: program(collect("k")) }],
  });
  const r1 = byId(world, "r1");
  assert.deepEqual([r1.runtime.parked, statusOf(r1)], [true, "stopped"]);
  assert.deepEqual(run(world, 10).flatMap((t) => t.evaluated), []);
  assert.equal(world.stall, null, "stopped, not waiting: nothing stalls");
  const p2 = { id: "p", revision: 2, ...compile(program(collect("k2"))).program };
  run(world, 1, { 11: [{ type: "publish", program: p2 }] });
  assert.deepEqual([r1.runtime.revision, r1.runtime.parked, r1.store.items], [2, true, { wood: 1 }], "parked, at the new revision, its basket as it was");
  const [trace] = run(world, 1, { 12: [{ type: "assign", entity: "r1", program: "p" }] });
  assert.deepEqual([r1.runtime.parked, r1.store.items], [undefined, { wood: 1 }], "started, keeping what it was given: it hadn't begun");
  assert.deepEqual(trace.evaluated.map((e) => e.block), ["k2"]);
  // A parked program that has begun is a broken world.
  const broken = createWorld({ id: "test", version: 1, terrain: ["~~~~~~~~~~", "~........~", "~~~~~~~~~~"], entities: [{ ...bot("r1", [5, 1], "p"), parked: true }], nodes: [], programs: [{ id: "p", source: program(wait("w", 3)) }] });
  byId(broken, "r1").runtime.at = 1;
  assert.ok(checkWorld(broken).some((p) => /parked, but has begun/.test(p)));
});

test("a command that gives a program to what can't run it, or a program that isn't sound, changes nothing", () => {
  const world = tinyWorld({ entities: [bot("r1", [5, 1], "p"), mill("m")], programs: { p: program(collect("k")), m: program(make("mk")) } });
  const before = stateHash(world);
  const good = compile(program(wait("w", 1))).program;
  const bad = [
    { type: "assign", entity: "mill", program: "p" }, // a sawmill can't collect
    { type: "assign", entity: "r1", program: "m" }, // a robot can't make
    { type: "assign", entity: "r1", program: "none" },
    { type: "assign", entity: "pile", program: "p" },
    { type: "publish", program: { id: "x", revision: 1, ...good, compiler: 99 } },
    { type: "publish", program: { id: "x", revision: 1, ...good, code: [{ op: "act", block: "a", intent: { type: "fly" } }, { op: "end" }] } },
    { type: "publish", program: { id: "has space", revision: 1, ...good } },
    { type: "publish" },
  ];
  const world2 = tinyWorld({ entities: [bot("r1", [5, 1], "p"), mill("m")], programs: { p: program(collect("k")), m: program(make("mk")) } });
  const [trace] = run(world, 1, { 1: bad });
  run(world2, 1);
  assert.deepEqual(
    trace.commands.map((c) => c.ok),
    bad.map(() => false),
  );
  assert.notEqual(before, stateHash(world));
  assert.equal(stateHash(world), stateHash(world2), "as if they'd never been given");
});

test("a sense that can't be worked out stops the program, naming the sense's block", () => {
  const world = tinyWorld({ entities: [bot("r1", [5, 1], "p"), mill("m")], programs: { p: program(wait("w", 1)), m: program(make("mk")) } });
  const nowhere = { id: "p", revision: 2, ...compile(program(until("u", compare("c", stock("s", "wood", "moon"), "GT", num("n", 0))))).program };
  const counting = { id: "m", revision: 2, ...compile(program(until("u2", compare("c2", basket("b"), "GT", num("n2", 0))))).program };
  run(world, 1, {
    1: [
      { type: "publish", program: nowhere },
      { type: "publish", program: counting },
    ],
  });
  assert.deepEqual(byId(world, "r1").error, { code: "error.target", target: "moon", block: "s" });
  assert.deepEqual(byId(world, "mill").error, { code: "error.cannot", action: "basket", block: "b" }, "a sawmill has no basket");
  assert.equal(byId(world, "mill").runtime.block, "u2", "the active block is the one whose sense failed");
});

test("a world saved in the middle of loops and waits, and loaded, goes on exactly as the original", () => {
  const world = createWorld(ISLAND);
  runUntil(world, (w) => byId(w, "r1").runtime.loops.length && byId(w, "sawmill").runtime.wait && w.entities.some((e) => e.action?.type === "move"));
  const loaded = JSON.parse(JSON.stringify(world));
  run(world, 700);
  run(loaded, 700);
  assert.deepEqual(loaded, world);
});

test("on the island, five programs run together on one clock: one block each a tick at most, every one traced to its own program", () => {
  const world = createWorld(ISLAND);
  const sources = Object.fromEntries(ISLAND_PROGRAMS.map(({ id, source }) => [id, blockIndex(readWorkspace(source).tree)]));
  const blocksOf = (entityId) => sources[byId(world, entityId).runtime.program];
  const built = runUntil(world, (w) => byId(w, "site").built);
  // Played again with its traces: all five evaluate a block in tick 1.
  const again = createWorld(ISLAND);
  let first = null;
  for (const trace of run(again, built)) {
    first ??= trace.evaluated.map((e) => e.entity);
    const ids = trace.evaluated.map((e) => e.entity);
    assert.equal(new Set(ids).size, ids.length, `tick ${trace.tick}: one block an entity`);
    for (const e of trace.evaluated) assert.ok(blocksOf(e.entity).has(e.block), `tick ${trace.tick}: ${e.entity} at ${e.block}`);
    for (const s of trace.states) if (s.block) assert.ok(blocksOf(s.entity).has(s.block), `tick ${trace.tick}: ${s.entity} active at ${s.block}`);
    for (const e of again.entities) {
      const reason = reasonOf(e);
      if (reason?.block) assert.equal(reason.block, e.runtime.block, `tick ${trace.tick}: ${e.id} waits at its active block`);
    }
  }
  assert.deepEqual(first, ["r1", "r2", "r3", "sawmill", "site"]);
  assert.ok(built < 400, `the bridge after ${built} ticks`);
});
