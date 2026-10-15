# Phase 3 findings: the selectable 3D island

Recorded 15 October 2026. The island is at `/island`. Pictures are in [phase3/](phase3/), made by `npm run shots -- island`.

## What's in place

- **The island is drawn from the world** (`src/render/island-view.js`). The ground is one mesh built from the world's terrain (`src/render/terrain.js`): a flat top for each cell of land, in a checker of two shades so cells can be counted, with sides down to lower neighbours or under the water. There's a matt sea round it, a pale blueprint of the bridge over the gap, and a wooden deck once the bridge is built. When the terrain changes, the ground is drawn again.
- **Models** are simple shapes with flat shading (`models.js`, `buildings.js`, `resources.js`):
  - the camp, depot, sawmill and construction site, each sized to its footprint and facing the cells robots use it from;
  - the grove's trees and the stone pit's boulders;
  - robots in their own colours, carrying what's in their baskets.
- **Stocks are visible.** Every store's items are stacked on a pad beside its building or deposit, as many as it holds, with one instanced mesh per kind of item.
- **Motion comes from ticks.** Robots are drawn where their committed move puts them, `alpha` of the way to the next tick (`pose.js`). They face the way they walk, or the thing they're working at. Wheels turn with the distance walked, and robots bob while collecting or unloading. The sawmill's blade turns while it makes a plank, and the site's scaffold rises as the bridge gets built. Robots standing on one cell stand apart.
- **The camera** (`stage.js`, shared with the editor lab) is orthographic. You can drag to pan, use the wheel or a pinch to zoom, turn a quarter at a time (the turn animates briefly), and reset the view. Buttons in the corner do the same: turn left and right, zoom in and out, reset.
- **Choosing** works by tapping a robot, building or deposit in the world, tapping its label, or using the inspector's list.
  - Robots have a larger invisible box round them for fingers to find.
  - What's chosen is outlined on the ground, a building with the cells robots use it from.
  - A chosen robot on its way shows the cells it has still to walk and an outline round where it's going.
  - Hovering with a mouse outlines what's under it. Escape or tapping the water lets go.
- **Labels** are buttons over the world, so a keyboard and a screen reader can reach them.
  - Each shows the robot's colour and shape, the picture of the block it's at, and its name.
  - It has a mark when it waits or has stopped with an error; hovering gives the reason.
  - Labels that would cover one another stack upward, the nearest keeping its place (`src/ui/tags.js`).
- **The inspector** (`src/ui/inspector.js`) shows what the chosen thing is in words:
  - its state and why;
  - the block it's at, as a chip;
  - what it's doing, with progress;
  - where it is;
  - what it holds against how much room there is.

  With nothing chosen, it lists everything to choose from.
- **One world for the visit** (`src/ui/session.js`). The island and the world lab show the same game: steps taken on one are there on the other, and a change of language keeps the world, the camera and the choice. The clock's controls are shared (`src/ui/clock.js`).
- **Graphics counters and quality.** With `?dev`, the corner shows frames a second, the slowest frame, the time the game's own code took, draw calls and triangles (`src/render/meter.js`, also the lab's). Graphics *Simple* draws one pixel per CSS pixel without shadows; *Detailed* up to two, with shadows. The choice is kept on the device.
- **Drawing only when needed.** While the world is paused and nothing changes, nothing is drawn. Anything new (a step, the camera, the choice, the pointer) draws one frame.

## Measured

In headless Chromium, which draws WebGL in software, the island at its start draws 136 calls and about 8,500 triangles in *Detailed*, and 79 calls and 4,800 triangles in *Simple* (no shadow pass). These say what a frame costs, not how fast a real device is. The iPad numbers still need a real iPad (PLAN.md §12).

## Decisions for later phases to know

- **One cell is one world unit**, with the island's middle at the origin; heights are for drawing only (`src/render/grid.js`). Grass tops are at 0.5, sand at 0.4, the water at 0.12.
- **What moves is worked out from the world**, except two things: the camera's turn, and a robot turning to face its way while the world runs. A paused world, or one just stepped, is drawn exactly as committed, and the browser tests check each robot against `robotPose` at α = 0.
- **Labels are DOM, not 3D.** That keeps them sharp, in the player's language, and reachable by keyboard and screen readers, at the cost of positioning them every frame the view changes (nine at present).
- **The editor lab keeps its Phase 0 island**, now on the shared stage, so it can turn too. Phase 4 puts the editor over the real island.
- **Robots' identities** (`src/render/identity.js`) are a colour and a shape per robot in id order, the same set the lab's sample markers use. Phase 4's markers should take them from there.
- **Draw calls**: about 140 in *Detailed*, mostly from models of many small meshes. Merging each model's static meshes into one, or instancing trees and robots, is the first thing to do if a real iPad struggles (PLAN.md §12).

## Not yet done

- Real-device checks on an iPad: touch, frame rate, and whether *Simple* should be its default.
- Labels on robots far off screen point nowhere; an edge indicator could show where they are.
- Keyboard panning and turning of the camera. The view's buttons do this, and the labels and the inspector's list make every thing reachable without aiming.
