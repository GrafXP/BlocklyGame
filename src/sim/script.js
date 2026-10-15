// A script: a fixed list of intents an entity carries out in order, once or over
// and over. It stands in for compiled Blockly programs until Phase 2, through the
// same small interface any runtime has (world.js, RUNTIMES):
//
//   next(entity, now)  the intent to try now, or null when there's nothing left
//   done(entity)       the action of the last intent has ended
//   restart(entity)    back to the first step
//   finished(entity)   whether there's nothing left to do
//
// Its state is plain data on the entity:
//
//   { kind: "script", steps: [intent, …], loop, at, evaluated: { step, tick } | null }
//
// `at` is the step under way: the active block, kept while its action runs or
// waits. `evaluated` is the step last tried, and when.
export const scriptRuntime = {
  next(entity, now) {
    const run = entity.runtime;
    if (run.at >= run.steps.length) return null;
    run.evaluated = { step: run.at, tick: now };
    return { ...run.steps[run.at] }; // a copy: state never shares objects, so a save restores it exactly
  },
  done(entity) {
    const run = entity.runtime;
    run.at++;
    if (run.loop && run.at >= run.steps.length) run.at = 0;
  },
  restart(entity) {
    entity.runtime.at = 0;
    entity.runtime.evaluated = null;
  },
  finished: (entity) => entity.runtime.at >= entity.runtime.steps.length,
};

export const script = (steps, { loop = false } = {}) => ({ kind: "script", steps, loop, at: 0, evaluated: null });
