import { thing, thingAt } from "../sim/things.js";
import { kindOf, xOf, zOf } from "../sim/terrain.js";

// The world's grid in 3D (PLAN.md §4): one cell is one world unit, x east and z
// south as in the world, with the island's middle at the origin. Heights are
// for drawing only: the world's own heights say where can be walked, these
// where land, water and bridges are drawn. Plain functions of the world, so
// Node can test them.

// The height of each kind of ground's top; water and the gap a bridge will
// fill have none.
export const TOP = { grass: 0.5, sand: 0.4, bridge: 0.5 };
export const WATER_Y = 0.12;
export const FLOOR_Y = -1.2; // how deep the island's sides go, below the water

export const topOf = (terrain, cell) => TOP[kindOf(terrain, cell)] ?? null;

// The middle of the point (cx, cz) in cells, which may be between cells, as a
// robot is on its way.
export const pointAt = (terrain, cx, cz) => ({ x: cx - terrain.width / 2 + 0.5, z: cz - terrain.height / 2 + 0.5 });

export const cellCentre = (terrain, cell) => pointAt(terrain, xOf(terrain, cell), zOf(terrain, cell));

// The middle of footprint `area` ({ x, z, w, d }, in cells).
export const areaCentre = (terrain, { x, z, w, d }) => ({ x: x + w / 2 - terrain.width / 2, z: z + d / 2 - terrain.height / 2 });

// Which way a building or deposit faces: towards the cells robots use it from,
// in quarter turns, as a rotation about y (0 faces +z, south). Returns the
// rotation, and its footprint's size as its model sees it, across and deep.
export function facing(terrain, { area, access }) {
  const centre = areaCentre(terrain, area);
  let dx = 0;
  let dz = 0;
  for (const cell of access) {
    const c = cellCentre(terrain, cell);
    dx += c.x - centre.x;
    dz += c.z - centre.z;
  }
  if (Math.abs(dx) > Math.abs(dz)) return { angle: dx > 0 ? Math.PI / 2 : -Math.PI / 2, across: area.d, deep: area.w };
  return { angle: dz >= 0 ? 0 : Math.PI, across: area.w, deep: area.d };
}

// The way a robot faces, as a rotation about y, from the world as committed:
// along the cell it's walking, or towards the building or deposit it's at.
// Null when neither says, and it keeps the way it faced.
export function headingOf(world, robot) {
  const { terrain } = world;
  const a = robot.action;
  if (a?.type === "move" && a.path.length > 1) {
    const walked = Math.max(0, world.tick - a.start);
    const leg = Math.min(Math.floor(walked / a.perCell), a.path.length - 2);
    const from = cellCentre(terrain, a.path[leg]);
    const to = cellCentre(terrain, a.path[leg + 1]);
    return Math.atan2(to.x - from.x, to.z - from.z);
  }
  // Sending a pulse: towards the robot it's for.
  const target = a?.type === "fire" ? thing(world, a.at) : null;
  if (target && target.cell !== robot.cell) {
    const from = cellCentre(terrain, robot.cell);
    const to = cellCentre(terrain, target.cell);
    return Math.atan2(to.x - from.x, to.z - from.z);
  }
  const at = thingAt(world, robot.cell);
  if (!at) return null;
  const here = cellCentre(terrain, robot.cell);
  const there = areaCentre(terrain, at.area);
  return Math.atan2(there.x - here.x, there.z - here.z);
}

// Small offsets, in world units, for robots standing on one cell, so each can
// be seen (PLAN.md §4): Map robot id → { x, z }. Robots on their way pass
// through one another without them.
export function sharedSpots(world) {
  const byCell = new Map();
  for (const e of world.entities) {
    if (e.kind !== "robot" || e.action?.type === "move") continue;
    if (!byCell.has(e.cell)) byCell.set(e.cell, []);
    byCell.get(e.cell).push(e.id);
  }
  const spots = new Map();
  for (const ids of byCell.values()) {
    if (ids.length < 2) continue;
    ids.forEach((id, i) => {
      const a = (i / ids.length) * Math.PI * 2;
      spots.set(id, { x: Math.round(Math.sin(a) * 25) / 100, z: Math.round(Math.cos(a) * 25) / 100 });
    });
  }
  return spots;
}

// Where `robot` is going: the thing its move is to, or null.
export const destinationOf = (world, robot) => (robot.action?.type === "move" ? thing(world, robot.action.target) : (robot.pending?.intent.type === "goTo" ? thing(world, robot.pending.intent.target) : null));
