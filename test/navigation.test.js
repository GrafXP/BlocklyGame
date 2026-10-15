import { test } from "node:test";
import assert from "node:assert/strict";
import { findPath, walkable } from "../src/sim/navigation.js";
import { cellAt, parseTerrain } from "../src/sim/terrain.js";
import { createWorld } from "../src/sim/world.js";
import { ISLAND } from "../src/content/island.js";
import { tinyWorld } from "./helpers.js";

const cells = (world, ...xz) => xz.map(([x, z]) => cellAt(world.terrain, x, z));
const xz = (world, path) => path.map((c) => [c % world.terrain.width, Math.floor(c / world.terrain.width)]);

test("terrain is read from rows of characters, and refuses uneven rows or unknown kinds", () => {
  const t = parseTerrain(["~,.", "=+~"]);
  assert.deepEqual(t, { width: 3, height: 2, kinds: "~,.=+~", heights: "011010" });
  assert.throws(() => parseTerrain(["~~", "~"]), /row 1/);
  assert.throws(() => parseTerrain(["~x"]), /kind "x"/);
});

test("a path is a shortest one, cell by neighbouring cell, and ties always break the same way", () => {
  const world = tinyWorld();
  const [from, to] = cells(world, [1, 1], [3, 3]);
  const path = findPath(world, from, [to]);
  // North, east, south, west are tried in that order, and of equal ways the one
  // nearer the goal, then the one found first, wins: here east before south.
  assert.deepEqual(xz(world, path), [
    [1, 1],
    [2, 1],
    [3, 1],
    [3, 2],
    [3, 3],
  ]);
  assert.deepEqual(findPath(world, from, [to]), path);
  assert.deepEqual(findPath(world, from, [from]), [from]);
});

test("a path leads to the nearest of several goals, and around footprints", () => {
  const world = tinyWorld({
    entities: [{ id: "wall", type: "depot", name: "wall", area: { x: 3, z: 1, w: 1, d: 2 }, access: [[4, 3]], caps: {} }],
  });
  const [from, near, far] = cells(world, [1, 1], [5, 1], [8, 3]);
  const path = findPath(world, from, [far, near]);
  assert.equal(path.at(-1), near);
  const blocked = cells(world, [3, 1], [3, 2]);
  assert.ok(!path.some((c) => blocked.includes(c)), "not through the wall");
  assert.equal(path.length - 1, 8, "down round the wall and back up");
});

test("no way, or only water, gives no path", () => {
  const world = tinyWorld({ terrain: ["~~~~~", "~.~.~", "~~~~~"] });
  const [a, b, water] = cells(world, [1, 1], [3, 1], [2, 1]);
  assert.equal(findPath(world, a, [b]), null);
  assert.equal(findPath(world, a, [water]), null);
});

test("on the island, every thing can be reached from the camp, except across the stream until the bridge is built", () => {
  const world = createWorld(ISLAND);
  const walk = walkable(world);
  const camp = world.entities.find((e) => e.id === "r1").cell;
  for (const t of [...world.entities, ...world.nodes].filter((t) => t.access)) {
    for (const cell of t.access) assert.equal(walk[cell], 1, `${t.id}'s access cell ${cell} can be walked on`);
    const path = findPath(world, camp, t.access);
    if (t.id === "quarry") assert.equal(path, null, "the stone pit is across the stream");
    else assert.ok(path, `${t.id} can be reached`);
  }
});
