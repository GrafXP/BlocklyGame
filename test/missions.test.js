import { test } from "node:test";
import assert from "node:assert/strict";
import { ENGLISH } from "../src/i18n/index.js";
import { MISSIONS, missionKeys } from "../src/content/missions/index.js";
import { SLICE } from "../src/content/missions/slice.js";
import { applyDraft, createLibrary, newestPrograms, setDraft } from "../src/programming/programs.js";
import { createWorld, statusOf, reasonOf } from "../src/sim/world.js";
import { checkGoals, createMission } from "../src/sim/objectives.js";
import { checkWorld } from "../src/sim/validate.js";
import { missionProgress } from "../src/ui/mission.js";
import { byId, run, runUntil, tinyWorld } from "./helpers.js";
import { build, program } from "./programs.js";

// Missions (PLAN.md §9; Phase 5's bridge slice): goals are met in the world, by
// work that has ended, whatever programs did it; the reference solution meets
// them within the mission's steps; and a mission's words are in every language.

const places = [...SLICE.content.entities, ...SLICE.content.nodes].map((t) => t.id);
const types = (world, id) => [...new Set(world.entities.filter((e) => e.runtime?.program === id).map((e) => e.type))];

// The slice's world, its library, and the reference programs applied as the
// editor applies them (src/ui/session.js), on tick `at`.
function slice({ reference = false, at = 1 } = {}) {
  const library = createLibrary(SLICE.content.programs);
  const world = createWorld({ ...SLICE.content, programs: newestPrograms(library) });
  const commands = {};
  if (reference) {
    commands[at] = Object.entries(SLICE.reference).map(([id, source]) => {
      setDraft(library, id, source);
      return applyDraft(library, id, { types: types(world, id), places }).command;
    });
    assert.ok(commands[at].every(Boolean), "the reference programs compile for what runs them");
  }
  return { world, library, commands };
}

// --- Goals --------------------------------------------------------------------

// A construction site that builds the bridge over the water at [4, 1], with a
// robot beside it, and the mission to get it built.
const site = (extra = {}) => ({ id: "site", type: "site", name: "site", area: { x: 2, z: 1, w: 1, d: 1 }, access: [[2, 2]], caps: { plank: 4 }, gap: [[4, 1]], ...extra });
const withMission = (extra, reward = []) =>
  createWorld({
    id: "test",
    version: 1,
    terrain: ["~~~~~~~~~~", "~...~.~..~", "~........~", "~~~~~~~~~~"],
    entities: [site(extra), { id: "r1", type: "helper", name: "r1", cell: [1, 2] }],
    nodes: [],
    programs: [{ id: "b", source: program(build("b")) }],
    mission: { id: "m", goals: [{ id: "bridge", type: "built", at: "site" }], reward },
  });

test("a world's mission has its goals unmet until they hold; a world without one has none", () => {
  const world = withMission({ program: "b" });
  const goal = { id: "bridge", type: "built", at: "site" };
  assert.deepEqual(world.mission, {
    id: "m",
    trials: [{ stage: null, goals: [goal] }],
    trial: 0,
    passed: [],
    goals: [{ ...goal, done: null, failed: null }],
    tally: { unloads: {}, made: {}, waited: {} },
    collected: {},
    reward: [],
    done: null,
  });
  assert.deepEqual(checkWorld(world), []);
  assert.equal(tinyWorld().mission, null);
  assert.deepEqual(checkGoals(tinyWorld(), 1), { met: [], passed: null, done: false });
  assert.throws(() => createMission({ id: "m", goals: [{ id: "x", type: "wished" }] }), /no goal type "wished"/);
});

test("a goal is met when the work has ended, not when it starts, and the mission with its last goal", () => {
  const world = withMission({ program: "b", items: { plank: 4 } });
  const traces = run(world, 45);
  const started = traces.find((t) => t.started.some((s) => s.entity === "site")).tick;
  const ended = traces.find((t) => t.ended.some((s) => s.entity === "site")).tick;
  assert.equal(ended - started, 40, "building the bridge takes its 40 steps");
  for (const t of traces) {
    assert.deepEqual(t.goals, t.tick === ended ? ["bridge"] : [], `goals at tick ${t.tick}`);
    assert.equal(t.done, t.tick === ended);
  }
  assert.deepEqual(world.mission.goals[0].done, ended);
  assert.equal(world.mission.done, ended);
  // Met for good: nothing after changes it.
  run(world, 20);
  assert.equal(world.mission.done, ended);
});

test("the reward is given in the tick the mission is done: commands, as the player's are", () => {
  const world = withMission({ program: "b", items: { plank: 4 } }, [{ type: "assign", entity: "r1", program: "b" }]);
  // r1 can't build: a reward that doesn't fit the world changes nothing, like any command.
  runUntil(world, (w) => w.mission.done !== null);
  assert.equal(byId(world, "r1").runtime, null);
  const ok = withMission({ program: "b", items: { plank: 4 } }, [{ type: "restart", entity: "site" }]);
  runUntil(ok, (w) => w.mission.done !== null);
  assert.equal(byId(ok, "site").runtime.at, 0, "started again at the end of the tick");
});

test("the world's rules hold the mission to its goals", () => {
  const world = withMission({ program: "b" });
  world.mission.done = 0;
  assert.ok(checkWorld(world).some((p) => /the mission was done at 0/.test(p)));
  const unknown = withMission({ program: "b" });
  unknown.mission.goals[0].type = "wished";
  assert.ok(checkWorld(unknown).some((p) => /goal/.test(p)));
  const future = withMission({ program: "b" });
  future.mission.goals[0].done = 5;
  assert.ok(checkWorld(future).some((p) => /goal bridge was met at 5/.test(p)));
});

// --- The bridge slice ---------------------------------------------------------

test("the slice starts with the collector and sawmill working, the courier going to the depot, the site's block not attached, and Robo 3's job parked", () => {
  const { world } = slice();
  const runs = Object.fromEntries(world.entities.map((e) => [e.id, e.runtime?.program ?? null]));
  assert.deepEqual(runs, { camp: null, depot: null, r1: "collector", r2: "courier", r3: "stones", sawmill: "planks", site: "bridge" });
  assert.deepEqual(
    world.programs.map((p) => p.id),
    ["bridge", "collector", "courier", "planks", "stones"],
  );
  assert.equal(byId(world, "r3").runtime.parked, true);
  assert.equal(byId(world, "r1").runtime.parked, undefined);
  assert.deepEqual(world.mission.goals, [{ id: "bridge", type: "built", at: "site", done: null, failed: null }]);
  run(world, 50);
  assert.equal(statusOf(byId(world, "site")), "stopped", "its start block has nothing under it");
  assert.equal(statusOf(byId(world, "r3")), "stopped", "Robo 3 waits for its job");
  assert.equal(byId(world, "r3").runtime.evaluated, null, "and has taken no step");
});

test("the starter programs alone never build the bridge: the planks go to the depot until everything stalls", () => {
  const { world } = slice();
  runUntil(world, (w) => w.stall, 3000);
  assert.equal(world.mission.done, null);
  assert.equal(byId(world, "site").built, false);
  assert.equal(byId(world, "depot").store.items.plank, 20);
  assert.deepEqual(byId(world, "site").store.items, {});
});

test("the reference solution builds the bridge within the mission's steps, and Robo 3 crosses the stream", () => {
  const { world, commands } = slice({ reference: true });
  const traces = [];
  while (world.mission.done === null) {
    assert.ok(world.tick < SLICE.steps, `not done in ${SLICE.steps} steps`);
    traces.push(...run(world, 1, commands));
  }
  assert.ok(world.tick <= SLICE.steps);
  assert.equal(byId(world, "site").built, true);
  assert.equal(world.nav, 1, "the bridge changed the ways");
  assert.equal(traces.at(-1).done, true);
  // Every plank the site used came from wood the collector brought, by the courier.
  const delivered = traces.filter((t) => t.ended.some((e) => e.entity === "r2" && e.type === "unload")).length;
  assert.equal(delivered, 2, "two trips of two planks");
  // The reward: Robo 3 takes the stone carrier's job, across the new bridge.
  assert.equal(byId(world, "r3").runtime.program, "stones");
  const quarry = byId(world, "quarry");
  runUntil(world, (w) => byId(w, "depot").store.items.stone >= 2, 1000);
  assert.ok(quarry.store.items.stone < 8, "stone came from the stone pit");
});

test("the planks still reach the bridge when the player fixes the courier first and the site later", () => {
  const { world, library } = slice();
  run(world, 50);
  const fix = (id) => {
    setDraft(library, id, SLICE.reference[id]);
    return applyDraft(library, id, { types: types(world, id), places }).command;
  };
  run(world, 1, { 51: [fix("courier")] });
  // The courier brings planks, but the site can't take more than four.
  runUntil(world, (w) => reasonOf(byId(w, "r2"))?.code === "wait.space", SLICE.steps);
  assert.equal(byId(world, "site").store.items.plank, 4);
  assert.equal(world.mission.done, null);
  run(world, 1, { [world.tick + 1]: [fix("bridge")] });
  runUntil(world, (w) => w.mission.done !== null, SLICE.steps);
});

test("a courier changed while it carries planks starts again with an empty basket, and the bridge still gets built", () => {
  // A robot given a program starts with an empty basket (src/sim/commands.js).
  // Kept, two planks would have filled the basket its program starts by
  // filling, and it would have waited for room for ever.
  const { world, library } = slice();
  runUntil(world, (w) => byId(w, "r2").store.items.plank === 2);
  const fix = (id) => {
    setDraft(library, id, SLICE.reference[id]);
    return applyDraft(library, id, { types: types(world, id), places }).command;
  };
  run(world, 1, { [world.tick + 1]: [fix("courier"), fix("bridge")] });
  assert.deepEqual(byId(world, "r2").store.items, {}, "the planks it carried are gone");
  runUntil(world, (w) => w.mission.done !== null, SLICE.steps);
});

test("Robo 3's parked job starts when the bridge is built, or when the player applies it", () => {
  const { world, commands } = slice({ reference: true });
  run(world, 1, commands);
  runUntil(world, (w) => w.mission.done !== null, SLICE.steps);
  assert.equal(byId(world, "r3").runtime.parked, undefined, "the reward started it");
  run(world, 5);
  assert.ok(byId(world, "r3").runtime.evaluated, "and it takes steps");

  // Applied by the player before that: a publish, which keeps it parked at the
  // new revision, then an assign, which starts it (src/ui/session.js).
  const early = slice();
  setDraft(early.library, "stones", SLICE.reference.courier);
  const { command } = applyDraft(early.library, "stones", { types: ["helper"], places });
  run(early.world, 1, { 1: [command] });
  assert.deepEqual([byId(early.world, "r3").runtime.revision, byId(early.world, "r3").runtime.parked], [2, true], "a publish alone keeps it parked");
  run(early.world, 1, { 2: [{ type: "assign", entity: "r3", program: "stones" }] });
  assert.equal(byId(early.world, "r3").runtime.parked, undefined);
  assert.deepEqual(byId(early.world, "r3").runtime.evaluated, { block: "courier-forever", tick: 2 }, "its first step, in that tick");
  run(early.world, 1);
  assert.equal(statusOf(byId(early.world, "r3")), "moving");
});

test("the card's progress counts the site's planks, then the work on the bridge, then the mission done", () => {
  const { world, commands } = slice({ reference: true });
  assert.deepEqual(missionProgress(world, SLICE), { item: "plank", have: 0, need: 4, building: null, done: false });
  run(world, 1, commands);
  runUntil(world, (w) => byId(w, "site").store.items.plank === 2, SLICE.steps);
  assert.equal(missionProgress(world, SLICE).have, 2);
  runUntil(world, (w) => byId(w, "site").action, SLICE.steps);
  const building = missionProgress(world, SLICE);
  assert.equal(building.have, 4);
  assert.deepEqual(building.building, { done: 0, total: 40 });
  runUntil(world, (w) => w.mission.done !== null, SLICE.steps);
  assert.equal(missionProgress(world, SLICE).done, true);
});

test("every mission's words are in the English missions catalogue, and nothing else is", () => {
  const keys = MISSIONS.flatMap(missionKeys);
  assert.deepEqual(
    keys.filter((key) => !(key in ENGLISH.missions)),
    [],
  );
  assert.deepEqual(
    Object.keys(ENGLISH.missions).filter((key) => !keys.includes(key)),
    [],
  );
});

test("the slice's reference programs compile for what runs them, and point at things there are", () => {
  for (const mission of [SLICE]) {
    const world = createWorld(mission.content);
    assert.ok(world.entities.some((e) => e.id === mission.look) || world.nodes.some((n) => n.id === mission.look), `${mission.id} looks at ${mission.look}`);
    const library = createLibrary(mission.content.programs);
    for (const [id, source] of Object.entries(mission.reference)) {
      setDraft(library, id, source);
      const { errors } = applyDraft(library, id, { types: types(world, id), places: [...world.entities, ...world.nodes].map((t) => t.id) });
      assert.equal(errors, undefined, `${mission.id}: ${id}`);
    }
  }
});
