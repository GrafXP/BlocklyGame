import { test } from "node:test";
import assert from "node:assert/strict";
import { ENGLISH } from "../src/i18n/index.js";
import { CODES } from "../src/sim/codes.js";
import { ITEMS, TYPES } from "../src/sim/entities.js";
import { RECIPES } from "../src/sim/recipes.js";
import { createWorld } from "../src/sim/world.js";
import { ISLAND } from "../src/content/island.js";
import { amounts, describeAction, describeReason } from "../src/ui/describe.js";

// Everything the simulation can report has words (PLAN.md §12): every code, item,
// action, state and thing built. The language tests (i18n.test.js) then check
// every other language has the same messages, with the same placeholders.

const world = createWorld(ISLAND);
const SAMPLE = { item: "plank", at: "sawmill", target: "quarry", need: 2, have: 1, free: 0, action: "collect", type: "fly" };

test("every code the simulation reports has a message, and its words fill every placeholder", () => {
  for (const [code, values] of Object.entries(CODES)) {
    assert.ok(code in ENGLISH.ui, `no message for ${code}`);
    const text = describeReason(world, { code, ...Object.fromEntries(values.map((v) => [v, SAMPLE[v]])) });
    assert.doesNotMatch(text, /[{}]/, code);
    assert.notEqual(text, code);
  }
  assert.equal(describeReason(world, { code: "wait.item", item: "plank", at: "sawmill", need: 2, have: 1 }), "Needs 2 planks · Sawmill has 1");
  assert.equal(describeReason(world, { code: "wait.space", item: "wood", at: "r1", need: 1, free: 0 }), "No room for 1 wood · Robo 1 has room for 0");
  assert.equal(describeReason(world, { code: "wait.route", target: "quarry" }), "No way to Stone pit");
  assert.equal(describeReason(world, { code: "error.cannot", action: "goTo" }), "Can't do this: Go to");
  assert.equal(describeReason(world, { code: "error.target", target: "moon" }), "No such place: moon");
});

test("every item, action, state and thing built has words", () => {
  for (const item of ITEMS) assert.ok(`count.${item}` in ENGLISH.ui, item);
  const actions = new Set(Object.values(TYPES).flatMap((t) => t.can ?? []));
  for (const action of actions) assert.ok(`action.name.${action}` in ENGLISH.ui, action);
  for (const state of ["ready", "moving", "working", "waiting", "stopped", "error"]) assert.ok(`state.${state}` in ENGLISH.ui, state);
  for (const recipe of Object.values(RECIPES)) if (recipe.builds) assert.ok(`action.build.${recipe.builds}` in ENGLISH.ui, recipe.builds);
});

test("what a robot or building is doing, in words", () => {
  const doing = (action) => describeAction({ ...world, tick: 10 }, { action });
  assert.equal(doing({ type: "move", target: "site" }), "On the way to Construction site");
  assert.equal(doing({ type: "collect", item: "wood" }), "Collecting 1 wood");
  assert.equal(doing({ type: "pickUp", item: "plank" }), "Picking up 1 plank");
  assert.equal(doing({ type: "unload", holds: [{ at: "r1", dir: "out", item: "wood", n: 2 }, { at: "sawmill", dir: "in", item: "wood", n: 2 }] }), "Unloading 2 wood");
  assert.equal(doing({ type: "make", recipe: "plank" }), "Making 1 plank");
  assert.equal(doing({ type: "make", recipe: "bridge" }), "Building the bridge");
  assert.equal(doing({ type: "wait", start: 5, end: 11 }), "Waiting 1 more step");
  assert.equal(describeAction(world, { action: null }), "");
});

test("counts of items read as a list, and an empty store as nothing", () => {
  assert.equal(amounts({ plank: 3, wood: 1 }), "1 wood, 3 planks");
  assert.equal(amounts({}), "nothing");
});
