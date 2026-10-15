import * as Blockly from "blockly/core";
import { BLOCK_STYLES, FAMILIES, TREATMENTS } from "./treatments.js";

// Zelos with roomier spacing: a grid unit of 5 instead of 4, which every padding,
// corner and notch is a multiple of. Only constants change, so it follows Zelos
// through Blockly updates; the bold treatment uses it (src/blockly/treatments.js).
class RoomyConstants extends Blockly.zelos.ConstantProvider {
  constructor() {
    super(5);
  }
}

class RoomyRenderer extends Blockly.zelos.Renderer {
  makeConstants_() {
    return new RoomyConstants();
  }
}

let registered = false;
export function registerRenderers() {
  if (registered) return;
  Blockly.blockRendering.register("island-roomy", RoomyRenderer);
  registered = true;
}

// The Blockly theme for treatment `name`, made once. Backgrounds are transparent:
// the panel behind the workspace gives them their colour and opacity
// (src/style/editor.css), so the world shows through.
const themes = new Map();
export function themeFor(name) {
  if (themes.has(name)) return themes.get(name);
  const { colours, font, toolbox } = TREATMENTS[name];
  const style = ({ primary, secondary, tertiary }) => ({ colourPrimary: primary, colourSecondary: secondary, colourTertiary: tertiary });
  const blockStyles = Object.fromEntries(Object.entries(BLOCK_STYLES).map(([styleName, family]) => [styleName, style(colours[family])]));
  const categoryStyles = Object.fromEntries(FAMILIES.map((family) => [`${family}_category`, { colour: colours[family].primary }]));
  const theme = Blockly.Theme.defineTheme(`island-${name}`, {
    base: Blockly.Themes.Classic,
    blockStyles,
    categoryStyles,
    componentStyles: {
      workspaceBackgroundColour: "transparent",
      toolboxBackgroundColour: "transparent",
      toolboxForegroundColour: toolbox.ink,
      flyoutBackgroundColour: `rgb(${toolbox.rgb.join(" ")})`,
      flyoutForegroundColour: toolbox.ink,
      flyoutOpacity: 1,
      scrollbarColour: toolbox.ink,
      scrollbarOpacity: 0.35,
    },
    fontStyle: font,
    startHats: true,
  });
  themes.set(name, theme);
  return theme;
}
