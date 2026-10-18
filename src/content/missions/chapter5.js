import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";

// Chapter 5, “One Helper, Useful Jobs” (docs/campaign-planv2.md): stone
// across the bridge, two kinds of things in one basket, the kit's recipe, and
// one helper bringing a recipe bigger than its basket in stages. No team,
// setting or copy: those wait for chapter 17. The workshop makes its first
// kits, and the sandbox opens.

const workshop = ref("entity.workshop");
// The island after the bridge, with what else mission `add` lists.
const bridged = (add, rest) => ({ add: ["site", "quarry", ...add], open: ["site"], robots: { r1: { at: "camp", basket: {} } }, ...rest });
// Program `id` of mission `n`, the workshop's job: `count` kits, one after
// another.
const kits = (id, n, count) => named(id, n, workshop, program(id, (p) => p.workspace(p.start(count === 1 ? p.make("kit") : p.repeat(count, p.make("kit"))))));
// One kit's ingredients to the workshop: two planks from the sawmill, then a
// stone from the pit.
const kitTrips = (p) => [p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload(), p.go("quarry"), p.collect("stone"), p.go("workshop"), p.unload()];

export const CHAPTER_5 = [
  // The familiar trip, for another raw material: stone, across the stream.
  {
    id: "c2-m021",
    workspace: "build",
    focus: "c2-m021",
    setup: bridged([], { run: { r1: "c2-m021" } }),
    programs: [blank("c2-m021", 21, robo(1))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "stone", count: 2 }],
    look: "quarry",
    predict: "point",
    reference: { programs: { "c2-m021": program("c2-m021", (p) => p.workspace(p.start(p.go("quarry"), p.repeat(2, p.collect("stone")), p.go("camp"), p.unload()))) } },
    budget: { stone: 2 },
    steps: 400,
  },
  // Different things share the basket's two spaces: one wood and one stone,
  // home together in one load.
  {
    id: "c2-m022",
    workspace: "build",
    focus: "c2-m022",
    setup: bridged([], { run: { r1: "c2-m022" } }),
    programs: [blank("c2-m022", 22, robo(1))],
    blocks: [],
    goals: [
      { id: "wood", type: "delivered", to: "camp", item: "wood", by: "r1", count: 1, exact: true },
      { id: "stone", type: "delivered", to: "camp", item: "stone", by: "r1", count: 1, exact: true },
      { id: "together", type: "delivered", to: "camp", by: "r1", count: 2, load: 2 },
    ],
    look: "r1",
    predict: true,
    reference: { programs: { "c2-m022": program("c2-m022", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.go("quarry"), p.collect("stone"), p.go("camp"), p.unload()))) } },
    budget: { wood: 1, stone: 1 },
    steps: 500,
  },
  // A recipe of two kinds: two planks and a stone make a kit.
  {
    id: "c2-m023",
    workspace: "build",
    focus: "c2-m023",
    setup: { add: ["site", "quarry", "workshop"], open: ["site"], stock: { workshop: { plank: 2, stone: 1 } }, run: { workshop: "c2-m023" } },
    programs: [blank("c2-m023", 23, workshop)],
    blocks: [],
    goals: [{ id: "kit", type: "made", at: "workshop", item: "kit", count: 1 }],
    look: "workshop",
    predict: "point",
    reference: { programs: { "c2-m023": program("c2-m023", (p) => p.workspace(p.start(p.make("kit")))) } },
    steps: 100,
  },
  // A recipe bigger than the basket, brought in stages by one helper: two
  // planks on one trip, the stone on another. The workshop knows its job.
  {
    id: "c2-m024",
    workspace: "build",
    focus: "c2-m024",
    setup: bridged(["sawmill", "workshop"], { stock: { sawmill: { plank: 2 } }, run: { r1: "c2-m024", workshop: "c2-m024-kit" } }),
    programs: [blank("c2-m024", 24, robo(1)), kits("c2-m024-kit", 24, 1)],
    blocks: [],
    goals: [{ id: "kit", type: "made", at: "workshop", item: "kit", count: 1 }],
    look: "workshop",
    problems: [{ entity: "workshop", code: "wait.item", key: "missing" }],
    predict: true,
    reference: { programs: { "c2-m024": program("c2-m024", (p) => p.workspace(p.start(...kitTrips(p)))) } },
    budget: { stone: 1 },
    steps: 600,
  },
  // Two kits' worth: the same round twice, or the loads grouped another way.
  {
    id: "c2-m025",
    workspace: "build",
    focus: "c2-m025",
    setup: bridged(["sawmill", "workshop"], { stock: { sawmill: { plank: 4 } }, run: { r1: "c2-m025", workshop: "c2-m025-kits" } }),
    programs: [blank("c2-m025", 25, robo(1)), kits("c2-m025-kits", 25, 2)],
    blocks: [],
    goals: [{ id: "kits", type: "made", at: "workshop", item: "kit", count: 2 }],
    look: "workshop",
    problems: [{ entity: "workshop", code: "wait.item", key: "missing" }],
    scaffold: { "c2-m025": program("c2-m025", (p) => p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload()))) },
    reference: { programs: { "c2-m025": program("c2-m025", (p) => p.workspace(p.start(p.repeat(2, ...kitTrips(p))))) } },
    budget: { stone: 2 },
    steps: 1200,
    milestone: true,
    unlocks: "sandbox",
  },
];
