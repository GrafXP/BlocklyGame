import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ISLAND } from "../src/content/island.js";
import { createWorld } from "../src/sim/world.js";
import { cellAt, kindOf, setKind } from "../src/sim/terrain.js";
import { FLOOR_Y, TOP, areaCentre, cellCentre, facing, headingOf, pointAt, sharedSpots } from "../src/render/grid.js";
import { bridgeParts, terrainGeometry } from "../src/render/terrain.js";
import { lookFrom, panDelta } from "../src/render/stage.js";
import { createBerries, createGrove, createQuarry, createSpring, createStock, stackSlots } from "../src/render/resources.js";
import { BASE, THINGS } from "../src/content/missions/island.js";
import { TYPES } from "../src/sim/entities.js";
import { BUILDINGS } from "../src/render/buildings.js";
import { createMaterials } from "../src/render/models.js";
import { identityOf } from "../src/render/identity.js";
import { declutter } from "../src/ui/tags.js";
import { byId, run, runUntil } from "./helpers.js";

// The 3D island's arithmetic, in Node (PLAN.md §4, §11 Phase 3): where the
// world's cells, buildings and robots go, the ground's geometry, the camera's
// turns, and labels that keep clear of each other. Drawing itself needs a
// browser (e2e/island.spec.js).

const world = createWorld(ISLAND);
const { terrain } = world;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("the island's middle is the world's origin, one cell to a unit", () => {
  assert.deepEqual(pointAt(terrain, 0, 0), { x: -15.5, z: -15.5 });
  assert.deepEqual(cellCentre(terrain, cellAt(terrain, 16, 16)), { x: 0.5, z: 0.5 });
  assert.deepEqual(areaCentre(terrain, { x: 13, z: 6, w: 3, d: 2 }), { x: -1.5, z: -9 });
  assert.deepEqual(pointAt(terrain, 10.5, 15), { x: -5, z: -0.5 }, "between two cells");
});

test("the ground has a top for each cell of land, and sides only down to lower neighbours", () => {
  const g = terrainGeometry(terrain);
  const positions = g.getAttribute("position").array;
  const land = [...terrain.kinds].filter((ch) => ch === "." || ch === ",").length;
  // Every top is a quad, two triangles at the cell's height.
  let tops = 0;
  let sides = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ys = [positions[i + 1], positions[i + 4], positions[i + 7]];
    if (ys.every((y) => y === ys[0])) tops++;
    else sides++;
    for (const y of ys) assert.ok(y >= FLOOR_Y - 1e-6 && y <= TOP.grass + 1e-6, `y ${y}`); // positions are 32-bit floats
  }
  assert.equal(tops, 2 * land);
  assert.ok(sides > 0 && sides % 2 === 0);
  assert.equal(g.getAttribute("color").count, g.getAttribute("position").count);
  // Normals point up on tops: the faces are wound the right way round.
  const normals = g.getAttribute("normal").array;
  for (let i = 0; i < positions.length; i += 9) if (positions[i + 1] === positions[i + 4] && positions[i + 4] === positions[i + 7]) assert.ok(normals[i + 1] > 0.99);
});

test("the gap is a blueprint until the bridge is built, then a deck, and the ground is drawn again without it", () => {
  const before = bridgeParts(terrain);
  assert.deepEqual(
    before.map((p) => [p.built, p.across]),
    [
      [false, true],
      [false, true],
    ],
  );
  const built = structuredClone(terrain);
  setKind(built, before.map((p) => p.cell), "+");
  assert.ok(bridgeParts(built).every((p) => p.built));
  assert.equal(kindOf(built, before[0].cell), "bridge");
  // No land top on a bridge: the deck is drawn instead.
  assert.equal(terrainGeometry(built).getAttribute("position").count, terrainGeometry(terrain).getAttribute("position").count);
});

test("buildings face the cells robots use them from; the stone pit faces west, towards the stream", () => {
  const faces = Object.fromEntries([...world.entities, ...world.nodes].filter((t) => t.area).map((t) => [t.id, facing(terrain, t).angle]));
  assert.deepEqual(faces, { camp: 0, sawmill: 0, depot: Math.PI / 2, site: Math.PI / 2, grove: 0, quarry: -Math.PI / 2 });
  // Turned a quarter, a footprint is as deep as it was wide.
  assert.deepEqual(facing(terrain, byId(world, "depot")), { angle: Math.PI / 2, across: 2, deep: 2 });
  assert.deepEqual(facing(terrain, byId(world, "sawmill")), { angle: 0, across: 3, deep: 2 });
});

test("a robot faces the way it walks, and the building it's at; robots sharing a cell stand apart", () => {
  const w = createWorld(ISLAND);
  run(w, 3); // r1 is on its way to the grove
  const r1 = byId(w, "r1");
  const a = r1.action;
  const from = cellCentre(w.terrain, a.path[0]);
  const to = cellCentre(w.terrain, a.path[1]);
  assert.ok(near(headingOf(w, r1), Math.atan2(to.x - from.x, to.z - from.z)));
  runUntil(w, () => r1.action?.type === "pickUp");
  const grove = areaCentre(w.terrain, byId(w, "grove").area);
  const here = cellCentre(w.terrain, r1.cell);
  assert.ok(near(headingOf(w, r1), Math.atan2(grove.x - here.x, grove.z - here.z)));

  const crowd = createWorld({ ...ISLAND, entities: ISLAND.entities.map((e) => (e.type === "helper" ? { ...e, cell: [10, 15] } : e)) });
  const spots = sharedSpots(crowd);
  assert.deepEqual([...spots.keys()], ["r1", "r2", "r3"]);
  const seen = new Set([...spots.values()].map((s) => `${s.x} ${s.z}`));
  assert.equal(seen.size, 3, "each in a place of its own");
  assert.equal(sharedSpots(world).size, 0, "on cells of their own, robots stand in the middle");
});

test("robots are told apart by colour and shape, in id order; buildings have neither", () => {
  assert.deepEqual(
    ["r1", "r2", "r3"].map((id) => identityOf(world, id).shape),
    ["circle", "square", "triangle"],
  );
  assert.equal(identityOf(world, "sawmill"), null);
});

test("a quarter turn turns the camera, and a drag across the screen still moves the ground across it", () => {
  const start = lookFrom(0);
  assert.ok(start.clone().sub(new THREE.Vector3(1, 1.15, 1.25).normalize()).length() < 1e-9, "from the south-east, as in Phase 0");
  for (let turn = 1; turn < 4; turn++) {
    const look = lookFrom(turn * (Math.PI / 2));
    assert.ok(near(look.y, start.y), "as high");
    const turned = start.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn * (Math.PI / 2));
    assert.ok(look.clone().sub(turned).length() < 1e-9, `turn ${turn}`);
    // The same drag, turned the same way.
    const d0 = panDelta(start, 40, -25, 0.05);
    const d = panDelta(look, 40, -25, 0.05);
    const expected = new THREE.Vector3(d0.x, 0, d0.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn * (Math.PI / 2));
    assert.ok(near(d.x, expected.x) && near(d.z, expected.z), `pan, turn ${turn}`);
  }
  // Dragging right moves the view's middle to the left on screen: against the
  // camera's right.
  const d = panDelta(start, 10, 0, 1);
  const right = new THREE.Vector3(start.z, 0, -start.x).normalize();
  assert.ok(d.x * right.x + d.z * right.z < 0);
});

test("labels that would cover each other are stacked, the lowest on screen keeping its place", () => {
  const out = declutter([
    { id: "b", x: 100, y: 200, w: 60, h: 20 },
    { id: "a", x: 110, y: 205, w: 60, h: 20 },
    { id: "far", x: 400, y: 205, w: 60, h: 20 },
  ]);
  assert.deepEqual(out.get("a"), { x: 110, y: 205 }, "lowest, nearest");
  assert.deepEqual(out.get("far"), { x: 400, y: 205 }, "nothing in its way");
  assert.deepEqual(out.get("b"), { x: 100, y: 205 - 20 - 2 }, "above the one it would have covered");
  // However many in one place, none overlaps another.
  const crowd = declutter(Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, x: 50 + i * 3, y: 100, w: 50, h: 18 })));
  const boxes = [...crowd.values()].map(({ x, y }) => ({ left: x - 25, right: x + 25, top: y - 18, bottom: y }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(boxes[i].bottom <= boxes[j].top || boxes[j].bottom <= boxes[i].top, `${i} and ${j}`);
});

test("items stack in rows across a pad, then deeper, then a layer higher, and stay on it", () => {
  const pad = { w: 0.9, d: 0.5 };
  const size = [0.3, 0.1, 0.15];
  const slots = stackSlots(20, size, pad);
  assert.equal(slots.length, 20);
  const perLayer = Math.floor(0.9 / 0.3) * Math.floor(0.5 / 0.15);
  assert.equal(perLayer, 9);
  assert.ok(near(slots[0][1], 0.05));
  assert.ok(near(slots[perLayer][1], 0.15), "the tenth on the next layer");
  for (const [x, , z] of slots) assert.ok(Math.abs(x) <= pad.w / 2 && Math.abs(z) <= pad.d / 2);
  assert.equal(new Set(slots.map((s) => s.join())).size, 20, "no two in one place");
});

test("every building and deposit on the island and in the campaign has a model, and its store shows what it holds", () => {
  const m = createMaterials();
  // The campaign's catalogue, every store holding one of each item it can.
  const campaign = createWorld({
    ...BASE,
    terrain: BASE.terrain.map((row) => row.replaceAll("=", "~")),
    entities: THINGS.filter((t) => t.type !== "helper" && TYPES[t.type].kind === "building" && t.id !== "site"),
    nodes: THINGS.filter((t) => TYPES[t.type].kind === "node"),
  });
  for (const t of [...campaign.entities, ...campaign.nodes]) t.store.items = Object.fromEntries(Object.keys(t.store.caps).map((item) => [item, 1]));
  const MADE_OF = { log: "wood", stone: "stone", plank: "plank", kit: "kit", water: "water", berry: "food", pack: "pack" };
  for (const w of [world, campaign]) {
    for (const t of [...w.entities, ...w.nodes].filter((it) => it.area)) {
      const make = BUILDINGS[t.type] ?? { grove: createGrove, quarry: createQuarry, spring: createSpring, berries: createBerries }[t.type];
      assert.ok(make, t.type);
      const { across, deep } = facing(w.terrain, t);
      const model = make(m, { across, deep, caps: t.store.caps });
      assert.ok(model.group.children.length > 0 && model.top > 0, t.id);
      model.update(w, t, w.tick);
      const shown = {};
      model.group.traverse((o) => {
        if (o.isInstancedMesh) shown[Object.entries(MADE_OF).find(([name]) => m[name] === o.material)[1]] = o.count;
      });
      for (const item of Object.keys(t.store.caps)) assert.equal(shown[item] ?? 0, t.store.items[item] ?? 0, `${t.id} ${item}`);
    }
  }
  const stock = createStock(m, { wood: 4 }, { wood: { x: 0, z: 0, w: 1, d: 1 } });
  assert.equal(stock.update({ wood: 9 }), true);
  assert.equal(stock.group.children[0].count, 4, "never more than there's room for");
  assert.equal(stock.update({ wood: 9 }), false, "nothing changed");
});
