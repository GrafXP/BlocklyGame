import { ref } from "../../i18n/index.js";
import { BLUEPRINTS } from "../../sim/placement.js";
import { TERRAIN } from "../island.js";

// The campaign's island (PLAN.md §9; docs/campaign-planv2.md): the island of
// Phases 3–6. Every mission starts with Robo 1, the camp and the grove, BASE;
// whatever else it needs arrives as its setup says, each at its place in this
// catalogue (src/sim/staging.js, `add`): the sawmill from mission 11, the
// depot from 12, the construction site and the stone pit across the stream
// from 15, the workshop from 23.
//
// Each mission begins with every building empty and every deposit holding
// what this catalogue gives it (src/sim/staging.js, restock); a mission stages
// any other stock its lesson needs.

export const robo = (n) => ref("entity.robo", { n });

export const THINGS = [
  { id: "r1", type: "helper", name: robo(1), cell: [10, 15] },
  { id: "r2", type: "helper", name: robo(2), cell: [10, 16] },
  { id: "r3", type: "helper", name: robo(3), cell: [9, 17] },
  { id: "camp", type: "camp", name: ref("entity.camp"), area: { x: 8, z: 15, w: 2, d: 2 }, access: [[10, 15], [10, 16], [8, 17], [9, 17]], caps: { wood: 40, stone: 40, plank: 40 } },
  { id: "sawmill", type: "sawmill", name: ref("entity.sawmill"), area: { x: 13, z: 6, w: 3, d: 2 }, access: [[13, 8], [14, 8]], caps: { wood: 4, plank: 4 } },
  { id: "depot", type: "depot", name: ref("entity.depot"), area: { x: 6, z: 21, w: 2, d: 2 }, access: [[8, 21], [8, 22]], caps: { wood: 40, stone: 40, plank: 40, kit: 40 } },
  { id: "site", type: "site", name: ref("entity.site"), area: { x: 16, z: 13, w: 2, d: 2 }, access: [[18, 13], [18, 14]], caps: { plank: 4 }, blueprint: "bridge", gap: [[20, 15], [21, 15]] },
  { id: "workshop", type: "workshop", name: ref("entity.workshop"), area: { x: 24, z: 16, w: 3, d: 2 }, access: [[24, 18], [25, 18], [26, 18]], caps: BLUEPRINTS.workshop.caps },
  { id: "grove", type: "grove", name: ref("entity.grove"), area: { x: 7, z: 5, w: 4, d: 3 }, access: [[11, 6], [11, 7], [8, 8], [9, 8]], items: { wood: 12 }, caps: { wood: 12 }, regrow: { every: 40 } },
  { id: "quarry", type: "quarry", name: ref("entity.quarry"), area: { x: 25, z: 10, w: 2, d: 2 }, access: [[24, 10], [24, 11]], items: { stone: 8 }, caps: { stone: 8 } },
];

export const thingOf = (id) => THINGS.find((t) => t.id === id);

// The island before mission 1: createWorld's content.
export const BASE = {
  id: "campaign",
  version: 1,
  terrain: TERRAIN,
  programs: [],
  entities: ["r1", "camp"].map(thingOf),
  nodes: ["grove"].map(thingOf),
};
