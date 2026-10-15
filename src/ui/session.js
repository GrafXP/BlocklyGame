import { ISLAND } from "../content/island.js";
import { missionById } from "../content/missions/index.js";
import { createGame } from "../game.js";
import { blockIndex, readWorkspace } from "../programming/adapter.js";
import { compile } from "../programming/compiler.js";
import { applyDraft, checkDraft, createLibrary, latest, newestPrograms, programDoc, sourceAt } from "../programming/programs.js";
import { installProgram } from "../sim/commands.js";
import { createWorld } from "../sim/world.js";
import { loadLocal, removeLocal, saveLocal } from "../storage/local.js";
import { makeSave, readSave } from "../storage/saves.js";

// The games of this visit, shared by the pages that show them, each with its
// program library (src/programming/programs.js): the blocks of every program,
// as applied and as being edited. There are two kinds of play:
//
// - "island", the free island of Phases 3 and 4, where every program runs from
//   the start. The island page and the world lab show it, for this visit only.
// - a mission, by its id (src/content/missions/): the play page shows it, and
//   it's saved on the device as it's played (src/storage/saves.js), so it goes
//   on where it was after a reload.
//
// A play outlives the pages: leaving one and opening another, or a change of
// language, which opens the page again, finds the world and the programs as
// they were (PLAN.md §8). A page chooses its play (usePlay), and the functions
// below work on that one.
//
// Each play keeps its checkpoint, the world at its start. Start again goes back
// to it, keeping the programs as last applied and their drafts (PLAN.md §9).
//
//   play = { key, mission, library, checkpoint, game, progress, notice, unsaved, changed }
//
// `progress` is the missions done at least once; `notice` says something about
// saving the player should know: "discarded" (a save that couldn't be read was
// let go) or "unsaved" (the device won't keep the game), until the player has
// read it; `unsaved` whether the last save failed; `changed` whether a
// program was applied after the world had begun to run. An applied program
// starts again from its start, with an empty basket, while the rest of the
// island has moved on, so such a change is best watched from the checkpoint: the
// mission's card offers that.

const plays = new Map();
let current = null;
let changes = 0; // counted up whenever a library or a play changes, for views to notice

// The play `key`, made the one the session's functions work on: made the first
// time it's asked for, a mission from its save if it has one.
export function usePlay(key) {
  if (!plays.has(key)) plays.set(key, key === "island" ? freshPlay(key, null, ISLAND) : missionPlay(missionById(key)));
  current = plays.get(key);
  return current;
}
const play = () => current ?? usePlay("island");

export const currentPlay = () => play();
export const currentLibrary = () => play().library;
export const currentGame = () => play().game;

const saveName = (key) => `save.${key}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

// A play of `content` from its start, with its starter programs.
function freshPlay(key, mission, content) {
  const library = createLibrary(content.programs);
  const checkpoint = createWorld({ ...content, programs: newestPrograms(library) });
  return { key, mission, library, checkpoint, game: createGame(clone(checkpoint)), progress: { completed: [] }, notice: null, unsaved: false, changed: false };
}

// Mission `mission`'s play: as saved, or from its start.
function missionPlay(mission) {
  if (!mission) throw new Error("no such mission");
  const saved = loadLocal(saveName(mission.id));
  const read = saved && readSave(saved, mission);
  if (!read || read.problem) {
    const fresh = freshPlay(mission.id, mission, mission.content);
    if (read?.problem) {
      console.warn(`The saved game of ${mission.id} can't be used (${read.problem}); starting afresh.`);
      fresh.notice = "discarded";
    }
    return fresh;
  }
  const game = createGame(read.world);
  // Applies that were waiting for the next tick when the game was saved wait
  // again (saves.js).
  for (const command of pendingPublishes(read.library, read.world)) applyCommands(read.world, command).forEach((c) => game.queue(c));
  return { key: mission.id, mission, library: read.library, checkpoint: read.checkpoint, game, progress: read.progress, notice: null, unsaved: false, changed: false };
}

// Publish commands for every program whose newest revision `world` doesn't run
// yet.
function pendingPublishes(library, world) {
  const places = [...world.entities, ...world.nodes].map((t) => t.id);
  return library.programs.flatMap((doc) => {
    const newest = latest(doc);
    const running = world.programs.find((p) => p.id === doc.id);
    if (running?.revision === newest.revision) return [];
    const { program } = compile(newest.source, { places });
    return program ? [{ type: "publish", program: { id: doc.id, revision: newest.revision, ...program } }] : [];
  });
}

// What applying a program sends the world: its `publish` command, then an
// `assign` for each robot or building in `world` that has the program parked,
// so applying it starts them too (src/programming/runtime.js).
function applyCommands(world, publish) {
  const { id } = publish.program;
  const parked = world.entities.filter((e) => e.runtime?.kind === "program" && e.runtime.program === id && e.runtime.parked);
  return [publish, ...parked.map((e) => ({ type: "assign", entity: e.id, program: id }))];
}

// The checkpoint's world, running the programs of `library` as last applied,
// with what the checkpoint gave each robot to carry; parked programs stay
// parked.
function fromCheckpoint(checkpoint, library) {
  const world = clone(checkpoint);
  for (const { program } of pendingPublishes(library, world)) installProgram(world, program, { fresh: false });
  return world;
}

// The current play from its checkpoint again, at the speed it had. It keeps the
// programs as the player applied them, and their drafts (PLAN.md §9: starting
// again keeps edited programs); each program's editor can go back to its
// starter. Returns the new game.
export function newGame() {
  const p = play();
  const speed = p.game.clock.speed;
  p.game.pause();
  p.game = createGame(fromCheckpoint(p.checkpoint, p.library));
  p.game.clock.setSpeed(speed);
  p.changed = false;
  changes++;
  return p.game;
}

// --- Saving -------------------------------------------------------------------

// Saves the current play if it's a mission's, as it stands: a tick boundary,
// since ticks happen only within a frame. A mission done for the first time is
// noted in its progress. Returns whether the device kept it.
export function savePlay() {
  const p = play();
  if (!p.mission) return false;
  const { world } = p.game;
  if (world.mission?.done != null && !p.progress.completed.includes(p.mission.id)) p.progress.completed.push(p.mission.id);
  const kept = saveLocal(saveName(p.key), makeSave({ mission: p.mission, world, library: p.library, checkpoint: p.checkpoint, progress: p.progress }));
  if (!kept && !p.unsaved) {
    p.notice = "unsaved";
    changes++;
  }
  p.unsaved = !kept;
  return kept;
}

// What there is of mission `key`'s play, in this visit or saved on the device:
// { tick, completed, saved }, or null when there's nothing yet. `saved` is false
// when the device wouldn't keep it.
export function playSummary(key) {
  const mission = missionById(key);
  const p = plays.get(key);
  if (p) return { tick: p.game.world.tick, completed: p.progress.completed.includes(key) || p.game.world.mission?.done != null, saved: !p.unsaved };
  const read = mission && readSave(loadLocal(saveName(key)), mission);
  return read && !read.problem ? { tick: read.world.tick, completed: read.progress.completed.includes(key), saved: true } : null;
}

// Forgets mission `key`'s play, its save and every change to its programs: the
// next visit starts it afresh.
export function forgetPlay(key) {
  removeLocal(saveName(key));
  if (current === plays.get(key)) current = null;
  plays.delete(key);
  changes++;
}

// The player has read the play's notice.
export function dismissNotice() {
  play().notice = null;
  changes++;
}

// --- The library ------------------------------------------------------------

// How many times a library or a play has changed: a view that shows them draws
// again when this does.
export const libraryChanges = () => changes;
export const libraryChanged = () => changes++;

// Block `blockId` of revision `revision` of program `programId`, as a node of
// its source (src/programming/adapter.js), or null. Sources never change once
// applied, so each is read once, for each library: two plays can each have a
// revision 1 of a program, with different blocks.
const indexes = new WeakMap(); // library → Map("id revision" → index)
export function blockOf(programId, revision, blockId) {
  const library = currentLibrary();
  if (!indexes.has(library)) indexes.set(library, new Map());
  const cache = indexes.get(library);
  const key = `${programId} ${revision}`;
  if (!cache.has(key)) {
    const source = sourceAt(library, programId, revision);
    cache.set(key, source ? blockIndex(readWorkspace(source).tree) : new Map());
  }
  return cache.get(key).get(blockId) ?? null;
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
// world at the next tick, by Step or by the running clock, and starts whatever
// had it parked. Returns applyDraft's result.
export function applyProgram(id) {
  const result = applyDraft(currentLibrary(), id, programContext(id));
  if (result.command) {
    const game = currentGame();
    if (game.world.tick > 0) play().changed = true;
    for (const command of applyCommands(game.world, result.command)) game.queue(command);
    changes++;
  }
  return result;
}

// Program `id`'s name, a message reference, or null.
export const programName = (id) => programDoc(currentLibrary(), id)?.name ?? null;
