import { compile } from "../programming/compiler.js";
import { startProgram } from "../programming/runtime.js";
import { finish, progress, tryStart } from "./actions.js";
import { canRun, fitsSetting, programFor, rebind } from "./bindings.js";
import { applyCommand } from "./commands.js";
import { makeThing } from "./content.js";
import { TYPES } from "./entities.js";
import { count } from "./inventory.js";
import { beginTrial, checkGoals, createMission, recordWait, recordWork } from "./objectives.js";
import { runtimeOf } from "./runtimes.js";
import { script } from "./script.js";
import { statusOf } from "./status.js";
import { parseTerrain, setKind } from "./terrain.js";

export { reasonOf, statusOf } from "./status.js";

// The world and its clock (PLAN.md §6). advanceWorld moves the world from tick T
// to tick T + 1, and nothing else changes it: not the frame rate, timers, dates or
// chance. The state is plain data, whole numbers, strings, booleans, arrays and
// objects, so it saves and loads exactly; robots, buildings and deposits are kept
// in order of id, and nothing depends on the order of an object's keys.
//
//   { sim, content, tick, terrain, nav, serial, programs, roles, defaults, entities, nodes, stall, mission }
//
// `nav` is the navigation revision, counted up whenever the ways change; `serial`
// numbers waiting intents in the order they started waiting; `programs` are the
// compiled programs entities can run, { id, revision, …compiled } in order of
// id (src/programming/compiler.js); `roles` and `defaults` are the teams' and
// the types' programs (bindings.js); `stall` is { since } while nothing can
// happen (codes.js); `mission` is the mission being played, with its goals
// (objectives.js), or null.
//
// An entity (robot or building) is
//
//   { id, kind, type, name, own, role?, settings?, cell | area + access, store,
//     blueprint?, built?, gap?, action, pending, error, runtime }
//
// with `own` the program given to it alone, a robot's `role` its team and its
// `settings` what its program's “my source”, “my item” and “my destination”
// read (entities.js, SETTINGS); a construction site's `blueprint` what it
// builds; `action` what it's doing (actions.js), `pending` an intent that's
// waiting to start { intent, order, since, reason, nav }, `error` the reason its
// program stopped, and `runtime` what decides its next intent: a program's
// runtime state (src/programming/runtime.js), or a script (runtimes.js). Which
// program it runs follows from `own`, `role` and the defaults (bindings.js).
// `name` is a message reference until the player names a robot, worded only
// when shown (PLAN.md §8).

// Bumped whenever a deliberate change makes the same commands give a different
// world; the golden replays (test/golden/) are then recorded again: npm run golden.
// 3: worlds have a mission, whose goals are checked every tick.
// 4: a robot given a program starts with an empty basket; programs can be parked.
// 5: teams, type defaults and own programs; robots' settings; actions whose
//    place or item a program works out as it runs; the workshop, its kits, and
//    buildings placed by the player.
// 6: missions have trials and count completed work (deliveries, things made,
//    waits), with exact orders, steady goals and goals that fail; choosing a
//    missing setting lets a robot stopped for it go on; robots can be added.
export const SIM_VERSION = 6;

// Ticks in a second of play at 1× speed. Every duration is a whole number of
// ticks, so this is part of the simulation (PLAN.md §1).
export const TICKS_PER_SECOND = 10;

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// A world at tick 0 from `content` (src/content/island.js shows the shape). Its
// programs are compiled here, each as its `revision`, 1 unless said (a world
// started again keeps the programs the player applied: src/programming/
// programs.js). Who runs what comes from content's `roles` (teams, each with
// its program), `defaults` (a program for every robot or building of a type),
// and each entity's `program`, its own, and `role`, a robot's team
// (bindings.js). An entity with a program starts at its start; one with a
// script follows the script; one with `parked` has its program without
// starting it (src/programming/runtime.js). Robots start with the `settings`
// content gives them, and nothing chosen for the rest. A construction site
// that's `built` has its bridge already. Content with a `mission`
// (src/content/missions/) makes a world with that mission's goals to meet,
// from its first trial's stage (objectives.js).
export function createWorld(content) {
  const terrain = parseTerrain(content.terrain);
  const places = [...content.entities, ...content.nodes].map((t) => t.id);
  const programs = (content.programs ?? []).map(({ id, source, revision = 1 }) => {
    const { program, errors } = compile(source, { places });
    if (!program) throw new Error(`${content.id}: program ${id} doesn't compile: ${JSON.stringify(errors)}`);
    if (!Number.isInteger(revision) || revision < 1) throw new Error(`${content.id}: program ${id} has revision ${revision}`);
    return { id, revision, ...program };
  });
  const program = (id, what) => {
    if (id == null) return null;
    if (!programs.some((p) => p.id === id)) throw new Error(`${content.id}: ${what} runs program ${id}, which there isn't`);
    return id;
  };
  const roles = (content.roles ?? []).map((r) => ({ id: r.id, name: r.name, program: program(r.program, `team ${r.id}`) }));
  const defaults = (content.defaults ?? []).map((d) => {
    if (!TYPES[d.type] || TYPES[d.type].kind === "node") throw new Error(`${content.id}: a default for "${d.type}", which isn't a robot or building type`);
    return { type: d.type, program: program(d.program, `type ${d.type}`) };
  });
  const entities = content.entities.map((e) => {
    const type = TYPES[e.type];
    if (!type || type.kind === "node") throw new Error(`${content.id}: ${e.id} has no robot or building type "${e.type}"`);
    if (e.role != null && !roles.some((r) => r.id === e.role)) throw new Error(`${content.id}: ${e.id} is on team ${e.role}, which there isn't`);
    return { ...makeThing(terrain, e, content.id), own: program(e.program, e.id) };
  });
  const nodes = content.nodes.map((n) => {
    if (TYPES[n.type]?.kind !== "node") throw new Error(`${content.id}: ${n.id} has no deposit type "${n.type}"`);
    return makeThing(terrain, n, content.id);
  });
  // Bridges already built.
  for (const site of entities) if (site.built && site.gap) setKind(terrain, site.gap, "+");
  const world = {
    sim: SIM_VERSION,
    content: { id: content.id, version: content.version },
    tick: 0,
    terrain,
    nav: 0,
    serial: 0,
    programs: programs.sort(byId),
    roles: roles.sort(byId),
    defaults: defaults.sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0)),
    entities: entities.sort(byId),
    nodes: nodes.sort(byId),
    stall: null,
    mission: content.mission ? createMission(content.mission) : null,
  };
  // What each entity runs: its script, or the program it resolves to.
  for (const e of world.entities) {
    const given = content.entities.find((it) => it.id === e.id);
    for (const [slot, value] of Object.entries(e.settings ?? {})) {
      if (!fitsSetting(world, slot, value)) throw new Error(`${content.id}: ${e.id}'s ${slot} can't be ${value}`);
    }
    if (given.script) {
      e.runtime = script(given.script.steps.map((step) => ({ ...step })), { loop: !!given.script.loop });
      continue;
    }
    const id = programFor(world, e);
    if (given.parked && !id) throw new Error(`${content.id}: ${e.id} is parked with no program`);
    if (!id) continue;
    if (!canRun(world, e, id)) {
      const missing = world.programs.find((p) => p.id === id).needs.filter((ability) => !TYPES[e.type].can?.includes(ability));
      throw new Error(`${content.id}: ${e.id} can't run program ${id}: it can't ${missing.join(", ")}`);
    }
    e.runtime = startProgram(world.programs.find((p) => p.id === id), { parked: !!given.parked });
  }
  if (world.mission?.trials[0].stage) beginTrial(world);
  return world;
}

// Moves `world` on by one tick, applying the player's `commands` first. Returns
// the tick's trace, the debugger's account of the tick (it isn't part of the
// world):
//
//   { tick, commands, evaluated, started, ended, waiting, errors, goals, passed, done, states }
//
// - commands: what each command did, { ok, reason? }.
// - evaluated: each entity that evaluated a step, { entity, block?, … }: the
//   block, and what came of it: an action's `intent`, a Wait Until's `test`, an
//   If's `branch` (its index, or -1 for none), a Repeat's `round` (from 1, or 0
//   when it's over). A script's step has an intent and no block.
// - started, ended: actions, { entity, type }.
// - waiting: intents that couldn't start, { entity, reason }.
// - errors: entities whose program stopped, { entity, reason }.
// - goals: the ids of the mission's goals met in this tick; passed: the trial
//   passed in it (its index), the next one staged at its end, or null; done:
//   whether the mission was done in it, and its reward given (objectives.js).
// - states: every robot and building after the tick, { entity, state, block }:
//   statusOf's word and the active block.
//
// The phases, in order (PLAN.md §6):
// 1. The player's commands.
// 2. Actions under way move on; those that end settle their holds, in order of
//    entity id. Then deposits grow back.
// 3. Messages sent in the tick before are in their inboxes: a Send is an action
//    of one step, which ends in phase 2 and delivers its message there
//    (messages.js). From here to phase 5 the world is read, not changed:
//    runtimes see it as it stands after phase 2. (A Wait For takes a message
//    out of its own entity's inbox, which nothing else reads in this phase.)
// 4. Each entity that's free, in order of id, evaluates its runtime's next
//    visible step, one at most: an action's block gives an intent, which is only
//    noted here; a loop, a condition or a Wait Until only moves the runtime on.
// 5. Intents are settled: first those already waiting, in the order they began
//    to, then this tick's, in order of entity id. Each starts if the world is
//    ready for it, reserving what it needs, so an earlier one has first pick;
//    otherwise it waits, with the reason, and is tried again next tick. A wait
//    for a way somewhere is only tried again once the ways have changed.
// 6. The mission's goals are checked, against work that has ended (the
//    trial's tally, noted in phase 2); when the last of a trial is met, the
//    next trial is staged, or after the last the mission's reward is given
//    (objectives.js). Then whether the world has stalled, and the tick is done.
export function advanceWorld(world, commands = []) {
  const now = world.tick + 1;
  const trace = { tick: now, commands: [], evaluated: [], started: [], ended: [], waiting: [], errors: [] };

  // 1. Commands.
  for (const command of commands) trace.commands.push(applyCommand(world, command));

  // 2. Actions under way, then deposits.
  for (const entity of world.entities) {
    if (!entity.action) continue;
    const state = progress(world, entity, now);
    if (state === "done") {
      trace.ended.push({ entity: entity.id, type: entity.action.type });
      recordWork(world, entity);
      // A construction site that has become its building starts the program
      // its new type runs; anything else goes on to its next step.
      if (finish(world, entity)) rebind(world, [entity]);
      else runtimeOf(entity)?.done(entity);
    } else if (state.wait) {
      // The way is gone: the move waits to start again from where the robot is.
      entity.pending = { intent: { type: "goTo", target: state.wait.target }, order: world.serial++, since: now, reason: state.wait, nav: world.nav };
    }
  }
  for (const node of world.nodes) {
    if (growing(node) && now % node.regrow.every === 0) node.store.items[TYPES[node.type].yields] = count(node.store, TYPES[node.type].yields) + 1;
  }

  // 3. Messages have arrived, with the Sends that ended in phase 2.

  // 4. Runtimes.
  const intents = [];
  for (const entity of world.entities) {
    if (entity.action || entity.pending || entity.error) continue;
    const step = runtimeOf(entity)?.next(entity, world, now);
    if (!step) continue;
    const { intent, error, ...seen } = step;
    trace.evaluated.push({ entity: entity.id, ...seen, ...(intent && { intent }) });
    if (error) {
      entity.error = error;
      trace.errors.push({ entity: entity.id, reason: error });
    } else if (intent) intents.push({ entity, intent });
  }

  // 5. Settling intents.
  const queue = world.entities
    .filter((e) => e.pending)
    .sort((a, b) => a.pending.order - b.pending.order)
    .map((entity) => ({ entity, intent: entity.pending.intent, pending: entity.pending }));
  for (const { entity, intent, pending } of [...queue, ...intents]) {
    if (pending?.reason.code === "wait.route" && pending.nav === world.nav) {
      trace.waiting.push({ entity: entity.id, reason: pending.reason });
      continue;
    }
    const result = tryStart(world, entity, intent, now);
    if (result.action) {
      entity.action = result.action;
      entity.pending = null;
      trace.started.push({ entity: entity.id, type: result.action.type });
    } else if (result.wait) {
      entity.pending = { intent, order: pending?.order ?? world.serial++, since: pending?.since ?? now, reason: result.wait, nav: world.nav };
      trace.waiting.push({ entity: entity.id, reason: result.wait });
      if (intent.type === "pickUp" && result.wait.code === "wait.item") recordWait(world, entity);
    } else {
      entity.pending = null;
      entity.error = blame(entity, result.error);
      trace.errors.push({ entity: entity.id, reason: entity.error });
    }
  }

  // 6. Goals, stalled? Then the tick is done. A trial staged or a reward given
  // here happens at the boundary after this tick, so the clock says so first:
  // a move they cancel ends where it has got to in this tick (actions.js).
  world.tick = now;
  const { met, passed, done } = checkGoals(world, now);
  trace.goals = met;
  trace.passed = passed;
  trace.done = done;
  world.stall = stalled(world) ? (world.stall ?? { since: now }) : null;
  trace.states = world.entities.map((e) => ({ entity: e.id, state: statusOf(e), block: runtimeOf(e)?.active(e) ?? null }));
  return trace;
}

// An action's error, from a program, names the block whose action it was.
function blame(entity, problem) {
  const block = runtimeOf(entity)?.active(entity);
  return block ? { ...problem, block } : problem;
}

// Nothing under way, nothing growing back, somebody waiting, and nobody ready to
// go on: everyone else has stopped or failed, so nothing can change until the
// player does something. (A program going round a loop of conditions without
// acting is ready, not waiting: it isn't stalled, though it changes nothing.)
function stalled(world) {
  if (world.entities.some((e) => e.action) || world.nodes.some(growing)) return false;
  const states = world.entities.map(statusOf);
  return states.includes("waiting") && !states.includes("ready");
}

// A deposit that grows back, one item every regrow.every ticks, up to its cap.
function growing(node) {
  const item = TYPES[node.type].yields;
  return !!node.regrow && count(node.store, item) < node.store.caps[item];
}

