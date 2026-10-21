import { ref } from "../../i18n/index.js";
import { BLUEPRINTS } from "../../sim/placement.js";
import { TERRAIN } from "../island.js";

// The campaign's island (PLAN.md §9; docs/campaign-planv2.md): the island of
// Phases 3–6. Every mission starts with Robo 1, the camp and the grove, BASE,
// and the stream whole; whatever else it needs arrives as its setup says, each
// at its place in this catalogue (src/sim/staging.js, `add`): the sawmill from
// mission 11, the depot from 12, the stone pit across the stream from 15, the
// workshop from 23; on the west bank, from chapter 7, the spring, the well and
// the farm, and the berry bushes and the fuel station from chapter 8. The
// bridge's construction site, by the stream where the bridge goes, is there in
// mission 15 alone, which builds the bridge; after it, the bridge is there and
// its site isn't (`bridges`).
//
// Each mission begins with every building empty and every deposit holding
// what this catalogue gives it (src/sim/staging.js, restock); a mission stages
// any other stock its lesson needs.

export const robo = (n) => ref("entity.robo", { n });

export const THINGS = [
  { id: "r1", type: "helper", name: robo(1), cell: [10, 15] },
  { id: "r2", type: "helper", name: robo(2), cell: [10, 16] },
  { id: "r3", type: "helper", name: robo(3), cell: [9, 17] },
  { id: "camp", type: "camp", name: ref("entity.camp"), area: { x: 8, z: 15, w: 2, d: 2 }, access: [[10, 15], [10, 16], [8, 17], [9, 17]], caps: { wood: 40, stone: 40, plank: 40, water: 40, food: 40, pack: 40 } },
  { id: "sawmill", type: "sawmill", name: ref("entity.sawmill"), area: { x: 13, z: 6, w: 3, d: 2 }, access: [[13, 8], [14, 8]], caps: { wood: 4, plank: 4 } },
  { id: "depot", type: "depot", name: ref("entity.depot"), area: { x: 6, z: 21, w: 2, d: 2 }, access: [[8, 21], [8, 22]], caps: { wood: 40, stone: 40, plank: 40, kit: 40 } },
  { id: "site", type: "site", name: ref("entity.site"), area: { x: 17, z: 14, w: 2, d: 2 }, access: [[19, 14], [19, 15]], caps: { plank: 4 }, blueprint: "bridge", gap: [[20, 15], [21, 15]] },
  { id: "workshop", type: "workshop", name: ref("entity.workshop"), area: { x: 24, z: 16, w: 3, d: 2 }, access: [[24, 18], [25, 18], [26, 18]], caps: BLUEPRINTS.workshop.caps },
  { id: "well", type: "well", name: ref("entity.well"), area: { x: 12, z: 11, w: 2, d: 2 }, access: [[12, 13], [13, 13]], caps: { water: 2 } },
  { id: "farm", type: "farm", name: ref("entity.farm"), area: { x: 13, z: 19, w: 3, d: 2 }, access: [[13, 18], [14, 18], [15, 18]], caps: { water: 2, food: 4 } },
  { id: "station", type: "station", name: ref("entity.station"), area: { x: 15, z: 10, w: 3, d: 2 }, access: [[15, 12], [16, 12], [17, 12]], caps: { food: 4, water: 2, pack: 4 } },
  { id: "grove", type: "grove", name: ref("entity.grove"), area: { x: 7, z: 5, w: 4, d: 3 }, access: [[11, 6], [11, 7], [8, 8], [9, 8]], items: { wood: 12 }, caps: { wood: 12 }, regrow: { every: 40 } },
  { id: "quarry", type: "quarry", name: ref("entity.quarry"), area: { x: 25, z: 10, w: 2, d: 2 }, access: [[24, 10], [24, 11]], items: { stone: 8 }, caps: { stone: 8 } },
  { id: "spring", type: "spring", name: ref("entity.spring"), area: { x: 5, z: 11, w: 2, d: 2 }, access: [[7, 11], [7, 12]], items: { water: 6 }, caps: { water: 6 }, regrow: { every: 40 } },
  { id: "berries", type: "berries", name: ref("entity.berries"), area: { x: 5, z: 18, w: 2, d: 2 }, access: [[7, 18], [7, 19]], items: { food: 6 }, caps: { food: 6 }, regrow: { every: 60 } },
];

export const thingOf = (id) => THINGS.find((t) => t.id === id);

// The island's ground with no bridge planned: the stream whole. The bridge's
// construction site plans it, where it arrives (src/sim/staging.js).
const STREAM = TERRAIN.map((row) => row.replaceAll("=", "~"));

// The island before mission 1: createWorld's content.
export const BASE = {
  id: "campaign",
  version: 1,
  terrain: STREAM,
  programs: [],
  entities: ["r1", "camp"].map(thingOf),
  nodes: ["grove"].map(thingOf),
};
