import { ref } from "../../i18n/index.js";
import { named } from "./chapter1.js";
import { robo } from "./island.js";
import { program } from "./write.js";

// Chapter 8, “Talk and Work Together” (docs/campaign-plan.md): a message from
// one program to another, a request and its reply, a team that waits for each
// other, and the whole island at work. A message is a note with a name, sent
// to one robot or building, in its inbox at the next step; a Wait For takes it
// (src/sim/messages.js). The island is ready to welcome visitors.

const bridge = ["site"];
const sawmill = ref("entity.sawmill");
const workshop = ref("entity.workshop");
const atCamp = (...ids) => Object.fromEntries(ids.map((id) => [id, { at: "camp", basket: {} }]));

// The workshop asks for a stone, waits for the reply, and makes a kit; twice.
// `first`: whether it asks before it waits, as it should.
const asking = (id, first = true) =>
  program(id, (p) => {
    const ask = p.send("stonePlease", "r3");
    const reply = p.waitFor("stoneDelivered");
    return p.workspace(p.start(p.repeat(2, ...(first ? [ask, reply] : [reply, ask]), p.make("kit"))));
  });
// Robo 3 waits for a request, brings a stone to the workshop, and, with
// `reply`, says so.
const answering = (id, reply = true) =>
  program(id, (p) => {
    const trip = [p.waitFor("stonePlease"), p.go("quarry"), p.collect("stone"), p.go("workshop"), p.unload()];
    return reply ? p.workspace(p.start(p.forever(...trip, p.send("stoneDelivered", "workshop")))) : p.workspace(p.start(p.forever(...trip)), p.loose(p.send("stoneDelivered", "workshop")));
  });

// The island's chain for kits, one kit's worth, as the rehearsal plans it:
// wood to the sawmill, two planks and a stone to the workshop, the kit to the
// depot; the sawmill and the workshop make what they can. `kits` is how many
// each robot's job does.
const chain = {
  wood: (id, kits = 1) => program(id, (p) => p.workspace(p.start(p.repeat(kits, p.go("grove"), p.repeat(2, p.collect()), p.go("sawmill"), p.unload())))),
  parts: (id, kits = 1) =>
    program(id, (p) => p.workspace(p.start(p.repeat(kits, p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload(), p.go("quarry"), p.collect("stone"), p.go("workshop"), p.unload())))),
  kits: (id, kits = 1) => program(id, (p) => p.workspace(p.start(p.repeat(kits, p.go("workshop"), p.pickUp("kit"), p.go("depot"), p.unload())))),
  planks: (id) => program(id, (p) => p.workspace(p.start(p.forever(p.make())))),
  making: (id) => program(id, (p) => p.workspace(p.start(p.forever(p.make("kit"))))),
};
const empty = { sawmill: { wood: 0, plank: 0 }, workshop: { plank: 0, stone: 0, kit: 0 } };

export const CHAPTER_8 = [
  // The sawmill tells Robo 2 that a plank is ready; Robo 2 waits for the note.
  {
    id: "m36",
    setup: { open: bridge, stock: { sawmill: { wood: 1, plank: 0 } }, robots: atCamp("r2"), run: { sawmill: "m36", r2: "m36-courier" } },
    programs: [
      named("m36", 36, sawmill, program("m36", (p) => p.workspace(p.start(p.make()), p.loose(p.send("plankReady", "r2"))))),
      named("m36-courier", 36, robo(2), program("m36-courier", (p) => p.workspace(p.start(p.waitFor("plankReady"), p.go("sawmill"), p.pickUp(), p.go("depot"), p.unload())))),
    ],
    blocks: ["message_send", "message_wait"],
    goals: [{ id: "depot", type: "delivered", to: "depot", item: "plank", count: 1 }],
    look: "sawmill",
    predict: true,
    reference: { programs: { m36: program("m36", (p) => p.workspace(p.start(p.make(), p.send("plankReady", "r2")))) } },
    steps: 400,
  },
  // A request and a reply: the workshop asks for a stone, Robo 3 brings it and
  // says it's there.
  {
    id: "m37",
    setup: { open: bridge, stock: { workshop: { plank: 4, stone: 0, kit: 0 } }, robots: atCamp("r3"), run: { workshop: "m37-kits", r3: "m37" } },
    programs: [named("m37", 37, robo(3), answering("m37", false)), named("m37-kits", 37, workshop, asking("m37-kits"))],
    blocks: [],
    goals: [{ id: "kits", type: "made", at: "workshop", item: "kit", count: 2 }],
    look: "r3",
    predict: true,
    reference: { programs: { m37: answering("m37") } },
    budget: { stone: 2 },
    steps: 1000,
  },
  // Everybody waits: the workshop waits for a reply before it asks. Ask first.
  {
    id: "m38",
    setup: { open: bridge, stock: { workshop: { plank: 4, stone: 0, kit: 0 } }, robots: atCamp("r3"), run: { workshop: "m38", r3: "m38-stones" } },
    programs: [named("m38", 38, workshop, asking("m38", false)), named("m38-stones", 38, robo(3), answering("m38-stones"))],
    blocks: [],
    goals: [{ id: "kits", type: "made", at: "workshop", item: "kit", count: 2 }],
    look: "workshop",
    problems: [{ entity: "workshop", code: "wait.message", key: "first" }],
    predict: true,
    reference: { programs: { m38: asking("m38") } },
    budget: { stone: 2 },
    steps: 1000,
  },
  // The rehearsal: three robots, three jobs, one kit at the depot. The jobs
  // are in Programs; the buildings run their own.
  {
    id: "m39",
    setup: { open: bridge, stock: { grove: { wood: 12 }, ...empty }, robots: atCamp("r1", "r2", "r3"), run: { sawmill: "m39-planks", workshop: "m39-kits" } },
    programs: [
      named("m39-wood", 39, ref("programName.woodSupplier"), chain.wood("m39-wood")),
      named("m39-parts", 39, ref("programName.partsCourier"), chain.parts("m39-parts")),
      named("m39-courier", 39, ref("programName.kitCourier"), chain.kits("m39-courier")),
      named("m39-planks", 39, ref("programName.planks"), chain.planks("m39-planks")),
      named("m39-kits", 39, ref("programName.kits"), chain.making("m39-kits")),
    ],
    blocks: [],
    goals: [{ id: "depot", type: "delivered", to: "depot", item: "kit", count: 1 }],
    look: "workshop",
    predict: true,
    reference: {
      commands: [
        { type: "assign", entity: "r1", program: "m39-wood" },
        { type: "assign", entity: "r2", program: "m39-parts" },
        { type: "assign", entity: "r3", program: "m39-courier" },
      ],
    },
    budget: { wood: 2, stone: 1 },
    steps: 900,
  },
  // The celebration: four kits, made from the island's own wood and stone,
  // twice: as planned, and with the kit courier starting far away.
  {
    id: "m40",
    setup: {
      open: bridge,
      stock: { grove: { wood: 12 }, quarry: { stone: 8 }, ...empty },
      robots: atCamp("r1", "r2", "r3"),
      run: { r1: "m40-wood", r2: "m40-parts", r3: "m40-courier", sawmill: "m40-planks", workshop: "m40-kits" },
    },
    trials: [
      { stage: { stock: { grove: { wood: 12 }, quarry: { stone: 8 }, ...empty }, robots: atCamp("r1", "r2", "r3") }, goals: [{ id: "kits", type: "delivered", to: "depot", item: "kit", count: 4 }] },
      {
        stage: { stock: { grove: { wood: 12 }, quarry: { stone: 8 }, ...empty }, robots: { ...atCamp("r1", "r2"), r3: { at: "grove", basket: {} } } },
        goals: [{ id: "kits", type: "delivered", to: "depot", item: "kit", count: 4 }],
      },
    ],
    programs: [
      named("m40-wood", 40, ref("programName.woodSupplier"), chain.wood("m40-wood")),
      named("m40-parts", 40, ref("programName.partsCourier"), chain.parts("m40-parts")),
      named("m40-courier", 40, ref("programName.kitCourier"), chain.kits("m40-courier")),
      named("m40-planks", 40, ref("programName.planks"), chain.planks("m40-planks")),
      named("m40-kits", 40, ref("programName.kits"), chain.making("m40-kits")),
    ],
    blocks: [],
    look: "depot",
    project: true,
    scaffold: { "m40-wood": chain.wood("m40-wood", 4) },
    reference: { programs: { "m40-wood": chain.wood("m40-wood", 4), "m40-parts": chain.parts("m40-parts", 4), "m40-courier": chain.kits("m40-courier", 4) } },
    budget: { wood: 16, stone: 8 },
    steps: 3000,
    milestone: true,
  },
];
