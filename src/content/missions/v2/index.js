import { CHAPTER_1 } from "./chapter1.js";
import { CHAPTER_2 } from "./chapter2.js";
import { CHAPTER_3 } from "./chapter3.js";
import { CHAPTER_4 } from "./chapter4.js";
import { CHAPTER_5 } from "./chapter5.js";

// The campaign's second plan (docs/campaign-planv2.md): 105 missions in 21
// chapters on the main path, and 15 lessons in three optional workshops. It's
// built in delivery phases (“Review and delivery phases”); this is what's
// implemented so far, played at /play2 alongside the first campaign
// (campaign.js) until the switch-over. A mission is written as the first
// campaign's are (campaign.js), with these differences:
//
//   { id, workspace, focus, requires?, setup, … }
//
// - id: "c2-m001"…"c2-m105" on the main path, "c2-a01"…"c2-a15" in the
//   workshops: stable ids that never take a first-campaign mission's place in
//   a save. The words in missions.js go by it, as the first campaign's do.
// - workspace: what the focus program holds as it opens: "build" (the start
//   block alone: the child writes the program), "repair" (a whole program
//   with a fault), "change" (a working program to change) or "explore" (no
//   code needed). A Repair or Change starter must not meet the goals already.
// - focus: the program the child edits, which the mission card opens.
// - requires: the missions it needs done, by id; by default the main-path
//   mission before it. A requirement on a mission not yet implemented stands
//   for the implemented main-path mission with the highest number below it,
//   until it is (gateOf).
// - setup: complete on its own, on the island's base (Robo 1, the camp and
//   the grove: island.js), made with nothing of another mission's setup
//   (src/campaign.js): the map branches after mission 60, so no list of
//   missions comes before every other.
// - blocks: the blocks it introduces. Its toolbox offers those and the blocks
//   of every mission it requires, directly or not (blocksFor).

// The chapters, by number: the main path's 1–21, and the workshops "A"–"C".
const CHAPTERS = [
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

export const CAMPAIGN2 = CHAPTERS.flatMap(([chapter, missions]) =>
  missions.map((m) => {
    const place = placeOf(m.id);
    if (!place) throw new Error(`campaign 2: ${m.id} isn't a mission id`);
    return { ...m, chapter, n: place.n, main: place.main };
  }),
);

const byId = new Map(CAMPAIGN2.map((m) => [m.id, m]));
const MAIN = CAMPAIGN2.filter((m) => m.main).sort((a, b) => a.n - b.n);

export const campaign2Mission = (id) => byId.get(id) ?? null;
export const isCampaign2Mission = (id) => byId.has(id);

// The chapters there are so far, in order: [{ chapter, missions }].
export const CHAPTERS2 = CHAPTERS.map(([chapter]) => ({ chapter, missions: CAMPAIGN2.filter((m) => m.chapter === chapter) }));

// The mission a requirement on `id` stands for: `id` once it's implemented;
// until then the implemented main-path mission with the highest number below
// it; null when there's none, and nothing to wait for (an interim gate,
// docs/campaign-planv2.md, “How v2 is built”).
export function gateOf(id) {
  if (byId.has(id)) return id;
  const place = placeOf(id);
  if (!place?.main) throw new Error(`campaign 2: a requirement on ${id}, which isn't a main-path mission`);
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
// them). Not the start block: every program has its own.
export const blocksFor = (mission) => [...new Set([...ancestors(mission), mission].flatMap((m) => m.blocks))];

// The mission to go on to once `mission` is done, with `completed` done too:
// the first open one not done after it in the order of the map, else the first
// open one not done before it; null when every open mission is done.
export function nextOf(mission, completed) {
  const done = [...new Set([...completed, mission.id])];
  const open = CAMPAIGN2.filter((m) => !done.includes(m.id) && isOpen(m, done));
  const at = CAMPAIGN2.indexOf(mission);
  return open.find((m) => CAMPAIGN2.indexOf(m) > at) ?? open[0] ?? null;
}

// The first mission not yet done that's open, to start the campaign at.
export const firstOpen = (completed) => CAMPAIGN2.find((m) => !completed.includes(m.id) && isOpen(m, completed)) ?? null;

// The first mission whose completion opens `what` ("free" or "sandbox"), or
// null while it isn't implemented.
export const opener2 = (what) => CAMPAIGN2.find((m) => m.unlocks === what) ?? null;

// The first campaign's missions done that count as missions of this one
// (docs/campaign-planv2.md, “Preserve the existing campaign”): the same
// lessons, moved, or the workshops the first campaign's chapters 6–8 become.
// Missions 21–22 and 24–80 of this campaign are new, and none counts for them.
export const FROM_V1 = {
  ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`m${String(i + 1).padStart(2, "0")}`, `c2-m${String(i + 1).padStart(3, "0")}`])),
  m21: "c2-m081",
  m22: "c2-m082",
  m23: "c2-m083",
  m24: "c2-m084",
  m25: "c2-m023",
  ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`m${i + 26}`, `c2-a${String(i + 1).padStart(2, "0")}`])),
};

// The missions of this campaign that the first campaign's `completed` counts
// for, of those implemented, in the order of the map.
export function creditFromV1(completed) {
  const credited = new Set(completed.map((id) => FROM_V1[id]).filter((id) => byId.has(id)));
  return CAMPAIGN2.filter((m) => credited.has(m.id)).map((m) => m.id);
}
