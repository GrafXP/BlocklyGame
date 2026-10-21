import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";

// Chapter 2, “Do It Again” (docs/campaign-planv2.md): Repeat, what goes inside
// a loop, the basket's two spaces, and a loop inside a loop. Reliable
// deliveries reach the camp. The child writes 6 and 7; 8 and 10 are repairs,
// and 9 changes a working program.

const atCamp = (id) => ({ robots: { r1: { at: "camp", basket: {} } }, run: { r1: id } });
// One trip from the camp to the grove and back, collecting `take` times.
const trip = (p, take = 1) => [p.go("grove"), ...(take === 1 ? [p.collect()] : [p.repeat(take, p.collect())]), p.go("camp"), p.unload()];

export const CHAPTER_2 = [
  // Repeat does what's inside it a number of times: two Collects in one.
  {
    id: "c2-m006",
    workspace: "build",
    focus: "c2-m006",
    setup: { robots: { r1: { at: "grove", basket: {} } }, run: { r1: "c2-m006" } },
    programs: [blank("c2-m006", 6, robo(1))],
    blocks: ["controls_repeat_ext"],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 2 }],
    look: "r1",
    predict: true,
    reference: { programs: { "c2-m006": program("c2-m006", (p) => p.workspace(p.start(p.repeat(2, p.collect()), p.go("camp"), p.unload()))) } },
    budget: { wood: 2 },
    steps: 120,
  },
  // A loop can repeat a whole trip: three trips to the camp, each ending with
  // an unload. One piece a trip is enough; what counts is the trips.
  {
    id: "c2-m007",
    workspace: "build",
    focus: "c2-m007",
    setup: atCamp("c2-m007"),
    programs: [blank("c2-m007", 7, robo(1))],
    blocks: [],
    goals: [{ id: "trips", type: "trips", by: "r1", to: "camp", count: 3 }],
    look: "camp",
    predict: true,
    scaffold: { "c2-m007": program("c2-m007", (p) => p.workspace(p.start(...trip(p)))) },
    reference: { programs: { "c2-m007": program("c2-m007", (p) => p.workspace(p.start(p.repeat(3, ...trip(p))))) } },
    budget: { wood: 3 },
    steps: 400,
  },
  // Three Collects before unloading: the third waits for room in the basket.
  {
    id: "c2-m008",
    workspace: "repair",
    focus: "c2-m008",
    setup: atCamp("c2-m008"),
    programs: [named("c2-m008", 8, robo(1), program("c2-m008", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.collect(), p.collect(), p.collect(), p.go("camp"), p.unload())))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 4 }],
    look: "r1",
    problems: [{ entity: "r1", code: "wait.space", key: "full" }],
    predict: true,
    reference: { programs: { "c2-m008": program("c2-m008", (p) => p.workspace(p.start(p.repeat(2, ...trip(p, 2))))) } },
    budget: { wood: 4 },
    steps: 400,
  },
  // A loop inside a loop: the two trips bring one piece each; make each bring
  // a full basket. As it starts, two pieces arrive in loads of one, which
  // isn't the goal (docs/campaign-planv2.md, “Corrections made in this review”).
  {
    id: "c2-m009",
    workspace: "change",
    focus: "c2-m009",
    setup: atCamp("c2-m009"),
    programs: [named("c2-m009", 9, robo(1), program("c2-m009", (p) => p.workspace(p.start(p.repeat(2, ...trip(p))))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 4, load: 2 }],
    look: "r1",
    predict: true,
    reference: { programs: { "c2-m009": program("c2-m009", (p) => p.workspace(p.start(p.repeat(2, ...trip(p, 2))))) } },
    budget: { wood: 4 },
    steps: 400,
  },
  // The walk home is after the loop, so the basket fills and the robot waits:
  // move it inside. Exactly three deliveries, with nothing more on its way.
  {
    id: "c2-m010",
    workspace: "repair",
    focus: "c2-m010",
    setup: atCamp("c2-m010"),
    programs: [named("c2-m010", 10, robo(1), program("c2-m010", (p) => p.workspace(p.start(p.repeat(3, p.go("grove"), p.collect()), p.go("camp"), p.unload()))))],
    blocks: [],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 3, exact: true }],
    look: "r1",
    problems: [{ entity: "r1", code: "wait.space", key: "full" }],
    reference: { programs: { "c2-m010": program("c2-m010", (p) => p.workspace(p.start(p.repeat(3, ...trip(p))))) } },
    budget: { wood: 3 },
    steps: 500,
    milestone: true,
  },
];
