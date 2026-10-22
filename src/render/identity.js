// How robots are told apart, the same in the 3D world, on their labels and on
// the editor's markers (PLAN.md §8): a colour, the ink to write on it, and a
// shape for those who can't tell the colours apart. Robots take them in order
// of id; buildings and deposits have none.
export const IDENTITIES = [
  { colour: "#c2410c", ink: "#ffffff", shape: "circle" },
  { colour: "#1864ab", ink: "#ffffff", shape: "square" },
  { colour: "#24733a", ink: "#ffffff", shape: "triangle" },
  { colour: "#7c3aed", ink: "#ffffff", shape: "diamond" },
  { colour: "#a1460a", ink: "#ffffff", shape: "square" },
  { colour: "#0f6b78", ink: "#ffffff", shape: "triangle" },
];

// A building's marker: one look for every building, since each runs a program
// of its own and is told apart by its name.
export const BUILDING_MARK = { colour: "#475467", ink: "#ffffff", shape: "house" };

// The opponent's robots: all one look, dark, with a cross, never one of the
// player's (src/sim/combat.js).
export const OPPONENT = { colour: "#3b3540", ink: "#ffffff", shape: "cross" };

// The player's robots take the identities in order of id; the opponent's are
// left out of the count, so a visitor arriving changes no one else's.
export function identityOf(world, id) {
  const robot = world.entities.find((e) => e.id === id);
  if (robot?.side === "opponent") return OPPONENT;
  const robots = world.entities.filter((e) => e.kind === "robot" && e.side !== "opponent");
  const i = robots.findIndex((e) => e.id === id);
  return i < 0 ? null : IDENTITIES[i % IDENTITIES.length];
}

// What marks entity `id` on the editor's markers: a robot's identity, or the
// building mark.
export const markOf = (world, id) => identityOf(world, id) ?? BUILDING_MARK;
