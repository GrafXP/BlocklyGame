import { test } from "node:test";
import assert from "node:assert/strict";
import { call, changeVar, getVar, input, number, routine, send, setVar, waitFor, withVariables, workspace } from "../src/content/build.js";
import { compile } from "../src/programming/compiler.js";
import { createLibrary } from "../src/programming/programs.js";
import { INBOX_SIZE } from "../src/sim/messages.js";
import { makeSave, readSave } from "../src/storage/saves.js";
import { stateHash } from "../src/sim/replay.js";
import { checkWorld } from "../src/sim/validate.js";
import { reasonOf, statusOf } from "../src/sim/world.js";
import { bot, byId, run, runUntil, tinyWorld } from "./helpers.js";
import { chain } from "../src/content/build.js";
import { compare, forever, go, num, pickUp, repeat, start, unload, until, wait } from "./programs.js";

// Phase 8's blocks on the world clock (PLAN.md §7, §11 Phase 8): variables
// that each robot remembers for itself, blocks of the player's own with one
// input, traced into and out of, and messages to one robot or building that
// arrive at the next step and are taken by a Wait For.

const n = { id: "n", name: "n" };
const place = { id: "where", name: "where" };
const times = { id: "times", name: "times" };
// A program of `blocks` under the start, beside `routines`, with `variables`.
const prog = (blocks, routines = [], variables = [n]) => withVariables(workspace(chain(start(), ...blocks), ...routines), variables);
const pile = (wood) => ({ id: "pile", type: "grove", name: "pile", area: { x: 6, z: 1, w: 1, d: 1 }, access: [[5, 1]], items: { wood }, caps: { wood: 10 } });
const shed = { id: "shed", type: "depot", name: "shed", area: { x: 6, z: 3, w: 1, d: 1 }, access: [[5, 3]], caps: { wood: 10 } };
const seen = (traces, entity = "r1") => traces.map((t) => t.evaluated.find((e) => e.entity === entity)?.block ?? "-");

test("a variable starts at 0, takes a step to set or change, and can count a Repeat", () => {
  const world = tinyWorld({
    entities: [bot("r1", [1, 1], "p")],
    programs: { p: prog([setVar("s", n, 2), changeVar("c", n, 1), repeat("r", getVar("g", n), wait("w", 1))]) },
  });
  const program = world.programs.find((p) => p.id === "p");
  assert.deepEqual(program.variables, [{ id: "n", name: "n" }], "the compiled program names its variables, for the debugger");
  assert.equal(byId(world, "r1").runtime.vars, undefined, "nothing remembered before it begins: 0");
  const traces = run(world, 9);
  assert.deepEqual(seen(traces), ["s", "c", "r", "w", "r", "w", "r", "w", "r"]);
  assert.deepEqual(traces[0].evaluated[0], { entity: "r1", block: "s", value: 2 });
  assert.deepEqual(traces[1].evaluated[0], { entity: "r1", block: "c", value: 3 });
  assert.deepEqual(byId(world, "r1").runtime.vars, { n: 3 });
});

test("robots running one program each remember their own, and a start again forgets", () => {
  const p = prog([changeVar("c", n, 1), wait("w", 1), changeVar("c2", n, 10)]);
  const world = tinyWorld({ entities: [bot("r1", [1, 1], "p"), { ...bot("r2", [1, 2], "p"), parked: true }], programs: { p } });
  run(world, 3, { 3: [{ type: "start", entity: "r2" }] });
  assert.deepEqual(byId(world, "r1").runtime.vars, { n: 11 });
  assert.deepEqual(byId(world, "r2").runtime.vars, { n: 1 }, "Robo 2 began later, and counts its own");
  run(world, 1, { 4: [{ type: "restart", entity: "r1" }] });
  assert.deepEqual(byId(world, "r1").runtime.vars, { n: 1 }, "started again from 0");
  assert.deepEqual(checkWorld(world), []);
});

test("a variable stays within 99999 either side of 0", () => {
  const world = tinyWorld({ entities: [bot("r1", [1, 1], "p")], programs: { p: prog([setVar("s", n, 99990), changeVar("c", n, 50), changeVar("d", n, -99999)]) } });
  run(world, 3);
  assert.deepEqual(byId(world, "r1").runtime.vars, { n: 0 });
});

test("a block of one's own is a step to use, its blocks run one by one, and the next block runs once it's done", () => {
  const source = prog(
    [call("c1", "fetch", place, input({ type: "value_place", id: "v1", fields: { PLACE: "pile" } })), call("c2", "twice"), unload("u")],
    [routine("d1", "fetch", place, go("g", getVar("gw", place)), pickUp("k")), routine("d2", "twice", null, wait("w", 1), wait("w2", 1))],
    [place],
  );
  const { program, errors } = compile(source, { type: "helper", places: ["pile", "shed"] });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    program.code.map((ins) => ins.op),
    ["call", "call", "act", "end", "act", "act", "return", "act", "act", "return"],
    "the program's own instructions, then each block's",
  );
  assert.deepEqual(program.code[4].args, { target: { op: "arg", block: "gw", param: "where" } }, "Go To takes the place the use gave");
  const world = tinyWorld({ entities: [bot("r1", [4, 1], "p")], nodes: [pile(5)], programs: { p: source } });
  const traces = run(world, 3);
  assert.deepEqual(seen(traces), ["c1", "g", "-"]);
  assert.deepEqual(byId(world, "r1").runtime.frames, [{ call: "c1", back: 1, routine: "d1", args: { where: "pile" } }], "inside fetch, given the pile");
  runUntil(world, (w) => byId(w, "r1").runtime.block === "w");
  assert.deepEqual(byId(world, "r1").runtime.frames.map((f) => f.call), ["c2"], "back from fetch, into twice");
  assert.deepEqual(byId(world, "r1").store.items, { wood: 1 });
  runUntil(world, (w) => byId(w, "r1").runtime.block === "u");
  assert.equal(byId(world, "r1").runtime.frames, undefined, "back out of every block of its own");
});

test("an input can be a number, and a block of one's own can use another", () => {
  const source = prog([call("c", "outer", times, number(3, "c-n"))], [routine("d1", "outer", times, call("ci", "inner", times, input(getVar("gt", times)))), routine("d2", "inner", times, repeat("r", getVar("gr", times), wait("w", 1)))], [times]);
  const world = tinyWorld({ entities: [bot("r1", [1, 1], "p")], programs: { p: source } });
  const traces = run(world, 9);
  assert.deepEqual(seen(traces), ["c", "ci", "r", "w", "r", "w", "r", "w", "r"]);
  assert.equal(byId(world, "r1").runtime.frames.length, 2, "inside inner, inside outer");
  run(world, 1);
  assert.ok(byId(world, "r1").runtime.ended, "back out of both, to the end");
});

test("a block's input is what its uses give it: a number where it's used as one, a place where it's a place", () => {
  const ws = (arg) => prog([call("c", "go", place, arg)], [routine("d", "go", place, go("g", getVar("gw", place)))], [place]);
  assert.deepEqual(compile(ws(number(2, "two"))).errors, [{ code: "program.wantPlace", block: "c" }]);
  assert.deepEqual(compile(ws(input({ type: "value_place", id: "v", fields: { PLACE: "pile" } }))).errors, []);
  const count = prog([call("c", "count", times, input({ type: "value_place", id: "v", fields: { PLACE: "pile" } }))], [routine("d", "count", times, repeat("r", getVar("gr", times)))], [times]);
  assert.deepEqual(compile(count).errors, [{ code: "program.wantNumber", block: "c" }]);
});

test("a message sent in one step is in the inbox at the next, where a Wait For takes it in that very step", () => {
  const world = tinyWorld({
    entities: [bot("r1", [1, 1], "a"), bot("r2", [1, 2], "b")],
    programs: { a: prog([send("s", "go", "r2"), wait("w", 3)]), b: prog([waitFor("f", "go"), wait("w2", 1)]) },
  });
  const traces = run(world, 3);
  assert.deepEqual(seen(traces, "r1"), ["s", "w", "-"]);
  assert.deepEqual(seen(traces, "r2"), ["f", "f", "w2"]);
  assert.deepEqual(traces[0].started, [{ entity: "r1", type: "send" }]);
  assert.deepEqual(traces[0].evaluated.find((e) => e.entity === "r2"), { entity: "r2", block: "f", received: null });
  assert.deepEqual(traces[1].evaluated.find((e) => e.entity === "r2"), { entity: "r2", block: "f", received: { message: "go", from: "r1" } });
  assert.equal(byId(world, "r2").inbox, undefined, "taken: the inbox is empty");
});

test("Wait For waits, saying for what; only that message ends the wait, and others stay in the inbox in order", () => {
  const world = tinyWorld({
    entities: [bot("r1", [1, 1], "a"), bot("r2", [1, 2], "b")],
    programs: { a: prog([send("s1", "stonePlease", "r2"), send("s2", "go", "r2")]), b: prog([waitFor("f", "go"), wait("w", 50)]) },
  });
  run(world, 1);
  assert.equal(statusOf(byId(world, "r2")), "waiting");
  assert.deepEqual(reasonOf(byId(world, "r2")), { code: "wait.message", message: "go", block: "f" });
  run(world, 3);
  assert.deepEqual(byId(world, "r2").inbox, [{ message: "stonePlease", from: "r1", sent: 1 }], "“go” taken, “stone please” still there");
  assert.equal(byId(world, "r2").runtime.block, "w");
});

test("a full inbox makes a Send wait, and it goes once there's room: messages are never lost", () => {
  const world = tinyWorld({
    entities: [bot("r1", [1, 1], "a"), bot("r2", [1, 2], "b")],
    programs: { a: prog([repeat("r", INBOX_SIZE + 1, send("s", "go", "r2"))]), b: prog([wait("w", 30), forever("f", waitFor("t", "go"))]) },
  });
  runUntil(world, (w) => byId(w, "r1").pending);
  assert.deepEqual(reasonOf(byId(world, "r1")), { code: "wait.mailbox", to: "r2" });
  assert.equal(byId(world, "r2").inbox.length, INBOX_SIZE);
  runUntil(world, (w) => byId(w, "r1").runtime.ended);
  runUntil(world, (w) => !byId(w, "r2").inbox);
  // A Send stopped on its way still delivers.
  const stopped = tinyWorld({ entities: [bot("r1", [1, 1], "a"), bot("r2", [1, 2], "b")], programs: { a: prog([send("s", "go", "r2")]), b: prog([wait("w", 9)]) } });
  run(stopped, 1);
  run(stopped, 2, { 2: [{ type: "restart", entity: "r1" }] });
  assert.equal(byId(stopped, "r2").inbox.length, 2, "the one stopped on its way, and the one sent again");
});

test("a message to something that isn't a robot or building stops the program; a message never starts one", () => {
  const world = tinyWorld({ entities: [bot("r1", [1, 1], "a"), { id: "shed", type: "depot", name: "shed", area: { x: 6, z: 3, w: 1, d: 1 }, access: [[5, 3]], caps: { wood: 10 } }], nodes: [pile(1)], programs: { a: prog([send("s", "go", "shed"), send("s2", "go", "pile")]) } });
  run(world, 3);
  assert.deepEqual(byId(world, "shed").inbox, [{ message: "go", from: "r1", sent: 1 }], "the depot has no program: the message waits there");
  assert.equal(byId(world, "shed").runtime, null);
  assert.deepEqual(byId(world, "r1").error, { code: "error.recipient", target: "pile", block: "s2" });
});

test("a world with memories, routines under way and messages saves and loads exactly, and the same commands give the same world", () => {
  const make = () =>
    tinyWorld({
      entities: [bot("r1", [4, 1], "a"), bot("r2", [1, 2], "b"), shed],
      nodes: [pile(6)],
      programs: {
        a: prog(
          [forever("f", call("c", "trip", place, input({ type: "value_place", id: "v", fields: { PLACE: "shed" } })), changeVar("d", n, 1), send("s", "kitReady", "r2"))],
          [routine("t", "trip", place, go("gp", "pile"), pickUp("k"), go("gs", getVar("gw", place)), unload("u"))],
          [n, place],
        ),
        b: prog([forever("f2", waitFor("t2", "kitReady"), changeVar("d2", n, 1))]),
      },
    });
  const a = make();
  run(a, 120);
  assert.ok(byId(a, "r1").runtime.vars.n >= 2);
  const notes = byId(a, "r2").runtime.vars.n;
  assert.ok(notes >= 1 && notes <= byId(a, "r1").runtime.vars.n, "Robo 2 counts the notes that have come, in its own memory");
  const b = JSON.parse(JSON.stringify(a));
  run(a, 80);
  run(b, 80);
  assert.equal(stateHash(b), stateHash(a));
  const c = make();
  run(c, 200);
  assert.equal(stateHash(c), stateHash(a));
});

test("Wait Until can read a variable: a count down to 0 stops the work", () => {
  const left = { id: "left", name: "left" };
  const world = tinyWorld({
    entities: [bot("r1", [4, 1], "p"), shed],
    nodes: [pile(9)],
    programs: { p: prog([setVar("s", left, 2), forever("f", until("u", compare("cmp", getVar("g", left), "GT", num("z", 0))), go("g1", "pile"), pickUp("k"), go("g2", "shed"), unload("ul"), changeVar("c", left, -1))], [], [left]) },
  });
  runUntil(world, (w) => w.stall);
  assert.equal(byId(world, "shed").store.items.wood, 2);
  assert.deepEqual(byId(world, "r1").runtime.vars, { left: 0 });
  assert.deepEqual(reasonOf(byId(world, "r1")), { code: "wait.until", block: "u" });
});

test("a program applied anew keeps its variables' names in the world, and a save of it reads back", () => {
  const source = prog([setVar("s", n, 1), wait("w", 5)]);
  const world = tinyWorld({ entities: [bot("r1", [1, 1], "p")], programs: { p: source } });
  const { program } = compile(source, { places: ["r1"] });
  run(world, 2, { 2: [{ type: "publish", program: { id: "p", revision: 2, ...program } }] });
  assert.deepEqual(world.programs[0].variables, [{ id: "n", name: "n" }]);
  const library = createLibrary([{ id: "p", name: "p", source }]);
  library.programs[0].published.push({ revision: 2, source });
  const save = makeSave({ content: { id: "test", version: 1 }, world, library, checkpoint: world, progress: { completed: [] } });
  assert.equal(readSave(JSON.parse(JSON.stringify(save)), { content: { id: "test", version: 1 } }).problem, undefined);
});

test("robots sharing a program with a block of its own compete for one pile; each has its own frames and count, and nothing is counted twice", () => {
  const count = { id: "count", name: "count" };
  const source = prog(
    [setVar("s", count, 0), repeat("r", 3, call("c", "fetch", place, input({ type: "value_place", id: "v", fields: { PLACE: "shed" } })), changeVar("d", count, 1))],
    [routine("f", "fetch", place, go("g", "pile"), pickUp("k"), go("h", getVar("gw", place)), unload("u"))],
    [count, place],
  );
  const world = tinyWorld({ entities: [bot("r1", [4, 1], "p"), bot("r2", [4, 2], "p"), bot("r3", [3, 3], "p"), shed], nodes: [pile(5)], programs: { p: source } });
  let both = false;
  runUntil(world, (w) => {
    const inside = w.entities.filter((e) => e.runtime?.frames?.length === 1);
    if (inside.length > 1) both = true;
    return w.stall || w.entities.filter((e) => e.kind === "robot").every((e) => e.runtime.ended);
  });
  assert.ok(both, "two robots were inside fetch at once, each in its own frame");
  assert.equal(byId(world, "shed").store.items.wood, 5, "the pile's five, and no more");
  const counts = ["r1", "r2", "r3"].map((id) => byId(world, id).runtime.vars?.count ?? 0);
  assert.equal(counts.reduce((a, b) => a + b, 0), 5, `each counted its own: ${counts}`);
  assert.ok(world.stall, "nine wanted, five there: everyone waits");
  for (const id of ["r1", "r2", "r3"]) {
    assert.deepEqual(reasonOf(byId(world, id)), { code: "wait.item", item: "wood", at: "pile", need: 1, have: 0 }, `${id} waits at the empty pile, visibly`);
    assert.equal(byId(world, id).runtime.block, "k", `${id} is at Collect, inside fetch`);
  }
});
