import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { program } from "./write.js";

// Chapter 1, “Hello, Helper!” (docs/campaign-plan.md): instructions, order,
// testing, and fixing one mistake. Robo 1, the camp and the grove; the camp
// gets its first supplies. What a mission holds is described in campaign.js.

// Program `id` of mission `n`, run by `who` (a name), as the library names it:
// “Mission 3: Robo 1”.
export const named = (id, n, who, source) => ({ id, name: ref("programName.mission", { n, name: who }), source });

export const CHAPTER_1 = [
  // Robo 1 walks to the grove: a block tells a robot what to do.
  {
    id: "m01",
    setup: { stock: { grove: { wood: 12 } }, robots: { r1: { at: "camp", basket: {} } }, run: { r1: "m01" } },
    programs: [named("m01", 1, robo(1), program("m01", (p) => p.workspace(p.start())))],
    blocks: ["robot_go_to"],
    goals: [{ id: "grove", type: "reached", robot: "r1", at: "grove" }],
    look: "r1",
    predict: "point",
    reference: { programs: { m01: program("m01", (p) => p.workspace(p.start(p.go("grove")))) } },
    steps: 150,
  },
  // At the grove, Collect puts one wood in the basket.
  {
    id: "m02",
    setup: { robots: { r1: { at: "grove", basket: {} } }, run: { r1: "m02" } },
    programs: [named("m02", 2, robo(1), program("m02", (p) => p.workspace(p.start())))],
    blocks: ["robot_collect"],
    goals: [{ id: "wood", type: "holds", robot: "r1", item: "wood", count: 1 }],
    look: "r1",
    predict: true,
    reference: { programs: { m02: program("m02", (p) => p.workspace(p.start(p.collect()))) } },
    budget: { wood: 1 },
    steps: 60,
  },
  // Travel before unloading: instructions run from top to bottom.
  {
    id: "m03",
    setup: { robots: { r1: { at: "grove", basket: { wood: 1 } } }, room: { camp: { wood: 1 } }, run: { r1: "m03" } },
    programs: [named("m03", 3, robo(1), program("m03", (p) => p.workspace(p.start(), p.loose(p.unload()), p.loose(p.go("camp")))))],
    blocks: ["robot_unload"],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 1 }],
    look: "camp",
    predict: "point",
    reference: { programs: { m03: program("m03", (p) => p.workspace(p.start(p.go("camp"), p.unload()))) } },
    steps: 120,
  },
  // Collect comes before the walk to the grove: find it, and move it.
  {
    id: "m04",
    setup: { stock: { grove: { wood: 12 } }, robots: { r1: { at: "camp", basket: {} } }, room: { camp: { wood: 1 } }, run: { r1: "m04" } },
    programs: [named("m04", 4, robo(1), program("m04", (p) => p.workspace(p.start(p.collect(), p.go("grove"), p.go("camp"), p.unload()))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 1 }],
    look: "r1",
    problems: [{ entity: "r1", code: "error.notHere", key: "place" }],
    predict: true,
    reference: { programs: { m04: program("m04", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.go("camp"), p.unload()))) } },
    budget: { wood: 1 },
    steps: 200,
  },
  // The whole job, made by the child: no new block.
  {
    id: "m05",
    setup: { stock: { grove: { wood: 12 } }, robots: { r1: { at: "camp", basket: {} } }, room: { camp: { wood: 2 } }, run: { r1: "m05" } },
    programs: [named("m05", 5, robo(1), program("m05", (p) => p.workspace(p.start())))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 2 }],
    look: "camp",
    project: true,
    scaffold: { m05: program("m05", (p) => p.workspace(p.start(p.go("grove"), p.collect()))) },
    reference: { programs: { m05: program("m05", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.collect(), p.go("camp"), p.unload()))) } },
    budget: { wood: 2 },
    steps: 200,
    milestone: true,
  },
];
