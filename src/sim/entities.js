// What each type of thing on the island is and can do (PLAN.md §4): its kind, the
// actions it's capable of (and "basket": it has one that programs can count;
// "settings": it has settings that programs can read), and how many ticks they
// take. Capabilities are data, apart from looks, so a later chassis can do less
// without the runtime changing. All durations are whole ticks (TICKS_PER_SECOND
// in world.js).
//
// Kinds:
// - robot: walks the grid and carries a basket; it has a shield, and a side.
// - building: stores items and makes things; has a program, like a robot.
// - node: a resource deposit (a grove, a stone pit, a spring, berry bushes, an
//   iron mine), or a marker, a place to go to that holds nothing (the flag,
//   the crossing, the visitors' landing); no program.
//
// A charge pack ("pack") is the energy a new robot is made with; robots need
// none to move (docs/campaign-planv2.md, chapter 8). A stone block ("block") is
// cut from raw stone, and isn't stone: kits and the workshop keep taking raw
// stone. Iron ore ("ironOre") is dug at the mine and smelted into iron bars
// ("iron") with charcoal and water (chapters 10–12).
//
// A robot's `shield` is how many segments it has when whole (combat.js): a
// guard protects places and has no basket; a visitor is the practice
// opponent's robot, which comes to the island and leaves again (chapters
// 13–14). `fireTicks` is how long one of its pulses takes.

export const ITEMS = ["wood", "stone", "plank", "kit", "water", "food", "pack", "block", "charcoal", "ironOre", "iron"];

// A robot's settings (PLAN.md §5): named slots its program reads with blocks
// such as “my destination”, so robots sharing one program can each do a
// different job. Each slot holds a place (the id of a building or deposit) or an
// item, or null until one is chosen. Buildings have none: no mission needs a
// building's Target Stock (PLAN.md §7).
export const SETTINGS = { source: "place", item: "item", destination: "place" };

export const TYPES = {
  helper: {
    kind: "robot",
    can: ["goTo", "pickUp", "unload", "supply", "home", "repair", "wait", "send", "basket", "settings", "shield"],
    basket: 2, // items, of any kinds
    shield: 2, // segments
    perCell: 3, // ticks to walk from a cell to its neighbour
    pickUpTicks: { node: 5, building: 3 }, // to take an item from a deposit, from a building's store
    unloadTicks: 3,
  },
  guard: { kind: "robot", can: ["advance", "guard", "home", "repair", "wait", "send", "shield"], basket: 0, shield: 4, perCell: 3, fireTicks: 12 },
  visitor: { kind: "robot", can: ["goTo", "advance", "guard", "home", "wait"], basket: 0, shield: 3, perCell: 3, fireTicks: 12 },
  // The camp makes new helpers (recipes.js, helper), and the workshop guards.
  camp: { kind: "building", can: ["make", "wait", "send"], recipes: ["helper"] },
  depot: { kind: "building", can: ["wait", "send"] },
  sawmill: { kind: "building", can: ["make", "wait", "send"], recipes: ["plank"] },
  // A construction site builds the one thing its blueprint says: a bridge over
  // its gap, or the building it stands for (recipes.js, placement.js).
  site: { kind: "building", can: ["make", "wait", "send"], recipes: ["bridge", "workshop", "smelter"] },
  workshop: { kind: "building", can: ["make", "wait", "send"], recipes: ["kit", "guard"] },
  // The well draws water, from nothing, over time; the farm grows food from
  // water; the fuel station makes charge packs from food and water.
  well: { kind: "building", can: ["make", "wait", "send"], recipes: ["water"] },
  farm: { kind: "building", can: ["make", "wait", "send"], recipes: ["food"] },
  station: { kind: "building", can: ["make", "wait", "send"], recipes: ["pack"] },
  // Industry: the stonecutter cuts raw stone into blocks, the kiln burns wood
  // into charcoal, and the smelter makes iron bars from ore, charcoal and water.
  stonecutter: { kind: "building", can: ["make", "wait", "send"], recipes: ["block"] },
  kiln: { kind: "building", can: ["make", "wait", "send"], recipes: ["charcoal"] },
  smelter: { kind: "building", can: ["make", "wait", "send"], recipes: ["iron"] },
  grove: { kind: "node", yields: "wood" },
  quarry: { kind: "node", yields: "stone" },
  spring: { kind: "node", yields: "water" },
  berries: { kind: "node", yields: "food" },
  mine: { kind: "node", yields: "ironOre" },
  // Markers: the rally flag, the crossing at the bridge's west end, and the
  // beach where visitors land and go back to.
  flag: { kind: "node" },
  crossing: { kind: "node" },
  landing: { kind: "node" },
};

// The sides robots are on: the player's, and the practice opponent's. A side's
// robots go home to, and reboot at, its home: the player's camp, the
// visitors' landing (combat.js).
export const SIDES = ["player", "opponent"];
export const HOMES = { player: "camp", opponent: "landing" };

export const typeOf = (thing) => TYPES[thing.type];
export const can = (thing, action) => typeOf(thing).can?.includes(action) ?? false;
