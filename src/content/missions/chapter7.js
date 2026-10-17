import { ref } from "../../i18n/index.js";
import { named } from "./chapter1.js";
import { robo } from "./island.js";
import { program } from "./write.js";

// Chapter 7, “Make Your Own Blocks” (docs/campaign-plan.md): a job given a
// name, one repair that fixes every use, an input that changes one use, and a
// big job made of little ones. A block of the player's own is Blockly's
// procedure (PLAN.md §7): a definition, “my block bring wood”, and blocks that
// use it, each a step, after which the robot follows its blocks in and back
// out. An input is a place or a number; a use gives it one.

const bridge = ["site"];
const wood = { grove: { wood: 12 } };
const atCamp = (...ids) => Object.fromEntries(ids.map((id) => [id, { at: "camp", basket: {} }]));

// One wood from the grove to `to` (a place, or an input's Get).
const trip = (p, to = "camp") => [p.go("grove"), p.collect(), p.go(to), p.unload()];

export const CHAPTER_7 = [
  // A whole delivery, named: move it into “bring wood”, and use it twice.
  {
    id: "m31",
    setup: { open: bridge, stock: wood, robots: atCamp("r1"), run: { r1: "m31" } },
    programs: [named("m31", 31, robo(1), program("m31", (p) => p.workspace(p.start(), p.routine("bringWood", null), p.loose(...trip(p)))))],
    blocks: ["procedures_defnoreturn", "procedures_callnoreturn"],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 2, exact: true }],
    look: "r1",
    predict: true,
    reference: { programs: { m31: program("m31", (p) => p.workspace(p.start(p.call("bringWood"), p.call("bringWood")), p.routine("bringWood", null, ...trip(p)))) } },
    budget: { wood: 2 },
    steps: 400,
  },
  // “bring wood” has no Unload, so the basket fills and Robo 1 waits. One
  // repair in the definition mends all three uses.
  {
    id: "m32",
    setup: { open: bridge, stock: wood, robots: atCamp("r1"), run: { r1: "m32" } },
    programs: [
      named(
        "m32",
        32,
        robo(1),
        program("m32", (p) => p.workspace(p.start(p.call("bringWood"), p.call("bringWood"), p.call("bringWood")), p.routine("bringWood", null, p.go("grove"), p.collect(), p.go("camp")))),
      ),
    ],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 3 }],
    look: "r1",
    problems: [{ entity: "r1", code: "wait.space", key: "full" }],
    predict: true,
    reference: { programs: { m32: program("m32", (p) => p.workspace(p.start(p.call("bringWood"), p.call("bringWood"), p.call("bringWood")), p.routine("bringWood", null, ...trip(p)))) } },
    budget: { wood: 3 },
    steps: 600,
  },
  // An input: where this use takes the wood. Camp, then the depot.
  {
    id: "m33",
    setup: { open: bridge, stock: wood, robots: atCamp("r1"), run: { r1: "m33" } },
    programs: [
      named(
        "m33",
        33,
        robo(1),
        program("m33", (p) => {
          const destination = p.input("destination");
          return p.workspace(p.start(p.call("bringWood", destination, "camp"), p.call("bringWood", destination, "depot")), p.routine("bringWood", destination, ...trip(p)), p.loose(p.get(destination)));
        }),
      ),
    ],
    blocks: [],
    goals: [
      { id: "camp", type: "delivered", to: "camp", item: "wood", count: 1 },
      { id: "depot", type: "delivered", to: "depot", item: "wood", count: 1 },
    ],
    look: "r1",
    predict: "point",
    reference: {
      programs: {
        m33: program("m33", (p) => {
          const destination = p.input("destination");
          return p.workspace(p.start(p.call("bringWood", destination, "camp"), p.call("bringWood", destination, "depot")), p.routine("bringWood", destination, ...trip(p, p.get(destination))));
        }),
      },
    },
    budget: { wood: 2 },
    steps: 600,
  },
  // A number input: how many trips. One, then three: four in all.
  {
    id: "m34",
    setup: { open: bridge, stock: wood, robots: atCamp("r1"), run: { r1: "m34" } },
    programs: [
      named(
        "m34",
        34,
        robo(1),
        program("m34", (p) => {
          const amount = p.input("amount");
          return p.workspace(p.start(p.call("bringSomeWood", amount, 1), p.call("bringSomeWood", amount, 3)), p.routine("bringSomeWood", amount, p.repeat(1, ...trip(p))), p.loose(p.get(amount)));
        }),
      ),
    ],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 4, exact: true }],
    look: "r1",
    predict: true,
    reference: {
      programs: {
        m34: program("m34", (p) => {
          const amount = p.input("amount");
          return p.workspace(p.start(p.call("bringSomeWood", amount, 1), p.call("bringSomeWood", amount, 3)), p.routine("bringSomeWood", amount, p.repeat(p.get(amount), ...trip(p))));
        }),
      },
    },
    budget: { wood: 4 },
    steps: 800,
  },
  // A big job from little ones: two kits, each from two planks and a stone,
  // made at the workshop and delivered to the depot by Robo 2 alone.
  {
    id: "m35",
    setup: {
      open: bridge,
      stock: { sawmill: { wood: 0, plank: 4 }, workshop: { plank: 0, stone: 0, kit: 0 } },
      robots: atCamp("r2"),
      run: { r2: "m35", workshop: "m35-kits" },
    },
    programs: [
      named(
        "m35",
        35,
        robo(2),
        program("m35", (p) =>
          p.workspace(p.start(p.repeat(2)), p.routine("bringPlanks", null, p.go("sawmill")), p.routine("bringStone", null, p.go("quarry")), p.routine("deliverKit", null, p.go("workshop"))),
        ),
      ),
      named("m35-kits", 35, ref("programName.kits"), program("m35-kits", (p) => p.workspace(p.start(p.repeat(2, p.make("kit")))))),
    ],
    blocks: [],
    goals: [{ id: "depot", type: "delivered", to: "depot", item: "kit", count: 2 }],
    look: "workshop",
    project: true,
    scaffold: {
      m35: program("m35", (p) =>
        p.workspace(
          p.start(p.repeat(2, p.call("bringPlanks"))),
          p.routine("bringPlanks", null, p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload()),
          p.routine("bringStone", null, p.go("quarry")),
          p.routine("deliverKit", null, p.go("workshop")),
        ),
      ),
    },
    reference: {
      programs: {
        m35: program("m35", (p) =>
          p.workspace(
            p.start(p.repeat(2, p.call("bringPlanks"), p.call("bringStone"), p.call("deliverKit"))),
            p.routine("bringPlanks", null, p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload()),
            p.routine("bringStone", null, p.go("quarry"), p.collect("stone"), p.go("workshop"), p.unload()),
            p.routine("deliverKit", null, p.go("workshop"), p.pickUp("kit"), p.go("depot"), p.unload()),
          ),
        ),
      },
    },
    budget: { stone: 2 },
    steps: 1200,
    milestone: true,
  },
];
