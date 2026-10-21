import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";

// Chapter 6, “Make Room to Grow” (docs/campaign-planv2.md): choosing where a
// building goes, the bill its construction site waits for, a way in, stock at
// the right place, and a building that, once built, makes something. The
// workshop arrives on the east bank. Missions 26 and 28 are about placing, with
// the Build tool, and need no code; in 27 and 30 the child writes one helper's
// deliveries; 29 is a repair. Each has one goal.

const site = ref("entity.workshopSite");
const workshop = ref("entity.workshop");
// The island after the bridge, built, without its construction site, with what
// else mission `add` lists, and Robo 1 at the camp.
const bridged = (add, rest) => ({ add: ["quarry", ...add], bridges: ["site"], robots: { r1: { at: "camp", basket: {} } }, ...rest });
// The construction site's job: build the workshop, once its bill is there.
const builder = (id, n) => named(id, n, site, program(id, (p) => p.workspace(p.start(p.build("workshop")))));
// The workshop's plot: where the island's catalogue has it, facing south, as
// missions 27–30 have it. Placing is only on the plots a mission marks, so the
// island stays the same from mission to mission (src/ui/session.js,
// checkPlace). Mission 28 marks another, which would stand on the bridge's
// landing and cut the stone pit off: placing refuses it, and says why.
const PLOT = { x: 24, z: 16, facing: "south" };
const LANDING = { x: 22, z: 14, facing: "south" };
const PLACE = { type: "place", blueprint: "workshop", ...PLOT };
// The workshop's bill, from the sawmill's planks and the stone pit: two loads of
// planks, then one of stone.
const bill = (p, from = "sawmill", to = "workshop") => [
  p.repeat(2, p.go(from), p.repeat(2, p.pickUp("plank")), p.go(to), p.unload()),
  p.go("quarry"),
  p.repeat(2, p.pickUp("stone")),
  p.go(to),
  p.unload(),
];

export const CHAPTER_6 = [
  // Placing a blueprint makes a construction site, not a building: its bill
  // is still to come.
  {
    id: "c2-m026",
    workspace: "explore",
    focus: null,
    setup: bridged(["sawmill"], {}),
    blueprints: [{ blueprint: "workshop", program: null, plots: [PLOT] }],
    tools: ["build"],
    programs: [],
    blocks: [],
    goals: [{ id: "site", type: "placed", blueprint: "workshop" }],
    look: "quarry",
    reference: { commands: [{ ...PLACE, program: null }] },
    steps: 20,
  },
  // Construction takes what's delivered to the site: one helper brings the
  // whole bill, in loads that fit its basket. The site already has its Build.
  {
    id: "c2-m027",
    workspace: "build",
    focus: "c2-m027",
    setup: bridged(["sawmill"], { plots: ["workshop"], stock: { sawmill: { plank: 4 } }, run: { r1: "c2-m027", workshop: "c2-m027-site" } }),
    programs: [blank("c2-m027", 27, robo(1)), builder("c2-m027-site", 27)],
    blocks: [],
    goals: [{ id: "workshop", type: "constructed", blueprint: "workshop" }],
    look: "workshop",
    problems: [{ entity: "workshop", code: "wait.item", key: "missing" }],
    predict: "point",
    reference: { programs: { "c2-m027": program("c2-m027", (p) => p.workspace(p.start(...bill(p)))) } },
    budget: { stone: 2 },
    steps: 1000,
  },
  // A building needs a way in: of the two plots, one would block the bridge,
  // and placing refuses it. The goal is the site on the plot with a way in;
  // then, as the reward, Robo 1 sets off with its bill, and the site builds.
  {
    id: "c2-m028",
    workspace: "explore",
    focus: null,
    setup: bridged(["sawmill"], { stock: { sawmill: { plank: 4 } }, run: { r1: "c2-m028-courier" }, parked: ["r1"] }),
    blueprints: [{ blueprint: "workshop", program: "c2-m028-site", plots: [LANDING, PLOT] }],
    tools: ["build"],
    programs: [builder("c2-m028-site", 28), named("c2-m028-courier", 28, robo(1), program("c2-m028-courier", (p) => p.workspace(p.start(...bill(p)))))],
    blocks: [],
    goals: [{ id: "site", type: "placed", blueprint: "workshop" }],
    reward: [{ type: "start", entity: "r1" }],
    look: "sawmill",
    reference: { commands: [{ ...PLACE, program: "c2-m028-site" }] },
    steps: 20,
  },
  // All the pieces are at the camp, and Robo 1 carries them about, but back
  // to the camp: the site waits. A total isn't stock at the place that uses it.
  {
    id: "c2-m029",
    workspace: "repair",
    focus: "c2-m029",
    setup: bridged([], { plots: ["workshop"], stock: { camp: { plank: 4, stone: 2 } }, run: { r1: "c2-m029", workshop: "c2-m029-site" } }),
    programs: [
      named(
        "c2-m029",
        29,
        robo(1),
        program("c2-m029", (p) => p.workspace(p.start(p.repeat(2, p.go("camp"), p.repeat(2, p.pickUp("plank")), p.go("camp"), p.unload()), p.go("camp"), p.repeat(2, p.pickUp("stone")), p.go("camp"), p.unload()))),
      ),
      builder("c2-m029-site", 29),
    ],
    blocks: [],
    goals: [{ id: "workshop", type: "constructed", blueprint: "workshop" }],
    look: "workshop",
    problems: [{ entity: "workshop", code: "wait.item", key: "missing" }],
    predict: true,
    reference: {
      programs: {
        "c2-m029": program("c2-m029", (p) =>
          p.workspace(p.start(p.repeat(2, p.go("camp"), p.repeat(2, p.pickUp("plank")), p.go("workshop"), p.unload()), p.go("camp"), p.repeat(2, p.pickUp("stone")), p.go("workshop"), p.unload())),
        ),
      },
    },
    steps: 1000,
  },
  // The workshop's first kit: build the workshop, then bring what the kit
  // needs, as the building uses its bill up and the kit needs pieces of its
  // own. Robo 2 and the sawmill make the planks from the grove's wood; the site
  // builds, and the workshop, once built, makes the kit, the one goal.
  {
    id: "c2-m030",
    workspace: "build",
    focus: "c2-m030",
    setup: bridged(["sawmill", "r2"], {
      plots: ["workshop"],
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} } },
      defaults: [{ type: "workshop", program: "c2-m030-kit" }],
      run: { r1: "c2-m030", r2: "c2-m030-collector", sawmill: "c2-m030-mill", workshop: "c2-m030-site" },
    }),
    programs: [
      blank("c2-m030", 30, robo(1)),
      named("c2-m030-collector", 30, robo(2), program("c2-m030-collector", (p) => p.workspace(p.start(p.repeat(3, p.go("grove"), p.repeat(2, p.pickUp()), p.go("sawmill"), p.unload()))))),
      named("c2-m030-mill", 30, ref("entity.sawmill"), program("c2-m030-mill", (p) => p.workspace(p.start(p.repeat(6, p.make()))))),
      builder("c2-m030-site", 30),
      named("c2-m030-kit", 30, workshop, program("c2-m030-kit", (p) => p.workspace(p.start(p.make("kit"))))),
    ],
    blocks: [],
    goals: [{ id: "kit", type: "made", at: "workshop", item: "kit", count: 1 }],
    look: "workshop",
    problems: [{ entity: "workshop", code: "wait.item", key: "missing" }],
    scaffold: { "c2-m030": program("c2-m030", (p) => p.workspace(p.start(...bill(p)))) },
    reference: {
      programs: {
        "c2-m030": program("c2-m030", (p) =>
          p.workspace(p.start(...bill(p), p.go("sawmill"), p.repeat(2, p.pickUp("plank")), p.go("workshop"), p.unload(), p.go("quarry"), p.pickUp("stone"), p.go("workshop"), p.unload())),
        ),
      },
    },
    budget: { wood: 6, stone: 3 },
    steps: 2000,
    milestone: true,
  },
];
