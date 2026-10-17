import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toolboxFor } from "../src/blockly/toolboxes.js";
import { missionStart, playMission, referenceCommands } from "../src/campaign.js";
import { CAMPAIGN, campaignMission, mainProgram, unlockedBlocks } from "../src/content/missions/campaign.js";
import { thingOf } from "../src/content/missions/island.js";
import { program as write } from "../src/content/missions/write.js";
import { COMPILER_VERSION } from "../src/programming/compiler.js";
import { stateHash } from "../src/sim/replay.js";
import { checkWorld } from "../src/sim/validate.js";
import { SIM_VERSION } from "../src/sim/world.js";
import { verifyCampaign } from "../scripts/verify-missions.js";
import { byId } from "./helpers.js";

// The campaign (PLAN.md §9; docs/campaign-plan.md): forty missions, each
// standing alone, a start set and its goals. Every mission's reference
// solution does it from its start, and its starters alone don't
// (verify:missions); each mission played so gives the recorded world; each
// lesson's deliberate mistake fails as the lesson says; and every mission
// starts with its own programs alone and its resources as the island starts
// them, the same every time.

const copy = (value) => JSON.parse(JSON.stringify(value));
const mission = (id) => campaignMission(id);

// Mission `id` from its own checkpoint, with `programs` ({ id: source })
// applied and `commands` given before the first step, as the player would.
// Returns the world after the mission's steps, or once it's done.
function playWith(id, { programs = {}, commands = [] } = {}) {
  const m = mission(id);
  const { world, library } = missionStart(m);
  const commandsOf = referenceCommands(world, library, { ...m, reference: { programs, commands } });
  playMission(world, commandsOf, m.steps);
  return world;
}

test("every mission is verified: its reference does it from its start, its starters don't, within its steps, toolbox, budget and words", async () => {
  const { problems, rows } = await verifyCampaign();
  assert.deepEqual(problems, []);
  assert.equal(rows.length, 40);
  for (const row of rows) assert.ok(row.ticks !== null, row.id);
});

test("every mission played from its start by its reference solution gives the recorded world", () => {
  const golden = JSON.parse(readFileSync(new URL("./golden/campaign/missions.json", import.meta.url), "utf8"));
  assert.equal(golden.sim, SIM_VERSION, "recorded with another SIM_VERSION: npm run golden");
  assert.equal(golden.compiler, COMPILER_VERSION, "recorded with another COMPILER_VERSION: npm run golden");
  for (const [i, m] of CAMPAIGN.entries()) {
    const { world, library } = missionStart(m);
    playMission(world, referenceCommands(world, library, m), m.steps);
    assert.deepEqual({ id: m.id, done: world.mission.done, hash: stateHash(world) }, golden.missions[i], `the worlds part at ${m.id}`);
  }
});

// --- Each lesson's mistake fails as the lesson says --------------------------------------

test("mission 4: collecting before going to the grove stops Robo 1 where it stands", () => {
  const world = playWith("m04");
  assert.equal(byId(world, "r1").error.code, "error.notHere");
  assert.equal(world.mission.done, null);
});

test("mission 8: a third Collect waits for room in the basket, and mission 10's loop without the way home stalls", () => {
  const eight = playWith("m08");
  assert.equal(byId(eight, "r1").pending.reason.code, "wait.space");
  const ten = playWith("m10");
  assert.ok(ten.stall, "the world stalls");
  assert.equal(byId(ten, "r1").pending.reason.code, "wait.space");
});

test("mission 9: four pieces in four trips aren't two full baskets", () => {
  const fours = write("m09", (p) => p.workspace(p.start(p.repeat(4, p.go("grove"), p.collect(), p.go("camp"), p.unload()))));
  const world = playWith("m09", { programs: { m09: fours } });
  assert.equal(world.mission.done, null);
  assert.equal(world.mission.goals[0].done, null);
});

test("mission 10: a fourth delivery is one too many for the exact order", () => {
  const four = write("m10", (p) => p.workspace(p.start(p.repeat(4, p.go("grove"), p.collect(), p.go("camp"), p.unload()))));
  const world = playWith("m10", { programs: { m10: four } });
  assert.ok(world.mission.goals[0].failed);
  assert.equal(world.mission.done, null);
});

test("mission 16: a number in the Repeat passes one trial only; the sensor passes both", () => {
  const two = playWith("m16");
  assert.equal(two.mission.trial, 0, "two pickups wait for a second plank in the first trial");
  assert.equal(byId(two, "r2").pending.reason.code, "wait.item");
  const one = write("m16", (p) => p.workspace(p.start(p.repeat(1, p.pickUp()), p.go("depot"), p.unload())));
  const world = playWith("m16", { programs: { m16: one } });
  assert.equal(world.mission.passed.length, 1, "one pickup passes the first trial");
  assert.equal(world.mission.done, null, "but not the second");
});

test("mission 17: making a plank outside the If makes one too many in the second trial", () => {
  const always = write("m17", (p) => p.workspace(p.start(p.make())));
  const world = playWith("m17", { programs: { m17: always } });
  assert.deepEqual([world.mission.passed.length, !!world.mission.goals[0].failed], [1, true]);
});

test("mission 18: without Else, the second trial brings no wood", () => {
  const world = playWith("m18");
  assert.equal(world.mission.passed.length, 1);
  assert.equal(world.mission.done, null);
});

test("mission 19: setting off before both planks are ready fails, though both get delivered", () => {
  const world = playWith("m19");
  assert.ok(world.mission.goals[0].failed, "Robo 2 waited at the sawmill");
  assert.equal(world.mission.trial, 0);
});

test("mission 20: a sawmill that makes planks without looking keeps more than two", () => {
  const greedy = write("m20", (p) => p.workspace(p.start(p.forever(p.make()))));
  const world = playWith("m20", { programs: { m20: greedy } });
  assert.equal(world.mission.done, null);
  assert.equal(byId(world, "sawmill").store.items.plank, 4);
});

test("mission 24: taking Forever out of the shared program stops Robo 1 too", () => {
  const once = write("m24", (p) => p.workspace(p.start(p.go(p.mine("source")), p.repeat(2, p.collect(p.mine("item"))), p.go(p.mine("destination")), p.unload())));
  const world = playWith("m24", { programs: { m24: once } });
  assert.equal(world.mission.done, null);
  assert.equal(world.mission.goals.find((g) => g.id === "r3").done !== null, true, "Robo 3's one trip is fine");
  assert.equal(world.mission.goals.find((g) => g.id === "r1").done, null, "but Robo 1 made only one");
});

test("mission 25: a whole kit's three pieces don't fit in one basket, so one trip each isn't enough", () => {
  const once = write("m25-planks", (p) => p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload())));
  const stones = write("m25-stones", (p) => p.workspace(p.start(p.go("quarry"), p.repeat(2, p.collect("stone")), p.go("workshop"), p.unload())));
  const world = playWith("m25", {
    programs: { "m25-planks": once, "m25-stones": stones },
    commands: [
      { type: "assign", entity: "r2", program: "m25-planks" },
      { type: "assign", entity: "r3", program: "m25-stones" },
    ],
  });
  assert.equal(world.mission.done, null);
  assert.equal(world.mission.tally.made["workshop|kit"], 1);
});

// --- Every mission stands alone --------------------------------------------------------

test("every mission starts with its own programs alone, every building empty and every deposit full, but for what its lesson stages", () => {
  const ids = (list) => list.map((p) => p.id).sort();
  for (const m of CAMPAIGN) {
    const { world, library } = missionStart(m);
    assert.deepEqual(checkWorld(world), [], `${m.id}'s start`);
    assert.equal(world.tick, 0);
    assert.deepEqual(ids(library.programs), ids(m.programs), `${m.id}'s library`);
    assert.ok(world.programs.every((p) => m.programs.some((it) => it.id === p.id)), `${m.id} has no other mission's programs`);
    const staged = new Set(Object.keys({ ...m.setup.stock, ...m.trials?.[0].stage?.stock }));
    for (const t of [...world.entities, ...world.nodes]) {
      if (t.kind !== "robot" && !staged.has(t.id)) assert.deepEqual(t.store.items, thingOf(t.id)?.items ?? {}, `${m.id}: ${t.id} starts afresh`);
    }
  }
});

test("a mission's start set is the island its setup and those before it build, the same every time", () => {
  const { world } = missionStart(mission("m03"));
  assert.deepEqual(
    world.entities.map((e) => e.id),
    ["camp", "r1"],
    "chapter 1's island",
  );
  assert.deepEqual(byId(world, "r1").store.items, { wood: 1 }, "with the wood mission 2 was about");
  assert.equal(world.mission.id, "m03");
  assert.deepEqual(copy(world), copy(missionStart(mission("m03")).world), "the same every time");
  assert.equal(byId(missionStart(mission("m16")).world, "site").built, true, "the bridge, after mission 15");
  assert.ok(byId(missionStart(mission("m26")).world, "workshop"), "the workshop, from mission 25");
});

// --- What each mission offers -----------------------------------------------------------

// A category filled as it's opened (Memory, My blocks) counts as what it offers.
const blocksIn = (toolbox) => toolbox.contents.flatMap((c) => c.offers ?? c.contents.map((b) => (b.type === "controls_if" && b.extraState?.hasElse ? "controls_if_else" : b.type)));

test("each mission's toolboxes offer only what it and the missions before it unlocked", () => {
  const box = (id, type) => blocksIn(toolboxFor([type], { blocks: unlockedBlocks(mission(id)) }));
  assert.deepEqual(box("m01", "helper"), ["robot_go_to"]);
  assert.deepEqual(box("m03", "helper"), ["robot_go_to", "robot_collect", "robot_unload"]);
  assert.deepEqual(box("m06", "helper"), ["robot_go_to", "robot_collect", "robot_unload", "controls_repeat_ext"]);
  assert.deepEqual(box("m11", "sawmill"), ["building_make", "controls_repeat_ext"]);
  assert.ok(!box("m16", "helper").includes("controls_if"));
  assert.ok(box("m17", "sawmill").includes("controls_if") && !box("m17", "sawmill").includes("controls_if_else"));
  assert.ok(box("m18", "helper").includes("controls_if_else"));
  assert.ok(box("m22", "helper").includes("setting_destination"));
  assert.ok(!box("m25", "helper").includes("control_wait_steps"), "Wait N Steps is for experiments, not missions");
  assert.ok(!box("m25", "helper").includes("island_when_started"), "every program has its start block, which can't be deleted");
});

test("each mission names the program its card opens, and offers Phase 6's tools from chapter 5", () => {
  assert.equal(mainProgram(mission("m13")), "m13", "Robo 1's, not the sawmill's");
  assert.equal(mainProgram(mission("m15")), "m15", "the courier's");
  assert.equal(mainProgram(mission("m21")), "m21");
  assert.ok(CAMPAIGN.slice(0, 20).every((m) => !m.tools?.length));
  assert.deepEqual(mission("m21").tools, ["library"]);
  assert.deepEqual(mission("m22").tools, ["library", "settings"]);
  for (const m of CAMPAIGN) for (const p of m.programs) assert.equal(p.source.blocks.blocks[0].deletable, false, `${p.id}'s start block`);
});
