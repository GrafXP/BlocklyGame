import { ISLAND } from "../content/island.js";
import { createGame } from "../game.js";
import { blockIndex, readWorkspace } from "../programming/adapter.js";
import { applyDraft, checkDraft, createLibrary, newestPrograms, programDoc, sourceAt } from "../programming/programs.js";
import { createWorld } from "../sim/world.js";

// The game of this visit, shared by the pages that show it, the island and the
// world lab, with its program library (src/programming/programs.js): the blocks
// of every program, as applied and as being edited. It outlives the pages:
// leaving one and opening another, or a change of language, which opens the page
// again, finds the world and the programs as they were (PLAN.md §8). Saving them
// for another visit comes with Phase 5.

let library = null;
let game = null;
let changes = 0; // counted up whenever the library changes, for views to notice

export const currentLibrary = () => (library ??= createLibrary(ISLAND.programs));

// The island, with the programs as last applied.
const island = () => ({ ...ISLAND, programs: newestPrograms(currentLibrary()) });

export const currentGame = () => (game ??= createGame(createWorld(island())));

// A new game on a fresh island, at the speed the last one had. It keeps the
// programs as the player applied them (PLAN.md §9: starting again keeps edited
// programs); each program's editor can go back to its starter.
export function newGame() {
  const speed = game?.clock.speed ?? 1;
  game?.pause();
  game = createGame(createWorld(island()));
  game.clock.setSpeed(speed);
  changes++;
  return game;
}

// How many times the library has changed: a view that shows it draws again
// when this does.
export const libraryChanges = () => changes;
export const libraryChanged = () => changes++;

// Block `blockId` of revision `revision` of program `programId`, as a node of
// its source (src/programming/adapter.js), or null. Sources never change once
// applied, so each is read once.
const indexes = new Map();
export function blockOf(programId, revision, blockId) {
  const key = `${programId} ${revision}`;
  if (!indexes.has(key)) {
    const source = sourceAt(currentLibrary(), programId, revision);
    indexes.set(key, source ? blockIndex(readWorkspace(source).tree) : new Map());
  }
  return indexes.get(key).get(blockId) ?? null;
}

// The block `entity`'s program is at, as a node of its source, or null.
export function activeBlock(entity) {
  const run = entity.runtime;
  return run?.kind === "program" && run.block ? blockOf(run.program, run.revision, run.block) : null;
}

// What runs program `id` in the current world, and what it may use there: the
// robots' and buildings' types, and the island's places.
export function programContext(id) {
  const w = currentGame().world;
  const runners = w.entities.filter((e) => e.runtime?.kind === "program" && e.runtime.program === id);
  return { runners, types: [...new Set(runners.map((e) => e.type))], places: [...w.entities, ...w.nodes].map((t) => t.id) };
}

// The draft of program `id`, checked for what runs it (checkDraft).
export const checkProgram = (id) => checkDraft(currentLibrary(), id, programContext(id));

// Applies the draft of program `id` (PLAN.md §5): its new revision reaches the
// world at the next tick, by Step or by the running clock. Returns applyDraft's
// result.
export function applyProgram(id) {
  const result = applyDraft(currentLibrary(), id, programContext(id));
  if (result.command) {
    currentGame().queue(result.command);
    changes++;
  }
  return result;
}

// Program `id`'s name, a message reference, or null.
export const programName = (id) => programDoc(currentLibrary(), id)?.name ?? null;
