// Everything the simulation reports is a code with values, never words (PLAN.md
// §8): { code: "wait.item", item: "wood", at: "grove", need: 1, have: 0 }. The
// interface words them in the player's language (src/ui/describe.js), so saves,
// traces and golden files don't change when a translation does. npm test checks
// that every code here has a message in every language.
//
// Each code lists the values it comes with. Things are named by id, items by
// item id (entities.js).
export const CODES = {
  // Waiting: an action that can't start yet keeps its block active and is tried
  // again every tick, after those that started waiting earlier (PLAN.md §4).
  "wait.item": ["item", "at", "need", "have"], // fewer than `need` of `item` free at thing `at`
  "wait.space": ["item", "at", "need", "free"], // room for fewer than `need` of `item` at `at`
  "wait.route": ["target"], // no way to `target`; tried again when the ways change

  // Program errors: what can't work as written. The entity stops until it's
  // restarted or given another program.
  "error.target": ["target"], // there's no thing `target` to go to
  "error.cannot": ["action"], // this robot or building can't do `action`
  "error.notHere": ["action"], // not where `action` can be done

  // The whole world: nothing is under way, and every entity that isn't stopped
  // is waiting, so nothing can change until the player changes something.
  stall: [],

  // A player command that doesn't fit the world, and was left out.
  "command.invalid": ["type"],
};

export const reason = (code, values = {}) => ({ code, ...values });
