import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";

// Chapter 7, “Water Makes Things Grow” (docs/campaign-planv2.md): water,
// picked up at the spring as wood is at the grove, and from the well's shelf as
// planks are from the sawmill's; a building that makes something from nothing
// but time; and water that the farm grows into food. The west bank gets a
// spring, a well and a farm. The child writes one program in each mission; the
// rest works already.

const well = ref("entity.well");
const farm = ref("entity.farm");

// The island after the bridge, built, without its construction site, with
// what mission `add` lists, and Robo 1 at the camp.
export const westBank = (add, rest) => ({ add, bridges: ["site"], robots: { r1: { at: "camp", basket: {} } }, ...rest });

export const CHAPTER_7 = [
  // Water is another thing to pick up: at the spring, a bucket a basket space.
  {
    id: "c2-m031",
    workspace: "build",
    focus: "c2-m031",
    setup: westBank(["spring"], { run: { r1: "c2-m031" } }),
    programs: [blank("c2-m031", 31, robo(1))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "water", count: 1 }],
    look: "spring",
    predict: "point",
    reference: { programs: { "c2-m031": program("c2-m031", (p) => p.workspace(p.start(p.go("spring"), p.pickUp("water"), p.go("camp"), p.unload()))) } },
    budget: { water: 1 },
    steps: 200,
  },
  // A building can make something from nothing but time: the well draws water.
  {
    id: "c2-m032",
    workspace: "build",
    focus: "c2-m032",
    setup: westBank(["well"], { run: { well: "c2-m032" } }),
    programs: [blank("c2-m032", 32, well)],
    blocks: [],
    goals: [{ id: "water", type: "made", at: "well", item: "water", count: 2 }],
    look: "well",
    predict: true,
    reference: { programs: { "c2-m032": program("c2-m032", (p) => p.workspace(p.start(p.repeat(2, p.make("water"))))) } },
    steps: 100,
  },
  // The well keeps its water on its shelf, like the sawmill its planks: two
  // buckets home in one load.
  {
    id: "c2-m033",
    workspace: "build",
    focus: "c2-m033",
    setup: westBank(["well"], { stock: { well: { water: 2 } }, run: { r1: "c2-m033" } }),
    programs: [blank("c2-m033", 33, robo(1))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "water", count: 2, load: 2 }],
    look: "well",
    predict: "point",
    reference: { programs: { "c2-m033": program("c2-m033", (p) => p.workspace(p.start(p.go("well"), p.repeat(2, p.pickUp("water")), p.go("camp"), p.unload()))) } },
    steps: 200,
  },
  // One bucket of water grows two food.
  {
    id: "c2-m034",
    workspace: "build",
    focus: "c2-m034",
    setup: westBank(["farm"], { stock: { farm: { water: 1 } }, run: { farm: "c2-m034" } }),
    programs: [blank("c2-m034", 34, farm)],
    blocks: [],
    goals: [{ id: "food", type: "made", at: "farm", item: "food", count: 2 }],
    look: "farm",
    predict: true,
    reference: { programs: { "c2-m034": program("c2-m034", (p) => p.workspace(p.start(p.make("food")))) } },
    steps: 120,
  },
  // Into a building, and out again: the well's water to the farm, and the
  // food it grows home, in loads the basket holds.
  {
    id: "c2-m035",
    workspace: "build",
    focus: "c2-m035",
    setup: westBank(["well", "farm"], { run: { r1: "c2-m035", well: "c2-m035-well", farm: "c2-m035-farm" } }),
    programs: [
      blank("c2-m035", 35, robo(1)),
      named("c2-m035-well", 35, well, program("c2-m035-well", (p) => p.workspace(p.start(p.repeat(2, p.make("water")))))),
      named("c2-m035-farm", 35, farm, program("c2-m035-farm", (p) => p.workspace(p.start(p.repeat(2, p.make("food")))))),
    ],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "food", count: 4 }],
    look: "farm",
    problems: [{ entity: "farm", code: "wait.item", key: "water" }],
    predict: true,
    scaffold: { "c2-m035": program("c2-m035", (p) => p.workspace(p.start(p.go("well"), p.repeat(2, p.pickUp("water")), p.go("farm"), p.unload()))) },
    reference: {
      programs: {
        "c2-m035": program("c2-m035", (p) =>
          p.workspace(p.start(p.go("well"), p.repeat(2, p.pickUp("water")), p.go("farm"), p.unload(), p.repeat(2, p.go("farm"), p.repeat(2, p.pickUp("food")), p.go("camp"), p.unload()))),
        ),
      },
    },
    steps: 800,
    milestone: true,
  },
];
