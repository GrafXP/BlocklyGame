import * as THREE from "three";
import { TOP, areaCentre, cellCentre, facing, topOf } from "./grid.js";

// What's selected and what the pointer is over, marked on the ground
// (PLAN.md §8): an outline round a building's or deposit's footprint with the
// cells robots use it from, a ring under a robot, and, for a robot on its way,
// the cells still to walk and an outline round where it's going. Marks lie just
// above the ground and never hide what's on it.

const SELECTED = 0xf6b73c;
const HOVER = 0xffffff;
const ROUTE = 0xffffff;

// A flat frame round a `w` by `d` rectangle, `thickness` wide, centred on the
// origin and lying on y = 0.
export function frameGeometry(w, d, thickness) {
  const shape = new THREE.Shape()
    .moveTo(-w / 2 - thickness, -d / 2 - thickness)
    .lineTo(w / 2 + thickness, -d / 2 - thickness)
    .lineTo(w / 2 + thickness, d / 2 + thickness)
    .lineTo(-w / 2 - thickness, d / 2 + thickness)
    .closePath();
  shape.holes.push(new THREE.Path().moveTo(-w / 2, -d / 2).lineTo(-w / 2, d / 2).lineTo(w / 2, d / 2).lineTo(w / 2, -d / 2).closePath());
  return new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
}

const markMaterial = (color, opacity) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });

export function createMarks() {
  const group = new THREE.Group();
  group.renderOrder = 1;
  const materials = { selected: markMaterial(SELECTED, 0.95), hover: markMaterial(HOVER, 0.7), route: markMaterial(ROUTE, 0.75), access: markMaterial(SELECTED, 0.55) };
  const geometries = new Map();
  const geometry = (key, make) => {
    if (!geometries.has(key)) geometries.set(key, make());
    return geometries.get(key);
  };
  const ring = (inner, outer) => geometry(`ring ${inner} ${outer}`, () => new THREE.RingGeometry(inner, outer, 32).rotateX(-Math.PI / 2));
  const frame = (w, d, t) => geometry(`frame ${w} ${d} ${t}`, () => frameGeometry(w, d, t));
  const dot = () => geometry("dot", () => new THREE.CircleGeometry(0.09, 12).rotateX(-Math.PI / 2));

  const add = (g, material, x, y, z) => {
    const m = new THREE.Mesh(g, material);
    m.position.set(x, y + 0.02, z);
    m.renderOrder = 1;
    group.add(m);
    return m;
  };

  // An outline round thing `t`'s footprint, `t` ground thick.
  function outline(world, t, material, thickness) {
    const { terrain } = world;
    const { x, z } = areaCentre(terrain, t.area);
    const { angle, across, deep } = facing(terrain, t);
    const top = topOf(terrain, t.access[0]) ?? TOP.grass;
    add(frame(across + 0.1, deep + 0.1, thickness), material, x, top, z).rotation.y = angle;
  }

  let shown = "";
  return {
    group,
    // Marks `selected` and `hover` (ids or null) in `world`, a robot at its
    // drawn place `at(id)` ({ x, y, z }). Returns whether the marks changed.
    update(world, selected, hover, at) {
      const things = [...world.entities, ...world.nodes];
      const find = (id) => things.find((t) => t.id === id) ?? null;
      const sel = find(selected);
      const over = hover === selected ? null : find(hover);
      const robotAt = (id) => {
        const p = at(id);
        return p ? `${p.x.toFixed(3)} ${p.z.toFixed(3)}` : "";
      };
      const route = sel?.kind === "robot" ? sel.action?.type === "move" && sel.action : null;
      const key = [selected, hover, sel?.kind === "robot" ? robotAt(selected) : "", over?.kind === "robot" ? robotAt(hover) : "", route ? `${route.target} ${route.path.join(",")} ${world.tick}` : ""].join("|");
      if (key === shown) return false;
      shown = key;
      group.clear();
      const { terrain } = world;
      for (const [t, material, thickness] of [
        [over, materials.hover, 0.06],
        [sel, materials.selected, 0.1],
      ]) {
        if (!t) continue;
        if (t.kind === "robot") {
          const p = at(t.id);
          if (p) add(ring(0.4, 0.4 + thickness), material, p.x, p.y, p.z);
        } else {
          outline(world, t, material, thickness);
          if (t === sel) {
            for (const cell of t.access) {
              const c = cellCentre(terrain, cell);
              add(frame(0.56, 0.56, 0.06), materials.access, c.x, topOf(terrain, cell) ?? TOP.grass, c.z);
            }
          }
        }
      }
      // A robot on its way: the cells it has still to walk, and where it's going.
      if (route) {
        const walked = Math.floor((world.tick - route.start) / route.perCell);
        for (const cell of route.path.slice(walked + 1)) {
          const c = cellCentre(terrain, cell);
          add(dot(), materials.route, c.x, topOf(terrain, cell) ?? TOP.grass, c.z);
        }
        const target = find(route.target);
        if (target?.area) outline(world, target, materials.route, 0.05);
      }
      return true;
    },
    dispose() {
      for (const g of geometries.values()) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
    },
  };
}
