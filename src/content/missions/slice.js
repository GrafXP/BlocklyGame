import { block, chain, workspace } from "../build.js";
import { ISLAND, ISLAND_ROLES, TERRAIN } from "../island.js";
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
// Who runs what is the island's (src/content/island.js): each robot on its
// team, the sawmill running its type's program, the site its own. The slice has
// no workshop, and offers none of Phase 6's tools: choosing programs, settings
// and placing buildings are chapter 5's (`tools`, src/ui/island.js).
//
// A mission is
//
//   { id, content, look, progress, reference, steps, tools? }
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
// - tools: which of the program library, settings and placing buildings the
//   player is offered; none unless said.

const courier = carry("courier", { from: "sawmill", item: "plank", to: "depot" });

// The site's start block, and “build bridge” lying below it, not attached.
const bridge = workspace(start("bridge"), block("building_build", "bridge-build", { x: 40, y: 120, fields: { BLUEPRINT: "bridge" } }));

const island = (id) => ISLAND_PROGRAMS.find((p) => p.id === id);
const PROGRAMS = [island("collector"), { ...island("courier"), source: courier }, island("planks"), { ...island("bridge"), source: bridge }, island("stones")];

// Robo 3's program is parked until the reward.
const PARKED = ["r3"];

export const SLICE = {
  id: "slice",
  content: {
    id: "slice",
    version: 2,
    terrain: TERRAIN,
    programs: PROGRAMS,
    roles: ISLAND_ROLES,
    defaults: [{ type: "sawmill", program: "planks" }],
    entities: ISLAND.entities.map((e) => (PARKED.includes(e.id) ? { ...e, parked: true } : e)),
    nodes: ISLAND.nodes,
    mission: {
      id: "slice",
      goals: [{ id: "bridge", type: "built", at: "site" }],
      reward: [{ type: "start", entity: "r3" }],
    },
  },
  look: "site",
  progress: { at: "site", recipe: "bridge" },
  reference: {
    courier: carry("courier", { from: "sawmill", item: "plank", to: "site" }),
    bridge: workspace(chain(start("bridge"), block("building_build", "bridge-build", { fields: { BLUEPRINT: "bridge" } }))),
  },
  steps: 600,
};
