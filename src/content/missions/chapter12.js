import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { program } from "./write.js";
import { blank } from "./chapter1.js";
import { westBank } from "./chapter7.js";
import { atCamp, job, trip } from "./chapter10.js";
import { smelts } from "./chapter11.js";

// Chapter 12, “Keep the Factory Flowing” (docs/campaign-planv2.md): Ready to
// Make, whether a building has every ingredient and room for its whole batch;
// a reserve kept in whole batches; water shared by three buildings; a long way
// for water, where a bucket on its way is coming, not missing; and a finished
// order of iron bars, kits and charge packs from the whole working island. The
// smelter stands built on its plot.

const smelter = ref("entity.smelter");
// The water for one batch of the smelter, from the well.
const bucket = (p) => trip(p, "well", "water", "smelter", 1);

export const CHAPTER_12 = [
  // Ready to Make: the smelter starts only once its water has come, and never
  // waits with its work begun.
  {
    id: "c2-m056",
    workspace: "build",
    focus: "c2-m056",
    setup: westBank(["well", "smelter", "r2"], {
      stock: { smelter: { ironOre: 2, charcoal: 1 }, well: { water: 1 } },
      robots: atCamp("r1", "r2"),
      run: { r2: "c2-m056-water", smelter: "c2-m056" },
    }),
    programs: [blank("c2-m056", 56, smelter), job("c2-m056-water", 56, robo(2), bucket)],
    blocks: ["sense_ready"],
    goals: [{ id: "iron", type: "made", at: "smelter", item: "iron", count: 2, noWait: true }],
    look: "smelter",
    predict: true,
    reference: { programs: { "c2-m056": program("c2-m056", (p) => p.workspace(p.start(p.until(p.ready("iron")), p.make("iron")))) } },
    steps: 300,
  },
  // A reserve of four bars, two at a time: the smelter looks at its own shelf
  // and makes a batch only when it's short. Robo 2 takes two away, once.
  {
    id: "c2-m057",
    workspace: "build",
    focus: "c2-m057",
    setup: westBank(["depot", "smelter", "r2"], {
      stock: { smelter: { ironOre: 6, charcoal: 3, water: 3, iron: 2 } },
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "smelter", basket: {} } },
      run: { r2: "c2-m057-courier", smelter: "c2-m057" },
    }),
    programs: [
      blank("c2-m057", 57, smelter),
      job("c2-m057-courier", 57, robo(2), (p) => [p.until(p.compare(p.stock("iron", "smelter"), "GTE", 4)), ...trip(p, "smelter", "iron", "depot")]),
    ],
    blocks: [],
    goals: [{ id: "reserve", type: "steady", at: "smelter", item: "iron", count: 4, ticks: 80, after: "r2" }],
    look: "smelter",
    predict: true,
    reference: { programs: { "c2-m057": program("c2-m057", (p) => p.workspace(p.start(p.forever(p.when(p.compare(p.stock("iron", "smelter"), "LT", 4), [p.make("iron")]))))) } },
    steps: 800,
  },
  // The farm's and the fuel station's water comes, but Robo 1 takes the
  // smelter's to the farm too.
  {
    id: "c2-m058",
    workspace: "repair",
    focus: "c2-m058",
    setup: westBank(["well", "farm", "station", "smelter", "r2", "r3"], {
      stock: { station: { food: 2 }, smelter: { ironOre: 2, charcoal: 1 } },
      robots: atCamp("r1", "r2", "r3"),
      run: { r1: "c2-m058", r2: "c2-m058-farm", r3: "c2-m058-station", well: "c2-m058-well", farm: "c2-m058-crops", station: "c2-m058-packs", smelter: "c2-m058-smelter" },
    }),
    programs: [
      job("c2-m058", 58, robo(1), (p) => trip(p, "well", "water", "farm", 1)),
      job("c2-m058-farm", 58, robo(2), (p) => trip(p, "well", "water", "farm", 1)),
      job("c2-m058-station", 58, robo(3), (p) => trip(p, "well", "water", "station", 1)),
      job("c2-m058-well", 58, ref("entity.well"), (p) => [p.repeat(3, p.make("water"))]),
      job("c2-m058-crops", 58, ref("entity.farm"), (p) => [p.make("food")]),
      job("c2-m058-packs", 58, ref("entity.station"), (p) => [p.make("pack")]),
      smelts("c2-m058-smelter", 58, 1),
    ],
    blocks: [],
    goals: [{ id: "iron", type: "made", at: "smelter", item: "iron", count: 2 }],
    look: "smelter",
    problems: [{ entity: "smelter", code: "wait.item", key: "water" }],
    predict: true,
    reference: { programs: { "c2-m058": program("c2-m058", (p) => p.workspace(p.start(...bucket(p)))) } },
    steps: 800,
  },
  // Water from the spring, far from the smelter: its order keeps two buckets,
  // for two batches, and a bucket on its way is coming, not missing.
  {
    id: "c2-m059",
    workspace: "build",
    focus: "c2-m059",
    setup: westBank(["spring", "smelter"], {
      stock: { smelter: { ironOre: 6, charcoal: 3 } },
      orders: { smelter: { water: 2 } },
      run: { r1: "c2-m059", smelter: "c2-m059-smelter" },
    }),
    programs: [blank("c2-m059", 59, robo(1)), smelts("c2-m059-smelter", 59, 3)],
    blocks: [],
    goals: [{ id: "iron", type: "made", at: "smelter", item: "iron", count: 6 }],
    look: "spring",
    problems: [{ entity: "smelter", code: "wait.item", key: "water" }],
    predict: true,
    reference: { programs: { "c2-m059": program("c2-m059", (p) => p.workspace(p.start(p.forever(p.supply("smelter", "spring"))))) } },
    budget: { water: 5 },
    steps: 1500,
  },
  // The depot's order: four iron bars, two kits and two charge packs, all made
  // fresh by the island's workers from raw resources. Robo 1 collects them,
  // waiting where they're still being made.
  {
    id: "c2-m060",
    workspace: "build",
    focus: "c2-m060",
    setup: westBank(["sawmill", "depot", "quarry", "workshop", "kiln", "mine", "well", "farm", "station", "smelter", "r2", "r3", "r4", "r5"], {
      orders: { depot: { iron: 4, kit: 2, pack: 2 } },
      robots: atCamp("r1", "r2", "r3", "r4", "r5"),
      run: {
        r1: "c2-m060",
        r2: "c2-m060-wood",
        r3: "c2-m060-iron",
        r4: "c2-m060-kits",
        r5: "c2-m060-food",
        sawmill: "c2-m060-mill",
        kiln: "c2-m060-burn",
        well: "c2-m060-well",
        farm: "c2-m060-crops",
        station: "c2-m060-packs",
        workshop: "c2-m060-workshop",
        smelter: "c2-m060-smelter",
      },
    }),
    programs: [
      blank("c2-m060", 60, robo(1)),
      job("c2-m060-wood", 60, robo(2), (p) => [p.repeat(2, ...trip(p, "grove", "wood", "sawmill")), ...trip(p, "grove", "wood", "kiln")]),
      job("c2-m060-iron", 60, robo(3), (p) => [p.repeat(2, ...trip(p, "mine", "ironOre", "smelter")), ...trip(p, "kiln", "charcoal", "smelter"), ...trip(p, "well", "water", "smelter")]),
      job("c2-m060-kits", 60, robo(4), (p) => [p.repeat(2, ...trip(p, "sawmill", "plank", "workshop")), ...trip(p, "quarry", "stone", "workshop")]),
      job("c2-m060-food", 60, robo(5), (p) => [...trip(p, "well", "water", "farm", 1), ...trip(p, "well", "water", "station", 1), ...trip(p, "farm", "food", "station")]),
      job("c2-m060-mill", 60, ref("entity.sawmill"), (p) => [p.repeat(4, p.make())]),
      job("c2-m060-burn", 60, ref("entity.kiln"), (p) => [p.make("charcoal")]),
      job("c2-m060-well", 60, ref("entity.well"), (p) => [p.repeat(4, p.make("water"))]),
      job("c2-m060-crops", 60, ref("entity.farm"), (p) => [p.make("food")]),
      job("c2-m060-packs", 60, ref("entity.station"), (p) => [p.make("pack")]),
      job("c2-m060-workshop", 60, ref("entity.workshop"), (p) => [p.repeat(2, p.make("kit"))]),
      smelts("c2-m060-smelter", 60, 2),
    ],
    blocks: [],
    goals: [{ id: "order", type: "order", to: "depot", items: { iron: 4, kit: 2, pack: 2 } }],
    look: "depot",
    problems: [{ entity: "r1", code: "wait.item", key: "waiting" }],
    predict: true,
    scaffold: { "c2-m060": program("c2-m060", (p) => p.workspace(p.start(p.repeat(2, ...trip(p, "smelter", "iron", "depot"))))) },
    reference: {
      programs: {
        "c2-m060": program("c2-m060", (p) =>
          p.workspace(p.start(p.repeat(2, ...trip(p, "smelter", "iron", "depot")), ...trip(p, "workshop", "kit", "depot"), ...trip(p, "station", "pack", "depot"))),
        ),
      },
    },
    budget: { wood: 6, stone: 2, ironOre: 4 },
    steps: 3000,
    milestone: true,
  },
];
