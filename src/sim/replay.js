import { advanceWorld, createWorld } from "./world.js";

// Recorded games (PLAN.md §12, after GyroRocket's replays). The world takes
// nothing but the player's commands, a list a tick, so a game is its content and
// its command log, [{ tick, command }], each command applied on its tick. Playing
// the log into a fresh world gives the same world, tick for tick; the golden
// replays (test/golden/) check that it still does.

// Plays `log` in a fresh world of `content` for `ticks` ticks. With `every`, also
// the hash of the world every that many ticks: [[tick, hash], …].
export function play(content, log, ticks, { every = 0 } = {}) {
  const world = createWorld(content);
  const byTick = new Map();
  for (const { tick, command } of log) {
    if (!byTick.has(tick)) byTick.set(tick, []);
    byTick.get(tick).push(command);
  }
  const hashes = [];
  while (world.tick < ticks) {
    advanceWorld(world, byTick.get(world.tick + 1) ?? []);
    if (every && world.tick % every === 0) hashes.push([world.tick, stateHash(world)]);
  }
  return { world, hashes };
}

// `value` as JSON with every object's keys sorted: the same state, built in any
// order, gives the same text.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// A short fingerprint of a world's whole state (FNV-1a, 32 bits, as 8 hex digits).
export function stateHash(world) {
  const text = canonicalJson(world);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
