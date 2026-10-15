import { areaCells, groundWalkable, stepCost, xOf, zOf } from "./terrain.js";

// Finding the way (PLAN.md §4): A* over the cell grid, with whole-number costs,
// neighbours always tried in the same order and ties broken the same way, so the
// same world gives the same path on every machine. Robots don't block each other;
// buildings and deposits block the cells under them.

// Which cells can be walked on: walkable ground outside every footprint. It only
// changes with the world's navigation revision (world.nav), so it's worked out
// once per revision.
const cache = new WeakMap();
export function walkable(world) {
  const hit = cache.get(world);
  if (hit && hit.nav === world.nav && hit.kinds === world.terrain.kinds) return hit.walk;
  const { terrain } = world;
  const walk = new Uint8Array(terrain.width * terrain.height);
  for (let cell = 0; cell < walk.length; cell++) walk[cell] = groundWalkable(terrain, cell) ? 1 : 0;
  for (const t of [...world.entities, ...world.nodes]) {
    if (t.area) for (const cell of areaCells(terrain, t.area)) walk[cell] = 0;
  }
  cache.set(world, { nav: world.nav, kinds: terrain.kinds, walk });
  return walk;
}

// North, east, south, west: the order neighbours are tried in.
const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// The cheapest way from cell `from` to the nearest of cells `goals`, as the cells
// along it, `from` first and the goal last; [from] if it's already at one; null
// if none can be reached. Among ways that cost the same, the one found first wins:
// the open cell with the lowest estimate, then the nearest the goals, then the
// one seen first.
export function findPath(world, from, goals) {
  const { terrain } = world;
  const walk = walkable(world);
  const targets = goals.filter((cell) => walk[cell]);
  if (!targets.length) return null;
  if (targets.includes(from)) return [from];
  const tx = targets.map((cell) => xOf(terrain, cell));
  const tz = targets.map((cell) => zOf(terrain, cell));
  const estimate = (cell) => {
    const x = xOf(terrain, cell);
    const z = zOf(terrain, cell);
    let best = Infinity;
    for (let i = 0; i < targets.length; i++) best = Math.min(best, Math.abs(x - tx[i]) + Math.abs(z - tz[i]));
    return best;
  };

  const size = terrain.width * terrain.height;
  const cost = new Int32Array(size).fill(-1);
  const came = new Int32Array(size).fill(-1);
  const done = new Uint8Array(size);
  const open = createHeap();
  let seen = 0;
  cost[from] = 0;
  open.push([estimate(from), estimate(from), seen++, from]);
  while (open.size) {
    const [, , , cell] = open.pop();
    if (done[cell]) continue;
    done[cell] = 1;
    if (targets.includes(cell)) {
      const path = [cell];
      for (let c = came[cell]; c !== -1; c = came[c]) path.push(c);
      return path.reverse();
    }
    const x = xOf(terrain, cell);
    const z = zOf(terrain, cell);
    for (const [dx, dz] of STEPS) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= terrain.width || nz >= terrain.height) continue;
      const next = nz * terrain.width + nx;
      if (!walk[next] || done[next]) continue;
      const through = cost[cell] + stepCost(terrain, next);
      if (cost[next] !== -1 && through >= cost[next]) continue;
      cost[next] = through;
      came[next] = cell;
      const h = estimate(next);
      open.push([through + h, h, seen++, next]);
    }
  }
  return null;
}

// A binary heap of [estimate, nearness, order, cell], smallest first, comparing
// in that order.
function createHeap() {
  const items = [];
  const less = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  return {
    get size() {
      return items.length;
    },
    push(item) {
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (less(items[i], items[parent]) >= 0) break;
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let least = i;
          if (l < items.length && less(items[l], items[least]) < 0) least = l;
          if (r < items.length && less(items[r], items[least]) < 0) least = r;
          if (least === i) break;
          [items[i], items[least]] = [items[least], items[i]];
          i = least;
        }
      }
      return top;
    },
  };
}
