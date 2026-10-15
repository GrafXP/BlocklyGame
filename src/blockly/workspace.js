import * as Blockly from "blockly/core";
import "blockly/blocks";
import { blocklyMessages, language } from "../i18n/index.js";
import { count, probe } from "../lifecycle.js";
import { isDev } from "../ui/dom.js";
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
  Blockly.common.defineBlocksWithJsonArray(BLOCKS);
  registerRenderers();
  probe("blocklyWorkspaces", () => Blockly.Workspace.getAll().length);
}

// Puts Blockly's words in the current language: its own (menus, the built-in
// blocks, what a screen reader hears) and the game's blocks'. A page awaits this
// before it makes editors. Blockly words a block when it makes it, so after a
// change of language editors are made again from their JSON (PLAN.md §8).
let worded = null; // the language Blockly.Msg holds
export async function prepareBlockly() {
  setUp();
  for (;;) {
    const { code, messages } = await blocklyMessages();
    if (code !== language()) continue; // the language changed while these were fetched
    if (worded !== code) {
      Blockly.setLocale(messages);
      worded = code;
      reads?.watch();
    }
    return;
  }
}

// With ?dev, which of Blockly's messages it has read: the browser tests check
// that every one is translated, and that none is one the game doesn't use
// (src/i18n/blockly-unused.js). Blockly.Msg is one object that Blockly's code
// reads its words from; each message becomes a getter that notes the read.
const reads = isDev() ? traceReads(Blockly.Msg) : null;
function traceReads(Msg) {
  const values = new Map();
  const read = new Set();
  Object.assign((window.island ??= {}), { blocklyReads: () => [...read].sort(), clearBlocklyReads: () => read.clear() });
  return {
    // Turns messages added since the last call into getters.
    watch() {
      for (const key of Object.keys(Msg)) {
        if (values.has(key)) continue;
        values.set(key, Msg[key]);
        Object.defineProperty(Msg, key, {
          configurable: true,
          enumerable: true,
          get: () => (read.add(key), values.get(key)),
          set: (value) => values.set(key, value),
        });
      }
    },
  };
}

// A Blockly editor in `host`, in visual treatment `treatment`, holding `state`
// (Blockly's JSON serialization) if given. It fills `host` and follows its size.
// The renderer can't change once a workspace is made, so a new treatment is a new
// editor: save(), dispose(), and make one with the saved state. Call
// prepareBlockly first.
export function createEditor(host, { treatment, toolbox, state = null, onChange = null }) {
  if (worded !== language()) console.warn(`Blockly isn't worded in ${language()}; await prepareBlockly() first.`);
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
