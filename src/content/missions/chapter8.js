import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";
import { westBank } from "./chapter7.js";

// Chapter 8, “Energy for More Helpers” (docs/campaign-planv2.md): the fuel
// station makes charge packs from food and water, and the camp makes a new
// robot from planks and a pack, which its team gives its job. Food grows on the
// berry bushes as well as on the farm: it's one item. Robots need no pack to
// move; making one does. The child writes one program in each mission, the
// camp's or a helper's; everything else works already, and the island's robot
// limit leaves room for one more.

const camp = ref("entity.camp");
const station = ref("entity.station");
const woodTeam = ref("role.woodTeam");

// The new robot's job, on the wood team: two wood from the grove to the camp.
const woodJob = (id, n) => named(id, n, woodTeam, program(id, (p) => p.workspace(p.start(p.go("grove"), p.repeat(2, p.pickUp()), p.go("camp"), p.unload()))));
const team = (id) => [{ id: "wood-team", name: woodTeam, program: id }];
// One make, of `item`, by building `who`: a background job.
const makeOnce = (id, n, who, item) => named(id, n, who, program(id, (p) => p.workspace(p.start(p.make(item)))));
// The food and the water one batch of packs needs: two food from the berry
// bushes, then a bucket from the spring.
const packTrips = (p) => [p.go("berries"), p.repeat(2, p.pickUp("food")), p.go("station"), p.unload(), p.go("spring"), p.pickUp("water"), p.go("station"), p.unload()];

export const CHAPTER_8 = [
  // Two food and a water become two charge packs.
  {
    id: "c2-m036",
    workspace: "build",
    focus: "c2-m036",
    setup: westBank(["berries", "spring", "station"], { stock: { station: { food: 2, water: 1 } }, run: { station: "c2-m036" } }),
    programs: [blank("c2-m036", 36, station)],
    blocks: [],
    goals: [{ id: "packs", type: "made", at: "station", item: "pack", count: 2 }],
    look: "station",
    predict: "point",
    reference: { programs: { "c2-m036": program("c2-m036", (p) => p.workspace(p.start(p.make("pack")))) } },
    steps: 100,
  },
  // A recipe of three things, bigger than the basket: food on one trip, water
  // on another. The station knows its job.
  {
    id: "c2-m037",
    workspace: "build",
    focus: "c2-m037",
    setup: westBank(["berries", "spring", "station"], { run: { r1: "c2-m037", station: "c2-m037-station" } }),
    programs: [blank("c2-m037", 37, robo(1)), makeOnce("c2-m037-station", 37, station, "pack")],
    blocks: [],
    goals: [{ id: "packs", type: "made", at: "station", item: "pack", count: 2 }],
    look: "station",
    problems: [
      { entity: "r1", code: "wait.space", key: "full" },
      { entity: "station", code: "wait.item", key: "missing" },
    ],
    predict: true,
    reference: { programs: { "c2-m037": program("c2-m037", (p) => p.workspace(p.start(...packTrips(p)))) } },
    budget: { food: 2, water: 1 },
    steps: 600,
  },
  // The camp makes a robot: it pays two planks and a pack, and the new helper
  // does its team's job.
  {
    id: "c2-m038",
    workspace: "build",
    focus: "c2-m038",
    setup: westBank([], { limit: 2, stock: { camp: { plank: 2, pack: 1 } }, teams: team("c2-m038-wood"), run: { camp: "c2-m038" } }),
    programs: [blank("c2-m038", 38, camp), woodJob("c2-m038-wood", 38)],
    blocks: ["building_assemble"],
    goals: [{ id: "helper", type: "assembled", at: "camp", count: 1 }],
    look: "camp",
    predict: true,
    reference: { programs: { "c2-m038": program("c2-m038", (p) => p.workspace(p.start(p.assemble("wood-team")))) } },
    steps: 200,
  },
  // No packs: the camp waits to make its robot, and the station for food,
  // since the food collector looks for it at the grove. Robots work without
  // packs; only a new one needs one.
  {
    id: "c2-m039",
    workspace: "repair",
    focus: "c2-m039",
    setup: westBank(["berries", "spring", "station", "r2", "r3"], {
      limit: 4,
      stock: { camp: { plank: 2 } },
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} }, r3: { at: "camp", basket: {} } },
      teams: team("c2-m039-wood"),
      run: { r1: "c2-m039", r2: "c2-m039-water", r3: "c2-m039-packs", station: "c2-m039-station", camp: "c2-m039-camp" },
    }),
    programs: [
      named("c2-m039", 39, robo(1), program("c2-m039", (p) => p.workspace(p.start(p.go("grove"), p.repeat(2, p.pickUp("food")), p.go("station"), p.unload())))),
      named("c2-m039-water", 39, robo(2), program("c2-m039-water", (p) => p.workspace(p.start(p.go("spring"), p.pickUp("water"), p.go("station"), p.unload())))),
      named("c2-m039-packs", 39, robo(3), program("c2-m039-packs", (p) => p.workspace(p.start(p.go("station"), p.pickUp("pack"), p.go("camp"), p.unload())))),
      makeOnce("c2-m039-station", 39, station, "pack"),
      named("c2-m039-camp", 39, camp, program("c2-m039-camp", (p) => p.workspace(p.start(p.assemble("wood-team"))))),
      woodJob("c2-m039-wood", 39),
    ],
    blocks: [],
    goals: [{ id: "helper", type: "assembled", at: "camp", count: 1 }],
    look: "station",
    problems: [
      { entity: "r1", code: "error.notHere", key: "source" },
      { entity: "camp", code: "wait.item", key: "pack" },
    ],
    predict: true,
    reference: { programs: { "c2-m039": program("c2-m039", (p) => p.workspace(p.start(p.go("berries"), p.repeat(2, p.pickUp("food")), p.go("station"), p.unload()))) } },
    budget: { food: 2, water: 1 },
    steps: 1000,
  },
  // The whole chain, for one new robot: wood into planks, water into food,
  // food and water into packs; the child's helper brings the camp two planks
  // and a pack, waiting where they're still being made.
  {
    id: "c2-m040",
    workspace: "build",
    focus: "c2-m040",
    setup: westBank(["sawmill", "well", "farm", "station", "r2", "r3"], {
      limit: 4,
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} }, r3: { at: "camp", basket: {} } },
      teams: team("c2-m040-wood"),
      run: {
        r1: "c2-m040",
        r2: "c2-m040-collector",
        r3: "c2-m040-water",
        sawmill: "c2-m040-mill",
        well: "c2-m040-well",
        farm: "c2-m040-farm",
        station: "c2-m040-station",
        camp: "c2-m040-camp",
      },
    }),
    programs: [
      blank("c2-m040", 40, robo(1)),
      named("c2-m040-collector", 40, robo(2), program("c2-m040-collector", (p) => p.workspace(p.start(p.go("grove"), p.repeat(2, p.pickUp()), p.go("sawmill"), p.unload())))),
      named(
        "c2-m040-water",
        40,
        robo(3),
        program("c2-m040-water", (p) =>
          p.workspace(p.start(p.go("well"), p.pickUp("water"), p.go("farm"), p.unload(), p.go("well"), p.pickUp("water"), p.go("station"), p.unload(), p.go("farm"), p.repeat(2, p.pickUp("food")), p.go("station"), p.unload())),
        ),
      ),
      named("c2-m040-mill", 40, ref("entity.sawmill"), program("c2-m040-mill", (p) => p.workspace(p.start(p.repeat(2, p.make()))))),
      named("c2-m040-well", 40, ref("entity.well"), program("c2-m040-well", (p) => p.workspace(p.start(p.repeat(2, p.make("water")))))),
      makeOnce("c2-m040-farm", 40, ref("entity.farm"), "food"),
      makeOnce("c2-m040-station", 40, station, "pack"),
      named("c2-m040-camp", 40, camp, program("c2-m040-camp", (p) => p.workspace(p.start(p.assemble("wood-team"))))),
      woodJob("c2-m040-wood", 40),
    ],
    blocks: [],
    goals: [{ id: "helper", type: "assembled", at: "camp", count: 1 }],
    look: "camp",
    problems: [{ entity: "camp", code: "wait.item", key: "missing" }],
    predict: true,
    scaffold: { "c2-m040": program("c2-m040", (p) => p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp("plank")), p.go("camp"), p.unload()))) },
    reference: {
      programs: {
        "c2-m040": program("c2-m040", (p) =>
          p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp("plank")), p.go("camp"), p.unload(), p.go("station"), p.pickUp("pack"), p.go("camp"), p.unload())),
        ),
      },
    },
    budget: { wood: 2 },
    steps: 2000,
    milestone: true,
  },
];
