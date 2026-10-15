import * as THREE from "three";
import { createBoulder, createTree, mesh } from "./models.js";

// Items you can see (PLAN.md §4): what every store holds, stacked on a pad
// beside the building or deposit, as many as it has; and the grove and the
// stone pit themselves. A store's items are its committed counts, so a paused
// world shows exactly what it holds.

// Each item's look, small enough to stack, and the room it takes, across, high
// and deep.
const ITEMS = {
  wood: { make: () => new THREE.CylinderGeometry(0.06, 0.07, 0.3, 6).rotateZ(Math.PI / 2), material: "log", size: [0.32, 0.13, 0.15] },
  stone: { make: () => new THREE.DodecahedronGeometry(0.08, 0), material: "stone", size: [0.17, 0.14, 0.17] },
  plank: { make: () => new THREE.BoxGeometry(0.34, 0.045, 0.1), material: "plank", size: [0.36, 0.05, 0.12] },
  kit: { make: () => new THREE.BoxGeometry(0.15, 0.13, 0.15), material: "kit", size: [0.17, 0.14, 0.17] },
};
const geometries = new Map();
export const itemGeometry = (item) => {
  if (!geometries.has(item)) geometries.set(item, ITEMS[item].make());
  return geometries.get(item);
};
export const itemMaterial = (m, item) => m[ITEMS[item].material];

// Where `count` items of `size` [across, high, deep] go on a pad `pad`
// ({ w, d }, centred on 0): rows across, then deeper, then a layer higher.
// Returns [[x, y, z], …], each the middle of an item.
export function stackSlots(count, size, pad) {
  const [sx, sy, sz] = size;
  const across = Math.max(1, Math.floor(pad.w / sx));
  const deep = Math.max(1, Math.floor(pad.d / sz));
  const slots = [];
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / (across * deep));
    const inLayer = i % (across * deep);
    const row = Math.floor(inLayer / across);
    const col = inLayer % across;
    slots.push([(col - (across - 1) / 2) * sx, layer * sy + sy / 2, (row - (deep - 1) / 2) * sz]);
  }
  return slots;
}

// A stock of items on pads: `pads` { item: { x, y, z, w, d } } in the model's
// own frame, `caps` { item: most }. update(items) shows the counts in `items`.
export function createStock(m, caps, pads) {
  const group = new THREE.Group();
  const piles = [];
  const matrix = new THREE.Matrix4();
  for (const [item, most] of Object.entries(caps)) {
    const pad = pads[item];
    if (!pad || !ITEMS[item] || !most) continue;
    const pile = new THREE.InstancedMesh(itemGeometry(item), itemMaterial(m, item), most);
    pile.castShadow = true;
    pile.frustumCulled = false; // its items are spread round the pad, not at its origin
    stackSlots(most, ITEMS[item].size, pad).forEach(([x, y, z], i) => pile.setMatrixAt(i, matrix.makeTranslation(pad.x + x, (pad.y ?? 0) + y, pad.z + z)));
    pile.count = 0;
    piles.push({ item, pile, most });
    group.add(pile);
  }
  let shown = "";
  return {
    group,
    // Whether anything changed.
    update(items) {
      const key = piles.map(({ item }) => items[item] ?? 0).join(",");
      if (key === shown) return false;
      shown = key;
      for (const { item, pile, most } of piles) pile.count = Math.min(most, items[item] ?? 0);
      return true;
    },
  };
}

// The grove: trees over its footprint, `across` by `deep`, and the wood it has
// stacked along its front.
export function createGrove(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const spots = [
    [-0.32, -0.3, 0.62, false],
    [0.12, -0.34, 0.55, true],
    [0.36, -0.05, 0.6, false],
    [-0.1, 0.02, 0.66, true],
    [-0.36, 0.12, 0.5, false],
  ];
  spots.forEach(([fx, fz, s, light], i) => {
    const tree = createTree(m, i * 1.7, light);
    tree.position.set(fx * across, 0, fz * deep);
    tree.scale.setScalar(s);
    group.add(tree);
  });
  const stock = createStock(m, caps, { wood: { x: 0, z: deep / 2 - 0.35, w: across - 0.5, d: 0.5 } });
  group.add(stock.group);
  return { group, top: 1.7, update: (world, node) => stock.update(node.store.items) };
}

// The stone pit: boulders at its back, and its stones heaped at its front.
export function createQuarry(m, { across, deep, caps }) {
  const group = new THREE.Group();
  [
    [-0.28, -0.25, 0.75],
    [0.25, -0.3, 0.6],
    [0.05, -0.05, 0.5],
  ].forEach(([fx, fz, s], i) => {
    const boulder = createBoulder(m, i * 1.3);
    boulder.position.set(fx * across, 0, fz * deep);
    boulder.scale.multiplyScalar(s);
    group.add(boulder);
  });
  const floor = mesh(new THREE.BoxGeometry(across - 0.2, 0.04, deep - 0.2), m.dirt, { cast: false, receive: true });
  floor.position.y = 0.02;
  group.add(floor);
  const stock = createStock(m, caps, { stone: { x: 0, y: 0.04, z: deep / 2 - 0.4, w: across - 0.5, d: 0.6 } });
  group.add(stock.group);
  return { group, top: 1.1, update: (world, node) => stock.update(node.store.items) };
}
