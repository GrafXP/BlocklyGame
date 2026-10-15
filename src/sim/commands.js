import { COMPILER_VERSION } from "../programming/compiler.js";
import { checkProgram, startProgram } from "../programming/runtime.js";
import { cancel } from "./actions.js";
import { reason } from "./codes.js";
import { ITEMS, can } from "./entities.js";
import { setCount } from "./inventory.js";
import { runtimeOf } from "./runtimes.js";
import { script } from "./script.js";
import { thing } from "./things.js";

// The player's commands, applied at a tick boundary, first thing in a tick
// (PLAN.md §6, phase 1). Until then they wait in the game's queue, and the world
// runs on as it was. A command is plain data, so a game can be recorded as the
// commands of each tick and played again (replay.js):
//
//   { type: "publish", program: { id, revision, compiler, start, code, needs } }
//        a compiled program (src/programming/compiler.js), new or a new revision:
//        every entity running it starts the new one from its start
//   { type: "assign", entity, program }       `entity` runs program `program` from its start
//   { type: "script", entity, steps, loop }   give `entity` a script to run, from its start
//   { type: "restart", entity }              start `entity`'s program or script again
//   { type: "stock", at, item, count }       set a store's count (the sandbox's resource settings)
//
// Anything that starts an entity again cancels what it was doing: its holds are
// let go and work it finished stays done (PLAN.md §5). Returns { ok: true }, or
// { ok: false, reason } for a command that doesn't fit the world, which changes
// nothing.
export function applyCommand(world, command) {
  const apply = COMMANDS[command?.type];
  const done = apply?.(world, command);
  return done ? { ok: true } : { ok: false, reason: reason("command.invalid", { type: String(command?.type) }) };
}

const runner = (world, id) => {
  const e = thing(world, id);
  return e && e.kind !== "node" ? e : null;
};

function stop(world, entity) {
  cancel(world, entity);
  entity.pending = null;
  entity.error = null;
}

const copy = (value) => JSON.parse(JSON.stringify(value));
// Program ids are the game's own; block ids are Blockly's, any characters.
const isId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value);

const COMMANDS = {
  publish(world, { program }) {
    if (!isId(program?.id) || !Number.isInteger(program.revision) || program.compiler !== COMPILER_VERSION || typeof program.start !== "string" || !Array.isArray(program.needs)) return false;
    if (checkProgram(program).length) return false;
    const { id, revision, compiler, start, code, needs } = copy(program);
    const entry = { id, revision, compiler, start, code, needs };
    const at = world.programs.findIndex((p) => p.id >= id);
    if (world.programs[at]?.id === id) world.programs[at] = entry;
    else world.programs.splice(at < 0 ? world.programs.length : at, 0, entry);
    for (const e of world.entities) {
      if (e.runtime?.kind !== "program" || e.runtime.program !== id) continue;
      stop(world, e);
      e.runtime = startProgram(entry);
    }
    return true;
  },
  assign(world, { entity, program }) {
    const e = runner(world, entity);
    const p = world.programs.find((it) => it.id === program);
    if (!e || !p || !p.needs.every((ability) => can(e, ability))) return false;
    stop(world, e);
    e.runtime = startProgram(p);
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
