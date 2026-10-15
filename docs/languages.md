# Phase 0.5 findings: languages

Recorded 15 October 2026. Pictures are in [languages/](languages/), made by `npm run shots -- languages`. How to add a language is in the [README](../README.md#adding-a-language); the shared words are in the [glossary](glossary.md).

## What's in place

- **Catalogues:** `src/i18n/<code>/` holds `ui.js`, `blocks.js` and `blockly.js` for each language, listed in `src/i18n/languages.js`. English is bundled. German and its Blockly catalogue are fetched when chosen, about 24 kB compressed together. A regional variant is a folder holding only the messages it changes.
- **Messages:** `t()` fills `{name}` placeholders, picks plural forms with `Intl.PluralRules`, and writes numbers with `Intl.NumberFormat` (German: 1.234 Bytes, 60 %). A message a language doesn't have is shown in English. Names the game gives things are message references (`ref("entity.robo", { n: 1 })`), worded when shown.
- **Choosing:** the language comes from the player's choice on this device (localStorage), else the browser's languages (`de-AT` gives German), else English. The title page and the lab show each language under its own name, with its own `lang` attribute. `<html lang>` and the document title follow the language.
- **Switching** reopens the current page. The lab hands its program, marker step, camera and selection to the reopened page, and saves the program at once rather than when its 400 ms timer would have. Blockly's editors are made again from their JSON.
- **Pseudo-language:** `?dev&lang=pseudo` gives English with every letter accented, padded by about 40% and bracketed, Blockly's words included.

## Blockly's German

Blockly 13.4.0's catalogues have 701 messages. German leaves 344 of them identical to English: 326 marked untranslated, plus hues, empty strings and words like “sin”. (PLAN.md's earlier figure of 285 of 629 was not reproducible; it's corrected there.) Where those 344 are read:

| Read by | Messages | Same as English in German | What the game does |
| --- | --- | --- | --- |
| Blockly's core (menus, keyboard navigation, screen-reader labels and announcements) | 188 | 148 | All 148 translated in `src/i18n/de/blockly.js` |
| Only Blockly's blocks | 424 | 129 | The 9 read by the four built-in blocks the toolbox offers (repeat, if, compare, number) are translated; the rest are on the allowlist |
| Nothing in core or blocks (plugins: backpack, search, minimap, extra fields) | 89 | 67 | On the allowlist |

The allowlist, `src/i18n/blockly-unused.js`, names features rather than one language's gaps, so it holds for any language. `npm test` checks it against the installed Blockly: no plugin message is read anywhere, no unused block's message is read by core, and no block the toolbox offers reads an allowlisted message. In dev builds, every read of `Blockly.Msg` is recorded. A browser test drives the editor in German (toolbox, dropdowns, both context menus, the if block's own editor, tooltips, keyboard navigation) and checks that all 95 messages it reads are German and none is allowlisted.

PLAN.md named “Move Block” as visible; Blockly 13.4.0's core doesn't read it, so it belongs to the keyboard-navigation plugin and is allowlisted.

### A gap in Blockly itself

Blockly 13.4.0 writes keyboard shortcuts next to menu items and in a screen-reader hint (“Rückgängig  Control + Z”, “Drücke Alt + Shift + A …”). It looks up most key names when it writes them, so “Entf” and “Eingabe” come out German. But it fixes the names of Control and Alt when it loads, before any language is set, and doesn't translate Shift at all (`core/utils/shortcut_formatting`). Those three stay English in every language. On Apple devices they appear as ⌘, ⌥ and “Shift”. The pseudo-language test lets exactly these through, and only inside a shortcut.

Options, not yet decided: report it to Blockly; or remove `associatedKeyboardShortcut` from the context-menu items, which hides the hints. That would not change the screen-reader hint.

## German and the layout

- **Calm still fits German.** The widest toolbox block is 217 px in German against 191 px in English (“Bretter bei Sägewerk”, the stock sensor); “wiederhole fortlaufend” is 192 px. The browser test allows 240 px in Calm and Bold, in every listed language. See [calm-toolbox-control-de](languages/calm-toolbox-control-de.jpg), [calm-day-de](languages/calm-day-de.jpg), [ipad-calm-day-de](languages/ipad-calm-day-de.jpg).
- **Lab controls:** the labels' column takes the width of the longest label, and the panel grows with the words up to 420 px, then wraps. It is wider in German than in English; on an iPad it then covers the rocks, which the German browser test works around by folding the controls.
- **Pseudo-language:** at +40% everything still fits; the Style choice wraps onto two lines ([lab-pseudo](languages/lab-pseudo.jpg)). No text on the title page or in the lab is left unmarked, including Blockly's menus, tooltips and screen-reader labels, apart from the modifier keys above.

## Not yet done

- A fluent German speaker reviews the German before the first playtest (PLAN.md §8). Doubtful choices to look at: “Fühlen” for Sensing (as in Scratch), “Camp”, “%1 bei %2” for stock at a place, and the screen-reader wording in `de/blockly.js`.
- Whether the game's name is translated (glossary).
- Real-iPad checks of the German layout, with the rest of Phase 0's real-device checks.
