import { ISLAND } from "../content/island.js";
import { ADD_SPOTS, FREE_CONTENT, LAYOUT, freeContent } from "../content/free.js";
import { CAMPAIGN, campaignMission, isCampaignMission, nextMission, opener, unlockedBlocks } from "../content/missions/campaign.js";
import { BASE } from "../content/missions/island.js";
import { missionById } from "../content/missions/index.js";
import { SLICE } from "../content/missions/slice.js";
import { workspace } from "../content/build.js";
import { missionStart } from "../campaign.js";
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
  giveDraft,
  latest,
  newProgram,
  newestPrograms,
  programDoc,
  renameProgram,
  sourceAt,
  wordStarter,
} from "../programming/programs.js";
import { choicesOf, makeChoices, programFor } from "../sim/bindings.js";
import { applyCommand, installProgram } from "../sim/commands.js";
import { walkable } from "../sim/navigation.js";
import { checkPlacement } from "../sim/placement.js";
import { cellAt } from "../sim/terrain.js";
import { createWorld } from "../sim/world.js";
import { loadLocal, removeLocal, saveLocal } from "../storage/local.js";
import { makeSave, readSave } from "../storage/saves.js";

// The games of this visit, shared by the pages that show them, each with its
// program library (src/programming/programs.js): the blocks of every program,
// as applied and as being edited. The plays there are:
//
// - "campaign": the campaign's missions (PLAN.md §9; docs/campaign-planv2.md),
//   one after another over its map (campaign.js). Every mission stands alone
//   (src/campaign.js): it starts from its own start set with its own programs,
//   and once it's done, the next starts afresh and nothing of the one before
//   is kept but that it was done. Saved on the device as it's played, so a
//   mission not yet done goes on where it was after a reload; one that was done
//   goes on to the next. A save from before the campaign's second plan took
//   over (18 October 2026) can't be read, and is let go.
// - "replay": a mission done before, played again from its start apart from
//   the campaign. Saved too, until it's done again: opened after that, it
//   starts afresh.
// - "free": free play, the island without a mission, open after mission 15,
//   the sandbox after mission 25 (src/content/free.js), with programs of its
//   own. Saved too.
// - "slice": Phase 5's bridge slice, mission 15 played on its own. Saved.
// - "island": the free island of Phases 3–6, where every program runs from the
//   start. The island page and the world lab show it, for this visit only.
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
// `mission` is the mission being played, or null; `content` what the play's
// world was made from, whose blueprints are the buildings the player can place
// (src/content/island.js). `progress` is the missions done at least once;
// `notice` says something about saving the player should know: "discarded" (a
// save that couldn't be read was let go) or "unsaved" (the device won't keep
// the game), until the player has read it; `unsaved` whether the last save
// failed; `changed` whether a program was applied after the world had begun to
// run. An applied program starts again from its start, with an empty basket,
// while the rest of the island has moved on, so such a change is best watched
// from the checkpoint: the mission's card offers that.

const CAMPAIGN_CONTENT = { id: BASE.id, version: BASE.version };

// What each saved play's save is checked against (src/storage/saves.js).
const SAVES = {
  slice: { content: { id: SLICE.content.id, version: SLICE.content.version }, missions: (id) => id === SLICE.id },
  campaign: { content: CAMPAIGN_CONTENT, missions: isCampaignMission },
  replay: { content: CAMPAIGN_CONTENT, missions: isCampaignMission },
  free: { content: FREE_CONTENT, missions: null },
};

const plays = new Map();
let current = null;
let changes = 0; // counted up whenever a library or a play changes, for views to notice

// The play `key`, made the one the session's functions work on: made the first
// time it's asked for, from its save if it has one. For a replay, `mission`
// names the mission: one already in hand of another, or done, starts afresh.
export function usePlay(key, { mission = null } = {}) {
  if (key === "replay" && isCampaignMission(mission)) {
    if (!plays.has("replay")) plays.set("replay", makePlay("replay"));
    const held = plays.get("replay");
    if (held.mission?.id !== mission || held.game.world.mission?.done != null) startReplay(mission);
  }
  if (!plays.has(key)) plays.set(key, makePlay(key));
  current = plays.get(key);
  return current;
}
const play = () => current ?? usePlay("island");

export const currentPlay = () => play();
export const currentLibrary = () => play().library;
export const currentGame = () => play().game;

const saveName = (key) => `save.${key}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

function makePlay(key) {
  if (key === "island") return freshPlay(key, null, ISLAND);
  if (key === "campaign") {
    // A mission done and saved isn't played again: the next one starts.
    const p = savedPlay(key, () => missionPlay(key, CAMPAIGN[0]));
    goOn(p);
    return p;
  }
  if (key === "replay") return savedPlay(key, () => missionPlay(key, CAMPAIGN[0]));
  if (key === "free") return savedPlay(key, () => freePlayOf(LAYOUT, { programs: [] }));
  const mission = missionById(key);
  if (!mission?.content) throw new Error(`no play ${key}`);
  return savedPlay(key, () => freshPlay(key, mission, mission.content));
}

// A play of `world`, its checkpoint, from now.
const playOf = (key, mission, content, library, world) => ({
  key,
  mission,
  content,
  library,
  checkpoint: clone(world),
  game: createGame(world),
  progress: { completed: [] },
  notice: null,
  unsaved: false,
  changed: false,
});

// A play of `content` from its start, with its starter programs, the names
// the game gave in them worded in the player's language (PLAN.md §8).
function freshPlay(key, mission, content) {
  const library = createLibrary(content.programs, { word: display });
  return playOf(key, mission, content, library, createWorld({ ...content, programs: newestPrograms(library) }));
}

// Play `key` as saved, or `fresh()` when it isn't, or when its save can't be
// used, which the player is told.
function savedPlay(key, fresh) {
  const saved = loadLocal(saveName(key));
  const read = saved && readSave(saved, SAVES[key]);
  if (!read || read.problem) {
    const p = fresh();
    if (read?.problem) {
      console.warn(`The saved game of ${key} can't be used (${read.problem}); starting afresh.`);
      p.notice = "discarded";
    }
    return p;
  }
  const mission = read.mission ? missionById(read.mission) : null;
  const content = key === "slice" ? SLICE.content : key === "free" ? freeContent() : missionContent(mission);
  const p = { ...playOf(key, mission, content, read.library, read.world), checkpoint: read.checkpoint, progress: read.progress };
  // Applies that were waiting for the next tick when the game was saved wait
  // again (saves.js).
  for (const command of pendingPublishes(read.library, read.world)) applyCommands(read.world, command).forEach((c) => p.game.queue(c));
  return p;
}

// Publish commands for every program whose newest revision `world` doesn't run
// yet, and which compiles there.
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
// made again: who runs what, settings and names (src/sim/bindings.js); but not
// the programs mission `mission`'s trials gave out, which are the mission's.
function fromCheckpoint(checkpoint, library, from = null, mission = null) {
  const world = clone(checkpoint);
  for (const { program } of pendingPublishes(library, world)) installProgram(world, program, { fresh: false });
  if (from) {
    const choices = choicesOf(from);
    const staged = new Set((mission?.trials ?? []).flatMap((t) => Object.keys(t.stage?.run ?? {})));
    choices.entities = choices.entities.map((c) => (staged.has(c.id) ? { ...c, own: world.entities.find((e) => e.id === c.id)?.own ?? null } : c));
    makeChoices(world, choices);
  }
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
  p.game = createGame(fromCheckpoint(p.checkpoint, p.library, from, p.mission));
  p.game.clock.setSpeed(speed);
  p.changed = false;
  changes++;
  return p.game;
}

// --- The campaign -----------------------------------------------------------------

// Mission `mission` as play `key`, from its start: its start set and its own
// programs alone (src/campaign.js), the names the game gave in them worded in
// the player's language; `progress` the campaign's so far.
function missionPlay(key, mission, progress = { completed: [] }) {
  const { world, library } = missionStart(mission, { word: display });
  return { ...playOf(key, mission, missionContent(mission), library, world), progress: { completed: [...progress.completed] } };
}

// What a play of mission `mission` offers to place: the buildings it lets the
// player place, each with the program its construction site starts with.
const missionContent = (mission) => (mission?.blueprints ? { blueprints: mission.blueprints } : {});

// The campaign's progress, in this visit or saved: { mission, done, completed,
// saved }: the mission it's at, whether that one is done, every mission done at
// least once, and whether the device keeps it. Null before it has begun. A
// mission saved once it was done is already the next, as goOn makes it.
export function campaignStatus() {
  const p = plays.get("campaign");
  if (p) {
    const done = p.game.world.mission?.done != null;
    const completed = done && !p.progress.completed.includes(p.mission.id) ? [...p.progress.completed, p.mission.id] : p.progress.completed;
    return { mission: p.mission, done, completed, tick: p.game.world.tick, saved: !p.unsaved };
  }
  const read = readSave(loadLocal(saveName("campaign")), SAVES.campaign);
  if (!read || read.problem) return null;
  const mission = campaignMission(read.mission);
  const done = read.world.mission?.done != null;
  const completed = done && !read.progress.completed.includes(mission.id) ? [...read.progress.completed, mission.id] : read.progress.completed;
  const next = done && nextMission(mission, completed);
  if (next) return { mission: next, done: false, completed, tick: 0, saved: true };
  return { mission, done, completed, tick: read.world.tick, saved: true };
}

// What the campaign has opened: free play after mission 15, the sandbox after
// 25, settings with chapter 17's mission 82 (docs/campaign-planv2.md), and
// the blocks of every mission done.
export function unlocked() {
  const completed = campaignStatus()?.completed ?? [];
  const has = (what) => completed.includes(opener(what)?.id);
  const blocks = CAMPAIGN.filter((m) => completed.includes(m.id)).flatMap(unlockedBlocks);
  return { free: has("free"), sandbox: has("sandbox"), settings: completed.includes("c2-m082"), blocks: [...new Set(blocks)] };
}

// Campaign play `p` goes on to the next mission, once the one it's at is done:
// the next from its start, and nothing of the one done kept but its place in
// the progress. Returns whether it went on; the last mission stays as it is.
function goOn(p) {
  if (p.game.world.mission?.done == null) return false;
  if (!p.progress.completed.includes(p.mission.id)) p.progress.completed.push(p.mission.id);
  const next = nextMission(p.mission, p.progress.completed);
  if (!next) return false;
  p.game.pause();
  Object.assign(p, missionPlay("campaign", next, p.progress), { notice: p.notice, unsaved: p.unsaved });
  changes++;
  return true;
}

// The mission the campaign goes on to once the one it's at is done, or null
// when there's none.
export function upcomingMission() {
  const p = plays.get("campaign");
  return p ? nextMission(p.mission, p.progress.completed) : null;
}

// The campaign goes on to the next mission, once the one it's at is done.
// Returns whether it did.
export function nextCampaignMission() {
  const p = plays.get("campaign");
  if (!p || !goOn(p)) return false;
  if (current === p) savePlay();
  return true;
}

// Starts a replay of mission `id` from its start, in place of any other.
// Returns its play.
export function startReplay(id) {
  const p = missionPlay("replay", campaignMission(id));
  if (current === plays.get("replay")) current = p;
  plays.set("replay", p);
  changes++;
  return p;
}

// --- Free play and the sandbox --------------------------------------------------

// Free play on an island laid out as `layout` says (src/content/free.js), with
// `library`'s programs as last applied where the island has them.
function freePlayOf(layout, library) {
  const content = freeContent(layout);
  const starters = createLibrary(content.programs, { word: display });
  const merged = { programs: [...starters.programs.filter((d) => !programDoc(library, d.id)), ...clone(library.programs)].sort((a, b) => (a.id < b.id ? -1 : 1)) };
  const world = fromCheckpoint(createWorld(content), merged);
  return playOf("free", null, content, merged, world);
}

// The sandbox's island laid out anew as `layout` says, keeping the library.
export function newFreeIsland(layout) {
  const old = plays.get("free");
  const p = freePlayOf(layout, old?.library ?? { programs: [] });
  p.progress = old?.progress ?? p.progress;
  if (current === old) current = p;
  plays.set("free", p);
  changes++;
  savePlay();
  return p;
}

// The most robots the sandbox has room for.
export const MAX_ROBOTS = 12;

// A new robot by the camp at the next step, in the sandbox. Returns its id,
// or null when there's no room for another.
export function addRobot() {
  const world = peekWorld();
  const robots = world.entities.filter((e) => e.kind === "robot");
  if (robots.length >= MAX_ROBOTS) return null;
  let n = 1;
  while (world.entities.some((e) => e.id === `r${n}`)) n++;
  const walk = walkable(world);
  const taken = new Set(robots.map((r) => r.cell));
  const spot = ADD_SPOTS.find(([x, z]) => walk[cellAt(world.terrain, x, z)] && !taken.has(cellAt(world.terrain, x, z))) ?? ADD_SPOTS.find(([x, z]) => walk[cellAt(world.terrain, x, z)]);
  queue([{ type: "add", robot: { id: `r${n}`, name: ref("entity.robo", { n }), cell: spot } }]);
  return `r${n}`;
}

// Thing `at`'s stock of `item` set to `count` at the next step, in the sandbox.
export const setStock = (at, item, count) => queue([{ type: "stock", at, item, count }]);

// --- What a play offers -----------------------------------------------------------

// The tools a play can offer (PLAN.md §11, Phase 6): "library" (giving
// programs, teams, copies and the program library), "settings" and "build".
export const TOOLS = ["library", "settings", "build"];

// What the current play offers: its `tools`; the `blocks` its toolboxes may
// hold (src/blockly/toolboxes.js), null for every block; whether its editor
// offers starting from nothing (`blank`); and whether it's the `sandbox`.
// A mission offers what it and the missions before it unlocked, and always the
// program library, so every program can be opened, and given to any robot or
// building, at any time (decided 17 October 2026: in mission 16 the sawmill has
// no job, and its programs were out of reach); free play what the campaign
// has, and the sandbox more.
const MISSION_TOOLS = ["library"];

export function rules(p = play()) {
  if (p.key === "island") return { tools: TOOLS, blocks: null, blank: true, sandbox: false };
  if (p.key === "free") {
    const open = unlocked();
    const tools = ["library", ...(open.settings ? ["settings"] : []), ...(open.sandbox ? ["build"] : [])];
    return { tools, blocks: ["island_when_started", ...open.blocks], blank: true, sandbox: open.sandbox };
  }
  if (!isCampaignMission(p.mission?.id)) return { tools: p.mission?.tools ?? [], blocks: null, blank: false, sandbox: false };
  return { tools: TOOLS.filter((tool) => MISSION_TOOLS.includes(tool) || p.mission.tools?.includes(tool)), blocks: unlockedBlocks(p.mission), blank: !!p.mission.project, sandbox: false };
}
export const tools = () => rules().tools;

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
  if (game.world.tick > 0 && commands.some((c) => !["settings", "name", "add", "stock"].includes(c.type))) play().changed = true;
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

// A new program (createProgram), given to robot or building `entity` alone at
// the next step. Returns its id.
export function newProgramFor(entity) {
  const id = createProgram();
  queue(COMMANDS.give(entity, id));
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

// The draft of program `id` as a mission's help gives it (docs/campaign-plan.md,
// “Show me a start”): "start", the mission's partial program; "whole", its
// reference solution; or "blank", the start block alone, for starting from
// nothing. Like any edit, it runs once applied; “Undo changes” goes back to
// what runs, and a draft with changes not applied is kept in the history
// (giveDraft). Returns whether there was such a program.
export function showProgram(id, which) {
  const p = play();
  const doc = programDoc(p.library, id);
  if (!doc) return false;
  const given = which === "start" ? p.mission?.scaffold?.[id] : which === "whole" ? p.mission?.reference?.programs?.[id] : null;
  // A start or the whole program names variables and blocks of its own as the
  // starters do, worded in the player's language as it's shown.
  const source = given ? wordStarter(given, display) : which === "blank" ? startOnly(doc.draft) : null;
  if (!source) return false;
  giveDraft(p.library, id, source);
  changes++;
  return true;
}

// Workspace `source` with its start block alone, where it lies: a new one
// when it has none.
function startOnly(source) {
  const start = (source?.blocks?.blocks ?? []).find((b) => b.type === "island_when_started");
  if (!start) return workspace({ type: "island_when_started", id: "start", x: 20, y: 20 });
  const { next, ...alone } = start;
  return { ...clone(source), blocks: { languageVersion: 0, blocks: [clone(alone)] } };
}

// --- Placing buildings ------------------------------------------------------------

// The buildings the current play lets the player place, with the program each
// one's construction site starts with: [{ blueprint, program }]. Free play
// places them once it has grown into the sandbox.
export function blueprints() {
  const p = play();
  if (p.key === "free" && !unlocked().sandbox) return [];
  return p.content.blueprints ?? [];
}

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

// --- Saving -------------------------------------------------------------------

// Saves the current play, if it's one that's saved, as it stands: a tick
// boundary, since ticks happen only within a frame. A mission done for the
// first time is noted in its progress. Returns whether the device kept it.
export function savePlay() {
  const p = play();
  if (!SAVES[p.key]) return false;
  const { world } = p.game;
  if (p.mission && world.mission?.done != null && !p.progress.completed.includes(p.mission.id)) p.progress.completed.push(p.mission.id);
  const save = makeSave({ content: SAVES[p.key].content, mission: p.mission?.id ?? null, world, library: p.library, checkpoint: p.checkpoint, progress: p.progress });
  const kept = saveLocal(saveName(p.key), save);
  if (!kept && !p.unsaved) {
    p.notice = "unsaved";
    changes++;
  }
  p.unsaved = !kept;
  return kept;
}

// What there is of play `key`, in this visit or saved on the device: { tick,
// completed, saved }, or null when there's nothing yet. `completed` is whether
// its mission is done; `saved` is false when the device wouldn't keep it.
export function playSummary(key) {
  const p = plays.get(key);
  if (p) return { tick: p.game.world.tick, completed: (!!p.mission && p.progress.completed.includes(p.mission.id)) || p.game.world.mission?.done != null, saved: !p.unsaved };
  const read = SAVES[key] && readSave(loadLocal(saveName(key)), SAVES[key]);
  return read && !read.problem ? { tick: read.world.tick, completed: !!read.mission && read.progress.completed.includes(read.mission), saved: true } : null;
}

// Forgets play `key`, its save and every change to its programs: the next
// visit starts it afresh.
export function forgetPlay(key) {
  removeLocal(saveName(key));
  if (current === plays.get(key)) current = null;
  plays.delete(key);
  changes++;
}

// Forgets the campaign, and with it free play and any replay: the next
// visit starts at mission 1.
export function forgetCampaign() {
  for (const key of ["campaign", "replay", "free"]) forgetPlay(key);
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
