import { canonicalJson } from "../sim/replay.js";
import { compile } from "./compiler.js";

// The program library (PLAN.md §5, §10): every program's source, as the player
// edits it and as it was applied. The world keeps only what runs, compiled
// (world.programs); the library keeps the blocks. Phase 4 has what the editor
// and the debugger need; roles, type defaults, copies and the player's own names
// come with Phase 6. It's plain data, so a save can hold it (Phase 5):
//
//   { programs: [{ id, name, starter, draft, published: [{ revision, source }, …] }, …] }
//
// in order of id, where
// - `name` is a message reference until the player renames the program (PLAN.md
//   §8);
// - `starter` is the workspace the game gave it, to go back to;
// - `draft` is the workspace being edited. Editing changes only the draft, never
//   what runs;
// - `published` is every revision applied, oldest first; revision 1 is the
//   starter. The world runs one of them, usually the newest: an applied revision
//   reaches the world at the next tick (game.js), and until then the world runs
//   the one before. The debugger shows the blocks of the revision the world runs
//   (sourceAt), never the draft's, so its marks can't land on the wrong block.
//
// Workspaces are Blockly's JSON serialization, as everywhere (adapter.js).

const copy = (json) => JSON.parse(JSON.stringify(json));
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// A library of `programs`, [{ id, name, source, revision? }]: each starts as its
// source, published as `revision` (1 unless said).
export function createLibrary(programs) {
  return {
    programs: programs
      .map(({ id, name, source, revision = 1 }) => ({ id, name, starter: copy(source), draft: copy(source), published: [{ revision, source: copy(source) }] }))
      .sort(byId),
  };
}

export const programDoc = (library, id) => library.programs.find((p) => p.id === id) ?? null;

// The newest revision of program document `doc`: { revision, source }.
export const latest = (doc) => doc.published.at(-1);

// The blocks of revision `revision` of program `id`, or null.
export const sourceAt = (library, id, revision) => programDoc(library, id)?.published.find((p) => p.revision === revision)?.source ?? null;

// The newest revision of every program, for a world to start from
// (createWorld's content.programs).
export const newestPrograms = (library) => library.programs.map((doc) => ({ id: doc.id, revision: latest(doc).revision, source: latest(doc).source }));

// A workspace without where its stacks lie: moving blocks about on the
// workspace changes nothing a program does.
function shape(json) {
  const stacks = Array.isArray(json?.blocks?.blocks) ? json.blocks.blocks : [];
  return canonicalJson({ ...json, blocks: { ...json?.blocks, blocks: stacks.map(({ x, y, ...rest }) => rest) } });
}

// Whether workspaces `a` and `b` hold the same blocks, joined the same way,
// wherever their stacks lie.
export const sameBlocks = (a, b) => shape(a) === shape(b);

// Whether `doc`'s draft has changes not yet applied.
export const isChanged = (doc) => !sameBlocks(doc.draft, latest(doc).source);

// The editor saved the draft of program `id`.
export function setDraft(library, id, json) {
  programDoc(library, id).draft = copy(json);
}

// The draft of program `id` back to `to`: "applied", its newest revision, or
// "starter", what the game gave it. Like any edit, it runs only once applied.
export function resetDraft(library, id, to) {
  const doc = programDoc(library, id);
  doc.draft = copy(to === "starter" ? doc.starter : latest(doc).source);
}

// The draft of program `id`, compiled for what will run it: `types`, the robot
// and building types of the entities that do (each checked, since what one can
// do another may not), and `places`, the ids of the things on the island.
// Returns compile()'s { program, errors, warnings }, every problem once.
export function checkDraft(library, id, { types = [], places = null } = {}) {
  const { draft } = programDoc(library, id);
  const results = (types.length ? [...new Set(types)] : [null]).map((type) => compile(draft, { ...(type && { type }), ...(places && { places }) }));
  const unique = (lists) => {
    const seen = new Set();
    return lists.flat().filter((p) => {
      const key = canonicalJson(p);
      return !seen.has(key) && seen.add(key);
    });
  };
  const errors = unique(results.map((r) => r.errors));
  return { program: errors.length ? null : results[0].program, errors, warnings: unique(results.map((r) => r.warnings)) };
}

// Applies the draft of program `id` (PLAN.md §5): checked as checkDraft does,
// it becomes the program's next revision. Returns { command, revision }, the
// `publish` command that hands it to the world at the next tick boundary
// (src/sim/commands.js), or { errors, warnings } when it can't run, and nothing
// changes.
export function applyDraft(library, id, context) {
  const { program, errors, warnings } = checkDraft(library, id, context);
  if (!program) return { errors, warnings };
  const doc = programDoc(library, id);
  const revision = latest(doc).revision + 1;
  doc.published.push({ revision, source: copy(doc.draft) });
  return { command: { type: "publish", program: { id, revision, ...program } }, revision, warnings };
}
