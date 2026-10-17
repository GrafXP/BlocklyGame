import { ref } from "../../i18n/index.js";
import { named } from "./chapter1.js";
import { robo } from "./island.js";
import { program } from "./write.js";

// Chapter 6, “Remember the Job” (docs/campaign-plan.md): variables, changing
// values, a countdown, and memories that are each robot's own. A variable is a
// named piece of a robot's memory that holds a number (PLAN.md §7); the
// overview shows it beside the robot as it runs. The team fulfils counted
// orders.
//
// Every trip here is the familiar one: from the grove to the camp, one wood at
// a time, so each delivery is one step of the count.

const bridge = ["site"];
const wood = { grove: { wood: 12 } };
const atCamp = (...ids) => Object.fromEntries(ids.map((id) => [id, { at: "camp", basket: {} }]));

// One wood from the grove to the camp.
const trip = (p) => [p.go("grove"), p.collect(), p.go("camp"), p.unload()];

export const CHAPTER_6 = [
  // A remembered number counts a Repeat: the order is three.
  {
    id: "m26",
    setup: { open: bridge, stock: wood, robots: atCamp("r1"), run: { r1: "m26" } },
    programs: [
      named(
        "m26",
        26,
        robo(1),
        program("m26", (p) => {
          const order = p.variable("order");
          return p.workspace(p.start(p.set(order, 3), p.repeat(1, ...trip(p))), p.loose(p.get(order)));
        }),
      ),
    ],
    blocks: ["variables_set", "variables_get"],
    goals: [{ id: "camp", type: "delivered", to: "camp", item: "wood", count: 3, exact: true }],
    look: "r1",
    predict: true,
    reference: {
      programs: {
        m26: program("m26", (p) => {
          const order = p.variable("order");
          return p.workspace(p.start(p.set(order, 3), p.repeat(p.get(order), ...trip(p))));
        }),
      },
    },
    budget: { wood: 3 },
    steps: 500,
  },
  // Count each delivery as it's finished: after the unload.
  {
    id: "m27",
    setup: { open: bridge, stock: wood, robots: atCamp("r1"), run: { r1: "m27" } },
    programs: [
      named(
        "m27",
        27,
        robo(1),
        program("m27", (p) => {
          const delivered = p.variable("delivered");
          return p.workspace(p.start(p.set(delivered, 0), p.repeat(3, ...trip(p))), p.loose(p.change(delivered, 1)));
        }),
      ),
    ],
    blocks: ["math_change"],
    goals: [
      { id: "camp", type: "delivered", to: "camp", item: "wood", count: 3 },
      { id: "count", type: "remembers", robot: "r1", count: 3 },
    ],
    look: "r1",
    predict: true,
    reference: {
      programs: {
        m27: program("m27", (p) => {
          const delivered = p.variable("delivered");
          return p.workspace(p.start(p.set(delivered, 0), p.repeat(3, ...trip(p), p.change(delivered, 1))));
        }),
      },
    },
    budget: { wood: 3 },
    steps: 500,
  },
  // A countdown: three to deliver, one fewer after each, then wait for more.
  {
    id: "m28",
    setup: { open: bridge, stock: wood, robots: atCamp("r1"), run: { r1: "m28" } },
    programs: [
      named(
        "m28",
        28,
        robo(1),
        program("m28", (p) => {
          const remaining = p.variable("remaining");
          return p.workspace(p.start(p.set(remaining, 3), p.forever(p.until(p.compare(p.get(remaining), "GT", 0)), ...trip(p))), p.loose(p.change(remaining, -1)));
        }),
      ),
    ],
    blocks: [],
    goals: [{ id: "camp", type: "steady", at: "camp", item: "wood", count: 3, ticks: 80 }],
    look: "r1",
    predict: true,
    reference: {
      programs: {
        m28: program("m28", (p) => {
          const remaining = p.variable("remaining");
          return p.workspace(p.start(p.set(remaining, 3), p.forever(p.until(p.compare(p.get(remaining), "GT", 0)), ...trip(p), p.change(remaining, -1))));
        }),
      },
    },
    budget: { wood: 3 },
    steps: 700,
  },
  // One program for two robots, and each counts its own deliveries.
  {
    id: "m29",
    setup: { open: bridge, stock: wood, robots: { r1: { at: "camp", basket: {} }, r3: { at: "depot", basket: {} } } },
    programs: [
      named(
        "m29",
        29,
        ref("programName.counter"),
        program("m29", (p) => {
          const delivered = p.variable("delivered");
          return p.workspace(p.start(p.set(delivered, 0), p.repeat(2, ...trip(p), p.change(delivered, 1))));
        }),
      ),
    ],
    blocks: [],
    goals: [
      { id: "camp", type: "delivered", to: "camp", item: "wood", count: 4 },
      { id: "r1", type: "remembers", robot: "r1", count: 2 },
      { id: "r3", type: "remembers", robot: "r3", count: 2 },
    ],
    look: "r3",
    predict: true,
    reference: {
      commands: [
        { type: "assign", entity: "r1", program: "m29" },
        { type: "assign", entity: "r3", program: "m29" },
      ],
    },
    budget: { wood: 4 },
    steps: 700,
  },
  // The counter forgets: it's set to 0 inside the loop. Three deliveries, a
  // count of one; move the Set before the loop.
  {
    id: "m30",
    setup: { open: bridge, stock: wood, robots: atCamp("r1"), run: { r1: "m30" } },
    programs: [
      named(
        "m30",
        30,
        robo(1),
        program("m30", (p) => {
          const delivered = p.variable("delivered");
          return p.workspace(p.start(p.repeat(3, p.set(delivered, 0), ...trip(p), p.change(delivered, 1))));
        }),
      ),
    ],
    blocks: [],
    goals: [
      { id: "camp", type: "delivered", to: "camp", item: "wood", count: 3 },
      { id: "count", type: "remembers", robot: "r1", count: 3 },
    ],
    look: "r1",
    reference: {
      programs: {
        m30: program("m30", (p) => {
          const delivered = p.variable("delivered");
          return p.workspace(p.start(p.set(delivered, 0), p.repeat(3, ...trip(p), p.change(delivered, 1))));
        }),
      },
    },
    budget: { wood: 3 },
    steps: 500,
    milestone: true,
  },
];
