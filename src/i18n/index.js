import { en } from "./en.js";

// The content language, chosen in Phase 0 (PLAN.md §8). Changing it means a
// catalogue with en.js's keys and Blockly's messages for it in
// src/blockly/workspace.js.
export const LANGUAGE = "en";
export const CATALOGUES = { en };

const catalogue = CATALOGUES[LANGUAGE];

// The interface text for `key`, with {name} placeholders filled from `params`. A
// missing key shows as itself, which a test catches before anyone sees it.
export function t(key, params = {}) {
  const text = catalogue.ui[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (all, name) => (name in params ? String(params[name]) : all));
}

// The block messages, for Blockly.Msg.
export const blockMessages = () => catalogue.blocks;
