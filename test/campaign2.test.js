import { test } from "node:test";
import assert from "node:assert/strict";
import { toolboxFor } from "../src/blockly/toolboxes.js";
import { missionBlocks, missionStart, playMission, referenceCommands } from "../src/campaign.js";
import { CAMPAIGN } from "../src/content/missions/campaign.js";
import { missionById } from "../src/content/missions/index.js";
import { program as write } from "../src/content/missions/write.js";
import { CAMPAIGN2, CHAPTERS2, FROM_V1, blocksFor, campaign2Mission, creditFromV1, firstOpen, gateOf, gatesOf, isOpen, nextOf } from "../src/content/missions/v2/index.js";
import { giveDraft, programDoc, sameBlocks, setDraft } from "../src/programming/programs.js";
import { makeSave } from "../src/storage/saves.js";
import { checkWorld } from "../src/sim/validate.js";
import { verifyCampaign } from "../scripts/verify-missions.js";
import { byId } from "./helpers.js";

// The campaign's second plan (docs/campaign-planv2.md), as far as it's built:
// every mission's reference does it from its start and its starters don't; a
// Build mission's program is the start block alone; every mission stands
// alone, its setup complete; the gates follow the map, with interim gates for
// missions not yet built; the toolbox offers what the missions it needs
// introduced; the first campaign's progress counts for the same lessons; each
// lesson's deliberate mistake fails as the lesson says; and the session plays
// it apart from the first campaign.

const copy = (value) => JSON.parse(JSON.stringify(value));
const mission = (id) => campaign2Mission(id);
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

test("every mission of the second campaign is verified: its reference does it from its start, its starters don't, within its steps, toolbox, budget, rules and words", async () => {
  const { problems, rows } = await verifyCampaign({ missions: CAMPAIGN2 });
  assert.deepEqual(problems, []);
  assert.equal(rows.length, CAMPAIGN2.length);
  for (const row of rows) assert.ok(row.ticks !== null, row.id);
});

test("its missions are chapters 1–5 so far, the foundation, numbered on the main path, with ids no first-campaign mission has", () => {
  assert.deepEqual(ids(CAMPAIGN2), Array.from({ length: 25 }, (_, i) => `c2-m${String(i + 1).padStart(3, "0")}`));
  assert.deepEqual(
    CAMPAIGN2.map((m) => [m.n, m.chapter, m.main]),
    Array.from({ length: 25 }, (_, i) => [i + 1, Math.floor(i / 5) + 1, true]),
  );
  assert.deepEqual(
    CHAPTERS2.map((c) => [c.chapter, ids(c.missions)]),
    [1, 2, 3, 4, 5].map((n) => [n, ids(CAMPAIGN2.slice((n - 1) * 5, n * 5))]),
  );
  for (const m of CAMPAIGN2) {
    assert.equal(missionById(m.id), m);
    assert.ok(!CAMPAIGN.some((old) => old.id === m.id));
  }
  assert.deepEqual(
    CAMPAIGN2.filter((m) => m.milestone).map((m) => m.n),
    [5, 10, 15, 20, 25],
  );
  assert.deepEqual(
    CAMPAIGN2.filter((m) => m.unlocks).map((m) => [m.n, m.unlocks]),
    [
      [15, "free"],
      [25, "sandbox"],
    ],
  );
});

test("the child writes the program: a Build mission's starts with its start block alone; a Repair or Change mission's with a whole program", () => {
  const kinds = Object.fromEntries(CAMPAIGN2.map((m) => [m.n, m.workspace]));
  const repairs = [4, 8, 10];
  assert.deepEqual(kinds, Object.fromEntries(CAMPAIGN2.map((m) => [m.n, repairs.includes(m.n) ? "repair" : m.n === 9 ? "change" : "build"])));
  for (const m of CAMPAIGN2) {
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
  for (const m of CAMPAIGN2) {
    const { world, library } = missionStart(m);
    assert.deepEqual(checkWorld(world), [], `${m.id}'s start`);
    assert.deepEqual(things(world), ["camp", "grove", "r1", ...(m.setup.add ?? [])].sort(), `${m.id}: the base and what its setup adds`);
    assert.deepEqual(ids(library.programs), ids(m.programs).sort(), `${m.id}'s library: its own programs alone`);
    assert.ok(world.entities.some((e) => e.own === m.focus), `${m.id}'s focus program is run`);
    assert.equal(byId(world, "site")?.built ?? false, m.n > 15, `${m.id}: the bridge is open after mission 15`);
    assert.deepEqual(copy(world), copy(missionStart(m).world), `${m.id} starts the same every time`);
  }
  assert.deepEqual(byId(missionStart(mission("c2-m003")).world, "r1").store.items, { wood: 1 }, "mission 3 starts with the wood");
  assert.deepEqual(byId(missionStart(mission("c2-m004")).world, "r1").store.items, {}, "and mission 4 without");
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
  assert.equal(nextOf(mission("c2-m004"), ["c2-m001", "c2-m002", "c2-m003"]).id, "c2-m005");
  assert.equal(nextOf(mission("c2-m025"), ids(CAMPAIGN2)), null, "the last one built has no next yet");
  assert.equal(nextOf(mission("c2-m002"), ids(CAMPAIGN2).filter((id) => id !== "c2-m001")).id, "c2-m001", "one left undone before it comes next");
});

test("a requirement on a mission not built yet stands for the last one built below it, until it's built", () => {
  assert.equal(gateOf("c2-m003"), "c2-m003");
  assert.equal(gateOf("c2-m060"), "c2-m025", "workshops A and B wait for 60: today, for 25");
  assert.equal(gateOf("c2-m085"), "c2-m025");
  assert.throws(() => gateOf("c2-a01"), /isn't a main-path mission/);
  // A workshop lesson after 60, as the plan has it.
  const lesson = { id: "c2-a01", main: false, requires: ["c2-m060"], blocks: ["variables_set"] };
  assert.deepEqual(gatesOf(lesson), ["c2-m025"]);
  assert.equal(isOpen(lesson, ids(CAMPAIGN2).slice(0, 24)), false);
  assert.equal(isOpen(lesson, ids(CAMPAIGN2)), true);
  assert.ok(blocksFor(lesson).includes("controls_repeat_ext"), "it offers what the main path taught");
  assert.ok(!blocksFor(mission("c2-m025")).includes("variables_set"), "and its blocks don't reach the main path");
});

// A category filled as it's opened (Memory, My blocks) counts as what it offers.
const blocksIn = (toolbox) => toolbox.contents.flatMap((c) => c.offers ?? c.contents.map((b) => (b.type === "controls_if" && b.extraState?.hasElse ? "controls_if_else" : b.type)));

test("each mission's toolbox offers what it and the missions it needs introduced", () => {
  const box = (id, type = "helper") => blocksIn(toolboxFor([type], { blocks: missionBlocks(mission(id)) }));
  assert.deepEqual(box("c2-m001"), ["robot_go_to"]);
  assert.deepEqual(box("c2-m003"), ["robot_go_to", "robot_collect", "robot_unload"]);
  assert.deepEqual(box("c2-m005"), ["robot_go_to", "robot_collect", "robot_unload"]);
  assert.deepEqual(box("c2-m006"), ["robot_go_to", "robot_collect", "robot_unload", "controls_repeat_ext"]);
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

test("the first campaign's missions done count for the same lessons, of those built", () => {
  assert.equal(FROM_V1.m01, "c2-m001");
  assert.equal(FROM_V1.m20, "c2-m020");
  assert.deepEqual([FROM_V1.m21, FROM_V1.m24, FROM_V1.m25, FROM_V1.m26, FROM_V1.m40], ["c2-m081", "c2-m084", "c2-m023", "c2-a01", "c2-a15"]);
  assert.equal(Object.keys(FROM_V1).length, 40);
  assert.deepEqual(creditFromV1(ids(CAMPAIGN)), [...ids(CAMPAIGN2).slice(0, 20), "c2-m023"], "all forty done: 1–20, and the kit's recipe; 21, 22, 24 and 25 are new");
  assert.equal(firstOpen(creditFromV1(ids(CAMPAIGN))).id, "c2-m021", "so the new practice starts at 21");
  assert.deepEqual(creditFromV1(["m03", "m01", "m21", "m25"]), ["c2-m001", "c2-m003", "c2-m023"], "in the map's order; 81 isn't built");
  assert.deepEqual(creditFromV1([]), []);
});

// --- Each lesson's mistake fails as the lesson says ---------------------------------------

test("mission 4: collecting before going to the grove stops Robo 1 where it stands", () => {
  const world = playWith("c2-m004");
  assert.equal(byId(world, "r1").error.code, "error.notHere");
  assert.equal(world.mission.done, null);
});

test("mission 5: two trips of one piece do it too", () => {
  const twice = write("c2-m005", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.collect(), p.go("camp"), p.unload()))));
  assert.notEqual(playWith("c2-m005", { "c2-m005": twice }).mission.done, null);
});

test("mission 7: three pieces in two trips aren't one on each trip", () => {
  const full = write("c2-m007", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.collect(), p.go("camp"), p.unload(), p.go("grove"), p.collect(), p.go("camp"), p.unload())));
  const world = playWith("c2-m007", { "c2-m007": full });
  assert.equal(world.mission.done, null);
  assert.equal(world.mission.goals.find((g) => g.id === "trips").done, null);
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
  const twice = write("c2-m009", (p) => p.workspace(p.start(p.repeat(2, p.go("grove"), p.collect(), p.collect(), p.go("camp"), p.unload()))));
  assert.notEqual(playWith("c2-m009", { "c2-m009": twice }).mission.done, null);
});

test("mission 10: the loop without the way home stalls, and a fourth delivery is one too many", () => {
  const stalled = playWith("c2-m010");
  assert.ok(stalled.stall, "the world stalls");
  assert.equal(byId(stalled, "r1").pending.reason.code, "wait.space");
  const four = write("c2-m010", (p) => p.workspace(p.start(p.repeat(4, p.go("grove"), p.collect(), p.go("camp"), p.unload()))));
  const world = playWith("c2-m010", { "c2-m010": four });
  assert.ok(world.mission.goals[0].failed);
  assert.equal(world.mission.done, null);
});

test("mission 13: wood taken to the camp leaves the sawmill waiting for it", () => {
  const camp = write("c2-m013", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.collect(), p.go("camp"), p.unload())));
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

test("mission 16: a number in the Repeat passes one trial only; the sensor passes both", () => {
  const one = write("c2-m016", (p) => p.workspace(p.start(p.repeat(1, p.pickUp()), p.go("depot"), p.unload())));
  const world = playWith("c2-m016", { "c2-m016": one });
  assert.equal(world.mission.passed.length, 1, "one pickup passes the first trial");
  assert.equal(world.mission.done, null, "but not the second");
});

test("mission 17: making a plank without looking makes one too many in the second trial", () => {
  const always = write("c2-m017", (p) => p.workspace(p.start(p.make())));
  const world = playWith("c2-m017", { "c2-m017": always });
  assert.deepEqual([world.mission.passed.length, !!world.mission.goals[0].failed], [1, true]);
});

test("mission 18: without Else, the second trial brings no wood", () => {
  const onlyIf = write("c2-m018", (p) => p.workspace(p.start(p.when(p.compare(p.stock("plank", "sawmill"), "GT", 0), [p.go("sawmill"), p.pickUp(), p.go("depot"), p.unload()]))));
  const world = playWith("c2-m018", { "c2-m018": onlyIf });
  assert.equal(world.mission.passed.length, 1);
  assert.equal(world.mission.done, null);
});

test("mission 19: setting off before both planks are ready fails, though both get delivered", () => {
  const early = write("c2-m019", (p) => p.workspace(p.start(p.go("sawmill"), p.pickUp(), p.pickUp(), p.go("depot"), p.unload())));
  const world = playWith("c2-m019", { "c2-m019": early });
  assert.ok(world.mission.goals[0].failed, "Robo 1 waited at the sawmill");
  assert.equal(world.mission.trial, 0);
});

test("mission 20: a sawmill that makes planks without looking keeps more than two, as the wood keeps coming", () => {
  const greedy = write("c2-m020", (p) => p.workspace(p.start(p.forever(p.make()))));
  const world = playWith("c2-m020", { "c2-m020": greedy });
  assert.equal(world.mission.done, null);
  assert.equal(byId(world, "sawmill").store.items.plank, 4);
});

test("mission 22: wood and stone brought home on two trips aren't one basket", () => {
  const apart = write("c2-m022", (p) => p.workspace(p.start(p.go("grove"), p.collect(), p.go("camp"), p.unload(), p.go("quarry"), p.collect("stone"), p.go("camp"), p.unload())));
  const world = playWith("c2-m022", { "c2-m022": apart });
  assert.equal(world.mission.done, null);
  assert.deepEqual(
    world.mission.goals.map((g) => [g.id, g.done !== null]),
    [
      ["wood", true],
      ["stone", true],
      ["together", false],
    ],
  );
});

test("missions 24 and 25: the planks alone leave the workshop waiting for its stone, and one kit's trips make one kit", () => {
  const planks = write("c2-m024", (p) => p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload())));
  const waiting = playWith("c2-m024", { "c2-m024": planks });
  assert.equal(byId(waiting, "workshop").pending.reason.code, "wait.item");
  assert.equal(waiting.mission.done, null);
  const once = write("c2-m025", (p) =>
    p.workspace(p.start(p.go("sawmill"), p.repeat(2, p.pickUp()), p.go("workshop"), p.unload(), p.go("quarry"), p.collect("stone"), p.go("workshop"), p.unload())),
  );
  const world = playWith("c2-m025", { "c2-m025": once });
  assert.equal(world.mission.done, null);
  assert.equal(world.mission.tally.made["workshop|kit"], 1);
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

// --- Played in the session, apart from the first campaign -------------------------------------

function memoryStorage() {
  const items = new Map();
  return { items, getItem: (k) => (items.has(k) ? items.get(k) : null), setItem: (k, v) => items.set(k, String(v)), removeItem: (k) => items.delete(k) };
}
let reloads = 0;
const reload = () => import(`../src/ui/session.js?campaign2=${++reloads}`);
const withStorage = async (fn) => {
  globalThis.localStorage = memoryStorage();
  try {
    await fn();
  } finally {
    delete globalThis.localStorage;
  }
};

// Applies the reference of the mission `play` is at through the session, as
// the editor would, and steps until it's done.
function solve(session, play) {
  const m = play.mission;
  for (const [id, source] of Object.entries(m.reference.programs)) {
    setDraft(session.currentLibrary(), id, source);
    assert.ok(session.applyProgram(id).command, `${m.id}: ${id} applies`);
  }
  while (play.game.world.mission.done === null) {
    assert.ok(play.game.world.tick < m.steps, `${m.id} done in ${m.steps} steps`);
    play.game.step();
  }
}

test("the second campaign starts at its mission 1, apart from the first, and goes on over its map with a save of its own", () =>
  withStorage(async () => {
    let session = await reload();
    const play = session.usePlay("campaign2");
    assert.equal(play.mission.id, "c2-m001");
    assert.deepEqual(ids(play.library.programs), ["c2-m001"]);
    assert.deepEqual(session.rules(), { tools: ["library"], blocks: ["robot_go_to"], blank: false, sandbox: false });
    assert.equal(session.isCampaignPlay("campaign2"), true);
    assert.equal(session.upcomingMission("campaign2").id, "c2-m002");
    solve(session, play);
    assert.equal(session.nextCampaignMission("campaign2"), true);
    assert.equal(play.mission.id, "c2-m002");
    assert.equal(session.campaignStatus("campaign2").mission.id, "c2-m002");
    assert.deepEqual(session.campaignStatus("campaign2").completed, ["c2-m001"]);
    assert.equal(session.campaignStatus("campaign"), null, "the first campaign hasn't begun");
    assert.ok(globalThis.localStorage.getItem("robot-island:save.campaign2"));
    assert.equal(globalThis.localStorage.getItem("robot-island:save.campaign"), null);
    session = await reload();
    assert.equal(session.campaignStatus("campaign2").mission.id, "c2-m002", "a reload goes on from there");
    assert.equal(session.usePlay("campaign2").mission.id, "c2-m002");
  }));

test("the first time, the first campaign's progress on the device counts; a mission of either can be played again", () =>
  withStorage(async () => {
    const at = CAMPAIGN[7]; // mission 8, missions 1–7 done
    const { world, library } = missionStart(at);
    const save = makeSave({ content: { id: "campaign", version: 1 }, mission: at.id, world, library, checkpoint: world, progress: { completed: ids(CAMPAIGN.slice(0, 7)) } });
    globalThis.localStorage.setItem("robot-island:save.campaign", JSON.stringify(save));
    const session = await reload();
    const play = session.usePlay("campaign2");
    assert.equal(play.mission.id, "c2-m008");
    assert.deepEqual(play.progress.completed, ids(CAMPAIGN2.slice(0, 7)));
    assert.equal(session.usePlay("replay", { mission: "c2-m003" }).mission.id, "c2-m003");
    assert.deepEqual(session.rules().blocks, blocksFor(mission("c2-m003")));
    assert.equal(session.usePlay("replay", { mission: "m03" }).mission.id, "m03");
    session.forgetCampaign();
    assert.equal(globalThis.localStorage.items.size, 0, "starting over forgets both");
  }));

test("free play opens after the second campaign's mission 15, the sandbox after its 25, with the blocks it taught", () =>
  withStorage(async () => {
    const saveAt = (n) => {
      const at = CAMPAIGN2[n - 1];
      const { world, library } = missionStart(at);
      const save = makeSave({ content: { id: "campaign", version: 1 }, mission: at.id, world, library, checkpoint: world, progress: { completed: ids(CAMPAIGN2.slice(0, n - 1)) } });
      globalThis.localStorage.setItem("robot-island:save.campaign2", JSON.stringify(save));
    };
    saveAt(15);
    assert.deepEqual((await reload()).unlocked().free, false);
    saveAt(16);
    let open = (await reload()).unlocked();
    assert.deepEqual([open.free, open.sandbox, open.settings], [true, false, false]);
    assert.ok(open.blocks.includes("building_build") && !open.blocks.includes("sense_stock"));
    saveAt(25);
    open = (await reload()).unlocked();
    assert.equal(open.sandbox, false, "not before mission 25 is done");
    const session = await reload();
    const play = session.usePlay("campaign2");
    solve(session, play);
    open = session.unlocked();
    assert.deepEqual([open.free, open.sandbox, open.settings], [true, true, false], "settings wait for chapter 17");
    assert.equal(session.upcomingMission("campaign2"), null, "mission 25 is the last one built");
  }));
