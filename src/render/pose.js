import { xOf, zOf } from "../sim/terrain.js";

// Where to draw a robot, in cells (x east, z south; fractions between cells),
// `alpha` of the way from the committed tick to the next (PLAN.md §6, rendering
// while paused). It comes from the move's own data, its path, start tick and
// ticks per cell, so no earlier state is kept. Paused, alpha is 0 and the robot
// is drawn exactly where the world has it.
export function robotPose(world, robot, alpha = 0) {
  const { terrain } = world;
  const at = (cell) => ({ x: xOf(terrain, cell), z: zOf(terrain, cell) });
  const a = robot.action;
  if (a?.type !== "move" || a.path.length < 2) return at(robot.cell);
  const walked = Math.min(world.tick - a.start + alpha, (a.path.length - 1) * a.perCell) / a.perCell;
  const leg = Math.min(Math.floor(walked), a.path.length - 2);
  const from = at(a.path[leg]);
  const to = at(a.path[leg + 1]);
  const f = walked - leg;
  return { x: from.x + (to.x - from.x) * f, z: from.z + (to.z - from.z) * f };
}
