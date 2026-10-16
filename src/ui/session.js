import { ISLAND } from "../content/island.js";
import { missionById } from "../content/missions/index.js";
import { workspace } from "../content/build.js";
import { createGame } from "../game.js";
import { display, ref } from "../i18n/index.js";
import { blockIndex, readWorkspace } from "../programming/adapter.js";
import { compile } from "../programming/compiler.js";
import {
  applyDraft,
  archiveProgram,
  checkDraft,
  copyProgram,
  createLibrary,
  freeProgramId,
  latest,
  newProgram,
  newestPrograms,
  programDoc,
  renameProgram,
  sourceAt,
} from "../programming/programs.js";
import { choicesOf, makeChoices, programFor } from "../sim/bindings.js";
import { applyCommand, installProgram } from "../sim/commands.js";
import { checkPlacement } from "../sim/placement.js";
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
// to it, keeping the programs as last applied and their drafts, and the
// player's choices of who runs what, robots' settings and names (PLAN.md §9);
// buildings placed since are part of the world, and go.
//
//   play = { key, mission, content, library, checkpoint, game, progress, notice, unsaved, changed }
//
// `content` is what the play's world was made from: its blueprints are the
// buildings the player can place (src/content/island.js).
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

// A play of `content` from its start, with its starter programs, the names
// the game gave in them worded in the player's language (PLAN.md §8).
function freshPlay(key, mission, content) {
  const library = createLibrary(content.programs, { word: display });
  const checkpoint = createWorld({ ...content, programs: newestPrograms(library) });
  return { key, mission, content, library, checkpoint, game: createGame(clone(checkpoint)), progress: { completed: [] }, notice: null, unsaved: false, changed: false };
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
  return { key: mission.id, mission, content: mission.content, library: read.library, checkpoint: read.checkpoint, game, progress: read.progress, notice: null, unsaved: false, changed: false };
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

// What applying a program sends the world: its `publish` command, then a
// `start` for each robot or building in `world` that has the program parked,
// so applying it starts them too (src/programming/runtime.js).
function applyCommands(world, publish) {
  const { id } = publish.program;
  const parked = world.entities.filter((e) => e.runtime?.kind === "program" && e.runtime.program === id && e.runtime.parked);
  return [publish, ...parked.map((e) => ({ type: "start", entity: e.id }))];
}

// The checkpoint's world, running the programs of `library` as last applied,
// with what the checkpoint gave each robot to carry; parked programs stay
// parked. With `from`, a world played since, the player's choices in it are
// made again: who runs what, settings and names (src/sim/bindings.js).
function fromCheckpoint(checkpoint, library, from = null) {
  const world = clone(checkpoint);
  for (const { program } of pendingPublishes(library, world)) installProgram(world, program, { fresh: false });
  if (from) makeChoices(world, choicesOf(from));
  return world;
}

// The current play from its checkpoint again, at the speed it had. It keeps the
// programs as the player applied them, and their drafts (PLAN.md §9: starting
// again keeps edited programs), and who runs what, settings and names, as the
// player last chose them; each program's editor can go back to its starter.
// Returns the new game.
export function newGame() {
  const p = play();
  const speed = p.game.clock.speed;
  const from = peekWorld();
  p.game.pause();
  p.game = createGame(fromCheckpoint(p.checkpoint, p.library, from));
  p.game.clock.setSpeed(speed);
  p.changed = false;
  changes++;
  return p.game;
}

// --- The world as it will be ---------------------------------------------------

// The current world as it will be at the next step, once the commands waiting
// for it are applied: who runs what, settings and placed buildings as the
// player has chosen them, before the world has ticked. The world itself when
// nothing waits. Worked out once for each change, and never changed by a view.
const peeks = new WeakMap(); // game → { world, tick, version, peeked }
export function peekWorld(game = currentGame()) {
  if (!game.queued) return game.world;
  const hit = peeks.get(game);
  if (hit && hit.world === game.world && hit.tick === game.world.tick && hit.version === game.queueVersion) return hit.peeked;
  const peeked = clone(game.world);
  for (const command of game.pending) applyCommand(peeked, command);
  peeks.set(game, { world: game.world, tick: game.world.tick, version: game.queueVersion, peeked });
  return peeked;
}

// What `commands`, given after those already waiting, would do at the next
// step: { ok, changed: [{ id, program }] }, where `changed` is every robot and
// building that would start a program again, or stop, with the program it
// would run then, or null. `ok` is false when a command wouldn't fit.
export function preview(commands) {
  const world = clone(peekWorld());
  const before = new Map(world.entities.map((e) => [e.id, JSON.stringify(e.runtime)]));
  const ok = commands.every((c) => applyCommand(world, c).ok);
  const changed = world.entities.filter((e) => before.has(e.id) && before.get(e.id) !== JSON.stringify(e.runtime)).map((e) => ({ id: e.id, program: e.runtime?.program ?? null }));
  return { ok, changed };
}

const queue = (commands) => {
  const game = currentGame();
  if (game.world.tick > 0 && commands.some((c) => c.type !== "settings" && c.type !== "name")) play().changed = true;
  for (const command of commands) game.queue(command);
  changes++;
};

// --- Who runs what --------------------------------------------------------------

// The `publish` command for the newest revision of program `id` of the library,
// if the world as it will be doesn't have it yet, such as a new program or a
// copy; else none.
function publishIfNew(id) {
  const world = peekWorld();
  const newest = latest(programDoc(currentLibrary(), id));
  if (world.programs.some((p) => p.id === id && p.revision === newest.revision)) return [];
  const { program } = compile(newest.source, { places: [...world.entities, ...world.nodes].map((t) => t.id) });
  return program ? [{ type: "publish", program: { id, revision: newest.revision, ...program } }] : [];
}

// Whether entity `id` of the world as it will be could run program
// `programId`: its newest blocks compile for the entity's type, which can do
// everything they ask, and make what they make (a sawmill no kits). Applied
// blocks never change, so each is compiled once for each type.
const fits = new WeakMap(); // applied source → Map(type → whether it compiles for it)
export function canRunProgram(id, programId) {
  const e = peekWorld().entities.find((it) => it.id === id);
  const doc = programDoc(currentLibrary(), programId);
  if (!e || !doc) return false;
  const { source } = latest(doc);
  if (!fits.has(source)) fits.set(source, new Map());
  const byType = fits.get(source);
  if (!byType.has(e.type)) byType.set(e.type, !!compile(source, { type: e.type }).program);
  return byType.get(e.type);
}

// The commands that give each choice of the player at the next step.
export const COMMANDS = {
  // Entity `entity`'s own program `program`, or null to go back to its team's
  // or type's.
  give: (entity, program) => [...(program ? publishIfNew(program) : []), { type: "assign", entity, program }],
  // Robot `entity` on team `role`, or none.
  team: (entity, role) => [{ type: "role", entity, role }],
  // Team `role`'s program, or every robot or building of type `entityType`'s.
  shared: (target, program) => [...(program ? publishIfNew(program) : []), { type: "default", ...target, program }],
};

// Makes the choice `commands` (COMMANDS) at the next step.
export const choose = (commands) => queue(commands);

// Gives robot or building `entity` its own copy of the program it runs: a new
// program in the library, named for it, which only it runs from the next
// step. Returns the new program's id.
export function makeOwnCopy(entityId) {
  const world = peekWorld();
  const e = world.entities.find((it) => it.id === entityId);
  const from = e?.runtime?.program;
  if (!from) return null;
  const library = currentLibrary();
  const id = freeProgramId(library, `${from}-${entityId}`, world.programs.map((p) => p.id));
  copyProgram(library, from, { newId: id, name: ref("programName.copy", { program: programDoc(library, from).name, name: e.name }) });
  queue(COMMANDS.give(entityId, id));
  return id;
}

// Robot `entity`'s setting `slot` set to `value` (a place or item id, or null)
// at the next step.
export const setSetting = (entity, slot, value) => queue([{ type: "settings", entity, settings: { [slot]: value } }]);

// The player's name for robot `entity`, at the next step.
export const nameRobot = (entity, name) => queue([{ type: "name", entity, name }]);

// --- Programs in the library -----------------------------------------------------

// Where program `id` is used in the world as it will be: the robots and
// buildings that run it, and the teams and types whose program it is.
export function programUse(id) {
  const world = peekWorld();
  return {
    runners: world.entities.filter((e) => e.runtime?.kind === "program" && e.runtime.program === id).map((e) => e.id),
    roles: world.roles.filter((r) => r.program === id).map((r) => r.id),
    types: world.defaults.filter((d) => d.program === id).map((d) => d.type),
  };
}
const unused = (id) => Object.values(programUse(id)).every((list) => !list.length);

// A new program, just a start block, named “New program n”. Returns its id.
export function createProgram() {
  const library = currentLibrary();
  const id = freeProgramId(library, "program", peekWorld().programs.map((p) => p.id));
  const n = id === "program" ? 1 : Number(id.slice("program-".length));
  newProgram(library, { newId: id, name: ref("programName.new", { n }), source: workspace({ type: "island_when_started", id: "start", x: 20, y: 20 }) });
  changes++;
  return id;
}

// A copy of program `id`, as a program of its own nothing runs yet. Returns
// its id.
export function duplicateProgram(id) {
  const library = currentLibrary();
  const newId = freeProgramId(library, `${id}-copy`, peekWorld().programs.map((p) => p.id));
  copyProgram(library, id, { newId, name: ref("programName.duplicate", { program: programDoc(library, id).name }) });
  changes++;
  return newId;
}

// The player names program `id` `name`; blank changes nothing. Returns
// whether it did.
export function nameProgram(id, name) {
  const words = typeof name === "string" ? name.trim() : "";
  if (!words || words.length > 40) return false;
  renameProgram(currentLibrary(), id, words);
  changes++;
  return true;
}

// Puts program `id` away, if nothing uses it, or brings it back. Returns
// whether it did.
export function putAway(id, away = true) {
  if (away && !unused(id)) return false;
  archiveProgram(currentLibrary(), id, away);
  changes++;
  return true;
}

// --- Placing buildings ------------------------------------------------------------

// The buildings the current play lets the player place, with the program each
// one's construction site starts with: [{ blueprint, program }].
export const blueprints = () => play().content.blueprints ?? [];

// Whether `request` ({ blueprint, x, z, facing }) can be placed in the world
// as it will be: checkPlacement's answer.
export const checkPlace = (request) => checkPlacement(peekWorld(), request);

// Places `request`'s building at the next step, its site running the
// blueprint's program. Returns whether it fits.
export function placeBuilding(request) {
  const plan = blueprints().find((b) => b.blueprint === request.blueprint);
  if (!plan || checkPlace(request).problem) return false;
  queue([{ type: "place", ...request, program: plan.program }]);
  return true;
}

// The tools the current play offers (PLAN.md §11, Phase 6): "library" (giving
// programs, teams, copies and the program library), "settings" and "build".
// The free island offers all; a mission, those it names.
export const TOOLS = ["library", "settings", "build"];
export const tools = () => (play().mission ? (play().mission.tools ?? []) : TOOLS);

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

// What runs program `id` in the world as it will be at the next step (so a
// change of who runs what that's waiting counts), and what it may use there:
// the robots' and buildings' types, the blueprints of construction sites
// among them, and the island's places.
export function programContext(id) {
  const w = peekWorld();
  const runners = w.entities.filter((e) => e.runtime?.kind === "program" && e.runtime.program === id);
  const builds = [...new Set(runners.map((e) => e.blueprint).filter(Boolean))];
  return { runners, types: [...new Set(runners.map((e) => e.type))], builds, places: [...w.entities, ...w.nodes].map((t) => t.id) };
}

// The draft of program `id`, checked for what runs it (checkDraft).
export const checkProgram = (id) => checkDraft(currentLibrary(), id, programContext(id));

// Applies the draft of program `id` (PLAN.md §5): its new revision reaches the
// world at the next tick, by Step or by the running clock, and starts whatever
// had it parked. Returns applyDraft's result.
export function applyProgram(id) {
  const result = applyDraft(currentLibrary(), id, programContext(id));
  if (result.command) queue(applyCommands(peekWorld(), result.command));
  return result;
}

// Program `id`'s name, a message reference or the player's words, or null.
export const programName = (id) => programDoc(currentLibrary(), id)?.name ?? null;

// The program robot or building `entity` would run without its own: its
// team's or its type's, in the world as it will be.
export const sharedProgram = (entity) => programFor(peekWorld(), { ...entity, own: null });
