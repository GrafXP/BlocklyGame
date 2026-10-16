import { test } from "node:test";
import assert from "node:assert/strict";
import { display } from "../src/i18n/index.js";
import { latest, programDoc, setDraft } from "../src/programming/programs.js";
import { byId } from "./helpers.js";
import { program, unload } from "./programs.js";

// Phase 6's tools in the session (src/ui/session.js), as the island page uses
// them: who runs what, chosen at the next step and previewed by name first;
// a robot's own copy; settings and names; the program library; placing a
// building; and Start again, which keeps the player's choices.

// A fresh copy of the session module: as after a reload of the page.
let reloads = 0;
const fresh = async () => {
  const session = await import(`../src/ui/session.js?phase6=${++reloads}`);
  return { session, play: session.usePlay("island") };
};
const step = (play, n = 1) => {
  for (let i = 0; i < n; i++) play.game.step();
};

test("a choice of program or team is previewed by name, made at the next step, and shown at once in the world as it will be", async () => {
  const { session, play } = await fresh();
  const commands = session.COMMANDS.team("r2", "wood-team");
  assert.deepEqual(session.preview(commands), { ok: true, changed: [{ id: "r2", program: "collector" }] });
  // A team's program for everyone on it: exactly those whose program changes.
  assert.deepEqual(session.preview(session.COMMANDS.shared({ role: "wood-team" }, "fetch")).changed, [{ id: "r1", program: "fetch" }]);
  assert.deepEqual(session.preview(session.COMMANDS.shared({ role: "wood-team" }, "collector")).changed, [], "it's already theirs");
  assert.equal(session.preview(session.COMMANDS.shared({ role: "wood-team" }, "planks")).ok, false, "robots can't make planks");
  session.choose(commands);
  assert.equal(play.game.queued, 1);
  assert.equal(byId(play.game.world, "r2").role, "plank-team", "the world itself waits for the next step");
  assert.equal(byId(session.peekWorld(), "r2").role, "wood-team");
  assert.deepEqual(session.programUse("collector").runners, ["r1", "r2"]);
  // Now both share it, a change to it reaches both.
  assert.deepEqual(session.preview(session.COMMANDS.shared({ role: "wood-team" }, "fetch")).changed, [
    { id: "r1", program: "fetch" },
    { id: "r2", program: "fetch" },
  ]);
  step(play);
  assert.equal(byId(play.game.world, "r2").runtime.program, "collector");
  assert.equal(session.peekWorld(), play.game.world, "nothing waits");
  assert.equal(play.changed, false, "chosen before the world ran");
});

test("Apply in the editor starts again exactly the robots it names, those that will run the program at the next step", async () => {
  const { session, play } = await fresh();
  step(play, 30);
  session.choose(session.COMMANDS.team("r3", "wood-team"));
  assert.deepEqual(
    session.programContext("collector").runners.map((e) => e.id),
    ["r1", "r3"],
    "Robo 3's change of team counts, though it's still waiting",
  );
  const library = session.currentLibrary();
  setDraft(library, "collector", JSON.parse(JSON.stringify(latest(programDoc(library, "collector")).source).replace('"PLACE":"sawmill"', '"PLACE":"depot"')));
  const before = JSON.parse(JSON.stringify(play.game.world));
  assert.ok(session.applyProgram("collector").command);
  step(play);
  const restarted = play.game.world.entities.filter((e) => e.runtime?.revision === 2).map((e) => e.id);
  assert.deepEqual(restarted, ["r1", "r3"]);
  assert.equal(byId(play.game.world, "r2").runtime.revision, byId(before, "r2").runtime.revision);
  assert.equal(play.changed, true);
});

test("a robot's own copy is a new program only it runs, which can change without changing its team's", async () => {
  const { session, play } = await fresh();
  session.choose(session.COMMANDS.team("r2", "wood-team"));
  step(play);
  const id = session.makeOwnCopy("r2");
  assert.equal(id, "collector-r2");
  const doc = programDoc(session.currentLibrary(), id);
  assert.equal(display(doc.name), "Wood collector (Robo 2)");
  step(play);
  assert.equal(byId(play.game.world, "r2").own, id);
  assert.equal(byId(play.game.world, "r2").runtime.program, id);
  assert.equal(byId(play.game.world, "r1").runtime.program, "collector");
  // Editing the copy reaches Robo 2 alone.
  setDraft(session.currentLibrary(), id, program(unload("u")));
  assert.deepEqual(
    session.programContext(id).runners.map((e) => e.id),
    ["r2"],
  );
  session.applyProgram(id);
  step(play);
  assert.equal(byId(play.game.world, "r2").runtime.revision, 2);
  assert.equal(byId(play.game.world, "r1").runtime.revision, 1);
  // And back to the team's.
  session.choose(session.COMMANDS.give("r2", null));
  step(play);
  assert.equal(byId(play.game.world, "r2").runtime.program, "collector");
  assert.equal(byId(play.game.world, "r2").own, null);
});

test("settings and names are made at the next step and start nothing again", async () => {
  const { session, play } = await fresh();
  step(play, 20);
  const runtime = JSON.stringify(byId(play.game.world, "r1").runtime);
  session.setSetting("r1", "destination", "depot");
  session.nameRobot("r1", "Blinky");
  assert.equal(byId(session.peekWorld(), "r1").settings.destination, "depot");
  assert.equal(play.changed, false, "nothing starts again, so nothing to watch from the start");
  step(play);
  const r1 = byId(play.game.world, "r1");
  assert.equal(r1.settings.destination, "depot");
  assert.equal(r1.name, "Blinky");
  assert.equal(JSON.parse(runtime).program, r1.runtime.program);
  assert.ok(r1.runtime.evaluated === null || r1.runtime.evaluated.tick <= play.game.world.tick, "it went on");
});

test("the library makes new programs and copies, names them, and puts away only what nothing uses", async () => {
  const { session } = await fresh();
  const id = session.createProgram();
  assert.equal(id, "program");
  assert.equal(display(programDoc(session.currentLibrary(), id).name), "New program 1");
  assert.equal(session.createProgram(), "program-2");
  const copy = session.duplicateProgram("collector");
  assert.equal(display(programDoc(session.currentLibrary(), copy).name), "Copy of Wood collector");
  assert.equal(session.nameProgram(copy, "  Fast collector "), true);
  assert.equal(programDoc(session.currentLibrary(), copy).name, "Fast collector");
  assert.equal(session.nameProgram(copy, "   "), false);
  assert.equal(session.putAway("collector"), false, "the Wood team uses it");
  assert.equal(session.putAway(copy), true);
  assert.equal(programDoc(session.currentLibrary(), copy).archived, true);
  assert.equal(session.putAway(copy, false), true);
  // A program the world hasn't had yet is published as it's given.
  assert.deepEqual(
    session.COMMANDS.give("r1", "program").map((c) => c.type),
    ["publish", "assign"],
  );
  assert.equal(session.canRunProgram("r1", "planks"), false);
  assert.equal(session.canRunProgram("r1", "fetch"), true);
  assert.equal(session.canRunProgram("sawmill", "fetch"), false);
  assert.equal(session.canRunProgram("sawmill", "kits"), false, "a sawmill makes no kits, though it can make");
  assert.equal(session.canRunProgram("sawmill", "program"), true, "a start block alone runs on anything");
});

test("a building is placed where it fits, at the next step; Start again keeps who runs what, settings and names, but not the building", async () => {
  const { session, play } = await fresh();
  assert.deepEqual(session.blueprints(), [{ blueprint: "workshop", program: "build-workshop" }]);
  assert.deepEqual(session.tools(), ["library", "settings", "build"]);
  assert.equal(session.placeBuilding({ blueprint: "workshop", x: 13, z: 5, facing: "south" }), false, "on the sawmill");
  assert.equal(session.placeBuilding({ blueprint: "workshop", x: 24, z: 17, facing: "south" }), true);
  assert.equal(session.checkPlace({ blueprint: "workshop", x: 24, z: 17, facing: "south" }).problem.code, "place.taken", "the plan already waiting counts");
  session.choose(session.COMMANDS.team("r3", "wood-team"));
  session.setSetting("r3", "destination", "camp");
  session.nameRobot("r3", "Pebble");
  step(play, 50);
  assert.equal(byId(play.game.world, "workshop").type, "site");
  const id = session.makeOwnCopy("r2");
  step(play);

  const game = session.newGame();
  assert.equal(game.world.tick, 0);
  assert.equal(byId(game.world, "workshop"), undefined, "a building placed since is part of the world, and goes");
  const r3 = byId(game.world, "r3");
  assert.deepEqual([r3.role, r3.settings.destination, r3.name, r3.runtime.program, r3.runtime.at], ["wood-team", "camp", "Pebble", "collector", 0]);
  assert.equal(byId(game.world, "r2").runtime.program, id, "its own copy too");
  // The slice offers none of this.
  session.usePlay("slice");
  assert.deepEqual(session.tools(), []);
  assert.deepEqual(session.blueprints(), []);
});
