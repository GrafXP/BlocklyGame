# Phase 7 findings: the main campaign and free play

Recorded 16 October 2026. The campaign is at `/play`, and the title page leads to it; free play and the sandbox are at `/free`, a mission played again at `/replay?mission=m03`. Phase 5's bridge slice moved to `/slice`. Pictures are in [phase7/](phase7/), made by `npm run shots -- campaign`.

## What's in place

- **Twenty-five missions in five chapters** (`src/content/missions/chapter1.js` to `chapter5.js`), as the [campaign plan](campaign-plan.md) describes them, each with its authoring package: its setup, the blocks it unlocks, its goals or trials, starter programs, three hints and the problems they answer, a prediction to ask for, a “Show me a start” for the chapter projects, a reference solution, a budget of raw materials and a bound on its steps. `campaign.js` describes a mission and numbers them; `src/campaign.js` builds their worlds. Their words are in each language's `missions.js`: title, goal, what's new, the prediction, the explanation, the hints, each trial and each problem, and the reward.
- **One island that grows** (`src/content/missions/island.js`). Mission 1 has Robo 1, the camp and the grove. The sawmill arrives with mission 11, the depot with 12, Robo 2 with 14, the construction site, the stone pit and Robo 3 with 15, and the workshop with 25. Each mission begins on the island as the one before left it: the bridge stays built, and names and settings carry on (mission 23 keeps mission 22's settings). Its resources start afresh, every building empty and every deposit full (decided 17 October 2026, below).
- **Setups that show what they change** (`src/sim/staging.js`). A mission's setup stops everything, gives out the mission's programs, and changes only what the lesson needs: things that arrive, the robots it's about at their places with their baskets (every other robot's empty), staged stock, room made in a store, teams, settings left unchosen or filled in where nothing is chosen yet. The card says it in a sentence (“Robo 1 is at the grove with one piece of wood in its basket”). The clock starts from step 0 again.
- **Goals that count completed work** (`src/sim/objectives.js`). The world keeps a tally of the trial's finished unloads, by building, item and robot, of what buildings made, and of how long a robot waited at a building to pick something up. Goals read it, never a program's blocks:
  - `delivered` (items into a building, of an item or any, by a robot or anyone, only in full baskets with `load: 2`), `trips`, `made`, `holds`, `reached`, `built`, and `steady`, which holds a count for a while once another robot has finished (mission 20: the settled cycle, not the instant the reserve is back);
  - an `exact` order is judged once the work is over, when the robot or building it's about, or everyone, has stopped; one too many fails it for the trial, so an extra delivery under way can't pass unnoticed;
  - `noWait` fails a goal when its robot waited at a building to pick up (mission 19: “set off only once both planks are ready”);
  - a failed goal says so on the card, with Start again.
- **Trials** (missions 16–19). Each trial is a starting variation with its own goals. When one is passed, the next is staged at the end of that tick, every program starting again from its start, and the clock pauses there: the card says “Trial 1 passed! Next: Two planks at the sawmill. Press Run.” ([m16-trial-en](phase7/m16-trial-en.jpg), [m16-trial-de](phase7/m16-trial-de.jpg)). Next block stops at a trial passed too. Start again goes back to the first trial.
- **Unlocks** (`src/blockly/toolboxes.js`). A mission's toolboxes offer only the blocks it and the missions before it unlocked, of those the robot or building can use: mission 1's is “go to” alone ([m01-editor-en](phase7/m01-editor-en.jpg)), Repeat comes with 6, Make with 11, Forever with 14, the stock sensor with 16, If with 17, its Else with 18, Wait Until with 19, the setting blocks with 22. Every mission program's start block can't be deleted, so no toolbox needs one. Programs, the library of every program, is there in every mission, and a chosen robot or building offers every program it can run (decided 17 October 2026, below); the missions about them come with 21 (teams) and 22 (settings, which open then).
- **The mission card** (`src/ui/mission.js`):
  - chapter and number, the goal, what's new, and each goal with pictures and how far it has got, its notes (“Exactly this many, then the job stops.”);
  - the trials, passed, under way and to come;
  - a prediction before Run, said aloud or by pointing at something on the island, or skipped ([m01-guess-en](phase7/m01-guess-en.jpg)); and after success, something to tell someone ([m01-done-en](phase7/m01-done-en.jpg));
  - “Open the program” for the program the mission is about;
  - the hint ladder, answering the problem in view: with a full basket in mission 8, Look chooses Robo 1 and Think asks “The basket is full. What must happen before another collection?” ([m08-full-en](phase7/m08-full-en.jpg)). A program stopped with an error gets its own Look. When everything has stalled or stopped short of the goal, the card says a hint can help and the Hint button glows, without interrupting;
  - the Try hint offers “Show me a start” in the chapter projects and “Show me the whole program” everywhere, which put the blocks into the editor's draft, to apply or change ([m05-hints-en](phase7/m05-hints-en.jpg));
  - after the reward, “Next mission”, which begins it on the island as it is.
- **Starting from nothing.** Chapter projects (missions 5, 10, 15, 20, 25) and free play add *Start from nothing* to the editor: the start block alone, with *Undo changes* to bring the blocks back.
- **The mission map and playing a mission again** ([home-missions-de](phase7/home-missions-de.jpg), [replay-en](phase7/replay-en.jpg)). The title page is a game's menu: a big button to go on with the campaign, and below it the mission map, a card for each chapter in a colour of its own with its missions as tiles: a star on each done, “You're here” glowing on the one the campaign is at, a padlock on the rest (changed 17 October 2026, after a playtest; the prototypes are folded away underneath). A mission done can be played again on its own, from its checkpoint as the setups before it build it, with a copy of the player's library. The campaign's island and programs don't change. With `?dev`, every mission opens that way.
- **Free play** opens after mission 15 ([free-en](phase7/free-en.jpg)): the island with its three teams at work, the bridge built, the blocks learned so far and the program library, holding every program the player wrote in the missions. Settings come once mission 22 is done. After mission 25 it grows into the **sandbox** ([sandbox-en](phase7/sandbox-en.jpg)): *Build* places workshops, *Add a robot* brings up to twelve, each building's and deposit's supplies go up and down one at a time, and *New island…* starts the island again laid out as the player chooses (robots, supplies, the bridge built or still to build, the workshop built or not), keeping the programs.
- **Saves** (`src/storage/saves.js`, schema 2). The campaign, a replay and free play are each saved on the device as they're played, like the slice, and go on where they were after a reload. A save names its content and its mission apart. The campaign's at mission 25 is about 150 KB, with 39 programs. *Start over…* on the title page forgets all three.
- **`npm run verify:missions`** (`scripts/verify-missions.js`, also part of `npm test`). For every mission, alone from its checkpoint and as part of the whole sequence: its starters alone don't do it; its reference solution does, every trial, within its steps, the world keeping its rules after every tick, taking no more raw materials than its budget; its reference and the starters it changes use only unlocked blocks; its goals' stores have room for what they count; the deposits hold its budget; and its words are in every language. The reference runs alone and in sequence:

  | Mission | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Steps (sequence) | 25 | 6 | 28 | 57 | 62 | 47 | 172 | 125 | 131 | 173 | 21 | 97 | 91 |
  | Bound | 150 | 60 | 120 | 200 | 200 | 120 | 400 | 400 | 400 | 500 | 60 | 300 | 300 |

  | Mission | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Steps (sequence) | 276 | 241 | 130 | 24 | 138 | 334 | 364 | 316 | 310 | 152 | 197 | 273 |
  | Bound | 900 | 600 | 400 | 200 | 400 | 700 | 1200 | 800 | 800 | 600 | 900 | 900 |

  Beside it, `test/campaign.test.js` plays each lesson's deliberate mistake and checks it fails the way the lesson says (Collect before Go To stops Robo 1; a number in mission 16's Repeat passes one trial only; Make outside the If makes one too many; setting off early in mission 19 fails though both planks arrive; taking Forever out of the shared program stops Robo 1 too), and a golden file (`test/golden/campaign/sequence.json`) holds the step and the world's hash at the end of every mission played in sequence.
- **Fixed on the way.**
  - *A robot keeps what it was given.* Phase 5 empties a robot's basket when it's given a program, so a restarted program doesn't begin with a load it picked up. Mission 3 starts Robo 1 with the wood from mission 2, and applying its program emptied it. Now only a robot that has taken a step of its program is emptied (`src/sim/bindings.js`).
  - *A missing setting can be chosen afterwards.* A robot stopped with “Choose a setting first” goes on, from that block, once the setting is chosen; so does one stopped because its item setting couldn't be collected, once the item changes.
  - *Found in review* (each with a test now):
    - The world's clock moves to the new tick before the goals are checked. A trial staged, or a reward given, at the end of a tick cancelled a move started in that tick as if it were one tick earlier, leaving the robot on no cell.
    - A replay after a reload, of a mission whose program the player later changed to name a newer place, couldn't fall back to the starter, which the save had pruned; now the starter runs, as a revision of the replay's own library.
    - Free play's layouts gave the Plank team's program different blocks under the same id, so a new sandbox island with the bridge changed ran blocks its library didn't have, and its save was let go. Both couriers are programs of their own now.
    - A robot added in the sandbox runs its type's program when one is set.
- **Versions.** `SIM_VERSION` is 6; the golden replays were recorded again. The slice's content keeps version 2; its saves, of schema 1, are let go.

## The playtest gates

PLAN.md asks for playtests after missions 5, 10 and 15, and 20 and 25 (docs/campaign-plan.md, Playtest gates). They need children, so they're still to come; what's needed for them is in place:

- *Start over…* on the title page, for the next child; the campaign saved as it's played, so a session can stop after any mission.
- Missions played again from the title page, to return to an idea.
- `?dev` opens every mission on the title page's map, played on its own; a seeded save (`e2e/campaign-seed.js` shows how) puts the campaign itself at any mission.

What to watch at each gate is in the campaign plan's table. Worth noting too: whether children use the prediction or skip it, whether they find “Open the program”, and whether the glowing Hint button is noticed or ignored.

## Decisions for later phases to know

- **Every mission's programs are its own.** A mission's starters join the library under ids of their own (`m03`, `m13-mill`), named “Mission 3: Robo 1”, so the child's work in each mission stays in the library, and free play offers it. Who runs what is the setup's alone when a mission begins: teams and type programs are reset to the mission's. Names, settings and the bridge carry on.
- **The island carries over; its resources don't.** Decided 17 October 2026, after a playtest: when a mission begins, every building's store is emptied and every deposit filled again, as the island's catalogue starts them (`restock` in `src/sim/staging.js`), so the camp no longer piles up what earlier missions brought. A lesson stages what it needs on top. “Alone” means the setups of every mission so far made one after another with nothing played between. Verification checks both that and the real sequence, so a lesson can't depend on leftovers. A setup's `room` no longer changes anything in the campaign, but still says what a lesson needs.
- **Trials are in the world**, so replays, saves and the reference runs need nothing else. An Apply after a trial was passed doesn't send the mission back to the first trial; the card offers Start again, as after any change mid-run. Start again doesn't carry a trial's own programs (mission 19's late sawmill) back to the first.
- **Replays use the setups and a copy of the current library**, not the library as it was when the mission was first played (PLAN.md §9 says the latter). Keeping a library for every checkpoint would have cost about 150 KB per mission in localStorage; Phase 9's IndexedDB can afford it. Since each mission's programs are its own, the copy holds the child's own solution unless they changed it later. A program changed later to name a place the earlier island hasn't got runs its newest revision that still fits, down to its starter.
- **Mission 19 judges how, not only what.** Picking up already waits for a missing plank, so “both planks delivered together” would pass without Wait Until. The goal also fails if Robo 2 ever waits at the sawmill: that is the lesson's observable outcome, not a block it must contain.
- **Wait N Steps stays out of the missions.** Mission 19's second trial makes the sawmill start later with a helper program that uses it; no child's toolbox offers it. Free play offers the blocks learned in the missions.
- **Free play is not the child's settlement.** It's the island laid out afresh, with the teams and starters of Phase 6, so it's always lively. The sandbox's layouts make it again; its programs stay. Every layout has the same programs with the same blocks, and differs only in who runs which: a program's revision is the same blocks wherever it's used.
- **Every program can be opened in every mission.** Decided 17 October 2026, after a playtest of mission 16, where the sawmill has no job and its programs were out of reach: every campaign mission offers the program library (`rules` in `src/ui/session.js`), so Programs lists every program to edit or give, and a chosen robot or building offers every program it can run. Mission definitions still name the tools a lesson is about (`library` from mission 21, `settings` from 22); settings stay until mission 22. The grove and the stone pit are deposits, which never run a program; the inspector says so.
- **Card state is per mission and per visit**: the hints shown, the guess, the explanation. A reload starts the card afresh; the world and programs are saved.

## Not yet done

- The playtests themselves, at the five gates, in English and German.
- A fluent speaker's review of the German mission text, hints and goal labels.
- Spoken instructions, sounds and reduced motion (Phase 10). The card's Hint glow follows `prefers-reduced-motion`.
- Optional experiments and variations after a mission's main goal.
- Offering a hint after repeated unchanged runs: the card offers one when everything has stopped or stalled, not yet after runs that change nothing.
- The library saved with each checkpoint, for replays (above), and the whole command queue in saves (Phase 9).
- A real iPad ([m16-ipad](phase7/m16-ipad.jpg) is WebKit at iPad size). On it, the card scrolls once the hints are open; the overview below it gets less room.
