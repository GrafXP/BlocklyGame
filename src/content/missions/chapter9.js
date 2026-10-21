import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";
import { westBank } from "./chapter7.js";

// Chapter 9, “Supply What Is Needed” (docs/campaign-planv2.md): a building's
// order, what it wants on its shelf, and Supply, one delivery of what the order
// still needs, from the places the block lists, by the same walks, pick-ups and
// unloads a helper's own program would make (src/sim/supply.js). Then Needs,
// whether the order still wants something, and Space, the room a shelf has: a
// condition and a number, for a helper's own deliveries. One helper and one
// destination throughout; the buildings know their jobs.

const station = ref("entity.station");
const farm = ref("entity.farm");
// The fuel station's order: one batch of charge packs, two food and a water.
const BATCH = { station: { food: 2, water: 1 } };
// The station's job, `n` batches of packs, and the farm's, `n` of food.
const packs = (id, n, times) => named(id, n, station, program(id, (p) => p.workspace(p.start(times === 1 ? p.make("pack") : p.repeat(times, p.make("pack"))))));
const crops = (id, n, times) => named(id, n, farm, program(id, (p) => p.workspace(p.start(times === 1 ? p.make("food") : p.repeat(times, p.make("food"))))));
// A bucket from the well to the farm.
const bucket = (p) => [p.go("well"), p.pickUp("water"), p.go("farm"), p.unload()];

export const CHAPTER_9 = [
  // Supply makes one delivery of what the order still needs, from a place it
  // may look: here the farm's two food. The station's job waits, parked, so
  // the food's arrival is there to see; then it starts, as the reward.
  {
    id: "c2-m041",
    workspace: "build",
    focus: "c2-m041",
    setup: westBank(["farm", "station"], { stock: { farm: { food: 2 }, station: { water: 1 } }, orders: BATCH, run: { r1: "c2-m041", station: "c2-m041-station" }, parked: ["station"] }),
    programs: [blank("c2-m041", 41, robo(1)), packs("c2-m041-station", 41, 1)],
    blocks: ["robot_supply", "supply_from"],
    goals: [{ id: "food", type: "delivered", to: "station", item: "food", count: 2 }],
    reward: [{ type: "start", entity: "station" }],
    look: "station",
    predict: "point",
    reference: { programs: { "c2-m041": program("c2-m041", (p) => p.workspace(p.start(p.supply("station", "farm")))) } },
    steps: 300,
  },
  // Supply again and again: each trip brings what the order needs then, food
  // or water, and when nothing's needed it waits a moment and looks again.
  {
    id: "c2-m042",
    workspace: "build",
    focus: "c2-m042",
    setup: westBank(["farm", "well", "station"], { stock: { farm: { food: 4 }, well: { water: 2 } }, orders: BATCH, run: { r1: "c2-m042", station: "c2-m042-station" } }),
    programs: [blank("c2-m042", 42, robo(1)), packs("c2-m042-station", 42, 2)],
    blocks: [],
    goals: [{ id: "packs", type: "made", at: "station", item: "pack", count: 4 }],
    look: "station",
    predict: true,
    scaffold: { "c2-m042": program("c2-m042", (p) => p.workspace(p.start(p.supply("station", "farm", "well")))) },
    reference: { programs: { "c2-m042": program("c2-m042", (p) => p.workspace(p.start(p.forever(p.supply("station", "farm", "well"))))) } },
    steps: 1000,
  },
  // Needs asks whether the farm's order still wants a bucket: bring one only
  // then, and once the farm is done, its shelf holds just its order.
  {
    id: "c2-m043",
    workspace: "build",
    focus: "c2-m043",
    setup: westBank(["well", "farm"], { stock: { farm: { water: 1 } }, orders: { farm: { water: 1 } }, run: { r1: "c2-m043", well: "c2-m043-well", farm: "c2-m043-farm" } }),
    programs: [
      blank("c2-m043", 43, robo(1)),
      named("c2-m043-well", 43, ref("entity.well"), program("c2-m043-well", (p) => p.workspace(p.start(p.forever(p.make("water")))))),
      crops("c2-m043-farm", 43, 2),
    ],
    blocks: ["sense_needs"],
    goals: [{ id: "order", type: "steady", at: "farm", item: "water", count: 1, ticks: 30, after: "farm" }],
    look: "farm",
    predict: true,
    reference: { programs: { "c2-m043": program("c2-m043", (p) => p.workspace(p.start(p.forever(p.when(p.needs("farm", "water"), bucket(p)))))) } },
    steps: 800,
  },
  // Space says how much room a shelf has: wait at the camp until the farm has
  // room for a bucket, then bring it, and never wait at the farm.
  {
    id: "c2-m044",
    workspace: "build",
    focus: "c2-m044",
    setup: westBank(["well", "farm"], { stock: { well: { water: 1 }, farm: { water: 2 } }, run: { r1: "c2-m044", farm: "c2-m044-farm" } }),
    programs: [blank("c2-m044", 44, robo(1)), crops("c2-m044-farm", 44, 1)],
    blocks: ["sense_space"],
    goals: [{ id: "farm", type: "delivered", to: "farm", item: "water", by: "r1", count: 1, noWait: true }],
    look: "farm",
    predict: true,
    reference: { programs: { "c2-m044": program("c2-m044", (p) => p.workspace(p.start(p.until(p.compare(p.space("water", "farm"), "GT", 0)), ...bucket(p)))) } },
    steps: 400,
  },
  // A supplier that may look only at the farm brings food, and the station
  // waits for water: let it look at the well too.
  {
    id: "c2-m045",
    workspace: "repair",
    focus: "c2-m045",
    setup: westBank(["farm", "well", "station"], { stock: { farm: { food: 4 }, well: { water: 2 } }, orders: BATCH, run: { r1: "c2-m045", station: "c2-m045-station" } }),
    programs: [named("c2-m045", 45, robo(1), program("c2-m045", (p) => p.workspace(p.start(p.forever(p.supply("station", "farm")))))), packs("c2-m045-station", 45, 2)],
    blocks: [],
    goals: [{ id: "packs", type: "made", at: "station", item: "pack", count: 4 }],
    look: "r1",
    problems: [
      { entity: "r1", code: "supply.none", key: "water" },
      { entity: "station", code: "wait.item", key: "missing" },
    ],
    predict: true,
    reference: { programs: { "c2-m045": program("c2-m045", (p) => p.workspace(p.start(p.forever(p.supply("station", "farm", "well"))))) } },
    steps: 1000,
    milestone: true,
  },
];
