import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";
import { westBank } from "./chapter7.js";

// Chapter 10, “Materials for Industry” (docs/campaign-planv2.md): stone
// blocks, cut from raw stone at the stonecutter, which aren't stone; the
// smelter's construction site, whose bill takes them where the workshop's takes
// stone; charcoal, burnt from wood at the kiln; and wood shared between the
// sawmill and the kiln. The stonecutter arrives by the stone pit, the kiln and
// the smelter's plot in the south of the west bank. The child writes one
// program in each mission; the rest works already.

const site = ref("entity.smelterSite");
const kiln = ref("entity.kiln");

// Robots `ids` at the camp, with empty baskets.
export const atCamp = (...ids) => Object.fromEntries(ids.map((id) => [id, { at: "camp", basket: {} }]));
// A delivery: to `from`, `n` pick-ups of `item`, to `to`, and unload.
export const trip = (p, from, item, to, n = 2) => [p.go(from), n === 1 ? p.pickUp(item) : p.repeat(n, p.pickUp(item)), p.go(to), p.unload()];
// Building `who`'s job, made of `blocks(p)`.
export const job = (id, n, who, blocks) => named(id, n, who, program(id, (p) => p.workspace(p.start(...blocks(p)))));
// The smelter's site's job: build the smelter, once its bill is there.
const builder = (id, n) => job(id, n, site, (p) => [p.build("smelter")]);
// The smelter's bill, from the sawmill and the stonecutter: two loads of
// planks, then one of stone blocks.
const bill = (p) => [p.repeat(2, ...trip(p, "sawmill", "plank", "smelter")), ...trip(p, "stonecutter", "block", "smelter")];

export const CHAPTER_10 = [
  // Two raw stones become one stone block: a new item, not stone.
  {
    id: "c2-m046",
    workspace: "build",
    focus: "c2-m046",
    setup: westBank(["quarry", "stonecutter"], { stock: { stonecutter: { stone: 2 } }, run: { stonecutter: "c2-m046" } }),
    programs: [blank("c2-m046", 46, ref("entity.stonecutter"))],
    blocks: [],
    goals: [{ id: "block", type: "made", at: "stonecutter", item: "block", count: 1 }],
    look: "stonecutter",
    predict: true,
    reference: { programs: { "c2-m046": program("c2-m046", (p) => p.workspace(p.start(p.make("block")))) } },
    steps: 100,
  },
  // The smelter's site takes stone blocks, not stone: Robo 1 brings them from
  // the stonecutter, while Robo 2 brings the planks and the site builds.
  {
    id: "c2-m047",
    workspace: "build",
    focus: "c2-m047",
    setup: westBank(["sawmill", "quarry", "stonecutter", "r2"], {
      plots: ["smelter"],
      stock: { sawmill: { plank: 4 }, stonecutter: { block: 2 } },
      robots: atCamp("r1", "r2"),
      run: { r1: "c2-m047", r2: "c2-m047-planks", smelter: "c2-m047-site" },
    }),
    programs: [blank("c2-m047", 47, robo(1)), job("c2-m047-planks", 47, robo(2), (p) => [p.repeat(2, ...trip(p, "sawmill", "plank", "smelter"))]), builder("c2-m047-site", 47)],
    blocks: [],
    goals: [{ id: "smelter", type: "constructed", blueprint: "smelter" }],
    look: "smelter",
    problems: [
      { entity: "r1", code: "wait.space", key: "stone" },
      { entity: "smelter", code: "wait.item", key: "missing" },
    ],
    predict: "point",
    reference: { programs: { "c2-m047": program("c2-m047", (p) => p.workspace(p.start(...trip(p, "stonecutter", "block", "smelter")))) } },
    steps: 1000,
  },
  // One batch at the kiln: two wood become two charcoal.
  {
    id: "c2-m048",
    workspace: "build",
    focus: "c2-m048",
    setup: westBank(["kiln"], { stock: { kiln: { wood: 2 } }, run: { kiln: "c2-m048" } }),
    programs: [blank("c2-m048", 48, kiln)],
    blocks: [],
    goals: [{ id: "charcoal", type: "made", at: "kiln", item: "charcoal", count: 2 }],
    look: "kiln",
    predict: true,
    reference: { programs: { "c2-m048": program("c2-m048", (p) => p.workspace(p.start(p.make("charcoal")))) } },
    steps: 100,
  },
  // Both collectors take their wood to the kiln, and the sawmill waits: Robo
  // 1's share belongs at the sawmill.
  {
    id: "c2-m049",
    workspace: "repair",
    focus: "c2-m049",
    setup: westBank(["sawmill", "kiln", "r2"], {
      robots: atCamp("r1", "r2"),
      run: { r1: "c2-m049", r2: "c2-m049-kiln", sawmill: "c2-m049-mill", kiln: "c2-m049-burn" },
    }),
    programs: [
      job("c2-m049", 49, robo(1), (p) => trip(p, "grove", "wood", "kiln")),
      job("c2-m049-kiln", 49, robo(2), (p) => trip(p, "grove", "wood", "kiln")),
      job("c2-m049-mill", 49, ref("entity.sawmill"), (p) => [p.repeat(2, p.make())]),
      job("c2-m049-burn", 49, kiln, (p) => [p.make("charcoal")]),
    ],
    blocks: [],
    goals: [{ id: "planks", type: "made", at: "sawmill", item: "plank", count: 2 }],
    look: "sawmill",
    problems: [{ entity: "sawmill", code: "wait.item", key: "wood" }],
    predict: true,
    reference: { programs: { "c2-m049": program("c2-m049", (p) => p.workspace(p.start(...trip(p, "grove", "wood", "sawmill")))) } },
    budget: { wood: 4 },
    steps: 600,
  },
  // The industrial corner: the smelter built from its bill, then its first
  // two charcoal. Robo 2 and Robo 3 gather wood and stone, the sawmill, the
  // stonecutter and the kiln make the pieces, and the site builds; Robo 1
  // brings everything to the smelter, waiting where it's still being made.
  {
    id: "c2-m050",
    workspace: "build",
    focus: "c2-m050",
    setup: westBank(["sawmill", "quarry", "stonecutter", "kiln", "r2", "r3"], {
      plots: ["smelter"],
      robots: atCamp("r1", "r2", "r3"),
      run: { r1: "c2-m050", r2: "c2-m050-wood", r3: "c2-m050-stone", sawmill: "c2-m050-mill", stonecutter: "c2-m050-cutter", kiln: "c2-m050-burn", smelter: "c2-m050-site" },
    }),
    programs: [
      blank("c2-m050", 50, robo(1)),
      job("c2-m050-wood", 50, robo(2), (p) => [p.repeat(2, ...trip(p, "grove", "wood", "sawmill")), ...trip(p, "grove", "wood", "kiln")]),
      job("c2-m050-stone", 50, robo(3), (p) => [p.repeat(2, ...trip(p, "quarry", "stone", "stonecutter"))]),
      job("c2-m050-mill", 50, ref("entity.sawmill"), (p) => [p.repeat(4, p.make())]),
      job("c2-m050-cutter", 50, ref("entity.stonecutter"), (p) => [p.repeat(2, p.make("block"))]),
      job("c2-m050-burn", 50, kiln, (p) => [p.make("charcoal")]),
      builder("c2-m050-site", 50),
    ],
    blocks: [],
    goals: [{ id: "charcoal", type: "delivered", to: "smelter", item: "charcoal", count: 2 }],
    look: "smelter",
    problems: [
      { entity: "r1", code: "wait.space", key: "built" },
      { entity: "smelter", code: "wait.item", key: "missing" },
    ],
    predict: true,
    scaffold: { "c2-m050": program("c2-m050", (p) => p.workspace(p.start(...bill(p)))) },
    reference: { programs: { "c2-m050": program("c2-m050", (p) => p.workspace(p.start(...bill(p), ...trip(p, "kiln", "charcoal", "smelter")))) } },
    budget: { wood: 6, stone: 4 },
    steps: 2000,
    milestone: true,
  },
];
