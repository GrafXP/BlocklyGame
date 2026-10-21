import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";

// Chapter 4, “Look Before You Act” (docs/campaign-planv2.md): a count from the
// world, If, Else, Wait Until, and a reserve kept by looking again and again.
// Each mission has one start and one goal, as every mission does: the program
// looks at the world as it is, and only the robot or building the lesson is
// about touches what's counted. The bridge is open from here on.

const sawmill = ref("entity.sawmill");
// The island after the bridge: the bridge built, without its construction
// site, and the stone pit across the stream.
const bridged = (add, rest) => ({ add: ["quarry", ...add], bridges: ["site"], ...rest });

export const CHAPTER_4 = [
  // A sensor gives a number from the world, and Repeat reads it as it starts:
  // the planks on the shelf, all of them to the depot.
  {
    id: "c2-m016",
    workspace: "build",
    focus: "c2-m016",
    setup: bridged(["sawmill", "depot"], { stock: { sawmill: { plank: 2 } }, robots: { r1: { at: "sawmill", basket: {} } }, run: { r1: "c2-m016" } }),
    programs: [blank("c2-m016", 16, robo(1))],
    blocks: ["sense_stock"],
    goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", count: 2 }],
    look: "sawmill",
    problems: [{ entity: "r1", code: "wait.item", key: "fewer" }],
    predict: true,
    reference: { programs: { "c2-m016": program("c2-m016", (p) => p.workspace(p.start(p.repeat(p.stock("plank", "sawmill"), p.pickUp("plank")), p.go("depot"), p.unload()))) } },
    steps: 200,
  },
  // If, with a comparison: make a plank only when the shelf has fewer than
  // two. It has one, and wood for two more: a sawmill that makes without
  // looking, or makes again and again, fills the shelf past two.
  {
    id: "c2-m017",
    workspace: "build",
    focus: "c2-m017",
    setup: bridged(["sawmill"], { stock: { sawmill: { wood: 2, plank: 1 } }, run: { sawmill: "c2-m017" } }),
    programs: [blank("c2-m017", 17, sawmill)],
    blocks: ["controls_if", "logic_compare", "math_number"],
    goals: [{ id: "planks", type: "steady", at: "sawmill", item: "plank", count: 2, ticks: 30 }],
    look: "sawmill",
    predict: true,
    reference: { programs: { "c2-m017": program("c2-m017", (p) => p.workspace(p.start(p.when(p.compare(p.stock("plank", "sawmill"), "LT", 2), [p.make()])))) } },
    steps: 200,
  },
  // Else: if there's a plank, take it to the depot; if not, bring the sawmill
  // wood. There's none, so the Else's job is the one that runs.
  {
    id: "c2-m018",
    workspace: "build",
    focus: "c2-m018",
    setup: bridged(["sawmill", "depot"], { robots: { r1: { at: "camp", basket: {} } }, run: { r1: "c2-m018" } }),
    programs: [blank("c2-m018", 18, robo(1))],
    blocks: ["controls_if_else"],
    goals: [{ id: "sawmill", type: "delivered", to: "sawmill", item: "wood", count: 1 }],
    look: "sawmill",
    problems: [{ entity: "r1", code: "wait.item", key: "none" }],
    predict: true,
    reference: {
      programs: {
        "c2-m018": program("c2-m018", (p) =>
          p.workspace(p.start(p.when(p.compare(p.stock("plank", "sawmill"), "GT", 0), [p.go("sawmill"), p.pickUp("plank"), p.go("depot"), p.unload()], [p.go("grove"), p.pickUp(), p.go("sawmill"), p.unload()]))),
        ),
      },
    },
    budget: { wood: 1 },
    steps: 200,
  },
  // Wait Until: set off only once both planks are ready. The sawmill takes a
  // while to start, so a robot that goes at once stands at the sawmill and
  // waits for them.
  {
    id: "c2-m019",
    workspace: "build",
    focus: "c2-m019",
    setup: bridged(["sawmill", "depot"], { stock: { sawmill: { wood: 2 } }, robots: { r1: { at: "camp", basket: {} } }, run: { r1: "c2-m019", sawmill: "c2-m019-mill" } }),
    programs: [blank("c2-m019", 19, robo(1)), named("c2-m019-mill", 19, sawmill, program("c2-m019-mill", (p) => p.workspace(p.start(p.wait(60), p.repeat(2, p.make())))))],
    blocks: ["control_wait_until"],
    goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", by: "r1", count: 2, load: 2, noWait: true }],
    look: "sawmill",
    problems: [{ entity: "r1", code: "wait.item", key: "early" }],
    predict: true,
    reference: {
      programs: {
        "c2-m019": program("c2-m019", (p) => p.workspace(p.start(p.until(p.compare(p.stock("plank", "sawmill"), "GTE", 2)), p.go("sawmill"), p.pickUp("plank"), p.pickUp("plank"), p.go("depot"), p.unload()))),
      },
    },
    steps: 400,
  },
  // Keep two planks ready while Robo 2 takes one away, twice: the sawmill
  // looks again and again, and makes one only when there are fewer than two.
  // Robo 1 keeps its wood coming, so a sawmill that makes planks without
  // looking fills its shelf (docs/campaign-planv2.md, “Corrections made in
  // this review”).
  {
    id: "c2-m020",
    workspace: "build",
    focus: "c2-m020",
    setup: bridged(["sawmill", "depot", "r2"], {
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} } },
      run: { sawmill: "c2-m020", r1: "c2-m020-collector", r2: "c2-m020-courier" },
    }),
    programs: [
      blank("c2-m020", 20, sawmill),
      named("c2-m020-collector", 20, robo(1), program("c2-m020-collector", (p) => p.workspace(p.start(p.forever(p.go("grove"), p.pickUp(), p.go("sawmill"), p.unload()))))),
      named(
        "c2-m020-courier",
        20,
        robo(2),
        program("c2-m020-courier", (p) => p.workspace(p.start(p.repeat(2, p.until(p.compare(p.stock("plank", "sawmill"), "GTE", 2)), p.go("sawmill"), p.pickUp("plank"), p.go("depot"), p.unload())))),
      ),
    ],
    blocks: [],
    goals: [{ id: "reserve", type: "steady", at: "sawmill", item: "plank", count: 2, ticks: 60, after: "r2" }],
    look: "sawmill",
    reference: { programs: { "c2-m020": program("c2-m020", (p) => p.workspace(p.start(p.forever(p.when(p.compare(p.stock("plank", "sawmill"), "LT", 2), [p.make()]))))) } },
    budget: { wood: 12 },
    steps: 1200,
    milestone: true,
  },
];
