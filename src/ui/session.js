import { ISLAND } from "../content/island.js";
import { createGame } from "../game.js";
import { blockIndex, readWorkspace } from "../programming/adapter.js";
import { createWorld } from "../sim/world.js";

// The game of this visit, shared by the pages that show it, the island and the
// world lab. It outlives them: leaving one and opening another, or a change of
// language, which opens the page again, finds the world as it was (PLAN.md §8).
// Saving it for another visit comes with Phase 5.

let game = null;

export const currentGame = () => (game ??= createGame(createWorld(ISLAND)));

// A new game on a fresh island, at the speed the last one had.
export function newGame() {
  const speed = game?.clock.speed ?? 1;
  game?.pause();
  game = createGame(createWorld(ISLAND));
  game.clock.setSpeed(speed);
  return game;
}

// Block `blockId` of the island's program `programId`, from its source, or
// null. (The world keeps only programs' compiled instructions.)
let sources = null;
export function blockOf(programId, blockId) {
  sources ??= new Map(ISLAND.programs.map(({ id, source }) => [id, blockIndex(readWorkspace(source).tree)]));
  return sources.get(programId)?.get(blockId) ?? null;
}

// The block `entity`'s program is at, as a node of its source, or null.
export function activeBlock(entity) {
  const run = entity.runtime;
  return run?.kind === "program" && run.block ? blockOf(run.program, run.block) : null;
}
