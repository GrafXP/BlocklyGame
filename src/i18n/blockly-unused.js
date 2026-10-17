// Blockly's messages that the game never shows or announces, so a language may
// leave them in English (PLAN.md §8, German). Every other Blockly message the
// game uses is translated, by Blockly's catalogue for the language or by the
// language's blockly.js; npm test names any that are neither.
//
// Each entry is a Blockly feature the game doesn't use, with the messages that
// belong to it:
//
// - "plugin": a feature Blockly ships as a separate plugin, which the game
//   doesn't load. No code in Blockly's core or its blocks reads these messages
//   (npm test checks, against the installed Blockly).
// - "blocks": Blockly's own blocks that no toolbox offers. Only those blocks read
//   these messages (npm test checks that Blockly's core doesn't), and the browser
//   tests check that the editor reads none of them. Offering one of these blocks
//   means taking its entry out of here and translating its messages.
export const UNUSED_BLOCKLY = [
  { feature: "backpack", kind: "plugin", keys: /BACKPACK/ },
  { feature: "workspace and toolbox search", kind: "plugin", keys: /^(WORKSPACE|TOOLBOX)_SEARCH_/ },
  { feature: "minimap", kind: "plugin", keys: /^MINIMAP_/ },
  { feature: "angle, bitmap, colour, date and grid fields", kind: "plugin", keys: /^(ARIA_(LABEL|TYPE)_FIELD_(ANGLE|BITMAP|COLOUR|DATE|GRID)|FIELD_BITMAP_|TODAY$)/ },
  { feature: "multiline text field", kind: "plugin", keys: /^FIELD_MULTILINEINPUT_/ },
  { feature: "plus and minus buttons on blocks", kind: "plugin", keys: /^ARIA_LABEL_(ADD|REMOVE)_/ },
  { feature: "keyboard shortcuts help", kind: "plugin", keys: /^(SHORTCUTS_(CODE_NAVIGATION|EDITING|GENERAL)|CHROME_OS|LINUX|MAC_OS|WINDOWS|OPTION_KEY)$/ },
  { feature: "keyboard navigation plugin", kind: "plugin", keys: /^(MOVE_BLOCK|EDIT_BLOCK_CONTENTS|ZOOM_TO_FIT_ARIA_LABEL)$/ },
  { feature: "colour blocks", kind: "plugin", keys: /^COLOUR_/ },
  { feature: "typed variables", kind: "plugin", keys: /^NEW_VARIABLE_TYPE_TITLE$/ },

  { feature: "while, count, for-each and break blocks", kind: "blocks", keys: /^(CONTROLS_(WHILEUNTIL|FOR|FOREACH|FLOW_STATEMENTS)_|INPUT_LABEL_(CONDITION|LOOP_(BY|FROM|LIST|TO))$)/ },
  { feature: "true, false, not, and, or, null and test blocks", kind: "blocks", keys: /^(LOGIC_(BOOLEAN|NEGATE|NULL|OPERATION|TERNARY)|INPUT_LABEL_CONDITION_[AB]$)/ },
  { feature: "maths blocks other than numbers and Change", kind: "blocks", keys: /^(MATH_(?!NUMBER_|CHANGE_)|INPUT_LABEL_(MATH|NUMBER))/ },
  { feature: "text blocks", kind: "blocks", keys: /^(TEXT|INPUT_LABEL_TEXT)_/ },
  { feature: "list blocks", kind: "blocks", keys: /^((LISTS|INPUT_LABEL_LISTS)_|ORDINAL_NUMBER_SUFFIX$)/ },
  // Variables and blocks of the player's own are offered (PLAN.md §7, Phase 8),
  // but not those that give back a value. Blockly's core names a new procedure
  // with DEFRETURN_PROCEDURE, left out here.
  { feature: "procedure blocks that return a value", kind: "blocks", keys: /^PROCEDURES_(DEFRETURN_(?!PROCEDURE$)|CALLRETURN_|IFRETURN_)/ },
];

// Messages that aren't words: the addresses of Blockly's help pages, and the
// hues of its default block colours.
export const NOT_WORDS = /_(HELPURL|HUE)$/;

// Whether Blockly message `key` may stay in English in any language.
export const mayStayEnglish = (key) => NOT_WORDS.test(key) || UNUSED_BLOCKLY.some(({ keys }) => keys.test(key));
