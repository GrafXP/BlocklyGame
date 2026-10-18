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

test("its missions are chapters 1 and 2 so far, numbered on the main path, with ids no first-campaign mission has", () => {
  assert.deepEqual(ids(CAMPAIGN2), Array.from({ length: 10 }, (_, i) => `c2-m${String(i + 1).padStart(3, "0")}`));
  assert.deepEqual(
    CAMPAIGN2.map((m) => [m.n, m.chapter, m.main]),
    Array.from({ length: 10 }, (_, i) => [i + 1, i < 5 ? 1 : 2, true]),
  );
  assert.deepEqual(
    CHAPTERS2.map((c) => [c.chapter, ids(c.missions)]),
    [
      [1, ids(CAMPAIGN2.slice(0, 5))],
      [2, ids(CAMPAIGN2.slice(5))],
    ],
  );
  for (const m of CAMPAIGN2) {
    assert.equal(missionById(m.id), m);
    assert.ok(!CAMPAIGN.some((old) => old.id === m.id));
  }
  assert.deepEqual(
    CAMPAIGN2.filter((m) => m.milestone).map((m) => m.n),
    [5, 10],
  );
});

test("the child writes the program: a Build mission's starts with its start block alone; a Repair or Change mission's with a whole program", () => {
  const kinds = Object.fromEntries(CAMPAIGN2.map((m) => [m.n, m.workspace]));
  assert.deepEqual(kinds, { 1: "build", 2: "build", 3: "build", 4: "repair", 5: "build", 6: "build", 7: "build", 8: "repair", 9: "change", 10: "repair" });
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
  const things = (world) => [...world.entities, ...world.nodes].map((t) => t.id);
  for (const m of CAMPAIGN2) {
    const { world, library } = missionStart(m);
    assert.deepEqual(checkWorld(world), [], `${m.id}'s start`);
    assert.deepEqual(things(world), ["camp", "r1", "grove"], `${m.id}: chapters 1 and 2 need nothing more`);
    assert.deepEqual(ids(library.programs), ids(m.programs), `${m.id}'s library`);
    assert.equal(byId(world, "r1").own, m.focus);
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
  assert.equal(nextOf(mission("c2-m010"), ids(CAMPAIGN2)), null, "the last one built has no next yet");
  assert.equal(nextOf(mission("c2-m002"), ids(CAMPAIGN2).filter((id) => id !== "c2-m001")).id, "c2-m001", "one left undone before it comes next");
});

test("a requirement on a mission not built yet stands for the last one built below it, until it's built", () => {
  assert.equal(gateOf("c2-m003"), "c2-m003");
  assert.equal(gateOf("c2-m060"), "c2-m010", "workshops A and B wait for 60: today, for 10");
  assert.equal(gateOf("c2-m085"), "c2-m010");
  assert.throws(() => gateOf("c2-a01"), /isn't a main-path mission/);
  // A workshop lesson after 60, as the plan has it.
  const lesson = { id: "c2-a01", main: false, requires: ["c2-m060"], blocks: ["variables_set"] };
  assert.deepEqual(gatesOf(lesson), ["c2-m010"]);
  assert.equal(isOpen(lesson, ids(CAMPAIGN2).slice(0, 9)), false);
  assert.equal(isOpen(lesson, ids(CAMPAIGN2)), true);
  assert.ok(blocksFor(lesson).includes("controls_repeat_ext"), "it offers what the main path taught");
  assert.ok(!blocksFor(mission("c2-m010")).includes("variables_set"), "and its blocks don't reach the main path");
});

// A category filled as it's opened (Memory, My blocks) counts as what it offers.
const blocksIn = (toolbox) => toolbox.contents.flatMap((c) => c.offers ?? c.contents.map((b) => (b.type === "controls_if" && b.extraState?.hasElse ? "controls_if_else" : b.type)));

test("each mission's toolbox offers what it and the missions it needs introduced", () => {
  const box = (id) => blocksIn(toolboxFor(["helper"], { blocks: missionBlocks(mission(id)) }));
  assert.deepEqual(box("c2-m001"), ["robot_go_to"]);
  assert.deepEqual(box("c2-m003"), ["robot_go_to", "robot_collect", "robot_unload"]);
  assert.deepEqual(box("c2-m005"), ["robot_go_to", "robot_collect", "robot_unload"]);
  assert.deepEqual(box("c2-m006"), ["robot_go_to", "robot_collect", "robot_unload", "controls_repeat_ext"]);
  assert.deepEqual(box("c2-m010"), box("c2-m006"));
});

test("the first campaign's missions done count for the same lessons, of those built", () => {
  assert.equal(FROM_V1.m01, "c2-m001");
  assert.equal(FROM_V1.m20, "c2-m020");
  assert.deepEqual([FROM_V1.m21, FROM_V1.m24, FROM_V1.m25, FROM_V1.m26, FROM_V1.m40], ["c2-m081", "c2-m084", "c2-m023", "c2-a01", "c2-a15"]);
  assert.equal(Object.keys(FROM_V1).length, 40);
  assert.deepEqual(creditFromV1(ids(CAMPAIGN)), ids(CAMPAIGN2), "all forty done: every mission built so far");
  assert.deepEqual(creditFromV1(["m03", "m01", "m21", "m25"]), ["c2-m001", "c2-m003"], "in the map's order; 81 and 23 aren't built");
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
