// What each type of thing on the island is and can do (PLAN.md §4): its kind, the
// actions it's capable of (and "basket": it has one that programs can count),
// and how many ticks they take. Capabilities are data,
// apart from looks, so a later chassis can do less without the runtime changing.
// All durations are whole ticks (TICKS_PER_SECOND in world.js).
//
// Kinds:
// - robot: walks the grid and carries a basket.
// - building: stores items and makes things; has a program, like a robot.
// - node: a resource deposit (a grove, a stone pit); no program.

export const ITEMS = ["wood", "stone", "plank", "kit"];

export const TYPES = {
  helper: {
    kind: "robot",
    can: ["goTo", "collect", "pickUp", "unload", "wait", "basket"],
    basket: 2, // items, of any kinds
    perCell: 3, // ticks to walk from a cell to its neighbour
    collectTicks: 5,
    pickUpTicks: 3,
    unloadTicks: 3,
  },
  camp: { kind: "building", can: ["wait"] },
  depot: { kind: "building", can: ["wait"] },
  sawmill: { kind: "building", can: ["make", "wait"], recipes: ["plank"] },
  site: { kind: "building", can: ["make", "wait"], recipes: ["bridge"] },
  grove: { kind: "node", yields: "wood" },
  quarry: { kind: "node", yields: "stone" },
};

export const typeOf = (thing) => TYPES[thing.type];
export const can = (thing, action) => typeOf(thing).can?.includes(action) ?? false;
