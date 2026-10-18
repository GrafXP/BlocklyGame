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
  // The game's name, the same in every language (PLAN.md §8).
  "app.name": "BlocklyBots",
  // The browser tab's title on a page other than the title page: the page's
  // name, then the game's.
  "page.title": "{page} · {app}",

  "home.tagline": "Program robots and buildings to bring an island back to life.",
  "home.play": "Play",
  // The button once the missions have begun: the mission they're at.
  "home.continue": "Mission {n}: {title}",
  "home.playNote": "Thirty missions so far, from a first instruction to a workshop you build yourself.",
  // How far the mission got, when it's saved on this device.
  "home.saved": "Saved at step {tick}.",
  "home.completed": "Done!",
  // Starting over deletes the saved missions, free play and every change to
  // their programs, for the next player. It asks first.
  "home.startOver": "Start over…",
  "home.startOverAsk": "Start the missions over from mission 1? The saved game, free play and every change to your programs will be gone.",
  "home.startOverYes": "Start over",
  "home.startOverNo": "Keep it",
  // Every mission, by chapter; those done can be played again on their own.
  "home.missions": "Choose a mission",
  "home.chapter": "Chapter {n}: {title}",
  "home.replay": "Play again",
  // A mission not reached yet.
  "home.locked": "Not yet",
  // The mission the campaign is at, on the mission map.
  "home.here": "You're here",
  // With ?dev, for testing: a mission not reached yet, played on its own.
  "home.try": "Try it",
  "home.devOpen": "Test mode: every mission is open, and plays on its own.",
  "home.free": "Free play",
  "home.freeNote": "Your own island, with the blocks you've learned.",
  "home.freeLocked": "Free play opens after mission 15.",
  "home.sandbox": "Sandbox",
  "home.sandboxNote": "Choose how the island starts, add robots, and build workshops.",
  // The earlier phases' pages, for grown-ups.
  "home.prototypes": "Prototypes",
  "home.sliceNote": "Phase 5: mission 15 on its own, for its playtest.",
  "home.island": "Island",
  "home.islandNote": "Phase 6 prototype: the island in 3D. Watch its programs, step through them and change them; share a program in a team, give each robot its settings, and build a workshop.",
  "home.lab": "Editor lab",
  "home.labNote": "Phase 0 prototype: the editor over the 3D world.",
  "home.world": "World lab",
  "home.worldNote": "Phase 2 prototype: robots and buildings running their programs on the world clock.",
  "nav.home": "Home",
  // Labels the list of languages, each shown in its own language.
  "language.choose": "Language",
  // The island page's menu of the language and the graphics.
  "menu.settings": "Settings",

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
  // Said of a resource when it's chosen: it does nothing by itself.
  "inspector.resourceNote": "Robots collect from it. It has no program.",
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
  // What its program's variables hold now: each name with its number. A
  // variable is a named piece of a robot's memory (docs/glossary.md).
  "inspector.memory": "Remembers",
  // The blocks of the player's own it's inside, innermost last: “Bring wood”.
  "inspector.inside": "Inside",
  // The messages it has been sent and hasn't taken yet, oldest first.
  "inspector.inbox": "Inbox",
  "inspector.inboxEmpty": "empty",
  // A message in an inbox: “plank ready” from Sawmill.
  "inspector.message": "“{message}” from {name}",
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
  // Who an Apply changes: every robot and building that runs the program, as it
  // will be at the next step. {names}: their names, as a list.
  "editor.affects": "Apply changes it for {names}, from the next step.",
  // A program nothing runs, such as a new one, or a copy no one has yet.
  "editor.noRunners": "Nothing runs it yet. Apply it, then give it to a robot or building.",
  // Keeps only the start block, for making a program from nothing.
  "editor.blank": "Start from nothing",
  "editor.blankTitle": "Keep only the start block. “Undo changes” brings your blocks back.",
  // The program's history, folded away under the editor's head until
  // “Versions” opens it: every version applied, as a tree. Tapping one puts it
  // into the editor; it runs only once applied. {revision}: a version's number.
  "history.open": "Versions",
  "history.hint": "Tap a version to put it into the editor. It runs once you apply it.",
  "history.version": "Version {revision}",
  "history.running": "running",
  "history.editing": "in the editor",
  "history.editingChanged": "in the editor, changed",
  // Changes not applied, kept when another version was put into the editor;
  // at the bottom of the tree. {revision}: the version they started from.
  "history.kept": "Current, not applied yet",
  "history.keptFrom": "from version {revision}",
  // Every running program side by side, with where each robot is in it.
  "together.open": "All programs",
  "together.title": "All programs",
  "together.version": "version {revision}",
  "together.empty": "Nothing is running a program.",

  // The program library: every program, who runs it, and giving it to robots
  // and buildings. A team is a named group of robots that share one program.
  "library.open": "Programs",
  "library.title": "Programs",
  "library.new": "New program",
  "library.unused": "Nothing runs it.",
  // A team's shared program, or the one every building of a kind runs. {team}
  // is a team's name, such as “Wood team”; {type} a kind of building, such as
  // “Sawmill”.
  "library.forTeam": "Team program: {team}",
  "library.forType": "For every building like this: {type}",
  "library.edit": "Edit",
  "library.give": "Give to…",
  // Above the choices of whom to give program {program} to.
  "library.giveTo": "Give {program} to:",
  "library.giveTeam": "Team: {team}",
  "library.giveType": "Every building like this: {type}",
  "library.giveOne": "Only {name}",
  "library.duplicate": "Copy",
  "library.rename": "Rename",
  // Putting a program away hides it from the list; it can be brought back.
  "library.archive": "Put away",
  "library.archiveTitle": "Only a program nothing runs can be put away.",
  "library.archived": "Put away: {count}",
  "library.restore": "Bring back",
  "library.name": "Name",
  "library.ok": "OK",
  "library.cancel": "Cancel",

  // The chosen robot or building's program, team and settings, in its flyout.
  "setup.team": "Team",
  "setup.noTeam": "No team",
  "setup.noProgram": "No program",
  // Where its program comes from: given to it alone, shared by its team
  // ({team}: the team's name), or run by every building of its kind.
  "setup.own": "Its own program",
  "setup.fromTeam": "Shared by its team: {team}",
  "setup.fromType": "For every building like this",
  "setup.copy": "Make its own copy",
  "setup.back": "Back to the shared program",
  "setup.rename": "Rename",
  "setup.name": "Name",
  "setup.ok": "OK",
  "setup.cancel": "Cancel",
  // A robot's settings, which the “my source”, “my item” and “my destination”
  // blocks read. Each is a place or an item, or not chosen yet.
  "settings.title": "Settings",
  "settings.none": "Not chosen",
  // A setting changed while the world is paused counts from the next step.
  "settings.pending": "From the next step",
  "setting.source": "Source",
  "setting.item": "Item",
  "setting.destination": "Destination",

  // What a change of program will do, shown before it's made: every robot and
  // building it changes, {names}, as a list, and how many, {count}.
  "preview.program": {
    one: "{names} will run {program} from the next step, from the beginning.",
    other: "{names} will run {program} from the next step, from the beginning.",
  },
  "preview.stop": {
    one: "{names} will have no program from the next step, and stop.",
    other: "{names} will have no program from the next step, and stop.",
  },
  "preview.basket": "A robot that gets a new program starts with an empty basket.",
  "preview.nobody": "Nobody runs anything different because of this.",
  // Making a robot's own copy of the program it shares. {name}: the robot.
  "preview.copy": "{name} gets its own copy of {program}. Change the copy, and only {name} changes.",

  // Placing a building: the player chooses where it goes, and robots bring
  // what its construction site needs.
  "build.open": "Build",
  "build.ask.workshop": "Where should the workshop go? Tap a spot on the island.",
  // In a mission that marks where the workshop goes: one plot, or several to
  // choose from.
  "build.plot.workshop": "The workshop goes on its plot, marked on the island.",
  "build.plots.workshop": "The workshop goes on one of the plots marked on the island. Tap one to choose it.",
  "build.turn": "Turn",
  "build.place": "Build it here",
  "build.cancel": "Cancel",
  // {amounts}: what the construction site needs, such as “4 planks, 2 stones”.
  "build.fits": "It fits here. Robots bring what the construction site needs: {amounts}.",
  "build.pending": "The construction site appears with the next step.",
  // For screen readers: the handle on the edge of the panel on the left.
  "panel.resize": "Resize the panel",
  // Items, named on their own, in a list of what a building has.
  "item.wood": "Wood",
  "item.stone": "Stone",
  "item.plank": "Planks",
  "item.kit": "Kits",
  // The messages robots and buildings send each other, as said in a sentence
  // (in quotes, as the blocks show them: MESSAGE_* in blocks.js).
  "message.plankReady": "plank ready",
  "message.kitReady": "kit ready",
  "message.woodPlease": "wood please",
  "message.plankPlease": "plank please",
  "message.stonePlease": "stone please",
  "message.stoneDelivered": "stone delivered",
  "message.go": "go",
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
  // The speed button's name: each press goes on to the next speed.
  "clock.speedIs": "Speed: {speed}×",
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
  // Above the mission's title: where it is in the campaign.
  "mission.chapter": "Chapter {chapter} · Mission {n}",
  // A mission done before, played again on its own. {n}: its number.
  "mission.replaying": "You're playing mission {n} again, from the beginning. The other missions stay as they are.",
  // For screen readers: the list of the mission's goals, and of its trials.
  "mission.goals": "Goals",
  "mission.trials": "Trials",
  // A trial: the same programs, starting from another variation, such as one
  // plank and then two. {n}: its number.
  "mission.trialLabel": "Trial {n}:",
  // Shown, with the world paused, when a trial is passed. {what}: the next
  // trial's variation, such as “Two planks at the sawmill”.
  "mission.trialPassed": "Trial {n} passed! Next: {what}. Press Run.",
  // Opens the program the mission is about in the editor.
  "mission.open": "Open the program",
  // The prediction before Run: said aloud, or by pointing at something on the
  // island, or skipped. Nothing is written.
  "mission.predictLabel": "Before you run:",
  "mission.point": "Point to it",
  "mission.pointing": "Tap it on the island, or tap its label.",
  "mission.said": "I said it",
  "mission.skip": "Skip",
  // {name}: what the player pointed at.
  "mission.guess": "Your guess: {name}",
  // After success: something to tell someone, or skip.
  "mission.explainLabel": "Tell someone:",
  "mission.explained": "Done",
  "mission.next": "Next mission",
  // After a mission played again, or the campaign's last mission.
  "mission.toMissions": "Back to the missions",
  // The mission's briefing, a big window as it starts: its goal and what's
  // set up, and one button to begin.
  "briefing.go": "Let's go!",
  // The win, a big window with fireworks once the mission is done. Its big
  // button is “Next mission” (or “Back to the missions”); this one closes the
  // window and goes on with the island as it is. {n}: the mission's number;
  // {title}: its title.
  "win.title": "Mission complete!",
  "win.mission": "Mission {n}: {title}",
  "win.keep": "Keep playing",
  // When everything has stopped short of the goal. Never an interruption.
  "mission.stuck": "Everything has stopped, but the goal isn't reached yet. A hint can help.",
  // In the Try hint: blocks put into the editor, to apply or change.
  "mission.start": "Show me a start",
  "mission.whole": "Show me the whole program",
  // When the mission has several programs to change. {name}: the program's.
  "mission.wholeOf": "Show me the whole program: {name}",
  // The Look hint when a robot or building's program stopped. {name}: it;
  // {reason}: why, such as “Not in the right place for this: Collect”.
  "problem.error": "Look at {name}. Its program stopped: {reason}",

  // The mission's goals on its card, each beside pictures. {place}, {robot}:
  // names; {item}: an item, such as “Wood”; {have} of {need}: how far it is.
  "goal.reached": "{robot} → {place}",
  "goal.holds": "Basket of {robot}: {have} of {need}",
  "goal.delivered": "{place} · {item}: {have} of {need}",
  "goal.deliveredBy": "{robot} → {place}: {have} of {need}",
  "goal.trips": "Trips by {robot}: {have} of {need}",
  "goal.made": "{place} · {item} made: {have} of {need}",
  // A goal of making none at all: {have} made so far.
  "goal.madeNone": "{place} · {item} made: {have}, and none are wanted",
  "goal.built": "{place} builds the bridge",
  // A building's construction site placed on the island, and the building
  // finished there: {building} is its name, such as Workshop.
  "goal.placed": "{building}: its site placed",
  "goal.constructed": "{building}: built",
  // Keeping a number on a shelf: {have} now, {need} to keep.
  "goal.steady": "{place} · {item}: {have}, keep it at {need}",
  // What a robot remembers in a variable: {have} now, {need} once it's done.
  "goal.remembers": "{robot} remembers: {have} of {need}",
  // Notes under a goal.
  "goal.exact": "Exactly this many, then the job stops.",
  "goal.load": "Two at a time, in full baskets.",
  "goal.noWait": "{robot} sets off only when everything is ready.",
  "goal.steadyNote": "Keep it so for a while after {name} has finished.",
  "goal.steadyAlone": "Keep it so for a while: no more come.",
  "goal.remembersNote": "Counted when its job is done.",
  "goal.failed": "Not this time. Start again to try once more.",

  // The campaign, free play and the sandbox.
  "campaign.title": "Missions",
  "chapter.1": "Hello, Helper!",
  "chapter.2": "Do It Again",
  "chapter.3": "A Working Island",
  "chapter.4": "Look Before You Act",
  "chapter.5": "One Helper, Useful Jobs",
  "chapter.6": "Make Room to Grow",
  "free.title": "Free play",
  "sandbox.title": "Sandbox",
  "sandbox.addRobot": "Add a robot",
  "sandbox.new": "New island…",
  "sandbox.newAsk": "Start the island again, laid out as you choose. Your programs stay.",
  // The layout's choices, each a label and its options.
  "sandbox.robots": "Robots",
  "sandbox.supplies": "Supplies",
  "sandbox.supplies.some": "Some",
  "sandbox.supplies.plenty": "Plenty",
  "sandbox.bridge": "Bridge",
  "sandbox.bridge.built": "Built",
  "sandbox.bridge.toBuild": "Still to build",
  "sandbox.workshop": "Workshop",
  "sandbox.workshop.built": "Built",
  "sandbox.workshop.none": "Build it yourself",
  "sandbox.create": "Start this island",
  "sandbox.cancel": "Cancel",
  // A building's or deposit's supplies, changed one at a time in the sandbox.
  // {item}: an item, such as “Wood”.
  "sandbox.stock": "Supplies",
  "sandbox.more": "One more: {item}",
  "sandbox.less": "One fewer: {item}",

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
  "action.build.workshop": "Building the workshop",
  "action.wait": {
    one: "Waiting {count} more step",
    other: "Waiting {count} more steps",
  },
  // {message}: a message's words (message.*); {name}: who it's for.
  "action.send": "Sending “{message}” to {name}",
  // Actions named on their own, after an error's colon.
  "action.name.goTo": "Go to",
  "action.name.collect": "Collect",
  "action.name.pickUp": "Pick up",
  "action.name.unload": "Unload",
  "action.name.make": "Make",
  "action.name.wait": "Wait",
  "action.name.send": "Send a message",
  // Counting what's in its basket, which only a robot has.
  "action.name.basket": "Look in the basket",
  // Reading its settings, which only a robot has.
  "action.name.settings": "Use its settings",

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
  // At a "wait for" block, with no such message in its inbox yet.
  "wait.message": "Waiting for the message “{message}”",
  // A message can't be sent yet: {name}'s inbox has as many as it can hold.
  "wait.mailbox": "{name}'s inbox is full",
  // Why a program stopped. {target} is an id, as written in the program.
  "error.target": "No such place: {target}",
  "error.cannot": "Can't do this: {action}",
  "error.notHere": "Not in the right place for this: {action}",
  // {item}: an item's name, such as “Planks”.
  "error.collect": "Only wood and stone can be collected, not this: {item}",
  // {setting}: a setting's name, such as “Destination”.
  "error.setting": "Choose a setting first: {setting}",
  // A message for {target}, which isn't a robot or building.
  "error.recipient": "Only robots and buildings get messages, not this: {target}",
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
  "program.wantPlace": "This block's gap needs a place.",
  "program.wantItem": "This block's gap needs an item.",
  "program.whole": "Use a whole number from {min} to {max}.",
  "program.target": "No such place: {target}",
  "program.cannot": "Can't do this: {action}",
  "program.tooBig": "This program has too many blocks: at most {limit}.",
  "program.tooDeep": "Too many blocks inside each other here: at most {limit}.",
  "program.unused": "This isn't under the start block, so it won't run.",
  // Blocks of the player's own (“my block bring wood”), by their {name}.
  "program.noRoutine": "There's no block called “{name}”. Make it with “my block”, or take this away.",
  "program.twoRoutines": "There's already a block called “{name}”. Give this one another name.",
  "program.recursive": "“{name}” uses itself, so it would never end. Take that out.",
  "program.inputs": "A block of your own can have at most {limit} input.",
  "program.setInput": "An input gets its value where the block is used. Remember things in a variable instead.",
  // The whole world is stuck.
  stall: "Everything is waiting: nothing can happen until something changes.",
  // {type} is a command's name, for developers.
  "command.invalid": "A command didn't fit this world: {type}",

  // Why a building can't go where the player wants it. {thing} is a building
  // or deposit, {robot} a robot.
  "place.ground": "It needs open ground, with open ground in front of it.",
  "place.taken": "Something is in the way: {thing}",
  "place.blocks": "It would stand where robots use this: {thing}",
  "place.robot": "A robot is in the way: {robot}",
  "place.cutOff": "Robots couldn't get to this any more: {thing}",
  "place.unreachable": "No robot could get to it.",
  "place.plot": "Here, buildings go on the plots marked on the island.",

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
  // Buildings the player places, and their construction sites. {n} tells a
  // second one from the first.
  "entity.workshop": "Workshop",
  "entity.workshopN": "Workshop {n}",
  "entity.workshopSite": "Workshop site",
  "entity.workshopSiteN": "Workshop site {n}",
  // The starter programs' names, until the player gives them others.
  "programName.collector": "Wood collector",
  "programName.courier": "Plank courier",
  // The same, taking its planks to the depot rather than the construction site.
  "programName.courierDepot": "Plank courier to the depot",
  "programName.stones": "Stone carrier",
  "programName.planks": "Plank maker",
  "programName.bridge": "Bridge builder",
  "programName.fetch": "Collector",
  "programName.kits": "Kit maker",
  "programName.buildWorkshop": "Workshop builder",
  // A program's copy for one robot or building: the program's name, then
  // whose copy it is.
  "programName.copy": "{program} ({name})",
  // A copy made in the program library.
  "programName.duplicate": "Copy of {program}",
  "programName.new": "New program {n}",
  // A mission's program, by its number and who runs it or what it is: “Mission
  // 3: Robo 1”, “Mission 13: Sawmill”.
  "programName.mission": "Mission {n}: {name}",
  // The teams: named groups of robots that share one program.
  "role.woodTeam": "Wood team",
  "role.plankTeam": "Plank team",
  "role.stoneTeam": "Stone team",

  "notFound.title": "Not found",
  "notFound.text": "There's no such page.",
};
