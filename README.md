# BlocklyBots

A browser game for children aged 7–9: Blockly programs run the robots and buildings of a small 3D island. See [PLAN.md](PLAN.md) for the design and the phases.

Phase 0 (foundation and compatibility) is in place: the app shell and the **editor lab** at `/lab`, which shows the Blockly editor over the 3D world. Its findings are in [docs/phase0.md](docs/phase0.md).

Phase 0.5 (languages) is in place: everything is in English and German, chosen from the browser's languages or by the player on the title page. Findings are in [docs/languages.md](docs/languages.md); the game's words in each language are in [docs/glossary.md](docs/glossary.md).

Phase 1 (the fixed-step world) is in place: the simulation in `src/sim/`, its clock in `src/game.js`, and the **world lab** at `/world`, with Run, Pause and Step on one clock. Findings are in [docs/phase1.md](docs/phase1.md).

Phase 2 (the program compiler and runtime) is in place: Blockly's JSON compiled to the game's own instructions in `src/programming/`, without Blockly, and run one visible block a tick by every robot and building. The world lab's island runs starter programs and shows the block each entity is at; the editor lab marks what can't work in a program at its block. Findings are in [docs/phase2.md](docs/phase2.md).

Phase 3 (the selectable 3D island) is in place: the **island** at `/island`, drawn from the world, where robots and buildings running their programs can be watched from any side, chosen by tapping them or their labels, and inspected. It shares its world with the world lab. Findings are in [docs/phase3.md](docs/phase3.md).

Phase 4 (Blockly editing and the world-wide debugger) is in place on the island: an overview of every robot and building with the block it's at, the editor over the world with toolboxes for what each can do and Apply at the next step, **All programs** with everyone's markers, and **Next block**. Findings are in [docs/phase4.md](docs/phase4.md).

Phase 5 (the bridge slice) is in place: the first mission, **Across the Stream**, at `/play` and first on the title page. Four programs (a wood collector, the sawmill, a plank courier and the construction site) have to work together to build the bridge; two of them need changing first. A mission card shows the goal, the planks arriving, three hints and the reward. Start again goes back to the mission's start, keeping the programs, and the mission is saved on the device as it's played, so a reload goes on where it was. *Start over…* on the title page forgets it, for the next player. Findings, and notes for the first playtest, are in [docs/phase5.md](docs/phase5.md).

Phase 6 (shared roles, type defaults and placement) is in place on the island: robots on a **team** share its program, buildings of a kind share theirs, and any robot or building can have its own; choosing one opens its flyout beside the list, whose **Edit program** opens its program, or a new one, and which makes its own copy and goes back to the shared one, changes a robot's team, renames it and sets its **settings**, which the new *my source*, *my item* and *my destination* blocks read in an action's gap. Every change of program names, before it's made, each robot it will start again, and so does Apply. The editor's **Versions** shows a program's history as a tree, to put an older version back into the draft. **Programs** in the bar is the program library. **Build** places a workshop where it fits, without cutting anyone off; robots bring its planks and stone, its site builds it, and it makes kits. Findings are in [docs/phase6.md](docs/phase6.md).

Phase 7 (the main campaign and free play) is in place: **Play** on the title page starts the campaign's twenty-five missions in five chapters, on one island that grows mission by mission: the sawmill, the depot, the bridge, and at last the workshop's first kits. Every mission stands alone, from its own start with its own programs; once it's done, the next starts afresh. Each mission's toolbox offers only the blocks learned so far. A mission begins with a big briefing and ends with a win, fireworks and a big *Next mission* button. Its card shows the goal with pictures, asks for a prediction before Run and an explanation after success, offers hints that answer the problem in view, a start or the whole program in the editor, and in missions 16–19 two trials one after the other. Missions done can be played again from the title page. **Free play** opens after mission 15, with programs of its own, and grows into the **sandbox** after mission 25. `npm run verify:missions` plays every mission's reference solution from its start. Phase 5's slice is at `/slice`. Findings are in [docs/phase7.md](docs/phase7.md).

Phase 8 (memory, blocks of one's own and messages) is in place: missions 26–40 go on with **variables** that each robot remembers for itself, shown beside it as it runs; **blocks of one's own** (“my block bring wood”) with one input, which the debugger follows in and out of; and **messages** from one program to another, waited for and shown in the inbox. The campaign ends with four kits for the island's celebration. Findings are in [docs/phase8.md](docs/phase8.md).

## Development

| Command | What it does |
| --- | --- |
| `npm install` | Installs the pinned dependencies |
| `npm run dev` | Development server |
| `npm run build` / `npm run preview` | Production build in `dist/`, and serving it. `dist/` holds an Apache `.htaccess` (from `public/`): every address is the game, with a strict CSP and long caching for hashed files. Serve it from the root of a domain or subdomain. |
| `npm test` | Node unit tests in `test/`, `verify:missions` among them |
| `npm run verify:missions` | Plays every mission's reference solution from its start, and checks its starters, steps, toolbox, budget, room and words (`scripts/verify-missions.js`) |
| `npm run golden` | Records the golden replays in `test/golden/` again (the island, the island with commands, the bridge slice, the island with teams, settings, copies and a workshop, and the campaign played through by its reference solutions), after a deliberate change to the simulation and a new `SIM_VERSION` |
| `npx playwright install chromium webkit` | Once: the browsers for the browser tests |
| `npm run e2e` | Browser tests in `e2e/` (Chromium, WebKit, WebKit as an iPad), against a fresh build |
| `npm run shots` | Screenshots and frame times for `docs/phase0/`, `docs/languages/`, `docs/phase2/`, `docs/phase3/`, `docs/phase4/`, `docs/phase5/`, `docs/phase6/` and `docs/phase7/`; `npm run shots -- campaign` for some groups only |

Add `?dev` to a URL for the test hooks (`window.island`, `window.lab`, `window.world`, `window.islandPage`, which `/play`, `/replay`, `/free` and `/slice` have too) and the island's graphics counters. With it, `&lang=de` opens the game in a language whatever the browser's, and `&lang=pseudo` in the pseudo-language: English with every letter accented, padded by about 40% and in brackets. Plain letters on screen are text that didn't come from a catalogue; a missing `]` is text cut off.

## Languages

All text comes from catalogues in `src/i18n/`, one folder per language, listed in `src/i18n/languages.js`. English is the source: new text is written in `src/i18n/en/` and translated in the same change. Data never holds display text: blocks store ids (`grove`, `wood`), and the game's names for things are message references, worded when they're shown.

| File | What it holds |
| --- | --- |
| `ui.js` | The interface, with `{name}` placeholders and plural forms (`{ one, other }`) |
| `blocks.js` | The game's blocks, toolbox categories and dropdown choices, for `Blockly.Msg` |
| `missions.js` | Each mission's title, goal, what's new, prediction, explanation, three hints, trials, problems and reward, keyed by mission |
| `blockly.js` | Which of Blockly's catalogues to load, and the game's overrides of it |

Blockly messages the game never shows (plugins it doesn't load, blocks no toolbox offers) are listed by feature in `src/i18n/blockly-unused.js` and may stay in English. Offering one of those blocks means taking its entry out and translating its messages.

### Adding a language

1. Copy `src/i18n/en/` to `src/i18n/<code>/` and translate it, using the [glossary](docs/glossary.md); add a column there. Point `load` in its `blockly.js` at `blockly/msg/<code>`.
2. Add one line to `src/i18n/languages.js`: `{ code: "<code>", name: "<its name in itself>" }`.
3. Run `npm test`. It names missing and extra messages, placeholder mismatches, missing plural forms, and Blockly messages the game shows that are still in English, which go into `overrides` in the new `blockly.js`.
4. Run `npm run e2e`, which opens the title page and the lab in every listed language and fails on cut-off text or a toolbox block too wide, and `npm run shots -- languages` to look at it.

A regional variant (`de-CH`) names its `base` in `languages.js`, and its folder holds all four files with only the messages it changes. Languages written right to left need more than this (PLAN.md §8).

## Versions

Tested with Node 24.14.1. Vite 8 needs Node `^20.19.0 || >=22.12.0`.

| Package | Version | Notes |
| --- | --- | --- |
| vite | 8.3.1 | as GyroRocket |
| three | 0.186.1 | as GyroRocket |
| blockly | 13.4.0 | media served from `/blockly-media/` (vite.config.js), never static.blockly.com |
| @playwright/test | 1.64.1 | Chromium and WebKit browsers |

npm also installs `jsdom` 29.1.1, as a peer dependency of Blockly; only Blockly's Node build uses it, and this project doesn't.
