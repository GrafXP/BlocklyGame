// Records the golden replays test/replay.test.js plays back (PLAN.md §12, after
// GyroRocket's): each scenario's command log played into a fresh world, with the
// world's hash every 100 ticks and the whole world at the end. When the
// simulation changes on purpose, bump SIM_VERSION (src/sim/world.js) and record
// them again: npm run golden.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ISLAND } from "../src/content/island.js";
import { ISLAND_PROGRAMS } from "../src/content/programs.js";
import { compile } from "../src/programming/compiler.js";
import { play } from "../src/sim/replay.js";
import { SIM_VERSION } from "../src/sim/world.js";

export const GOLDEN_FORMAT = 1;
export const EVERY = 100;

const command = (tick, c) => ({ tick, command: c });

// Island program `id`, compiled, as revision `revision`; `change` edits its
// workspace's JSON first.
function published(id, revision, change = (json) => json) {
  const source = JSON.parse(change(JSON.stringify(ISLAND_PROGRAMS.find((p) => p.id === id).source)));
  return { type: "publish", program: { id, revision, ...compile(source).program } };
}

// The scenarios: the island left to its programs for five minutes of play, and
// the island with the player stepping in: restarting robots and buildings in the
// middle of their work, giving one a script, changing stores, publishing a new
// revision of a program that's running and of one that isn't, and giving a robot
// a program again.
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
      command(1050, published("planks", 2)),
      command(1100, published("courier", 2, (json) => json.replace('"PLACE":"site"', '"PLACE":"depot"'))),
      command(1200, { type: "assign", entity: "r2", program: "courier" }),
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
