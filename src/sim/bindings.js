import { startProgram } from "../programming/runtime.js";
import { cancel } from "./actions.js";
import { ITEMS, SETTINGS, TYPES, can } from "./entities.js";

// Which program each robot and building runs (PLAN.md §5). A program is shared
// by naming it, never by copying it into each entity, so one Apply reaches
// everyone that runs it. An entity's program is, in this order:
//
// 1. its own: entity.own, a program given to it alone (an individual override);
// 2. its team's: a robot's entity.role names one of world.roles, a named group
//    such as “Collectors” with one program for all its robots;
// 3. its type's: the program world.defaults gives every robot or building of
//    its type, such as every sawmill's.
//
//   world.roles = [{ id, name, program }]   in order of id; name a message reference
//   world.defaults = [{ type, program }]    in order of type
//
// Any of these may be null. What the entity's runtime runs is always what this
// resolves to (src/sim/validate.js checks it), except for an entity following a
// script (script.js), which keeps it until it's given a program.

export const roleOf = (world, id) => world.roles.find((r) => r.id === id) ?? null;
export const defaultFor = (world, type) => world.defaults.find((d) => d.type === type)?.program ?? null;

// The program entity `entity` runs, by the order above, or null. The
// opponent's robots are on no team of the player's and run no type's program:
// only their own (SKIRMISH_PLAN.md §7, ownership).
export function programFor(world, entity) {
  if (entity.own) return entity.own;
  if (entity.side === "opponent") return null;
  const team = entity.role ? roleOf(world, entity.role)?.program : null;
  return team ?? defaultFor(world, entity.type);
}

// The program its team or type gives `entity`: what it runs without its own.
export function sharedFor(world, entity) {
  return programFor(world, { ...entity, own: null });
}

// Whether `entity` can run program `id` of `world`: it can do all the program
// needs. No program can always be run.
export function canRun(world, entity, id) {
  if (id === null) return true;
  const program = world.programs.find((p) => p.id === id);
  return !!program && program.needs.every((ability) => can(entity, ability));
}

// Stops what `entity` is doing: its action is cancelled, its holds let go, and
// whatever it waited for or failed at is forgotten. Work it finished stays done.
// A robot rebooting goes on rebooting: a program given to it, or started
// again, doesn't cut its recovery short (combat.js).
export function stop(world, entity) {
  if (entity.action?.type !== "reboot") cancel(world, entity);
  entity.pending = null;
  entity.error = null;
}

// A robot's basket emptied, once its action is stopped and its holds let go. A
// robot given a program starts with an empty basket (docs/phase5.md), so its
// program starts as it would at the beginning, not stuck with a load it never
// asked for. A robot that hasn't taken a step of the program it had keeps what
// it carries: that's what its mission gave it, like the wood Robo 1 brings home
// in mission 3, not a load a program picked up (docs/phase7.md).
export function emptyBasket(entity) {
  if (entity.kind === "robot" && entity.runtime?.evaluated) entity.store.items = {};
}

// Gives `entity` the program it resolves to, from its start, in place of what
// it was doing; a robot begins with an empty basket. With none, it stops.
export function startResolved(world, entity) {
  stop(world, entity);
  emptyBasket(entity);
  const id = programFor(world, entity);
  entity.runtime = id ? startProgram(world.programs.find((p) => p.id === id)) : null;
}

// After a change to who runs what, each of `entities` whose program is no
// longer the one it runs is given its new one, from its start. One whose
// program is the same carries on, started or parked, and so does one following
// a script.
export function rebind(world, entities) {
  for (const e of entities) {
    if (e.runtime?.kind === "script") continue;
    if ((e.runtime?.program ?? null) !== programFor(world, e)) startResolved(world, e);
  }
}

// --- Keeping the player's choices across a fresh start --------------------------

// Who runs what in `world`, and each robot's settings and name: the player's
// choices, apart from the world they were made in (PLAN.md §9: starting a
// mission again keeps the child's work).
export function choicesOf(world) {
  return {
    roles: world.roles.map(({ id, program }) => ({ id, program })),
    defaults: world.defaults.map(({ type, program }) => ({ type, program })),
    entities: world.entities.map((e) => ({
      id: e.id,
      own: e.own,
      ...(e.kind === "robot" && { role: e.role, settings: { ...e.settings }, name: e.name }),
    })),
  };
}

// Makes the choices `choices` (choicesOf) in `world`, as far as they fit it:
// teams, types and things it has, programs it has, and places it has. An entity
// whose program changes starts it from its start, keeping what it carries, as
// the world it's made in gave it; one whose program is the same keeps its state,
// started or parked.
export function makeChoices(world, choices) {
  const has = (id) => id === null || world.programs.some((p) => p.id === id);
  for (const { id, program } of choices.roles) {
    const role = roleOf(world, id);
    if (role && has(program)) role.program = program;
  }
  for (const { type, program } of choices.defaults) {
    if (!has(program) || !TYPES[type]) continue;
    const d = world.defaults.find((it) => it.type === type);
    if (d) d.program = program;
    else world.defaults = [...world.defaults, { type, program }].sort((a, b) => (a.type < b.type ? -1 : 1));
  }
  for (const c of choices.entities) {
    const e = world.entities.find((it) => it.id === c.id);
    if (!e) continue;
    if (has(c.own)) e.own = c.own;
    if (e.kind !== "robot") continue;
    if (c.role === null || roleOf(world, c.role)) e.role = c.role;
    for (const [slot, value] of Object.entries(c.settings ?? {})) if (fitsSetting(world, slot, value)) e.settings[slot] = value;
    e.name = c.name;
  }
  for (const e of world.entities) {
    if (e.runtime?.kind === "script") continue;
    // A choice from another world might be a program this entity can't run
    // here: then it does without its own.
    if (!canRun(world, e, programFor(world, e))) e.own = null;
    const id = programFor(world, e);
    if ((e.runtime?.program ?? null) === id && canRun(world, e, id)) continue;
    stop(world, e);
    e.runtime = id && canRun(world, e, id) ? startProgram(world.programs.find((p) => p.id === id)) : null;
  }
}

// Whether `value` can be setting `slot` of a robot in `world` (entities.js,
// SETTINGS): null, or a place there is, or an item.
export function fitsSetting(world, slot, value) {
  if (value === null) return slot in SETTINGS;
  if (SETTINGS[slot] === "item") return ITEMS.includes(value);
  if (SETTINGS[slot] === "place") return [...world.entities, ...world.nodes].some((t) => t.id === value && t.access?.length);
  return false;
}
