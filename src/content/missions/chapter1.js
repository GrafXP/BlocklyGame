import { robo } from "./island.js";
import { named, program } from "./write.js";

// Chapter 1, “Hello, Helper!” (docs/campaign-planv2.md): instructions, order,
// observing and repairing. Robo 1, the camp and the grove, the island's base;
// the camp receives its first wood. The child writes each program from the
// briefing, but for mission 4, a repair. What a mission holds is described in
// campaign.js.

// Program `id` of mission `n`, run by `who`, with the start block alone: a
// Build mission's focus program.
export const blank = (id, n, who) => named(id, n, who, program(id, (p) => p.workspace(p.start())));

export const CHAPTER_1 = [
  // A block tells a robot what to do: Go To, to the grove.
  {
    id: "c2-m001",
    workspace: "build",
    focus: "c2-m001",
    setup: { robots: { r1: { at: "camp", basket: {} } }, run: { r1: "c2-m001" } },
    programs: [blank("c2-m001", 1, robo(1))],
    blocks: ["robot_go_to"],
    goals: [{ id: "grove", type: "reached", robot: "r1", at: "grove" }],
    look: "r1",
    predict: "point",
    reference: { programs: { "c2-m001": program("c2-m001", (p) => p.workspace(p.start(p.go("grove")))) } },
    steps: 150,
  },
  // An action can change what a robot carries: one wood in the basket.
  {
    id: "c2-m002",
    workspace: "build",
    focus: "c2-m002",
    setup: { robots: { r1: { at: "grove", basket: {} } }, run: { r1: "c2-m002" } },
    programs: [blank("c2-m002", 2, robo(1))],
    blocks: ["robot_collect"],
    goals: [{ id: "wood", type: "holds", robot: "r1", item: "wood", count: 1 }],
    look: "r1",
    predict: true,
    reference: { programs: { "c2-m002": program("c2-m002", (p) => p.workspace(p.start(p.collect()))) } },
    budget: { wood: 1 },
    steps: 60,
  },
  // Instructions run from top to bottom: walk home before unloading.
  {
    id: "c2-m003",
    workspace: "build",
    focus: "c2-m003",
    setup: { robots: { r1: { at: "grove", basket: { wood: 1 } } }, run: { r1: "c2-m003" } },
    programs: [blank("c2-m003", 3, robo(1))],
    blocks: ["robot_unload"],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 1 }],
    look: "camp",
    predict: "point",
    reference: { programs: { "c2-m003": program("c2-m003", (p) => p.workspace(p.start(p.go("camp"), p.unload()))) } },
    steps: 120,
  },
  // Collect comes before the walk to the grove: step through, find it, move it.
  {
    id: "c2-m004",
    workspace: "repair",
    focus: "c2-m004",
    setup: { robots: { r1: { at: "camp", basket: {} } }, run: { r1: "c2-m004" } },
    programs: [named("c2-m004", 4, robo(1), program("c2-m004", (p) => p.workspace(p.start(p.collect(), p.go("grove"), p.go("camp"), p.unload()))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 1 }],
    look: "r1",
    problems: [{ entity: "r1", code: "error.notHere", key: "place" }],
    predict: true,
    reference: { programs: { "c2-m004": program("c2-m004", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.go("camp"), p.unload()))) } },
    budget: { wood: 1 },
    steps: 200,
  },
  // The whole job, from the briefing: no new block. One full load or two
  // trips of one both do it.
  {
    id: "c2-m005",
    workspace: "build",
    focus: "c2-m005",
    setup: { robots: { r1: { at: "camp", basket: {} } }, run: { r1: "c2-m005" } },
    programs: [blank("c2-m005", 5, robo(1))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 2 }],
    look: "camp",
    scaffold: { "c2-m005": program("c2-m005", (p) => p.workspace(p.start(p.go("grove"), p.collect()))) },
    reference: { programs: { "c2-m005": program("c2-m005", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.collect(), p.go("camp"), p.unload()))) } },
    budget: { wood: 2 },
    steps: 200,
    milestone: true,
  },
];
