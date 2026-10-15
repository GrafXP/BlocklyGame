# Phase 1 findings: the fixed-step world

Recorded 15 October 2026. The world lab is at `/world`.

## What's in place

- **The world** (`src/sim/`) is plain data: whole numbers, strings, arrays and objects. Robots and buildings are kept in order of id, as are deposits. Cells are indices into the map, `z × width + x`. `advanceWorld(world, commands)` moves it from tick T to T + 1 in the plan's six phases, documented in `world.js`, and returns the tick's trace. The trace isn't part of the world.
- **The clock** (`src/game.js`) turns frames into whole ticks: ten a second at 1×, with speeds 0.5×, 1×, 2× and 4×. At most 8 ticks catch up after a long frame; the rest of the time is dropped. Pause adds no ticks, Step exactly one. A hidden page pauses without making up the time, and goes on when shown again if it was running.
- **Navigation** is A* with whole-number costs, neighbours tried north, east, south, west, and ties broken the same way every time. Footprints block cells; interaction cells are listed per building and deposit. A completed bridge changes the map and the navigation revision. A robot under way finds its way again at its next cell, and one that had no way tries again.
- **Resources:** collecting, picking up, unloading and making reserve what they will take and the room for what they will leave when they start. They settle all at once when they end, and let go when cancelled. A robot cancelled between cells ends on the nearer, or on the one it left when halfway.
- **Waiting and stalls** are codes with values (`src/sim/codes.js`), worded by `src/ui/describe.js` in every language: “Needs 2 planks · Sawmill has 1”, “Kein Weg zu: Steinbruch”. A world where nothing is under way or growing back and someone waits reports a stall.
- **Replays:** `SIM_VERSION` 1. `npm run golden` records two scenarios, the island alone for 3000 ticks and with nine commands, into `test/golden/`. The tests check the world's hash every 100 ticks and the whole final world. The browser tests also check that Chromium's and WebKit's worlds hash the same as Node's for the same ticks.

## Decisions for later phases to know

- **Scripts stand in for programs.** An entity's `runtime` is `{ kind: "script", steps, loop, at }`, a list of intents carried out in order. The world only uses the runtime interface (`next`, `done`, `restart`, `finished`, in `src/sim/runtimes.js`), so Phase 2 adds compiled programs beside scripts without touching the tick phases.
- **Waiting order.** Intents that wait are tried again each tick in the order they began to wait, then the tick's new ones in order of entity id. Each takes what it can when its turn comes. One that waits doesn't stop a later one from taking something it can't use itself, such as one plank when it needs four. The plan's “FIFO queues” could also mean strict queues per resource, where a waiting intent blocks those behind it; that would change only `advanceWorld`'s phase 5.
- **Unloading** is all or nothing: it waits until the building has room for the whole basket.
- **Waits for a way** (“No way to the stone pit”) are only tried again when the ways change, as the plan says, not every tick.
- **A stall** is reported when nothing is under way, nothing grows back, and at least one entity waits. Entities whose scripts have ended don't prevent it; a world where everyone has simply finished isn't stalled.
- **Durations** (`src/sim/entities.js`, `recipes.js`): 3 ticks a cell, collecting 5, picking up and unloading 3, a plank 20, the bridge 40. A basket holds 2 items. These are tuning values; changing them changes the simulation, so it bumps `SIM_VERSION`.
- **The world lab keeps its world** while it's left and opened again, and after a change of language. It always opens paused.

## Not yet done

- Strict per-resource queues, if playtests show children are confused by a robot that waited first being overtaken.
- Messages (Phase 8) and objectives (Phase 7) have their place in the tick phases but nothing in them yet.
