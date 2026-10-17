import { runtimeOf } from "./runtimes.js";

// What a robot or building is doing, in the plan's terms (PLAN.md §8), and why
// it waits or stopped. world.js gives them out; the mission's goals use them
// too (objectives.js), to tell when a job is over.

// "error", "waiting" (for the world, on purpose with Wait N Steps, or at a Wait
// Until), "moving", "working", "ready" (it has more to do, and goes on next
// tick) or "stopped" (nothing more to do).
export function statusOf(entity) {
  if (entity.error) return "error";
  const runtime = runtimeOf(entity);
  if (entity.pending || entity.action?.type === "wait" || runtime?.waiting(entity)) return "waiting";
  if (entity.action?.type === "move") return "moving";
  if (entity.action) return "working";
  return runtime && !runtime.finished(entity) ? "ready" : "stopped";
}

// Why `entity` stopped or waits, a code with values (codes.js), or null.
export const reasonOf = (entity) => entity.error ?? entity.pending?.reason ?? runtimeOf(entity)?.waiting(entity) ?? null;
