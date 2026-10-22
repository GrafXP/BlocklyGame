import { ref } from "../../i18n/index.js";
import { robo } from "./island.js";
import { named, program } from "./write.js";
import { blank } from "./chapter1.js";
import { westBank } from "./chapter7.js";
import { defend, guarded, leave, pause, raid, visit, walk, watch } from "./chapter13.js";

// Chapter 14, “Back to Work Safely” (docs/campaign-planv2.md): a robot whose
// shield is gone is knocked out, and reboots at the camp, its job kept, which
// it starts again from its start (src/sim/combat.js); the workshop makes a
// guard from a kit, an iron bar and a charge pack, for the team whose job it
// takes; each guard protects the place its own job names; a helper that looks
// for danger between its deliveries, and goes home while an opponent is near;
// and a guard that keeps a visitor from the water route. The child writes one
// program in each mission, but in 66, which they watch.

const guard1 = ref("entity.guard", { n: 1 });
const guard2 = ref("entity.guard", { n: 2 });
const defenders = ref("role.defenders");
// A job of one block's actions, again and again: `blocks(p)`, for `who`.
const always = (id, n, who, blocks) => named(id, n, who, program(id, (p) => p.workspace(p.start(p.forever(...blocks(p))))));

export const CHAPTER_14 = [
  // Knocked out is not gone: the guard reboots at the camp, and its job, kept,
  // starts again from its start. Nothing to write: watch it come back.
  {
    id: "c2-m066",
    workspace: "explore",
    focus: null,
    watch: true,
    setup: guarded(["crossing", "g1"], { rebooting: ["g1"], run: { g1: "c2-m066" } }),
    programs: [named("c2-m066", 66, guard1, program("c2-m066", (p) => p.workspace(p.start(defend(p, "crossing")))))],
    blocks: [],
    goals: [{ id: "back", type: "reached", robot: "g1", at: "crossing" }],
    look: "g1",
    predict: true,
    reference: {},
    steps: 300,
  },
  // The workshop makes a guard: a kit, an iron bar and a charge pack, and the
  // Defenders' job is the new guard's.
  {
    id: "c2-m067",
    workspace: "build",
    focus: "c2-m067",
    setup: guarded(["workshop", "crossing"], {
      limit: 2,
      stock: { workshop: { kit: 1, iron: 1, pack: 1 } },
      teams: [{ id: "defenders", name: defenders, program: "c2-m067-defender" }],
      run: { workshop: "c2-m067" },
    }),
    programs: [
      blank("c2-m067", 67, ref("entity.workshop")),
      named("c2-m067-defender", 67, defenders, program("c2-m067-defender", (p) => p.workspace(p.start(defend(p, "crossing"))))),
    ],
    blocks: [],
    goals: [{ id: "guard", type: "assembled", at: "workshop", count: 1 }],
    look: "workshop",
    predict: true,
    reference: { programs: { "c2-m067": program("c2-m067", (p) => p.workspace(p.start(p.assemble("defenders", "guard")))) } },
    steps: 200,
  },
  // Two guards, two jobs: Guard 1 protects the camp; Guard 2's own job is the
  // crossing, where the visitor comes.
  {
    id: "c2-m068",
    workspace: "build",
    focus: "c2-m068",
    setup: guarded(["crossing", "landing", "g1", "g2", "v1"], {
      run: { g1: "c2-m068-camp", g2: "c2-m068" },
      scripts: { v1: visit(pause(120), walk("crossing"), pause(30), leave) },
    }),
    programs: [blank("c2-m068", 68, guard2), always("c2-m068-camp", 68, guard1, (p) => [p.guard("camp")])],
    blocks: [],
    goals: [{ id: "pulses", type: "hits", by: "g2", count: 2 }],
    look: "crossing",
    predict: "point",
    reference: { programs: { "c2-m068": program("c2-m068", (p) => p.workspace(p.start(p.forever(p.guard("crossing"))))) } },
    steps: 400,
  },
  // A helper looks for danger between its deliveries: while the visitor is
  // near, it goes home, and brings the water again once the visitor has left.
  {
    id: "c2-m069",
    workspace: "build",
    focus: "c2-m069",
    setup: westBank(["well", "depot", "landing", "v1"], {
      stock: { well: { water: 2 } },
      orders: { depot: { water: 8 } },
      robots: { v1: { at: [22, 15] } },
      run: { r1: "c2-m069", well: "c2-m069-well" },
      scripts: { v1: visit(walk("depot"), pause(90), watch("depot", 25), leave) },
    }),
    programs: [blank("c2-m069", 69, robo(1)), always("c2-m069-well", 69, ref("entity.well"), (p) => [p.make("water")])],
    blocks: ["sense_danger"],
    goals: [{ id: "water", type: "delivered", to: "depot", item: "water", by: "r1", count: 8, safe: "r1" }],
    look: "v1",
    predict: true,
    scaffold: { "c2-m069": program("c2-m069", (p) => p.workspace(p.start(p.forever(p.supply("depot", "well"))))) },
    reference: { programs: { "c2-m069": program("c2-m069", (p) => p.workspace(p.start(p.forever(p.when(p.danger(), [p.repair()], [p.supply("depot", "well")]))))) } },
    steps: 1200,
  },
  // A visitor comes over the bridge for the well. A guard at the crossing
  // stops it there, and Robo 1's water gets to the smelter, which makes two
  // batches of iron; without one, the visitor reaches the water route.
  {
    id: "c2-m070",
    workspace: "build",
    focus: "c2-m070",
    setup: guarded(["well", "smelter", "crossing", "landing", "g1", "v1"], {
      stock: { smelter: { ironOre: 4, charcoal: 2 } },
      robots: { v1: { shield: 2 } },
      run: { r1: "c2-m070-water", well: "c2-m070-well", smelter: "c2-m070-smelter", g1: "c2-m070" },
      scripts: { v1: visit(pause(40), raid("well", 40), leave) },
    }),
    programs: [
      blank("c2-m070", 70, guard1),
      always("c2-m070-water", 70, robo(1), (p) => [p.go("well"), p.pickUp("water"), p.go("smelter"), p.unload()]),
      always("c2-m070-well", 70, ref("entity.well"), (p) => [p.make("water")]),
      named("c2-m070-smelter", 70, ref("entity.smelter"), program("c2-m070-smelter", (p) => p.workspace(p.start(p.repeat(2, p.make("iron")))))),
    ],
    blocks: [],
    goals: [{ id: "iron", type: "made", at: "smelter", item: "iron", count: 4, safe: "r1" }],
    look: "crossing",
    predict: "point",
    reference: { programs: { "c2-m070": program("c2-m070", (p) => p.workspace(p.start(defend(p, "crossing")))) } },
    steps: 600,
    milestone: true,
  },
];
