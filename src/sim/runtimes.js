import { programRuntime } from "../programming/runtime.js";
import { scriptRuntime } from "./script.js";

// What drives each entity, by entity.runtime.kind: a compiled Blockly program
// (src/programming/runtime.js), or a fixed script (script.js). The world only
// ever calls a runtime through this interface, so it doesn't matter which:
//
//   next(entity, world, now)  in the runtimes' phase of tick `now`, when the
//                             entity is free: evaluates one visible step at most,
//                             reading the world and changing only the runtime.
//                             Returns null when there's nothing more to do, or
//                             { block?, intent?, error?, … }: the block evaluated,
//                             the action to try, or why the program can't go on.
//   done(entity)              the action of the active step has ended
//   restart(entity)           back to the start
//   finished(entity)          whether there's nothing more to do
//   waiting(entity)           a reason when it waits by itself (Wait Until), else null
//   active(entity)            the active block's id, or null
export const RUNTIMES = { script: scriptRuntime, program: programRuntime };

export const runtimeOf = (entity) => (entity.runtime ? RUNTIMES[entity.runtime.kind] : null);
