# Phase 5 findings: the bridge slice

Recorded 15 October 2026. The mission is at `/play`, and the title page leads to it. Pictures are in [phase5/](phase5/), made by `npm run shots -- play`.

## What's in place

- **The slice** (`src/content/missions/slice.js`) is mission 15 of the campaign, “Across the Stream” ([campaign plan](campaign-plan.md)), played on its own. It starts on the island of Phases 3 and 4, set up as the mission card describes:
  - Robo 1 collects wood for the sawmill, and the sawmill makes planks. Both already work.
  - Robo 2 picks up planks and takes them to the depot, as in mission 14. The player changes its destination to the construction site.
  - The construction site has its start block, with “build bridge” lying below it, not attached. The editor marks the block “won't run”. The player attaches it.
  - Robo 3 waits at the camp with the stone carrier's program parked: not started, but there to see and edit. Applying a change to it starts Robo 3.

  Any programs that get the bridge built will do. The reference solution, those two changes made before the first step, builds it at step 241 (24 seconds at 1×); the mission allows 600. With the starter programs alone the planks go to the depot until it's full, and at step 1440 everything stalls.
- **Goals are part of the world** (`src/sim/objectives.js`).
  - `world.mission` holds the goals, each with the tick it was met, and the reward.
  - They're checked in the last phase of every tick, against work that has ended. The slice's goal, `built`, holds when the site's build action has finished, not when it starts.
  - When the last goal is met, the mission is done in that tick. Its reward, a list of the player's commands, is applied at the end of that tick: Robo 3's stone carrier starts, and it crosses the new bridge and brings stone to the depot.
  - The trace says which goals were met in a tick, and whether the mission was done. `checkWorld` checks that goals are of known types, met at ticks that have been, and that the mission is done exactly when its last goal was. `SIM_VERSION` is 4, and the golden replays have a third scenario: the slice, fixed after 50 and 120 steps, to the reward.
- **Parked programs** (`src/programming/runtime.js`). A robot or building can have a program without having started it. It takes no steps and counts as stopped, and its row has *Edit program* like any other. Applying the program starts it (the editor sends an `assign` after the `publish`), and so does a mission's reward; a `publish` alone, as when the mission starts again from its checkpoint, leaves it parked at the new version. Until then the editor says “Not started yet. Change it and apply, and it starts.”
- **A robot given a program starts with an empty basket** (`src/sim/commands.js`), as decided on 15 October 2026. Whether it's given another program or a new version of its own, what it carried is gone, so its program starts as it would at the beginning. Buildings keep their stock. Start again is different: it brings back the checkpoint, baskets as the mission gave them.
- **The overview holds still while the world runs** (`src/ui/overview.js`), so its buttons can be pressed. Each row is made once and only the parts whose words changed are drawn again, so no button is replaced under the pointer. A row that isn't chosen keeps one height: its lines are kept, empty or not, and each is one line, shortened with an ellipsis, the whole of it on hover. The chosen row's buttons come first, under its name. Its Doing and Where lines stay, with “nothing” or “–”, between actions. On the card, the line that shows the bridge being built keeps its place, unseen, until the building starts. A browser test steps the slice to the bridge's building and checks that every row and button stays where it was, and is the same button.
- **The mission card** (`src/ui/mission.js`) sits above the overview on the right ([play-start-en](phase5/play-start-en.jpg)):
  - the mission's title and its goal in one sentence;
  - four plank pictures and a bridge. Each plank fills in as one arrives at the site; one still to come is a dashed outline, so the two differ by shape as well as colour. Screen readers hear “Planks at the construction site: 2 of 4”;
  - “Building the bridge”, with its progress, while the site works ([play-building-en](phase5/play-building-en.jpg));
  - the hint ladder, one hint at a time, at no cost ([play-hints-en](phase5/play-hints-en.jpg)). *Look* chooses the construction site and has a *Show me* button that chooses it again. *Think* asks where Robo 2 takes the planks. *Try* says what to change;
  - the reward once it's done, with a tick ([play-done-en](phase5/play-done-en.jpg), [play-done-de](phase5/play-done-de.jpg)).
- **Checkpoints and Start again.** Each play keeps its checkpoint, the world at its start (`src/ui/session.js`). Start again goes back to it with every program as last applied and every draft kept (PLAN.md §9); the tests check that this is exactly a fresh world with those programs. Each program's editor still has *Starter program*.
- **Saving** (`src/storage/saves.js`). The mission is saved on the device as it's played, and a reload goes on from the very same step, paused.
  - **The envelope.** A save is one versioned envelope: the save's schema, `SIM_VERSION`, `COMPILER_VERSION`, the mission and its content's version, the world, the program library, the checkpoint, and which missions have been done.
  - **What the library keeps.** Only the revisions the world or the checkpoint run, and each program's newest. A newer revision than the world runs is an Apply waiting for the next step; it waits again after the reload.
  - **When it saves.** While the world runs, every 2 seconds. Otherwise as soon as something changes: a step, an Apply, a draft, the mission done. Also when the page is hidden, left or closed. The editor's draft is saved into the library first.
  - **Reading it back.** Every part is checked before any is used: the versions must be the game's own, the world and checkpoint must keep the world's rules, and every program the world runs must be what its blocks compile to now (PLAN.md §10). A save that fails any check is let go whole, the mission starts afresh, and the card says so. If the device won't keep the game, the card says that too.
- **Two kinds of play** (`src/ui/session.js`). The island page and the world lab show the free island of Phases 3 and 4, kept for the visit only, as before. `/play` shows the mission. They have separate worlds and libraries: their courier programs differ at revision 1, so the debugger reads block sources per library.
- **The title page** leads with the mission. When it's saved, the page says how far it got (“Saved at step 75.”, or “Done!”) and offers *Start over…*, which asks first and then forgets the saved game and every change to its programs: for the next child at a playtest ([home-start-over-en](phase5/home-start-over-en.jpg)).
- **Words.** Each language has a fourth catalogue, `missions.js`, keyed by mission: title, goal, progress, the three hints and the reward. The language tests cover it like the others. German calls a mission *Auftrag*, a hint *Tipp* (glossary).

## The playtest

The slice is ready for the first supervised playtest (PLAN.md §13: go/no-go for the remaining scope). Its question, from the campaign's gate after mission 15: *can the child identify which worker is waiting, and who supplies it?*

- Reset between children on the title page: *Start over…*, then *Start over*.
- The world opens paused. Children may fix the programs before pressing Run, or watch first ([play-depot-en](phase5/play-depot-en.jpg)): the planks pile up at the depot, and the site's row says *Stopped*.
- Fixing only the courier makes the site's planks fill to four, with Robo 2 waiting: “No room for 2 planks · Construction site has room for 0”. Fixing only the site makes it wait: “Needs 4 planks · Construction site has 0”. Either is the diagnosis the slice is for. With both fixed, the site still waits for Robo 2's second trip, with every program's marker in view ([play-waiting-en](phase5/play-waiting-en.jpg)).
- Watch whether children change programs while the world runs, and whether they use the card's *Start again* afterwards.

## Decisions for later phases to know

- **Why baskets are emptied.** Kept, a courier given a new program while it carried two planks would start by picking up two more: it would wait for room in its own basket for ever, and the bridge would never come. Emptying the basket costs those planks, which the chain makes again. Missions that count deliveries (chapter 6) should still begin paused with empty baskets, as mission 23's card says.
- **After a change mid-run, the card offers Start again** ([play-again-en](phase5/play-again-en.jpg)). The changed program starts from its start while the rest of the island has moved on; from the checkpoint the change is watched from the beginning. An Apply before the first step needs no such offer.
- **Robo 3's program is parked, not missing.** Phase 6's bindings (PLAN.md §5) can grow from this: a robot that has a program, started or not, apart from the runtime that runs it.
- **Saves live in localStorage until Phase 9.** A save is about 26 KB. localStorage writes synchronously, so a save made on `pagehide` lands. Phase 9 moves saves to IndexedDB, with a previous save to fall back on, migrations, and export. Until then a save from another version is let go, not migrated (PLAN.md §11, Phase 5).
- **An Apply waiting for the next step isn't saved as a command.** It's whatever the library's newest revision is ahead of the world's, published again on load. Applying twice before a step leaves the same world as applying the second alone.
- **The checkpoint is a saved world, not the mission's content.** Phase 7's missions start from the settlement as earlier missions left it, so their checkpoints can't be rebuilt from content either.
- **A reward is commands in the world's mission.** They're applied at the end of the tick the mission is done: the boundary before the next tick, where commands always apply. Replays and the reference runs therefore give the reward without the interface.
- **Done once is done.** Which missions have been done is kept in the save, apart from the world, so *Start again* (whose world isn't done yet) doesn't lose it.
- **The hints are fixed text** for the slice, in order. Phase 7 makes them answer the problem in view.
- **`/play` has one mission.** Phase 7 replaces it with the campaign's missions, each with its own save, from the same session and card.

## Not yet done

- The playtest itself, with children, in English and German.
- The prediction before Run and the explanation after success, read-aloud, and “Show me a start” (Phase 7, Phase 10).
- Export and import of saves, recovering a previous save, and asking the browser to keep storage (Phase 9).
- A real iPad ([play-ipad](phase5/play-ipad.jpg) is WebKit at iPad size).
