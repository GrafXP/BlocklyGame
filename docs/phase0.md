# Phase 0 findings: the editor over the world

Recorded 14 October 2026. Pictures are in [phase0/](phase0/), made by `npm run shots`.

## Recommended direction

- **Treatment: Calm** ([calm-day](phase0/calm-day.jpg), [calm-dusk](phase0/calm-dusk.jpg)). Soft block colours with dark text, a light panel, and a rounded font, all on Blockly's Zelos renderer. Every block colour has a contrast of at least 8:1 with its text (test/treatments.test.js).
- **Background opacity: about 60%.** At 30% the island competes with the program ([calm-day-30](phase0/calm-day-30.jpg)); at 85% the world barely shows ([calm-day-85](phase0/calm-day-85.jpg)). The toolbox never goes below 80% opacity, so its labels stay readable over any world.
- **Blur: off by default; keep it as an option.** Blur calms a busy world behind the panel ([calm-day-40-blur](phase0/calm-day-40-blur.jpg)). Its cost on an iPad is still unmeasured: headless Chromium draws WebGL in software (about 13 fps with and without blur, [frames.json](phase0/frames.json)).
- **No custom renderer.** Calm needs only a theme and CSS. The Bold treatment shows that a renderer which changes only Zelos's spacing (a grid unit of 5 instead of 4, src/blockly/theme.js) is cheap to keep. Use one only if playtests show blocks are too small to touch.
- **Markers:** an outline of the block's top row, with a label per entity to its right showing colour, shape and name. Labels stay readable over both worlds and sit side by side when two robots share a block.

These recommendations are for the user to confirm or change.

## What theme and CSS needed

- Blockly's `.blocklySvg` paints an opaque white background, which has to be cleared for the world to show through.
- Zelos makes block text and dropdown text white (`.zelos-renderer.<theme> …`, the dropdown text with `!important`). Dark text needs selectors that outrank these, because Blockly adds its CSS after ours.
- Dropdown menus are attached to `<body>`, outside the editor panel, so treatment colours are CSS variables on `<html>`. Without this, the Calm menu text was 1.65:1; the browser test now checks it.
- Blockly keeps one `blocklyComputeCanvas` on `<body>` for measuring text. It isn't a leak.

## Not yet verified

- Touch and readability on a real iPad. The browser tests use WebKit's iPad emulation and touch emulated through the Chrome DevTools Protocol.
- The cost of blur and transparency on an iPad's GPU.
