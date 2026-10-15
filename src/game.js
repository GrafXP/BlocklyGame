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
export function createGame(world, { clock = createClock() } = {}) {
  let queued = [];
  const log = [];
  let trace = null;
  let resume = false; // running when the page was hidden

  const tick = () => {
    const commands = queued;
    queued = [];
    for (const command of commands) log.push({ tick: world.tick + 1, command });
    trace = advanceWorld(world, commands);
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
    },
    get queued() {
      return queued.length;
    },
    // Runs the ticks due at a frame at `now` ms. Returns how many.
    frame(now) {
      const ticks = clock.frame(now);
      for (let i = 0; i < ticks; i++) tick();
      return ticks;
    },
    run: () => clock.run(),
    pause: () => clock.pause(),
    // One tick, then paused.
    step() {
      clock.pause();
      tick();
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
