import { canonicalJson } from "../sim/replay.js";
import { compile } from "./compiler.js";

// The program library (PLAN.md §5, §10): every program's source, as the player
// edits it and as it was applied. The world keeps what can run, compiled
// (world.programs), and who runs what (src/sim/bindings.js); the library keeps
// the blocks. It's plain data, so a save holds it (src/storage/saves.js):
//
//   { programs: [{ id, name, starter, draft, published: [{ revision, source }, …], archived? }, …] }
//
// in order of id, where
// - `name` is a message reference until the player renames the program (PLAN.md
//   §8); a copy's names the program it's a copy of, and whose it is;
// - `starter` is the workspace the game gave it, to go back to;
// - `draft` is the workspace being edited. Editing changes only the draft, never
//   what runs;
// - `published` is every revision applied, oldest first; revision 1 is the
//   starter. The world runs one of them, usually the newest: an applied revision
//   reaches the world at the next tick (game.js), and until then the world runs
//   the one before. The debugger shows the blocks of the revision the world runs
//   (sourceAt), never the draft's, so its marks can't land on the wrong block;
// - `archived` is true for a program the player has put away: nothing runs it,
//   and the library lists it apart, to bring back.
//
// Workspaces are Blockly's JSON serialization, as everywhere (adapter.js).

const copy = (json) => JSON.parse(JSON.stringify(json));
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// A library of `programs`, [{ id, name, source, revision? }]: each starts as its
// source, published as `revision` (1 unless said). With `word`, a function that
// words a message reference in the player's language, the names the game gave
// in each program's blocks are worded as they're copied in (wordStarter).
export function createLibrary(programs, { word = null } = {}) {
  return {
    programs: programs
      .map(({ id, name, source, revision = 1 }) => {
        const blocks = word ? wordStarter(source, word) : copy(source);
        return { id, name, starter: copy(blocks), draft: copy(blocks), published: [{ revision, source: copy(blocks) }] };
      })
      .sort(byId),
  };
}

// Starter program `source` with the names the game gave in it worded by `word`
// (PLAN.md §8): its variables', and those a block's fields hold, such as a
// procedure's. The game writes them as message references, { key, params? };
// once worded they're the player's, as typed, in the language they were copied
// in. Returns a new workspace.
export function wordStarter(source, word) {
  const isRef = (value) => !!value && typeof value === "object" && typeof value.key === "string" && !("id" in value);
  const json = copy(source);
  for (const variable of Array.isArray(json.variables) ? json.variables : []) if (isRef(variable?.name)) variable.name = word(variable.name);
  const visit = (block) => {
    if (!block || typeof block !== "object") return;
    for (const [name, value] of Object.entries(block.fields ?? {})) if (isRef(value)) block.fields[name] = word(value);
    for (const input of Object.values(block.inputs ?? {})) {
      visit(input?.block);
      visit(input?.shadow);
    }
    visit(block.next?.block);
  };
  for (const block of json.blocks?.blocks ?? []) visit(block);
  return json;
}

// --- Making, naming and putting away programs ---------------------------------

// An id for a new program, from `base`: base itself, or with a number after it
// (base-2, base-3, …), whichever no program of `library` has, nor `taken`
// lists (such as the programs a world has).
export function freeProgramId(library, base, taken = []) {
  const used = new Set([...library.programs.map((p) => p.id), ...taken]);
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    if (!used.has(id)) return id;
  }
}

function insert(library, doc) {
  library.programs.push(doc);
  library.programs.sort(byId);
  return doc;
}

// A copy of program `id` as a new program `newId`, named `name`: its blocks as
// last applied, as revision 1 and as its draft; its starter the original's, to
// go back to. Its draft's unapplied changes stay with the original. Returns the
// new program.
export function copyProgram(library, id, { newId, name }) {
  const doc = programDoc(library, id);
  const source = latest(doc).source;
  return insert(library, { id: newId, name: copy(name), starter: copy(doc.starter), draft: copy(source), published: [{ revision: 1, source: copy(source) }] });
}

// A new program `newId`, named `name`, of `source`'s blocks: just a start
// block, unless said. Returns it.
export function newProgram(library, { newId, name, source }) {
  return insert(library, { id: newId, name: copy(name), starter: copy(source), draft: copy(source), published: [{ revision: 1, source: copy(source) }] });
}

// The player names program `id` `name`: from now on it's their words, as typed.
export function renameProgram(library, id, name) {
  programDoc(library, id).name = name;
}

// Puts program `id` away (`archived` true) or brings it back.
export function archiveProgram(library, id, archived) {
  const doc = programDoc(library, id);
  if (archived) doc.archived = true;
  else delete doc.archived;
}

export const programDoc = (library, id) => library.programs.find((p) => p.id === id) ?? null;

// The newest revision of program document `doc`: { revision, source }.
export const latest = (doc) => doc.published.at(-1);

// The blocks of revision `revision` of program `id`, or null.
export const sourceAt = (library, id, revision) => programDoc(library, id)?.published.find((p) => p.revision === revision)?.source ?? null;

// The newest revision of every program, for a world to start from
// (createWorld's content.programs).
export const newestPrograms = (library) => library.programs.map((doc) => ({ id: doc.id, revision: latest(doc).revision, source: latest(doc).source }));

// `library` with only the revisions still needed: the newest of each program,
// and those that `keep(id)` lists, such as the ones a world runs. Every other
// revision is gone for good: nothing runs it, so no view shows it (a saved game
// keeps no more, PLAN.md §10). Returns a new library.
export function prunedLibrary(library, keep = () => []) {
  return {
    programs: library.programs.map((doc) => {
      const wanted = new Set([...keep(doc.id), latest(doc).revision]);
      return { ...copy(doc), published: copy(doc.published.filter((p) => wanted.has(p.revision))) };
    }),
  };
}

const isWorkspace = (json) => !!json && typeof json === "object" && !Array.isArray(json);

// What's wrong with `library`'s shape, for a developer to read; [] when it's a
// library: programs in order of id, each with a name (the player's words or a
// message reference), a starter and a draft, and its revisions, oldest first.
// What the blocks mean is the compiler's to check.
export function checkLibrary(library) {
  const problems = [];
  if (!Array.isArray(library?.programs)) return ["no programs"];
  library.programs.forEach((doc, i) => {
    const at = `program ${i}`;
    if (typeof doc?.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(doc.id)) return problems.push(`${at} has id ${doc?.id}`);
    if (i && !(library.programs[i - 1].id < doc.id)) problems.push(`programs out of id order at ${doc.id}`);
    if (typeof doc.name !== "string" && typeof doc.name?.key !== "string") problems.push(`${doc.id} has no name`);
    if ("archived" in doc && doc.archived !== true) problems.push(`${doc.id} is archived as ${doc.archived}`);
    if (!isWorkspace(doc.starter) || !isWorkspace(doc.draft)) problems.push(`${doc.id} has no starter or draft`);
    if (!Array.isArray(doc.published) || !doc.published.length) return problems.push(`${doc.id} has no revisions`);
    doc.published.forEach((p, j) => {
      if (!Number.isInteger(p?.revision) || p.revision < 1 || !isWorkspace(p.source)) problems.push(`${doc.id} has revision ${JSON.stringify(p?.revision)}`);
      else if (j && !(doc.published[j - 1].revision < p.revision)) problems.push(`${doc.id}'s revisions out of order at ${p.revision}`);
    });
  });
  return problems;
}

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
