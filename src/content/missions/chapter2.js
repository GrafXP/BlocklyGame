import { named } from "./chapter1.js";
import { robo } from "./island.js";
import { program } from "./write.js";

// Chapter 2, “Do It Again” (docs/campaign-plan.md): Repeat, loop bodies,
// basket limits and a small nested loop. Regular deliveries reach the camp.

const atCamp = (n, wood) => ({ stock: { grove: { wood: 12 } }, robots: { r1: { at: "camp", basket: {} } }, room: { camp: { wood } }, run: { r1: n } });

export const CHAPTER_2 = [
  // One Repeat collects two pieces; the walk home follows the loop.
  {
    id: "m06",
    setup: { stock: { grove: { wood: 12 } }, robots: { r1: { at: "grove", basket: {} } }, room: { camp: { wood: 2 } }, run: { r1: "m06" } },
    programs: [named("m06", 6, robo(1), program("m06", (p) => p.workspace(p.start(p.repeat(2), p.go("camp"), p.unload()), p.loose(p.collect()))))],
    blocks: ["controls_repeat_ext"],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 2 }],
    look: "r1",
    predict: true,
    reference: { programs: { m06: program("m06", (p) => p.workspace(p.start(p.repeat(2, p.collect()), p.go("camp"), p.unload()))) } },
    budget: { wood: 2 },
    steps: 120,
  },
  // A whole trip, repeated: one piece at a time.
  {
    id: "m07",
    setup: atCamp("m07", 3),
    programs: [named("m07", 7, robo(1), program("m07", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.go("camp"), p.unload()), p.loose(p.repeat(3)))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 3 }],
    look: "camp",
    predict: true,
    reference: { programs: { m07: program("m07", (p) => p.workspace(p.start(p.repeat(3, p.go("grove"), p.collect(), p.go("camp"), p.unload())))) } },
    budget: { wood: 3 },
    steps: 400,
  },
  // Three Collects before unloading: the third waits for room in the basket.
  {
    id: "m08",
    setup: atCamp("m08", 4),
    programs: [named("m08", 8, robo(1), program("m08", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.collect(), p.collect(), p.collect(), p.go("camp"), p.unload())))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 4 }],
    look: "r1",
    problems: [{ entity: "r1", code: "wait.space", key: "full" }],
    predict: true,
    reference: { programs: { m08: program("m08", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.collect(), p.collect(), p.go("camp"), p.unload())))) } },
    budget: { wood: 4 },
    steps: 400,
  },
  // A Repeat inside a Repeat: two pieces on each of two trips.
  {
    id: "m09",
    setup: atCamp("m09", 4),
    programs: [named("m09", 9, robo(1), program("m09", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.go("camp"), p.unload())), p.loose(p.repeat(2)), p.loose(p.collect()))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 4, load: 2 }],
    look: "r1",
    predict: true,
    reference: { programs: { m09: program("m09", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.repeat(2, p.collect()), p.go("camp"), p.unload())))) } },
    budget: { wood: 4 },
    steps: 400,
  },
  // The walk home is after the loop, so the basket fills and the robot waits:
  // move it inside. Exactly three deliveries, with nothing more on its way.
  {
    id: "m10",
    setup: atCamp("m10", 3),
    programs: [named("m10", 10, robo(1), program("m10", (p) => p.workspace(p.start(p.repeat(3, p.go("grove"), p.collect()), p.go("camp"), p.unload()))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 3, exact: true }],
    look: "r1",
    problems: [{ entity: "r1", code: "wait.space", key: "full" }],
    project: true,
    reference: { programs: { m10: program("m10", (p) => p.workspace(p.start(p.repeat(3, p.go("grove"), p.collect(), p.go("camp"), p.unload())))) } },
    budget: { wood: 3 },
    steps: 500,
    milestone: true,
  },
];
