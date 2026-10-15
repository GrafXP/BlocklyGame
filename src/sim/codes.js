// Everything the simulation and the compiler report is a code with values, never
// words (PLAN.md §8): { code: "wait.item", item: "wood", at: "grove", need: 1,
// have: 0 }. The interface words them in the player's language
// (src/ui/describe.js), so saves, traces and golden files don't change when a
// translation does. npm test checks that every code here has a message in every
// language.
//
// Each code lists the values it comes with. Things are named by id, items by
// item id (entities.js), blocks by their Blockly block id.
export const CODES = {
  // Waiting: an action that can't start yet keeps its block active and is tried
  // again every tick, after those that started waiting earlier (PLAN.md §4).
  "wait.item": ["item", "at", "need", "have"], // fewer than `need` of `item` free at thing `at`
  "wait.space": ["item", "at", "need", "free"], // room for fewer than `need` of `item` at `at`
  "wait.route": ["target"], // no way to `target`; tried again when the ways change
  "wait.until": ["block"], // a Wait Until block whose condition isn't true yet

  // Program errors: what can't work as written. The entity stops until it's
  // restarted or given another program. From a program, each also has the
  // `block` that couldn't work.
  "error.target": ["target"], // there's no thing `target` to go to
  "error.cannot": ["action"], // this robot or building can't do `action`
  "error.notHere": ["action"], // not where `action` can be done
  "error.busy": ["block"], // a program did more in one tick than it may (never, compiled from blocks)

  // What the compiler finds wrong with a program (src/programming/compiler.js).
  // An error stops the program being used; a warning only says something.
  "program.unreadable": [], // not a Blockly workspace this game can read
  "program.noStart": [], // no When Started block
  "program.twoStarts": ["block"], // a second When Started block
  "program.unsupported": ["block", "type"], // a block, or a choice in one, this game can't run here
  "program.empty": ["block"], // a gap in `block` that needs a block in it
  "program.wantNumber": ["block"], // a gap in `block` that needs a number, holding something else
  "program.wantTest": ["block"], // a gap in `block` that needs something true or false
  "program.whole": ["block", "min", "max"], // a number that isn't whole, or is out of range
  "program.target": ["block", "target"], // a place there isn't
  "program.cannot": ["block", "action"], // an action or sense the robot or building it's for can't do
  "program.tooBig": ["limit"], // more than `limit` blocks
  "program.tooDeep": ["block", "limit"], // blocks inside each other more than `limit` deep
  "program.unused": ["block"], // warning: a stack that isn't under the start block, and won't run

  // The whole world: nothing is under way, and every entity that isn't stopped
  // is waiting, so nothing can change until the player changes something.
  stall: [],

  // A player command that doesn't fit the world, and was left out.
  "command.invalid": ["type"],
};

export const reason = (code, values = {}) => ({ code, ...values });
