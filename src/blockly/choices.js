import { TYPES } from "../sim/entities.js";
import { RECIPES } from "../sim/recipes.js";
import { BLUEPRINTS, MADE, PLACES } from "./blocks.js";

// What a "field_choice" dropdown offers in the editor of a program (PLAN.md §7,
// valid-target dropdowns): only what makes sense on this island, for what will
// run the program. A choice's value is always a stable id (grove, plank); its
// label is the block message the game has for it (%{BKY_PLACE_GROVE}), so the
// dropdown reads as the block does in every language, or else the thing's own
// name: a message reference, or the player's words.
//
// `context` is { world, type, builds? }: the world of the island the program
// runs on, the robot or building type it's for (src/sim/entities.js), or null
// when that's not one type, and for construction sites the blueprints of those
// that run it. Each list returns [[label, id], …], perhaps none.

const labelIn = (list, id) => list.find(([, value]) => value === id)?.[0] ?? null;
const rank = (id) => {
  const i = PLACES.findIndex(([, value]) => value === id);
  return i < 0 ? PLACES.length : i;
};

// The recipes of robot or building type `type`, or null for any.
const recipesOf = (type) => (type ? (TYPES[type]?.recipes ?? []) : null);

export const CHOICES = {
  // Every building and deposit on the island a robot can go to, whose store can
  // be counted, in the order the game's own places are listed, then by id.
  places: ({ world }) =>
    [...world.entities, ...world.nodes]
      .filter((t) => t.access?.length)
      .sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1))
      .map((t) => [labelIn(PLACES, t.id) ?? t.name, t.id]),
  // Every robot and building, which a message can go to: robots first, then
  // buildings in the order the game's places are listed.
  recipients: ({ world }) =>
    [...world.entities]
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "robot" ? -1 : 1) || rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1))
      .map((t) => [labelIn(PLACES, t.id) ?? t.name, t.id]),
  // The items the building has a recipe for.
  makes: ({ type }) => MADE.filter(([, item]) => recipesOf(type)?.includes(item) ?? RECIPES[item]),
  // What the building can build: a construction site, what its blueprint says.
  builds: ({ type, builds }) => BLUEPRINTS.filter(([, what]) => (builds?.length ? builds.includes(what) : (recipesOf(type)?.includes(what) ?? RECIPES[what]))),
};

export const choicesFor = (list, context) => CHOICES[list]?.(context) ?? [];
