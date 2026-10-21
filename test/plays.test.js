import { test } from "node:test";
import assert from "node:assert/strict";
import { missionStart, referenceCommands } from "../src/campaign.js";
import { CAMPAIGN, campaignMission } from "../src/content/missions/campaign.js";
import { programDoc, sameBlocks, setDraft } from "../src/programming/programs.js";
import { makeSave } from "../src/storage/saves.js";
import { byId } from "./helpers.js";

// Phase 7's plays in the session (src/ui/session.js), as the pages use them:
// the campaign from mission 1, going on from one mission to the next, each
// from its own start, and saved as it goes; a mission played again on its
// own; free play once mission 15 is done, and the sandbox after 25.

function memoryStorage() {
  const items = new Map();
  return { items, getItem: (k) => (items.has(k) ? items.get(k) : null), setItem: (k, v) => items.set(k, String(v)), removeItem: (k) => items.delete(k) };
}
let reloads = 0;
const reload = () => import(`../src/ui/session.js?plays=${++reloads}`);
const withStorage = async (fn) => {
  globalThis.localStorage = memoryStorage();
  try {
    await fn();
  } finally {
    delete globalThis.localStorage;
  }
};

// The campaign saved at the start of mission `id`, every mission before it
// done: as if the player had played that far. `change(save)` changes the save
// first.
function saveCampaignAt(id, change = () => {}) {
  const mission = campaignMission(id);
  const { world, library } = missionStart(mission);
  const save = makeSave({ content: { id: "campaign", version: 1 }, mission: id, world, library, checkpoint: world, progress: { completed: CAMPAIGN.slice(0, mission.n - 1).map((m) => m.id) } });
  change(save);
  globalThis.localStorage.setItem("robot-island:save.campaign", JSON.stringify(save));
}

// Applies mission `play.mission`'s reference through the session, as the
// editor and the player's choices would, and steps until it's done.
function solve(session, play) {
  const m = play.mission;
  const library = session.currentLibrary();
  for (const [id, source] of Object.entries(m.reference.programs ?? {})) {
    if (!programDoc(library, id)) continue;
    setDraft(library, id, source);
    assert.ok(session.applyProgram(id).command, `${m.id}: ${id} applies`);
  }
  for (const c of m.reference.commands ?? []) session.choose([c]);
  while (play.game.world.mission.done === null) {
    assert.ok(play.game.world.tick < m.steps, `${m.id} done in ${m.steps} steps`);
    play.game.step();
  }
}

test("the campaign starts at mission 1, with only its blocks, and the program library to open every program", () =>
  withStorage(async () => {
    const session = await reload();
    const play = session.usePlay("campaign");
    assert.equal(play.mission.id, "c2-m001");
    assert.deepEqual(
      [...play.game.world.entities, ...play.game.world.nodes].map((t) => t.id),
      ["camp", "r1", "grove"],
    );
    assert.deepEqual(
      play.library.programs.map((p) => p.id),
      ["c2-m001"],
    );
    assert.deepEqual(session.rules(), { tools: ["library"], blocks: ["robot_go_to"], blank: false, sandbox: false });
    assert.equal(session.campaignStatus().mission.id, "c2-m001");
    assert.equal(session.upcomingMission().id, "c2-m002");
    assert.deepEqual(session.unlocked().free, false);
  }));

test("a mission done goes on to the next from its start, keeping nothing of the one before; a reload goes on from there", () =>
  withStorage(async () => {
    const session = await reload();
    const play = session.usePlay("campaign");
    assert.equal(session.nextCampaignMission(), false, "not before it's done");
    solve(session, play);
    assert.equal(session.savePlay(), true);
    assert.deepEqual(session.campaignStatus().completed, ["c2-m001"]);
    assert.equal(session.nextCampaignMission(), true);
    assert.equal(play.mission.id, "c2-m002");
    assert.deepEqual(play.game.world, missionStart(campaignMission("c2-m002")).world, "mission 2's start, whatever mission 1 left");
    assert.deepEqual(
      play.library.programs.map((p) => p.id),
      ["c2-m002"],
      "its own programs alone",
    );
    assert.deepEqual(session.rules().blocks, ["robot_go_to", "robot_collect"]);

    const again = (await reload()).usePlay("campaign");
    assert.equal(again.mission.id, "c2-m002");
    assert.deepEqual(again.progress.completed, ["c2-m001"]);
    assert.deepEqual(again.game.world, play.game.world);
  }));

test("a mission done and saved isn't played again after a reload: the next one starts", () =>
  withStorage(async () => {
    const session = await reload();
    solve(session, session.usePlay("campaign"));
    assert.equal(session.savePlay(), true);
    const after = await reload();
    assert.deepEqual(after.campaignStatus(), { mission: campaignMission("c2-m002"), done: false, completed: ["c2-m001"], tick: 0, saved: true }, "as the title page shows it");
    const play = after.usePlay("campaign");
    assert.equal(play.mission.id, "c2-m002");
    assert.deepEqual(play.game.world, missionStart(campaignMission("c2-m002")).world);
    assert.deepEqual(play.progress.completed, ["c2-m001"]);
  }));

test("Start again goes back to the mission's one start, keeping the player's programs", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m019");
    const session = await reload();
    const play = session.usePlay("campaign");
    assert.equal(play.mission.id, "c2-m019");
    solve(session, play);
    const game = session.newGame();
    assert.deepEqual([game.world.tick, game.world.mission.done], [0, null]);
    assert.equal(byId(game.world, "sawmill").own, "c2-m019-mill", "the mission's own sawmill program");
    assert.equal(byId(game.world, "r1").runtime.revision, 2, "Robo 1's program as applied");
  }));

test("a mission played again is a world and library of its own: the campaign doesn't change", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m005");
    const session = await reload();
    const campaign = session.usePlay("campaign");
    const before = JSON.stringify(campaign.library);
    const replay = session.usePlay("replay", { mission: "c2-m003" });
    assert.equal(replay.mission.id, "c2-m003");
    assert.deepEqual(byId(replay.game.world, "r1").store.items, { wood: 1 });
    assert.deepEqual(session.rules().tools, ["library"]);
    solve(session, replay);
    session.savePlay();
    assert.equal(JSON.stringify(campaign.library), before, "the campaign's programs are as they were");
    assert.deepEqual(
      replay.library.programs.map((p) => p.id),
      ["c2-m003"],
      "the replay's programs are mission 3's own",
    );
    const other = session.usePlay("replay", { mission: "c2-m002" });
    assert.notEqual(other, replay, "another mission's replay starts afresh");
    other.game.step();
    assert.equal(session.usePlay("replay", { mission: "c2-m002" }), other, "the same replay, asked for again before it's done");
    solve(session, other);
    const fresh = session.usePlay("replay", { mission: "c2-m002" });
    assert.notEqual(fresh, other, "and once it's done, afresh");
    assert.equal(fresh.game.world.tick, 0);
  }));

test("the sandbox's new island keeps every program's blocks as the library has them, whatever the layout", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m025");
    const session = await reload();
    solve(session, session.usePlay("campaign"));
    session.savePlay();
    session.usePlay("free");
    for (const bridge of ["toBuild", "built", "toBuild"]) {
      const p = session.newFreeIsland({ bridge });
      for (const program of p.game.world.programs) {
        const source = programDoc(p.library, program.id).published.find((r) => r.revision === program.revision)?.source;
        assert.ok(source, `${bridge}: ${program.id} revision ${program.revision} is in the library`);
      }
      assert.equal((await reload()).usePlay("free").notice, null, `${bridge}: the save reads back`);
    }
  }));

test("free play opens after mission 15 with the blocks learned so far and programs of its own", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m016");
    const session = await reload();
    const open = session.unlocked();
    assert.deepEqual([open.free, open.sandbox, open.settings], [true, false, false]);
    const free = session.usePlay("free");
    assert.equal(free.mission, null);
    const rules = session.rules();
    assert.deepEqual(rules.tools, ["library"]);
    assert.ok(rules.blocks.includes("building_build") && !rules.blocks.includes("sense_stock"));
    assert.equal(programDoc(free.library, "c2-m015"), null, "the missions' programs stay in them");
    assert.ok(programDoc(free.library, "collector"), "free play has its own");
    assert.deepEqual(session.blueprints(), [], "no building to place yet");
    assert.equal(session.savePlay(), true);
  }));

test("the sandbox opens after mission 25: it adds robots, sets supplies and starts the island anew as the player lays it out, keeping the programs", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m025");
    const session = await reload();
    const campaign = session.usePlay("campaign");
    solve(session, campaign);
    session.savePlay();
    const free = session.usePlay("free");
    const rules = session.rules();
    assert.equal(rules.sandbox, true);
    assert.deepEqual(rules.tools, ["library", "build"], "settings come with chapter 17's mission 82");
    assert.deepEqual(session.blueprints(), [{ blueprint: "workshop", program: "build-workshop" }]);
    assert.equal(session.addRobot(), "r4");
    session.setStock("grove", "wood", 3);
    free.game.step();
    assert.equal(byId(free.game.world, "r4").kind, "robot");
    assert.equal(byId(free.game.world, "grove").store.items.wood, 3);
    setDraft(free.library, "collector", JSON.parse(JSON.stringify(campaignMission("c2-m001").reference.programs["c2-m001"])));
    session.applyProgram("collector");
    const layout = { robots: 5, supplies: "plenty", bridge: "toBuild", workshop: "built" };
    const fresh = session.newFreeIsland(layout);
    assert.notEqual(fresh, free);
    assert.equal(session.currentPlay(), fresh);
    assert.equal(fresh.game.world.entities.filter((e) => e.kind === "robot").length, 5);
    assert.equal(byId(fresh.game.world, "site").built, false);
    assert.ok(byId(fresh.game.world, "workshop"));
    assert.equal(byId(fresh.game.world, "grove").store.items.wood, 24);
    assert.equal(byId(fresh.game.world, "r1").runtime.revision, 2, "the collector as the player changed it");
  }));

test("the help puts a start, the whole program, or nothing but the start block into a program's draft", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m005");
    const session = await reload();
    const play = session.usePlay("campaign");
    const doc = () => programDoc(play.library, "c2-m005");
    assert.equal(session.showProgram("c2-m005", "start"), true);
    assert.ok(sameBlocks(doc().draft, play.mission.scaffold["c2-m005"]));
    assert.equal(session.showProgram("c2-m005", "whole"), true);
    assert.ok(sameBlocks(doc().draft, play.mission.reference.programs["c2-m005"]));
    assert.equal(session.showProgram("c2-m005", "blank"), true);
    assert.deepEqual(
      doc().draft.blocks.blocks.map((b) => [b.type, b.next ?? null]),
      [["island_when_started", null]],
    );
    assert.equal(session.showProgram("c2-m004", "start"), false, "another mission's program");
    assert.equal(session.rules().blank, false, "its starter is the start block alone already");
  }));

test("a campaign save that can't be used is let go, and the campaign starts at mission 1", () =>
  withStorage(async () => {
    globalThis.localStorage.setItem("robot-island:save.campaign", JSON.stringify({ format: "robot-island", schema: 1 }));
    const warn = console.warn;
    console.warn = () => {};
    const play = (await reload()).usePlay("campaign");
    console.warn = warn;
    assert.equal(play.notice, "discarded");
    assert.equal(play.mission.id, "c2-m001");
  }));

test("starting over forgets the campaign, free play and any replay", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m016");
    const session = await reload();
    session.usePlay("free");
    session.savePlay();
    session.usePlay("replay", { mission: "c2-m002" });
    session.savePlay();
    assert.equal(globalThis.localStorage.items.size, 3);
    session.forgetCampaign();
    assert.equal(globalThis.localStorage.items.size, 0);
    assert.equal(session.campaignStatus(), null);
    assert.equal(session.unlocked().free, false);
  }));

test("a reference solution is applied as the editor applies programs: a publish for each, at the next step", () => {
  const m = campaignMission("c2-m015");
  const { world, library } = missionStart(m);
  const commands = referenceCommands(world, library, m);
  assert.deepEqual(
    commands.map((c) => [c.type, c.program?.id ?? c.entity]),
    [["publish", "c2-m015"]],
  );
  assert.equal(world.entities.find((e) => e.id === "site").own, "c2-m015", "the construction site's program");
});

test("a mission that's about placing offers its blueprint and the Build tool, and placing does it", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m026");
    const session = await reload();
    const play = session.usePlay("campaign");
    assert.equal(play.mission.id, "c2-m026");
    assert.deepEqual(session.rules().tools, ["library", "build"]);
    assert.deepEqual(session.blueprints(), [{ blueprint: "workshop", program: null, plots: [{ x: 24, z: 16, facing: "south" }] }]);
    assert.equal(session.placeBuilding({ blueprint: "workshop", x: 9, z: 16, facing: "south" }), false, "not on the camp");
    assert.deepEqual(session.checkPlace({ blueprint: "workshop", x: 25, z: 17, facing: "south" }).problem, { code: "place.plot" }, "open ground, but not its plot");
    assert.equal(session.placeBuilding({ blueprint: "workshop", x: 24, z: 16, facing: "west" }), false, "its plot, but turned");
    assert.equal(session.placeBuilding({ blueprint: "workshop", x: 24, z: 16, facing: "south" }), true);
    play.game.step();
    assert.notEqual(play.game.world.mission.done, null);
    assert.equal(session.savePlay(), true);
  }));

test("a mission saved before its building is placed reads back, though a program names the building", () =>
  withStorage(async () => {
    saveCampaignAt("c2-m028");
    const play = (await reload()).usePlay("campaign");
    assert.deepEqual([play.mission.id, play.notice], ["c2-m028", null]);
  }));
