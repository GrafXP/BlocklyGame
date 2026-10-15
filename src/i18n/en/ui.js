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
  // Under the button of the first mission, whose title is the button's words.
  "home.playNote": "Phase 5: the first mission. Four programs work together to build the bridge.",
  // How far the mission got, when it's saved on this device.
  "home.saved": "Saved at step {tick}.",
  "home.completed": "Done!",
  // Starting the mission over deletes the saved game and every change to its
  // programs, for the next player. It asks first.
  "home.startOver": "Start over…",
  "home.startOverAsk": "Start the mission over? The saved game and every change to its programs will be gone.",
  "home.startOverYes": "Start over",
  "home.startOverNo": "Keep it",
  "home.island": "Island",
  "home.islandNote": "Phase 4 prototype: the island in 3D, its robots and buildings running programs you can watch, step through and change.",
  "home.lab": "Editor lab",
  "home.labNote": "Phase 0 prototype: the editor over the 3D world.",
  "home.world": "World lab",
  "home.worldNote": "Phase 2 prototype: robots and buildings running their programs on the world clock.",
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
  "meter.frames": "{fps} fps · slowest {slowest} ms",
  // The time the game's own code took per frame, and the number of draw calls.
  "meter.work": {
    one: "code {work} ms · {count} draw call",
    other: "code {work} ms · {count} draw calls",
  },
  // How many triangles the last frame drew.
  "meter.triangles": {
    one: "{count} triangle",
    other: "{count} triangles",
  },

  // The world lab: the world clock, and robots and buildings running their
  // programs, without the 3D island or the editor yet.
  "world.title": "World lab",
  "world.reset": "Start again",
  // Columns of the table of robots, buildings and deposits.
  "world.name": "Name",
  "world.where": "Where",
  "world.doing": "Doing",
  "world.has": "Has",
  "world.state": "State",
  // The block of its program a robot or building is at.
  "world.block": "Block",
  // Marks the block evaluated in the latest step, for screen readers.
  "world.evaluated": "Evaluated in this step",
  // A cell on the island's grid: {x} east, {z} south.
  "world.cell": "{x}, {z}",
  // What an empty basket or store holds.
  "world.nothing": "nothing",

  // The island in 3D, with the world clock, labels and the inspector.
  "island.title": "Island",
  "inspector.hint": "Tap a robot or building to see what it's doing.",
  // Heads the list of everything on the island, to choose from.
  "inspector.everyone": "Robots and buildings",
  "inspector.close": "Close",
  // What a selected thing is.
  "inspector.robot": "Robot",
  "inspector.building": "Building",
  // A grove or stone pit, where robots collect wood or stone.
  "inspector.resource": "Resource",
  // A robot's basket: what's in it, then how full it is.
  "inspector.basket": "Basket",
  // How many there are of how many there's room for: "2 of 4".
  "inspector.of": "{have} of {cap}",
  // Opens the chosen robot or building's program in the editor.
  "inspector.edit": "Edit program",
  // What the block a robot or building is at looked at in this step: each
  // value, such as "wood at sawmill", and what it was.
  "inspector.reads": "Sees",
  // Which time round a Repeat block it is: "Round 1 of 2".
  "inspector.loop": "Repeat",
  "inspector.round": "Round {count} of {times}",
  // Whether a condition, such as "wood at sawmill > 0", holds.
  "reading.true": "true",
  "reading.false": "not true",
  // The program a robot or building runs, in the list of all of them, and
  // which version of it: each Apply makes a new version.
  "overview.program": "{program}, version {revision}",
  // A new version was applied, and starts at the next step of the world.
  "overview.pending": "Version {revision} starts with the next step",

  // The program editor. A draft is changed blocks that don't run yet; Apply
  // makes them the program the robot runs, from the next step.
  // {names}: robots and buildings, as a list.
  "editor.runners": "Run by {names}",
  "editor.apply": "Apply",
  "editor.undo": "Undo changes",
  "editor.starter": "Starter program",
  "editor.starterTitle": "Back to the program the game gave it. Apply to run it.",
  "editor.running": "Version {revision} is running.",
  "editor.changed": "Changed. Apply to run it; until then, version {revision} keeps running.",
  "editor.pending": "Version {revision} starts with the next step.",
  "editor.problems": "Put the marked blocks right, then apply.",
  // A program a robot has been given but hasn't started yet, such as a robot
  // waiting for its job. Applying it starts it.
  "editor.parked": "Not started yet. Change it and apply, and it starts.",
  "editor.parkedChanged": "Changed. Apply to start it.",
  // Every running program side by side, with where each robot is in it.
  "together.open": "All programs",
  "together.title": "All programs",
  "together.version": "version {revision}",
  "together.empty": "Nothing is running a program.",
  // For screen readers: the handle on the edge of the panel on the left.
  "panel.resize": "Resize the panel",
  // Items, named on their own, in a list of what a building has.
  "item.wood": "Wood",
  "item.stone": "Stone",
  "item.plank": "Planks",
  "item.kit": "Kits",
  // A label over a robot or building, for screen readers: its name and what
  // it's doing in a word (state.*).
  "tag.label": "{name}: {state}",
  // A label's tooltip, when it waits or has stopped: the word, then why.
  "tag.title": "{state}: {reason}",
  // The buttons that move the view. They turn the island a quarter turn.
  "view.controls": "View",
  "view.turnLeft": "Turn left",
  "view.turnRight": "Turn right",
  "view.zoomIn": "Zoom in",
  "view.zoomOut": "Zoom out",
  "view.reset": "Reset view",
  // How much the 3D view draws: simple for older tablets.
  "quality.label": "Graphics",
  "quality.low": "Simple",
  "quality.high": "Detailed",

  // The world clock. One step is one tick of the world, as on the Step button.
  "clock.run": "Run",
  "clock.pause": "Pause",
  "clock.step": "Step",
  // Steps until the chosen robot or building is at its next block.
  "clock.next": "Next block",
  "clock.nextTitle": "Step until the chosen robot or building takes its next block, or until anyone does when nothing is chosen.",
  "clock.speed": "Speed",
  // A playback speed, such as 0.5×, 1×, 2×.
  "clock.speedValue": "{speed}×",
  "clock.ticks": "Steps: {tick}",
  // What “Start again” does in a mission.
  "clock.resetMission": "Back to the start of the mission. Your programs stay as you applied them.",

  // The mission card: the goal, how far it has got, hints, and the reward.
  // For screen readers: what the card is.
  "mission.label": "Mission",
  "mission.hint": "Hint",
  "mission.moreHint": "Another hint",
  // The three hints, each in a word before it: look at something, think about
  // a question, try a change.
  "mission.look": "Look:",
  "mission.think": "Think:",
  "mission.try": "Try:",
  // Chooses the thing the Look hint is about.
  "mission.show": "Show me",
  "mission.done": "Done!",
  // After a program was applied: a robot keeps what it carries when its program
  // starts again, so the change is best watched from the mission's start. The
  // button under it is “Start again” (world.reset).
  "mission.again": "You changed a program. Start again to watch the mission from the beginning with your change.",
  // About saving, under the mission's goal.
  "mission.discarded": "The saved game couldn't be used, so the mission starts from the beginning.",
  "mission.unsaved": "This device won't keep the game: after a reload, it starts from the beginning.",
  "mission.ok": "OK",

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
  // Counting what's in its basket, which only a robot has.
  "action.name.basket": "Look in the basket",

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
  // At a "wait until" block whose condition is false.
  "wait.until": "Waiting until its condition is true",
  // Why a program stopped. {target} is an id, as written in the program.
  "error.target": "No such place: {target}",
  "error.cannot": "Can't do this: {action}",
  "error.notHere": "Not in the right place for this: {action}",
  // Can't happen with programs made of blocks; a damaged program.
  "error.busy": "This program did too much in one step.",

  // What's wrong with a program, shown at the block it's about. "When started"
  // is the start block's words (ISLAND_WHEN_STARTED in blocks.js); a gap is
  // where a block plugs into another.
  "program.unreadable": "This program can't be read.",
  "program.noStart": "This program needs a “when started” block to start from.",
  "program.twoStarts": "A program has one start block. Take this one away, or move its blocks under the other.",
  "program.unsupported": "This block can't be used here.",
  "program.empty": "Something is missing: put a block in this block's gap.",
  "program.wantNumber": "This block's gaps need numbers.",
  "program.wantTest": "This block's gap needs something that is true or false.",
  "program.whole": "Use a whole number from {min} to {max}.",
  "program.target": "No such place: {target}",
  "program.cannot": "Can't do this: {action}",
  "program.tooBig": "This program has too many blocks: at most {limit}.",
  "program.tooDeep": "Too many blocks inside each other here: at most {limit}.",
  "program.unused": "This isn't under the start block, so it won't run.",
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
  // The starter programs' names, until the player gives them others.
  "programName.collector": "Wood collector",
  "programName.courier": "Plank courier",
  "programName.stones": "Stone carrier",
  "programName.planks": "Plank maker",
  "programName.bridge": "Bridge builder",

  "notFound.title": "Not found",
  "notFound.text": "There's no such page.",
};
