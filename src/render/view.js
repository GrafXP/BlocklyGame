import * as THREE from "three";
import { createStage } from "./stage.js";
import { createIsland, createRobot } from "./models.js";

const ROBOT_PATH = 7; // radius of the test robot's circuit, round the middle of the island
const ROBOT_SPEED = 0.35; // radians a second

// The two lightings the editor is judged against: a bright day, the hardest for
// dark text on a see-through panel, and a dark dusk, the hardest for light text.
export const LIGHTS = {
  day: { sky: 0xa9dcf7, hemi: [0xe4f4ff, 0x6a8f4e, 1.8], sun: [0xfff4e0, 2.4], sunAt: [-10, 22, 12], eyes: 0 },
  dusk: { sky: 0x121833, hemi: [0x5a6aa8, 0x1a1626, 0.55], sun: [0xffa868, 0.9], sunAt: [-24, 8, 6], eyes: 1.6 },
};

// Lights `stage` as `name` (LIGHTS), with robots' eyes `eye` glowing to suit.
export function light(stage, name, eye) {
  const w = LIGHTS[name] ?? LIGHTS.day;
  stage.scene.background.setHex(w.sky);
  stage.hemi.color.setHex(w.hemi[0]);
  stage.hemi.groundColor.setHex(w.hemi[1]);
  stage.hemi.intensity = w.hemi[2];
  stage.sun.color.setHex(w.sun[0]);
  stage.sun.intensity = w.sun[1];
  stage.sun.position.set(...w.sunAt);
  if (eye) eye.emissiveIntensity = w.eyes;
  stage.invalidate();
}

// The editor lab's view (PLAN.md §11, Phase 0): the Phase 0 island on a stage
// (stage.js), with a test robot that drives its circuit by the page clock while
// `moving`. It's a test model for judging the editor over a 3D world, not the
// simulation; the island built from the world is island-view.js.
export function createView(container, { world = "day", moving = true } = {}) {
  const stage = createStage(container, { view: 30, bounds: 25 });
  const { scene } = stage;
  Object.assign(stage.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });

  const island = createIsland();
  scene.add(island.group);
  const robot = createRobot(island.materials);
  scene.add(robot);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.6, 32), new THREE.MeshBasicMaterial({ color: 0xf6b73c, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const pickable = [robot, ...island.group.children.filter((c) => c.userData.id)];
  const byId = new Map(pickable.map((o) => [o.userData.id, o]));

  let selected = null;
  let robotAngle = 0;
  let last = 0;
  light(stage, world, island.materials.eye);

  return {
    canvas: stage.canvas,
    info: stage.info,
    // Draws a frame. `now` is the page clock in ms, which moves the test robot.
    render(now) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      stage.update(now);
      if (moving) {
        robotAngle += ROBOT_SPEED * dt;
        for (const w of robot.userData.wheels) w.rotation.x += dt * 6;
        island.mill.userData.blade.rotation.y += dt * 8;
      }
      robot.position.set(Math.cos(robotAngle) * ROBOT_PATH, 1.5, Math.sin(robotAngle) * ROBOT_PATH);
      robot.rotation.y = -robotAngle; // facing along the circle
      robot.userData.bulb.position.y = 2.3 + (moving ? Math.sin(now / 180) * 0.04 : 0);
      if (selected) {
        const at = new THREE.Vector3();
        byId.get(selected).getWorldPosition(at);
        ring.position.set(at.x, 1.52, at.z);
      }
      stage.render();
    },
    panBy: stage.panBy,
    zoomBy: stage.zoomBy,
    turnBy: stage.turnBy,
    // The id of the thing under the screen point, or null.
    pick(clientX, clientY) {
      for (const hit of stage.raycast(clientX, clientY, pickable)) {
        for (let o = hit.object; o; o = o.parent) if (o.userData.id) return o.userData.id;
      }
      return null;
    },
    select(id) {
      selected = byId.has(id) ? id : null;
      ring.visible = !!selected;
    },
    // The name of thing `id`, a message (src/i18n/index.js, display).
    nameOf: (id) => byId.get(id)?.userData.name ?? null,
    // Where thing `id` is on screen, in client pixels.
    screenOf(id) {
      const at = new THREE.Vector3();
      byId.get(id).getWorldPosition(at);
      at.y += 0.6;
      return stage.project(at);
    },
    get state() {
      return { ...stage.state, selected };
    },
    // Puts the camera back where `state` says, and selects what it had selected.
    restore({ selected: id = null, ...camera }) {
      stage.restore(camera);
      this.select(id);
    },
    setWorld: (name) => light(stage, name, island.materials.eye),
    setMoving(on) {
      moving = on;
    },
    // Puts the test robot `angle` radians round its circuit; about 3.6 is behind
    // the editor panel, on the screen's left.
    robotAt(angle) {
      robotAngle = angle;
    },
    dispose: stage.dispose,
  };
}
