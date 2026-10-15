import * as THREE from "three";
import { kindOf, xOf, zOf } from "../sim/terrain.js";
import { FLOOR_Y, TOP, WATER_Y, cellCentre, topOf } from "./grid.js";

// The island's ground, drawn from the world's terrain (PLAN.md §4): every cell
// of land a flat top in its colour, with sides down to the neighbours lower than
// it, or below the water at the shore. One mesh for the whole island, so one draw
// call. The water is a plane round it; a built bridge is a wooden deck over the
// stream, and the gap it will fill a pale blueprint of it until then.

// Two shades of each top, in a checker, so the grid can be counted; and the
// colours of the sides.
const TOPS = { grass: [0x7dbb5d, 0x74b255], sand: [0xe6cd94, 0xddc387] };
const SIDES = { shore: 0xb8945c, step: 0xcfb07a };

// North, east, south, west, each with its edge's two ends as seen from outside
// it, left then right, as offsets from the cell's west-north corner.
const EDGES = [
  { dx: 0, dz: -1, p: [1, 0], q: [0, 0] },
  { dx: 1, dz: 0, p: [1, 1], q: [1, 0] },
  { dx: 0, dz: 1, p: [0, 1], q: [1, 1] },
  { dx: -1, dz: 0, p: [0, 0], q: [0, 1] },
];

// The land's geometry for `terrain`: non-indexed triangles, so every face is
// flat, with a colour for each vertex. A bridge isn't land here (bridgeParts).
export function terrainGeometry(terrain) {
  const { width, height } = terrain;
  const positions = [];
  const colours = [];
  const colour = new THREE.Color();
  const tri = (a, b, c, hex) => {
    positions.push(...a, ...b, ...c);
    colour.setHex(hex);
    for (let i = 0; i < 3; i++) colours.push(colour.r, colour.g, colour.b);
  };
  const quad = (a, b, c, d, hex) => {
    tri(a, b, c, hex);
    tri(a, c, d, hex);
  };
  // The top of the land at (x, z), or null for water, a bridge, or off the map.
  const land = (x, z) => {
    if (x < 0 || z < 0 || x >= width || z >= height) return null;
    const kind = kindOf(terrain, z * width + x);
    return TOPS[kind] ? TOP[kind] : null;
  };

  for (let cell = 0; cell < width * height; cell++) {
    const kind = kindOf(terrain, cell);
    if (!TOPS[kind]) continue;
    const t = topOf(terrain, cell);
    const cx = xOf(terrain, cell);
    const cz = zOf(terrain, cell);
    const x0 = cx - width / 2;
    const z0 = cz - height / 2;
    quad([x0, t, z0], [x0, t, z0 + 1], [x0 + 1, t, z0 + 1], [x0 + 1, t, z0], TOPS[kind][(cx + cz) % 2]);
    for (const { dx, dz, p, q } of EDGES) {
      const next = land(cx + dx, cz + dz);
      const bottom = next ?? FLOOR_Y;
      if (bottom >= t) continue;
      const P = [x0 + p[0], z0 + p[1]];
      const Q = [x0 + q[0], z0 + q[1]];
      quad([P[0], t, P[1]], [P[0], bottom, P[1]], [Q[0], bottom, Q[1]], [Q[0], t, Q[1]], next === null ? SIDES.shore : SIDES.step);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// The cells of bridges built and still to build, each with the way it runs:
// [{ cell, built, across }], `across` true when it runs east to west.
export function bridgeParts(terrain) {
  const { width, height } = terrain;
  const parts = [];
  for (let cell = 0; cell < width * height; cell++) {
    const kind = kindOf(terrain, cell);
    if (kind !== "bridge" && kind !== "gap") continue;
    const x = xOf(terrain, cell);
    const z = zOf(terrain, cell);
    const sideways = (dx) => {
      const k = x + dx >= 0 && x + dx < width ? kindOf(terrain, z * width + x + dx) : "water";
      return k !== "water";
    };
    parts.push({ cell, built: kind === "bridge", across: sideways(-1) || sideways(1) });
  }
  return parts;
}

// The ground of `terrain`, water and bridges, with `m` the view's materials
// (models.js). update() redraws it when the terrain has changed, as when a
// bridge is built.
export function createTerrain(m) {
  const group = new THREE.Group();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), m.sea);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  const land = new THREE.Mesh(new THREE.BufferGeometry(), m.ground);
  land.receiveShadow = true;
  land.castShadow = true;
  const bridges = new THREE.Group();
  group.add(water, land, bridges);

  const deck = new THREE.BoxGeometry(1.02, 0.14, 0.86);
  const rail = new THREE.BoxGeometry(1.02, 0.08, 0.06);
  const post = new THREE.BoxGeometry(0.08, 0.32, 0.08);
  let drawn = null;

  return {
    group,
    // Whether anything changed.
    update(terrain) {
      if (drawn === terrain.kinds) return false;
      drawn = terrain.kinds;
      land.geometry.dispose();
      land.geometry = terrainGeometry(terrain);
      bridges.clear();
      for (const { cell, built, across } of bridgeParts(terrain)) {
        const { x, z } = cellCentre(terrain, cell);
        const part = new THREE.Group();
        part.position.set(x, TOP.bridge, z);
        part.rotation.y = across ? 0 : Math.PI / 2;
        const add = (geometry, material, px, py, pz) => {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(px, py, pz);
          mesh.castShadow = built;
          mesh.receiveShadow = built;
          part.add(mesh);
        };
        const material = built ? m.wood : m.blueprint;
        add(deck, material, 0, -0.07, 0);
        for (const side of [-1, 1]) {
          add(rail, material, 0, 0.28, side * 0.43);
          add(post, material, 0, 0.14, side * 0.43);
        }
        bridges.add(part);
      }
      return true;
    },
    dispose() {
      for (const g of [deck, rail, post]) g.dispose();
    },
  };
}
