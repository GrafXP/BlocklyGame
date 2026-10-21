import { ref } from "../i18n/index.js";
import { robo, thingOf } from "./missions/island.js";
import { ISLAND_PROGRAMS, carry } from "./programs.js";
import { TERRAIN } from "./island.js";

// Free play (PLAN.md §9, docs/campaign-plan.md): the campaign's island without
// a mission, where the child gives every robot and building a job with the
// blocks learned so far. It opens after mission 15. After mission 25 it grows
// into the sandbox, where the player chooses how the island starts (`layout`),
// adds robots, sets supplies and places workshops (src/ui/session.js).
//
// The island starts as it was in the campaign by then: three robots on their
// teams, the sawmill making planks, the bridge built, and in the sandbox a
// workshop. It has programs of its own; those of the missions stay in them.

// How the island starts: robots, 1 to 5; supplies "some" or "plenty"; the
// bridge "built" or "toBuild"; the workshop "built" or "none" (the sandbox's
// Build places one).
export const LAYOUT = { robots: 3, supplies: "some", bridge: "built", workshop: "none" };
export const LAYOUT_CHOICES = { robots: [1, 2, 3, 4, 5], supplies: ["some", "plenty"], bridge: ["built", "toBuild"], workshop: ["built", "none"] };

export const FREE_CONTENT = { id: "free", version: 1 };

// Robots past the third stand by the camp, without a team.
const SPOTS = [
  [10, 15],
  [10, 16],
  [9, 17],
  [8, 17],
  [11, 16],
];

// The island of free play laid out as `layout` says (LAYOUT's shape), as
// createWorld's content.
export function freeContent(layout = LAYOUT) {
  const { robots, supplies, bridge, workshop } = { ...LAYOUT, ...layout };
  const plenty = supplies === "plenty";
  const built = bridge === "built";
  const island = (id) => ISLAND_PROGRAMS.find((p) => p.id === id);
  // Every layout has the same programs, each the same blocks: the sandbox's
  // new island keeps the player's library, and a program's revision 1 must be
  // the blocks the library has (src/ui/session.js). Only who runs which differs:
  // with the bridge built, the Plank team takes its planks to the depot.
  const programs = [
    island("collector"),
    island("courier"),
    { id: "courier-depot", name: ref("programName.courierDepot"), source: carry("courier-depot", { from: "sawmill", item: "plank", to: "depot" }) },
    island("stones"),
    island("fetch"),
    island("planks"),
    island("kits"),
    island("bridge"),
    island("build-workshop"),
  ];
  const teams = ["wood-team", "plank-team", "stone-team"];
  const robotsList = Array.from({ length: robots }, (_, i) => ({
    id: `r${i + 1}`,
    type: "helper",
    name: robo(i + 1),
    cell: SPOTS[i],
    ...(i < 3 && { role: teams[i] }),
    ...(i < 3 && { settings: [{ source: "grove", item: "wood", destination: "sawmill" }, { source: "sawmill", item: "plank", destination: "depot" }, { source: "quarry", item: "stone", destination: "depot" }][i] }),
  }));
  const site = { ...thingOf("site"), built, ...(!built && { program: "bridge" }) };
  return {
    ...FREE_CONTENT,
    terrain: TERRAIN,
    programs,
    roles: [
      { id: "plank-team", name: ref("role.plankTeam"), program: built ? "courier-depot" : "courier" },
      { id: "stone-team", name: ref("role.stoneTeam"), program: "stones" },
      { id: "wood-team", name: ref("role.woodTeam"), program: "collector" },
    ],
    defaults: [
      { type: "sawmill", program: "planks" },
      { type: "workshop", program: "kits" },
    ],
    blueprints: [{ blueprint: "workshop", program: "build-workshop" }],
    entities: [...robotsList, thingOf("camp"), thingOf("sawmill"), thingOf("depot"), site, ...(workshop === "built" ? [thingOf("workshop")] : [])],
    nodes: [
      { ...thingOf("grove"), items: { wood: plenty ? 24 : 12 }, caps: { wood: plenty ? 24 : 12 } },
      { ...thingOf("quarry"), items: { stone: plenty ? 24 : 8 }, caps: { stone: plenty ? 24 : 8 } },
    ],
  };
}

// Where a robot added in the sandbox stands: by the camp, on the first of these
// cells no robot stands on, else the camp's first.
export const ADD_SPOTS = [...SPOTS, [11, 15], [11, 17], [10, 17]];
