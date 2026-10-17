import { runtimeOf } from "./sim/runtimes.js";
import { advanceWorld, TICKS_PER_SECOND } from "./sim/world.js";

// The fixed-step driver (PLAN.md §6): the only caller of advanceWorld. A page
// calls frame(now) on every animation frame; the clock turns the time since the
// last frame into whole ticks, at the chosen speed, so how often ticks run never
// depends on the frame rate. Rendering reads the world and `alpha`, how far the
// clock is towards the next tick, and changes neither. No DOM here: pages bind
// frames and the page's visibility.

export const SPEEDS = [0.5, 1, 2, 4];

// After a long frame (a stall, a breakpoint), at most this many ticks catch up
// and the rest of the time is dropped, rather than freezing to catch up.
export const MAX_TICKS_PER_FRAME = 8;

// The most ticks Step to Next Block runs before it gives up and pauses: a
// minute of play at 1×.
export const NEXT_BLOCK_TICKS = 600;

// Whether entity `id` took a new step in the tick of `trace`, having been at
// block `before`: it evaluated a block, other than trying again the Wait Until
// it was already waiting at and finding it still false; or its program stopped
// with an error.
export function tookNewStep(trace, id, before) {
  if (trace.errors.some((e) => e.entity === id)) return true;
  const seen = trace.evaluated.find((e) => e.entity === id);
  return !!seen && !(seen.test === false && seen.block === before);
}

// Whether `entity` can take another step without the player: it has something
// to run that hasn't stopped with an error or come to its end.
const canGoOn = (entity) => !!runtimeOf(entity) && !entity.error && !runtimeOf(entity).finished(entity);

// How many ticks each frame is due. Paused, none, and no time builds up.
export function createClock({ rate = TICKS_PER_SECOND, maxPerFrame = MAX_TICKS_PER_FRAME } = {}) {
  const tickMs = 1000 / rate;
  let running = false;
  let speed = 1;
  let owed = 0; // ms of play not yet ticked
  let last = null; // the last frame's time

  return {
    get running() {
      return running;
    },
    get speed() {
      return speed;
    },
    // How far towards the next tick, 0 to 1, for drawing between ticks.
    get alpha() {
      return running ? Math.min(1, owed / tickMs) : 0;
    },
    run() {
      running = true;
      last = null;
    },
    // Stops, and forgets time that hadn't made a tick yet.
    pause() {
      running = false;
      owed = 0;
      last = null;
    },
    setSpeed(value) {
      if (SPEEDS.includes(value)) speed = value;
    },
    // The ticks due at a frame at `now` ms.
    frame(now) {
      if (!running || last === null) {
        last = now;
        return 0;
      }
      owed += Math.max(0, now - last) * speed;
      last = now;
      let ticks = Math.floor(owed / tickMs);
      if (ticks > maxPerFrame) {
        ticks = maxPerFrame;
        owed = 0;
      } else owed -= ticks * tickMs;
      return ticks;
    },
  };
}

// A world under the clock: the player's commands wait in a queue and are applied
// at the next tick, by Step or by the running clock, and every command is logged
// with its tick, so the game can be played again (src/sim/replay.js). `trace` is
// the last tick's (advanceWorld).
//
// When a mission's trial is passed and the next one staged, the clock pauses
// at that tick, so the player sees what changed for the next trial before it
// runs (docs/campaign-plan.md: “The child sees what changed between them”).
export function createGame(world, { clock = createClock() } = {}) {
  let queued = [];
  let version = 0; // counted up whenever the queue changes
  const log = [];
  let trace = null;
  let resume = false; // running when the page was hidden

  const tick = () => {
    const commands = queued;
    queued = [];
    if (commands.length) version++;
    for (const command of commands) log.push({ tick: world.tick + 1, command });
    trace = advanceWorld(world, commands);
    if (trace.passed !== null && !trace.done) clock.pause();
  };

  return {
    world,
    clock,
    log,
    get trace() {
      return trace;
    },
    queue(command) {
      queued.push(command);
      version++;
    },
    get queued() {
      return queued.length;
    },
    // The commands waiting for the next tick, in order; and a number that
    // changes whenever they do.
    get pending() {
      return queued;
    },
    get queueVersion() {
      return version;
    },
    // Runs the ticks due at a frame at `now` ms, fewer if the clock pauses on
    // the way. Returns how many.
    frame(now) {
      const ticks = clock.frame(now);
      for (let i = 0; i < ticks; i++) {
        tick();
        if (!clock.running) return i + 1;
      }
      return ticks;
    },
    run: () => clock.run(),
    pause: () => clock.pause(),
    // One tick, then paused.
    step() {
      clock.pause();
      tick();
    },
    // Step to Next Block (PLAN.md §6): ticks, then paused, until entity `id`
    // takes a new step (tookNewStep), or, with no id, any entity does. Every
    // entity moves on in the same ticks, as if Step were pressed that many times.
    // An entity that can't go on by itself (stopped, or not a robot or building)
    // counts as none chosen. Stops too when the whole world has stalled, when a
    // trial is passed, and after NEXT_BLOCK_TICKS. Returns how many ticks it ran.
    nextBlock(id = null, limit = NEXT_BLOCK_TICKS) {
      clock.pause();
      const chosen = world.entities.find((e) => e.id === id);
      const watched = chosen && canGoOn(chosen) ? [chosen] : world.entities;
      for (let n = 1; n <= limit; n++) {
        const before = watched.map((e) => runtimeOf(e)?.active(e) ?? null);
        tick();
        if (world.stall || trace.passed !== null || watched.some((e, i) => tookNewStep(trace, e.id, before[i]))) return n;
      }
      return limit;
    },
    // A hidden page pauses, and doesn't make up the time when it's shown again;
    // the world goes on if it was running.
    hidden(isHidden) {
      if (isHidden) {
        resume = clock.running;
        clock.pause();
      } else if (resume) {
        resume = false;
        clock.run();
      }
    },
  };
}
