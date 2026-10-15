import { SLICE } from "./slice.js";

// The missions there are (PLAN.md §9; docs/campaign-plan.md). For now the bridge
// slice of Phase 5; the campaign's chapters come with Phase 7, a folder each.
export const MISSIONS = [SLICE];

export const missionById = (id) => MISSIONS.find((m) => m.id === id) ?? null;

// The keys of mission `mission`'s words in missions.js.
export const missionKeys = ({ id }) => ["title", "goal", "progress", "hint.look", "hint.think", "hint.try", "reward"].map((part) => `${id}.${part}`);
