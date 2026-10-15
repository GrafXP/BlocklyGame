// The interface in English, the source language (PLAN.md §8, Languages). Every
// other language has these keys, with the same {name} placeholders.
//
// A message is a whole sentence or label; never build one from pieces. One with
// plural forms is an object chosen by its {count}: English has `one` and `other`,
// other languages have the forms Intl.PluralRules lists for them. Numbers are
// filled in written the language's way (1,234.5 here, 1.234,5 in German).
//
// Notes for translators are comments above the message.
export default {
  // The game's name. Whether it's translated is still open (PLAN.md §8).
  "app.name": "Robot Island",
  // The browser tab's title on a page other than the title page: the page's
  // name, then the game's.
  "page.title": "{page} · {app}",

  "home.tagline": "Program robots and buildings to bring an island back to life.",
  "home.lab": "Editor lab",
  "home.labNote": "Phase 0 prototype: the editor over the 3D world.",
  "home.world": "World lab",
  "home.worldNote": "Phase 1 prototype: robots and buildings on the world clock, following fixed plans.",
  "nav.home": "Home",
  // Labels the list of languages, each shown in its own language.
  "language.choose": "Language",

  // The editor lab: a test bench for how the editor looks over the 3D world.
  "lab.title": "Editor lab",
  "lab.treatment": "Style",
  // The visual styles of the editor, to compare. "Blockly" is the library's own
  // look, named after it.
  "lab.style.classic": "Blockly",
  "lab.style.calm": "Calm",
  "lab.style.bold": "Bold",
  // How solid the editor's background is, from see-through to solid.
  "lab.transparency": "Background",
  "lab.blur": "Blur",
  "lab.world": "World",
  "lab.day": "Day",
  "lab.dusk": "Dusk",
  "lab.moving": "Moving robot",
  // Markers show which robot or building is at which block.
  "lab.markers": "Markers",
  // Moves the sample markers on by one step.
  "lab.step": "Step markers",
  "lab.roundTrip": "Save and reload",
  "lab.roundTripOk": {
    one: "Saved and reloaded {count} block ({bytes} bytes); nothing changed.",
    other: "Saved and reloaded {count} blocks ({bytes} bytes); nothing changed.",
  },
  "lab.roundTripBad": "The reloaded program differs from the saved one.",
  "lab.reset": "Reset program",
  "lab.selected": "Selected: {name}",
  "lab.nothingSelected": "Nothing selected",
  // For screen readers: the handle on the editor's edge that sets its width.
  "lab.resize": "Resize the editor",
  "lab.on": "On",
  "lab.off": "Off",
  "lab.hide": "Hide controls",
  "lab.show": "Lab controls",
  // Measurements for developers: frames drawn per second, and the slowest frame.
  "lab.frames": "{fps} fps · slowest {slowest} ms",
  // The time the game's own code took per frame, and the number of draw calls.
  "lab.work": {
    one: "code {work} ms · {count} draw call",
    other: "code {work} ms · {count} draw calls",
  },

  // The world lab: the world clock, robots and buildings, without programs yet.
  "world.title": "World lab",
  "world.reset": "Start again",
  // Columns of the table of robots, buildings and deposits.
  "world.name": "Name",
  "world.where": "Where",
  "world.doing": "Doing",
  "world.has": "Has",
  "world.state": "State",
  // A cell on the island's grid: {x} east, {z} south.
  "world.cell": "{x}, {z}",
  // What an empty basket or store holds.
  "world.nothing": "nothing",

  // The world clock. One step is one tick of the world, as on the Step button.
  "clock.run": "Run",
  "clock.pause": "Pause",
  "clock.step": "Step",
  "clock.speed": "Speed",
  // A playback speed, such as 0.5×, 1×, 2×.
  "clock.speedValue": "{speed}×",
  "clock.ticks": "Steps: {tick}",

  // What a robot or building is doing, in a word.
  "state.ready": "Ready",
  "state.moving": "Moving",
  "state.working": "Working",
  "state.waiting": "Waiting",
  "state.stopped": "Stopped",
  "state.error": "Error",

  // What it's doing, more exactly. {place} is a name; {amount} is a count of an
  // item (count.*), {amounts} a list of them.
  "action.move": "On the way to {place}",
  "action.collect": "Collecting {amount}",
  "action.pickUp": "Picking up {amount}",
  "action.unload": "Unloading {amounts}",
  "action.make": "Making {amount}",
  "action.build.bridge": "Building the bridge",
  "action.wait": {
    one: "Waiting {count} more step",
    other: "Waiting {count} more steps",
  },
  // Actions named on their own, after an error's colon.
  "action.name.goTo": "Go to",
  "action.name.collect": "Collect",
  "action.name.pickUp": "Pick up",
  "action.name.unload": "Unload",
  "action.name.make": "Make",
  "action.name.wait": "Wait",

  // Counts of items.
  "count.wood": {
    one: "{count} wood",
    other: "{count} wood",
  },
  "count.stone": {
    one: "{count} stone",
    other: "{count} stones",
  },
  "count.plank": {
    one: "{count} plank",
    other: "{count} planks",
  },
  "count.kit": {
    one: "{count} kit",
    other: "{count} kits",
  },

  // Why something waits (src/sim/codes.js). {have} and {free} are numbers of the
  // same item as {amount}.
  "wait.item": "Needs {amount} · {place} has {have}",
  "wait.space": "No room for {amount} · {place} has room for {free}",
  "wait.route": "No way to {place}",
  // Why a program stopped. {target} is an id, as written in the program.
  "error.target": "No such place: {target}",
  "error.cannot": "Can't do this: {action}",
  "error.notHere": "Not in the right place for this: {action}",
  // The whole world is stuck.
  stall: "Everything is waiting: nothing can happen until something changes.",
  // {type} is a command's name, for developers.
  "command.invalid": "A command didn't fit this world: {type}",

  // Names of things on the island. {n} tells things of a kind apart.
  "entity.tree": "Tree {n}",
  "entity.rock": "Rock {n}",
  "entity.camp": "Camp",
  "entity.depot": "Depot",
  "entity.sawmill": "Sawmill",
  "entity.site": "Construction site",
  "entity.grove": "Grove",
  "entity.quarry": "Stone pit",
  "entity.robot": "Robot",
  // A robot's default name, until the player gives it one.
  "entity.robo": "Robo {n}",

  "notFound.title": "Not found",
  "notFound.text": "There's no such page.",
};
