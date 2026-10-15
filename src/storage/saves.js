import { COMPILER_VERSION, compile } from "../programming/compiler.js";
import { checkLibrary, prunedLibrary, sourceAt } from "../programming/programs.js";
import { canonicalJson } from "../sim/replay.js";
import { checkWorld } from "../sim/validate.js";
import { SIM_VERSION } from "../sim/world.js";

// A saved game (PLAN.md §10, Persistence): one envelope of plain data, made at a
// tick boundary, holding everything a mission needs to go on exactly where it
// was after a reload.
//
//   { format: "robot-island", schema, sim, compiler, mission, content: { id, version },
//     world, library, checkpoint, progress: { completed: [mission id, …] } }
//
// - schema: SAVE_SCHEMA, the shape of this envelope; sim and compiler: the
//   SIM_VERSION and COMPILER_VERSION that made the world and its programs.
// - world: the world as it stands, with its runtimes, actions and holds.
// - library: the program library (src/programming/programs.js), keeping only
//   the revisions the world or the checkpoint run, and each program's newest.
//   A newer revision than the world runs is an Apply waiting for the next tick;
//   it's applied again when the game goes on (src/ui/session.js).
// - checkpoint: the world at the mission's start, which Start again goes back
//   to (PLAN.md §9).
// - progress: the missions done at least once.
//
// A save is read back only by a game of the same versions: before Phase 9's
// migrations, one from another version is let go and the mission starts afresh
// (PLAN.md §11, Phase 5). Every part is checked before the game uses any of it.

export const SAVE_FORMAT = "robot-island";
export const SAVE_SCHEMA = 1;

const copy = (value) => JSON.parse(JSON.stringify(value));

// The save of a game of mission `mission` (src/content/missions/).
export function makeSave({ mission, world, library, checkpoint, progress }) {
  const runs = (id) => [world, checkpoint].flatMap((w) => w.programs.filter((p) => p.id === id).map((p) => p.revision));
  return {
    format: SAVE_FORMAT,
    schema: SAVE_SCHEMA,
    sim: SIM_VERSION,
    compiler: COMPILER_VERSION,
    mission: mission.id,
    content: { id: mission.content.id, version: mission.content.version },
    world: copy(world),
    library: prunedLibrary(library, runs),
    checkpoint: copy(checkpoint),
    progress: { completed: [...progress.completed] },
  };
}

// Save `save`, read for mission `mission`: { world, library, checkpoint,
// progress }, or { problem } when it can't be used, which names the first part
// that's wrong: "format", "version" (another schema, simulation or compiler),
// "mission" (another mission, or another version of it), "library", "world",
// "checkpoint" or "programs" (a world runs something its library's blocks don't
// compile to), "progress".
export function readSave(save, mission) {
  if (!save || typeof save !== "object" || save.format !== SAVE_FORMAT) return { problem: "format" };
  if (save.schema !== SAVE_SCHEMA || save.sim !== SIM_VERSION || save.compiler !== COMPILER_VERSION) return { problem: "version" };
  const content = { id: mission.content.id, version: mission.content.version };
  if (save.mission !== mission.id || canonicalJson(save.content) !== canonicalJson(content)) return { problem: "mission" };
  const { world, library, checkpoint, progress } = save;
  if (checkLibrary(library).length) return { problem: "library" };
  for (const [name, w] of [
    ["world", world],
    ["checkpoint", checkpoint],
  ]) {
    if (!w || typeof w !== "object" || canonicalJson(w.content) !== canonicalJson(content) || w.mission?.id !== mission.id) return { problem: name };
    if (checkWorld(w).length) return { problem: name };
  }
  if (checkpoint.tick > world.tick) return { problem: "checkpoint" };
  if (!programsMatch(world, library) || !programsMatch(checkpoint, library)) return { problem: "programs" };
  if (!Array.isArray(progress?.completed) || !progress.completed.every((id) => typeof id === "string")) return { problem: "progress" };
  return { world, library, checkpoint, progress: { completed: [...progress.completed] } };
}

// Whether every program `world` runs is what its revision's blocks in `library`
// compile to, instruction for instruction (PLAN.md §10: published workspaces are
// compiled again on load).
function programsMatch(world, library) {
  const places = [...world.entities, ...world.nodes].map((t) => t.id);
  return world.programs.every((p) => {
    const source = sourceAt(library, p.id, p.revision);
    const { program } = source ? compile(source, { places }) : {};
    return !!program && canonicalJson({ id: p.id, revision: p.revision, ...program }) === canonicalJson(p);
  });
}
