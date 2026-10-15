import { ref } from "../i18n/index.js";

// The Phase 1 island (PLAN.md §4): about 32 × 32 cells, with a stream running
// north to south that only a bridge crosses. West of it are the camp, a grove,
// the sawmill, a depot and the construction site of the bridge; east of it, a
// stone pit and room for the workshop region later.
//
// Terrain characters are terrain.js's KINDS: ~ water, , sand, . grass, = the gap
// the bridge will fill. Cells are [x, z]: x east, z south, from the top left.
// Areas are footprints { x, z, w, d } that can't be walked on; `access` lists the
// cells a robot stands on to use a thing. Names are messages (PLAN.md §8).
//
// The scripts are what each robot and building does until Phase 2 gives them
// programs: one robot brings wood to the sawmill, which makes planks; a second
// carries planks to the site, which builds the bridge from four; the third
// wants stone from across the stream, and waits for the bridge.
// prettier-ignore
const TERRAIN = [
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

const collector = [
  { type: "goTo", target: "grove" },
  { type: "collect", item: "wood" },
  { type: "collect", item: "wood" },
  { type: "goTo", target: "sawmill" },
  { type: "unload" },
];
const courier = [
  { type: "goTo", target: "sawmill" },
  { type: "pickUp", item: "plank" },
  { type: "pickUp", item: "plank" },
  { type: "goTo", target: "site" },
  { type: "unload" },
];
const stoneCarrier = [
  { type: "goTo", target: "quarry" },
  { type: "collect", item: "stone" },
  { type: "collect", item: "stone" },
  { type: "goTo", target: "depot" },
  { type: "unload" },
];

export const ISLAND = {
  id: "island",
  version: 1,
  terrain: TERRAIN,
  entities: [
    { id: "r1", type: "helper", name: ref("entity.robo", { n: 1 }), cell: [10, 15], script: { steps: collector, loop: true } },
    { id: "r2", type: "helper", name: ref("entity.robo", { n: 2 }), cell: [10, 16], script: { steps: courier, loop: true } },
    { id: "r3", type: "helper", name: ref("entity.robo", { n: 3 }), cell: [9, 17], script: { steps: stoneCarrier, loop: true } },
    { id: "camp", type: "camp", name: ref("entity.camp"), area: { x: 8, z: 15, w: 2, d: 2 }, access: [[10, 15], [10, 16], [8, 17], [9, 17]], caps: { wood: 10, stone: 10, plank: 10 } },
    { id: "sawmill", type: "sawmill", name: ref("entity.sawmill"), area: { x: 13, z: 6, w: 3, d: 2 }, access: [[13, 8], [14, 8]], caps: { wood: 4, plank: 4 }, script: { steps: [{ type: "make", recipe: "plank" }], loop: true } },
    { id: "depot", type: "depot", name: ref("entity.depot"), area: { x: 6, z: 21, w: 2, d: 2 }, access: [[8, 21], [8, 22]], caps: { wood: 20, stone: 20, plank: 20, kit: 20 } },
    { id: "site", type: "site", name: ref("entity.site"), area: { x: 16, z: 13, w: 2, d: 2 }, access: [[18, 13], [18, 14]], caps: { plank: 4 }, gap: [[20, 15], [21, 15]], script: { steps: [{ type: "make", recipe: "bridge" }] } },
  ],
  nodes: [
    { id: "grove", type: "grove", name: ref("entity.grove"), area: { x: 7, z: 5, w: 4, d: 3 }, access: [[11, 6], [11, 7], [8, 8], [9, 8]], items: { wood: 12 }, caps: { wood: 12 }, regrow: { every: 40 } },
    { id: "quarry", type: "quarry", name: ref("entity.quarry"), area: { x: 25, z: 10, w: 2, d: 2 }, access: [[24, 10], [24, 11]], items: { stone: 8 }, caps: { stone: 8 } },
  ],
};
