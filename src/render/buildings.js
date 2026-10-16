import * as THREE from "three";
import { mesh } from "./models.js";
import { createStock } from "./resources.js";

// The buildings (PLAN.md §4): camp, depot, sawmill, workshop and construction
// site, each sized to its footprint, `across` by `deep` as it faces its front
// (+z, grid.js facing), with its store stacked on pads in front. Each is
// { group, top, update(world, entity, t) }: `top` how high its label goes, and
// update() shows the world at `t`, a tick and the fraction of the next. Only
// tick-derived things move, so a paused world stands still.

// How far `entity`'s action has got at `t`, from 0 to 1, or null with none.
const progress = (entity, t, type) => {
  const a = entity.action;
  if (!a || (type && a.type !== type)) return null;
  return Math.max(0, Math.min(1, (t - a.start) / (a.end - a.start)));
};

function camp(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const yard = mesh(new THREE.BoxGeometry(across - 0.15, 0.05, deep - 0.15), m.dirt, { cast: false, receive: true });
  yard.position.y = 0.025;
  group.add(yard);
  const tent = new THREE.ConeGeometry(0.42, 0.7, 4);
  for (const x of [-0.45, 0.45]) {
    const t = mesh(tent, m.canvas);
    t.position.set(x * (across / 2), 0.4, -deep / 2 + 0.5);
    t.rotation.y = Math.PI / 4;
    group.add(t);
  }
  const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), m.trunk);
  pole.position.set(0, 0.65, -deep / 2 + 0.3);
  const flag = mesh(new THREE.BoxGeometry(0.4, 0.24, 0.02), m.accent);
  flag.position.set(0.21, 1.15, -deep / 2 + 0.3);
  group.add(pole, flag);
  const width = (across - 0.3) / 3;
  const stock = createStock(m, caps, {
    wood: { x: -width, y: 0.05, z: deep / 2 - 0.45, w: width - 0.05, d: 0.6 },
    stone: { x: 0, y: 0.05, z: deep / 2 - 0.45, w: width - 0.05, d: 0.6 },
    plank: { x: width, y: 0.05, z: deep / 2 - 0.45, w: width - 0.05, d: 0.6 },
  });
  group.add(stock.group);
  return { group, top: 1.4, update: (world, e) => stock.update(e.store.items) };
}

function depot(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const platform = mesh(new THREE.BoxGeometry(across - 0.1, 0.2, deep - 0.1), m.wood, { receive: true });
  platform.position.y = 0.1;
  const post = mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), m.trunk);
  post.position.set(across / 2 - 0.15, 0.75, -deep / 2 + 0.15);
  const sign = mesh(new THREE.BoxGeometry(0.6, 0.34, 0.06), m.accent);
  sign.position.set(across / 2 - 0.45, 1.15, -deep / 2 + 0.15);
  group.add(platform, post, sign);
  const w = (across - 0.4) / 2;
  const d = (deep - 0.4) / 2;
  const stock = createStock(m, caps, {
    wood: { x: -w / 2 - 0.05, y: 0.2, z: -d / 2 - 0.05, w, d },
    stone: { x: w / 2 + 0.05, y: 0.2, z: -d / 2 - 0.05, w, d },
    plank: { x: -w / 2 - 0.05, y: 0.2, z: d / 2 + 0.05, w, d },
    kit: { x: w / 2 + 0.05, y: 0.2, z: d / 2 + 0.05, w, d },
  });
  group.add(stock.group);
  return { group, top: 1.5, update: (world, e) => stock.update(e.store.items) };
}

function sawmill(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const hutZ = -deep / 2 + 0.6;
  const hut = mesh(new THREE.BoxGeometry(across - 1, 1.1, 1.0), m.shell, { receive: true });
  hut.position.set(0, 0.55, hutZ);
  const roof = mesh(new THREE.ConeGeometry(1.2, 0.7, 4), m.roof);
  roof.position.set(0, 1.45, hutZ);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set((across - 0.8) / 1.7, 1, 0.8);
  const blade = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 14), m.roofGrey);
  blade.rotation.z = Math.PI / 2;
  blade.position.set(across / 2 - 0.35, 0.45, hutZ);
  const bench = mesh(new THREE.BoxGeometry(0.16, 0.3, 0.9), m.wood);
  bench.position.set(across / 2 - 0.35, 0.15, hutZ);
  group.add(hut, roof, blade, bench);
  const stock = createStock(m, caps, {
    wood: { x: -across / 4, y: 0, z: deep / 2 - 0.4, w: across / 2 - 0.3, d: 0.6 },
    plank: { x: across / 4, y: 0, z: deep / 2 - 0.4, w: across / 2 - 0.3, d: 0.6 },
  });
  group.add(stock.group);
  return {
    group,
    top: 2.0,
    update(world, e, t) {
      // The blade turns while a plank is being made, by the world's clock.
      if (e.action?.type === "make") blade.rotation.x = (t - e.action.start) * 0.9;
      return stock.update(e.store.items) || e.action?.type === "make";
    },
  };
}

function site(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const slab = mesh(new THREE.BoxGeometry(across - 0.2, 0.12, deep - 0.2), m.stone, { receive: true });
  slab.position.y = 0.06;
  group.add(slab);
  const scaffold = new THREE.Group();
  const post = new THREE.BoxGeometry(0.07, 1.2, 0.07);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const p = mesh(post, m.scaffold);
    p.position.set(sx * (across / 2 - 0.2), 0.72, sz * (deep / 2 - 0.2));
    scaffold.add(p);
  }
  // A frame of beams that rises as the bridge gets built.
  const frame = new THREE.Group();
  for (const [w, d, x, z] of [
    [across - 0.3, 0.06, 0, -(deep / 2 - 0.2)],
    [across - 0.3, 0.06, 0, deep / 2 - 0.2],
    [0.06, deep - 0.3, -(across / 2 - 0.2), 0],
    [0.06, deep - 0.3, across / 2 - 0.2, 0],
  ]) {
    const beam = mesh(new THREE.BoxGeometry(w, 0.06, d), m.scaffold);
    beam.position.set(x, 0, z);
    frame.add(beam);
  }
  frame.position.y = 0.2;
  scaffold.add(frame);
  const flag = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), m.trunk);
  pole.position.y = 0.67;
  const cloth = mesh(new THREE.BoxGeometry(0.36, 0.22, 0.02), m.accent);
  cloth.position.set(0.19, 1.1, 0);
  flag.add(pole, cloth);
  flag.visible = false;
  group.add(scaffold, flag);
  // A bridge's site stacks its planks across the slab; a building's, its planks
  // and its stone side by side.
  const pads = caps.stone
    ? { plank: { x: -across / 4, y: 0.12, z: 0.15, w: across / 2 - 0.35, d: deep - 0.8 }, stone: { x: across / 4, y: 0.12, z: 0.15, w: across / 2 - 0.35, d: deep - 0.8 } }
    : { plank: { x: 0, y: 0.12, z: 0.15, w: across - 0.6, d: deep - 0.8 } };
  const stock = createStock(m, caps, pads);
  group.add(stock.group);
  return {
    group,
    top: 1.5,
    update(world, e, t) {
      const done = progress(e, t, "make");
      const y = 0.2 + 0.95 * (done ?? 0);
      const moved = frame.position.y !== y || scaffold.visible === !!e.built;
      frame.position.y = y;
      scaffold.visible = !e.built;
      flag.visible = !!e.built;
      return stock.update(e.store.items) || moved;
    },
  };
}

// The workshop: a small hut with a pitched roof and a chimney, a workbench in
// front of it where a kit takes shape while one is being made, and its store:
// planks and stone waiting, and kits on a shelf.
function workshop(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const hutZ = -deep / 2 + 0.5;
  const hut = mesh(new THREE.BoxGeometry(across - 0.9, 0.85, 0.85), m.shell, { receive: true });
  hut.position.set(-0.25, 0.425, hutZ);
  const roof = mesh(new THREE.ConeGeometry(0.95, 0.5, 4), m.roof);
  roof.position.set(-0.25, 1.1, hutZ);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set((across - 0.7) / 1.35, 1, 0.75);
  const chimney = mesh(new THREE.BoxGeometry(0.16, 0.45, 0.16), m.roofGrey);
  chimney.position.set(-0.9, 1.25, hutZ - 0.1);
  const bench = mesh(new THREE.BoxGeometry(0.8, 0.32, 0.42), m.wood);
  bench.position.set(across / 2 - 0.55, 0.16, hutZ + 0.15);
  // The kit being made, on the bench: it grows as the work goes on.
  const making = mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), m.kit);
  making.position.set(across / 2 - 0.55, 0.42, hutZ + 0.15);
  making.visible = false;
  const shelf = mesh(new THREE.BoxGeometry(0.85, 0.05, 0.5), m.wood);
  shelf.position.set(across / 3, 0.3, deep / 2 - 0.4);
  group.add(hut, roof, chimney, bench, making, shelf);
  const stock = createStock(m, caps, {
    plank: { x: -across / 3, y: 0, z: deep / 2 - 0.4, w: across / 3 - 0.15, d: 0.6 },
    stone: { x: 0, y: 0, z: deep / 2 - 0.4, w: across / 3 - 0.2, d: 0.5 },
    kit: { x: across / 3, y: 0.32, z: deep / 2 - 0.4, w: 0.8, d: 0.45 },
  });
  group.add(stock.group);
  return {
    group,
    top: 1.6,
    update(world, e, t) {
      const done = progress(e, t, "make");
      const scale = done === null ? 0 : 0.35 + 0.65 * done;
      const moved = making.visible !== (done !== null) || making.scale.x !== scale;
      making.visible = done !== null;
      if (done !== null) making.scale.setScalar(scale);
      return stock.update(e.store.items) || moved;
    },
  };
}

export const BUILDINGS = { camp, depot, sawmill, site, workshop };
