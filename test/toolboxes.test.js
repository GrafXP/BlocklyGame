import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS } from "../src/blockly/blocks.js";
import { choicesFor } from "../src/blockly/choices.js";
import { toolboxFor } from "../src/blockly/toolboxes.js";
import { ISLAND } from "../src/content/island.js";
import { createWorld } from "../src/sim/world.js";
import { tinyWorld } from "./helpers.js";

// The editor's toolboxes and dropdowns (PLAN.md §7): only the blocks the robot
// or building can use, and in their dropdowns only what's on the island and
// what the building can make.

const blocksIn = (toolbox) => toolbox.contents.flatMap((c) => c.contents.map((b) => b.type));
const categories = (toolbox) => toolbox.contents.map((c) => c.name);
const blockIn = (toolbox, type) => toolbox.contents.flatMap((c) => c.contents).find((b) => b.type === type);

test("a robot's toolbox has a robot's actions and senses, and none of a building's", () => {
  const robot = toolboxFor(["helper"]);
  assert.deepEqual(categories(robot), ["%{BKY_CAT_START}", "%{BKY_CAT_ROBOT}", "%{BKY_CAT_CONTROL}", "%{BKY_CAT_SENSING}", "%{BKY_CAT_VALUES}"]);
  const types = blocksIn(robot);
  for (const type of ["robot_go_to", "robot_collect", "robot_pick_up", "robot_unload", "control_wait_steps", "control_wait_until", "sense_basket", "sense_stock"]) assert.ok(types.includes(type), type);
  for (const type of ["building_make", "building_build"]) assert.ok(!types.includes(type), type);
});

test("a building's toolbox has Make only with a recipe that makes an item, and Build only with one that builds", () => {
  const sawmill = toolboxFor(["sawmill"]);
  assert.ok(!categories(sawmill).includes("%{BKY_CAT_ROBOT}"));
  assert.ok(blocksIn(sawmill).includes("building_make"));
  assert.ok(!blocksIn(sawmill).includes("building_build"));
  assert.ok(!blocksIn(sawmill).includes("sense_basket"), "a building has no basket");
  assert.deepEqual(blockIn(sawmill, "building_make").fields, { ITEM: "plank" });
  const site = toolboxFor(["site"]);
  assert.ok(blocksIn(site).includes("building_build"));
  assert.ok(!blocksIn(site).includes("building_make"));
  assert.deepEqual(blockIn(site, "building_build").fields, { BLUEPRINT: "bridge" });
  const camp = toolboxFor(["camp"]);
  assert.ok(!categories(camp).includes("%{BKY_CAT_BUILDING}"), "a category with nothing in it is left out");
  assert.ok(blocksIn(camp).includes("control_wait_steps"));
});

test("a program run by several types offers only what every one of them can use", () => {
  const both = blocksIn(toolboxFor(["helper", "sawmill"]));
  assert.ok(both.includes("control_wait_steps"));
  assert.ok(!both.includes("robot_go_to"));
  assert.ok(!both.includes("building_make"));
});

test("every block a toolbox offers is defined, by the game or by Blockly", () => {
  for (const type of ["helper", "camp", "depot", "sawmill", "site"]) {
    for (const block of blocksIn(toolboxFor([type]))) {
      assert.ok(BLOCKS.some((b) => b.type === block) || ["controls_repeat_ext", "controls_if", "math_number", "logic_compare"].includes(block), block);
    }
  }
});

test("places are the island's buildings and deposits, in the game's own order, labelled as the blocks say them", () => {
  const world = createWorld(ISLAND);
  assert.deepEqual(choicesFor("places", { world, type: "helper" }), [
    ["%{BKY_PLACE_GROVE}", "grove"],
    ["%{BKY_PLACE_SAWMILL}", "sawmill"],
    ["%{BKY_PLACE_SITE}", "site"],
    ["%{BKY_PLACE_DEPOT}", "depot"],
    ["%{BKY_PLACE_CAMP}", "camp"],
    ["%{BKY_PLACE_QUARRY}", "quarry"],
  ]);
  // A place the game has no block word for goes by its own name.
  const small = tinyWorld({ nodes: [{ id: "pile", type: "grove", name: { key: "entity.grove" }, area: { x: 6, z: 1, w: 1, d: 1 }, access: [[5, 1]], items: { wood: 1 }, caps: { wood: 4 } }] });
  assert.deepEqual(choicesFor("places", { world: small, type: "helper" }), [[{ key: "entity.grove" }, "pile"]]);
});

test("what a building can make or build is what it has recipes for", () => {
  const world = createWorld(ISLAND);
  assert.deepEqual(choicesFor("makes", { world, type: "sawmill" }), [["%{BKY_ITEM_PLANK}", "plank"]]);
  assert.deepEqual(choicesFor("builds", { world, type: "sawmill" }), []);
  assert.deepEqual(choicesFor("builds", { world, type: "site" }), [["%{BKY_BLUEPRINT_BRIDGE}", "bridge"]]);
  assert.deepEqual(choicesFor("makes", { world, type: null }), [["%{BKY_ITEM_PLANK}", "plank"]], "for no one type: whatever any recipe makes");
  assert.deepEqual(choicesFor("nothing", { world, type: null }), []);
});
