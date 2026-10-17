import { ref } from "../../i18n/index.js";
import { named } from "./chapter1.js";
import { robo } from "./island.js";
import { program } from "./write.js";

// Chapter 4, “Look Before You Act” (docs/campaign-plan.md): reading counts,
// If, Else, Wait Until, and controlled production; the island keeps a useful
// reserve. Missions 16–19 each have two trials, a starting variation each (one
// plank, then two), shown on the card; only the robot or building a lesson is
// about has a job, so a count can't turn into a race (“Control who can touch
// lesson resources”). The bridge is open from here on.

const sawmill = ref("entity.sawmill");
const bridge = ["site"];

export const CHAPTER_4 = [
  // Repeat as many times as the sawmill has planks: one plank, then two.
  {
    id: "m16",
    setup: { open: bridge, room: { depot: { plank: 3 } }, run: { r2: "m16" } },
    trials: [1, 2].map((n) => ({
      stage: { stock: { sawmill: { plank: n } }, robots: { r2: { at: "sawmill", basket: {} } } },
      goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", count: n, exact: true }],
    })),
    programs: [named("m16", 16, robo(2), program("m16", (p) => p.workspace(p.start(p.repeat(2, p.pickUp()), p.go("depot"), p.unload()), p.loose(p.stock("plank", "sawmill")))))],
    blocks: ["sense_stock"],
    look: "sawmill",
    problems: [{ entity: "r2", code: "wait.item", key: "fewer" }],
    predict: true,
    reference: { programs: { m16: program("m16", (p) => p.workspace(p.start(p.repeat(p.stock("plank", "sawmill"), p.pickUp()), p.go("depot"), p.unload()))) } },
    steps: 400,
  },
  // Make a plank only when the shelf has fewer than two: one plank, then two.
  {
    id: "m17",
    setup: { open: bridge, run: { sawmill: "m17" } },
    trials: [1, 2].map((n) => ({
      stage: { stock: { sawmill: { wood: 2, plank: n } } },
      goals: [{ id: "planks", type: "made", at: "sawmill", item: "plank", count: 2 - n, exact: true }],
    })),
    programs: [named("m17", 17, sawmill, program("m17", (p) => p.workspace(p.start(p.when(p.compare(p.stock("plank", "sawmill"), "LT", 2))), p.loose(p.make()))))],
    blocks: ["controls_if", "logic_compare", "math_number"],
    look: "sawmill",
    predict: true,
    reference: { programs: { m17: program("m17", (p) => p.workspace(p.start(p.when(p.compare(p.stock("plank", "sawmill"), "LT", 2), [p.make()])))) } },
    steps: 200,
  },
  // If there's a plank, take it to the depot; else bring the sawmill wood.
  {
    id: "m18",
    setup: { open: bridge, stock: { grove: { wood: 12 } }, room: { depot: { plank: 1 } }, run: { r2: "m18" } },
    trials: [
      {
        stage: { stock: { sawmill: { wood: 0, plank: 1 } }, robots: { r2: { at: "camp", basket: {} } } },
        goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", count: 1, exact: true }],
      },
      {
        stage: { stock: { sawmill: { wood: 0, plank: 0 } }, robots: { r2: { at: "camp", basket: {} } } },
        goals: [{ id: "sawmill", type: "delivered", to: "sawmill", item: "wood", count: 1, exact: true }],
      },
    ],
    programs: [
      named(
        "m18",
        18,
        robo(2),
        program("m18", (p) =>
          p.workspace(
            p.start(p.when(p.compare(p.stock("plank", "sawmill"), "GT", 0), [p.go("sawmill"), p.pickUp(), p.go("depot"), p.unload()], [])),
            p.loose(p.go("grove"), p.collect(), p.go("sawmill"), p.unload()),
          ),
        ),
      ),
    ],
    blocks: ["controls_if_else"],
    look: "sawmill",
    predict: true,
    reference: {
      programs: {
        m18: program("m18", (p) =>
          p.workspace(p.start(p.when(p.compare(p.stock("plank", "sawmill"), "GT", 0), [p.go("sawmill"), p.pickUp(), p.go("depot"), p.unload()], [p.go("grove"), p.collect(), p.go("sawmill"), p.unload()]))),
        ),
      },
    },
    budget: { wood: 1 },
    steps: 400,
  },
  // Set off only once both planks are ready: the sawmill makes them over
  // time, and later in the second trial. Picking up already waits for a
  // missing plank; here the robot shouldn't have to.
  {
    id: "m19",
    setup: { open: bridge, room: { depot: { plank: 2 } }, robots: { r2: { at: "camp", basket: {} } }, run: { r2: "m19", sawmill: "m19-mill" } },
    trials: [
      { stage: { stock: { sawmill: { wood: 2, plank: 0 } }, robots: { r2: { at: "camp", basket: {} } }, run: { sawmill: "m19-mill" } } },
      { stage: { stock: { sawmill: { wood: 2, plank: 0 } }, robots: { r2: { at: "camp", basket: {} } }, run: { sawmill: "m19-late" } } },
    ].map((trial) => ({ ...trial, goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", by: "r2", count: 2, load: 2, exact: true, noWait: true }] })),
    programs: [
      named(
        "m19",
        19,
        robo(2),
        program("m19", (p) => p.workspace(p.start(p.go("sawmill"), p.pickUp(), p.pickUp(), p.go("depot"), p.unload()), p.loose(p.until(p.compare(p.stock("plank", "sawmill"), "GTE", 2))))),
      ),
      named("m19-mill", 19, sawmill, program("m19-mill", (p) => p.workspace(p.start(p.repeat(2, p.make()))))),
      named("m19-late", 19, sawmill, program("m19-late", (p) => p.workspace(p.start(p.wait(60), p.repeat(2, p.make()))))),
    ],
    blocks: ["control_wait_until"],
    look: "sawmill",
    problems: [{ entity: "r2", code: "wait.item", key: "early" }],
    predict: true,
    reference: {
      programs: { m19: program("m19", (p) => p.workspace(p.start(p.until(p.compare(p.stock("plank", "sawmill"), "GTE", 2)), p.go("sawmill"), p.pickUp(), p.pickUp(), p.go("depot"), p.unload()))) },
    },
    steps: 700,
  },
  // Keep two planks ready while Robo 2 takes one away, twice: the sawmill
  // looks again and again, and makes one only when there are fewer than two.
  {
    id: "m20",
    setup: {
      open: bridge,
      stock: { grove: { wood: 12 }, sawmill: { wood: 0, plank: 0 } },
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} } },
      room: { depot: { plank: 2 } },
      run: { r1: "m20-collector", r2: "m20-courier", sawmill: "m20" },
    },
    programs: [
      named(
        "m20",
        20,
        sawmill,
        program("m20", (p) => p.workspace(p.start(p.forever()), p.loose(p.when(p.compare(p.stock("plank", "sawmill"), "LT", 2))), p.loose(p.make()))),
      ),
      named("m20-collector", 20, robo(1), program("m20-collector", (p) => p.workspace(p.start(p.forever(p.go("grove"), p.collect(), p.go("sawmill"), p.unload()))))),
      named(
        "m20-courier",
        20,
        robo(2),
        program("m20-courier", (p) => p.workspace(p.start(p.repeat(2, p.until(p.compare(p.stock("plank", "sawmill"), "GTE", 2)), p.go("sawmill"), p.pickUp(), p.go("depot"), p.unload())))),
      ),
    ],
    blocks: [],
    goals: [{ id: "reserve", type: "steady", at: "sawmill", item: "plank", count: 2, ticks: 60, after: "r2" }],
    look: "sawmill",
    project: true,
    reference: { programs: { m20: program("m20", (p) => p.workspace(p.start(p.forever(p.when(p.compare(p.stock("plank", "sawmill"), "LT", 2), [p.make()]))))) } },
    budget: { wood: 12 },
    steps: 1200,
    milestone: true,
  },
];
