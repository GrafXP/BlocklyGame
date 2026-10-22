import { ref } from "../../i18n/index.js";
import { program } from "./write.js";
import { blank } from "./chapter1.js";
import { westBank } from "./chapter7.js";

// Chapter 13, “Meet the Guards” (docs/campaign-planv2.md): a guard, a robot
// with a shield and no basket, whose actions are short, so its program comes
// back to its conditions between them (src/sim/combat.js). Advance goes a few
// cells toward a place, or sends a pulse at an opponent near; Guard stays at a
// place and sends pulses at opponents near it, without chasing them; Go Home
// and Repair walks to the camp and makes the shield whole there, for free; and
// “my shield is low” is looked at as often as the program comes to it. The
// opponent is a practice visitor, landing on the beach at the north of the
// east bank: it follows its visit, and leaves. The rally flag stands south of
// the iron mine, the crossing at the bridge's west end.

const guard1 = ref("entity.guard", { n: 1 });

// The island after the bridge, with what mission `add` lists, Robo 1 at the
// camp, and the robots `rest` places.
export const guarded = (add, rest = {}) => westBank(add, { ...rest, robots: { r1: { at: "camp", basket: {} }, ...rest.robots } });

// A practice visitor's visit, its steps taken once (src/sim/script.js): a
// wait, a walk to a place, a Guard of a place `n` times, an Advance toward one
// `n` times, and home again, to its landing.
export const visit = (...steps) => ({ steps: steps.flat(), loop: false });
export const pause = (steps) => ({ type: "wait", steps });
export const walk = (target) => ({ type: "goTo", target });
export const watch = (target, n) => Array.from({ length: n }, () => ({ type: "guard", target }));
export const raid = (target, n) => Array.from({ length: n }, () => ({ type: "advance", target }));
export const leave = { type: "home" };

// A defender's job: protect `place`, going home to repair whenever the shield
// is low, and back again.
export const defend = (p, place) => p.forever(p.when(p.low(), [p.repair()], [p.guard(place)]));

export const CHAPTER_13 = [
  // A guard has its own job: Advance goes a few cells, then lets the next
  // block run; again and again, it gets there.
  {
    id: "c2-m061",
    workspace: "build",
    focus: "c2-m061",
    setup: guarded(["flag", "g1"], { run: { g1: "c2-m061" } }),
    programs: [blank("c2-m061", 61, guard1)],
    blocks: ["robot_advance"],
    goals: [{ id: "flag", type: "reached", robot: "g1", at: "flag" }],
    look: "flag",
    predict: "point",
    reference: { programs: { "c2-m061": program("c2-m061", (p) => p.workspace(p.start(p.forever(p.advance("flag"))))) } },
    steps: 400,
  },
  // Guard stays at its place, and sends pulses at a visitor near it.
  {
    id: "c2-m062",
    workspace: "build",
    focus: "c2-m062",
    setup: guarded(["crossing", "landing", "g1", "v1"], { run: { g1: "c2-m062" }, scripts: { v1: visit(pause(120), walk("crossing"), pause(30), leave) } }),
    programs: [blank("c2-m062", 62, guard1)],
    blocks: ["robot_guard"],
    goals: [{ id: "pulses", type: "hits", by: "g1", count: 2 }],
    look: "crossing",
    predict: true,
    reference: { programs: { "c2-m062": program("c2-m062", (p) => p.workspace(p.start(p.forever(p.guard("crossing"))))) } },
    steps: 400,
  },
  // Advance stops for a visitor on its way, and goes on once the way is
  // clear; Guard of the flag would walk past it.
  {
    id: "c2-m063",
    workspace: "build",
    focus: "c2-m063",
    setup: guarded(["flag", "landing", "g1", "v1"], { robots: { v1: { at: [22, 18], shield: 2 } }, run: { g1: "c2-m063" }, scripts: { v1: visit() } }),
    programs: [blank("c2-m063", 63, guard1)],
    blocks: [],
    goals: [{ id: "flag", type: "reached", robot: "g1", at: "flag", hits: 2 }],
    look: "v1",
    predict: true,
    reference: { programs: { "c2-m063": program("c2-m063", (p) => p.workspace(p.start(p.forever(p.advance("flag"))))) } },
    steps: 500,
  },
  // Go Home and Repair: the walk to the camp and the repair, one block, for
  // free.
  {
    id: "c2-m064",
    workspace: "build",
    focus: "c2-m064",
    setup: guarded(["flag", "g1"], { robots: { g1: { at: "flag", shield: 1 } }, run: { g1: "c2-m064" } }),
    programs: [blank("c2-m064", 64, guard1)],
    blocks: ["robot_repair"],
    goals: [{ id: "repaired", type: "repaired", robot: "g1", count: 1 }],
    look: "g1",
    predict: true,
    reference: { programs: { "c2-m064": program("c2-m064", (p) => p.workspace(p.start(p.repair()))) } },
    steps: 400,
  },
  // A visitor who sends pulses back: the guard protects the crossing while its
  // shield is good, repairs when it's low, and comes back.
  {
    id: "c2-m065",
    workspace: "build",
    focus: "c2-m065",
    setup: guarded(["crossing", "landing", "g1", "v1"], { run: { g1: "c2-m065" }, scripts: { v1: visit(pause(100), watch("crossing", 16), leave) } }),
    programs: [blank("c2-m065", 65, guard1)],
    blocks: ["sense_low"],
    goals: [{ id: "back", type: "reached", robot: "g1", at: "crossing", repairs: 1 }],
    look: "g1",
    predict: true,
    scaffold: { "c2-m065": program("c2-m065", (p) => p.workspace(p.start(p.forever(p.guard("crossing"))))) },
    reference: { programs: { "c2-m065": program("c2-m065", (p) => p.workspace(p.start(defend(p, "crossing")))) } },
    steps: 800,
    milestone: true,
  },
];
