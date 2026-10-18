import { CHAPTER_1 } from "./chapter1.js";
import { CHAPTER_2 } from "./chapter2.js";
import { CHAPTER_3 } from "./chapter3.js";
import { CHAPTER_4 } from "./chapter4.js";
import { CHAPTER_5 } from "./chapter5.js";

// The campaign (PLAN.md §9; docs/campaign-planv2.md): 105 missions in 21
// chapters on the main path, and 15 lessons in three optional workshops, built
// in delivery phases (“Review and delivery phases”); this is what's built so
// far, the foundation, chapters 1–5. It took the first campaign's place on 18
// October 2026, the first campaign's missions and saves let go. A mission is
//
//   { id, n, chapter, main, workspace, focus, requires?, setup, goals | trials,
//     programs, blocks, reward?, look, problems?, predict?, scaffold?,
//     reference, budget?, steps, milestone?, unlocks? }
//
// - id: "c2-m001"…"c2-m105" on the main path, "c2-a01"…"c2-a15" in the
//   workshops: never the first campaign's ("m01"…), so an old save is never
//   read as a new one. The words in missions.js go by it
//   (missionKeys, index.js). n: its number, on the main path or in its
//   workshops; chapter: its chapter's; main: whether it's on the main path.
// - workspace: what the focus program holds as it opens: "build" (the start
//   block alone: the child writes the program), "repair" (a whole program
//   with a fault), "change" (a working program to change) or "explore" (no
//   code needed). A Repair or Change starter must not meet the goals already.
// - focus: the program the child edits, which the mission card opens.
// - requires: the missions it needs done, by id; by default the main-path
//   mission before it. A requirement on a mission not yet built stands for the
//   built main-path mission with the highest number below it, until it is
//   (gateOf).
// - setup: what the island holds as it begins (src/sim/staging.js), complete
//   on its own: made on the island before mission 1 (Robo 1, the camp and the
//   grove: island.js) with nothing of another mission's (src/campaign.js), as
//   the map branches after mission 60.
// - goals, or trials: what must happen (src/sim/objectives.js); trials are
//   starting variations [{ stage, goals }], the first's stage made at the start.
// - programs: its programs, the focus and any background support that works
//   already, [{ id, name, source }]; reward: commands given when it's done.
// - blocks: the blocks it introduces. Its toolbox offers those and the blocks
//   of every mission it needs, directly or not (unlockedBlocks).
// - look: what the Look hint points at; problems: [{ entity, code, key }], the
//   problems its hints answer when one is in view: the Look hint points at
//   `entity` and the Think hint asks <id>.problem.<key>.
// - predict: it asks for a prediction before Run, said aloud (true) or by
//   pointing at a thing on the island ("point").
// - scaffold: for “Show me a start”, a partial program by program id;
//   reference: { programs: { id: source }, commands? }, a solution, applied
//   before the first step; “Show me the whole program” gives its programs.
// - budget: the raw materials { wood, stone } the reference may take from the
//   deposits; steps: how many steps it may take at most (both checked by
//   scripts/verify-missions.js).
// - milestone: it ends a chapter; unlocks: "free" or "sandbox", what it opens
//   once done.

// The chapters, by number: the main path's 1–21, and later the workshops'.
const CHAPTERS_BUILT = [
  [1, CHAPTER_1],
  [2, CHAPTER_2],
  [3, CHAPTER_3],
  [4, CHAPTER_4],
  [5, CHAPTER_5],
];

const ID = /^c2-(m|a)(\d+)$/;

// Mission id `id`'s place: { main, n }, whether it's on the main path and its
// number there (or in its workshops), or null for an id that isn't one.
export function placeOf(id) {
  const m = ID.exec(id);
  return m ? { main: m[1] === "m", n: Number(m[2]) } : null;
}

export const CAMPAIGN = CHAPTERS_BUILT.flatMap(([chapter, missions]) =>
  missions.map((m) => {
    const place = placeOf(m.id);
    if (!place) throw new Error(`campaign: ${m.id} isn't a mission id`);
    return { ...m, chapter, n: place.n, main: place.main };
  }),
);

const byId = new Map(CAMPAIGN.map((m) => [m.id, m]));
const MAIN = CAMPAIGN.filter((m) => m.main).sort((a, b) => a.n - b.n);

export const campaignMission = (id) => byId.get(id) ?? null;
export const isCampaignMission = (id) => byId.has(id);

// The chapters there are so far, in order: [{ chapter, missions }].
export const CHAPTERS = CHAPTERS_BUILT.map(([chapter]) => ({ chapter, missions: CAMPAIGN.filter((m) => m.chapter === chapter) }));

// The mission a requirement on `id` stands for: `id` once it's built; until
// then the built main-path mission with the highest number below it; null when
// there's none, and nothing to wait for (an interim gate, docs/campaign-
// planv2.md, “How v2 is built”).
export function gateOf(id) {
  if (byId.has(id)) return id;
  const place = placeOf(id);
  if (!place?.main) throw new Error(`campaign: a requirement on ${id}, which isn't a main-path mission`);
  return MAIN.filter((m) => m.n < place.n).at(-1)?.id ?? null;
}

// The missions `mission` needs done, as they stand now: its requirements,
// each as gateOf has it, or by default the main-path mission before it.
export function gatesOf(mission) {
  const asked = mission.requires ?? (mission.main ? [MAIN[MAIN.indexOf(mission) - 1]?.id].filter(Boolean) : []);
  return [...new Set(asked.map(gateOf).filter((id) => id && id !== mission.id))];
}

// Whether `mission` is open, with the missions `completed` lists done.
export const isOpen = (mission, completed) => gatesOf(mission).every((id) => completed.includes(id));

// Every mission `mission` needs, directly or not, nearest first.
function ancestors(mission) {
  const seen = new Set();
  const walk = (m) => {
    for (const id of gatesOf(m)) {
      if (seen.has(id)) continue;
      seen.add(id);
      walk(byId.get(id));
    }
  };
  walk(mission);
  return [...seen].map((id) => byId.get(id));
}

// The blocks mission `mission`'s toolboxes may offer: those it introduces and
// those every mission it needs introduced (src/blockly/toolboxes.js names
// them, the If with an else as "controls_if_else"). Not the start block:
// every program has its one, and it can't be deleted.
export const unlockedBlocks = (mission) => [...new Set([...ancestors(mission), mission].flatMap((m) => m.blocks))];

// The mission to go on to once `mission` is done, with `completed` done too:
// the first open one not done after it in the order of the map, else the first
// open one not done before it; null when every open mission is done.
export function nextMission(mission, completed) {
  const done = [...new Set([...completed, mission.id])];
  const open = CAMPAIGN.filter((m) => !done.includes(m.id) && isOpen(m, done));
  const at = CAMPAIGN.indexOf(mission);
  return open.find((m) => CAMPAIGN.indexOf(m) > at) ?? open[0] ?? null;
}

// The first mission not yet done that's open, to start the campaign at.
export const firstOpen = (completed) => CAMPAIGN.find((m) => !completed.includes(m.id) && isOpen(m, completed)) ?? null;

// The first mission whose completion opens `what` ("free" or "sandbox"), or
// null while it isn't built.
export const opener = (what) => CAMPAIGN.find((m) => m.unlocks === what) ?? null;

// The program mission `mission` is about, which its card opens: its focus.
export const mainProgram = (mission) => mission.focus ?? null;

// The chapter `n`'s missions.
export const chapterMissions = (n) => CAMPAIGN.filter((m) => m.chapter === n);
