import { ref } from "../i18n/index.js";

// The Phase 0 visual treatments of the editor, to compare (PLAN.md §8, Phase 0).
// All three use Blockly's Zelos renderer, whose large rounded blocks suit touch:
//
// - classic: Blockly's own colours on Zelos, the baseline.
// - calm: soft colours with dark text, a light panel, a rounded font. Theme and
//   CSS only.
// - bold: strong colours with white text, a dark panel, and a renderer that only
//   changes Zelos's spacing (src/blockly/theme.js), to see what that adds.
//
// Plain data, so node can check it (test/treatments.test.js): every block and
// toolbox text must stay readable, whatever the world shows through the panel.
// Each treatment's label is a message, worded in the player's language.

// The colour families, and which family each block style takes. Built-in blocks
// keep their style names (controls_if is logic_blocks, repeat is loop_blocks).
// Variables are Blockly's variable_blocks, the player's own blocks its
// procedure_blocks (PLAN.md §7, Phase 8).
export const FAMILIES = ["entry", "robot", "building", "control", "sensing", "values", "memory", "routine", "message"];
export const BLOCK_STYLES = {
  entry_blocks: "entry",
  robot_blocks: "robot",
  building_blocks: "building",
  loop_blocks: "control",
  logic_blocks: "control",
  sensing_blocks: "sensing",
  math_blocks: "values",
  variable_blocks: "memory",
  procedure_blocks: "routine",
  message_blocks: "message",
};

const ROUNDED = 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

export const TREATMENTS = {
  classic: {
    label: ref("lab.style.classic"),
    renderer: "zelos",
    // Blockly's hues, which it turns into colours itself. Its white text on them
    // is the baseline being improved on, so the contrast test leaves it out.
    colours: {
      entry: { primary: "45" },
      robot: { primary: "210" },
      building: { primary: "20" },
      control: { primary: "120" },
      sensing: { primary: "180" },
      values: { primary: "230" },
      memory: { primary: "330" },
      routine: { primary: "290" },
      message: { primary: "190" },
    },
    blockInk: "#ffffff",
    panel: { rgb: [255, 255, 255], ink: "#1d2633" },
    toolbox: { rgb: [221, 221, 221], ink: "#1d2633", selectedInk: "#ffffff" },
    scale: 0.9,
  },
  calm: {
    label: ref("lab.style.calm"),
    renderer: "zelos",
    font: { family: ROUNDED, weight: "600", size: 12 },
    colours: {
      entry: { primary: "#f6cf74", secondary: "#fbe3ab", tertiary: "#c4962c" },
      robot: { primary: "#a8cdf5", secondary: "#d3e5fa", tertiary: "#5f8fc4" },
      building: { primary: "#f5b98f", secondary: "#fad6bd", tertiary: "#c47b46" },
      control: { primary: "#c9b8f2", secondary: "#e2d9f8", tertiary: "#8a72c9" },
      sensing: { primary: "#97dcc9", secondary: "#c6ece1", tertiary: "#4c9f88" },
      values: { primary: "#bfe095", secondary: "#dcefc4", tertiary: "#7aa64b" },
      memory: { primary: "#f3b3c8", secondary: "#f9d7e3", tertiary: "#c26f8d" },
      routine: { primary: "#dcc8a6", secondary: "#ece0cc", tertiary: "#a08a62" },
      message: { primary: "#8fd3ea", secondary: "#c5e8f4", tertiary: "#4f9cb8" },
    },
    blockInk: "#1d2633",
    panel: { rgb: [250, 247, 240], ink: "#1d2633" },
    toolbox: { rgb: [243, 238, 228], ink: "#1d2633", selectedInk: "#1d2633" },
    scale: 0.9,
  },
  bold: {
    label: ref("lab.style.bold"),
    renderer: "island-roomy",
    font: { family: ROUNDED, weight: "700", size: 12 },
    colours: {
      entry: { primary: "#a35a00", secondary: "#c98a3c", tertiary: "#6e3d00" },
      robot: { primary: "#1f5fbf", secondary: "#5a8bd6", tertiary: "#123d7d" },
      building: { primary: "#b0420c", secondary: "#cf7546", tertiary: "#742a06" },
      control: { primary: "#6a3fc0", secondary: "#9476d4", tertiary: "#452880" },
      sensing: { primary: "#0b6f66", secondary: "#4a9890", tertiary: "#064a44" },
      values: { primary: "#37701a", secondary: "#6a9a52", tertiary: "#224a0f" },
      memory: { primary: "#a3305d", secondary: "#c4688c", tertiary: "#6d1f3e" },
      routine: { primary: "#7a5a26", secondary: "#a0834f", tertiary: "#4f3a18" },
      message: { primary: "#0f6a8c", secondary: "#4b93ae", tertiary: "#08465d" },
    },
    blockInk: "#ffffff",
    panel: { rgb: [22, 28, 45], ink: "#eef2ff" },
    toolbox: { rgb: [30, 38, 60], ink: "#eef2ff", selectedInk: "#ffffff" },
    // The roomier renderer makes blocks a quarter bigger; this keeps as much of
    // the program in view as the others show.
    scale: 0.8,
  },
};

export const DEFAULT_TREATMENT = "calm";

// The opacity of each surface for a background opacity `opacity` (0: the world
// shows through fully; 1: solid). Blocks are always opaque. The toolbox never goes
// below TOOLBOX_MIN, so its labels stay readable over the brightest or darkest
// world; the flyout keeps some body, to set the blocks in it apart from the
// program behind.
export const TOOLBOX_MIN = 0.8;
export function surfaceAlphas(opacity) {
  const panel = Math.min(1, Math.max(0, opacity));
  return {
    panel,
    toolbox: Math.max(TOOLBOX_MIN, panel),
    flyout: Math.min(1, Math.max(0.55, panel + 0.2)),
  };
}
