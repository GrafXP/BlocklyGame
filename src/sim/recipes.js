// What buildings make (PLAN.md §4). A recipe takes `inputs` from the building's
// own store and puts `outputs` into it after `ticks`. Both are reserved when the
// work starts and settled together when it ends. A recipe that `builds` changes
// the island instead, and only a construction site whose blueprint it is can
// make it: the bridge makes its site's gap walkable, and a building's recipe
// turns its site into the building (placement.js).
export const RECIPES = {
  plank: { inputs: { wood: 1 }, outputs: { plank: 1 }, ticks: 20 },
  kit: { inputs: { plank: 2, stone: 1 }, outputs: { kit: 1 }, ticks: 30 },
  bridge: { inputs: { plank: 4 }, outputs: {}, ticks: 40, builds: "bridge" },
  workshop: { inputs: { plank: 4, stone: 2 }, outputs: {}, ticks: 60, builds: "workshop" },
};
