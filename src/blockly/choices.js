import { TYPES } from "../sim/entities.js";
import { RECIPES } from "../sim/recipes.js";
import { BLUEPRINTS, ITEM_CHOICES, MADE, PLACES, ROBOTS, TEAMS } from "./blocks.js";

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

// The places of `world` that `fits`, in the order the game's own places are
// listed, then by id.
const placesOf = (world, fits) =>
  [...world.entities, ...world.nodes]
    .filter((t) => t.access?.length && fits(t))
    .sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1))
    .map((t) => [labelIn(PLACES, t.id) ?? t.name, t.id]);

// The items there are on `world`'s island: what its deposits yield, what its
// buildings make or order, and what anything holds.
function itemsOn(world) {
  const there = new Set();
  for (const t of [...world.entities, ...world.nodes]) {
    if (TYPES[t.type]?.yields) there.add(TYPES[t.type].yields);
    for (const r of TYPES[t.type]?.recipes ?? []) for (const item of Object.keys(RECIPES[r].outputs)) there.add(item);
    for (const item of [...Object.keys(t.store?.items ?? {}), ...Object.keys(t.order ?? {})]) there.add(item);
  }
  return there;
}

export const CHOICES = {
  // Every building and deposit on the island a robot can go to, whose store can
  // be counted.
  places: ({ world }) => placesOf(world, () => true),
  // The buildings alone: what can be supplied, and has an order.
  buildings: ({ world }) => placesOf(world, (t) => t.kind === "building"),
  // The items there are on the island, in the order the game lists them.
  items: ({ world }) => {
    const there = itemsOn(world);
    return ITEM_CHOICES.filter(([, item]) => there.has(item));
  },
  // The island's teams, which a new robot can be made for.
  teams: ({ world }) => world.roles.map((r) => [labelIn(TEAMS, r.id) ?? r.name, r.id]),
  // Every robot and building, which a message can go to: robots first, then
  // buildings in the order the game's places are listed.
  recipients: ({ world }) =>
    [...world.entities]
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "robot" ? -1 : 1) || rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1))
      .map((t) => [labelIn(PLACES, t.id) ?? t.name, t.id]),
  // The items the building has a recipe for.
  makes: ({ type }) => MADE.filter(([, item]) => recipesOf(type)?.includes(item) ?? RECIPES[item]),
  // The robots the building can make: the camp helpers, the workshop guards.
  robots: ({ type }) => ROBOTS.filter(([, robot]) => recipesOf(type)?.includes(robot) ?? true),
  // What the building can build: a construction site, what its blueprint says.
  builds: ({ type, builds }) => BLUEPRINTS.filter(([, what]) => (builds?.length ? builds.includes(what) : (recipesOf(type)?.includes(what) ?? RECIPES[what]))),
};

export const choicesFor = (list, context) => CHOICES[list]?.(context) ?? [];
