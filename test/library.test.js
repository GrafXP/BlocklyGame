import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND } from "../src/content/island.js";
import { createGame } from "../src/game.js";
import { applyDraft, checkDraft, createLibrary, isChanged, latest, newestPrograms, programDoc, resetDraft, sameBlocks, setDraft, sourceAt } from "../src/programming/programs.js";
import { createWorld } from "../src/sim/world.js";
import { checkWorld } from "../src/sim/validate.js";
import { byId } from "./helpers.js";
import { build, go, make, program, unload } from "./programs.js";

// The program library (PLAN.md §5, §10): drafts are edited without touching
// what runs; Apply makes a new revision that reaches the world at the next tick
// boundary; the blocks of every revision stay, so the debugger shows the one
// the world runs.

const places = [...ISLAND.entities, ...ISLAND.nodes].map((t) => t.id);
const islandLibrary = () => createLibrary(ISLAND.programs);
const edit = (json, from, to) => JSON.parse(JSON.stringify(json).replace(from, to));
const collector = (library) => programDoc(library, "collector");

test("each program starts as its starter: draft and revision 1 the same blocks", () => {
  const library = islandLibrary();
  assert.deepEqual(
    library.programs.map((p) => p.id),
    ["bridge", "collector", "courier", "planks", "stones"],
  );
  const doc = collector(library);
  assert.deepEqual(doc.name, { key: "programName.collector" });
  assert.deepEqual(doc.draft, doc.starter);
  assert.deepEqual(latest(doc), { revision: 1, source: doc.starter });
  assert.deepEqual(sourceAt(library, "collector", 1), doc.starter);
  assert.equal(sourceAt(library, "collector", 2), null);
  assert.equal(isChanged(doc), false);
  doc.draft.blocks.blocks[0].next.block.id = "changed";
  assert.notDeepEqual(doc.starter, doc.draft, "the library keeps copies, not the content's own objects");
});

test("moving a stack about is no change; changing a block, or what's in it, is", () => {
  const library = islandLibrary();
  const doc = collector(library);
  const moved = structuredClone(doc.draft);
  Object.assign(moved.blocks.blocks[0], { x: 300, y: 120 });
  assert.ok(sameBlocks(moved, doc.starter));
  setDraft(library, "collector", moved);
  assert.equal(isChanged(doc), false);
  setDraft(library, "collector", edit(doc.starter, '"PLACE":"grove"', '"PLACE":"depot"'));
  assert.equal(isChanged(doc), true);
  assert.equal(latest(doc).revision, 1, "a draft is never applied by itself");
});

test("a draft is checked for every type that runs it, and for the island's places", () => {
  const library = createLibrary([{ id: "p", name: "p", source: program(go("g", "nowhere"), make("m")) }]);
  assert.deepEqual(checkDraft(library, "p", { types: ["helper", "sawmill"], places }).errors, [
    { code: "program.target", block: "g", target: "nowhere" },
    { code: "program.cannot", block: "m", action: "make" },
    { code: "program.cannot", block: "g", action: "goTo" },
  ]);
  setDraft(library, "p", program(build("b")));
  assert.deepEqual(checkDraft(library, "p", { types: ["sawmill"] }).errors, [{ code: "program.cannot", block: "b", action: "make" }], "a sawmill has no bridge to build");
  assert.deepEqual(checkDraft(library, "p", { types: ["site"] }).errors, []);
});

test("a draft that can't run isn't applied, and nothing changes", () => {
  const library = islandLibrary();
  const before = structuredClone(library);
  setDraft(library, "collector", edit(collector(library).starter, '"PLACE":"grove"', '"PLACE":"nowhere"'));
  const result = applyDraft(library, "collector", { types: ["helper"], places });
  assert.equal(result.command, undefined);
  assert.deepEqual(result.errors, [{ code: "program.target", block: "collector-go-grove", target: "nowhere" }]);
  assert.deepEqual(collector(library).published, collector(before).published);
});

test("Apply makes the next revision, which the world runs from the next tick; until then the old one runs on", () => {
  const library = islandLibrary();
  const game = createGame(createWorld({ ...ISLAND, programs: newestPrograms(library) }));
  for (let i = 0; i < 30; i++) game.step();
  const r1 = byId(game.world, "r1");
  assert.equal(r1.runtime.revision, 1);
  const busy = r1.runtime.block;

  setDraft(library, "collector", edit(collector(library).starter, '"PLACE":"sawmill"', '"PLACE":"depot"'));
  const { command, revision } = applyDraft(library, "collector", { types: ["helper"], places });
  assert.equal(revision, 2);
  assert.equal(command.type, "publish");
  assert.equal(command.program.revision, 2);
  assert.deepEqual(sourceAt(library, "collector", 2), collector(library).draft);
  assert.deepEqual(sourceAt(library, "collector", 1), collector(library).starter, "the old revision's blocks stay, for the world still running it");
  assert.equal(isChanged(collector(library)), false);

  game.queue(command);
  assert.equal(r1.runtime.revision, 1, "queued, not applied");
  assert.equal(r1.runtime.block, busy);
  game.step();
  assert.equal(game.world.programs.find((p) => p.id === "collector").revision, 2);
  assert.equal(r1.runtime.revision, 2);
  assert.equal(r1.runtime.block, "collector-forever", "started again from its start, and took its first block in that tick");
  assert.deepEqual(checkWorld(game.world), []);

  // Editing the draft again changes nothing that runs.
  setDraft(library, "collector", collector(library).starter);
  game.step();
  assert.equal(r1.runtime.revision, 2);
});

test("a world started again runs the programs as last applied, at their revisions", () => {
  const library = islandLibrary();
  setDraft(library, "planks", edit(programDoc(library, "planks").starter, '"OP":"GT"', '"OP":"GTE"'));
  applyDraft(library, "planks", { types: ["sawmill"], places });
  const world = createWorld({ ...ISLAND, programs: newestPrograms(library) });
  assert.equal(world.programs.find((p) => p.id === "planks").revision, 2);
  assert.equal(byId(world, "sawmill").runtime.revision, 2);
  assert.equal(world.programs.find((p) => p.id === "collector").revision, 1);
  assert.deepEqual(checkWorld(world), []);
  assert.throws(() => createWorld({ ...ISLAND, programs: [{ ...newestPrograms(library)[0], revision: 0 }] }), /revision 0/);
});

test("the draft goes back to the newest revision, or to the starter", () => {
  const library = islandLibrary();
  const doc = collector(library);
  setDraft(library, "collector", program(unload("u")));
  applyDraft(library, "collector", { types: ["helper"], places });
  setDraft(library, "collector", program(unload("u"), unload("v")));
  resetDraft(library, "collector", "applied");
  assert.deepEqual(doc.draft, program(unload("u")));
  resetDraft(library, "collector", "starter");
  assert.deepEqual(doc.draft, doc.starter);
  assert.equal(isChanged(doc), true, "the starter isn't what runs now, until it's applied");
});
