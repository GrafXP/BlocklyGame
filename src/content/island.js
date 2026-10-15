import { ref } from "../i18n/index.js";
import { ISLAND_PROGRAMS } from "./programs.js";

// The island (PLAN.md §4): about 32 × 32 cells, with a stream running
// north to south that only a bridge crosses. West of it are the camp, a grove,
// the sawmill, a depot and the construction site of the bridge; east of it, a
// stone pit and room for the workshop region later.
//
// Terrain characters are terrain.js's KINDS: ~ water, , sand, . grass, = the gap
// the bridge will fill. Cells are [x, z]: x east, z south, from the top left.
// Areas are footprints { x, z, w, d } that can't be walked on; `access` lists the
// cells a robot stands on to use a thing. Names are messages (PLAN.md §8).
//
// Every robot and building runs a starter program (./programs.js): one robot
// brings wood to the sawmill, which makes planks; a second carries planks to the
// site, which builds the bridge from four; the third wants stone from across the
// stream, and waits for the bridge.
// prettier-ignore
export const TERRAIN = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", // 0
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", // 1
  "~~~~~~~~~~~~~,,,,,,~~~~~~~~~~~~~", // 2
  "~~~~~~~~~~,,,,....,,~~~~~~~~~~~~", // 3
  "~~~~~~~~~,,........,~~,~~~~~~~~~", // 4
  "~~~~~~~,,,.........,~~,,,~~~~~~~", // 5
  "~~~~~~,,...........,~~,.,,~~~~~~", // 6
  "~~~~~~,............,~~,..,~~~~~~", // 7
  "~~~~~,,............,~~,..,,~~~~~", // 8
  "~~~~,,.............,~~,...,,~~~~", // 9
  "~~~~,..............,~~,....,~~~~", // 10
  "~~~~,..............,~~,....,~~~~", // 11
  "~~~,,..............,~~,....,,~~~", // 12
  "~~~,...............,~~,.....,~~~", // 13
  "~~~,...............,~~,.....,~~~", // 14
  "~~~,...............,==,.....,~~~", // 15
  "~~~,...............,~~,.....,~~~", // 16
  "~~~,...............,~~,.....,~~~", // 17
  "~~~,...............,~~,.....,~~~", // 18
  "~~~,,..............,~~,....,,~~~", // 19
  "~~~~,..............,~~,....,~~~~", // 20
  "~~~~,..............,~~,....,~~~~", // 21
  "~~~~,,.............,~~,...,,~~~~", // 22
  "~~~~~,,............,~~,..,,~~~~~", // 23
  "~~~~~~,............,~~,..,~~~~~~", // 24
  "~~~~~~,,...........,~~,.,,~~~~~~", // 25
  "~~~~~~~,,,.........,~~,,,~~~~~~~", // 26
  "~~~~~~~~~,,........,~~,~~~~~~~~~", // 27
  "~~~~~~~~~~,,,,....,,~~~~~~~~~~~~", // 28
  "~~~~~~~~~~~~~,,,,,,~~~~~~~~~~~~~", // 29
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", // 30
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", // 31
];

export const ISLAND = {
  id: "island",
  version: 2,
  terrain: TERRAIN,
  programs: ISLAND_PROGRAMS,
  entities: [
    { id: "r1", type: "helper", name: ref("entity.robo", { n: 1 }), cell: [10, 15], program: "collector" },
    { id: "r2", type: "helper", name: ref("entity.robo", { n: 2 }), cell: [10, 16], program: "courier" },
    { id: "r3", type: "helper", name: ref("entity.robo", { n: 3 }), cell: [9, 17], program: "stones" },
    { id: "camp", type: "camp", name: ref("entity.camp"), area: { x: 8, z: 15, w: 2, d: 2 }, access: [[10, 15], [10, 16], [8, 17], [9, 17]], caps: { wood: 10, stone: 10, plank: 10 } },
    { id: "sawmill", type: "sawmill", name: ref("entity.sawmill"), area: { x: 13, z: 6, w: 3, d: 2 }, access: [[13, 8], [14, 8]], caps: { wood: 4, plank: 4 }, program: "planks" },
    { id: "depot", type: "depot", name: ref("entity.depot"), area: { x: 6, z: 21, w: 2, d: 2 }, access: [[8, 21], [8, 22]], caps: { wood: 20, stone: 20, plank: 20, kit: 20 } },
    { id: "site", type: "site", name: ref("entity.site"), area: { x: 16, z: 13, w: 2, d: 2 }, access: [[18, 13], [18, 14]], caps: { plank: 4 }, gap: [[20, 15], [21, 15]], program: "bridge" },
  ],
  nodes: [
    { id: "grove", type: "grove", name: ref("entity.grove"), area: { x: 7, z: 5, w: 4, d: 3 }, access: [[11, 6], [11, 7], [8, 8], [9, 8]], items: { wood: 12 }, caps: { wood: 12 }, regrow: { every: 40 } },
    { id: "quarry", type: "quarry", name: ref("entity.quarry"), area: { x: 25, z: 10, w: 2, d: 2 }, access: [[24, 10], [24, 11]], items: { stone: 8 }, caps: { stone: 8 } },
  ],
};
