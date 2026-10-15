import * as THREE from "three";
import { ITEMS } from "../sim/entities.js";
import { BUILDINGS } from "./buildings.js";
import { TOP, areaCentre, facing, headingOf, pointAt, sharedSpots, topOf } from "./grid.js";
import { identityOf } from "./identity.js";
import { createMaterials, createRobot, named } from "./models.js";
import { robotPose } from "./pose.js";
import { createGrove, createQuarry, itemGeometry, itemMaterial } from "./resources.js";
import { createMarks } from "./selection.js";
import { createStage } from "./stage.js";
import { createTerrain } from "./terrain.js";
import { light } from "./view.js";

// The island in 3D (PLAN.md §4, §6, §11 Phase 3), drawn from a world: its ground
// and water, buildings, deposits and robots, every store's items, and marks for
// what's selected. It reads the world and never changes it. Robots are drawn
// where their committed actions put them, `alpha` of the way to the next tick
// (render/pose.js), so play is smooth and a paused world shows exactly what it
// holds; everything that moves is worked out from ticks, not from the page clock,
// except the camera turning and a robot turning to face its way.
//
// It draws only when something has changed: the world, the camera, the
// selection, or the pointer over something.

const NODES = { grove: createGrove, quarry: createQuarry };
const ROBOT_SCALE = 0.5; // the robot model is two cells high at scale 1
const TURN_RATE = 12; // how quickly a robot turns to face its way, a second

// The island's camera: the whole island in view, from the south-east, a little
// to the left of the middle, clear of the inspector on the right.
const HOME = { x: 3, z: -1, zoom: 1, turn: 0 };

// A robot, with a box round it to tap, larger than it is, and two places in its
// basket for what it carries.
function robotModel(m, id, name, colour) {
  const group = named(createRobot(m, { colour }), id, name);
  group.scale.setScalar(ROBOT_SCALE);
  const target = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 1.8), m.blueprint);
  target.position.y = 1.3;
  target.visible = false; // never drawn, but rays still find it
  group.add(target);
  const slots = [-0.2, 0.2].map((x) => {
    const slot = new THREE.Mesh(itemGeometry("wood"), m.log);
    slot.position.set(x, 1.28, -0.7);
    slot.scale.setScalar(1 / ROBOT_SCALE);
    slot.castShadow = true;
    slot.visible = false;
    group.add(slot);
    return slot;
  });
  return { group, top: 1.35, slots, heading: 0 };
}

export function createIslandView(container, { quality = "high" } = {}) {
  const stage = createStage(container, { view: 28, bounds: 18, home: HOME, quality });
  const { scene } = stage;
  const m = createMaterials();
  light(stage, "day", m.eye);
  stage.sun.position.set(-14, 26, 16);
  Object.assign(stage.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
  stage.sun.shadow.camera.updateProjectionMatrix();

  const terrain = createTerrain(m);
  scene.add(terrain.group);
  const marks = createMarks();
  scene.add(marks.group);
  const things = new Map(); // id → { group, top, update?, slots?, heading }
  const layer = new THREE.Group();
  scene.add(layer);

  let world = null;
  let selected = null;
  let hover = null;
  let drawn = { tick: -1, alpha: -1 };
  let last = 0;

  // The models for every thing in world `w`, once per world.
  function build(w) {
    // Geometry shared between models is uploaded again when it's next drawn.
    layer.traverse((o) => {
      o.geometry?.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    layer.clear();
    things.clear();
    const { terrain: ground } = w;
    for (const t of [...w.entities, ...w.nodes]) {
      let model;
      if (t.kind === "robot") model = robotModel(m, t.id, t.name, identityOf(w, t.id).colour);
      else {
        const make = BUILDINGS[t.type] ?? NODES[t.type];
        if (!make) continue;
        const { angle, across, deep } = facing(ground, t);
        model = make(m, { across, deep, caps: t.store.caps ?? {} });
        named(model.group, t.id, t.name);
        const { x, z } = areaCentre(ground, t.area);
        model.group.position.set(x, topOf(ground, t.access[0]) ?? TOP.grass, z);
        model.group.rotation.y = angle;
      }
      things.set(t.id, model);
      layer.add(model.group);
    }
    world = w;
    drawn = { tick: -1, alpha: -1 };
  }

  // Where robot `r` is drawn, at `alpha` of the way to the next tick.
  function placeRobot(w, r, alpha, spots, dt, running) {
    const model = things.get(r.id);
    const pose = robotPose(w, r, alpha);
    const { x, z } = pointAt(w.terrain, pose.x, pose.z);
    const spot = spots.get(r.id) ?? { x: 0, z: 0 };
    const cell = Math.round(pose.z) * w.terrain.width + Math.round(pose.x);
    let y = topOf(w.terrain, cell) ?? TOP.grass;
    const a = r.action;
    const t = w.tick + alpha;
    if (a && a.type !== "move" && a.type !== "wait") y += 0.05 * Math.abs(Math.sin(((t - a.start) / (a.end - a.start)) * Math.PI * 3));
    model.group.position.set(x + spot.x, y, z + spot.z);
    // Facing its way: turning there smoothly while playing, at once when paused.
    const heading = headingOf(w, r);
    if (heading !== null) {
      const turn = Math.atan2(Math.sin(heading - model.heading), Math.cos(heading - model.heading));
      model.heading += running ? turn * Math.min(1, dt * TURN_RATE) : turn;
    }
    model.group.rotation.y = model.heading;
    if (a?.type === "move") for (const wheel of model.group.userData.wheels) wheel.rotation.x = (t - a.start) * 1.4;
    // What's in its basket.
    const carried = ITEMS.flatMap((item) => Array(r.store.items[item] ?? 0).fill(item));
    model.slots.forEach((slot, i) => {
      const item = carried[i];
      slot.visible = !!item;
      if (item) {
        slot.geometry = itemGeometry(item);
        slot.material = itemMaterial(m, item);
      }
    });
    return model.group.position;
  }

  const ground = (id) => {
    const model = things.get(id);
    return model ? { x: model.group.position.x, y: model.group.position.y, z: model.group.position.z } : null;
  };

  return {
    canvas: stage.canvas,
    info: stage.info,
    panBy: stage.panBy,
    zoomBy: stage.zoomBy,
    turnBy: stage.turnBy,
    reset: stage.reset,
    get camera() {
      return stage.state;
    },
    restoreCamera: stage.restore,
    get quality() {
      return stage.quality;
    },
    setQuality: stage.setQuality,

    // Shows world `w` at `alpha` of the way to its next tick, at page time
    // `now` ms; `running` whether the clock is.
    sync(w, { alpha = 0, now = 0, running = false } = {}) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (w !== world) build(w);
      if (terrain.update(w.terrain)) stage.invalidate();
      if (w.tick !== drawn.tick || alpha !== drawn.alpha) {
        drawn = { tick: w.tick, alpha };
        const t = w.tick + alpha;
        const spots = sharedSpots(w);
        for (const e of w.entities) {
          const model = things.get(e.id);
          if (!model) continue;
          if (e.kind === "robot") placeRobot(w, e, alpha, spots, dt, running);
          else model.update?.(w, e, t);
        }
        for (const n of w.nodes) things.get(n.id)?.update?.(w, n, t);
        stage.invalidate();
      }
      if (marks.update(w, selected, hover, ground)) stage.invalidate();
    },
    // Draws, if anything has changed. Returns whether it did.
    frame(now) {
      if (stage.update(now)) stage.invalidate();
      if (!stage.dirty) return false;
      stage.render();
      return true;
    },
    // The id of the thing under the screen point, or null.
    pick(clientX, clientY) {
      for (const hit of stage.raycast(clientX, clientY, [layer])) {
        for (let o = hit.object; o; o = o.parent) if (o.userData.id) return o.userData.id;
      }
      return null;
    },
    get selected() {
      return selected;
    },
    select(id) {
      selected = things.has(id) ? id : null;
      stage.invalidate();
    },
    hover(id) {
      hover = things.has(id) ? id : null;
    },
    // Where thing `id` is drawn, in world units: its base.
    positionOf: ground,
    // Where the label of thing `id` goes on screen, in client pixels: above it.
    anchorOf(id) {
      const model = things.get(id);
      if (!model) return null;
      const p = model.group.position;
      return stage.project(new THREE.Vector3(p.x, p.y + model.top, p.z));
    },
    // Where thing `id`'s middle is on screen, in client pixels: to tap it.
    screenOf(id) {
      const model = things.get(id);
      if (!model) return null;
      const p = model.group.position;
      return stage.project(new THREE.Vector3(p.x, p.y + model.top * 0.45, p.z));
    },
    dispose() {
      for (const t of things.values()) t.group.traverse((o) => o.isInstancedMesh && o.dispose());
      terrain.dispose();
      marks.dispose();
      stage.dispose();
    },
  };
}
