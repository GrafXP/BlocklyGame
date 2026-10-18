import { CAMPAIGN } from "./campaign.js";
import { SLICE } from "./slice.js";

// The missions there are (PLAN.md §9; docs/campaign-planv2.md): the
// campaign's, as far as it's built (campaign.js); and Phase 5's bridge
// slice, the first campaign's mission 15 played on its own, kept for its
// playtest.
export const MISSIONS = [SLICE, ...CAMPAIGN];

export const missionById = (id) => MISSIONS.find((m) => m.id === id) ?? null;

// The keys of mission `mission`'s words in missions.js: its title, goal, three
// hints and reward; a campaign mission's setup (what's new when it begins),
// the explanation it asks for after success, the prediction it asks for before
// Run, each trial's starting variation, and the question for each problem its
// hints answer; the slice's progress.
export function missionKeys(mission) {
  const parts = ["title", "goal", "hint.look", "hint.think", "hint.try", "reward"];
  if (mission === SLICE) parts.push("progress");
  else {
    parts.push("setup", "explain");
    if (mission.predict) parts.push("predict");
    if (mission.trials?.length > 1) mission.trials.forEach((_, i) => parts.push(`trial.${i + 1}`));
    for (const { key } of mission.problems ?? []) parts.push(`problem.${key}`);
  }
  return parts.map((part) => `${mission.id}.${part}`);
}
