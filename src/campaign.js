import { BLOCKS } from "./blockly/blocks.js";
import { CAMPAIGN, unlockedBlocks } from "./content/missions/campaign.js";
import { BASE, THINGS } from "./content/missions/island.js";
import { compile } from "./programming/compiler.js";
import { applyDraft, latest, newProgram, programDoc, setDraft, wordStarter } from "./programming/programs.js";
import { beginTrial, createMission, needOf } from "./sim/objectives.js";
import { room } from "./sim/inventory.js";
import { enter } from "./sim/staging.js";
import { thing } from "./sim/things.js";
import { advanceWorld, createWorld } from "./sim/world.js";

// The campaign's worlds (PLAN.md §9, “Missions stand alone”): each mission
// is a start set and its goals, nothing more. Nothing the player did in another
// mission carries into it, neither programs nor stock nor names (decided 17
// October 2026: carrying work over confused children of 7–9). Used by the game
// (src/ui/session.js), by the tests, and by scripts/verify-missions.js, which
// plays every mission's reference solution from its start.
//
// The island before mission 1 is BASE (src/content/missions/island.js). A
// mission's setup is written as what it changes on the island of the mission
// before (src/sim/staging.js), so its start set is the island with the setup
// of every mission up to it made in turn, nothing played between: the bridge
// is there from mission 16, the workshop from 25. Its library holds its own
// starter programs alone.

const copy = (value) => JSON.parse(JSON.stringify(value));

// The island before mission 1.
export const baseWorld = () => createWorld(BASE);

// A library of mission `mission`'s starter programs, worded by `word` as
// they're copied in (src/programming/programs.js, wordStarter).
function missionLibrary(mission, { word = null } = {}) {
  const library = { programs: [] };
  for (const { id, name, source } of mission.programs) newProgram(library, { newId: id, name, source: word ? wordStarter(source, word) : copy(source) });
  return library;
}

// The programs of `library` a world with things `places` can run, compiled:
// one whose blocks don't compile there is left out.
function compiledPrograms(library, places) {
  return library.programs.flatMap((doc) => {
    const { revision, source } = latest(doc);
    const { program } = compile(source, { places });
    return program ? [{ id: doc.id, revision, ...program }] : [];
  });
}

// Mission `mission`'s setup made on `world`, with `library` its programs: the
// world gets every one it can run and no other, its resources are reset, the
// setup is made (src/sim/staging.js) and the first trial staged.
function enterMission(world, library, mission) {
  const places = [...new Set([...world.entities, ...world.nodes].map((t) => t.id).concat(mission.setup.add ?? []))];
  enter(world, mission.setup, { things: THINGS, programs: compiledPrograms(library, places), restock: true });
  world.mission = createMission({ id: mission.id, trials: mission.trials, goals: mission.goals, reward: mission.reward ?? [] });
  beginTrial(world);
}

// Mission `mission`'s start: { world, library }, the world its checkpoint,
// which Start again goes back to, and the library its own starter programs,
// worded by `word`. The same every time.
export function missionStart(mission, { word = null } = {}) {
  const world = baseWorld();
  for (const m of CAMPAIGN.slice(0, mission.n - 1)) enterMission(world, missionLibrary(m), m);
  const library = missionLibrary(mission, { word });
  enterMission(world, library, mission);
  return { world, library };
}

// --- The reference solutions ----------------------------------------------------

// The commands that apply mission `mission`'s reference solution to `world`
// at its next step, as the player would make them: each of its programs
// applied as the editor applies it (a new one, such as a robot's own copy,
// made first), starting whoever had it parked, then its commands. Changes
// `library`.
export function referenceCommands(world, library, mission) {
  const places = [...world.entities, ...world.nodes].map((t) => t.id);
  const commands = [];
  for (const [id, source] of Object.entries(mission.reference.programs ?? {})) {
    if (!programDoc(library, id)) newProgram(library, { newId: id, name: { key: "programName.new", params: { n: 1 } }, source });
    setDraft(library, id, source);
    const { command, errors } = applyDraft(library, id, { places });
    if (!command) throw new Error(`${mission.id}: reference program ${id} doesn't compile: ${JSON.stringify(errors)}`);
    commands.push(command);
    for (const e of world.entities) if (e.runtime?.kind === "program" && e.runtime.program === id && e.runtime.parked) commands.push({ type: "start", entity: e.id });
  }
  return [...commands, ...copy(mission.reference.commands ?? [])];
}

// Plays `world` until its mission is done or `limit` ticks have passed, giving
// it `commands` at the first. `each(world, trace)` hears every tick. Returns
// whether the mission was done.
export function playMission(world, commands, limit, each = null) {
  let first = commands;
  while (world.mission.done === null && world.tick < limit) {
    const trace = advanceWorld(world, first);
    first = [];
    each?.(world, trace);
  }
  return world.mission.done !== null;
}

// --- What a mission may use -----------------------------------------------------

// Every block type in `source` (Blockly's JSON) that isn't a shadow, with an
// If that has an else as "controls_if_else", the name its unlock goes by.
export function blocksUsed(source) {
  const types = new Set();
  const visit = (b) => {
    if (!b || typeof b !== "object") return;
    types.add(b.type === "controls_if" && b.extraState?.hasElse ? "controls_if_else" : b.type);
    for (const input of Object.values(b.inputs ?? {})) visit(input?.block);
    visit(b.next?.block);
  };
  for (const b of source?.blocks?.blocks ?? []) visit(b);
  return types;
}

// Blocks every program has, or holds without offering them: the start block,
// and the values an action's gap starts with.
const ALWAYS = ["island_when_started", "value_place", "value_raw", "value_item"];
const GAME_BLOCKS = new Set(BLOCKS.map((b) => b.type));
// Blockly's own blocks a mission may use, by the names their unlocks go by.
const BUILT_IN = ["controls_repeat_ext", "controls_if", "controls_if_else", "logic_compare", "math_number", "variables_set", "math_change", "variables_get", "procedures_defnoreturn", "procedures_callnoreturn"];

// What's wrong with mission `mission` as written, checked headlessly, for a
// developer to read: [] when it keeps the campaign's rules.
// - Its reference programs, and the starters of the programs they change, use
//   only blocks the mission has unlocked: what its toolbox offers.
// - At its checkpoint `world`, every store its goals deliver to or make in
//   has room for what they count, and the deposits hold its budget, with what
//   later trials stage in them.
export function missionProblems(mission, world) {
  const problems = [];
  const allowed = new Set([...ALWAYS, ...unlockedBlocks(mission)]);
  const changed = Object.keys(mission.reference.programs ?? {});
  const sources = [
    ...changed.map((id) => [`reference ${id}`, mission.reference.programs[id]]),
    ...mission.programs.filter((p) => changed.includes(p.id)).map((p) => [`starter ${p.id}`, p.source]),
  ];
  for (const [what, source] of sources) {
    for (const type of blocksUsed(source)) {
      if (!allowed.has(type)) problems.push(`${mission.id}: ${what} uses ${type}, which isn't unlocked`);
      else if (!GAME_BLOCKS.has(type) && !BUILT_IN.includes(type)) problems.push(`${mission.id}: ${what} uses ${type}`);
    }
  }
  const goals = (mission.trials ?? [{ goals: mission.goals }]).flatMap((t) => t.goals);
  for (const goal of goals) {
    const at = goal.type === "delivered" ? goal.to : goal.type === "made" ? goal.at : null;
    if (!at) continue;
    const store = thing(world, at)?.store;
    if (!store) problems.push(`${mission.id}: goal ${goal.id} counts at ${at}, which isn't there`);
    else if (goal.item && room(store, goal.item) < needOf(goal)) problems.push(`${mission.id}: ${at} has room for ${room(store, goal.item)} ${goal.item}, goal ${goal.id} counts ${needOf(goal)}`);
  }
  // The deposits as the checkpoint has them, and what each later trial stages
  // in them again (mission 40 fills them for its second run).
  const deposits = world.nodes.filter((d) => d.store.caps);
  for (const [item, n] of Object.entries(mission.budget ?? {})) {
    let held = deposits.reduce((sum, d) => sum + (d.store.items[item] ?? 0), 0);
    for (const trial of (mission.trials ?? []).slice(1)) for (const d of deposits) held += trial.stage?.stock?.[d.id]?.[item] ?? 0;
    if (held < n) problems.push(`${mission.id}: the deposits hold ${held} ${item}, its budget is ${n}`);
  }
  return problems;
}
