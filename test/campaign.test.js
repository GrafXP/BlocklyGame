import { test } from "node:test";
import assert from "node:assert/strict";
import { toolboxFor } from "../src/blockly/toolboxes.js";
import { readFileSync } from "node:fs";
import { missionProblems, missionStart, playMission, referenceCommands } from "../src/campaign.js";
import { CAMPAIGN, CHAPTERS, campaignMission, firstOpen, gateOf, gatesOf, isOpen, nextMission, unlockedBlocks } from "../src/content/missions/campaign.js";
import { missionById } from "../src/content/missions/index.js";
import { program as write } from "../src/content/missions/write.js";
import { COMPILER_VERSION } from "../src/programming/compiler.js";
import { giveDraft, programDoc, sameBlocks, setDraft } from "../src/programming/programs.js";
import { goalProgress } from "../src/sim/objectives.js";
import { thingOf } from "../src/content/missions/island.js";
import { checkPlacement, layout } from "../src/sim/placement.js";
import { cellAt, kindOf } from "../src/sim/terrain.js";
import { stateHash } from "../src/sim/replay.js";
import { checkWorld } from "../src/sim/validate.js";
import { SIM_VERSION, advanceWorld, reasonOf } from "../src/sim/world.js";
import { verifyCampaign } from "../scripts/verify-missions.js";
import { byId } from "./helpers.js";

// The campaign (PLAN.md §9; docs/campaign-planv2.md), as far as it's built:
// every mission's reference does it from its start and its starters don't,
// and played so it gives the recorded world; a Build mission's program is the
// start block alone; every mission stands alone, its setup complete, with one
// goal; the gates follow the map, with interim gates for missions not yet
// built; the toolbox offers what the missions it needs introduced; and each
// lesson's deliberate mistake fails as the lesson says, while the ways a child
// may well write it, a Forever among them, pass.

const copy = (value) => JSON.parse(JSON.stringify(value));
const mission = (id) => campaignMission(id);
const ids = (list) => list.map((m) => m.id);

// Mission `id` from its own start, with `programs` ({ id: source }) applied
// before the first step, as the player would. Returns the world after the
// mission's steps, or once it's done.
function playWith(id, programs = {}) {
  const m = mission(id);
  const { world, library } = missionStart(m);
  playMission(world, referenceCommands(world, library, { ...m, reference: { programs } }), m.steps);
  return world;
}

test("every mission is verified: its reference does it from its start, its starters don't, within its steps, toolbox, budget, authoring rules and words", async () => {
  const { problems, rows } = await verifyCampaign();
  assert.deepEqual(problems, []);
  assert.equal(rows.length, CAMPAIGN.length);
  for (const row of rows) assert.ok(row.ticks !== null, row.id);
});

test("every mission has one goal, from one start; the authoring rules refuse trials or a second goal", () => {
  for (const m of CAMPAIGN) assert.deepEqual([m.goals?.length, "trials" in m], [1, false], m.id);
  const m = mission("c2-m016");
  const { world } = missionStart(m);
  const two = { ...m, goals: [...m.goals, { id: "more", type: "reached", robot: "r1", at: "depot" }] };
  assert.ok(missionProblems(two, world).includes("c2-m016: it has 2 goals; a mission has one"));
  assert.ok(missionProblems({ ...m, trials: [] }, world).includes("c2-m016: it has trials; a mission has one start"));
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

test("its missions are chapters 1–12 so far, the foundation, construction, water, energy, supply and industry, numbered on the main path", () => {
  assert.deepEqual(ids(CAMPAIGN), Array.from({ length: 60 }, (_, i) => `c2-m${String(i + 1).padStart(3, "0")}`));
  assert.deepEqual(
    CAMPAIGN.map((m) => [m.n, m.chapter, m.main]),
    Array.from({ length: 60 }, (_, i) => [i + 1, Math.floor(i / 5) + 1, true]),
  );
  assert.deepEqual(
    CHAPTERS.map((c) => [c.chapter, ids(c.missions)]),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => [n, ids(CAMPAIGN.slice((n - 1) * 5, n * 5))]),
  );
  for (const m of CAMPAIGN) assert.equal(missionById(m.id), m);
  assert.deepEqual(
    CAMPAIGN.filter((m) => m.milestone).map((m) => m.n),
    [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
  );
  assert.deepEqual(
    CAMPAIGN.filter((m) => m.unlocks).map((m) => [m.n, m.unlocks]),
    [
      [15, "free"],
      [25, "sandbox"],
    ],
  );
});

test("the child writes the program: a Build mission's starts with its start block alone; a Repair or Change mission's with a whole program; an Explore mission needs none", () => {
  const kinds = Object.fromEntries(CAMPAIGN.map((m) => [m.n, m.workspace]));
  const other = { 4: "repair", 8: "repair", 9: "change", 10: "repair", 26: "explore", 28: "explore", 29: "repair", 39: "repair", 45: "repair", 49: "repair", 54: "repair", 58: "repair" };
  assert.deepEqual(kinds, Object.fromEntries(CAMPAIGN.map((m) => [m.n, other[m.n] ?? "build"])));
  for (const m of CAMPAIGN) {
    if (m.workspace === "explore") {
      assert.equal(m.focus, null, `${m.id} has no focus program`);
      assert.deepEqual(m.reference.programs ?? {}, {}, `${m.id}'s reference writes no program`);
      assert.ok(m.reference.commands.every((c) => c.type === "place"), `${m.id}'s reference places a building`);
      continue;
    }
    const focus = m.programs.find((p) => p.id === m.focus);
    const tops = focus.source.blocks.blocks;
    assert.equal(tops.length, 1, `${m.id} has one stack: no loose blocks lie ready`);
    assert.equal(tops[0].type, "island_when_started");
    assert.equal(!tops[0].next, m.workspace === "build", `${m.id}: ${m.workspace}`);
    assert.deepEqual(Object.keys(m.reference.programs), [m.focus], `${m.id}'s reference changes its focus alone`);
  }
});

test("every mission stands alone: the island's base and its own setup, nothing of another mission's, the same every time", () => {
  const things = (world) => [...world.entities, ...world.nodes].map((t) => t.id).sort();
  for (const m of CAMPAIGN) {
    const { world, library } = missionStart(m);
    assert.deepEqual(checkWorld(world), [], `${m.id}'s start`);
    assert.deepEqual(things(world), ["camp", "grove", "r1", ...(m.setup.add ?? []), ...(m.setup.plots ?? [])].sort(), `${m.id}: the base and what its setup adds`);
    assert.deepEqual(ids(library.programs), ids(m.programs).sort(), `${m.id}'s library: its own programs alone`);
    if (m.focus) assert.ok(world.entities.some((e) => e.own === m.focus), `${m.id}'s focus program is run`);
    const stream = [20, 21].map((x) => kindOf(world.terrain, cellAt(world.terrain, x, 15)));
    assert.deepEqual(stream, Array(2).fill(m.n > 15 ? "bridge" : m.n === 15 ? "gap" : "water"), `${m.id}: the stream whole, the bridge planned, or built`);
    assert.equal(!!byId(world, "site"), m.n === 15, `${m.id}: the bridge's construction site is there in mission 15 alone`);
    assert.deepEqual(copy(world), copy(missionStart(m).world), `${m.id} starts the same every time`);
  }
  assert.deepEqual(byId(missionStart(mission("c2-m003")).world, "r1").store.items, { wood: 1 }, "mission 3 starts with the wood");
  assert.deepEqual(byId(missionStart(mission("c2-m004")).world, "r1").store.items, {}, "and mission 4 without");
  const plot = byId(missionStart(mission("c2-m027")).world, "workshop");
  assert.deepEqual(
    [plot.type, plot.blueprint, plot.built, plot.store.caps, plot.store.items, plot.name],
    ["site", "workshop", false, { plank: 4, stone: 2 }, {}, { key: "entity.workshopSite" }],
    "mission 27's workshop is its construction site, waiting for its bill",
  );
});

// --- The map ------------------------------------------------------------------------------

test("each mission needs the one before it on the main path, and opens once that's done", () => {
  assert.deepEqual(gatesOf(mission("c2-m001")), []);
  assert.deepEqual(gatesOf(mission("c2-m007")), ["c2-m006"]);
  assert.equal(isOpen(mission("c2-m001"), []), true);
  assert.equal(isOpen(mission("c2-m002"), []), false);
  assert.equal(isOpen(mission("c2-m002"), ["c2-m001"]), true);
  assert.equal(firstOpen([]).id, "c2-m001");
  assert.equal(firstOpen(["c2-m001", "c2-m002"]).id, "c2-m003");
  assert.equal(nextMission(mission("c2-m004"), ["c2-m001", "c2-m002", "c2-m003"]).id, "c2-m005");
  assert.equal(nextMission(mission("c2-m030"), ids(CAMPAIGN)), null, "the last one built has no next yet");
  assert.equal(nextMission(mission("c2-m002"), ids(CAMPAIGN).filter((id) => id !== "c2-m001")).id, "c2-m001", "one left undone before it comes next");
});

test("a requirement on a mission not built yet stands for the last one built below it, until it's built", () => {
  assert.equal(gateOf("c2-m003"), "c2-m003");
  assert.equal(gateOf("c2-m060"), "c2-m060", "workshops A and B wait for 60, which is built");
  assert.equal(gateOf("c2-m085"), "c2-m060", "85 isn't built yet: it stands for 60");
  assert.throws(() => gateOf("c2-a01"), /isn't a main-path mission/);
  // A workshop lesson after 60, as the plan has it.
  const lesson = { id: "c2-a01", main: false, requires: ["c2-m060"], blocks: ["variables_set"] };
  assert.deepEqual(gatesOf(lesson), ["c2-m060"]);
  assert.equal(isOpen(lesson, ids(CAMPAIGN).slice(0, -1)), false);
  assert.equal(isOpen(lesson, ids(CAMPAIGN)), true);
  assert.ok(unlockedBlocks(lesson).includes("controls_repeat_ext"), "it offers what the main path taught");
  assert.ok(!unlockedBlocks(mission("c2-m025")).includes("variables_set"), "and its blocks don't reach the main path");
});

// A category filled as it's opened (Memory, My blocks) counts as what it offers.
const blocksIn = (toolbox) => toolbox.contents.flatMap((c) => c.offers ?? c.contents.map((b) => (b.type === "controls_if" && b.extraState?.hasElse ? "controls_if_else" : b.type)));

test("each mission's toolbox offers what it and the missions it needs introduced", () => {
  const box = (id, type = "helper") => blocksIn(toolboxFor([type], { blocks: unlockedBlocks(mission(id)) }));
  assert.deepEqual(box("c2-m001"), ["robot_go_to"]);
  assert.deepEqual(box("c2-m003"), ["robot_go_to", "robot_pick_up", "robot_unload"]);
  assert.deepEqual(box("c2-m005"), ["robot_go_to", "robot_pick_up", "robot_unload"]);
  assert.deepEqual(box("c2-m006"), ["robot_go_to", "robot_pick_up", "robot_unload", "controls_repeat_ext"]);
  assert.deepEqual(box("c2-m010"), box("c2-m006"));
  assert.deepEqual(box("c2-m011", "sawmill"), ["building_make", "controls_repeat_ext"]);
  assert.deepEqual(box("c2-m015", "site"), ["building_build", "controls_repeat_ext", "control_forever"]);
  assert.ok(box("c2-m016").includes("sense_stock") && !box("c2-m016").includes("controls_if"));
  assert.ok(box("c2-m017", "sawmill").includes("controls_if") && !box("c2-m017", "sawmill").includes("controls_if_else"));
  assert.ok(box("c2-m018").includes("controls_if_else"));
  assert.ok(box("c2-m019").includes("control_wait_until"));
  assert.ok(!box("c2-m025").includes("control_wait_steps"), "Wait N Steps is for experiments, not missions");
  assert.ok(!box("c2-m025").some((b) => b.startsWith("setting_")), "settings wait for chapter 17");
});

// --- Each lesson's mistake fails as the lesson says ---------------------------------------

test("mission 4: picking up before going to the grove keeps Robo 1 waiting at the camp, for wood that isn't there", () => {
  const world = playWith("c2-m004");
  assert.deepEqual(byId(world, "r1").pending.reason, { code: "wait.item", item: "wood", at: "camp", need: 1, have: 0 });
  assert.equal(world.mission.done, null);
});

test("mission 5: two trips of one piece do it too", () => {
  const twice = write("c2-m005", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.pickUp(), p.go("camp"), p.unload()))));
  assert.notEqual(playWith("c2-m005", { "c2-m005": twice }).mission.done, null);
});

test("mission 7: three pieces in two trips aren't three trips; three trips of two are", () => {
  const full = write("c2-m007", (p) => p.workspace(p.start(p.go("grove"), p.pickUp(), p.pickUp(), p.go("camp"), p.unload(), p.go("grove"), p.pickUp(), p.go("camp"), p.unload())));
  assert.equal(playWith("c2-m007", { "c2-m007": full }).mission.done, null);
  const twos = write("c2-m007", (p) => p.workspace(p.start(p.repeat(3, p.go("grove"), p.pickUp(), p.pickUp(), p.go("camp"), p.unload()))));
  assert.notEqual(playWith("c2-m007", { "c2-m007": twos }).mission.done, null);
});

test("mission 8: a third Collect waits for room in the basket", () => {
  const world = playWith("c2-m008");
  assert.equal(byId(world, "r1").pending.reason.code, "wait.space");
  assert.equal(world.mission.done, null);
});

test("mission 9: its program as it starts brings two pieces in loads of one, not the goal; two Collects in a row do it as well as a Repeat", () => {
  const start = playWith("c2-m009");
  assert.equal(start.mission.done, null);
  assert.equal(byId(start, "camp").store.items.wood, 2);
  const twice = write("c2-m009", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.pickUp(), p.pickUp(), p.go("camp"), p.unload()))));
  assert.notEqual(playWith("c2-m009", { "c2-m009": twice }).mission.done, null);
});

test("mission 10: the loop without the way home stalls, and a fourth delivery is one too many", () => {
  const stalled = playWith("c2-m010");
  assert.ok(stalled.stall, "the world stalls");
  assert.equal(byId(stalled, "r1").pending.reason.code, "wait.space");
  const four = write("c2-m010", (p) => p.workspace(p.start(p.repeat(4, p.go("grove"), p.pickUp(), p.go("camp"), p.unload()))));
  const world = playWith("c2-m010", { "c2-m010": four });
  assert.ok(world.mission.goals[0].failed);
  assert.equal(world.mission.done, null);
});

test("mission 13: wood taken to the camp leaves the sawmill waiting for it", () => {
  const camp = write("c2-m013", (p) => p.workspace(p.start(p.go("grove"), p.pickUp(), p.pickUp(), p.go("camp"), p.unload())));
  const world = playWith("c2-m013", { "c2-m013": camp });
  assert.equal(byId(world, "sawmill").pending.reason.code, "wait.item");
  assert.equal(world.mission.done, null);
});

test("mission 15: the courier alone fills the site but builds nothing; once the site builds, Robo 2 sets off across the bridge", () => {
  const alone = playWith("c2-m015");
  assert.equal(alone.mission.done, null);
  assert.equal(byId(alone, "site").store.items.plank, 4);
  const m = mission("c2-m015");
  const { world, library } = missionStart(m);
  assert.equal(byId(world, "r2").runtime.parked, true);
  playMission(world, referenceCommands(world, library, m), m.steps);
  assert.equal(byId(world, "site").built, true);
  assert.ok(!byId(world, "r2").runtime.parked, "the reward started it");
});

test("mission 16: one pickup leaves a plank on the shelf; the trip in a Forever does it too", () => {
  const one = write("c2-m016", (p) => p.workspace(p.start(p.pickUp("plank"), p.go("depot"), p.unload())));
  const world = playWith("c2-m016", { "c2-m016": one });
  assert.equal(world.mission.done, null);
  assert.equal(byId(world, "sawmill").store.items.plank, 1);
  const again = write("c2-m016", (p) => p.workspace(p.start(p.forever(p.go("sawmill"), p.repeat(p.stock("plank", "sawmill"), p.pickUp("plank")), p.go("depot"), p.unload()))));
  assert.notEqual(playWith("c2-m016", { "c2-m016": again }).mission.done, null);
});

test("mission 17: making without looking fills the shelf past two; looking again and again keeps it at two", () => {
  for (const [what, blocks] of [
    ["twice", (p) => [p.make(), p.make()]],
    ["forever", (p) => [p.forever(p.make())]],
  ]) {
    const world = playWith("c2-m017", { "c2-m017": write("c2-m017", (p) => p.workspace(p.start(...blocks(p)))) });
    assert.equal(world.mission.done, null, what);
    assert.equal(byId(world, "sawmill").store.items.plank, 3, what);
  }
  const looking = write("c2-m017", (p) => p.workspace(p.start(p.forever(p.when(p.compare(p.stock("plank", "sawmill"), "LT", 2), [p.make()])))));
  assert.notEqual(playWith("c2-m017", { "c2-m017": looking }).mission.done, null);
});

test("mission 18: with the jobs the wrong way round, Robo 1 waits at the empty shelf; inside a Forever, the Else still does it", () => {
  const plankTrip = (p) => [p.go("sawmill"), p.pickUp("plank"), p.go("depot"), p.unload()];
  const woodTrip = (p) => [p.go("grove"), p.pickUp(), p.go("sawmill"), p.unload()];
  const swapped = write("c2-m018", (p) => p.workspace(p.start(p.when(p.compare(p.stock("plank", "sawmill"), "GT", 0), woodTrip(p), plankTrip(p)))));
  const world = playWith("c2-m018", { "c2-m018": swapped });
  assert.equal(world.mission.done, null);
  assert.equal(byId(world, "r1").pending.reason.code, "wait.item", "the problem its hints answer");
  const again = write("c2-m018", (p) => p.workspace(p.start(p.forever(p.when(p.compare(p.stock("plank", "sawmill"), "GT", 0), plankTrip(p), woodTrip(p))))));
  assert.notEqual(playWith("c2-m018", { "c2-m018": again }).mission.done, null);
});

test("mission 19: setting off before both planks are ready fails, though both get delivered", () => {
  const early = write("c2-m019", (p) => p.workspace(p.start(p.go("sawmill"), p.pickUp("plank"), p.pickUp("plank"), p.go("depot"), p.unload())));
  const world = playWith("c2-m019", { "c2-m019": early });
  assert.ok(world.mission.goals[0].failed, "Robo 1 waited at the sawmill");
  assert.equal(byId(world, "depot").store.items.plank, 2);
  assert.equal(world.mission.done, null);
});

test("mission 20: a sawmill that makes planks without looking keeps more than two, as the wood keeps coming", () => {
  const greedy = write("c2-m020", (p) => p.workspace(p.start(p.forever(p.make()))));
  const world = playWith("c2-m020", { "c2-m020": greedy });
  assert.equal(world.mission.done, null);
  assert.equal(byId(world, "sawmill").store.items.plank, 4);
});

test("mission 22: wood and stone brought home on two trips aren't one basket", () => {
  const apart = write("c2-m022", (p) => p.workspace(p.start(p.go("grove"), p.pickUp(), p.go("camp"), p.unload(), p.go("quarry"), p.pickUp("stone"), p.go("camp"), p.unload())));
  const world = playWith("c2-m022", { "c2-m022": apart });
  assert.equal(world.mission.done, null);
  assert.deepEqual(byId(world, "camp").store.items, { wood: 1, stone: 1 }, "both came home, apart");
});

test("missions 24 and 25: the planks alone leave the workshop waiting for its stone, and one kit's trips make one kit", () => {
  const planks = write("c2-m024", (p) => p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp("plank")), p.go("workshop"), p.unload())));
  const waiting = playWith("c2-m024", { "c2-m024": planks });
  assert.equal(byId(waiting, "workshop").pending.reason.code, "wait.item");
  assert.equal(waiting.mission.done, null);
  const once = write("c2-m025", (p) =>
    p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp("plank")), p.go("workshop"), p.unload(), p.go("quarry"), p.pickUp("stone"), p.go("workshop"), p.unload())),
  );
  const world = playWith("c2-m025", { "c2-m025": once });
  assert.equal(world.mission.done, null);
  assert.equal(world.mission.tally.made["workshop|kit"], 1);
});

test("a site counts as placed once it stands, and as constructed only once it's the building", () => {
  const placed = { id: "p", type: "placed", blueprint: "workshop" };
  const constructed = { id: "c", type: "constructed", blueprint: "workshop" };
  const at = (id) => missionStart(mission(id)).world;
  assert.deepEqual([goalProgress(at("c2-m026"), placed).have, goalProgress(at("c2-m027"), placed).have, goalProgress(at("c2-m027"), constructed).have], [0, 1, 0]);
  const m = mission("c2-m027");
  const { world, library } = missionStart(m);
  playMission(world, referenceCommands(world, library, m), m.steps);
  assert.deepEqual([goalProgress(world, placed).have, goalProgress(world, constructed).have, byId(world, "workshop").type], [1, 1, "workshop"]);
});

test("mission 26: nothing placed, nothing done; a workshop can't stand where it blocks the way, and placed where it fits, the mission is done", () => {
  const m = mission("c2-m026");
  const { world } = missionStart(m);
  assert.ok(checkPlacement(world, { blueprint: "workshop", x: 9, z: 16, facing: "south" }).problem, "not on the camp");
  playMission(world, [{ type: "place", blueprint: "workshop", x: 9, z: 16, facing: "south", program: null }], 10);
  assert.equal(world.mission.done, null);
  assert.ok(!byId(world, "workshop"), "the command was refused");
  playMission(world, m.reference.commands, world.tick + 10);
  assert.notEqual(world.mission.done, null);
  assert.equal(byId(world, "workshop").type, "site");
});

test("a building is placed only on a plot its mission marks, and every plot it fits on is where the missions after it have the building", () => {
  const placing = CAMPAIGN.filter((m) => m.blueprints);
  assert.deepEqual(ids(placing), ["c2-m026", "c2-m028"]);
  const workshop = thingOf("workshop");
  for (const m of placing) {
    const { world } = missionStart(m);
    for (const { blueprint, plots } of m.blueprints) {
      assert.ok(plots?.length, `${m.id} marks the plots for ${blueprint}`);
      const fits = plots.filter((plot) => !checkPlacement(world, { blueprint, ...plot }).problem);
      assert.equal(fits.length, 1, `${m.id}: one plot fits`);
      const { area, front } = layout({ blueprint, ...fits[0] });
      assert.deepEqual([area, front], [workshop.area, workshop.access], `${m.id}: the workshop where the island has it`);
    }
  }
  const landing = mission("c2-m028").blueprints[0].plots[0];
  assert.deepEqual(checkPlacement(missionStart(mission("c2-m028")).world, { blueprint: "workshop", ...landing }).problem, { code: "place.cutOff", thing: "quarry" }, "mission 28's other plot cuts the stone pit off");
});

test("mission 27: the planks alone leave the site waiting for its stone", () => {
  const planks = write("c2-m027", (p) => p.workspace(p.start(p.repeat(2, p.go("sawmill"), p.repeat(2, p.pickUp("plank")), p.go("workshop"), p.unload()))));
  const world = playWith("c2-m027", { "c2-m027": planks });
  assert.equal(byId(world, "workshop").pending.reason.code, "wait.item");
  assert.equal(world.mission.done, null);
});

test("mission 28: Robo 1 waits, parked, until the site is placed; placing it is the goal, and then Robo 1 brings the bill and the site builds", () => {
  const m = mission("c2-m028");
  const { world } = missionStart(m);
  assert.equal(byId(world, "r1").runtime.parked, true);
  playMission(world, [], 30);
  assert.equal(world.mission.done, null, "nothing happens before it's placed");
  playMission(world, m.reference.commands, world.tick + 5);
  assert.notEqual(world.mission.done, null, "placed: done");
  assert.ok(!byId(world, "r1").runtime.parked, "the reward started Robo 1");
  for (let i = 0; i < 1000 && byId(world, "workshop").type !== "workshop"; i++) advanceWorld(world, []);
  assert.equal(byId(world, "workshop").type, "workshop", "Robo 1 found its way in");
});

test("mission 29: its job takes the pieces back to the camp, and the site waits for them", () => {
  const world = playWith("c2-m029");
  assert.equal(world.mission.done, null);
  assert.deepEqual(byId(world, "camp").store.items, { plank: 4, stone: 2 });
  assert.equal(byId(world, "workshop").pending.reason.code, "wait.item");
});

test("mission 30: the kit's pieces can't go in before the workshop is built; the workshop's bill alone makes no kit", () => {
  const buildOnly = write("c2-m030", (p) =>
    p.workspace(p.start(p.repeat(2, p.go("sawmill"), p.repeat(2, p.pickUp("plank")), p.go("workshop"), p.unload()), p.go("quarry"), p.repeat(2, p.pickUp("stone")), p.go("workshop"), p.unload())),
  );
  const world = playWith("c2-m030", { "c2-m030": buildOnly });
  assert.equal(byId(world, "workshop").type, "workshop", "built");
  assert.equal(world.mission.done, null, "but no kit");
  assert.equal(byId(world, "workshop").pending.reason.code, "wait.item", "the workshop waits for the kit's pieces");
});

test("mission 31: water is picked up at the spring; looking for it at the camp waits for water the camp hasn't got", () => {
  const camp = write("c2-m031", (p) => p.workspace(p.start(p.pickUp("water"), p.go("spring"), p.go("camp"), p.unload())));
  const world = playWith("c2-m031", { "c2-m031": camp });
  assert.deepEqual(byId(world, "r1").pending.reason, { code: "wait.item", item: "water", at: "camp", need: 1, have: 0 });
  assert.equal(world.mission.done, null);
});

test("mission 32: one Make draws one bucket; the well needs no ingredient for it", () => {
  const once = write("c2-m032", (p) => p.workspace(p.start(p.make("water"))));
  const world = playWith("c2-m032", { "c2-m032": once });
  assert.deepEqual(byId(world, "well").store.items, { water: 1 });
  assert.equal(world.mission.done, null);
  assert.notEqual(playWith("c2-m032", { "c2-m032": write("c2-m032", (p) => p.workspace(p.start(p.make("water"), p.make("water")))) }).mission.done, null, "two Makes do it too");
});

test("mission 33: two trips of one bucket aren't one load", () => {
  const trips = write("c2-m033", (p) => p.workspace(p.start(p.repeat(2, p.go("well"), p.pickUp("water"), p.go("camp"), p.unload()))));
  const world = playWith("c2-m033", { "c2-m033": trips });
  assert.deepEqual(byId(world, "camp").store.items, { water: 2 });
  assert.equal(world.mission.done, null);
});

test("mission 34: one bucket grows two food, and the farm's water is gone", () => {
  const world = playWith("c2-m034", mission("c2-m034").reference.programs);
  assert.notEqual(world.mission.done, null);
  assert.deepEqual(byId(world, "farm").store.items, { food: 2 });
});

test("mission 35: food without water first leaves the farm waiting; a Forever round of the food trips does it too", () => {
  const foodOnly = write("c2-m035", (p) => p.workspace(p.start(p.go("farm"), p.repeat(2, p.pickUp("food")), p.go("camp"), p.unload())));
  const world = playWith("c2-m035", { "c2-m035": foodOnly });
  assert.equal(byId(world, "farm").pending.reason.code, "wait.item");
  assert.equal(world.mission.done, null);
  const forever = write("c2-m035", (p) => p.workspace(p.start(p.go("well"), p.repeat(2, p.pickUp("water")), p.go("farm"), p.unload(), p.forever(p.go("farm"), p.repeat(2, p.pickUp("food")), p.go("camp"), p.unload()))));
  assert.notEqual(playWith("c2-m035", { "c2-m035": forever }).mission.done, null);
});

test("mission 37: two food and a water don't fit one basket; food and water together, then the last food, do it", () => {
  const all = write("c2-m037", (p) => p.workspace(p.start(p.go("berries"), p.repeat(2, p.pickUp("food")), p.go("spring"), p.pickUp("water"), p.go("station"), p.unload())));
  const world = playWith("c2-m037", { "c2-m037": all });
  assert.equal(byId(world, "r1").pending.reason.code, "wait.space");
  assert.equal(world.mission.done, null);
  const mixed = write("c2-m037", (p) =>
    p.workspace(p.start(p.go("berries"), p.pickUp("food"), p.go("spring"), p.pickUp("water"), p.go("station"), p.unload(), p.go("berries"), p.pickUp("food"), p.go("station"), p.unload())),
  );
  assert.notEqual(playWith("c2-m037", { "c2-m037": mixed }).mission.done, null);
});

test("mission 38: the camp pays once for its robot, who stands at its front and does the wood team's job", () => {
  const m = mission("c2-m038");
  const { world, library } = missionStart(m);
  playMission(world, referenceCommands(world, library, m), m.steps);
  assert.notEqual(world.mission.done, null);
  const r2 = byId(world, "r2");
  assert.equal(r2.role, "wood-team");
  assert.deepEqual(byId(world, "camp").store.items, {}, "two planks and a pack, spent");
  for (let i = 0; i < 300 && !byId(world, "camp").store.items.wood; i++) advanceWorld(world, []);
  assert.deepEqual(byId(world, "camp").store.items, { wood: 2 }, "its first delivery");
});

test("mission 39: Robo 1 looks for food at the grove and stops; with no food, no pack and no new robot, though Robo 2 and Robo 3 still work", () => {
  const world = playWith("c2-m039");
  assert.equal(byId(world, "r1").error.code, "error.notHere");
  assert.deepEqual(byId(world, "station").store.items, { water: 1 }, "Robo 2 brought the water");
  assert.equal(byId(world, "camp").pending.reason.item, "pack");
  assert.equal(byId(world, "r3").pending.reason.code, "wait.item", "Robo 3 waits at the station for a pack");
  assert.equal(world.mission.done, null);
});

test("mission 40: the planks alone leave the camp waiting for its pack", () => {
  const world = playWith("c2-m040", mission("c2-m040").scaffold);
  assert.deepEqual(byId(world, "camp").pending.reason, { code: "wait.item", item: "pack", at: "camp", need: 1, have: 0 });
  assert.equal(world.mission.done, null);
});

test("mission 41: Supply finds the food only where it may look, and says what's missing where it isn't", () => {
  const camp = write("c2-m041", (p) => p.workspace(p.start(p.supply("station", "camp"))));
  const m = mission("c2-m041");
  const { world, library } = missionStart(m);
  playMission(world, referenceCommands(world, library, { ...m, reference: { programs: { "c2-m041": camp } } }), 3);
  assert.deepEqual(reasonOf(byId(world, "r1")), { code: "supply.none", item: "food", to: "station" });
  playMission(world, [], m.steps);
  assert.equal(world.mission.done, null);
  const done = playWith("c2-m041", m.reference.programs);
  assert.ok(!byId(done, "station").runtime.parked, "the reward starts the station");
});

test("mission 42: one Supply is one load; Repeat four times does it too", () => {
  const once = write("c2-m042", (p) => p.workspace(p.start(p.supply("station", "farm", "well"))));
  assert.equal(playWith("c2-m042", { "c2-m042": once }).mission.done, null);
  const four = write("c2-m042", (p) => p.workspace(p.start(p.repeat(4, p.supply("station", "farm", "well")))));
  assert.notEqual(playWith("c2-m042", { "c2-m042": four }).mission.done, null);
});

test("mission 43: a bucket on every round overfills the farm's order; asking first keeps it at one, and so does Supply", () => {
  const always = write("c2-m043", (p) => p.workspace(p.start(p.forever(p.go("well"), p.pickUp("water"), p.go("farm"), p.unload()))));
  const world = playWith("c2-m043", { "c2-m043": always });
  assert.equal(world.mission.done, null);
  assert.deepEqual(byId(world, "farm").store.items.water, 2);
  const supply = write("c2-m043", (p) => p.workspace(p.start(p.forever(p.supply("farm", "well")))));
  assert.notEqual(playWith("c2-m043", { "c2-m043": supply }).mission.done, null);
});

test("mission 44: setting off at once waits at the farm for room, and fails; waiting at the well with the bucket doesn't", () => {
  const atOnce = write("c2-m044", (p) => p.workspace(p.start(p.go("well"), p.pickUp("water"), p.go("farm"), p.unload())));
  const world = playWith("c2-m044", { "c2-m044": atOnce });
  assert.equal(world.mission.done, null);
  assert.notEqual(world.mission.goals[0].failed, null);
  const atWell = write("c2-m044", (p) => p.workspace(p.start(p.go("well"), p.pickUp("water"), p.until(p.compare(p.space("water", "farm"), "GT", 0)), p.go("farm"), p.unload())));
  assert.notEqual(playWith("c2-m044", { "c2-m044": atWell }).mission.done, null);
});

test("mission 45: looking only at the farm, the supplier finds no water and says so, and the island stalls", () => {
  const world = playWith("c2-m045");
  assert.deepEqual(reasonOf(byId(world, "r1")), { code: "supply.none", item: "water", to: "station" });
  assert.equal(byId(world, "station").pending.reason.item, "water");
  assert.ok(world.stall);
  assert.equal(world.mission.done, null);
});

// A delivery for missions 46–60: to `from`, `n` pick-ups of `item`, to `to`, unload.
const trip = (p, from, item, to, n = 2) => [p.go(from), n === 1 ? p.pickUp(item) : p.repeat(n, p.pickUp(item)), p.go(to), p.unload()];

test("mission 46: two stones become one stone block, and the stones are gone", () => {
  const world = playWith("c2-m046", mission("c2-m046").reference.programs);
  assert.notEqual(world.mission.done, null);
  assert.deepEqual(byId(world, "stonecutter").store.items, { block: 1 });
});

test("mission 47: raw stone from the stone pit has no room at the smelter's site, which waits for stone blocks", () => {
  const stone = write("c2-m047", (p) => p.workspace(p.start(...trip(p, "quarry", "stone", "smelter"))));
  const world = playWith("c2-m047", { "c2-m047": stone });
  assert.deepEqual(reasonOf(byId(world, "r1")), { code: "wait.space", item: "stone", at: "smelter", need: 2, free: 0 });
  assert.equal(byId(world, "smelter").pending.reason.item, "block");
  assert.equal(world.mission.done, null);
});

test("mission 48: one batch burns both wood into two charcoal", () => {
  const world = playWith("c2-m048", mission("c2-m048").reference.programs);
  assert.deepEqual(byId(world, "kiln").store.items, { charcoal: 2 });
});

test("mission 49: with both collectors at the kiln, the sawmill waits for wood", () => {
  const world = playWith("c2-m049");
  assert.deepEqual(byId(world, "kiln").store.items, { wood: 2, charcoal: 2 }, "the kiln got both shares");
  assert.equal(byId(world, "sawmill").pending.reason.item, "wood");
  assert.equal(world.mission.done, null);
});

test("mission 50: charcoal brought first waits at the site, which has no room for it, and nothing else comes", () => {
  const first = write("c2-m050", (p) => p.workspace(p.start(...trip(p, "kiln", "charcoal", "smelter"), p.repeat(2, ...trip(p, "sawmill", "plank", "smelter")), ...trip(p, "stonecutter", "block", "smelter"))));
  const world = playWith("c2-m050", { "c2-m050": first });
  assert.deepEqual(reasonOf(byId(world, "r1")), { code: "wait.space", item: "charcoal", at: "smelter", need: 2, free: 0 });
  assert.equal(byId(world, "smelter").type, "site");
  assert.equal(world.mission.done, null);
});

test("mission 51: iron bars aren't dug at the mine: picking them up there stops", () => {
  const bars = write("c2-m051", (p) => p.workspace(p.start(...trip(p, "mine", "iron", "smelter"))));
  const world = playWith("c2-m051", { "c2-m051": bars });
  assert.equal(byId(world, "r1").error.code, "error.notHere");
  assert.equal(world.mission.done, null);
});

test("mission 52: one batch takes all four ingredients and makes two bars; a second Make waits for ore", () => {
  const twice = write("c2-m052", (p) => p.workspace(p.start(p.make("iron"), p.make("iron"))));
  const world = playWith("c2-m052", { "c2-m052": twice });
  assert.notEqual(world.mission.done, null);
  assert.deepEqual(byId(world, "smelter").store.items, { iron: 2 });
  assert.equal(byId(world, "smelter").pending.reason.item, "ironOre");
});

test("mission 53: a supplier that may look only at the mine brings ore and finds nothing else; the supplier's own trips do it too", () => {
  const mineOnly = write("c2-m053", (p) => p.workspace(p.start(p.forever(p.supply("smelter", "mine")))));
  const world = playWith("c2-m053", { "c2-m053": mineOnly });
  assert.equal(reasonOf(byId(world, "r1")).code, "supply.none");
  assert.deepEqual(byId(world, "smelter").store.items, { ironOre: 2 });
  assert.ok(world.stall);
  const own = write("c2-m053", (p) =>
    p.workspace(p.start(p.repeat(2, ...trip(p, "mine", "ironOre", "smelter"), ...trip(p, "kiln", "charcoal", "smelter", 1), ...trip(p, "well", "water", "smelter", 1)))),
  );
  assert.notEqual(playWith("c2-m053", { "c2-m053": own }).mission.done, null);
});

test("mission 54: the wood goes to the sawmill, so the kiln waits for it and the smelter for charcoal", () => {
  const world = playWith("c2-m054");
  assert.deepEqual(byId(world, "sawmill").store.items, { wood: 2 });
  assert.equal(byId(world, "kiln").pending.reason.item, "wood");
  assert.equal(byId(world, "smelter").pending.reason.item, "charcoal");
  assert.equal(world.mission.done, null);
});

test("mission 55: one Supply is one load; the smelter waits for the rest", () => {
  const once = write("c2-m055", (p) => p.workspace(p.start(p.supply("smelter", "mine", "kiln", "well"))));
  const world = playWith("c2-m055", { "c2-m055": once });
  assert.deepEqual(byId(world, "smelter").store.items, { ironOre: 2 });
  assert.equal(world.mission.done, null);
});

test("mission 56: Make at once waits for the water, and fails; an If looks once, too early; Wait Until or a Forever If does it", () => {
  const atOnce = playWith("c2-m056", { "c2-m056": write("c2-m056", (p) => p.workspace(p.start(p.make("iron")))) });
  assert.notEqual(atOnce.mission.goals[0].failed, null);
  assert.equal(atOnce.mission.done, null);
  const once = playWith("c2-m056", { "c2-m056": write("c2-m056", (p) => p.workspace(p.start(p.when(p.ready("iron"), [p.make("iron")])))) });
  assert.deepEqual(byId(once, "smelter").store.items, { ironOre: 2, charcoal: 1, water: 1 }, "it looked before the water came, and stopped");
  assert.equal(once.mission.done, null);
  const forever = write("c2-m056", (p) => p.workspace(p.start(p.forever(p.when(p.ready("iron"), [p.make("iron")])))));
  assert.notEqual(playWith("c2-m056", { "c2-m056": forever }).mission.done, null);
});

test("mission 57: making all the time fills the shelf to six; one batch leaves two; making while short keeps four, and so does waiting until short", () => {
  const always = playWith("c2-m057", { "c2-m057": write("c2-m057", (p) => p.workspace(p.start(p.forever(p.make("iron"))))) });
  assert.deepEqual(byId(always, "smelter").store.items.iron, 6);
  assert.equal(always.mission.done, null);
  const ready = playWith("c2-m057", { "c2-m057": write("c2-m057", (p) => p.workspace(p.start(p.forever(p.when(p.ready("iron"), [p.make("iron")]))))) });
  assert.equal(ready.mission.done, null, "being ready isn't being short");
  const once = playWith("c2-m057", { "c2-m057": write("c2-m057", (p) => p.workspace(p.start(p.make("iron")))) });
  assert.deepEqual(byId(once, "smelter").store.items.iron, 2);
  assert.equal(once.mission.done, null);
  const until = write("c2-m057", (p) => p.workspace(p.start(p.forever(p.until(p.compare(p.stock("iron", "smelter"), "LT", 4)), p.make("iron")))));
  assert.notEqual(playWith("c2-m057", { "c2-m057": until }).mission.done, null);
});

test("mission 58: Robo 1 takes the smelter's bucket to the farm, and the smelter waits for water", () => {
  const world = playWith("c2-m058");
  assert.deepEqual(byId(world, "smelter").store.items, { ironOre: 2, charcoal: 1 });
  assert.equal(byId(world, "smelter").pending.reason.item, "water");
  assert.equal(world.mission.done, null);
});

test("mission 59: one trip of two buckets makes two batches of three; a Forever round of trips does it, and asking Needs first", () => {
  const once = playWith("c2-m059", { "c2-m059": write("c2-m059", (p) => p.workspace(p.start(...trip(p, "spring", "water", "smelter")))) });
  assert.deepEqual(byId(once, "smelter").store.items.iron, 4);
  assert.equal(once.mission.done, null);
  const rounds = write("c2-m059", (p) => p.workspace(p.start(p.forever(...trip(p, "spring", "water", "smelter")))));
  assert.notEqual(playWith("c2-m059", { "c2-m059": rounds }).mission.done, null);
  const asking = write("c2-m059", (p) => p.workspace(p.start(p.forever(p.when(p.needs("smelter", "water"), trip(p, "spring", "water", "smelter"))))));
  assert.notEqual(playWith("c2-m059", { "c2-m059": asking }).mission.done, null);
});

test("mission 60: the bars alone don't fill the depot's order; Supply of the depot from where they're made does", () => {
  const bars = playWith("c2-m060", mission("c2-m060").scaffold);
  assert.deepEqual(byId(bars, "depot").store.items, { iron: 4 });
  assert.equal(bars.mission.done, null);
  const supply = write("c2-m060", (p) => p.workspace(p.start(p.forever(p.supply("depot", "smelter", "workshop", "station")))));
  const world = playWith("c2-m060", { "c2-m060": supply });
  assert.notEqual(world.mission.done, null);
  assert.deepEqual(byId(world, "depot").store.items, { iron: 4, kit: 2, pack: 2 });
});

// --- The help keeps the child's draft --------------------------------------------------------

test("a start or the whole program put into the draft keeps a draft with changes not applied, to go back to", () => {
  const { library } = missionStart(mission("c2-m005"));
  const doc = () => programDoc(library, "c2-m005");
  const reference = mission("c2-m005").reference.programs["c2-m005"];
  giveDraft(library, "c2-m005", reference);
  assert.ok(sameBlocks(doc().draft, reference));
  assert.equal(doc().kept, undefined, "the starter, unchanged, is a version already");
  const mine = write("c2-m005", (p) => p.workspace(p.start(p.go("grove"))));
  setDraft(library, "c2-m005", mine);
  giveDraft(library, "c2-m005", reference);
  assert.ok(sameBlocks(doc().kept.source, mine), "the child's own draft is kept");
  assert.equal(doc().kept.from, 1);
});
