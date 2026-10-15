# Robot Island

A browser game for children aged 7–9: Blockly programs run the robots and buildings of a small 3D island. See [PLAN.md](PLAN.md) for the design and the phases.

Phase 0 (foundation and compatibility) is in place: the app shell and the **editor lab** at `/lab`, which shows the Blockly editor over the 3D world. Its findings are in [docs/phase0.md](docs/phase0.md).

Phase 0.5 (languages) is in place: everything is in English and German, chosen from the browser's languages or by the player on the title page. Findings are in [docs/languages.md](docs/languages.md); the game's words in each language are in [docs/glossary.md](docs/glossary.md).

## Development

| Command | What it does |
| --- | --- |
| `npm install` | Installs the pinned dependencies |
| `npm run dev` | Development server |
| `npm run build` / `npm run preview` | Production build in `dist/`, and serving it |
| `npm test` | Node unit tests in `test/` |
| `npx playwright install chromium webkit` | Once: the browsers for the browser tests |
| `npm run e2e` | Browser tests in `e2e/` (Chromium, WebKit, WebKit as an iPad), against a fresh build |
| `npm run shots` | Screenshots and frame times for `docs/phase0/` and `docs/languages/`; `npm run shots -- languages` for some groups only |

Add `?dev` to a URL for the test hooks (`window.island`, `window.lab`). With it, `&lang=de` opens the game in a language whatever the browser's, and `&lang=pseudo` in the pseudo-language: English with every letter accented, padded by about 40% and in brackets. Plain letters on screen are text that didn't come from a catalogue; a missing `]` is text cut off.

## Languages

All text comes from catalogues in `src/i18n/`, one folder per language, listed in `src/i18n/languages.js`. English is the source: new text is written in `src/i18n/en/` and translated in the same change. Data never holds display text: blocks store ids (`grove`, `wood`), and the game's names for things are message references, worded when they're shown.

| File | What it holds |
| --- | --- |
| `ui.js` | The interface, with `{name}` placeholders and plural forms (`{ one, other }`) |
| `blocks.js` | The game's blocks, toolbox categories and dropdown choices, for `Blockly.Msg` |
| `blockly.js` | Which of Blockly's catalogues to load, and the game's overrides of it |

Blockly messages the game never shows (plugins it doesn't load, blocks no toolbox offers) are listed by feature in `src/i18n/blockly-unused.js` and may stay in English. Offering one of those blocks means taking its entry out and translating its messages.

### Adding a language

1. Copy `src/i18n/en/` to `src/i18n/<code>/` and translate it, using the [glossary](docs/glossary.md); add a column there. Point `load` in its `blockly.js` at `blockly/msg/<code>`.
2. Add one line to `src/i18n/languages.js`: `{ code: "<code>", name: "<its name in itself>" }`.
3. Run `npm test`. It names missing and extra messages, placeholder mismatches, missing plural forms, and Blockly messages the game shows that are still in English, which go into `overrides` in the new `blockly.js`.
4. Run `npm run e2e`, which opens the title page and the lab in every listed language and fails on cut-off text or a toolbox block too wide, and `npm run shots -- languages` to look at it.

A regional variant (`de-CH`) names its `base` in `languages.js`, and its folder holds all three files with only the messages it changes. Languages written right to left need more than this (PLAN.md §8).

## Versions

Tested with Node 24.14.1. Vite 8 needs Node `^20.19.0 || >=22.12.0`.

| Package | Version | Notes |
| --- | --- | --- |
| vite | 8.3.1 | as GyroRocket |
| three | 0.186.1 | as GyroRocket |
| blockly | 13.4.0 | media served from `/blockly-media/` (vite.config.js), never static.blockly.com |
| @playwright/test | 1.64.1 | Chromium and WebKit browsers |

npm also installs `jsdom` 29.1.1, as a peer dependency of Blockly; only Blockly's Node build uses it, and this project doesn't.
