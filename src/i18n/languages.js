// The languages the game is offered in (PLAN.md §8, Languages). Each has a folder
// beside this file with the same files as en/: ui.js (the interface), blocks.js
// (the game's blocks), missions.js (the missions' goals, hints and rewards) and
// blockly.js (Blockly's own catalogue, and the game's overrides of it). Adding a
// language is its folder and one line here.
//
// `code` is the folder's name and the language tag the browser and Intl know it
// by; `name` is the language's name in itself, as the language choice shows it,
// never a flag. A regional variant names its `base`, and its folder holds only
// the messages it changes, for example Swiss German without ß:
//
//   { code: "de-CH", name: "Deutsch (Schweiz)", base: "de" },
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
];

// The language the game is written in: always bundled, and the words for any
// message another language doesn't have.
export const SOURCE = "en";
