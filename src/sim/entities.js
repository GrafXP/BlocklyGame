// What each type of thing on the island is and can do (PLAN.md §4): its kind, the
// actions it's capable of (and "basket": it has one that programs can count;
// "settings": it has settings that programs can read), and how many ticks they
// take. Capabilities are data, apart from looks, so a later chassis can do less
// without the runtime changing. All durations are whole ticks (TICKS_PER_SECOND
// in world.js).
//
// Kinds:
// - robot: walks the grid and carries a basket.
// - building: stores items and makes things; has a program, like a robot.
// - node: a resource deposit (a grove, a stone pit, a spring, berry bushes); no
//   program.
//
// A charge pack ("pack") is the energy a new robot is made with; robots need
// none to move (docs/campaign-planv2.md, chapter 8).

export const ITEMS = ["wood", "stone", "plank", "kit", "water", "food", "pack"];

// A robot's settings (PLAN.md §5): named slots its program reads with blocks
// such as “my destination”, so robots sharing one program can each do a
// different job. Each slot holds a place (the id of a building or deposit) or an
// item, or null until one is chosen. Buildings have none: no mission needs a
// building's Target Stock (PLAN.md §7).
export const SETTINGS = { source: "place", item: "item", destination: "place" };

export const TYPES = {
  helper: {
    kind: "robot",
    can: ["goTo", "pickUp", "unload", "supply", "wait", "send", "basket", "settings"],
    basket: 2, // items, of any kinds
    perCell: 3, // ticks to walk from a cell to its neighbour
    pickUpTicks: { node: 5, building: 3 }, // to take an item from a deposit, from a building's store
    unloadTicks: 3,
  },
  // The camp makes new robots (recipes.js, helper).
  camp: { kind: "building", can: ["make", "wait", "send"], recipes: ["helper"] },
  depot: { kind: "building", can: ["wait", "send"] },
  sawmill: { kind: "building", can: ["make", "wait", "send"], recipes: ["plank"] },
  // A construction site builds the one thing its blueprint says: a bridge over
  // its gap, or the building it stands for (recipes.js, placement.js).
  site: { kind: "building", can: ["make", "wait", "send"], recipes: ["bridge", "workshop"] },
  workshop: { kind: "building", can: ["make", "wait", "send"], recipes: ["kit"] },
  // The well draws water, from nothing, over time; the farm grows food from
  // water; the fuel station makes charge packs from food and water.
  well: { kind: "building", can: ["make", "wait", "send"], recipes: ["water"] },
  farm: { kind: "building", can: ["make", "wait", "send"], recipes: ["food"] },
  station: { kind: "building", can: ["make", "wait", "send"], recipes: ["pack"] },
  grove: { kind: "node", yields: "wood" },
  quarry: { kind: "node", yields: "stone" },
  spring: { kind: "node", yields: "water" },
  berries: { kind: "node", yields: "food" },
};

export const typeOf = (thing) => TYPES[thing.type];
export const can = (thing, action) => typeOf(thing).can?.includes(action) ?? false;
