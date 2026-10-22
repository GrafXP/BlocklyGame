import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS } from "../src/blockly/blocks.js";
import { choicesFor } from "../src/blockly/choices.js";
import { toolboxFor } from "../src/blockly/toolboxes.js";
import { ISLAND } from "../src/content/island.js";
import { createWorld } from "../src/sim/world.js";
import { missionStart } from "../src/campaign.js";
import { campaignMission } from "../src/content/missions/campaign.js";
import { tinyWorld } from "./helpers.js";

// The editor's toolboxes and dropdowns (PLAN.md §7): only the blocks the robot
// or building can use, and in their dropdowns only what's on the island and
// what the building can make.

const blocksIn = (toolbox) => toolbox.contents.flatMap((c) => c.offers ?? c.contents.map((b) => b.type));
const categories = (toolbox) => toolbox.contents.map((c) => c.name);
const blockIn = (toolbox, type) => toolbox.contents.flatMap((c) => c.contents ?? []).find((b) => b.type === type);

test("a robot's toolbox has a robot's actions and senses, and none of a building's", () => {
  const robot = toolboxFor(["helper"]);
  assert.deepEqual(categories(robot), ["%{BKY_CAT_START}", "%{BKY_CAT_ROBOT}", "%{BKY_CAT_CONTROL}", "%{BKY_CAT_SENSING}", "%{BKY_CAT_VALUES}", "%{BKY_CAT_MEMORY}", "%{BKY_CAT_ROUTINES}", "%{BKY_CAT_MESSAGES}"]);
  const types = blocksIn(robot);
  for (const type of ["robot_go_to", "robot_pick_up", "robot_unload", "control_wait_steps", "control_wait_until", "sense_basket", "sense_stock"]) assert.ok(types.includes(type), type);
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
  assert.deepEqual(toolboxFor(["camp"]).contents.find((c) => c.name === "%{BKY_CAT_BUILDING}").contents.map((b) => b.type), ["building_assemble"], "the camp makes robots, and no item");
  const depot = toolboxFor(["depot"]);
  assert.ok(!categories(depot).includes("%{BKY_CAT_BUILDING}"), "a category with nothing in it is left out");
  assert.ok(blocksIn(camp).includes("control_wait_steps") && blocksIn(depot).includes("control_wait_steps"));
});

test("Ready to Make is for a building that makes items, at the first it makes; not for a robot, the camp or a depot", () => {
  const smelter = toolboxFor(["smelter"]);
  assert.deepEqual(blockIn(smelter, "sense_ready").fields, { ITEM: "iron" });
  assert.deepEqual(blockIn(smelter, "building_make").fields, { ITEM: "iron" });
  for (const type of ["helper", "camp", "depot", "site"]) assert.ok(!blocksIn(toolboxFor([type])).includes("sense_ready"), type);
});

test("on an island, a toolbox's dropdowns start at what's there: Supply at a building, an item that's found or made, the camp's team", () => {
  const { world } = missionStart(campaignMission("c2-m041"));
  const robot = toolboxFor(["helper"], { world });
  const supply = blockIn(robot, "robot_supply");
  assert.equal(supply.fields.PLACE, "camp", "the first building, not the grove");
  assert.equal(supply.inputs.FROM.block.fields.PLACE, "grove", "it may look anywhere");
  assert.deepEqual(blockIn(robot, "robot_pick_up").inputs.ITEM.shadow.fields, { ITEM: "wood" });
  assert.deepEqual(
    choicesFor("items", { world }).map(([, item]) => item),
    ["wood", "water", "food", "pack"],
    "the grove's wood, the station's water, and what the farm and the station make",
  );
  const camp = toolboxFor(["camp"], { world: missionStart(campaignMission("c2-m038")).world });
  assert.deepEqual(blockIn(camp, "building_assemble").fields, { TEAM: "wood-team" });
});

test("Memory and My blocks are filled as they're opened, offering what the play allows; messages are for everyone", () => {
  const all = toolboxFor(["sawmill"]);
  const memory = all.contents.find((c) => c.custom === "GAME_MEMORY");
  assert.deepEqual(memory, { kind: "category", name: "%{BKY_CAT_MEMORY}", categorystyle: "memory_category", custom: "GAME_MEMORY", offers: ["variables_set", "math_change", "variables_get"] });
  assert.ok(blocksIn(all).includes("message_send") && blocksIn(all).includes("message_wait"), "a building sends and waits too");
  const some = toolboxFor(["helper"], { blocks: ["robot_go_to", "variables_get", "procedures_callnoreturn"] });
  assert.deepEqual(some.contents.filter((c) => c.custom).map((c) => [c.custom, c.offers]), [["GAME_MEMORY", ["variables_get"]], ["GAME_ROUTINES", ["procedures_callnoreturn"]]]);
  assert.ok(!categories(toolboxFor(["helper"], { blocks: ["robot_go_to"] })).includes("%{BKY_CAT_MEMORY}"), "nothing unlocked, no category");
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
      const builtIn = ["controls_repeat_ext", "controls_if", "math_number", "logic_compare", "variables_set", "math_change", "variables_get", "procedures_defnoreturn", "procedures_callnoreturn"];
      assert.ok(BLOCKS.some((b) => b.type === block) || builtIn.includes(block), block);
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
  assert.deepEqual(choicesFor("builds", { world, type: "site" }), [
    ["%{BKY_BLUEPRINT_BRIDGE}", "bridge"],
    ["%{BKY_BLUEPRINT_WORKSHOP}", "workshop"],
    ["%{BKY_BLUEPRINT_SMELTER}", "smelter"],
  ]);
  assert.deepEqual(choicesFor("builds", { world, type: "site", builds: ["bridge"] }), [["%{BKY_BLUEPRINT_BRIDGE}", "bridge"]], "a site builds what its blueprint says");
  assert.deepEqual(choicesFor("makes", { world, type: "smelter" }), [["%{BKY_ITEM_IRON}", "iron"]]);
  assert.deepEqual(choicesFor("makes", { world, type: "workshop" }), [["%{BKY_ITEM_KIT}", "kit"]]);
  assert.deepEqual(
    choicesFor("makes", { world, type: null }),
    [
      ["%{BKY_ITEM_WATER}", "water"],
      ["%{BKY_ITEM_FOOD}", "food"],
      ["%{BKY_ITEM_PLANK}", "plank"],
      ["%{BKY_ITEM_KIT}", "kit"],
      ["%{BKY_ITEM_PACK}", "pack"],
      ["%{BKY_ITEM_BLOCK}", "block"],
      ["%{BKY_ITEM_CHARCOAL}", "charcoal"],
      ["%{BKY_ITEM_IRON}", "iron"],
    ],
    "for no one type: whatever any recipe makes",
  );
  assert.deepEqual(choicesFor("nothing", { world, type: null }), []);
});
