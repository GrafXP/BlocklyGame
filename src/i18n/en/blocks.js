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
  // A robot's memory: variables, which remember a number (Set, Change, Get).
  CAT_MEMORY: "Memory",
  // Blocks the player makes: a named job made of other blocks.
  CAT_ROUTINES: "My blocks",
  CAT_MESSAGES: "Messages",
  // In Memory or My blocks, when the program has nothing there to use yet.
  MEMORY_NONE: "No variables yet",
  ROUTINES_NONE: "No blocks of your own yet",

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
  // %2: a message, from MESSAGE_*. Its second row: %1, who it's for, a robot
  // or building.
  MESSAGE_SEND: "%1 send %2",
  MESSAGE_SEND_TO: "to %1",
  MESSAGE_SEND_TOOLTIP: "Send a message to a robot or building. It arrives in its inbox at the next step.",
  // %2: a message, from MESSAGE_*.
  MESSAGE_WAIT: "%1 wait for %2",
  MESSAGE_WAIT_TOOLTIP: "Wait here until this message is in the inbox, then take it out.",
  // A value: how many of item %1 there are in store at place %2. No picture.
  SENSE_STOCK: "%1 at %2",
  SENSE_STOCK_TOOLTIP: "How many of an item a building has in store.",
  // A value: how many items, of any kind, are in the robot's basket. No
  // picture and no inputs.
  SENSE_BASKET: "items in basket",
  SENSE_BASKET_TOOLTIP: "How many items the robot has in its basket.",

  // A place or an item in an action's gap, chosen from a dropdown. No words of
  // their own besides the dropdown's.
  VALUE_PLACE_TOOLTIP: "A place on the island.",
  VALUE_ITEM_TOOLTIP: "What to take.",
  // A robot's own settings, as values to put in an action's gap: “go to my
  // destination”. No picture and no inputs. Each robot chooses them in its
  // settings, so robots sharing a program can do different jobs.
  SETTING_SOURCE: "my source",
  SETTING_SOURCE_TOOLTIP: "This robot's own source: where it fetches from. Choose it in its settings.",
  SETTING_ITEM: "my item",
  SETTING_ITEM_TOOLTIP: "This robot's own item: what it fetches. Choose it in its settings.",
  SETTING_DESTINATION: "my destination",
  SETTING_DESTINATION_TOOLTIP: "This robot's own destination: where it takes things. Choose it in its settings.",

  // Choices in the blocks' dropdowns. Places and items are shown alone, with
  // nothing around them to agree with, so give the plain word.
  PLACE_GROVE: "grove",
  PLACE_SAWMILL: "sawmill",
  PLACE_SITE: "construction site",
  PLACE_DEPOT: "depot",
  PLACE_CAMP: "camp",
  PLACE_QUARRY: "stone pit",
  PLACE_WORKSHOP: "workshop",
  ITEM_WOOD: "wood",
  ITEM_STONE: "stone",
  ITEM_PLANK: "planks",
  ITEM_KIT: "kits",
  // Messages, shown in quotes on their own in a dropdown: “plank ready”.
  MESSAGE_PLANKREADY: "“plank ready”",
  MESSAGE_KITREADY: "“kit ready”",
  MESSAGE_WOODPLEASE: "“wood please”",
  MESSAGE_PLANKPLEASE: "“plank please”",
  MESSAGE_STONEPLEASE: "“stone please”",
  MESSAGE_STONEDELIVERED: "“stone delivered”",
  MESSAGE_GO: "“go”",
  // The robots a message can go to, where there's no island to name them.
  ROBO_1: "Robo 1",
  ROBO_2: "Robo 2",
  ROBO_3: "Robo 3",
  // What a construction site can build.
  BLUEPRINT_BRIDGE: "bridge",
  BLUEPRINT_WORKSHOP: "workshop",
};
