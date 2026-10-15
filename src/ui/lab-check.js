import { compile } from "../programming/compiler.js";

// The editor lab's programs, checked by the compiler (PLAN.md §11, Phase 2). The
// lab holds several programs on one workspace, each under its own start block,
// as its sample does (a collector's and a sawmill's), where the game has one
// program a workspace. So each start block's stack is compiled on its own, and a
// stack under no start block is unused. Returns every problem found, errors and
// warnings, as codes with block ids.
export function checkLabPrograms(json) {
  const whole = compile(json);
  const top = Array.isArray(json?.blocks?.blocks) ? json.blocks.blocks : [];
  const enabled = (b) => !(b.disabledReasons?.length || b.enabled === false);
  const starts = top.filter((b) => b?.type === "island_when_started" && enabled(b));
  if (starts.length < 2) return [...whole.errors, ...whole.warnings];
  return [...starts.flatMap((start) => compile({ blocks: { languageVersion: 0, blocks: [start] } }).errors), ...whole.warnings];
}
