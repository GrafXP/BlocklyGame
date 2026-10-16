# Phase 6 findings: teams, settings, copies, and the workshop

Recorded 16 October 2026. Phase 6's tools are on the free island at `/island`; the bridge slice at `/play` offers none of them, since mission 15 comes before chapter 5 teaches them. Pictures are in [phase6/](phase6/), made by `npm run shots -- library`.

## What's in place

- **Who runs what** (`src/sim/bindings.js`). Programs are shared by naming them, never by copying them into each robot, so one Apply reaches everyone that runs a program. A robot or building runs, in this order (PLAN.md §5):
  1. its **own** program, given to it alone;
  2. its **team's**: a team (the plan's *role*) is a named group of robots with one program, such as the *Wood team*;
  3. its **type's**: one program for every building of a kind, such as every sawmill.

  All three are world state, changed only by commands at a tick boundary, so replays and saves hold them. The island has three teams (Wood, Plank and Stone, one robot each to begin with) and programs for every sawmill and every workshop. A construction site builds one thing, so it has a program of its own. `checkWorld` checks that every entity runs exactly what it resolves to.
- **Commands** (`src/sim/commands.js`):
  - `assign` gives an entity its own program, or takes it away (`null`) so it goes back to its team's or type's;
  - `role` puts a robot on a team, or none;
  - `default` sets a team's program, or a type's;
  - `start` starts a parked program, and is now the slice's reward;
  - `settings` and `name` set a robot's settings and its name;
  - `place` lays a building's construction site.

  A change to who runs what starts again exactly those whose program changes, from its start, robots with an empty basket. Everyone else carries on as if nothing had happened; the tests compare each with a world that wasn't given the command. A command that wouldn't fit changes nothing, not even part of it.
- **Settings in action inputs** (mission 22). Go to, Collect and Pick up now take a value in a gap. That value is a shadow block holding a place or an item, there from the start like the number in a new Repeat. *my source*, *my item* and *my destination* plug in over it ([settings-editor-en](phase6/settings-editor-en.jpg)). The compiler folds a place or item given outright into the action's intent, as before. A setting becomes an expression in the instruction's `args`, read from the robot's own settings when its block runs. So two robots sharing one program fetch from different places ([library-en](phase6/library-en.jpg)). A setting not chosen stops the program at its block: “Choose a setting first: Destination”. Phase 8's procedure inputs will plug into the same gaps. `COMPILER_VERSION` is 2.
- **The setup, in the chosen row** (`src/ui/setup.js`; [team-preview-en](phase6/team-preview-en.jpg), [settings-de](phase6/settings-de.jpg)). The chosen robot or building's program, chosen from those it can run, and where it comes from: its own, its team's, or every building like it. Also who else runs it, a robot's team, *Make its own copy*, *Back to the shared program*, *Rename*, and the robot's three settings. An item setting shows the item's picture.
- **Previews that name everyone.** A change of program or team is shown before it's made, naming every robot and building it starts again and what each will run, then OK makes it at the next step. The preview is worked out by applying the change to a copy of the world as it will be at the next step, after the commands already waiting. So it names exactly those the tick will change, and the tests check that it does. While the draft has changes, the editor names everyone *Apply* will start again ([copy-editor-en](phase6/copy-editor-en.jpg)): “Apply changes it for Robo 1, Robo 3, from the next step.”
- **The world as it will be** (`peekWorld`, `src/ui/session.js`). What waits for the next step shows at once in the setup (marked “From the next step”), the library and the editor, while the world itself, its labels and its rows, wait for the step. A placed building's site appears with the next step; until then a note says so.
- **Own copies** ([copy-preview-en](phase6/copy-preview-en.jpg)). *Make its own copy* makes a new program from the blocks the robot runs, named “Wood collector (Robo 3)”. Only that robot runs it, from the next step, and its editor opens. Its starter is the original's, for *Starter program*. *Back to the shared program* gives the robot its team's or type's program again; the copy stays in the library.
- **The program library** (`src/ui/library.js`, *Programs* in the bar; [library-en](phase6/library-en.jpg), [library-de](phase6/library-de.jpg), [library-ipad](phase6/library-ipad.jpg)). Every program, its version, who runs it, and whose shared program it is. Each can be edited, given to a team, to every building like one, or to one robot or building (with the same preview), copied, renamed, or put away when nothing runs it and brought back. *New program* makes one with only a start block and opens it. A program nothing runs yet is published when it's first given.
- **Names** stay message references until the player types one. A copy's name is a reference holding the names of its program and its robot, so it reads in the current language until renamed. `display()` words names inside names. Robots are renamed with the `name` command, at most 24 characters. Programs are renamed in the library, at most 40; that's the library's, not the world's. When a starter program is copied into the player's library, `wordStarter` words the names the game gave in it in the current language: variables' names, and any field holding a reference, such as a procedure's. Nothing uses this until Phase 8, but it's tested.
- **The workshop** (mission 25). Its recipe makes a kit from two planks and a stone, in 30 steps. Its store holds 4 planks, 2 stone and 4 kits, and the depot already had room for kits. The model is a hut with a chimney, a workbench where the kit being made grows, and a shelf for kits. Every building like it runs the *Kit maker*. A test plays mission 25's chain: one robot brings four planks in two trips and another two stone in one, and the workshop makes two kits.
- **Placing a building** (`src/sim/placement.js`; [place-fits-en](phase6/place-fits-en.jpg), [place-blocked-en](phase6/place-blocked-en.jpg), [workshop-en](phase6/workshop-en.jpg)). *Build* shows the workshop's plan where the pointer is, or where the player taps. It's green where it fits and red where it doesn't, with the reason, and *Turn* faces it another way. *Build it here* lays a construction site at the next step, running the *Workshop builder* as its own program. Robots bring 4 planks and 2 stone, the site builds for 60 steps, and then it becomes the workshop: same id, footprint and front, the workshop's store, and the workshop's program. A plan must:
  - stand on open ground, with open ground along its front, which is where robots use it;
  - keep clear of every building and deposit and of the cells robots use them from;
  - keep clear of robots, including one stepping onto it;
  - cut no robot off from anything it can reach, both now and once every bridge still to be built is there;
  - be reachable by some robot, now or once the bridges are built.

  So the room east of the stream can be planned before the bridge opens it, and an islet can't.
- **Start again keeps the player's choices.** Who runs what, settings and names are made again in the checkpoint's world (`choicesOf`, `makeChoices`), as far as they fit it. Applied programs and copies are kept, as before, and buildings placed since go with the rest of the world. Tests check this in the simulation and in the session.
- **Debugger.** A setting is one of the things an action's block reads: the inspector's *Sees* and the editor's badges show its place or item. Labels, rows and models are made again when a building is placed or a site becomes its building.
- **Fixed on the way.** In a long language, the overview's rows grew as wide as their longest line and ran off the window (the pseudo-language's layout test failed already at Phase 5). Rows now keep to the overview's width.
- **Versions.** `SIM_VERSION` is 5. The island's content version is 3 and the slice's 2. The golden replays were recorded again, with a fourth scenario, `teams`, that uses every new command. Saves from Phase 5 are let go, as planned before Phase 9.

## Decisions for later phases to know

- **Team is the child-facing word for a role.** The plan says role groups have friendly names, such as “Collectors”. The island's are named for their material (*Wood team*, *Holz-Team*), so a team's name and its program's name don't read the same in German (*Holzsammler* is both singular and plural). Teams are content; the player can join and leave them but not make new ones. Free play and the sandbox (Phase 7) can add that if playtests want it.
- **Sites have their own programs, not a type's.** A type default for construction sites would give a workshop's site the bridge builder, and its *Back to the shared program* would offer it. Each site builds what its blueprint says, so `site` has no default on the island.
- **Settings are read when their block runs.** A robot on its way to its destination keeps going there if the setting changes; the next Go To my destination uses the new one. Settings start nothing again, so they don't mark the mission as changed.
- **Only robots have settings.** No mission needs a building's Target Stock (PLAN.md §7), so it isn't there. `SETTINGS` in `src/sim/entities.js` is where it would go, with a value block.
- **What waits for the next step isn't saved** except an Apply, as in Phase 5. A team or settings change made while paused and not yet stepped is lost on reload. Phase 9 saves the whole command queue.
- **Previews are worked out, not predicted.** `preview()` applies the commands to a copy of the world as it will be, and reports every entity whose runtime changes. An Apply of a program whose runners are parked therefore names them too, since Apply starts them.
- **Placement checks reachability from robots.** With no robots, nothing can be placed. That's fine for the island and the campaign; a sandbox with no robots yet would need another rule.
- **Collect only takes what a deposit yields.** Collecting planks is now a program error (“Only wood and stone can be collected, not this: Planks”), caught by the compiler when the blocks say so and at runtime when a setting does.

## Not yet done

- Missions 21–25 themselves, with their unlocks, trials and goals (Phase 7). The tools are there; the slice turns them off with `tools`, which Phase 7's missions will set one by one.
- Making new teams, and robots, in the sandbox (Phase 7).
- A real iPad. The setup makes the chosen row long, and on an iPad the overview scrolls ([library-ipad](phase6/library-ipad.jpg) is WebKit at iPad size).
- A fluent speaker's review of the new German words, especially the setting blocks: *meine Quelle*, *mein Material*, *mein Ziel* stand in a gap uninflected, like a variable's name (“gehe zu mein Ziel”). See the glossary.
