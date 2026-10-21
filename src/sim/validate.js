import { checkProgram } from "../programming/runtime.js";
import { ACTIONS, robotsCounted } from "./actions.js";
import { fitsSetting, programFor, roleOf } from "./bindings.js";
import { ITEMS, SETTINGS, TYPES } from "./entities.js";
import { INBOX_SIZE, MESSAGES, queued } from "./messages.js";
import { walkable } from "./navigation.js";
import { GOALS, goalProblem } from "./objectives.js";
import { RECIPES } from "./recipes.js";

// A name: the player's words, or a message reference { key, params? } whose
// params are numbers, words or names themselves.
const isName = (name) =>
  (typeof name === "string" && name.length > 0) ||
  (!!name && typeof name.key === "string" && (name.params === undefined || Object.values(name.params).every((v) => typeof v === "number" || isName(v))));

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

  // The robot limit, orders and Supply's plans (supply.js): the island has no
  // more robots than its limit, counting those being made; an order is of
  // items a building can hold; a plan is a robot's, with its steps, an idle
  // one only while it waits its moment, and a robot with a plan never failed.
  if (world.limit !== null && !(Number.isInteger(world.limit) && world.limit >= 1)) fail(`limit ${world.limit}`);
  else if (world.limit !== null && robotsCounted(world) > world.limit) fail(`${robotsCounted(world)} robots, over the limit of ${world.limit}`);
  for (const e of world.entities) {
    if ("order" in e && (e.kind !== "building" || !isMap(e.order) || !Object.entries(e.order).every(([item, n]) => ITEMS.includes(item) && Number.isInteger(n) && n >= 1 && n <= (e.store.caps?.[item] ?? 0)))) {
      fail(`${e.id} orders ${JSON.stringify(e.order)}`);
    }
    if (!("supply" in e)) continue;
    const p = e.supply;
    const steps = Array.isArray(p?.steps) ? p.steps : null;
    if (e.kind !== "robot" || e.error || typeof p?.to !== "string" || !steps || !Number.isInteger(p.step)) fail(`${e.id} supplies ${JSON.stringify(p)}`);
    else if (p.idle) {
      if (steps.length || p.step !== 0 || e.action?.type !== "wait") fail(`${e.id} has nothing to bring, but isn't waiting its moment`);
    } else if (!(p.step >= 0 && p.step < steps.length) || !steps.every((s) => ACTIONS.includes(s?.type)) || !ITEMS.includes(p.item) || !(Number.isInteger(p.n) && p.n >= 1)) {
      fail(`${e.id} has a plan ${JSON.stringify(p)}`);
    }
  }

  // Messages (messages.js): an inbox is kept only with something in it, and
  // holds, with what's on its way, no more than INBOX_SIZE; each message one
  // there is, from a robot or building, sent in a tick that has been.
  for (const e of world.entities) {
    if (e.action?.type === "send" && (!MESSAGES.includes(e.action.message) || !world.entities.some((it) => it.id === e.action.to))) fail(`${e.id} sends ${e.action.message} to ${e.action.to}`);
    if (!("inbox" in e)) continue;
    if (!Array.isArray(e.inbox) || !e.inbox.length) fail(`${e.id} has an empty inbox`);
    else if (queued(world, e) > INBOX_SIZE) fail(`${e.id}'s inbox holds more than ${INBOX_SIZE}`);
    else
      for (const m of e.inbox) {
        if (!MESSAGES.includes(m?.message) || !world.entities.some((it) => it.id === m.from) || !(Number.isInteger(m.sent) && m.sent >= 1 && m.sent <= world.tick)) fail(`${e.id} has a message ${JSON.stringify(m)}`);
      }
  }
  for (const n of world.nodes) if ("inbox" in n) fail(`${n.id} is a deposit with an inbox`);

  // Programs, and where each program's runtimes are in them.
  for (let i = 0; i < world.programs.length; i++) {
    const p = world.programs[i];
    if (i && !(world.programs[i - 1].id < p.id)) fail(`programs out of id order at ${p.id}`);
    for (const problem of checkProgram(p)) fail(`program ${p.id}: ${problem}`);
  }
  // Who runs what: teams and type defaults in order, each naming a program
  // there is or none; every robot's team and settings ones there are; and each
  // entity running the program those resolve to, unless it follows a script
  // (bindings.js).
  const known = (id) => id === null || world.programs.some((p) => p.id === id);
  if (!Array.isArray(world.roles) || !Array.isArray(world.defaults)) fail("no roles or defaults");
  else {
    world.roles.forEach((r, i) => {
      if (typeof r?.id !== "string" || (i && !(world.roles[i - 1].id < r.id))) fail(`roles out of order at ${r?.id}`);
      if (!isName(r?.name)) fail(`team ${r?.id} has no name`);
      if (!known(r?.program)) fail(`team ${r?.id} runs ${r?.program}, which there isn't`);
    });
    world.defaults.forEach((d, i) => {
      if (!TYPES[d?.type] || TYPES[d.type].kind === "node" || (i && !(world.defaults[i - 1].type < d.type))) fail(`a default for ${d?.type}`);
      if (!known(d?.program)) fail(`the default for ${d?.type} is ${d?.program}, which there isn't`);
    });
    for (const e of world.entities) {
      if (!("own" in e) || !known(e.own)) fail(`${e.id}'s own program ${e.own} isn't there`);
      if (!isName(e.name)) fail(`${e.id} has no name`);
      if (e.kind === "robot") {
        if (e.role !== null && !roleOf(world, e.role)) fail(`${e.id} is on team ${e.role}, which there isn't`);
        if (!e.settings || Object.keys(e.settings).sort().join() !== Object.keys(SETTINGS).sort().join()) fail(`${e.id} has settings ${JSON.stringify(e.settings)}`);
        else for (const [slot, value] of Object.entries(e.settings)) if (!fitsSetting(world, slot, value)) fail(`${e.id}'s ${slot} is ${value}`);
      } else if ("role" in e || "settings" in e) fail(`${e.id} is a building with a team or settings`);
      if ("blueprint" in e && (e.type !== "site" || RECIPES[e.blueprint]?.builds !== e.blueprint || typeof e.built !== "boolean")) fail(`${e.id} has blueprint ${e.blueprint}`);
      if (e.type === "site" && !("blueprint" in e)) fail(`${e.id} is a site with no blueprint`);
      if (e.runtime?.kind === "script") continue;
      const id = programFor(world, e);
      // (Whether it can run it is the runtime's to find: a program published
      // anew may ask more of it, and stops it with an error.)
      if ((e.runtime?.program ?? null) !== id) fail(`${e.id} runs ${e.runtime?.program ?? "nothing"}, but should run ${id ?? "nothing"}`);
    }
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
    if ("vars" in run && (!run.vars || typeof run.vars !== "object" || Array.isArray(run.vars) || !Object.keys(run.vars).length)) fail(`${e.id} remembers ${JSON.stringify(run.vars)}`);
    if ("frames" in run) {
      const frames = Array.isArray(run.frames) ? run.frames : [];
      if (!frames.length) fail(`${e.id} has no frames, but keeps them`);
      for (const f of frames) {
        if (p.code[f?.back - 1]?.op !== "call" || p.code[f.back - 1].block !== f.call || p.code[f.back - 1].routine !== f.routine || !f.args || typeof f.args !== "object") fail(`${e.id} is inside ${JSON.stringify(f)}`);
      }
    }
  }

  checkMission(world, fail);
  return problems;
}

// The mission (objectives.js): its goals of known types, each one, each met or
// failed at a tick that has been, never both; and the mission done when, and
// only when, its last goal was met.
function checkMission(world, fail) {
  const { mission } = world;
  if (mission === null) return;
  const when = (t) => t === null || (Number.isInteger(t) && t >= 1 && t <= world.tick);
  const isList = (value) => Array.isArray(value);
  if (typeof mission?.id !== "string" || !isList(mission.goals) || !mission.goals.length || !isList(mission.reward)) {
    fail("the mission isn't one");
    return;
  }
  // A goal as content wrote it: without how far it has got.
  const spec = ({ done, failed, since, ...rest }) => rest;
  for (const goal of mission.goals) {
    if (!GOALS.includes(goal?.type)) fail(`the mission has a goal ${JSON.stringify(goal)}`);
    else if (goalProblem(spec(goal))) fail(`mission ${mission.id}: ${goalProblem(spec(goal))}`);
    else if (!when(goal.done) || !when(goal.failed)) fail(`goal ${goal.id} was met at ${goal.done} or failed at ${goal.failed}`);
    else if (goal.done !== null && goal.failed !== null) fail(`goal ${goal.id} was met and failed`);
  }
  const { tally, collected } = mission;
  if (!isMap(tally) || ["unloads", "together", "made", "waited"].some((part) => !isMap(tally[part])) || !isMap(collected)) fail("the mission's tally isn't one");
  const allMet = mission.goals.every((g) => g?.done !== null);
  if (mission.done === null) {
    if (allMet) fail("every goal is met, but the mission isn't done");
  } else {
    const last = Math.max(...mission.goals.map((g) => g.done));
    if (!allMet || mission.done !== last) fail(`the mission was done at ${mission.done}, its goals at ${allMet ? last : "–"}`);
  }
}

const isMap = (value) => !!value && typeof value === "object" && !Array.isArray(value);

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
