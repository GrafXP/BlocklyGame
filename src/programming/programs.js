import { canonicalJson } from "../sim/replay.js";
import { compile } from "./compiler.js";

// The program library (PLAN.md §5, §10): every program's source, as the player
// edits it and as it was applied. The world keeps what can run, compiled
// (world.programs), and who runs what (src/sim/bindings.js); the library keeps
// the blocks. It's plain data, so a save holds it (src/storage/saves.js):
//
//   { programs: [{ id, name, starter, draft, base?, kept?, published: [{ revision, source, from? }, …], archived? }, …] }
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
//   (sourceAt), never the draft's, so its marks can't land on the wrong block.
//   `from` is the revision a revision's draft started from, its parent in the
//   program's history (a tree: an older version put back into the draft and
//   applied starts a branch); without it, the one before it;
// - `base` is the revision the draft started from, when the player put one
//   into it from the history; without it, the newest;
// - `kept` is { source, from }, a draft with changes no revision has, kept
//   when the player put a version from the history into the draft, to go back
//   to: one at most;
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
// routine's, and those its extra state holds: a routine's input's, and the
// routine a call uses. The game writes them as message references, { key,
// params? }; once worded they're the player's, as typed, in the language they
// were copied in. Returns a new workspace.
export function wordStarter(source, word) {
  const isRef = (value) => !!value && typeof value === "object" && typeof value.key === "string" && !("id" in value);
  const json = copy(source);
  for (const variable of Array.isArray(json.variables) ? json.variables : []) if (isRef(variable?.name)) variable.name = word(variable.name);
  const visit = (block) => {
    if (!block || typeof block !== "object") return;
    for (const [name, value] of Object.entries(block.fields ?? {})) if (isRef(value)) block.fields[name] = word(value);
    const extra = block.extraState;
    if (extra && typeof extra === "object") {
      if (isRef(extra.name)) extra.name = word(extra.name);
      if (Array.isArray(extra.params)) extra.params = extra.params.map((p) => (isRef(p) ? word(p) : isRef(p?.name) ? { ...p, name: word(p.name) } : p));
    }
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

// How many of a program's newest revisions a save keeps, for its history.
export const HISTORY = 40;

// `library` with only the revisions still needed: each program's newest
// HISTORY, its history in the editor, and those that `keep(id)` lists, such as
// the ones a world runs. Older ones are gone for good (a saved game keeps no
// more, PLAN.md §10); a revision whose parent went names none. Returns a new
// library.
export function prunedLibrary(library, keep = () => []) {
  return {
    programs: library.programs.map((doc) => {
      const wanted = new Set([...keep(doc.id), ...doc.published.slice(-HISTORY).map((p) => p.revision)]);
      const published = copy(doc.published.filter((p) => wanted.has(p.revision)));
      for (const p of published) if (p.from != null && !wanted.has(p.from)) p.from = null;
      return { ...copy(doc), published };
    }),
  };
}

// --- The history ------------------------------------------------------------------

// The revision `doc`'s revision at index `i` of `published` started from: its
// `from`, or the one before it; null for the first, or one whose parent a save
// let go.
export const parentOf = (doc, i) => (doc.published[i].from !== undefined ? doc.published[i].from : (doc.published[i - 1]?.revision ?? null));

// The revision `doc`'s draft started from: `base`, or the newest.
export const baseOf = (doc) => (doc.base != null && doc.published.some((p) => p.revision === doc.base) ? doc.base : latest(doc).revision);

// Puts revision `revision` of program `id` into its draft, to change and
// apply, or with "kept", the draft kept before; nothing runs it until it's
// applied. A draft with changes no revision has is kept in its place, to go
// back to. Returns whether there was such a version.
export function loadVersion(library, id, revision) {
  const doc = programDoc(library, id);
  const from = revision === "kept" ? doc?.kept : doc?.published.find((p) => p.revision === revision);
  if (!from) return false;
  const unapplied = !doc.published.some((p) => sameBlocks(p.source, doc.draft));
  const old = { source: copy(doc.draft), from: baseOf(doc) };
  doc.draft = copy(from.source);
  doc.base = revision === "kept" ? from.from : revision;
  if (unapplied) doc.kept = old;
  else if (revision === "kept") delete doc.kept;
  return true;
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
    const revision = (r) => r === null || (Number.isInteger(r) && r >= 1);
    doc.published.forEach((p, j) => {
      if (!Number.isInteger(p?.revision) || p.revision < 1 || !isWorkspace(p.source)) problems.push(`${doc.id} has revision ${JSON.stringify(p?.revision)}`);
      else if (j && !(doc.published[j - 1].revision < p.revision)) problems.push(`${doc.id}'s revisions out of order at ${p.revision}`);
      else if ("from" in p && !(revision(p.from) && (p.from === null || p.from < p.revision))) problems.push(`${doc.id}'s revision ${p.revision} is from ${JSON.stringify(p.from)}`);
    });
    if ("base" in doc && !revision(doc.base)) problems.push(`${doc.id}'s draft is from ${JSON.stringify(doc.base)}`);
    if ("kept" in doc && !(isWorkspace(doc.kept?.source) && revision(doc.kept.from))) problems.push(`${doc.id} keeps a draft it can't`);
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

// Puts `source` into program `id`'s draft, as a mission's help gives it (a
// start, the whole program, the start block alone): nothing runs it until it's
// applied. A draft with changes no revision has is kept, to go back to from the
// history, as loadVersion keeps one (docs/campaign-planv2.md: an example
// never overwrites a draft).
export function giveDraft(library, id, source) {
  const doc = programDoc(library, id);
  if (!doc.published.some((p) => sameBlocks(p.source, doc.draft))) doc.kept = { source: copy(doc.draft), from: baseOf(doc) };
  doc.draft = copy(source);
  delete doc.base;
}

// The draft of program `id` back to `to`: "applied", its newest revision, or
// "starter", what the game gave it. Like any edit, it runs only once applied.
export function resetDraft(library, id, to) {
  const doc = programDoc(library, id);
  doc.draft = copy(to === "starter" ? doc.starter : latest(doc).source);
  delete doc.base;
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
  doc.published.push({ revision, source: copy(doc.draft), from: baseOf(doc) });
  delete doc.base;
  return { command: { type: "publish", program: { id, revision, ...program } }, revision, warnings };
}
