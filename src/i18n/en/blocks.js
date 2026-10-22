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
  // %2: what to take, from ITEM_*: wood or stone from a grove or stone pit,
  // anything from a building's store.
  ROBOT_PICK_UP: "%1 pick up %2",
  ROBOT_PICK_UP_TOOLTIP: "Take one item from here into the basket: from a grove, a stone pit or a building.",
  ROBOT_UNLOAD: "%1 unload basket",
  ROBOT_UNLOAD_TOOLTIP: "Put everything in the basket into the building here.",
  // %2: a building, from PLACE_*. Supply brings what the building's order
  // still needs, once, from the places in the “from” blocks inside it.
  ROBOT_SUPPLY: "%1 supply %2",
  ROBOT_SUPPLY_TOOLTIP: "Bring what this building's order still needs, one load, from a place inside. Then look again.",
  // %1: a place, from PLACE_*, where Supply may take things from. No picture.
  SUPPLY_FROM: "from %1",
  SUPPLY_FROM_TOOLTIP: "A place where Supply may take things from.",
  // %2: planks or kits, from ITEM_*.
  BUILDING_MAKE: "%1 make %2",
  BUILDING_MAKE_TOOLTIP: "Make one item from the materials in store.",
  // %2: what to build, from BLUEPRINT_*.
  BUILDING_BUILD: "%1 build %2",
  BUILDING_BUILD_TOOLTIP: "Build it from the materials in store.",
  // %2: a team, from TEAM_*, or the island's own. A helper is a new robot.
  BUILDING_ASSEMBLE: "%1 make a helper for %2",
  BUILDING_ASSEMBLE_TOOLTIP: "Make a new robot from 2 planks and 1 charge pack. Its team gives it its job.",
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
  // A condition: whether building %1's order still needs an item, which is on
  // a second row of its own. No picture.
  SENSE_NEEDS: "%1 needs",
  SENSE_NEEDS_TOOLTIP: "True while this building's order still needs some of this, counting what's on its way.",
  // A value: how many more of item %1 a building has room for. No picture. Its
  // second row: %1, the building.
  SENSE_SPACE: "space for %1",
  SENSE_SPACE_AT: "at %1",
  SENSE_SPACE_TOOLTIP: "How many more of this the building has room for.",
  // A condition, a building's own: whether it could make item %1 now. No
  // picture.
  SENSE_READY: "ready to make %1",
  SENSE_READY_TOOLTIP: "True when every ingredient is here and the whole batch will fit. It doesn't start the work.",

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
  PLACE_SPRING: "spring",
  PLACE_BERRIES: "berry bushes",
  PLACE_WELL: "well",
  PLACE_FARM: "farm",
  PLACE_STATION: "fuel station",
  PLACE_STONECUTTER: "stonecutter",
  PLACE_KILN: "kiln",
  PLACE_SMELTER: "smelter",
  PLACE_MINE: "iron mine",
  ITEM_WOOD: "wood",
  ITEM_STONE: "stone",
  ITEM_WATER: "water",
  ITEM_FOOD: "food",
  ITEM_IRONORE: "iron ore",
  ITEM_PLANK: "planks",
  ITEM_KIT: "kits",
  ITEM_PACK: "charge packs",
  // A stone block is cut from stone, and isn't stone.
  ITEM_BLOCK: "stone blocks",
  ITEM_CHARCOAL: "charcoal",
  ITEM_IRON: "iron bars",
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
  // The teams a new robot can be made for, where there's no island to name them.
  TEAM_WOOD: "Wood team",
  TEAM_PLANK: "Plank team",
  TEAM_STONE: "Stone team",
  // What a construction site can build.
  BLUEPRINT_BRIDGE: "bridge",
  BLUEPRINT_WORKSHOP: "workshop",
  BLUEPRINT_SMELTER: "smelter",
};
