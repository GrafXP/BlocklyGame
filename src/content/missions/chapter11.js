import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { program } from "./write.js";
import { blank } from "./chapter1.js";
import { westBank } from "./chapter7.js";
import { atCamp, job, trip } from "./chapter10.js";

// Chapter 11, “From Ore to Iron” (docs/campaign-planv2.md): iron ore, dug at
// the iron mine across the stream; the smelter's recipe, two ore, a charcoal
// and a bucket of water together for two iron bars; one supplier for its three
// ingredients; a shortage followed upstream to its cause; and a small iron
// works from raw resources. The smelter stands built on its plot.

const smelter = ref("entity.smelter");
// The smelter's order: one batch of iron, two ore, a charcoal and a water.
export const BATCH = { smelter: { ironOre: 2, charcoal: 1, water: 1 } };
// The smelter's job, `times` batches of iron.
export const smelts = (id, n, times) => job(id, n, smelter, (p) => [times === 1 ? p.make("iron") : p.repeat(times, p.make("iron"))]);
// Supply the smelter from the mine, the kiln and the well.
const supplier = (p) => [p.forever(p.supply("smelter", "mine", "kiln", "well"))];

export const CHAPTER_11 = [
  // Ore is dug at the mine, a basket space each, like stone at the stone pit.
  {
    id: "c2-m051",
    workspace: "build",
    focus: "c2-m051",
    setup: westBank(["mine", "smelter"], { run: { r1: "c2-m051" } }),
    programs: [blank("c2-m051", 51, robo(1))],
    blocks: [],
    goals: [{ id: "ore", type: "delivered", to: "smelter", item: "ironOre", count: 2 }],
    look: "mine",
    predict: "point",
    reference: { programs: { "c2-m051": program("c2-m051", (p) => p.workspace(p.start(...trip(p, "mine", "ironOre", "smelter")))) } },
    budget: { ironOre: 2 },
    steps: 400,
  },
  // All four ingredients go into one batch at once, and two bars come out.
  {
    id: "c2-m052",
    workspace: "build",
    focus: "c2-m052",
    setup: westBank(["mine", "kiln", "well", "smelter"], { stock: { smelter: { ironOre: 2, charcoal: 1, water: 1 } }, run: { smelter: "c2-m052" } }),
    programs: [blank("c2-m052", 52, smelter)],
    blocks: [],
    goals: [{ id: "iron", type: "made", at: "smelter", item: "iron", count: 2 }],
    look: "smelter",
    predict: "point",
    reference: { programs: { "c2-m052": program("c2-m052", (p) => p.workspace(p.start(p.make("iron")))) } },
    steps: 150,
  },
  // One supplier for three ingredients from three places: the mine's ore, the
  // kiln's charcoal and the well's water, a load at a time.
  {
    id: "c2-m053",
    workspace: "build",
    focus: "c2-m053",
    setup: westBank(["mine", "kiln", "well", "smelter"], { stock: { kiln: { charcoal: 2 }, well: { water: 2 } }, orders: BATCH, run: { r1: "c2-m053", smelter: "c2-m053-smelter" } }),
    programs: [blank("c2-m053", 53, robo(1)), smelts("c2-m053-smelter", 53, 2)],
    blocks: [],
    goals: [{ id: "iron", type: "made", at: "smelter", item: "iron", count: 4 }],
    look: "smelter",
    problems: [
      { entity: "r1", code: "supply.none", key: "where" },
      { entity: "smelter", code: "wait.item", key: "missing" },
    ],
    predict: true,
    scaffold: { "c2-m053": program("c2-m053", (p) => p.workspace(p.start(p.supply("smelter", "mine")))) },
    reference: { programs: { "c2-m053": program("c2-m053", (p) => p.workspace(p.start(...supplier(p)))) } },
    budget: { ironOre: 4 },
    steps: 1500,
  },
  // The smelter waits for charcoal, the kiln for wood, and the wood goes to
  // the sawmill: repair the cause, upstream, not the smelter.
  {
    id: "c2-m054",
    workspace: "repair",
    focus: "c2-m054",
    setup: westBank(["sawmill", "kiln", "mine", "well", "smelter", "r2", "r3"], {
      stock: { well: { water: 1 } },
      robots: atCamp("r1", "r2", "r3"),
      run: { r1: "c2-m054", r2: "c2-m054-ore", r3: "c2-m054-charcoal", kiln: "c2-m054-burn", smelter: "c2-m054-smelter" },
    }),
    programs: [
      job("c2-m054", 54, robo(1), (p) => trip(p, "grove", "wood", "sawmill")),
      job("c2-m054-ore", 54, robo(2), (p) => [...trip(p, "mine", "ironOre", "smelter"), ...trip(p, "well", "water", "smelter", 1)]),
      job("c2-m054-charcoal", 54, robo(3), (p) => trip(p, "kiln", "charcoal", "smelter", 1)),
      job("c2-m054-burn", 54, ref("entity.kiln"), (p) => [p.make("charcoal")]),
      smelts("c2-m054-smelter", 54, 1),
    ],
    blocks: [],
    goals: [{ id: "iron", type: "made", at: "smelter", item: "iron", count: 2 }],
    look: "smelter",
    problems: [
      { entity: "kiln", code: "wait.item", key: "wood" },
      { entity: "smelter", code: "wait.item", key: "missing" },
    ],
    predict: true,
    reference: { programs: { "c2-m054": program("c2-m054", (p) => p.workspace(p.start(...trip(p, "grove", "wood", "kiln")))) } },
    budget: { wood: 2, ironOre: 2 },
    steps: 800,
  },
  // Four iron bars from the island's raw resources to the depot: Robo 2 brings
  // the kiln its wood, the well draws water, the kiln and the smelter work, and
  // Robo 3 takes the bars away; Robo 1 supplies the smelter.
  {
    id: "c2-m055",
    workspace: "build",
    focus: "c2-m055",
    setup: westBank(["depot", "kiln", "mine", "well", "smelter", "r2", "r3"], {
      orders: BATCH,
      robots: atCamp("r1", "r2", "r3"),
      run: { r1: "c2-m055", r2: "c2-m055-wood", r3: "c2-m055-bars", kiln: "c2-m055-burn", well: "c2-m055-well", smelter: "c2-m055-smelter" },
    }),
    programs: [
      blank("c2-m055", 55, robo(1)),
      job("c2-m055-wood", 55, robo(2), (p) => trip(p, "grove", "wood", "kiln")),
      job("c2-m055-bars", 55, robo(3), (p) => [p.repeat(2, ...trip(p, "smelter", "iron", "depot"))]),
      job("c2-m055-burn", 55, ref("entity.kiln"), (p) => [p.make("charcoal")]),
      job("c2-m055-well", 55, ref("entity.well"), (p) => [p.repeat(2, p.make("water"))]),
      smelts("c2-m055-smelter", 55, 2),
    ],
    blocks: [],
    goals: [{ id: "bars", type: "delivered", to: "depot", item: "iron", count: 4 }],
    look: "smelter",
    problems: [{ entity: "smelter", code: "wait.item", key: "missing" }],
    predict: true,
    reference: { programs: { "c2-m055": program("c2-m055", (p) => p.workspace(p.start(...supplier(p)))) } },
    // The order is the smelter's shelf, not its job: while the second batch is
    // made, the supplier fills it with a third batch's ore, and stops there.
    budget: { wood: 2, ironOre: 6 },
    steps: 2000,
    milestone: true,
  },
];
