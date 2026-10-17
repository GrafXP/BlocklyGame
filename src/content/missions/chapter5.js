import { ref } from "../../i18n/index.js";
import { named } from "./chapter1.js";
import { program } from "./write.js";

// Chapter 5, “Give Everyone a Job” (docs/campaign-plan.md): shared programs,
// settings, one edit that reaches everyone, an individual copy, and a recipe
// of three pieces. Phase 6's tools come one by one: the program library and
// teams from mission 21, settings from 22. The workshop makes its first kits.
//
// Robo 1 and Robo 3 are the Collectors from mission 22 on. Their settings
// carry on from one mission to the next; a mission played on its own, or after
// settings left unchosen, starts them at the grove's wood and the stone pit's
// stone, both for the depot.

const bridge = ["site"];
const both = { r1: { at: "camp", basket: {} }, r3: { at: "camp", basket: {} } };
const collectors = (program) => [{ id: "collectors", name: ref("role.collectors"), program }];
const configured = {
  r1: { source: "grove", item: "wood", destination: "depot" },
  r3: { source: "quarry", item: "stone", destination: "depot" },
};
const supplies = { grove: { wood: 12 }, quarry: { stone: 8 } };

// One trip from my source to my destination with my item; `take` is how many
// times it collects.
const trip = (p, take) => [p.go(p.mine("source")), take === 1 ? p.collect(p.mine("item")) : p.repeat(take, p.collect(p.mine("item"))), p.go(p.mine("destination")), p.unload()];

export const CHAPTER_5 = [
  // One program for two robots: give it to the Stone team, and both run it.
  {
    id: "m21",
    setup: {
      open: bridge,
      stock: supplies,
      robots: both,
      room: { depot: { stone: 4 } },
      teams: [{ id: "stone-team", name: ref("role.stoneTeam"), program: null }],
      roles: { r1: "stone-team", r3: "stone-team" },
    },
    programs: [
      named("m21", 21, ref("programName.stones"), program("m21", (p) => p.workspace(p.start(p.repeat(2, p.go("quarry"), p.collect("stone"), p.go("depot"), p.unload()))))),
    ],
    blocks: [],
    tools: ["library"],
    goals: [
      { id: "r1", type: "delivered", to: "depot", item: "stone", by: "r1", count: 2 },
      { id: "r3", type: "delivered", to: "depot", item: "stone", by: "r3", count: 2 },
    ],
    look: "r3",
    predict: true,
    reference: { commands: [{ type: "default", role: "stone-team", program: "m21" }] },
    budget: { stone: 4 },
    steps: 800,
  },
  // The same program, two jobs: each robot's settings say where it fetches
  // from, what, and where it takes it.
  {
    id: "m22",
    setup: {
      open: bridge,
      stock: supplies,
      robots: both,
      room: { depot: { wood: 2, stone: 2 } },
      settings: Object.fromEntries(["r1", "r3"].map((r) => [r, { source: null, item: null, destination: null }])),
      teams: collectors("m22"),
      roles: { r1: "collectors", r3: "collectors" },
    },
    programs: [named("m22", 22, ref("programName.fetch"), program("m22", (p) => p.workspace(p.start(p.repeat(2, ...trip(p, 1))))))],
    blocks: ["setting_source", "setting_item", "setting_destination"],
    tools: ["library", "settings"],
    goals: [
      { id: "wood", type: "delivered", to: "depot", item: "wood", count: 2 },
      { id: "stone", type: "delivered", to: "depot", item: "stone", count: 2 },
    ],
    look: "r1",
    predict: true,
    reference: { commands: Object.entries(configured).map(([entity, settings]) => ({ type: "settings", entity, settings })) },
    budget: { wood: 2, stone: 2 },
    steps: 800,
  },
  // One edit for everyone who runs the program: two pieces on each trip.
  {
    id: "m23",
    setup: {
      open: bridge,
      stock: supplies,
      robots: both,
      room: { depot: { wood: 2, stone: 2 } },
      defaultSettings: configured,
      teams: collectors("m23"),
      roles: { r1: "collectors", r3: "collectors" },
    },
    programs: [named("m23", 23, ref("programName.fetch"), program("m23", (p) => p.workspace(p.start(...trip(p, 1)))))],
    blocks: [],
    tools: ["library", "settings"],
    goals: ["r1", "r3"].map((by) => ({ id: by, type: "delivered", to: "depot", by, count: 2, load: 2 })),
    look: "r1",
    predict: true,
    reference: { programs: { m23: program("m23", (p) => p.workspace(p.start(...trip(p, 2)))) } },
    budget: { wood: 2, stone: 2 },
    steps: 600,
  },
  // A copy for one: Robo 3 makes one trip and stops, while Robo 1 goes on
  // with the shared program.
  {
    id: "m24",
    setup: {
      open: bridge,
      stock: supplies,
      robots: both,
      room: { depot: { wood: 8, stone: 8 } },
      defaultSettings: configured,
      teams: collectors("m24"),
      roles: { r1: "collectors", r3: "collectors" },
    },
    programs: [named("m24", 24, ref("programName.fetch"), program("m24", (p) => p.workspace(p.start(p.forever(...trip(p, 2))))))],
    blocks: [],
    tools: ["library", "settings"],
    goals: [
      { id: "r3", type: "trips", by: "r3", count: 1, exact: true },
      { id: "r1", type: "trips", by: "r1", count: 2 },
    ],
    look: "r3",
    predict: true,
    reference: {
      programs: { "m24-r3": program("m24", (p) => p.workspace(p.start(...trip(p, 2)))) },
      commands: [{ type: "assign", entity: "r3", program: "m24-r3" }],
    },
    budget: { wood: 8, stone: 8 },
    steps: 900,
  },
  // The workshop's recipe: four planks and two stone make two kits. Robots
  // bring them; a basket holds two, so it takes more than one trip.
  {
    id: "m25",
    setup: {
      open: bridge,
      add: ["workshop"],
      stock: { sawmill: { wood: 0, plank: 4 }, quarry: { stone: 8 }, workshop: { plank: 0, stone: 0, kit: 0 } },
      robots: { r1: { at: "camp", basket: {} }, r2: { at: "camp", basket: {} }, r3: { at: "camp", basket: {} } },
      run: { workshop: "m25-kits" },
    },
    programs: [
      named("m25-planks", 25, ref("programName.courier"), program("m25-planks", (p) => p.workspace(p.start(p.repeat(2, p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("depot"), p.unload()))))),
      named("m25-stones", 25, ref("programName.stones"), program("m25-stones", (p) => p.workspace(p.start(p.go("quarry"), p.repeat(2, p.collect("stone")), p.go("depot"), p.unload())))),
      named("m25-kits", 25, ref("programName.kits"), program("m25-kits", (p) => p.workspace(p.start(p.repeat(2, p.make("kit")))))),
    ],
    blocks: [],
    tools: ["library", "settings"],
    goals: [{ id: "kits", type: "made", at: "workshop", item: "kit", count: 2 }],
    look: "workshop",
    project: true,
    reference: {
      programs: {
        "m25-planks": program("m25-planks", (p) => p.workspace(p.start(p.repeat(2, p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload())))),
        "m25-stones": program("m25-stones", (p) => p.workspace(p.start(p.go("quarry"), p.repeat(2, p.collect("stone")), p.go("workshop"), p.unload()))),
      },
      commands: [
        { type: "assign", entity: "r2", program: "m25-planks" },
        { type: "assign", entity: "r3", program: "m25-stones" },
      ],
    },
    budget: { stone: 2 },
    steps: 900,
    milestone: true,
    unlocks: "sandbox",
  },
];
