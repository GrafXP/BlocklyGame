import { describeReason } from "./describe.js";

// What the compiler finds wrong with a program (codes with block ids,
// src/programming/compiler.js), shown in the player's language as Blockly's
// warning on each block it's about (PLAN.md §7). A problem with a shadow block,
// such as a place in a Go To's gap, shows on the block that holds it, where
// it can be seen. A block's warning is only set when it changes, since setting
// one draws the block again.
export function createWarnings(workspace) {
  let warned = new Map(); // block id → the warning it shows
  // The block a problem with block `id` shows on.
  const shownOn = (id) => {
    let b = workspace.getBlockById(id);
    while (b?.isShadow() && b.getParent()) b = b.getParent();
    return b?.id ?? id;
  };
  return {
    // Shows `problems`; returns, in words, those that are about no block.
    show(problems) {
      const lists = new Map();
      for (const p of problems) {
        if (!p.block) continue;
        const id = shownOn(p.block);
        lists.set(id, [...(lists.get(id) ?? []), describeReason(null, p)]);
      }
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
