import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { SIM_VERSION } from "../src/sim/world.js";
import { canonicalJson, play } from "../src/sim/replay.js";
import { EVERY, GOLDEN_FORMAT, SCENARIOS } from "../scripts/golden.js";

// The golden replays (PLAN.md §12): recorded command logs played into a fresh
// world must give the recorded world, hash for hash, every 100 ticks.

const dir = new URL("./golden/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const golden = (file) => JSON.parse(readFileSync(new URL(file, dir), "utf8"));

test("there's a golden replay for each scenario scripts/golden.js records", () => {
  assert.deepEqual(files.sort(), Object.keys(SCENARIOS).map((name) => `${name}.json`).sort());
});

// When one of these fails, the simulation has changed what the same commands
// do. If that was meant, bump SIM_VERSION (src/sim/world.js) and record the
// replays again: npm run golden.
for (const file of files) {
  test(`golden replay ${file} gives the recorded world, tick for tick`, () => {
    const g = golden(file);
    const scenario = SCENARIOS[g.scenario];
    assert.equal(g.format, GOLDEN_FORMAT);
    assert.equal(g.sim, SIM_VERSION, "recorded with another SIM_VERSION: npm run golden");
    assert.deepEqual(g.content, { id: scenario.content.id, version: scenario.content.version }, "recorded on another version of the island: npm run golden");
    assert.equal(canonicalJson(g.log), canonicalJson(scenario.log), "the scenario's commands have changed: npm run golden");
    const { world, hashes } = play(scenario.content, g.log, g.ticks, { every: EVERY });
    const first = hashes.findIndex(([tick, hash], i) => hash !== g.hashes[i]?.[1]);
    assert.equal(first, -1, first >= 0 ? `the worlds part by tick ${hashes[first][0]}` : "");
    assert.deepEqual(world, g.final);
  });
}

test("a replay with any one command left out gives another world on the way", () => {
  const { content, ticks, log } = SCENARIOS.commands;
  const g = golden("commands.json");
  for (let i = 0; i < log.length; i++) {
    const { hashes } = play(content, log.toSpliced(i, 1), ticks, { every: EVERY });
    assert.notDeepEqual(hashes, g.hashes, `without ${JSON.stringify(log[i]).slice(0, 80)}`);
  }
});
