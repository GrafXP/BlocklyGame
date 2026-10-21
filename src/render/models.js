import * as THREE from "three";
import { ref } from "../i18n/index.js";

// Models made of simple shapes with flat shading and a small palette (PLAN.md
// §4): the materials every view shares, robots, trees and boulders, and the
// Phase 0 island the editor lab is judged over. Pickable things carry a
// userData.id, which never changes, and a userData.name, a message worded in the
// player's language when shown. Geometry and materials are disposed with the view.

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra });

// A view's materials. tinted(colour) gives one more of the robots' shell
// material in `colour`, once per colour.
export function createMaterials() {
  const tints = new Map();
  return {
    ...MATERIALS(),
    tinted(colour) {
      if (!tints.has(colour)) tints.set(colour, material(colour));
      return tints.get(colour);
    },
  };
}

const MATERIALS = () => ({
  ground: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }),
  blueprint: new THREE.MeshBasicMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.45, depthWrite: false }),
  dirt: material(0xb89a6e),
  canvas: material(0xeee6d3),
  plank: material(0xe0bb83),
  log: material(0x9a6638),
  stone: material(0xa3a9b0),
  kit: material(0xf0a830),
  berry: material(0xd9453b),
  pack: material(0x6cc04a),
  bolt: material(0xf6d03c),
  crop: material(0x8fc94b),
  scaffold: material(0xc28a52),
  water: material(0x3c8fd6, { roughness: 0.4 }),
  // Matt, so it's the same blue from every side the camera turns to.
  sea: material(0x3c8fd6, { roughness: 0.85 }),
  sand: material(0xe2c98f),
  cliff: material(0xc9a66b),
  grass: material(0x79b85a),
  trunk: material(0x8a5a35),
  leaves: material(0x3f8f47),
  leavesLight: material(0x5aa84f),
  rock: material(0x9aa0a6),
  wood: material(0xb07a46),
  roof: material(0xc4553a),
  roofGrey: material(0x6b7280),
  shell: material(0xf4f1ea),
  dark: material(0x1d2633),
  eye: material(0x1d2633, { emissive: 0x6fd3ff, emissiveIntensity: 0 }),
  accent: material(0xf6b73c),
  badge: material(0x3d8bd9),
  basket: material(0x9a6a3a),
});

// The scene's own meshes, shadows on, under one group.
export function mesh(geometry, mat, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geometry, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function named(group, id, name) {
  group.userData.id = id;
  group.userData.name = name;
  return group;
}

export function createIsland() {
  const m = MATERIALS();
  const group = new THREE.Group();

  const sea = mesh(new THREE.CircleGeometry(90, 48), m.water, { cast: false, receive: true });
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.6;
  group.add(sea);

  // A low, faceted plateau: cliff sides, a sand rim and grass on top.
  const base = mesh(new THREE.CylinderGeometry(12.5, 14, 2.4, 18), m.cliff, { receive: true });
  base.position.y = 0;
  const rim = mesh(new THREE.CylinderGeometry(12.6, 12.6, 0.2, 18), m.sand, { receive: true });
  rim.position.y = 1.25;
  const top = mesh(new THREE.CylinderGeometry(10.8, 11.2, 0.3, 18), m.grass, { receive: true });
  top.position.y = 1.35;
  group.add(base, rim, top);

  const ground = 1.5;
  const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1.4, 6);
  const crown = new THREE.IcosahedronGeometry(1.1, 0);
  const tree = (x, z, s, i) => {
    const t = named(new THREE.Group(), `tree-${i}`, ref("entity.tree", { n: i }));
    const stem = mesh(trunk, m.trunk);
    stem.position.y = 0.7;
    const top = mesh(crown, i % 2 ? m.leaves : m.leavesLight);
    top.position.y = 1.9;
    top.rotation.y = i;
    t.add(stem, top);
    t.position.set(x, ground, z);
    t.scale.setScalar(s);
    return t;
  };
  [
    [-6, 3.5, 1.1],
    [-7.5, 1, 0.9],
    [-4.5, 6, 1.2],
    [-8, 5, 1],
    [-6.2, 7.6, 0.85],
    [7.5, 6.5, 1],
  ].forEach(([x, z, s], i) => group.add(tree(x, z, s, i + 1)));

  const stone = new THREE.DodecahedronGeometry(0.8, 0);
  [
    [6, -6, 1.1],
    [7.6, -4.5, 0.8],
    [5, -7.8, 0.7],
  ].forEach(([x, z, s], i) => {
    const r = named(mesh(stone, m.rock), `rock-${i + 1}`, ref("entity.rock", { n: i + 1 }));
    r.position.set(x, ground + 0.3 * s, z);
    r.scale.set(s, 0.75 * s, s);
    r.rotation.y = i * 1.3;
    group.add(r);
  });

  // The depot: a platform with crates on it and a sign.
  const depot = named(new THREE.Group(), "depot", ref("entity.depot"));
  const platform = mesh(new THREE.BoxGeometry(3.4, 0.3, 2.6), m.wood, { receive: true });
  platform.position.y = 0.15;
  const crate = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  [
    [-0.9, 0.7, -0.5],
    [0.1, 0.7, -0.5],
    [-0.4, 1.5, -0.5],
    [1, 0.7, 0.6],
  ].forEach(([x, y, z]) => {
    const c = mesh(crate, m.basket);
    c.position.set(x, y - 0.25, z);
    depot.add(c);
  });
  const post = mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), m.trunk);
  post.position.set(1.4, 0.95, -1);
  const sign = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.08), m.accent);
  sign.position.set(1.4, 1.6, -0.95);
  depot.add(platform, post, sign);
  depot.position.set(3.5, ground, 3.5);
  group.add(depot);

  // The sawmill: a hut with a roof, a log at its door and a saw blade.
  const mill = named(new THREE.Group(), "sawmill", ref("entity.sawmill"));
  const hut = mesh(new THREE.BoxGeometry(3, 2, 2.4), m.shell, { receive: true });
  hut.position.y = 1;
  const roof = mesh(new THREE.ConeGeometry(2.4, 1.3, 4), m.roof);
  roof.position.y = 2.65;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.85);
  const log = mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.2, 7), m.trunk);
  log.rotation.z = Math.PI / 2;
  log.position.set(0, 0.3, 1.8);
  const blade = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 12), m.roofGrey);
  blade.rotation.x = Math.PI / 2;
  blade.position.set(-1.6, 1, 0.8);
  mill.add(hut, roof, log, blade);
  mill.position.set(-2, ground, -5.5);
  mill.userData.blade = blade;
  group.add(mill);

  return { group, mill, materials: m };
}

// A tree, about 2.6 high at scale 1, standing on y = 0. `turn` varies its crown.
export function createTree(m, turn = 0, light = false) {
  const t = new THREE.Group();
  const stem = mesh(SHARED.trunk(), m.trunk);
  stem.position.y = 0.7;
  const top = mesh(SHARED.crown(), light ? m.leavesLight : m.leaves);
  top.position.y = 1.9;
  top.rotation.y = turn;
  t.add(stem, top);
  return t;
}

// A boulder, flattened a little, standing on y = 0.
export function createBoulder(m, turn = 0) {
  const r = mesh(SHARED.boulder(), m.rock);
  r.position.y = 0.45;
  r.scale.set(1, 0.75, 1);
  r.rotation.y = turn;
  return r;
}

// Geometry many models share, made when first needed. A view's dispose()
// frees its copy on the GPU; drawn again, three uploads it again.
const shared = (make) => {
  let g = null;
  return () => (g ??= make());
};
const SHARED = {
  trunk: shared(() => new THREE.CylinderGeometry(0.22, 0.3, 1.4, 6)),
  crown: shared(() => new THREE.IcosahedronGeometry(1.1, 0)),
  boulder: shared(() => new THREE.DodecahedronGeometry(0.8, 0)),
};

// A friendly helper robot: body, head with two eyes and an antenna, wheels, a
// basket on its back and a role badge on its front. Faces +Z. `colour`, when
// given, is its own colour for its badge and antenna, so robots can be told
// apart.
export function createRobot(materials, { colour = null } = {}) {
  const m = materials;
  const group = named(new THREE.Group(), "robot", ref("entity.robot"));
  const body = mesh(new THREE.BoxGeometry(1.2, 0.9, 1), m.shell);
  body.position.y = 0.75;
  const head = mesh(new THREE.BoxGeometry(0.95, 0.62, 0.82), m.shell);
  head.position.y = 1.55;
  const eyeGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const eyes = [-0.22, 0.22].map((x) => {
    const e = mesh(eyeGeo, m.eye, { cast: false });
    e.position.set(x, 1.6, 0.41);
    return e;
  });
  const stalk = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), m.dark);
  stalk.position.y = 2.05;
  const bulb = mesh(new THREE.SphereGeometry(0.12, 10, 8), colour ? m.tinted(colour) : m.accent);
  bulb.position.y = 2.3;
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12);
  const wheels = [-0.68, 0.68].map((x) => {
    const w = mesh(wheelGeo, m.dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.3, 0);
    return w;
  });
  const basket = mesh(new THREE.BoxGeometry(0.9, 0.55, 0.45), m.basket);
  basket.position.set(0, 0.95, -0.7);
  const badge = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), colour ? m.tinted(colour) : m.badge, { cast: false });
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, 0.85, 0.52);
  group.add(body, head, ...eyes, stalk, bulb, ...wheels, basket, badge);
  group.userData.wheels = wheels;
  group.userData.bulb = bulb;
  group.userData.basket = basket;
  return group;
}
