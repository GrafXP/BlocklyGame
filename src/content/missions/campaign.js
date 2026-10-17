import { CHAPTER_1 } from "./chapter1.js";
import { CHAPTER_2 } from "./chapter2.js";
import { CHAPTER_3 } from "./chapter3.js";
import { CHAPTER_4 } from "./chapter4.js";
import { CHAPTER_5 } from "./chapter5.js";
import { CHAPTER_6 } from "./chapter6.js";
import { CHAPTER_7 } from "./chapter7.js";
import { CHAPTER_8 } from "./chapter8.js";

// The campaign (PLAN.md §9; docs/campaign-plan.md): chapters 1–8, missions
// 1–40, on one island that grows (island.js). Missions 1–25 are the main
// learning journey; 26–40 go on to memory, blocks of one's own and messages
// (Phase 8). A mission is
//
//   { id, n, chapter, setup, goals | trials, programs, blocks, tools?, reward?,
//     look, problems?, predict?, project?, scaffold?, reference, budget?,
//     steps, milestone?, unlocks? }
//
// - id: "m01"…, the prefix of its words in each language's missions.js
//   (missionKeys, index.js); n: its number; chapter: its chapter's.
// - setup: what changes when it begins, on the island as the mission before
//   left it (src/sim/staging.js): things arriving, robots placed, staged stock,
//   room, who runs what.
// - goals, or trials: what must happen (src/sim/objectives.js); trials are
//   starting variations [{ stage, goals }], the first's stage made at the start.
// - programs: its starter programs, added to the player's library when it
//   begins, [{ id, name, source }]; reward: commands given when it's done.
// - blocks: the blocks it unlocks on top of earlier missions' (unlockedBlocks);
//   tools: which of Phase 6's tools it offers (src/ui/session.js, TOOLS).
// - look: what the Look hint points at; problems: [{ entity, code, key }], the
//   problems its hints answer when one is in view: the Look hint points at
//   `entity` and the Think hint asks <id>.problem.<key>.
// - predict: it asks for a prediction before Run, said aloud (true) or by
//   pointing at a thing on the island ("point"); project: a chapter's
//   project, which offers starting from nothing as well as from a start.
// - scaffold: for “Show me a start”, a partial program by program id;
//   reference: { programs: { id: source }, commands }, what the reference
//   solution changes, applied before the first step: its programs (new ones,
//   such as a robot's own copy, are made), then its commands.
// - budget: the raw materials { wood, stone } the reference solution may take
//   from the deposits, which hold that much at the start; steps: how many steps
//   it may take at most (scripts/verify-missions.js checks both).
// - milestone: it ends a chapter; unlocks: "free" or "sandbox", what it opens
//   once done.

const CHAPTERS = [CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8];

export const CAMPAIGN = CHAPTERS.flatMap((missions, c) => missions.map((m) => ({ ...m, chapter: c + 1 }))).map((m, i) => ({ ...m, n: i + 1 }));

export const CHAPTER_COUNT = CHAPTERS.length;

export const campaignMission = (id) => CAMPAIGN.find((m) => m.id === id) ?? null;

// The mission after `mission`, or null after the last.
export const nextMission = (mission) => CAMPAIGN[mission.n] ?? null;

// The blocks a toolbox may offer in mission `mission`: those it and every
// mission before it unlocked (src/blockly/toolboxes.js names them). The start
// block isn't among them: every mission's programs have theirs, and it can't
// be deleted.
export const unlockedBlocks = (mission) => [...new Set(CAMPAIGN.slice(0, mission.n).flatMap((m) => m.blocks))];

// The first mission whose completion opens `what` ("free" or "sandbox").
export const opener = (what) => CAMPAIGN.find((m) => m.unlocks === what);

// The program mission `mission` is about, which its card opens: the first of
// its programs its reference solution changes, else its first.
export const mainProgram = (mission) => {
  const changed = Object.keys(mission.reference?.programs ?? {});
  return mission.programs?.find((p) => changed.includes(p.id))?.id ?? mission.programs?.[0]?.id ?? null;
};

// The chapter `n`'s missions.
export const chapterMissions = (n) => CAMPAIGN.filter((m) => m.chapter === n);
