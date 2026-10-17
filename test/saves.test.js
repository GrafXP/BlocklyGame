import { test } from "node:test";
import assert from "node:assert/strict";
import { SLICE } from "../src/content/missions/slice.js";
import { COMPILER_VERSION } from "../src/programming/compiler.js";
import { applyDraft, createLibrary, latest, newestPrograms, programDoc, setDraft } from "../src/programming/programs.js";
import { stateHash } from "../src/sim/replay.js";
import { createWorld, SIM_VERSION } from "../src/sim/world.js";
import { makeSave, readSave, SAVE_SCHEMA } from "../src/storage/saves.js";
import { byId, run } from "./helpers.js";

// Saved games (PLAN.md §10, Phase 5): a mission saved at any tick and read back
// goes on exactly as it would have; a save of another version, of another
// mission, or damaged anywhere is let go whole; and the session saves the
// mission as it's played, starts it again from its checkpoint keeping the
// programs, and tells the player when the device won't keep it.

const places = [...SLICE.content.entities, ...SLICE.content.nodes].map((t) => t.id);
const copy = (value) => JSON.parse(JSON.stringify(value));

// The slice after `ticks` ticks, with its courier's program changed to the
// reference at tick 30 and applied twice more, the last revision still waiting
// for the next tick when `pending`.
function played(ticks = 200, { pending = false } = {}) {
  const library = createLibrary(SLICE.content.programs);
  const checkpoint = createWorld({ ...SLICE.content, programs: newestPrograms(library) });
  const world = copy(checkpoint);
  const apply = () => {
    setDraft(library, "courier", SLICE.reference.courier);
    return applyDraft(library, "courier", { types: ["helper"], places }).command;
  };
  run(world, 30);
  run(world, 1, { 31: [apply()] });
  run(world, 1, { 32: [apply()] });
  run(world, ticks - 32);
  const queued = pending ? [apply()] : [];
  return { world, library, checkpoint, queued, progress: { completed: [] } };
}
// The slice's save, and what a save of it is read against (src/ui/session.js).
const save = (game) => JSON.parse(JSON.stringify(makeSave({ content: SLICE.content, mission: "slice", ...game })));
const SLICE_SAVE = { content: { id: SLICE.content.id, version: SLICE.content.version }, missions: (id) => id === "slice" };

test("a mission saved at a tick and read back goes on exactly as it would have", () => {
  const game = played(150);
  const envelope = save(game);
  assert.equal(envelope.format, "robot-island");
  assert.equal(envelope.schema, SAVE_SCHEMA);
  assert.equal(envelope.sim, SIM_VERSION);
  assert.equal(envelope.compiler, COMPILER_VERSION);
  assert.deepEqual(envelope.content, { id: "slice", version: 2 });
  const read = readSave(envelope, SLICE_SAVE);
  assert.equal(read.problem, undefined);
  assert.equal(stateHash(read.world), stateHash(game.world));
  assert.deepEqual(read.checkpoint, game.checkpoint);
  run(game.world, 600);
  run(read.world, 600);
  assert.deepEqual(read.world, game.world);
});

test("a save keeps each program's history: the revisions the world and the checkpoint run, and the newest (library.test.js)", () => {
  const game = played(100, { pending: true });
  assert.deepEqual(
    programDoc(game.library, "courier").published.map((p) => p.revision),
    [1, 2, 3, 4],
  );
  const { library } = readSave(save(game), SLICE_SAVE);
  // 1 for the checkpoint, 3 for the world, 4 waiting for the next tick, and 2
  // in the history between them.
  assert.deepEqual(
    programDoc(library, "courier").published.map((p) => p.revision),
    [1, 2, 3, 4],
  );
  assert.deepEqual(programDoc(library, "courier").draft, programDoc(game.library, "courier").draft, "drafts are kept");
  assert.deepEqual(latest(programDoc(library, "courier")).source, SLICE.reference.courier);
  assert.equal(programDoc(game.library, "courier").published.length, 4, "the library itself is left as it was");
});

test("a save from another version, of another mission, or damaged anywhere, is let go whole", () => {
  const good = save(played(80));
  const broken = (change) => {
    const s = copy(good);
    change(s);
    return readSave(s, SLICE_SAVE).problem;
  };
  assert.equal(readSave(null, SLICE_SAVE).problem, "format");
  assert.equal(readSave("text", SLICE_SAVE).problem, "format");
  assert.equal(
    broken((s) => (s.format = "another-game")),
    "format",
  );
  for (const key of ["schema", "sim", "compiler"]) {
    assert.equal(
      broken((s) => (s[key] += 1)),
      "version",
      key,
    );
  }
  assert.equal(
    broken((s) => (s.mission = "other")),
    "mission",
  );
  assert.equal(
    broken((s) => (s.content.version += 1)),
    "mission",
  );
  assert.equal(
    broken((s) => (s.library.programs = "none")),
    "library",
  );
  assert.equal(
    broken((s) => s.library.programs.reverse()),
    "library",
  );
  assert.equal(
    broken((s) => (byId(s.world, "r1").store.items.wood = 9)),
    "world",
    "a basket fuller than it can be",
  );
  assert.equal(
    broken((s) => (s.world.content.id = "island")),
    "world",
  );
  assert.equal(
    broken((s) => (s.checkpoint.tick = 1000)),
    "checkpoint",
  );
  assert.equal(
    broken((s) => (programDoc(s.library, "collector").published[0].source = SLICE.reference.courier)),
    "programs",
    "the world runs instructions its blocks don't compile to",
  );
  assert.equal(
    broken((s) => (s.progress = null)),
    "progress",
  );
});

// --- The session ----------------------------------------------------------------

// localStorage for node: what the session saves into, and reads from on a
// reload, or one that keeps nothing.
function memoryStorage({ full = false } = {}) {
  const items = new Map();
  return {
    items,
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => {
      if (full) throw new Error("QuotaExceededError");
      items.set(k, String(v));
    },
    removeItem: (k) => items.delete(k),
  };
}
// A fresh copy of the session module: as after a reload of the page.
let reloads = 0;
const reload = () => import(`../src/ui/session.js?reload=${++reloads}`);

test("the session saves the mission as it's played, and a reload goes on from there, an Apply still waiting", async () => {
  globalThis.localStorage = memoryStorage();
  try {
    const session = await reload();
    const play = session.usePlay("slice");
    assert.equal(play.notice, null);
    for (let i = 0; i < 40; i++) play.game.step();
    setDraft(session.currentLibrary(), "courier", SLICE.reference.courier);
    assert.ok(session.applyProgram("courier").command);
    assert.equal(play.changed, true, "applied after the world began to run");
    assert.equal(session.savePlay(), true);
    const hash = stateHash(play.game.world);

    const again = (await reload()).usePlay("slice");
    assert.equal(stateHash(again.game.world), hash);
    assert.equal(again.game.queued, 1, "the Apply waits for the next tick again");
    again.game.step();
    play.game.step();
    assert.equal(byId(again.game.world, "r2").runtime.revision, 2);
    assert.deepEqual(again.game.world, play.game.world);
  } finally {
    delete globalThis.localStorage;
  }
});

test("applying Robo 3's parked program starts it, after a reload too; Start again parks it again, keeping the change", async () => {
  globalThis.localStorage = memoryStorage();
  try {
    const session = await reload();
    const play = session.usePlay("slice");
    for (let i = 0; i < 10; i++) play.game.step();
    setDraft(session.currentLibrary(), "stones", SLICE.reference.courier);
    session.applyProgram("stones");
    assert.equal(play.game.queued, 2, "its publish, and a start for Robo 3");
    session.savePlay();

    const again = (await reload()).usePlay("slice");
    assert.equal(again.game.queued, 2, "both wait for the next tick again");
    for (const g of [play.game, again.game]) g.step();
    assert.deepEqual(again.game.world, play.game.world);
    const r3 = byId(play.game.world, "r3");
    assert.deepEqual([r3.runtime.revision, r3.runtime.parked], [2, undefined]);

    const restarted = session.newGame();
    assert.deepEqual([byId(restarted.world, "r3").runtime.revision, byId(restarted.world, "r3").runtime.parked], [2, true]);
  } finally {
    delete globalThis.localStorage;
  }
});

test("Start again goes back to the checkpoint with the programs as applied; a mission done is remembered", async () => {
  globalThis.localStorage = memoryStorage();
  try {
    const session = await reload();
    const play = session.usePlay("slice");
    for (const id of ["courier", "bridge"]) {
      setDraft(session.currentLibrary(), id, SLICE.reference[id]);
      session.applyProgram(id);
    }
    assert.equal(play.changed, false, "applied before the world ran: nothing to start again for");
    while (play.game.world.mission.done === null) {
      assert.ok(play.game.world.tick < SLICE.steps);
      play.game.step();
    }
    session.savePlay();
    assert.deepEqual(session.playSummary("slice"), { tick: play.game.world.tick, completed: true, saved: true });

    const game = session.newGame();
    assert.equal(game.world.tick, 0);
    assert.equal(game.world.mission.done, null);
    const library = createLibrary(SLICE.content.programs);
    for (const id of ["courier", "bridge"]) {
      setDraft(library, id, SLICE.reference[id]);
      applyDraft(library, id, { places });
    }
    assert.deepEqual(game.world, createWorld({ ...SLICE.content, programs: newestPrograms(library) }), "the checkpoint, running the programs as applied");
    session.savePlay();
    assert.deepEqual((await reload()).playSummary("slice"), { tick: 0, completed: true, saved: true }, "done once is done");
  } finally {
    delete globalThis.localStorage;
  }
});

test("a save that can't be used is let go, and the player told; a device that won't keep it is said too", async () => {
  globalThis.localStorage = memoryStorage();
  try {
    globalThis.localStorage.setItem("robot-island:save.slice", JSON.stringify({ format: "robot-island", schema: 0 }));
    const warn = console.warn;
    console.warn = () => {};
    const play = (await reload()).usePlay("slice");
    console.warn = warn;
    assert.equal(play.notice, "discarded");
    assert.equal(play.game.world.tick, 0);

    globalThis.localStorage = memoryStorage({ full: true });
    const session = await reload();
    const unkept = session.usePlay("slice");
    assert.equal(session.savePlay(), false);
    assert.equal(unkept.notice, "unsaved");
    assert.equal(session.playSummary("slice").saved, false, "the title page won't say it's saved");
    session.dismissNotice();
    assert.equal(unkept.notice, null);
    assert.equal(session.savePlay(), false);
    assert.equal(unkept.notice, null, "said once");
    assert.equal(session.playSummary("slice").saved, false, "and still not saved");
  } finally {
    delete globalThis.localStorage;
  }
});

test("starting over forgets the saved mission and every change to its programs", async () => {
  globalThis.localStorage = memoryStorage();
  try {
    const session = await reload();
    const play = session.usePlay("slice");
    play.game.step();
    setDraft(session.currentLibrary(), "courier", SLICE.reference.courier);
    session.applyProgram("courier");
    session.savePlay();
    assert.equal(globalThis.localStorage.items.size, 1);
    session.forgetPlay("slice");
    assert.equal(globalThis.localStorage.items.size, 0);
    assert.equal(session.playSummary("slice"), null);
    const fresh = session.usePlay("slice");
    assert.notEqual(fresh, play);
    assert.equal(latest(programDoc(fresh.library, "courier")).revision, 1);
  } finally {
    delete globalThis.localStorage;
  }
});

test("the free island isn't saved, and its library is its own", async () => {
  globalThis.localStorage = memoryStorage();
  try {
    const session = await reload();
    const island = session.usePlay("island");
    assert.equal(session.savePlay(), false);
    assert.equal(globalThis.localStorage.items.size, 0);
    const mission = session.usePlay("slice");
    assert.notEqual(island.library, mission.library);
    // Revision 1 of the courier differs between them: blockOf reads each library's own.
    assert.ok(session.blockOf("courier", 1, "courier-go-depot"));
    session.usePlay("island");
    assert.equal(session.blockOf("courier", 1, "courier-go-depot"), null);
    assert.ok(session.blockOf("courier", 1, "courier-go-site"));
  } finally {
    delete globalThis.localStorage;
  }
});
