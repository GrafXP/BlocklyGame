import { checkProgram } from "../programming/runtime.js";
import { walkable } from "./navigation.js";
import { GOALS } from "./objectives.js";

// The rules a world keeps after every tick (PLAN.md §12), for the tests and for
// checking a loaded save later. Returns what's broken, for a developer to read;
// [] when all is well.
export function checkWorld(world) {
  const problems = [];
  const fail = (text) => problems.push(text);

  plainData(world, "world", fail);
  if (!Number.isInteger(world.tick) || world.tick < 0) fail(`tick ${world.tick}`);

  const ids = new Set();
  for (const [name, list] of [
    ["entities", world.entities],
    ["nodes", world.nodes],
  ]) {
    for (let i = 0; i < list.length; i++) {
      if (ids.has(list[i].id)) fail(`${list[i].id} twice`);
      ids.add(list[i].id);
      if (i && !(list[i - 1].id < list[i].id)) fail(`${name} out of id order at ${list[i].id}`);
    }
  }

  // Every hold of every action, added up, is what the stores have promised.
  const held = new Map();
  for (const e of world.entities) {
    for (const { at, dir, item, n } of e.action?.holds ?? []) {
      const key = `${at} ${dir} ${item}`;
      held.set(key, (held.get(key) ?? 0) + n);
    }
  }
  for (const t of [...world.entities, ...world.nodes]) {
    const { items, caps, total } = t.store;
    for (const dir of ["in", "out"]) {
      for (const [item, n] of Object.entries(t.store[dir])) {
        if (!(n > 0)) fail(`${t.id} ${dir} ${item} is ${n}`);
        if (held.get(`${t.id} ${dir} ${item}`) !== n) fail(`${t.id} ${dir} ${item} is ${n}, but actions hold ${held.get(`${t.id} ${dir} ${item}`) ?? 0}`);
        held.delete(`${t.id} ${dir} ${item}`);
      }
    }
    for (const [item, n] of Object.entries(items)) {
      if (!(n > 0)) fail(`${t.id} has ${n} ${item}`);
      if ((t.store.out[item] ?? 0) > n) fail(`${t.id} promises more ${item} than it has`);
    }
    if (caps) {
      for (const item of new Set([...Object.keys(items), ...Object.keys(t.store.in)])) {
        if ((items[item] ?? 0) + (t.store.in[item] ?? 0) > (caps[item] ?? 0)) fail(`${t.id} holds more ${item} than its cap`);
      }
    } else {
      const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
      if (sum(items) + sum(t.store.in) > total) fail(`${t.id}'s basket holds more than ${total}`);
    }
  }
  for (const key of held.keys()) fail(`actions hold ${key}, which no store has promised`);

  const walk = walkable(world);
  for (const e of world.entities) {
    if ([e.action, e.pending, e.error].filter(Boolean).length > 1) fail(`${e.id} is doing, waiting or failed at once`);
    if (e.kind === "robot" && !walk[e.cell]) fail(`${e.id} stands on cell ${e.cell}, which can't be walked on`);
  }

  // Programs, and where each program's runtimes are in them.
  for (let i = 0; i < world.programs.length; i++) {
    const p = world.programs[i];
    if (i && !(world.programs[i - 1].id < p.id)) fail(`programs out of id order at ${p.id}`);
    for (const problem of checkProgram(p)) fail(`program ${p.id}: ${problem}`);
  }
  for (const e of world.entities) {
    const run = e.runtime;
    if (run?.kind !== "program") continue;
    const p = world.programs.find((it) => it.id === run.program);
    if (!p) {
      fail(`${e.id} runs program ${run.program}, which there isn't`);
      continue;
    }
    if (run.revision !== p.revision || run.compiler !== p.compiler) fail(`${e.id} runs revision ${run.revision} of ${p.id}, which is at ${p.revision}`);
    if (run.parked !== undefined && (run.parked !== true || run.at !== 0 || run.block !== null || e.action || e.pending)) fail(`${e.id} has ${p.id} parked, but has begun it`);
    if (!(run.at >= 0 && run.at < p.code.length)) fail(`${e.id} is at instruction ${run.at} of ${p.code.length}`);
    for (const loop of run.loops) {
      if (p.code[loop.at]?.op !== "repeat" || !(loop.count >= 0 && loop.count <= Math.max(0, loop.times))) fail(`${e.id} has a loop at ${loop.at} that isn't a repeat's`);
    }
  }

  // The mission: goals of known types, each met at a tick that has been, and
  // the mission done when, and only when, its last goal was.
  const { mission } = world;
  if (mission !== null) {
    const when = (t) => t === null || (Number.isInteger(t) && t >= 1 && t <= world.tick);
    if (typeof mission?.id !== "string" || !Array.isArray(mission.goals) || !mission.goals.length || !Array.isArray(mission.reward)) fail("the mission isn't one");
    else {
      for (const goal of mission.goals) {
        if (!GOALS[goal?.type] || typeof goal.id !== "string") fail(`the mission has a goal ${JSON.stringify(goal)}`);
        else if (!when(goal.done)) fail(`goal ${goal.id} was met at tick ${goal.done}`);
      }
      const last = mission.goals.every((g) => g?.done !== null) ? Math.max(...mission.goals.map((g) => g.done)) : null;
      if (mission.done !== last) fail(`the mission was done at ${mission.done}, its goals at ${last}`);
    }
  }
  return problems;
}

// Only whole numbers, strings, booleans, null, plain arrays and objects: what
// saves and loads exactly, and is the same on every machine (PLAN.md §6).
function plainData(value, path, fail) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) fail(`${path} is ${value}, not a whole number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => plainData(v, `${path}[${i}]`, fail));
    return;
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [k, v] of Object.entries(value)) plainData(v, `${path}.${k}`, fail);
    return;
  }
  fail(`${path} is ${typeof value}, not plain data`);
}
