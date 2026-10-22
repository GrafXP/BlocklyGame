import * as THREE from "three";
import { mesh } from "./models.js";
import { createStock, itemGeometry as itemShape } from "./resources.js";

// The buildings (PLAN.md §4): camp, depot, sawmill, workshop, construction
// site, well, farm, fuel station, stonecutter, kiln and smelter, each sized
// to its footprint, `across` by `deep` as it faces its front
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
  // Two rows of pads: wood, stone and planks at the front, and water, food and
  // charge packs behind them.
  const width = (across - 0.3) / 3;
  const pad = (x, z) => ({ x, y: 0.05, z, w: width - 0.05, d: 0.32 });
  const front = deep / 2 - 0.3;
  const back = deep / 2 - 0.7;
  const stock = createStock(m, caps, {
    wood: pad(-width, front),
    stone: pad(0, front),
    plank: pad(width, front),
    water: pad(-width, back),
    food: pad(0, back),
    pack: pad(width, back),
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
  // Two rows of three pads: wood, stone and planks at the back, kits, iron
  // bars and charge packs at the front.
  const w = (across - 0.4) / 3;
  const d = (deep - 0.4) / 2;
  const pad = (col, row) => ({ x: (col - 1) * (w + 0.05), y: 0.2, z: (row - 0.5) * (d + 0.1), w, d });
  const stock = createStock(m, caps, { wood: pad(0, 0), stone: pad(1, 0), plank: pad(2, 0), kit: pad(0, 1), iron: pad(1, 1), pack: pad(2, 1) });
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
  // and its other piece side by side: the workshop's stone, the smelter's
  // stone blocks.
  const other = Object.keys(caps).find((item) => item !== "plank");
  const pads = other
    ? { plank: { x: -across / 4, y: 0.12, z: 0.15, w: across / 2 - 0.35, d: deep - 0.8 }, [other]: { x: across / 4, y: 0.12, z: 0.15, w: across / 2 - 0.35, d: deep - 0.8 } }
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

// The well: a ring of stone with a little roof on two posts and a bucket on a
// rope that goes down while it draws water, and its buckets beside it.
function well(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const z = -deep / 2 + 0.6;
  const ring = mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.45, 12), m.stone, { receive: true });
  ring.position.set(-0.2, 0.225, z);
  const hole = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 12), m.water, { cast: false });
  hole.position.set(-0.2, 0.43, z);
  const post = new THREE.BoxGeometry(0.07, 0.95, 0.07);
  const posts = [-0.62, 0.22].map((x) => {
    const p = mesh(post, m.trunk);
    p.position.set(x, 0.48, z);
    return p;
  });
  const roof = mesh(new THREE.ConeGeometry(0.62, 0.32, 4), m.roof);
  roof.position.set(-0.2, 1.1, z);
  roof.rotation.y = Math.PI / 4;
  const bucket = mesh(itemShape("water"), m.water);
  bucket.position.set(-0.2, 0.75, z);
  group.add(ring, hole, ...posts, roof, bucket);
  const stock = createStock(m, caps, { water: { x: 0.25, y: 0, z: deep / 2 - 0.3, w: across - 0.8, d: 0.45 } });
  group.add(stock.group);
  return {
    group,
    top: 1.5,
    update(world, e, t) {
      const done = progress(e, t, "make");
      const y = done === null ? 0.75 : 0.75 - 0.3 * Math.sin(done * Math.PI);
      const moved = bucket.position.y !== y;
      bucket.position.y = y;
      return stock.update(e.store.items) || moved;
    },
  };
}

// The farm: a little red barn, rows of soil beside it where the crop grows,
// taller while food grows, and its water and its food at the front.
function farm(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const barnX = -across / 2 + 0.45;
  const barnZ = -deep / 2 + 0.45;
  const barn = mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), m.roof, { receive: true });
  barn.position.set(barnX, 0.25, barnZ);
  const top = mesh(new THREE.ConeGeometry(0.48, 0.3, 4), m.roofGrey);
  top.position.set(barnX, 0.65, barnZ);
  top.rotation.y = Math.PI / 4;
  const door = mesh(new THREE.BoxGeometry(0.22, 0.3, 0.02), m.shell, { cast: false });
  door.position.set(barnX, 0.15, barnZ + 0.31);
  group.add(barn, top, door);
  const crops = [];
  const sprout = new THREE.ConeGeometry(0.13, 0.5, 5);
  const fieldX = 0.35;
  const fieldW = across - 1.0;
  for (let i = 0; i < 2; i++) {
    const z = -deep / 2 + 0.3 + i * 0.42;
    const soil = mesh(new THREE.BoxGeometry(fieldW, 0.1, 0.3), m.dirt, { cast: false, receive: true });
    soil.position.set(fieldX, 0.05, z);
    group.add(soil);
    for (let j = 0; j < 4; j++) {
      const c = mesh(sprout, m.crop);
      c.position.set(fieldX + (j - 1.5) * (fieldW / 4), 0.1, z);
      group.add(c);
      crops.push(c);
    }
  }
  const stock = createStock(m, caps, {
    water: { x: -across / 4, y: 0, z: deep / 2 - 0.3, w: across / 2 - 0.3, d: 0.4 },
    food: { x: across / 4, y: 0, z: deep / 2 - 0.3, w: across / 2 - 0.3, d: 0.4 },
  });
  group.add(stock.group);
  let shown = -1;
  return {
    group,
    top: 1.0,
    update(world, e, t) {
      // The crop is small between harvests, and grows while food grows.
      const done = progress(e, t, "make");
      const s = 0.45 + 0.55 * (done ?? 0);
      const moved = s !== shown;
      // Each stands on its row, however tall it is.
      if (moved) {
        for (const c of crops) {
          c.scale.set(1, s, 1);
          c.position.y = 0.1 + 0.25 * s;
        }
      }
      shown = s;
      return stock.update(e.store.items) || moved;
    },
  };
}

// The fuel station: a hut with a lightning sign, a big battery beside it whose
// bolt blinks while it makes charge packs, and food, water and its packs in
// front.
function station(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const hutZ = -deep / 2 + 0.5;
  const hut = mesh(new THREE.BoxGeometry(across - 1, 0.8, 0.8), m.shell, { receive: true });
  hut.position.set(-0.2, 0.4, hutZ);
  const roof = mesh(new THREE.BoxGeometry(across - 0.8, 0.08, 1.0), m.roofGrey);
  roof.position.set(-0.2, 0.84, hutZ);
  const battery = mesh(new THREE.BoxGeometry(0.34, 0.5, 0.2), m.pack);
  battery.position.set(across / 2 - 0.45, 0.25, hutZ);
  const cap = mesh(new THREE.BoxGeometry(0.14, 0.07, 0.12), m.dark);
  cap.position.set(across / 2 - 0.45, 0.535, hutZ);
  const bolt = mesh(new THREE.BoxGeometry(0.08, 0.26, 0.02), m.bolt, { cast: false });
  bolt.position.set(across / 2 - 0.45, 0.27, hutZ + 0.11);
  bolt.rotation.z = 0.35;
  // The sign on the hut's front: a lightning bolt on a dark plate.
  const plate = mesh(new THREE.BoxGeometry(0.42, 0.42, 0.03), m.dark, { cast: false });
  plate.position.set(-0.2, 0.46, hutZ + 0.415);
  const sign = new THREE.Group();
  for (const [x, y, r] of [
    [0.03, 0.07, 0.5],
    [-0.03, -0.07, 0.5],
  ]) {
    const half = mesh(new THREE.BoxGeometry(0.07, 0.18, 0.02), m.bolt, { cast: false });
    half.position.set(x, y, 0);
    half.rotation.z = r;
    sign.add(half);
  }
  sign.position.set(-0.2, 0.46, hutZ + 0.435);
  group.add(hut, roof, battery, cap, bolt, plate, sign);
  const third = (across - 0.3) / 3;
  const stock = createStock(m, caps, {
    food: { x: -third, y: 0, z: deep / 2 - 0.3, w: third - 0.1, d: 0.4 },
    water: { x: 0, y: 0, z: deep / 2 - 0.3, w: third - 0.1, d: 0.4 },
    pack: { x: third, y: 0, z: deep / 2 - 0.3, w: third - 0.1, d: 0.4 },
  });
  group.add(stock.group);
  return {
    group,
    top: 1.3,
    update(world, e, t) {
      // The bolt shows while the work goes on, blinking with the clock.
      const on = e.action?.type === "make" && Math.floor(t - e.action.start) % 4 < 2;
      const moved = bolt.visible !== on;
      bolt.visible = on;
      return stock.update(e.store.items) || moved || e.action?.type === "make";
    },
  };
}

// The stonecutter: a stone bench under a roof on two posts, with a saw that
// turns while it cuts a block on the bench, and raw stone and its blocks in
// front.
function stonecutter(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const z = -deep / 2 + 0.5;
  const bench = mesh(new THREE.BoxGeometry(across - 0.5, 0.35, 0.55), m.stone, { receive: true });
  bench.position.set(0, 0.175, z);
  const post = new THREE.BoxGeometry(0.07, 1.0, 0.07);
  const posts = [-(across / 2 - 0.15), across / 2 - 0.15].map((x) => {
    const p = mesh(post, m.trunk);
    p.position.set(x, 0.5, z - 0.3);
    return p;
  });
  const roof = mesh(new THREE.BoxGeometry(across - 0.1, 0.06, 0.9), m.roofGrey);
  roof.position.set(0, 1.02, z);
  const blade = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 14), m.roofGrey);
  blade.rotation.z = Math.PI / 2;
  blade.position.set(-0.15, 0.5, z);
  // The block being cut, on the bench while the work goes on.
  const cutting = mesh(itemShape("block"), m.block);
  cutting.position.set(0.25, 0.41, z);
  cutting.visible = false;
  group.add(bench, ...posts, roof, blade, cutting);
  const stock = createStock(m, caps, {
    stone: { x: -across / 4, y: 0, z: deep / 2 - 0.3, w: across / 2 - 0.2, d: 0.45 },
    block: { x: across / 4, y: 0, z: deep / 2 - 0.3, w: across / 2 - 0.2, d: 0.45 },
  });
  group.add(stock.group);
  return {
    group,
    top: 1.4,
    update(world, e, t) {
      const on = e.action?.type === "make";
      if (on) blade.rotation.x = (t - e.action.start) * 0.9;
      const moved = cutting.visible !== on;
      cutting.visible = on;
      return stock.update(e.store.items) || moved || on;
    },
  };
}

// The kiln: a mound of earth over the burning wood, whose mouth glows and
// whose smoke rises while it makes charcoal, and its wood and charcoal in
// front.
function kiln(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const z = -deep / 2 + 0.65;
  const mound = mesh(new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m.dirt, { receive: true });
  mound.position.set(0, 0, z);
  const mouth = mesh(new THREE.BoxGeometry(0.24, 0.18, 0.06), m.dark, { cast: false });
  mouth.position.set(0, 0.1, z + 0.57);
  const glow = mesh(new THREE.BoxGeometry(0.16, 0.11, 0.02), m.fire, { cast: false });
  glow.position.set(0, 0.1, z + 0.6);
  glow.visible = false;
  const puffs = [0, 1, 2].map((i) => {
    const puff = mesh(new THREE.IcosahedronGeometry(0.08 + i * 0.03, 0), m.smoke, { cast: false });
    puff.visible = false;
    return puff;
  });
  group.add(mound, mouth, glow, ...puffs);
  const stock = createStock(m, caps, {
    wood: { x: -across / 4, y: 0, z: deep / 2 - 0.25, w: across / 2 - 0.2, d: 0.4 },
    charcoal: { x: across / 4, y: 0, z: deep / 2 - 0.25, w: across / 2 - 0.2, d: 0.4 },
  });
  group.add(stock.group);
  return {
    group,
    top: 1.3,
    update(world, e, t) {
      const on = e.action?.type === "make";
      const moved = glow.visible !== on;
      glow.visible = on;
      // Each puff rises from the top of the mound and starts again, by the clock.
      puffs.forEach((puff, i) => {
        puff.visible = on;
        if (!on) return;
        const k = ((t - e.action.start) * 0.04 + i / 3) % 1;
        puff.position.set(0.08 * Math.sin(k * 6 + i), 0.55 + k * 0.8, z);
      });
      return stock.update(e.store.items) || moved || on;
    },
  };
}

// The smelter: a brick furnace under a stone top with a tall chimney, whose
// mouth glows while it makes iron; its ore, charcoal and water wait in front,
// and the bars it has made lie on a bench beside it.
function smelter(m, { across, deep, caps }) {
  const group = new THREE.Group();
  const z = -deep / 2 + 0.5;
  const x = -across / 2 + 0.8;
  const furnace = mesh(new THREE.BoxGeometry(1.1, 0.85, 0.8), m.roof, { receive: true });
  furnace.position.set(x, 0.425, z);
  const top = mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.35, 8), m.stone);
  top.position.set(x, 1.02, z);
  const chimney = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.7, 8), m.roofGrey);
  chimney.position.set(x, 1.55, z);
  const mouth = mesh(new THREE.BoxGeometry(0.36, 0.26, 0.04), m.dark, { cast: false });
  mouth.position.set(x, 0.3, z + 0.41);
  const glow = mesh(new THREE.BoxGeometry(0.28, 0.18, 0.02), m.fire, { cast: false });
  glow.position.set(x, 0.3, z + 0.44);
  glow.visible = false;
  const bench = mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), m.wood);
  bench.position.set(across / 2 - 0.65, 0.15, z);
  group.add(furnace, top, chimney, mouth, glow, bench);
  const third = (across - 0.3) / 3;
  const stock = createStock(m, caps, {
    ironOre: { x: -third, y: 0, z: deep / 2 - 0.3, w: third - 0.1, d: 0.45 },
    charcoal: { x: 0, y: 0, z: deep / 2 - 0.3, w: third - 0.1, d: 0.45 },
    water: { x: third, y: 0, z: deep / 2 - 0.3, w: third - 0.1, d: 0.45 },
    iron: { x: across / 2 - 0.65, y: 0.3, z, w: 0.8, d: 0.4 },
  });
  group.add(stock.group);
  return {
    group,
    top: 2.0,
    update(world, e) {
      const on = e.action?.type === "make";
      const moved = glow.visible !== on;
      glow.visible = on;
      return stock.update(e.store.items) || moved;
    },
  };
}

export const BUILDINGS = { camp, depot, sawmill, site, workshop, well, farm, station, stonecutter, kiln, smelter };
