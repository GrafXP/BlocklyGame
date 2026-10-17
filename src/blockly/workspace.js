import * as Blockly from "blockly/core";
import "blockly/blocks";
import { blocklyMessages, language } from "../i18n/index.js";
import { count, probe } from "../lifecycle.js";
import { isDev } from "../ui/dom.js";
import { BLOCKS } from "./blocks.js";
import { registerFields, setChoiceContext } from "./fields.js";
import { DYNAMIC } from "./toolboxes.js";
import { registerRenderers, themeFor } from "./theme.js";
import { TREATMENTS } from "./treatments.js";

// Where Blockly finds its cursors, sprites and sounds: this app (vite.config.js
// serves and builds them), never static.blockly.com.
export const MEDIA = `${import.meta.env.BASE_URL}blockly-media/`;

let ready = false;
function setUp() {
  if (ready) return;
  ready = true;
  registerFields();
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
//
// - `context`: the island and the robot or building type the program is for,
//   so its dropdowns offer what they have (fields.js).
// - `readOnly`: a program to look at, not change, as Programs Together shows
//   them: no toolbox, bin or zoom buttons, and the wheel scrolls the page.
// - `scale`: the zoom to start at, else the treatment's.
export function createEditor(host, { treatment, toolbox = null, state = null, onChange = null, context = null, readOnly = false, scale = null }) {
  if (worded !== language()) console.warn(`Blockly isn't worded in ${language()}; await prepareBlockly() first.`);
  const look = TREATMENTS[treatment];
  const startScale = scale ?? look.scale;
  const workspace = Blockly.inject(host, {
    renderer: look.renderer,
    theme: themeFor(treatment),
    media: MEDIA,
    ...(readOnly
      ? {
          readOnly: true,
          sounds: false,
          zoom: { controls: false, wheel: false, pinch: false, startScale },
          move: { scrollbars: false, drag: true, wheel: false },
        }
      : {
          toolbox,
          trashcan: true,
          sounds: true,
          zoom: { controls: true, wheel: false, pinch: true, startScale, maxScale: 2, minScale: 0.4, scaleSpeed: 1.15 },
          move: { scrollbars: true, drag: true, wheel: true },
        }),
  });
  count("editors", 1);
  if (context) setChoiceContext(workspace, context);
  if (toolbox && !readOnly) fillsCategories(workspace, toolbox);
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

  // Where the blocks are, in pixels at the workspace's zoom.
  const contentBox = () => {
    const b = workspace.getBlocksBoundingBox();
    const s = workspace.scale;
    return { left: b.left * s, top: b.top * s, width: (b.right - b.left) * s, height: (b.bottom - b.top) * s };
  };

  let disposed = false;
  return {
    workspace,
    save: () => Blockly.serialization.workspaces.save(workspace),
    load: (json) => Blockly.serialization.workspaces.load(json, workspace),
    blockCount: () => workspace.getAllBlocks(false).length,
    contentBox,
    // Scrolls the blocks' top left corner to `pad` pixels from the view's.
    showTopLeft(pad = 12) {
      Blockly.svgResize(workspace);
      const box = contentBox();
      workspace.scroll(pad - box.left, pad - box.top);
    },
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

// --- Memory and My blocks ---------------------------------------------------
//
// The toolbox categories whose blocks depend on the program (src/blockly/
// toolboxes.js, DYNAMIC), filled each time one is opened, with what its
// `offers` allow: Set, Change and Get for each of the program's variables, and
// a button for a new one; a new block of one's own, and a use of each the
// program has. A routine's input is a variable too, but only its Get makes
// sense, inside the routine: Set and Change are for the program's own.

function fillsCategories(workspace, toolbox) {
  const offers = Object.fromEntries(toolbox.contents.filter((c) => c.custom).map((c) => [c.custom, new Set(c.offers)]));
  workspace.registerToolboxCategoryCallback("GAME_MEMORY", (ws) => memoryFlyout(ws, offers.GAME_MEMORY ?? new Set()));
  workspace.registerToolboxCategoryCallback("GAME_ROUTINES", (ws) => routinesFlyout(ws, offers.GAME_ROUTINES ?? new Set()));
  workspace.registerButtonCallback("GAME_NEW_VARIABLE", (button) => Blockly.Variables.createVariableButtonHandler(button.getTargetWorkspace()));
}

const byName = (a, b) => a.getName().localeCompare(b.getName());

function memoryFlyout(workspace, offers) {
  const inputs = new Set(
    workspace
      .getTopBlocks(false)
      .filter((b) => b.type === "procedures_defnoreturn")
      .flatMap((b) => b.getVarModels().map((v) => v.getId())),
  );
  const variables = workspace.getVariableMap().getAllVariables().sort(byName);
  const own = variables.filter((v) => !inputs.has(v.getId()));
  const items = [];
  if (offers.has("variables_set")) items.push({ kind: "button", text: "%{BKY_NEW_VARIABLE}", callbackkey: "GAME_NEW_VARIABLE" });
  for (const v of own) {
    const VAR = { id: v.getId() };
    if (offers.has("variables_set")) items.push({ kind: "block", type: "variables_set", fields: { VAR }, inputs: { VALUE: { shadow: { type: "math_number", fields: { NUM: 0 } } } } });
    if (offers.has("math_change")) items.push({ kind: "block", type: "math_change", fields: { VAR }, inputs: { DELTA: { shadow: { type: "math_number", fields: { NUM: 1 } } } } });
  }
  if (offers.has("variables_get")) for (const v of variables) items.push({ kind: "block", type: "variables_get", fields: { VAR: { id: v.getId() } } });
  if (!items.length) items.push({ kind: "label", text: "%{BKY_MEMORY_NONE}" });
  return items;
}

function routinesFlyout(workspace, offers) {
  const items = [];
  if (offers.has("procedures_defnoreturn")) items.push({ kind: "block", type: "procedures_defnoreturn" });
  if (offers.has("procedures_callnoreturn")) {
    const [defined] = Blockly.Procedures.allProcedures(workspace);
    for (const [name, params] of [...defined].sort(([a], [b]) => a.localeCompare(b))) {
      items.push({ kind: "block", type: "procedures_callnoreturn", extraState: { name, ...(params.length && { params }) } });
    }
  }
  if (!items.length) items.push({ kind: "label", text: "%{BKY_ROUTINES_NONE}" });
  return items;
}

export { Blockly };
