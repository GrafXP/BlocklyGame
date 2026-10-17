import { ref } from "../../i18n/index.js";
import { named } from "./chapter1.js";
import { robo } from "./island.js";
import { program } from "./write.js";

// Chapter 3, “A Working Island” (docs/campaign-plan.md): building programs,
// transfers, programs running at once on one clock, and Forever. The sawmill
// wakes up, the depot and Robo 2 arrive, and the chain of four builds the
// bridge: the campaign's mission 15, which Phase 5's slice played alone.

const sawmill = ref("entity.sawmill");
const site = ref("entity.site");

// A robot that brings wood to the sawmill again and again, two at a time.
const collector = (id) => program(id, (p) => p.workspace(p.start(p.forever(p.go("grove"), p.repeat(2, p.collect()), p.go("sawmill"), p.unload()))));
// The sawmill makes a plank whenever it has wood.
const planks = (id) => program(id, (p) => p.workspace(p.start(p.forever(p.until(p.compare(p.stock("wood", "sawmill"), "GT", 0)), p.make()))));
// A robot that carries planks from the sawmill to `to`, two at a time, again and again.
const courier = (id, to) => program(id, (p) => p.workspace(p.start(p.forever(p.go("sawmill"), p.repeat(2, p.pickUp()), p.go(to), p.unload()))));

export const CHAPTER_3 = [
  // The sawmill has a program too: one wood becomes one plank.
  {
    id: "m11",
    setup: { add: ["sawmill"], stock: { sawmill: { wood: 1, plank: 0 } }, run: { sawmill: "m11" } },
    programs: [named("m11", 11, sawmill, program("m11", (p) => p.workspace(p.start())))],
    blocks: ["building_make"],
    goals: [{ id: "plank", type: "made", at: "sawmill", item: "plank", count: 1 }],
    look: "sawmill",
    predict: "point",
    reference: { programs: { m11: program("m11", (p) => p.workspace(p.start(p.make()))) } },
    steps: 60,
  },
  // Pick Up takes what a building has made: two planks to the depot.
  {
    id: "m12",
    setup: {
      add: ["depot"],
      stock: { sawmill: { wood: 0, plank: 2 } },
      robots: { r1: { at: "camp", basket: {} } },
      room: { depot: { plank: 2 } },
      run: { r1: "m12" },
    },
    programs: [named("m12", 12, robo(1), program("m12", (p) => p.workspace(p.start(p.go("sawmill"), p.repeat(2), p.go("depot"), p.unload()))))],
    blocks: ["robot_pick_up"],
    goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", count: 2 }],
    look: "sawmill",
    predict: "point",
    reference: { programs: { m12: program("m12", (p) => p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("depot"), p.unload()))) } },
    steps: 300,
  },
  // Two programs at once: Robo 1 brings wood while the sawmill waits for it.
  // Its delivery still goes to the camp.
  {
    id: "m13",
    setup: {
      stock: { grove: { wood: 12 }, sawmill: { wood: 0, plank: 0 } },
      robots: { r1: { at: "camp", basket: {} } },
      run: { r1: "m13", sawmill: "m13-mill" },
    },
    programs: [
      named("m13", 13, robo(1), program("m13", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.collect(), p.go("camp"), p.unload())))),
      named("m13-mill", 13, sawmill, program("m13-mill", (p) => p.workspace(p.start(p.repeat(2, p.make()))))),
    ],
    blocks: [],
    goals: [
      { id: "wood", type: "delivered", to: "sawmill", item: "wood", count: 2 },
      { id: "planks", type: "made", at: "sawmill", item: "plank", count: 2 },
    ],
    look: "sawmill",
    problems: [{ entity: "sawmill", code: "wait.item", key: "hungry" }],
    predict: "point",
    reference: { programs: { m13: program("m13", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.collect(), p.go("sawmill"), p.unload()))) } },
    budget: { wood: 2 },
    steps: 300,
  },
  // Forever: Robo 1's one trip, again and again, while the sawmill and Robo 2
  // make planks and carry them to the depot.
  {
    id: "m14",
    setup: {
      add: ["r2"],
      stock: { grove: { wood: 12 }, sawmill: { wood: 0, plank: 0 } },
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} } },
      room: { depot: { plank: 4 } },
      run: { r1: "m14", r2: "m14-courier", sawmill: "m14-mill" },
    },
    programs: [
      named("m14", 14, robo(1), program("m14", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.go("sawmill"), p.unload())))),
      named("m14-mill", 14, sawmill, planks("m14-mill")),
      named("m14-courier", 14, robo(2), courier("m14-courier", "depot")),
    ],
    blocks: ["control_forever"],
    goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", count: 4 }],
    look: "r1",
    predict: true,
    reference: { programs: { m14: program("m14", (p) => p.workspace(p.start(p.forever(p.go("grove"), p.collect(), p.go("sawmill"), p.unload())))) } },
    budget: { wood: 12 },
    steps: 900,
  },
  // The chain of four: send the planks to the construction site and start
  // its program. When the bridge is built, Robo 3 crosses to fetch stone.
  {
    id: "m15",
    setup: {
      add: ["site", "quarry", "r3"],
      stock: { grove: { wood: 12 }, sawmill: { wood: 0, plank: 0 }, site: { plank: 0 }, quarry: { stone: 8 } },
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} }, r3: { at: "camp", basket: {} } },
      room: { depot: { stone: 4 } },
      run: { r1: "m15-collector", r2: "m15", sawmill: "m15-mill", site: "m15-site", r3: "m15-stones" },
      parked: ["r3"],
    },
    programs: [
      named("m15", 15, robo(2), courier("m15", "depot")),
      named("m15-site", 15, site, program("m15-site", (p) => p.workspace(p.start(), p.loose(p.build())))),
      named("m15-collector", 15, robo(1), collector("m15-collector")),
      named("m15-mill", 15, sawmill, planks("m15-mill")),
      named(
        "m15-stones",
        15,
        robo(3),
        program("m15-stones", (p) => p.workspace(p.start(p.forever(p.go("quarry"), p.repeat(2, p.collect("stone")), p.go("depot"), p.unload())))),
      ),
    ],
    blocks: ["building_build"],
    goals: [{ id: "bridge", type: "built", at: "site" }],
    reward: [{ type: "start", entity: "r3" }],
    look: "site",
    project: true,
    reference: {
      programs: {
        m15: courier("m15", "site"),
        "m15-site": program("m15-site", (p) => p.workspace(p.start(p.build()))),
      },
    },
    budget: { wood: 12 },
    steps: 600,
    milestone: true,
    unlocks: "free",
  },
];
