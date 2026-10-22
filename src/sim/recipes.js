// What buildings make (PLAN.md §4). A recipe takes `inputs` from the building's
// own store and puts `outputs` into it after `ticks`. Both are reserved when the
// work starts and settled together when it ends. A recipe that `builds` changes
// the island instead, and only a construction site whose blueprint it is can
// make it: the bridge makes its site's gap walkable, and a building's recipe
// turns its site into the building (placement.js). A recipe that `assembles`
// makes a robot: the building pays for it, and when the work is done a new
// helper stands at its front, on the team the program chose (actions.js). A
// recipe that makes an item has that item's id; the quantities follow the
// skirmish plan's prototype recipes (SKIRMISH_PLAN.md §3).
export const RECIPES = {
  plank: { inputs: { wood: 1 }, outputs: { plank: 1 }, ticks: 20 },
  kit: { inputs: { plank: 2, stone: 1 }, outputs: { kit: 1 }, ticks: 30 },
  water: { inputs: {}, outputs: { water: 1 }, ticks: 20 },
  food: { inputs: { water: 1 }, outputs: { food: 2 }, ticks: 60 },
  pack: { inputs: { food: 2, water: 1 }, outputs: { pack: 2 }, ticks: 40 },
  block: { inputs: { stone: 2 }, outputs: { block: 1 }, ticks: 30 },
  charcoal: { inputs: { wood: 2 }, outputs: { charcoal: 2 }, ticks: 40 },
  iron: { inputs: { ironOre: 2, charcoal: 1, water: 1 }, outputs: { iron: 2 }, ticks: 60 },
  helper: { inputs: { plank: 2, pack: 1 }, outputs: {}, ticks: 60, assembles: "helper" },
  bridge: { inputs: { plank: 4 }, outputs: {}, ticks: 40, builds: "bridge" },
  workshop: { inputs: { plank: 4, stone: 2 }, outputs: {}, ticks: 60, builds: "workshop" },
  // The smelter is built as the workshop is, with stone blocks where the
  // workshop takes raw stone (docs/campaign-planv2.md, “Recipe and budget
  // ledger”: smelters are built of planks and stone blocks).
  smelter: { inputs: { plank: 4, block: 2 }, outputs: {}, ticks: 60, builds: "smelter" },
};
