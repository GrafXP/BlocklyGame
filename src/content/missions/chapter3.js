import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";

// Chapter 3, “A Working Island” (docs/campaign-planv2.md): a building's
// program, Pick Up, one delivery into a building, Forever, and Build. The
// sawmill wakes up, the depot opens, and the bridge is built: basic free play
// opens. The child writes one program in each mission; whatever else works
// already, and is background support.

const sawmill = ref("entity.sawmill");
const site = ref("entity.site");

export const CHAPTER_3 = [
  // A building can run a program too: one wood becomes one plank.
  {
    id: "c2-m011",
    workspace: "build",
    focus: "c2-m011",
    setup: { add: ["sawmill"], stock: { sawmill: { wood: 1 } }, run: { sawmill: "c2-m011" } },
    programs: [blank("c2-m011", 11, sawmill)],
    blocks: ["building_make"],
    goals: [{ id: "plank", type: "made", at: "sawmill", item: "plank", count: 1 }],
    look: "sawmill",
    predict: "point",
    reference: { programs: { "c2-m011": program("c2-m011", (p) => p.workspace(p.start(p.make()))) } },
    steps: 60,
  },
  // Pick Up takes what a building made: two planks to the depot.
  {
    id: "c2-m012",
    workspace: "build",
    focus: "c2-m012",
    setup: { add: ["sawmill", "depot"], stock: { sawmill: { plank: 2 } }, robots: { r1: { at: "camp", basket: {} } }, run: { r1: "c2-m012" } },
    programs: [blank("c2-m012", 12, robo(1))],
    blocks: ["robot_pick_up"],
    goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", count: 2 }],
    look: "sawmill",
    predict: "point",
    reference: { programs: { "c2-m012": program("c2-m012", (p) => p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("depot"), p.unload()))) } },
    steps: 300,
  },
  // A delivery puts ingredients where a building can use them: the sawmill
  // already knows how to make two planks, and waits for its wood. The goal is
  // the planks, which only the wood delivered there makes.
  {
    id: "c2-m013",
    workspace: "build",
    focus: "c2-m013",
    setup: { add: ["sawmill"], robots: { r1: { at: "camp", basket: {} } }, run: { r1: "c2-m013", sawmill: "c2-m013-mill" } },
    programs: [blank("c2-m013", 13, robo(1)), named("c2-m013-mill", 13, sawmill, program("c2-m013-mill", (p) => p.workspace(p.start(p.repeat(2, p.make())))))],
    blocks: [],
    goals: [{ id: "planks", type: "made", at: "sawmill", item: "plank", count: 2 }],
    look: "sawmill",
    problems: [{ entity: "sawmill", code: "wait.item", key: "hungry" }],
    predict: "point",
    reference: { programs: { "c2-m013": program("c2-m013", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.collect(), p.go("sawmill"), p.unload()))) } },
    budget: { wood: 2 },
    steps: 300,
  },
  // Forever keeps a useful job going: wood to the camp, trip after trip.
  {
    id: "c2-m014",
    workspace: "build",
    focus: "c2-m014",
    setup: { robots: { r1: { at: "camp", basket: {} } }, run: { r1: "c2-m014" } },
    programs: [blank("c2-m014", 14, robo(1))],
    blocks: ["control_forever"],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 4 }],
    look: "r1",
    predict: true,
    reference: { programs: { "c2-m014": program("c2-m014", (p) => p.workspace(p.start(p.forever(p.go("grove"), p.collect(), p.collect(), p.go("camp"), p.unload())))) } },
    budget: { wood: 6 },
    steps: 400,
  },
  // Build, once: a courier brings the bridge's four planks, and the site
  // builds it once they're there. Robo 2 crosses the stream to celebrate.
  {
    id: "c2-m015",
    workspace: "build",
    focus: "c2-m015",
    setup: {
      add: ["sawmill", "site", "quarry", "r2"],
      stock: { sawmill: { plank: 4 } },
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} } },
      run: { site: "c2-m015", r1: "c2-m015-courier", r2: "c2-m015-cross" },
      parked: ["r2"],
    },
    programs: [
      blank("c2-m015", 15, site),
      named("c2-m015-courier", 15, robo(1), program("c2-m015-courier", (p) => p.workspace(p.start(p.repeat(2, p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("site"), p.unload()))))),
      named("c2-m015-cross", 15, robo(2), program("c2-m015-cross", (p) => p.workspace(p.start(p.go("quarry"), p.repeat(2, p.collect("stone")), p.go("camp"), p.unload())))),
    ],
    blocks: ["building_build"],
    goals: [{ id: "bridge", type: "built", at: "site" }],
    reward: [{ type: "start", entity: "r2" }],
    look: "site",
    predict: "point",
    reference: { programs: { "c2-m015": program("c2-m015", (p) => p.workspace(p.start(p.build()))) } },
    steps: 600,
    milestone: true,
    unlocks: "free",
  },
];
