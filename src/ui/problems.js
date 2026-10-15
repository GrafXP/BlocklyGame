import { describeReason } from "./describe.js";

// What the compiler finds wrong with a program (codes with block ids,
// src/programming/compiler.js), shown in the player's language as Blockly's
// warning on each block it's about (PLAN.md §7). A block's warning is only set
// when it changes, since setting one draws the block again.
export function createWarnings(workspace) {
  let warned = new Map(); // block id → the warning it shows
  return {
    // Shows `problems`; returns, in words, those that are about no block.
    show(problems) {
      const lists = new Map();
      for (const p of problems) if (p.block) lists.set(p.block, [...(lists.get(p.block) ?? []), describeReason(null, p)]);
      const texts = new Map([...lists].map(([id, list]) => [id, list.join("\n")]));
      for (const block of workspace.getAllBlocks(false)) {
        const text = texts.get(block.id) ?? null;
        if ((warned.get(block.id) ?? null) !== text) block.setWarningText(text);
      }
      warned = texts;
      return problems.filter((p) => !p.block).map((p) => describeReason(null, p));
    },
    // The workspace was loaded again: no block has a warning now.
    reset() {
      warned = new Map();
    },
  };
}
