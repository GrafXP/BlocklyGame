import { cancel } from "./actions.js";
import { reason } from "./codes.js";
import { ITEMS } from "./entities.js";
import { setCount } from "./inventory.js";
import { runtimeOf } from "./runtimes.js";
import { script } from "./script.js";
import { thing } from "./things.js";

// The player's commands, applied at a tick boundary, first thing in a tick
// (PLAN.md §6, phase 1). Until then they wait in the game's queue, and the world
// runs on as it was. A command is plain data, so a game can be recorded as the
// commands of each tick and played again (replay.js):
//
//   { type: "script", entity, steps, loop }  give `entity` a script to run, from its start
//   { type: "restart", entity }              start `entity`'s script again
//   { type: "stock", at, item, count }       set a store's count (the sandbox's resource settings)
//
// Giving a script or restarting cancels what the entity was doing: its holds are
// let go and work it finished stays done. Returns { ok: true }, or { ok: false,
// reason } for a command that doesn't fit the world, which changes nothing.
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

const COMMANDS = {
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
