// What buildings make (PLAN.md §4). A recipe takes `inputs` from the building's
// own store and puts `outputs` into it after `ticks`. Both are reserved when the
// work starts and settled together when it ends. A recipe that `builds` changes
// the island instead: the bridge makes its site's gap walkable.
export const RECIPES = {
  plank: { inputs: { wood: 1 }, outputs: { plank: 1 }, ticks: 20 },
  bridge: { inputs: { plank: 4 }, outputs: {}, ticks: 40, builds: "bridge" },
};
