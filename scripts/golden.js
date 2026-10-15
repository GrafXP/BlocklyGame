// Records the golden replays test/replay.test.js plays back (PLAN.md §12, after
// GyroRocket's): each scenario's command log played into a fresh world, with the
// world's hash every 100 ticks and the whole world at the end. When the
// simulation changes on purpose, bump SIM_VERSION (src/sim/world.js) and record
// them again: npm run golden.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ISLAND } from "../src/content/island.js";
import { play } from "../src/sim/replay.js";
import { SIM_VERSION } from "../src/sim/world.js";

export const GOLDEN_FORMAT = 1;
export const EVERY = 100;

const command = (tick, c) => ({ tick, command: c });

// The scenarios: the island left to its scripts for five minutes of play, and
// the island with the player stepping in, restarting robots and buildings in the
// middle of their work, giving one a new script and changing stores.
export const SCENARIOS = {
  island: { content: ISLAND, ticks: 3000, log: [] },
  commands: {
    content: ISLAND,
    ticks: 2000,
    log: [
      command(14, { type: "restart", entity: "r1" }),
      command(95, { type: "restart", entity: "sawmill" }),
      command(160, { type: "script", entity: "r2", steps: [{ type: "goTo", target: "depot" }, { type: "wait", steps: 30 }, { type: "goTo", target: "camp" }], loop: true }),
      command(300, { type: "stock", at: "site", item: "plank", count: 4 }),
      command(420, { type: "stock", at: "grove", item: "wood", count: 0 }),
      command(700, {
        type: "script",
        entity: "r2",
        steps: [{ type: "goTo", target: "sawmill" }, { type: "pickUp", item: "plank" }, { type: "goTo", target: "depot" }, { type: "unload" }],
        loop: true,
      }),
      command(900, { type: "restart", entity: "r3" }),
      command(900, { type: "stock", at: "quarry", item: "stone", count: 8 }),
      command(1500, { type: "restart", entity: "site" }),
    ],
  },
};

export function record(name) {
  const { content, ticks, log } = SCENARIOS[name];
  const { world, hashes } = play(content, log, ticks, { every: EVERY });
  return { format: GOLDEN_FORMAT, sim: SIM_VERSION, content: world.content, scenario: name, ticks, log, hashes, final: world };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = new URL("../test/golden/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const name of Object.keys(SCENARIOS)) {
    const golden = record(name);
    writeFileSync(new URL(`${name}.json`, dir), `${JSON.stringify(golden)}\n`);
    console.log(`${name}: ${golden.ticks} ticks, ${golden.log.length} commands, final ${golden.hashes.at(-1)[1]}`);
  }
}
