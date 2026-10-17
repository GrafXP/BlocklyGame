import { COMPILER_VERSION } from "../programming/compiler.js";
import { checkProgram, startProgram } from "../programming/runtime.js";
import { canRun, emptyBasket, fitsSetting, programFor, rebind, roleOf, startResolved, stop } from "./bindings.js";
import { reason } from "./codes.js";
import { insertById, makeThing } from "./content.js";
import { ITEMS, SETTINGS, TYPES } from "./entities.js";
import { makeStore, setCount } from "./inventory.js";
import { walkable } from "./navigation.js";
import { checkPlacement, freeId, isRequest, placedName } from "./placement.js";
import { RECIPES } from "./recipes.js";
import { runtimeOf } from "./runtimes.js";
import { script } from "./script.js";
import { cellAt, inside } from "./terrain.js";
import { thing } from "./things.js";

// The player's commands, applied at a tick boundary, first thing in a tick
// (PLAN.md §6, phase 1). Until then they wait in the game's queue, and the world
// runs on as it was. A command is plain data, so a game can be recorded as the
// commands of each tick and played again (replay.js):
//
//   { type: "publish", program: { id, revision, compiler, start, code, needs } }
//        a compiled program (src/programming/compiler.js), new or a new revision:
//        every entity running it starts the new one from its start, and one
//        that has it parked keeps it parked (src/programming/runtime.js)
//   { type: "assign", entity, program }       `entity`'s own program, or null for
//                                             none: it runs what its team or type
//                                             gives it (bindings.js). Either way it
//                                             starts again, from the start
//   { type: "role", entity, role }            robot `entity` joins team `role`, or
//                                             leaves its team with null
//   { type: "default", role | entityType, program }
//                                             team `role`'s program, or the one for
//                                             every robot or building of type
//                                             `entityType`; null for none
//   { type: "start", entity }                 `entity` starts its parked program
//   { type: "settings", entity, settings }    robot `entity`'s settings, { slot:
//                                             value }, each a place, an item, or
//                                             null (entities.js, SETTINGS)
//   { type: "name", entity, name }            the player's name for robot `entity`
//   { type: "place", blueprint, x, z, facing, program }
//                                             a construction site for a building
//                                             (placement.js), running `program`
//   { type: "add", robot: { id, name, cell: [x, z] } }
//                                             a new robot (the sandbox's), on a
//                                             cell robots can walk on, with no
//                                             team or settings yet, running its
//                                             type's program if there is one
//   { type: "script", entity, steps, loop }   give `entity` a script to run, from its start
//   { type: "restart", entity }              start `entity`'s program or script again
//   { type: "stock", at, item, count }       set a store's count (the sandbox's resource settings)
//
// Anything that starts an entity again cancels what it was doing: its holds are
// let go and work it finished stays done (PLAN.md §5). A robot given a program to
// run, a new one or a new revision, starts with an empty basket: what it carried
// is gone, so its program starts as it would from the beginning, not stuck with
// a load it never asked for. A change to who runs what starts again exactly
// those entities whose program changes; everyone else carries on (bindings.js).
// Settings don't start anything again: a program reads them when it comes to
// a block that does. Returns { ok: true }, or { ok: false, reason } for a
// command that doesn't fit the world, which changes nothing.
export function applyCommand(world, command) {
  const apply = COMMANDS[command?.type];
  const done = apply?.(world, command);
  return done ? { ok: true } : { ok: false, reason: reason("command.invalid", { type: String(command?.type) }) };
}

const runner = (world, id) => {
  const e = thing(world, id);
  return e && e.kind !== "node" ? e : null;
};
const robot = (world, id) => {
  const e = thing(world, id);
  return e?.kind === "robot" ? e : null;
};

const copy = (value) => JSON.parse(JSON.stringify(value));
// Program ids are the game's own; block ids are Blockly's, any characters.
const isId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value);
// A name: the player's words, or a message reference { key, params? } whose
// params are numbers, words or names (src/sim/validate.js checks the same).
const isName = (name) =>
  (typeof name === "string" && name.trim().length > 0 && name.length <= NAME_LENGTH) ||
  (!!name && typeof name === "object" && typeof name.key === "string" && (name.params === undefined || Object.values(name.params).every((v) => typeof v === "number" || isName(v))));
const hasProgram = (world, id) => id === null || world.programs.some((p) => p.id === id);

// The longest name the player can give a robot, in characters.
export const NAME_LENGTH = 24;

// Puts compiled program `program` into `world`, in place of any older revision of
// it, and starts every entity running it again, from its start, on the new one;
// an entity that has it parked keeps it parked. With `fresh`, as when the player
// applies it, a robot started again begins with an empty basket; without, as
// when a mission starts again from its checkpoint, what the checkpoint gave it
// stays. The program must be sound (checkProgram).
export function installProgram(world, program, { fresh = true } = {}) {
  const { id, revision, compiler, start, code, needs } = copy(program);
  const entry = { id, revision, compiler, start, code, needs };
  const at = world.programs.findIndex((p) => p.id >= id);
  if (world.programs[at]?.id === id) world.programs[at] = entry;
  else world.programs.splice(at < 0 ? world.programs.length : at, 0, entry);
  for (const e of world.entities) {
    if (e.runtime?.kind !== "program" || e.runtime.program !== id) continue;
    const parked = !!e.runtime.parked;
    stop(world, e);
    if (fresh && !parked) emptyBasket(e);
    e.runtime = startProgram(entry, { parked });
  }
}

// Whether each of `entities` could run the program it resolves to in `world`;
// one following a script keeps it, so it doesn't count.
const allCanRun = (world, entities) => entities.every((e) => e.runtime?.kind === "script" || canRun(world, e, programFor(world, e)));

const COMMANDS = {
  publish(world, { program }) {
    if (!isId(program?.id) || !Number.isInteger(program.revision) || program.compiler !== COMPILER_VERSION || typeof program.start !== "string" || !Array.isArray(program.needs)) return false;
    if (checkProgram(program).length) return false;
    installProgram(world, program);
    return true;
  },
  assign(world, { entity, program }) {
    const e = runner(world, entity);
    if (!e || program === undefined || !hasProgram(world, program)) return false;
    const own = e.own;
    e.own = program;
    if (!canRun(world, e, programFor(world, e))) {
      e.own = own;
      return false;
    }
    startResolved(world, e);
    return true;
  },
  role(world, { entity, role }) {
    const e = robot(world, entity);
    if (!e || role === undefined || (role !== null && !roleOf(world, role))) return false;
    if (!allCanRun(world, [{ ...e, role }])) return false;
    e.role = role;
    rebind(world, [e]);
    return true;
  },
  default(world, command) {
    const { program } = command;
    if (program === undefined || !hasProgram(world, program)) return false;
    // The teams and types as they'd be, to see what everyone would run.
    let { roles, defaults } = world;
    let affected;
    if ("role" in command) {
      if (!roleOf(world, command.role)) return false;
      roles = roles.map((r) => (r.id === command.role ? { ...r, program } : r));
      affected = world.entities.filter((e) => e.role === command.role);
    } else {
      const type = command.entityType;
      if (!TYPES[type] || TYPES[type].kind === "node") return false;
      // A type without a program yet gets one, in order of type.
      defaults = [...defaults.filter((d) => d.type !== type), { type, program }].sort((a, b) => (a.type < b.type ? -1 : 1));
      affected = world.entities.filter((e) => e.type === type);
    }
    if (!allCanRun({ ...world, roles, defaults }, affected)) return false;
    Object.assign(world, { roles, defaults });
    rebind(world, affected);
    return true;
  },
  start(world, { entity }) {
    const e = runner(world, entity);
    if (e?.runtime?.kind !== "program") return false;
    stop(world, e);
    emptyBasket(e);
    e.runtime = startProgram(world.programs.find((p) => p.id === e.runtime.program));
    return true;
  },
  settings(world, { entity, settings }) {
    const e = robot(world, entity);
    if (!e || !settings || typeof settings !== "object" || Array.isArray(settings)) return false;
    const changes = Object.entries(settings);
    if (!changes.every(([slot, value]) => slot in SETTINGS && fitsSetting(world, slot, value))) return false;
    for (const [slot, value] of changes) e.settings[slot] = value;
    // A robot stopped because the setting it read wasn't chosen, or held an
    // item it can't collect, goes on now that one is: its program is still at
    // that block, which it tries again next tick.
    const fixed = (slot) => e.settings[slot] !== null && changes.some(([s]) => s === slot);
    if ((e.error?.code === "error.setting" && fixed(e.error.setting)) || (e.error?.code === "error.collect" && fixed("item"))) e.error = null;
    return true;
  },
  add(world, { robot: given }) {
    if (!isId(given?.id) || thing(world, given.id) || !isName(given.name) || !Array.isArray(given.cell)) return false;
    const [x, z] = given.cell;
    if (!Number.isInteger(x) || !Number.isInteger(z) || !inside(world.terrain, x, z) || !walkable(world)[cellAt(world.terrain, x, z)]) return false;
    const e = makeThing(world.terrain, { id: given.id, type: "helper", name: copy(given.name), cell: [x, z] });
    insertById(world.entities, e);
    // Every robot runs what its type does, if a program is set for that.
    rebind(world, [e]);
    return true;
  },
  name(world, { entity, name }) {
    const e = robot(world, entity);
    const words = typeof name === "string" ? name.trim() : "";
    if (!e || !words || words.length > NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(words)) return false;
    e.name = words;
    return true;
  },
  place(world, request) {
    if (!isRequest(request) || !hasProgram(world, request.program ?? null)) return false;
    const plan = checkPlacement(world, request);
    if (plan.problem) return false;
    const { blueprint } = request;
    const { id, n } = freeId(world, blueprint);
    const site = {
      id,
      kind: "building",
      type: "site",
      name: placedName(blueprint, n, true),
      own: request.program ?? null,
      area: plan.area,
      access: plan.access,
      store: makeStore({ caps: RECIPES[blueprint].inputs }),
      blueprint,
      built: false,
      action: null,
      pending: null,
      error: null,
      runtime: null,
    };
    if (!canRun(world, site, programFor(world, site))) return false;
    const at = world.entities.findIndex((e) => e.id > id);
    world.entities.splice(at < 0 ? world.entities.length : at, 0, site);
    world.nav++;
    const program = programFor(world, site);
    if (program) site.runtime = startProgram(world.programs.find((p) => p.id === program));
    return true;
  },
  script(world, { entity, steps, loop = false }) {
    const e = runner(world, entity);
    if (!e || !Array.isArray(steps)) return false;
    stop(world, e);
    e.runtime = script(steps.map((step) => ({ ...step })), { loop: !!loop });
    return true;
  },
  restart(world, { entity }) {
    const e = runner(world, entity);
    if (!e) return false;
    stop(world, e);
    runtimeOf(e)?.restart(e);
    return true;
  },
  stock(world, { at, item, count }) {
    const t = thing(world, at);
    if (!t || !ITEMS.includes(item) || !Number.isInteger(count) || count < 0) return false;
    setCount(t.store, item, count);
    return true;
  },
};
