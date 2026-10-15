# Phase 4 findings: editing programs and the world-wide debugger

Recorded 15 October 2026. The editor and the debugger are on the island at `/island`. Pictures are in [phase4/](phase4/), made by `npm run shots -- debugger`.

## What's in place

- **The overview** (`src/ui/overview.js`), on the right, has a row for every robot, building and deposit, on screen or not. Each row shows:
  - the program it runs, with its version;
  - the block it's at, as a chip, outlined when it took that block in the latest step;
  - its state, and why it waits or stopped.

  The chosen one's row opens to show its details (`src/ui/inspector.js`):
  - what it's doing, with progress;
  - where it is;
  - what it holds against how much room there is;
  - what its block read in this step (*Sees*);
  - how far round its Repeat it is;
  - a button to edit its program.

  Tapping a chosen row's head lets go of it ([together-en](phase4/together-en.jpg)).
- **All programs** (Programs Together, `src/ui/together.js`) fills the panel on the left with every program something runs.
  - Each program is a read-only Blockly workspace of the revision the world runs, as tall as its blocks.
  - A labelled marker shows each robot or building running it at its active block: robots in their own colour and shape, buildings with one neutral mark.
  - Robots sharing a program each have their own label, side by side at one block or apart at different blocks ([together-shared](phase4/together-shared.jpg)).
  - The chosen one's label has a dark ring. What its block read sits on the blocks as badges: a number on each sense, ✓ or ✗ on each condition.
  - Tapping a label chooses its robot.
  - A workspace is made only while its panel is in view or near it, and let go when it's scrolled well away.
- **The editor** (`src/ui/editor.js`) opens from a row's *Edit program*, in the same panel, and pauses the world ([editor-en](phase4/editor-en.jpg)).
  - The toolbox offers only the blocks the robots or buildings running the program can use (`src/blockly/toolboxes.js`). The sawmill gets no robot blocks and no Build. A robot gets no building blocks.
  - Dropdowns offer only what makes sense (`src/blockly/choices.js`, `fields.js`): the places on the island for Go To and stock senses; the building's own recipes for Make and Build.
  - The compiler checks the draft as it's edited, and marks problems at their blocks.
  - *Apply* turns the draft into the program's next version. It reaches the world at the next tick, by Step or Run; until then, the editor and the program's rows say “Version 2 starts with the next step” ([editor-applied](phase4/editor-applied.jpg)).
  - *Undo changes* takes the draft back to the newest version, and *Starter program* to what the game gave it. Both change only the draft.
- **The program library** (`src/programming/programs.js`) keeps each program's starter, its draft, and the blocks of every version applied, as plain data.
  - A draft is checked against every robot or building type that runs the program, and against the island's places.
  - Applying makes a `publish` command for the world. Revisions are numbered by the library.
  - *Start again* starts a fresh island running the programs as last applied. `createWorld` now takes each program's revision.
- **Next block** (`game.nextBlock`) steps the world until the chosen robot or building takes a new block, then pauses. With nothing chosen, it stops when anyone does. Every entity moves on in the same ticks, exactly as if Step were pressed that many times; the tests check this tick for tick against stepping, and against Node's world.
- **One snapshot a tick** (`src/ui/snapshot.js`). After a frame's ticks, the page takes one snapshot of what every execution view shows: states, reasons, blocks, readings, Repeat rounds, programs and versions. The labels, the overview, the editor's markers and All programs all draw from it in that same frame. Markers draw at once when given a snapshot, rather than at the next frame, so no view lags a tick behind; a browser test checks forty frames at 4×.
- **Fixed from Phase 3:** labels marked hidden were still drawn, because `.tag { display: flex }` overrode the `hidden` attribute. Labels off screen, or under the panel on the left, now disappear.

## Decisions for later phases to know

- **What counts as a new block for Next block.** Next block stops when the chosen entity:
  - evaluates a block;
  - stops with an error;
  - or finds the whole world stalled.

  Trying a Wait Until again, while it's still false, doesn't count. So Next block on a waiting sawmill runs on until wood arrives and the Wait Until holds, which does count. Arriving at a Wait Until counts too, even when it's false. Next block stops after 600 ticks (a minute of play at 1×) whatever happens: the construction site, waiting for its planks, takes longer than that. A chosen entity that can't go on by itself (stopped, or a deposit) counts as none chosen.
- **When the editor shows markers.** The editor marks where everyone running the program is only while the draft compiles to the very instructions that run, from the same blocks. So:
  - moving stacks about doesn't hide the marks;
  - a stray block lying beside the program doesn't hide them, since it doesn't run;
  - taking a block out of the program, or changing a field, hides them until the change is applied and has reached the world.

  *Apply* is offered whenever the draft's blocks differ from the newest version, apart from where its stacks lie, and the draft has no errors.
- **Readings** are the world as it stands after the tick. That is what a block read during the tick, since only actions starting come after the runtimes, and they hold what they'll take rather than take it. Only conditions have readings: a Wait Until's, and an If's up to the first that held. A Repeat works out its count once, so it shows its round instead of a reading.
- **Every applied version's blocks are kept** for the visit, so the debugger can show the version the world runs while a newer one waits for the next tick. Saves (Phase 5) will need to keep only the versions the world still runs.
- **Starting again keeps applied programs and drafts** (PLAN.md §9). The world lab's *Start again* does the same, since it shares the visit's game.
- **A place dropdown holds any id.** The `field_choice` field accepts whatever value a program has, and offers it too, by its id if nothing names it. A program therefore opens exactly as it was saved, and the compiler says when a place isn't on the island. Toolbox blocks start at a choice that fits: the sawmill's Make at planks.
- **Blockly is fetched on demand** the first time the island opens the editor or All programs, so opening the island stays as quick as before.
- **The panel** uses the Calm treatment at 60% background opacity (docs/phase0.md). It can be resized by its edge, as in the lab, and keeps its width, its program and whether it's open for the visit and across a change of language.
- **Buildings' markers** are one neutral colour with a house shape (`BUILDING_MARK` in `src/render/identity.js`): each building runs a program of its own, so its name tells it apart.

## Not yet done

- Choosing which program a robot runs, roles and type defaults, copies, and previews of who a shared program reaches all come with the library in Phase 6. Until then, robots share a program only through the `assign` command, as the tests and screenshots do.
- Drafts and the world are kept only for the visit; saving them comes with Phase 5.
- In a narrow editor, a marker's label that would run off the right edge moves onto its block's row. Blocks scrolled out of view have no indicator pointing to their marks.
- Real-device checks on an iPad, as for Phase 3, and a portrait layout (Phase 10). The overview and the panel together leave about a third of an iPad's width for the world ([editor-ipad](phase4/editor-ipad.jpg)).
