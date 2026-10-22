import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../src/programming/expressions.js";
import { AREA, RANGE, REBOOT_TICKS, REPAIR_TICKS, SEGMENT, WATCH_TICKS } from "../src/sim/combat.js";
import { applyCommand } from "../src/sim/commands.js";
import { stateHash } from "../src/sim/replay.js";
import { checkWorld } from "../src/sim/validate.js";
import { createWorld, reasonOf } from "../src/sim/world.js";
import { byId, run, runUntil } from "./helpers.js";
import { forever, go, guard, low, program, repair, unload, when } from "./programs.js";

// Guards, shields and pulses (SKIRMISH_PLAN.md §4, §7; docs/campaign-planv2.md,
// chapters 13–14): Advance and Guard are short actions, a few cells, one pulse
// or one watch; pulses that end in a tick land together; a robot with no shield
// left reboots at its home, keeping what it carries and its job; repair is
// free; the workshop makes guards; and the opponent's robots aren't the
// player's to program.

// A field 16 by 5, x 1–14 and z 1–3 walkable: the camp at its west, a post in
// the middle, the visitors' landing at its east.
const FIELD = ["~~~~~~~~~~~~~~~~", "~..............~", "~..............~", "~..............~", "~~~~~~~~~~~~~~~~"];
const camp = (extra = {}) => ({ id: "camp", type: "camp", name: "camp", area: { x: 1, z: 1, w: 1, d: 1 }, access: [[2, 1]], caps: { plank: 4, pack: 2 }, ...extra });
const post = { id: "post", type: "crossing", name: "post", area: { x: 8, z: 1, w: 1, d: 1 }, access: [[8, 2]], caps: {} };
const landing = { id: "landing", type: "landing", name: "landing", area: { x: 14, z: 3, w: 1, d: 1 }, access: [[14, 2]], caps: {} };
const scripted = (steps) => ({ script: { steps, loop: false } });
const guardAt = (id, cell, extra = {}) => ({ id, type: "guard", name: id, cell, ...extra });
const visitor = (id, cell, steps = [], extra = {}) => ({ id, type: "visitor", name: id, side: "opponent", cell, ...scripted(steps), ...extra });

const world = ({ entities, nodes = [post, landing], programs = {}, roles = [], limit }) =>
  createWorld({ id: "test", version: 1, terrain: FIELD, entities, nodes, roles, limit, programs: Object.entries(programs).map(([id, source]) => ({ id, source })) });

const cellOf = (w, [x, z]) => z * w.terrain.width + x;

test("Advance walks a few cells toward its place, then lets the next step run; there, it watches", () => {
  const w = world({ entities: [camp(), guardAt("g1", [2, 2], scripted([{ type: "advance", target: "post" }, { type: "advance", target: "post" }]))] });
  run(w, 1);
  const a = byId(w, "g1").action;
  assert.deepEqual([a.type, a.target, a.path.length - 1, a.cells], ["move", "post", SEGMENT, SEGMENT], "a few cells of the way");
  runUntil(w, (it) => byId(it, "g1").runtime.at === 2);
  assert.equal(byId(w, "g1").cell, cellOf(w, [2 + 2 * SEGMENT, 2]));
  const there = world({ entities: [camp(), guardAt("g1", [8, 2], scripted([{ type: "advance", target: "post" }]))] });
  run(there, 1);
  assert.deepEqual([byId(there, "g1").action.type, byId(there, "g1").action.end - byId(there, "g1").action.start], ["watch", WATCH_TICKS]);
});

test("Advance sends a pulse at the nearest opponent in range instead, then goes on its way once it's clear", () => {
  const w = world({ entities: [camp(), guardAt("g1", [4, 2], scripted([{ type: "advance", target: "post" }])), visitor("v1", [6, 3], [], { shield: 1 }), visitor("v2", [5, 2])] });
  run(w, 1);
  assert.deepEqual([byId(w, "g1").action.type, byId(w, "g1").action.at], ["fire", "v2"], "the nearer of the two");
  const far = world({ entities: [camp(), guardAt("g1", [2, 2], scripted([{ type: "advance", target: "post" }])), visitor("v1", [2 + RANGE + 1, 2])] });
  run(far, 1);
  assert.equal(byId(far, "g1").action.type, "move", "out of range, it walks");
});

test("Guard sends pulses only at opponents near its place: one far from it is let be, even in range", () => {
  const near = world({ entities: [camp(), guardAt("g1", [8, 2], scripted([{ type: "guard", target: "post" }])), visitor("v1", [10, 2])] });
  run(near, 1);
  assert.deepEqual([byId(near, "g1").action.type, byId(near, "g1").action.at], ["fire", "v1"]);
  // The guard on its way, the visitor in its range but more than AREA from the post.
  const away = world({ entities: [camp(), guardAt("g1", [3, 2], scripted([{ type: "guard", target: "post" }])), visitor("v1", [3, 3])] });
  assert.ok((8 - 3) ** 2 + 1 > AREA * AREA);
  run(away, 1);
  assert.equal(byId(away, "g1").action.type, "move", "it doesn't chase");
});

test("a pulse lands as it ends if its robot is still in range; one that has walked away is missed", () => {
  const w = world({ entities: [camp(), guardAt("g1", [8, 2], scripted([{ type: "guard", target: "post" }])), visitor("v1", [10, 2], [{ type: "wait", steps: 2 }, { type: "home" }])] });
  const traces = run(w, 12);
  assert.deepEqual(traces.flatMap((t) => t.hits), [], "it walked out of range first");
  assert.equal(byId(w, "v1").shield, 3);
  const stays = world({ entities: [camp(), guardAt("g1", [8, 2], scripted([{ type: "guard", target: "post" }])), visitor("v1", [10, 2])] });
  const hits = run(stays, 13).flatMap((t) => t.hits);
  assert.deepEqual(hits, [{ by: "g1", at: "v1" }]);
  assert.equal(byId(stays, "v1").shield, 2);
});

test("pulses ending in one tick land together: two robots can knock each other out at once", () => {
  const w = world({ entities: [camp(), guardAt("g1", [8, 2], { shield: 1, ...scripted([{ type: "guard", target: "post" }]) }), visitor("v1", [9, 2], [{ type: "guard", target: "post" }], { shield: 1 })] });
  const [first] = run(w, 1);
  assert.deepEqual(first.started.map((s) => s.type), ["fire", "fire"]);
  const traces = run(w, 12);
  const struck = traces.find((t) => t.hits.length);
  assert.deepEqual(struck.hits, [{ by: "g1", at: "v1" }, { by: "v1", at: "g1" }], "both land, whichever is listed first");
  assert.deepEqual(["g1", "v1"].map((id) => [byId(w, id).shield, byId(w, id).action.type]), [[0, "reboot"], [0, "reboot"]]);
});

test("a robot with no shield left is knocked out: it stops, keeps its basket, and reboots at its home; then its program starts again from its start", () => {
  const job = program(go("g", "post"), unload("u"));
  const w = world({
    entities: [camp(), { id: "r1", type: "helper", name: "r1", cell: [6, 2], shield: 1, items: { plank: 1 }, program: "job" }, visitor("v1", [9, 2], [{ type: "guard", target: "post" }])],
    programs: { job },
  });
  runUntil(w, (it) => byId(it, "r1").shield === 0);
  const r1 = byId(w, "r1");
  assert.deepEqual([r1.action.type, r1.cell, r1.store.items, r1.runtime.at, r1.runtime.block], ["reboot", cellOf(w, [2, 1]), { plank: 1 }, 0, null], "at the camp, with its plank, its program at its start");
  assert.equal(r1.action.end - r1.action.start, REBOOT_TICKS);
  assert.equal(reasonOf(r1), null);
  runUntil(w, (it) => !byId(it, "r1").action || byId(it, "r1").action.type !== "reboot");
  assert.equal(byId(w, "r1").shield, 2, "whole again");
  assert.equal(byId(w, "r1").runtime.block, "g", "starting with its first block");
});

test("a program given to a robot that's rebooting, or started again, doesn't cut its reboot short", () => {
  const job = program(forever("f", guard("gd", "post")));
  const w = world({ entities: [camp(), guardAt("g1", [8, 2], { shield: 1, program: "job" }), visitor("v1", [9, 2], [{ type: "guard", target: "post" }])], programs: { job, other: program(repair("r")) } });
  runUntil(w, (it) => byId(it, "g1").action?.type === "reboot");
  const end = byId(w, "g1").action.end;
  run(w, 1, { [w.tick + 1]: [{ type: "assign", entity: "g1", program: "other" }, { type: "restart", entity: "g1" }] });
  assert.deepEqual([byId(w, "g1").action.type, byId(w, "g1").action.end, byId(w, "g1").shield, byId(w, "g1").runtime.program], ["reboot", end, 0, "other"]);
});

test("a knocked-out visitor's visit is over: it stays at its landing", () => {
  const w = world({ entities: [camp(), guardAt("g1", [8, 2], scripted([{ type: "guard", target: "post" }])), visitor("v1", [9, 2], [{ type: "wait", steps: 400 }, { type: "goTo", target: "post" }], { shield: 1 })] });
  runUntil(w, (it) => byId(it, "v1").action?.type === "reboot");
  assert.equal(byId(w, "v1").cell, cellOf(w, [14, 2]));
  run(w, REBOOT_TICKS + 5);
  assert.deepEqual([byId(w, "v1").shield, byId(w, "v1").action, byId(w, "v1").cell], [3, null, cellOf(w, [14, 2])]);
});

test("Go Home and Repair walks home and makes the shield whole there, for nothing, taking longer the more is gone", () => {
  const w = world({ entities: [camp(), guardAt("g1", [8, 2], { shield: 1, program: "fix" })], programs: { fix: program(repair("r")) } });
  assert.deepEqual(w.programs[0].code.slice(0, 2), [
    { op: "act", block: "r", intent: { type: "home" } },
    { op: "act", block: "r", intent: { type: "repair" } },
  ]);
  runUntil(w, (it) => byId(it, "g1").action?.type === "repair");
  const a = byId(w, "g1").action;
  assert.deepEqual([byId(w, "g1").cell, a.end - a.start], [cellOf(w, [2, 1]), 3 * REPAIR_TICKS]);
  assert.equal(byId(w, "g1").runtime.block, "r", "the same block, all the way");
  runUntil(w, (it) => byId(it, "g1").runtime.ended);
  assert.deepEqual([byId(w, "g1").shield, byId(w, "camp").store.items], [4, {}], "whole, and the camp has nothing to pay with");
  const away = world({ entities: [camp(), guardAt("g1", [8, 2], scripted([{ type: "repair" }]))] });
  run(away, 1);
  assert.deepEqual(byId(away, "g1").error, { code: "error.notHere", action: "repair" }, "only at home");
});

test("my shield is low when half of it or more is gone; an opponent is near within DANGER; a building can't ask", () => {
  const w = world({ entities: [camp(), guardAt("g1", [2, 2], { shield: 3 }), { id: "r1", type: "helper", name: "r1", cell: [3, 2] }, visitor("v1", [9, 2])] });
  const ask = (id, op) => evaluate({ op, block: "b" }, byId(w, id), w);
  assert.equal(ask("g1", "low"), false);
  byId(w, "g1").shield = 2;
  assert.equal(ask("g1", "low"), true, "two of four");
  assert.deepEqual([ask("g1", "danger"), ask("r1", "danger")], [false, true], "seven cells away, and six");
  assert.throws(() => ask("camp", "low"), (e) => e.problem?.code === "error.cannot");
});

test("a guard that checks its shield goes home to repair when it's low, and comes back", () => {
  const job = program(forever("f", when("i", [[low("l"), [repair("r")]]], [guard("gd", "post")])));
  const w = world({ entities: [camp(), guardAt("g1", [8, 2], { program: "job" }), visitor("v1", [10, 2], Array.from({ length: 30 }, () => ({ type: "guard", target: "post" })))], programs: { job } });
  runUntil(w, (it) => it.entities.find((e) => e.id === "g1").action?.type === "repair");
  runUntil(w, (it) => byId(it, "g1").cell === cellOf(it, [8, 2]) && !byId(it, "g1").action?.type.startsWith("re"));
  assert.equal(byId(w, "g1").shield, 4, "back, repaired");
});

test("the workshop makes a guard from a kit, an iron bar and a charge pack, on the team whose job it takes; visitors don't count against the limit", () => {
  const shop = { id: "shop", type: "workshop", name: "shop", area: { x: 4, z: 3, w: 1, d: 1 }, access: [[4, 2]], caps: { kit: 2, iron: 2, pack: 2 }, items: { kit: 1, iron: 1, pack: 1 }, ...scripted([{ type: "make", recipe: "guard", role: "defenders" }]) };
  const w = world({
    entities: [camp(), shop, { id: "r1", type: "helper", name: "r1", cell: [2, 2] }, visitor("v1", [14, 2])],
    roles: [{ id: "defenders", name: "defenders", program: "job" }],
    programs: { job: program(forever("f", guard("gd", "post"))) },
    limit: 2,
  });
  run(w, 1);
  assert.deepEqual(byId(w, "shop").store.out, { kit: 1, iron: 1, pack: 1 });
  runUntil(w, (it) => byId(it, "g1"));
  const g1 = byId(w, "g1");
  assert.deepEqual([g1.type, g1.side, g1.shield, g1.role, g1.name, g1.store.total], ["guard", "player", 4, "defenders", { key: "entity.guard", params: { n: 1 } }, 0]);
  assert.deepEqual(byId(w, "shop").store.items, {});
  run(w, 2);
  assert.equal(byId(w, "g1").runtime.program, "job");
});

test("the opponent's robots aren't the player's: no program, name, team or start for them, and no type's program", () => {
  const w = world({ entities: [camp(), visitor("v1", [12, 2])], programs: { job: program(forever("f", guard("gd", "post"))) } });
  for (const command of [
    { type: "assign", entity: "v1", program: "job" },
    { type: "name", entity: "v1", name: "Bob" },
    { type: "restart", entity: "v1" },
    { type: "start", entity: "v1" },
  ]) {
    assert.equal(applyCommand(w, command).ok, false, command.type);
  }
  assert.equal(applyCommand(w, { type: "default", entityType: "visitor", program: "job" }).ok, true);
  assert.equal(byId(w, "v1").runtime.kind, "script", "a type's program isn't the opponent's");
});

test("a world in the middle of a fight, rebooting and repairing, saves and loads exactly", () => {
  const job = program(forever("f", when("i", [[low("l"), [repair("r")]]], [guard("gd", "post")])));
  const w = world({ entities: [camp(), guardAt("g1", [8, 2], { program: "job" }), visitor("v1", [10, 2], Array.from({ length: 20 }, () => ({ type: "guard", target: "post" })))], programs: { job } });
  run(w, 40);
  const copy = JSON.parse(JSON.stringify(w));
  assert.deepEqual(checkWorld(copy), []);
  run(w, 150);
  run(copy, 150);
  assert.equal(stateHash(copy), stateHash(w));
});
