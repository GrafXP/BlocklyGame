import { block, chain, workspace } from "../build.js";
import { ISLAND, TERRAIN } from "../island.js";
import { ISLAND_PROGRAMS, carry, start } from "../programs.js";

// The bridge slice (PLAN.md §11, Phase 5): mission 15 of the campaign, “Across
// the Stream” (docs/campaign-plan.md), without the fourteen missions that lead
// to it. Four programs make a chain: Robo 1 collects wood for the sawmill, the
// sawmill makes planks, Robo 2 carries them on, and the construction site builds
// the bridge from four. The collector and the sawmill already work. Robo 2 still
// takes its planks to the depot, as in mission 14, and the site has its start
// block with “build bridge” lying beside it, not yet under it. The player sends
// the planks to the site and attaches the block; any programs that get the
// bridge built will do (objectives.js).
//
// Robo 3 waits at the camp with the stone carrier's program parked: it can be
// edited, but doesn't start until the player applies it, or until the bridge is
// built, when the mission starts it and Robo 3 crosses the stream to the stone
// pit: the reward.
//
// A mission is
//
//   { id, content, look, progress, reference, steps }
//
// - id: its id, and the prefix of its words in each language's missions.js:
//   <id>.title, .goal, .progress, .hint.look, .hint.think, .hint.try, .reward.
// - content: the world it starts from (createWorld), with its `mission`: the
//   goals to meet and the reward (src/sim/objectives.js).
// - look: what the first hint points at, chosen when it's shown.
// - progress: { at, recipe }: the goal's progress, as building `at`'s stock of
//   what `recipe` needs, then the work on it.
// - reference: a program that meets the goals for each program the player
//   changes, by program id; with the others as they start, they're the
//   mission's reference solution (test/missions.test.js).
// - steps: how many steps the reference solution may take at most.

const courier = carry("courier", { from: "sawmill", item: "plank", take: "robot_pick_up", to: "depot" });

// The site's start block, and “build bridge” lying below it, not attached.
const bridge = workspace(start("bridge"), block("building_build", "bridge-build", { x: 40, y: 120, fields: { BLUEPRINT: "bridge" } }));

const island = (id) => ISLAND_PROGRAMS.find((p) => p.id === id);
const PROGRAMS = [island("collector"), { ...island("courier"), source: courier }, island("planks"), { ...island("bridge"), source: bridge }, island("stones")];

// Who runs what. Robo 3's program is parked until the reward.
const RUNS = { r1: "collector", r2: "courier", r3: "stones", sawmill: "planks", site: "bridge" };
const PARKED = ["r3"];

export const SLICE = {
  id: "slice",
  content: {
    id: "slice",
    version: 1,
    terrain: TERRAIN,
    programs: PROGRAMS,
    entities: ISLAND.entities.map(({ program, ...e }) => (RUNS[e.id] ? { ...e, program: RUNS[e.id], ...(PARKED.includes(e.id) && { parked: true }) } : e)),
    nodes: ISLAND.nodes,
    mission: {
      id: "slice",
      goals: [{ id: "bridge", type: "built", at: "site" }],
      reward: [{ type: "assign", entity: "r3", program: "stones" }],
    },
  },
  look: "site",
  progress: { at: "site", recipe: "bridge" },
  reference: {
    courier: carry("courier", { from: "sawmill", item: "plank", take: "robot_pick_up", to: "site" }),
    bridge: workspace(chain(start("bridge"), block("building_build", "bridge-build", { fields: { BLUEPRINT: "bridge" } }))),
  },
  steps: 600,
};
