import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND } from "../src/content/island.js";
import { createGame } from "../src/game.js";
import {
  applyDraft,
  archiveProgram,
  checkDraft,
  checkLibrary,
  copyProgram,
  createLibrary,
  freeProgramId,
  isChanged,
  latest,
  loadVersion,
  newProgram,
  parentOf,
  prunedLibrary,
  newestPrograms,
  programDoc,
  renameProgram,
  resetDraft,
  sameBlocks,
  setDraft,
  sourceAt,
  wordStarter,
} from "../src/programming/programs.js";
import { display, ref } from "../src/i18n/index.js";
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
    ["bridge", "build-workshop", "collector", "courier", "fetch", "kits", "planks", "stones"],
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
    { code: "program.target", block: "g-place", target: "nowhere" },
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
  assert.deepEqual(result.errors, [{ code: "program.target", block: "collector-go-grove-place", target: "nowhere" }]);
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

test("a version from the history goes into the draft, not into the world; unapplied changes are kept to go back to; applying it starts a branch", () => {
  const library = islandLibrary();
  const doc = collector(library);
  const apply = (json) => {
    setDraft(library, "collector", json);
    return applyDraft(library, "collector", { types: ["helper"], places }).revision;
  };
  assert.deepEqual([apply(program(unload("a"))), apply(program(unload("b")))], [2, 3]);
  assert.deepEqual(
    doc.published.map((_, i) => parentOf(doc, i)),
    [null, 1, 2],
    "one after another",
  );
  // Changes not applied, then version 2 put into the draft: the changes are kept.
  setDraft(library, "collector", program(unload("c")));
  assert.equal(loadVersion(library, "collector", 2), true);
  assert.deepEqual(doc.draft, program(unload("a")));
  assert.equal(latest(doc).revision, 3, "nothing is applied");
  assert.deepEqual(doc.kept, { source: program(unload("c")), from: 3 });
  assert.equal(isChanged(doc), true, "version 2 isn't what runs");
  // Another version while the draft is one: the kept changes stay.
  assert.equal(loadVersion(library, "collector", 1), true);
  assert.deepEqual(doc.kept.source, program(unload("c")));
  // Applied from version 1: a branch.
  assert.equal(apply(edit(doc.draft, '"type":"island_when_started"', '"type":"island_when_started"')), 4);
  assert.equal(parentOf(doc, 3), 1);
  // The kept changes back, with the draft in their place only if it had changes of its own.
  assert.equal(loadVersion(library, "collector", "kept"), true);
  assert.deepEqual(doc.draft, program(unload("c")));
  assert.equal("kept" in doc, false, "version 4 was applied, so there's nothing to keep");
  setDraft(library, "collector", program(unload("d")));
  loadVersion(library, "collector", 3);
  loadVersion(library, "collector", "kept");
  assert.deepEqual(doc.draft, program(unload("d")));
  assert.equal(apply(doc.draft), 5);
  assert.equal(parentOf(doc, 4), 3, "the kept draft started from version 3");
  assert.equal(loadVersion(library, "collector", 9), false);
  assert.deepEqual(checkLibrary(library), []);
  doc.published[1].from = 7;
  assert.notDeepEqual(checkLibrary(library), [], "a parent after its child");
});

test("a save keeps each program's newest versions for its history; a version whose parent went names none", () => {
  const library = islandLibrary();
  for (let i = 0; i < 45; i++) {
    setDraft(library, "collector", program(...Array.from({ length: (i % 3) + 1 }, (_, k) => unload(`u${i}-${k}`))));
    applyDraft(library, "collector", { types: ["helper"], places });
  }
  const pruned = programDoc(prunedLibrary(library, (id) => (id === "collector" ? [1] : [])), "collector");
  assert.deepEqual(
    pruned.published.map((p) => p.revision),
    [1, ...Array.from({ length: 40 }, (_, i) => i + 7)],
    "the one something runs, and the newest forty",
  );
  assert.equal(pruned.published[1].from, null, "version 7's parent, 6, is gone");
  assert.equal(pruned.published[2].from, 7);
  assert.deepEqual(checkLibrary({ programs: [pruned] }), []);
});

test("a copy is a program of its own: the blocks as last applied, its own revisions, the original's starter", () => {
  const library = islandLibrary();
  setDraft(library, "collector", edit(collector(library).starter, '"PLACE":"sawmill"', '"PLACE":"depot"'));
  applyDraft(library, "collector", { types: ["helper"], places });
  setDraft(library, "collector", program(unload("unapplied")));
  const id = freeProgramId(library, "collector-r2");
  assert.equal(id, "collector-r2");
  const name = ref("programName.copy", { program: collector(library).name, name: ref("entity.robo", { n: 2 }) });
  const doc = copyProgram(library, "collector", { newId: id, name });
  assert.deepEqual(
    library.programs.map((p) => p.id),
    ["bridge", "build-workshop", "collector", "collector-r2", "courier", "fetch", "kits", "planks", "stones"],
    "in order of id",
  );
  assert.deepEqual(latest(doc), { revision: 1, source: latest(collector(library)).source });
  assert.deepEqual(doc.draft, latest(collector(library)).source, "the original's unapplied changes stay with it");
  assert.deepEqual(doc.starter, collector(library).starter);
  assert.equal(display(doc.name), "Wood collector (Robo 2)", "its name is worded from the original's and the robot's");
  // Editing the copy leaves the original alone.
  setDraft(library, id, program(unload("u")));
  applyDraft(library, id, { types: ["helper"], places });
  assert.equal(latest(doc).revision, 2);
  assert.equal(latest(collector(library)).revision, 2);
  assert.equal(freeProgramId(library, "collector-r2"), "collector-r2-2");
  assert.equal(freeProgramId(library, "fresh", ["fresh"]), "fresh-2", "nor one a world has");
  assert.deepEqual(checkLibrary(library), []);
});

test("a new program starts as its start block; programs can be renamed, and put away and brought back", () => {
  const library = islandLibrary();
  const doc = newProgram(library, { newId: "program", name: ref("programName.new", { n: 1 }), source: program() });
  assert.equal(display(doc.name), "New program 1");
  assert.deepEqual(doc.draft, program());
  renameProgram(library, "program", "My robot job");
  assert.equal(programDoc(library, "program").name, "My robot job", "the player's words, as typed");
  archiveProgram(library, "program", true);
  assert.equal(programDoc(library, "program").archived, true);
  assert.deepEqual(checkLibrary(library), []);
  archiveProgram(library, "program", false);
  assert.equal("archived" in programDoc(library, "program"), false);
  programDoc(library, "program").archived = "yes";
  assert.notDeepEqual(checkLibrary(library), []);
});

test("names the game gives inside a starter program are worded in the player's language when it's copied into the library", () => {
  // Variables and procedures come with Phase 8; a starter can already name
  // them, as messages, and the library words them as the player's own.
  const starter = {
    variables: [{ id: "v1", name: { key: "programName.new", params: { n: 7 } } }],
    blocks: { languageVersion: 0, blocks: [{ type: "island_when_started", id: "s", next: { block: { type: "procedures_call", id: "c", fields: { NAME: { key: "entity.camp" } } } } }] },
  };
  const word = (name) => `[${name.key}]`;
  const worded = wordStarter(starter, word);
  assert.equal(worded.variables[0].name, "[programName.new]");
  assert.equal(worded.blocks.blocks[0].next.block.fields.NAME, "[entity.camp]");
  assert.deepEqual(starter.variables[0].name, { key: "programName.new", params: { n: 7 } }, "the starter itself is left as it was");
  const library = createLibrary([{ id: "p", name: "p", source: starter }], { word: display });
  const doc = programDoc(library, "p");
  assert.equal(doc.draft.variables[0].name, "New program 7");
  assert.equal(doc.starter.variables[0].name, "New program 7", "from now on they're the player's names");
  assert.deepEqual(wordStarter(program(unload("u")), word), program(unload("u")), "a variable field ({ id }) and everything else stay as they are");
});
