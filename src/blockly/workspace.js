import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as BlocklyMessages from "blockly/msg/en";
import { blockMessages } from "../i18n/index.js";
import { count, probe } from "../lifecycle.js";
import { BLOCKS } from "./blocks.js";
import { registerRenderers, themeFor } from "./theme.js";
import { TREATMENTS } from "./treatments.js";

// Where Blockly finds its cursors, sprites and sounds: this app (vite.config.js
// serves and builds them), never static.blockly.com.
export const MEDIA = `${import.meta.env.BASE_URL}blockly-media/`;

let ready = false;
function setUp() {
  if (ready) return;
  ready = true;
  Blockly.setLocale(BlocklyMessages); // the built-in blocks' words, in the content language
  Object.assign(Blockly.Msg, blockMessages()); // the game's blocks' words
  Blockly.common.defineBlocksWithJsonArray(BLOCKS);
  registerRenderers();
  probe("blocklyWorkspaces", () => Blockly.Workspace.getAll().length);
}

// A Blockly editor in `host`, in visual treatment `treatment`, holding `state`
// (Blockly's JSON serialization) if given. It fills `host` and follows its size.
// The renderer can't change once a workspace is made, so a new treatment is a new
// editor: save(), dispose(), and make one with the saved state.
export function createEditor(host, { treatment, toolbox, state = null, onChange = null }) {
  setUp();
  const { renderer, scale } = TREATMENTS[treatment];
  const workspace = Blockly.inject(host, {
    renderer,
    theme: themeFor(treatment),
    toolbox,
    media: MEDIA,
    trashcan: true,
    sounds: true,
    zoom: { controls: true, wheel: false, pinch: true, startScale: scale, maxScale: 2, minScale: 0.4, scaleSpeed: 1.15 },
    move: { scrollbars: true, drag: true, wheel: true },
  });
  count("editors", 1);
  if (state) {
    try {
      Blockly.serialization.workspaces.load(state, workspace);
    } catch (e) {
      // A program this Blockly can't read: leave nothing behind, and say so.
      workspace.dispose();
      count("editors", -1);
      throw e;
    }
  }
  if (onChange) workspace.addChangeListener(onChange);

  // Blockly sizes itself once; after that, it's told (PLAN.md §8).
  const ro = new ResizeObserver(() => Blockly.svgResize(workspace));
  ro.observe(host);

  let disposed = false;
  return {
    workspace,
    save: () => Blockly.serialization.workspaces.save(workspace),
    load: (json) => Blockly.serialization.workspaces.load(json, workspace),
    blockCount: () => workspace.getAllBlocks(false).length,
    dispose() {
      if (disposed) return;
      disposed = true;
      ro.disconnect();
      Blockly.hideChaff(); // an open dropdown or menu belongs to this workspace
      workspace.dispose();
      count("editors", -1);
    },
  };
}

export { Blockly };
