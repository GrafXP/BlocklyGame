// Records the golden replays test/replay.test.js plays back (PLAN.md §12, after
// GyroRocket's): each scenario's command log played into a fresh world, with the
// world's hash every 100 ticks and the whole world at the end. When the
// simulation changes on purpose, bump SIM_VERSION (src/sim/world.js) and record
// them again: npm run golden.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { missionStart, playMission, referenceCommands } from "../src/campaign.js";
import { ISLAND } from "../src/content/island.js";
import { CAMPAIGN } from "../src/content/missions/campaign.js";
import { SLICE } from "../src/content/missions/slice.js";
import { ISLAND_PROGRAMS } from "../src/content/programs.js";
import { COMPILER_VERSION, compile } from "../src/programming/compiler.js";
import { play, stateHash } from "../src/sim/replay.js";
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

// The slice's reference program `id` (src/content/missions/slice.js), compiled,
// as revision 2.
const reference = (id) => ({ type: "publish", program: { id, revision: 2, ...compile(SLICE.reference[id]).program } });

// Island program `id`'s blocks as a new program `as`, revision 1: a copy.
const copied = (id, as) => ({ type: "publish", program: { id: as, revision: 1, ...compile(ISLAND_PROGRAMS.find((p) => p.id === id).source).program } });

// The scenarios: the island left to its programs for five minutes of play; the
// island with the player stepping in: restarting robots and buildings in the
// middle of their work, giving one a script, changing stores, publishing a new
// revision of a program that's running and of one that isn't, and giving a robot
// a program again; the bridge slice, run for a while before the player
// changes the courier's program, while its basket is still empty, and later the
// site's, after which the bridge is built, the mission done, and Robo 3 given its
// reward; and the island with Phase 6's choices: Robo 3 joins the Wood team,
// whose program becomes the shared Collector, each robot doing what its own
// settings say; Robo 2 gets its own copy of its program, and later goes back to
// its team's; a setting changes mid-run; a robot is named; and a workshop is
// placed east of the stream, given its materials, built, and makes kits.
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
  slice: {
    content: SLICE.content,
    ticks: 1500,
    log: [command(50, reference("courier")), command(120, reference("bridge"))],
  },
  teams: {
    content: ISLAND,
    ticks: 2000,
    log: [
      command(10, { type: "role", entity: "r3", role: "wood-team" }),
      command(60, { type: "default", role: "wood-team", program: "fetch" }),
      command(150, copied("courier", "courier-r2")),
      command(150, { type: "assign", entity: "r2", program: "courier-r2" }),
      command(300, { type: "place", blueprint: "workshop", x: 24, z: 17, facing: "south", program: "build-workshop" }),
      command(320, { type: "stock", at: "workshop", item: "plank", count: 4 }),
      command(320, { type: "stock", at: "workshop", item: "stone", count: 2 }),
      command(400, { type: "settings", entity: "r1", settings: { destination: "depot" } }),
      command(500, { type: "name", entity: "r1", name: "Blinky" }),
      command(600, { type: "stock", at: "workshop", item: "plank", count: 4 }),
      command(600, { type: "stock", at: "workshop", item: "stone", count: 2 }),
      command(1000, { type: "assign", entity: "r2", program: null }),
    ],
  },
};

export function record(name) {
  const { content, ticks, log } = SCENARIOS[name];
  const { world, hashes } = play(content, log, ticks, { every: EVERY });
  return { format: GOLDEN_FORMAT, sim: SIM_VERSION, content: world.content, scenario: name, ticks, log, hashes, final: world };
}

// Every mission of the campaign played from its start by its reference
// solution (src/campaign.js): for each, the step it was done in and the world's
// hash then. test/campaign.test.js plays them again.
export function recordCampaign() {
  let content = null;
  const missions = CAMPAIGN.map((mission) => {
    const { world, library } = missionStart(mission);
    content = world.content;
    playMission(world, referenceCommands(world, library, mission), mission.steps);
    return { id: mission.id, done: world.mission.done, hash: stateHash(world) };
  });
  return { format: GOLDEN_FORMAT, sim: SIM_VERSION, compiler: COMPILER_VERSION, content, missions };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = new URL("../test/golden/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const name of Object.keys(SCENARIOS)) {
    const golden = record(name);
    writeFileSync(new URL(`${name}.json`, dir), `${JSON.stringify(golden)}\n`);
    console.log(`${name}: ${golden.ticks} ticks, ${golden.log.length} commands, final ${golden.hashes.at(-1)[1]}`);
  }
  mkdirSync(new URL("campaign/", dir), { recursive: true });
  const campaign = recordCampaign();
  writeFileSync(new URL("campaign/missions.json", dir), `${JSON.stringify(campaign)}\n`);
  console.log(`campaign: ${campaign.missions.length} missions, last done at step ${campaign.missions.at(-1).done}, final ${campaign.missions.at(-1).hash}`);
}
