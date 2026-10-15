import { applyCommand } from "./commands.js";
import { thing } from "./things.js";

// A mission's goals (PLAN.md §9): what must have happened in the world for the
// mission to be done, checked in the last phase of every tick (world.js). Goals
// look at what the world has become, never at a program's blocks, so any
// program that gets there counts; and only at work that has ended, never at
// work begun. The mission is part of the world, plain data:
//
//   world.mission = { id, goals: [{ id, type, …, done }], reward: [command, …], done }
//
// Each goal is met for good once it holds: `done` is the tick it first held,
// null until then. When the last is met, the mission is `done` in that tick and
// its `reward` is given, the player's commands (commands.js) that the mission
// gives instead: applied at once, at the end of the tick, which is the boundary
// before the next, like any command.
//
// A world without a mission has mission null.

// Each type of goal: whether it holds in `world`.
export const GOALS = {
  // Construction site `at` has built what it builds (the bridge).
  built: (world, { at }) => thing(world, at)?.built === true,
};

// The mission in a world made from content's `mission`, { id, goals, reward }.
export function createMission({ id, goals, reward = [] }) {
  for (const goal of goals) if (!GOALS[goal.type]) throw new Error(`mission ${id}: no goal type "${goal.type}"`);
  return {
    id,
    goals: goals.map((goal) => ({ ...goal, done: null })),
    reward: JSON.parse(JSON.stringify(reward)),
    done: null,
  };
}

// Checks the goals of `world`'s mission at the end of tick `now`. Returns the
// ids of the goals met in this tick, and whether the mission was done in it:
// { met, done }.
export function checkGoals(world, now) {
  const mission = world.mission;
  const met = [];
  if (!mission || mission.done !== null) return { met, done: false };
  for (const goal of mission.goals) {
    if (goal.done === null && GOALS[goal.type](world, goal)) {
      goal.done = now;
      met.push(goal.id);
    }
  }
  if (mission.goals.some((goal) => goal.done === null)) return { met, done: false };
  mission.done = now;
  for (const command of mission.reward) applyCommand(world, command);
  return { met, done: true };
}
