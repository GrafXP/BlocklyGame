import { test } from "node:test";
import assert from "node:assert/strict";
import { createClock, createGame, MAX_TICKS_PER_FRAME } from "../src/game.js";
import { advanceWorld, createWorld } from "../src/sim/world.js";
import { stateHash } from "../src/sim/replay.js";
import { ISLAND } from "../src/content/island.js";

// The fixed-step driver (PLAN.md §6): frames turn into whole ticks at the chosen
// speed, whatever the frame rate; Pause adds none, Step exactly one.

// Frames at the times `times` (ms): the ticks due at each.
const frames = (clock, times) => times.map((t) => clock.frame(t));

test("the clock turns time into whole ticks, ten a second at 1×, keeping the remainder", () => {
  const clock = createClock();
  clock.run();
  // The first frame only sets the clock going.
  assert.deepEqual(frames(clock, [1000, 1100, 1250, 1300, 1400]), [0, 1, 1, 1, 1]);
  assert.ok(Math.abs(clock.alpha) < 1e-9, "on a tick exactly");
  clock.frame(1450);
  assert.ok(Math.abs(clock.alpha - 0.5) < 1e-9, "half way to the next");
});

test("speed changes how often ticks come, not what a tick does", () => {
  for (const [speed, ticks] of [
    [0.5, 5],
    [1, 10],
    [2, 20],
    [4, 40],
  ]) {
    const clock = createClock();
    clock.setSpeed(speed);
    clock.run();
    const due = frames(clock, Array.from({ length: 61 }, (_, i) => (i * 1000) / 60));
    assert.equal(
      due.reduce((a, b) => a + b, 0),
      ticks,
      `${speed}× for a second at 60 frames a second`,
    );
  }
  const clock = createClock();
  clock.setSpeed(3);
  assert.equal(clock.speed, 1, "only the speeds on offer");
});

test("after a long frame, at most a few ticks catch up and the rest of the time is dropped", () => {
  const clock = createClock();
  clock.run();
  assert.deepEqual(frames(clock, [0, 5000, 5100]), [0, MAX_TICKS_PER_FRAME, 1]);
});

test("paused, no ticks come and no time builds up; Pause forgets time not yet ticked", () => {
  const clock = createClock();
  assert.deepEqual(frames(clock, [0, 1000, 2000]), [0, 0, 0]);
  clock.run();
  assert.deepEqual(frames(clock, [3000, 3150]), [0, 1]);
  clock.pause();
  assert.equal(clock.alpha, 0);
  clock.run();
  assert.deepEqual(frames(clock, [9000, 9060, 9100]), [0, 0, 1], "the 50 ms owed before the pause are gone");
});

test("Step advances the world exactly one tick and leaves it paused; Pause changes nothing", () => {
  const game = createGame(createWorld(ISLAND));
  game.run();
  game.frame(0);
  game.frame(100);
  assert.equal(game.world.tick, 1);
  game.step();
  assert.equal(game.world.tick, 2);
  assert.equal(game.clock.running, false);
  const hash = stateHash(game.world);
  for (let t = 200; t < 3000; t += 16) game.frame(t);
  assert.equal(game.world.tick, 2);
  assert.equal(stateHash(game.world), hash);
});

test("commands wait for the next tick, and are logged with it", () => {
  const game = createGame(createWorld(ISLAND));
  game.step();
  game.queue({ type: "restart", entity: "r1" });
  assert.equal(game.queued, 1);
  assert.equal(game.world.entities.find((e) => e.id === "r1").action.start, 1, "not yet");
  game.step();
  assert.equal(game.queued, 0);
  assert.deepEqual(game.log, [{ tick: 2, command: { type: "restart", entity: "r1" } }]);
  assert.equal(game.world.entities.find((e) => e.id === "r1").action.start, 2);
  assert.deepEqual(game.trace.commands, [{ ok: true }]);
});

test("a hidden page pauses the world and doesn't make up the time; shown again, it goes on", () => {
  const game = createGame(createWorld(ISLAND));
  game.run();
  game.frame(0);
  game.frame(100);
  game.hidden(true);
  game.frame(60_000);
  game.hidden(false);
  assert.equal(game.world.tick, 1);
  assert.equal(game.clock.running, true);
  game.frame(60_100);
  game.frame(60_200);
  assert.equal(game.world.tick, 2);

  const paused = createGame(createWorld(ISLAND));
  paused.hidden(true);
  paused.hidden(false);
  assert.equal(paused.clock.running, false, "paused before, paused after");
});

test("running at any frame rate gives the world that the same number of Steps gives", () => {
  for (const [name, gap] of [
    ["60 frames a second", () => 1000 / 60],
    ["30 frames a second", () => 1000 / 30],
    ["uneven frames", (i) => [3, 41, 17, 120, 9, 260][i % 6]],
  ]) {
    const game = createGame(createWorld(ISLAND));
    game.clock.setSpeed(4);
    game.run();
    let now = 0;
    for (let i = 0; now < 12_000; i++) {
      game.frame(now);
      now += gap(i);
    }
    const stepped = createWorld(ISLAND);
    while (stepped.tick < game.world.tick) advanceWorld(stepped);
    assert.ok(game.world.tick > 300, `${name}: ${game.world.tick} ticks`);
    assert.equal(stateHash(game.world), stateHash(stepped), name);
  }
});
