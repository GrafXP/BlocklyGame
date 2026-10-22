import { reason } from "./codes.js";
import { walkable } from "./navigation.js";
import { RECIPES } from "./recipes.js";
import { areaCells, cellAt, groundWalkable, inside, kindOf } from "./terrain.js";

// Buildings the player places (PLAN.md §3, §4, §9). A blueprint laid on the
// island becomes a construction site, whose program builds the building from
// the recipe of the same name (recipes.js) once robots have brought what it
// needs; then the site is the building, with the same id and footprint.
//
// Each blueprint has a footprint, `size` [across, deep] as it faces south, and
// the cells along its front are where robots use it from: its interaction cells.
// `caps` is the building's store once it's built. It's laid with its
// footprint's north-west corner at cell (x, z), facing south, west, north or
// east.
// The smelter holds what three batches of iron take, and three batches' bars.
export const BLUEPRINTS = {
  workshop: { size: [3, 2], caps: { plank: 4, stone: 2, kit: 4 } },
  smelter: { size: [3, 2], caps: { ironOre: 6, charcoal: 3, water: 3, iron: 6 } },
};

// The ways a blueprint can face, in the order a quarter turn goes through them.
export const FACINGS = ["south", "west", "north", "east"];

// Whether `request` ({ blueprint, x, z, facing }) names a blueprint, a facing,
// and a cell, whether or not the building fits there.
export const isRequest = (request) =>
  !!BLUEPRINTS[request?.blueprint] && !!RECIPES[request.blueprint]?.builds && FACINGS.includes(request.facing) && Number.isInteger(request.x) && Number.isInteger(request.z);

// Where `request`'s building would stand: its footprint { x, z, w, d } and the
// cells in front of it, [[x, z], …].
export function layout({ blueprint, x, z, facing }) {
  const [across, deep] = BLUEPRINTS[blueprint].size;
  const sideways = facing === "east" || facing === "west";
  const w = sideways ? deep : across;
  const d = sideways ? across : deep;
  const along = (n, cell) => Array.from({ length: n }, (_, i) => cell(i));
  const front = {
    south: () => along(w, (i) => [x + i, z + d]),
    north: () => along(w, (i) => [x + i, z - 1]),
    east: () => along(d, (i) => [x + w, z + i]),
    west: () => along(d, (i) => [x - 1, z + i]),
  }[facing]();
  return { area: { x, z, w, d }, front };
}

// Whether `request`'s building can be placed in `world`: { area, access } with
// its interaction cells, or { problem }, a reason (codes.js). It must stand on
// open ground with open ground in front, clear of every building and deposit
// and of the cells robots use them from, and of robots; and it must cut nobody
// off (PLAN.md §11, Phase 6: invalid placements can't cut off required
// interaction cells). Every building and deposit a robot can reach stays within
// its reach, both now and once every bridge still to be built is there; and
// some robot can reach the new one's front, now or once the bridges are built:
// the room east of the stream can be planned before the bridge opens it.
export function checkPlacement(world, request) {
  const { terrain } = world;
  const { area, front } = layout(request);
  const fail = (code, values) => ({ problem: reason(code, values) });
  const spots = [];
  for (let dz = 0; dz < area.d; dz++) for (let dx = 0; dx < area.w; dx++) spots.push([area.x + dx, area.z + dz]);
  if ([...spots, ...front].some(([x, z]) => !inside(terrain, x, z))) return fail("place.ground");
  const cells = spots.map(([x, z]) => cellAt(terrain, x, z));
  const access = front.map(([x, z]) => cellAt(terrain, x, z));
  if ([...cells, ...access].some((cell) => !groundWalkable(terrain, cell))) return fail("place.ground");

  const things = [...world.entities, ...world.nodes];
  for (const t of things) {
    if (t.area && areaCells(terrain, t.area).some((cell) => cells.includes(cell) || access.includes(cell))) return fail("place.taken", { thing: t.id });
  }
  for (const t of things) {
    if (t.access?.some((cell) => cells.includes(cell))) return fail("place.blocks", { thing: t.id });
  }
  const robots = world.entities.filter((e) => e.kind === "robot");
  for (const r of robots) {
    if (cells.includes(r.cell) || cells.includes(nextCell(world, r))) return fail("place.robot", { robot: r.id });
  }

  const before = walkable(world);
  const after = before.slice();
  for (const cell of cells) after[cell] = 0;
  // The same, with every bridge still to be built walkable.
  const bridged = (walk) => {
    const w = walk.slice();
    for (let cell = 0; cell < w.length; cell++) if (kindOf(terrain, cell) === "gap") w[cell] = 1;
    return w;
  };
  const ways = [
    [before, after],
    [bridged(before), bridged(after)],
  ];
  const places = things.filter((t) => t.access?.length);
  let reached = false;
  for (const r of robots) {
    for (const [was, now] of ways.map(([b, a]) => [reach(terrain, b, r.cell), reach(terrain, a, r.cell)])) {
      for (const t of places) {
        if (t.access.some((cell) => was[cell]) && !t.access.some((cell) => now[cell])) return fail("place.cutOff", { thing: t.id });
      }
      reached ||= access.some((cell) => now[cell]);
    }
  }
  if (!reached) return fail("place.unreachable");
  return { area, access };
}

// The cell robot `r` is stepping onto, on its way, or its own when it stands.
function nextCell(world, r) {
  const a = r.action;
  if (a?.type !== "move") return r.cell;
  const leg = Math.floor(Math.max(0, world.tick - a.start) / a.perCell);
  return a.path[Math.min(leg + 1, a.path.length - 1)];
}

// Every cell that can be walked to from `from` over `walk`, as 1s in an array
// by cell; `from` itself always.
function reach(terrain, walk, from) {
  const seen = new Uint8Array(walk.length);
  const todo = [from];
  seen[from] = 1;
  while (todo.length) {
    const cell = todo.pop();
    const x = cell % terrain.width;
    const z = Math.floor(cell / terrain.width);
    for (const [nx, nz] of [
      [x, z - 1],
      [x + 1, z],
      [x, z + 1],
      [x - 1, z],
    ]) {
      if (!inside(terrain, nx, nz)) continue;
      const next = cellAt(terrain, nx, nz);
      if (walk[next] && !seen[next]) {
        seen[next] = 1;
        todo.push(next);
      }
    }
  }
  return seen;
}

// An id for a new `blueprint` building in `world`: the blueprint's name, or
// with a number after it when that's taken (workshop, workshop-2, …). Returns
// { id, n }.
export function freeId(world, blueprint) {
  const taken = new Set([...world.entities, ...world.nodes].map((t) => t.id));
  for (let n = 1; ; n++) {
    const id = n === 1 ? blueprint : `${blueprint}-${n}`;
    if (!taken.has(id)) return { id, n };
  }
}

// The name of building `what`'s site (`site` true) or of the building, the
// `n`th of its kind: message references, worded when shown (PLAN.md §8).
export function placedName(what, n, site) {
  const key = `entity.${what}${site ? "Site" : ""}`;
  return n === 1 ? { key } : { key: `${key}N`, params: { n } };
}
