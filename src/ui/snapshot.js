import { evaluate, Fault } from "../programming/expressions.js";
import { latest, programDoc } from "../programming/programs.js";
import { programOf } from "../programming/runtime.js";
import { reasonOf, statusOf } from "../sim/world.js";

// The debugger's snapshot of a tick (PLAN.md §8, "Every program is
// observable"): what every execution view shows, worked out once from the world
// after a frame's ticks, so the labels, the overview, the editor's marks and
// Programs Together all show the same tick, never a mix. It's plain data and
// never changes: a view keeps it to draw again (a workspace scrolled, a panel
// opened) without asking the world, which may have moved on.
//
//   { tick, stall, entities: [entry, …], programs: [{ id, revision, newest, runners }, …] }
//   entry = { id, kind, state, reason, program, revision, block, fresh, round, readings,
//             memory, inside, inbox, listens }
//
// - state, reason: statusOf's word and why it waits or stopped (a code).
// - program, revision: the program it runs, or null; block: its active block's
//   id; fresh: whether it evaluated that block in this tick.
// - round: inside a Repeat, the innermost one's { block, count, times }.
// - readings: what its active block read, when it read it in this tick: each
//   sense's number, each comparison's true or false, and each setting's place
//   or item id, by block id. Only the conditions read so far count: an If's
//   after the first that held weren't.
//   The world after the tick is what the block read during it, since all that
//   follows the runtimes in a tick is actions starting, which hold what they'll
//   take rather than take it (src/sim/world.js). A Repeat's count, a Set's or
//   Change's number and what a use of one's own block gives count too.
// - memory: its program's variables, [{ id, name, value }], each as it is now
//   (PLAN.md §11 Phase 8: live values beside each entity).
// - inside: the blocks of the player's own it's inside, [{ call, routine }],
//   innermost last: the block that used it and its definition's block.
// - inbox: the messages sent to it and not yet taken, [{ message, from, sent }];
//   listens: whether its program has a Wait For, so its inbox is worth showing
//   even when it's empty.
// - programs: every program that something runs, with the revision it runs,
//   the newest applied (newer while an Apply waits for the next tick), and the
//   ids of what runs it.
export function takeSnapshot(world, library) {
  return {
    tick: world.tick,
    stall: world.stall ? { ...world.stall } : null,
    entities: world.entities.map((e) => entryOf(world, e)),
    programs: world.programs
      .map((p) => ({
        id: p.id,
        revision: p.revision,
        newest: (library && programDoc(library, p.id) && latest(programDoc(library, p.id)).revision) ?? p.revision,
        runners: world.entities.filter((e) => e.runtime?.kind === "program" && e.runtime.program === p.id).map((e) => e.id),
      }))
      .filter((p) => p.runners.length),
  };
}

function entryOf(world, entity) {
  const run = entity.runtime?.kind === "program" ? entity.runtime : null;
  const fresh = !!run?.evaluated && run.evaluated.tick === world.tick && run.block === run.evaluated.block;
  const loop = run?.loops.at(-1);
  const program = run ? programOf(world, run.program) : null;
  return {
    id: entity.id,
    kind: entity.kind,
    state: statusOf(entity),
    reason: reasonOf(entity),
    program: run?.program ?? null,
    revision: run?.revision ?? null,
    block: run?.block ?? null,
    fresh,
    round: loop && program ? { block: program.code[loop.at].block, count: loop.count, times: loop.times } : null,
    readings: fresh && program ? readingsOf(world, entity, program.code.find((ins) => ins.block === run.block)) : {},
    memory: (program?.variables ?? []).map((v) => ({ id: v.id, name: v.name, value: run.vars?.[v.id] ?? 0 })),
    inside: (run?.frames ?? []).map((f) => ({ call: f.call, routine: f.routine })),
    inbox: (entity.inbox ?? []).map((m) => ({ ...m })),
    listens: !!program?.code.some((ins) => ins.op === "receive"),
  };
}

// What instruction `ins` reads: its conditions, as it evaluates them.
function readingsOf(world, entity, ins) {
  const readings = {};
  const read = (expr) => {
    let value;
    try {
      value = evaluate(expr, entity, world);
    } catch (e) {
      if (e instanceof Fault) return null;
      throw e;
    }
    if (!["number", "place", "item"].includes(expr.op)) readings[expr.block] = value;
    if (expr.op === "compare") {
      read(expr.a);
      read(expr.b);
    }
    return value;
  };
  if (ins?.op === "until") read(ins.test);
  if (ins?.op === "if") for (const { test } of ins.branches) if (read(test)) break;
  if (ins?.op === "act") for (const arg of Object.values(ins.args ?? {})) read(arg);
  if (ins?.op === "repeat") read(ins.times);
  if (ins?.op === "set") read(ins.value);
  if (ins?.op === "change") read(ins.by);
  // What a use gives its block's input was worked out in the frame it was
  // used from, the one under the block's own now.
  if (ins?.op === "call") {
    const frames = entity.runtime.frames ?? [];
    const caller = { ...entity, runtime: { ...entity.runtime, frames: frames.slice(0, -1) } };
    for (const { value } of ins.args) {
      try {
        const v = evaluate(value, caller, world);
        if (!["number", "place", "item"].includes(value.op)) readings[value.block] = v;
      } catch (e) {
        if (!(e instanceof Fault)) throw e;
      }
    }
  }
  return readings;
}

// Snapshot `snapshot`'s entry for entity `id`, or null.
export const entryIn = (snapshot, id) => snapshot.entities.find((e) => e.id === id) ?? null;
