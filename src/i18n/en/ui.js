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

  // Names of things on the island. {n} tells things of a kind apart.
  "entity.tree": "Tree {n}",
  "entity.rock": "Rock {n}",
  "entity.depot": "Depot",
  "entity.sawmill": "Sawmill",
  "entity.robot": "Robot",
  // A robot's default name, until the player gives it one.
  "entity.robo": "Robo {n}",

  "notFound.title": "Not found",
  "notFound.text": "There's no such page.",
};
