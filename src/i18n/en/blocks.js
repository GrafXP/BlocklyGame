// The game's blocks in English, for Blockly.Msg (PLAN.md §8, Languages). Block
// definitions refer to these as %{BKY_KEY} (src/blockly/blocks.js), so a block is
// defined once for every language.
//
// %1, %2… are the block's inputs and fields, in the order its definition lists
// them. A language may put them in another order, but keeps every one. Blockly
// draws a block's words once, so they can't change with a number typed into it:
// choose words that read well with any number. Keep them short; Blockly never
// wraps a block's words.
export default {
  // Toolbox categories.
  CAT_START: "Start",
  CAT_ROBOT: "Robot",
  CAT_BUILDING: "Buildings",
  CAT_CONTROL: "Control",
  CAT_SENSING: "Sensing",
  CAT_VALUES: "Values",

  // In every block, %1 is the block's picture.
  ISLAND_WHEN_STARTED: "%1 when started",
  ISLAND_WHEN_STARTED_TOOLTIP: "The program starts here.",
  // %2: a place, from PLACE_*.
  ROBOT_GO_TO: "%1 go to %2",
  ROBOT_GO_TO_TOOLTIP: "Walk to a place on the island.",
  // %2: wood or stone, from ITEM_*.
  ROBOT_COLLECT: "%1 collect %2",
  ROBOT_COLLECT_TOOLTIP: "Put one item from here into the basket.",
  // %2: what to take, from ITEM_*.
  ROBOT_PICK_UP: "%1 pick up %2",
  ROBOT_PICK_UP_TOOLTIP: "Take one item from the building here into the basket.",
  ROBOT_UNLOAD: "%1 unload basket",
  ROBOT_UNLOAD_TOOLTIP: "Put everything in the basket into the building here.",
  // %2: planks or kits, from ITEM_*.
  BUILDING_MAKE: "%1 make %2",
  BUILDING_MAKE_TOOLTIP: "Make one item from the materials in store.",
  // %2: what to build, from BLUEPRINT_*.
  BUILDING_BUILD: "%1 build %2",
  BUILDING_BUILD_TOOLTIP: "Build it from the materials in store.",
  // %2: the number of steps, typed by the player. A step is one press of the
  // Step button.
  CONTROL_WAIT_STEPS: "%1 wait %2 steps",
  CONTROL_WAIT_STEPS_TOOLTIP: "Do nothing for this many steps.",
  // %2: a condition: a block that is true or false, such as a comparison.
  CONTROL_WAIT_UNTIL: "%1 wait until %2",
  CONTROL_WAIT_UNTIL_TOOLTIP: "Wait here until this is true.",
  CONTROL_FOREVER: "%1 forever",
  CONTROL_FOREVER_TOOLTIP: "Do these blocks again and again.",
  // A value: how many of item %1 there are in store at place %2. No picture.
  SENSE_STOCK: "%1 at %2",
  SENSE_STOCK_TOOLTIP: "How many of an item a building has in store.",
  // A value: how many items, of any kind, are in the robot's basket. No
  // picture and no inputs.
  SENSE_BASKET: "items in basket",
  SENSE_BASKET_TOOLTIP: "How many items the robot has in its basket.",

  // Choices in the blocks' dropdowns. Places and items are shown alone, with
  // nothing around them to agree with, so give the plain word.
  PLACE_GROVE: "grove",
  PLACE_SAWMILL: "sawmill",
  PLACE_SITE: "construction site",
  PLACE_DEPOT: "depot",
  PLACE_CAMP: "camp",
  PLACE_QUARRY: "stone pit",
  ITEM_WOOD: "wood",
  ITEM_STONE: "stone",
  ITEM_PLANK: "planks",
  ITEM_KIT: "kits",
  // What a construction site can build.
  BLUEPRINT_BRIDGE: "bridge",
};
