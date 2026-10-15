import assert from "node:assert/strict";
import { advanceWorld, createWorld } from "../src/sim/world.js";
import { checkWorld } from "../src/sim/validate.js";

// A field of grass with water round it, 10 cells by 5: x 1–8, z 1–3 walkable.
export const FIELD = ["~~~~~~~~~~", "~........~", "~........~", "~........~", "~~~~~~~~~~"];

// A small world for one test, with `programs` ({ id: workspace JSON }) for its
// entities to run.
export const tinyWorld = ({ terrain = FIELD, entities = [], nodes = [], programs = {} } = {}) =>
  createWorld({ id: "test", version: 1, terrain, entities, nodes, programs: Object.entries(programs).map(([id, source]) => ({ id, source })) });

// A helper robot at cell [x, z] that runs `steps`.
export const robot = (id, cell, steps = [], { loop = false, items } = {}) => ({ id, type: "helper", name: id, cell, items, script: { steps, loop } });

// A helper robot at cell [x, z] that runs program `program`.
export const bot = (id, cell, program, { items } = {}) => ({ id, type: "helper", name: id, cell, items, program });

// Advances `world` `ticks` ticks, checking the world's rules after each one;
// `commands[tick]` are applied on that tick. Returns the ticks' traces.
export function run(world, ticks, commands = {}) {
  const traces = [];
  for (let i = 0; i < ticks; i++) {
    const trace = advanceWorld(world, commands[world.tick + 1] ?? []);
    assert.deepEqual(checkWorld(world), [], `after tick ${world.tick}`);
    traces.push(trace);
  }
  return traces;
}

// Runs until `done(world)` or `limit` ticks, checking the rules each tick.
export function runUntil(world, done, limit = 5000) {
  const start = world.tick;
  while (!done(world)) {
    assert.ok(world.tick - start < limit, `not done after ${limit} ticks`);
    run(world, 1);
  }
  return world.tick;
}

export const byId = (world, id) => world.entities.find((e) => e.id === id) ?? world.nodes.find((n) => n.id === id);
