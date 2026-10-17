# Phase 8 findings: memory, blocks of one's own, messages, and chapters 6–8

Recorded 17 October 2026. Missions 26–40 follow mission 25 at `/play`; the title page's mission map has eight chapters ([home-chapters-en](phase8/home-chapters-en.jpg)). Pictures are in [phase8/](phase8/).

## What's in place

- **Variables** (PLAN.md §7, memory). Blockly's own Set, Change and Get (`variables_set`, `math_change`, `variables_get`), in a **Memory** category. A variable holds a whole number, within 99999 either side of 0, and starts at 0 whenever its program starts (`src/programming/runtime.js`, `vars`). Each robot or building running a program has its own: robots sharing one count apart (mission 29). Set and Change each take a step.
- **Blocks of one's own** (PLAN.md §7, reuse). Blockly's procedures without a result, in **My blocks**: a definition, “my block bring wood”, and its uses, “bring wood”. A definition has one input at most, a place, a number or an item: whatever its blocks use it as, and each use must give the same (`src/programming/compiler.js`). A use is a step; then the robot follows the definition's blocks, and after the last goes on after the use, without a step of its own. A block that uses itself, through others or directly, doesn't compile; uses inside uses go 8 deep at most. The runtime keeps a frame for each block it's inside: the use, where to go on, and what the use gave its input.
- **Messages** (PLAN.md §7, coordination; `src/sim/messages.js`). *send “plank ready” to Robo 2* and *wait for “plank ready”*. Seven named messages, no payloads, one named recipient, a robot or a building. Send is an action of one step: started in tick T, it ends at the start of tick T + 1, and the message is then in the recipient's inbox, for a Wait For to take in that same tick. An inbox holds four, counting those on their way; a Send to a full one waits, “Workshop's inbox is full”, and goes when there's room. Wait For takes the oldest of its name and lets the others be. A message never starts a program; nothing but a Wait For reads an inbox. A Send stopped on its way, by Apply or Start again, still delivers: messages are never lost.
- **The debugger shows all three** (`src/ui/snapshot.js`, `inspector.js`, `overview.js`, `marks.js`):
  - each robot's row in the overview says what its variables hold as it runs, “order 3 · delivered 1” ([m26-memory-en](phase8/m26-memory-en.jpg));
  - the chosen one's details add *Remembers*, *Inside* (the blocks of its own it's inside, “bring wood”) and *Inbox* (“stone please” from Workshop, or empty), the inbox wherever its program has a Wait For; a robot or building waiting for a message says which, and its label on the island shows the envelope of its Wait For ([m38-stalled-de](phase8/m38-stalled-de.jpg));
  - in the editor, the use of a block of one's own the chosen robot is inside has a ↪ badge, as it follows the definition's blocks ([m31-inside-en](phase8/m31-inside-en.jpg)); and what a Repeat counted, a Set or Change set and a use gave its input appear as readings, like a condition's ✓ and ✗.
- **Toolboxes** (`src/blockly/toolboxes.js`, `workspace.js`). Memory and My blocks are filled as they're opened: Set and Change for each of the program's variables and a *New variable…* button, Get for each variable and each input; a new block of one's own and a use of each the program has. Each offers only what the mission has unlocked: Get and Set from mission 26, Change from 27, blocks of one's own from 31, Send and Wait For from 36. Messages is a category of its own, for robots and buildings alike. The Send block is two rows, the message and whom it's for, so it fits the toolbox in German too.
- **Words.** Blockly's “to do something” is “my block” (“mein Baustein”), its change block “change … by …” (“ändere … um …”); a definition gets no comment to fill in (`src/i18n/*/blockly.js`). The variables, blocks and inputs a mission gives are named in the player's language as the starter is given out (`wordStarter`): “order”, “Auftrag”; “bring wood”, “Holz holen”; “destination”, “Ziel”.
- **Chapters 6–8, missions 26–40** (`src/content/missions/chapter6.js`–`chapter8.js`), each with its authoring package, in English and German:

  | Mission | Lesson | Steps (alone / sequence / bound) |
  | --- | --- | --- |
  | 26 A Number to Remember | a remembered order counts a Repeat | 174 / 174 / 500 |
  | 27 Count Finished Deliveries | Change after Unload | 177 / 177 / 500 |
  | 28 How Many Are Left? | a countdown, then a wait | 258 / 258 / 700 |
  | 29 My Count, Your Count | one program, two memories | 143 / 143 / 700 |
  | 30 The Forgetful Counter | a Set inside the loop forgets | 177 / 177 / 500 |
  | 31 My Delivery Block | a job with a name, used twice | 115 / 115 / 400 |
  | 32 Fix It in One Place | one repair mends three uses | 172 / 172 / 600 |
  | 33 One Block, Two Places | a place input | 139 / 139 / 600 |
  | 34 Tell the Block How Many | a number input | 233 / 236 / 800 |
  | 35 Little Jobs Make a Big Job | two kits from three little jobs | 590 / 590 / 1200 |
  | 36 You Have a Message | the sawmill tells the courier | 116 / 116 / 400 |
  | 37 Ask, Deliver, Reply | a request and its reply, twice | 234 / 222 / 1000 |
  | 38 Everybody Is Waiting | the first move is missing | 234 / 225 / 1000 |
  | 39 The Celebration Rehearsal | three jobs, one kit | 338 / 338 / 900 |
  | 40 Welcome to Robot Island! | four kits, twice: as planned, and with the kit courier starting at the grove | 1846 / 1846 / 3000 |

  `npm run verify:missions` checks all forty, alone and in sequence, as before.
- **Two new goals** (`src/sim/objectives.js`). `remembers`: once a robot has stopped, a variable of its program holds the count, whichever variable, so no name is required (missions 27, 29, 30); the card shows a thought for each count. `steady` without `after`: a store keeps its count for a while, no more coming (mission 28: three delivered, then the robot waits).
- **Shared blocks and competition.** Three robots sharing a program with a block of its own compete for one pile; each is inside its own frame with its own count, the five pieces are counted once, and all three end waiting, visibly, at the empty pile (`test/memory.test.js`). Missions 39 and 40 run five programs at once: three robots and two buildings.
- **Tests.** The language checks now look at the campaign on a page of its own: on WebKit as an iPad, a page that had made dozens of 3D views before lost its WebGL context, which says nothing about the words. `test/memory.test.js` for variables, blocks of one's own and messages on the world clock, with a save of such a world read back; the compiler's codes in `test/compiler.test.js`; `e2e/memory.spec.js` in the browser: Memory, My blocks and Messages in the toolbox, the memory line, Inside and the ↪ badge, the inbox, and German. The language checks look at a robot that remembers, one inside a block of its own, and a team that's stalled for a missing message, in every language and the pseudo-language.

## Compatibility

`SIM_VERSION` stays 6 and `COMPILER_VERSION` 2: the blocks there were compile to the same instructions, and a world that doesn't use the new blocks runs exactly as before. New state appears only when it's used: a runtime's `vars` once something is set, `frames` while inside a block, an entity's `inbox` while it holds a message, a program's `variables` when it has any. The golden replays are unchanged, and so are missions 1–25 of the recorded campaign; saved games go on.

## Decisions for later phases to know

- **Variables hold numbers and start at 0.** No mission needs another kind, and a variable that's never been set reads 0 rather than stopping the program. Start again, Apply and a new trial forget them.
- **An input's type comes from its use.** Blockly's procedure inputs are untyped variables; the compiler gives each the type of the gap it's used in, and checks every use against it. Setting or changing an input is refused: an input gets its value where the block is used.
- **Send is a step, delivery the next tick's start.** PLAN.md §6 puts message delivery in phase 3. A Send's action ends in phase 2 and delivers then; nothing reads an inbox between the two, so it's the same tick, and the messages of one tick arrive in order of the sender's id.
- **An inbox survives Apply.** Restarting a program keeps what its inbox holds: a request the workshop sent shouldn't vanish because the collector's program was changed. A mission's start and a new trial empty every inbox.
- **Mission 28 lays out “change remaining by -1”**, so no child has to type a minus sign.
- **Mission 40's trials each fill the grove and the stone pit**, so its budget is the two runs' together; `missionProblems` counts what later trials stage.
- **The starters' names are worded wherever a program is given out**: as a mission begins, in a replay of a mission not yet played, in “Show me a start” and “Show me the whole program”. Blockly can't load a name that's still a message reference.

## Fixed on the way

- A program applied anew lost its variables' names on its way into the world (`installProgram`), so the overview showed none, and the save's check that the world runs what its blocks compile to would have let the game go.
- “Show me a start” and “Show me the whole program” put a program's unworded names into the editor, which Blockly couldn't load; so did a replay of a mission not yet reached, with `?dev`.
- The first Send block was 308 px wide in the toolbox; it's two rows now.

## Not yet done

- The playtest gates after missions 30, 35 and 40 need children. What to watch is in the campaign plan's table: whether a remembered count is told apart from stock, whether a block's job and its input can be explained, whether a missing message is found.
- *New variable…* and renaming a block of one's own need the keyboard. The missions give every name; free play is where children would type.
- German awaits a fluent speaker's review, as for chapters 1–5.
