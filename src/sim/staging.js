import { startProgram } from "../programming/runtime.js";
import { fitsSetting, programFor, roleOf, stop } from "./bindings.js";
import { insertById, makeThing } from "./content.js";
import { SETTINGS, TYPES } from "./entities.js";
import { count, makeStore, room, setCount } from "./inventory.js";
import { walkable } from "./navigation.js";
import { placedName } from "./placement.js";
import { RECIPES } from "./recipes.js";
import { areaCells, cellAt, setKind } from "./terrain.js";
import { thing } from "./things.js";

// Setting the scene for a mission, and for each of its trials (PLAN.md §9,
// “Missions stand alone”; docs/campaign-plan.md, “Checkpoints, resources, and
// reliable goals”). The campaign's island grows from mission to mission, and
// a mission's setup is written as what it changes on the island the mission
// before starts with: things that arrive, the robots it's about at their
// places with their baskets, staged stock, room made in a store, the programs
// it gives out. Its resources are reset: every building empty and every
// deposit full, as the island's catalogue starts them. Every mission starts
// from the setups up to it made in turn, nothing played between
// (src/campaign.js), so nothing the player did carries into it.
//
// A stage is plain data, as content writes it; each part is optional:
//
//   { add: [id, …]                    things from the island's catalogue that arrive
//     plots: [id, …]                  buildings from the catalogue that arrive as their
//                                     construction site, to be built (missions 27–30)
//     bridges: [site, …]              the bridges of these construction sites of the
//                                     catalogue, built, without their sites
//     stock: { at: { item: n } }      a store's exact count of each item
//     room: { at: { item: n } }       room for at least n more of each item
//     robots: { id: { at, basket } }  a robot at a place (or cell [x, z]), its basket exactly
//     settings: { id: { slot: v } }   a robot's settings
//     defaultSettings: { id: { slot: v } }   the same, for slots nothing is chosen for yet
//     teams: [{ id, name, program }]  the teams there are (a mission's setup only)
//     defaults: [{ type, program }]   the programs every building of a type runs (setup only)
//     roles: { robot: team }          robots on teams (setup only)
//     run: { id: program }            programs given to one robot or building alone
//     parked: [id, …]                 those whose program waits to be started }
//
// Things are named by id; maps are applied in order of id, so a stage does the
// same whatever order its keys were written in.

const entries = (map) => Object.entries(map ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

// Stops everything under way: actions cancelled, their holds let go, waits and
// errors forgotten, messages on their way or in an inbox gone (messages.js).
// Work that ended stays done.
function stopAll(world) {
  for (const e of world.entities) {
    stop(world, e);
    delete e.inbox;
  }
}

// Thing `given` from the catalogue, added to `world` unless it's there, with
// no program of its own until the setup gives it one. A robot standing where a
// building now stands steps to its front. A bridge's construction site plans
// its bridge over the water as it arrives: the gap it will fill.
function addThing(world, given) {
  if (thing(world, given.id)) return;
  const t = makeThing(world.terrain, given, `stage ${given.id}`);
  if (t.kind !== "node") t.own = null;
  insertById(t.kind === "node" ? world.nodes : world.entities, t);
  if (t.gap) setKind(world.terrain, t.gap, t.built ? "+" : "=");
  if (t.area) {
    world.nav++;
    const under = new Set(areaCells(world.terrain, t.area));
    for (const r of world.entities) if (r.kind === "robot" && under.has(r.cell)) r.cell = t.access[0];
  }
}

// The bridge of construction site `given` (from the catalogue) built, and
// there without its site: its gap can be walked on.
function layBridge(world, given) {
  if (!given?.gap) throw new Error(`stage: no bridge ${given?.id} in the catalogue`);
  setKind(world.terrain, given.gap.map(([x, z]) => cellAt(world.terrain, x, z)), "+");
  world.nav++;
}

// Robot `robot` at place `at`, or cell [x, z]. A robot already at the place
// stays where it is; otherwise it takes the place's first front cell no other
// robot stands on, or its first.
function placeRobot(world, robot, at) {
  if (Array.isArray(at)) {
    robot.cell = cellAt(world.terrain, at[0], at[1]);
    return;
  }
  const place = thing(world, at);
  if (!place?.access?.length) throw new Error(`stage: no place ${at} for ${robot.id}`);
  if (place.access.includes(robot.cell)) return;
  const taken = new Set(world.entities.filter((e) => e.kind === "robot" && e !== robot).map((e) => e.cell));
  const walk = walkable(world);
  robot.cell = place.access.find((cell) => walk[cell] && !taken.has(cell)) ?? place.access[0];
}

function setSettings(world, robot, settings, onlyUnset) {
  for (const [slot, value] of entries(settings)) {
    if (!(slot in SETTINGS) || !fitsSetting(world, slot, value)) throw new Error(`stage: ${robot.id}'s ${slot} can't be ${value}`);
    if (!onlyUnset || robot.settings[slot] === null) robot.settings[slot] = value;
  }
}

const robotOf = (world, id) => {
  const r = thing(world, id);
  if (r?.kind !== "robot") throw new Error(`stage: no robot ${id}`);
  return r;
};
const storeOf = (world, id) => {
  const t = thing(world, id);
  if (!t) throw new Error(`stage: nothing called ${id}`);
  return t.store;
};

// The stage's changes to things, between ticks, with nothing under way:
// arrivals, bridges, stock, room, robots, settings. `things` is the island's
// catalogue, for `add`.
export function stage(world, spec, things = []) {
  for (const id of spec.add ?? []) {
    const given = things.find((t) => t.id === id);
    if (!given) throw new Error(`stage: no ${id} in the catalogue`);
    addThing(world, given);
  }
  for (const id of spec.plots ?? []) {
    const given = things.find((t) => t.id === id);
    if (!given || !RECIPES[given.type]?.builds) throw new Error(`stage: no building ${id} in the catalogue to build`);
    addThing(world, { ...given, type: "site", blueprint: given.type, name: placedName(given.type, 1, true), items: undefined, caps: { ...RECIPES[given.type].inputs } });
  }
  for (const id of spec.bridges ?? []) layBridge(world, things.find((t) => t.id === id));
  for (const [at, counts] of entries(spec.stock)) {
    const store = storeOf(world, at);
    for (const [item, n] of entries(counts)) {
      if (setCount(store, item, n) !== n) throw new Error(`stage: ${at} can't hold ${n} ${item}`);
    }
  }
  for (const [at, counts] of entries(spec.room)) {
    const store = storeOf(world, at);
    for (const [item, n] of entries(counts)) if (room(store, item) < n) setCount(store, item, count(store, item) - (n - room(store, item)));
  }
  for (const [id, { at, basket }] of entries(spec.robots)) {
    const r = robotOf(world, id);
    if (at !== undefined) placeRobot(world, r, at);
    if (basket !== undefined) {
      r.store.items = {};
      for (const [item, n] of entries(basket)) if (setCount(r.store, item, n) !== n) throw new Error(`stage: ${id}'s basket can't hold ${n} ${item}`);
    }
  }
  for (const [id, settings] of entries(spec.settings)) setSettings(world, robotOf(world, id), settings, false);
  for (const [id, settings] of entries(spec.defaultSettings)) setSettings(world, robotOf(world, id), settings, true);
}

// Everyone starts the program they run from its start: a parked one stays
// parked. Every robot begins with an empty basket unless `baskets` (the stage's
// robots) gives it one, with a program or without: nothing a mission didn't
// give it is carried into it.
function startAll(world, { parked = [], baskets = {} } = {}) {
  for (const e of world.entities) {
    const id = programFor(world, e);
    const program = id && world.programs.find((p) => p.id === id);
    if (id && !program) throw new Error(`stage: ${e.id} runs ${id}, which the world hasn't got`);
    if (e.kind === "robot" && baskets[e.id]?.basket === undefined) e.store.items = {};
    e.runtime = program ? startProgram(program, { parked: parked.includes(e.id) }) : null;
  }
}

// Every building's and deposit's store as catalogue `things` starts it: a
// building empty, a deposit full. One the catalogue hasn't got, such as a
// building the player placed, is emptied. Nothing is under way, so nothing is
// promised to arrive or leave.
function restockAll(world, things) {
  for (const t of [...world.entities, ...world.nodes]) {
    if (t.kind === "robot" || !t.store) continue;
    t.store.items = makeStore({ items: things.find((given) => given.id === t.id)?.items }).items;
  }
}

// A mission's setup, made on `world`, the island as the mission before left it
// (or as the campaign starts): everything under way stops, with `restock` the
// stores start afresh (restockAll), who runs what is the setup's alone, its
// stage is made, and the clock starts from 0 again. `things` is the island's
// catalogue; `programs` the compiled programs the world has from now on
// (world.programs).
export function enter(world, setup, { things = [], programs = world.programs, restock = false } = {}) {
  stopAll(world);
  if (restock) restockAll(world, things);
  world.programs = [...programs].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const e of world.entities) {
    e.own = null;
    if (e.kind === "robot") e.role = null;
  }
  world.roles = (setup.teams ?? []).map(({ id, name, program }) => ({ id, name, program: program ?? null })).sort((a, b) => (a.id < b.id ? -1 : 1));
  world.defaults = (setup.defaults ?? []).map(({ type, program }) => ({ type, program: program ?? null })).sort((a, b) => (a.type < b.type ? -1 : 1));
  stage(world, setup, things);
  for (const [id, role] of entries(setup.roles)) {
    if (!roleOf(world, role)) throw new Error(`stage: no team ${role}`);
    robotOf(world, id).role = role;
  }
  for (const [id, program] of entries(setup.run)) {
    const e = thing(world, id);
    if (!e || e.kind === "node") throw new Error(`stage: no robot or building ${id}`);
    e.own = program;
  }
  for (const d of world.defaults) if (!TYPES[d.type] || TYPES[d.type].kind === "node") throw new Error(`stage: a default for ${d.type}`);
  startAll(world, { parked: setup.parked, baskets: setup.robots });
  world.tick = 0;
  world.stall = null;
  return world;
}

// A trial's stage, made at the end of the tick the trial before was passed
// (objectives.js): everything under way stops, the stage is made, and every
// program starts again from its start, as at the beginning of the mission.
export function stageTrial(world, spec) {
  stopAll(world);
  stage(world, spec);
  for (const [id, program] of entries(spec.run)) thing(world, id).own = program;
  const parked = world.entities.filter((e) => e.runtime?.parked).map((e) => e.id);
  startAll(world, { parked, baskets: spec.robots });
}
