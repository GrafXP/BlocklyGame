import * as THREE from "three";
import { count } from "../lifecycle.js";
import { createIsland, createRobot } from "./models.js";

const VIEW = 30; // world units across the screen's short side, at zoom 1
const LOOK = new THREE.Vector3(1, 1.15, 1.25).normalize(); // from the view's centre to the camera: high, from the south-east
const DISTANCE = 60;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const ROBOT_PATH = 7; // radius of the test robot's circuit, round the middle of the island
const ROBOT_SPEED = 0.35; // radians a second

// The two lightings the editor is judged against: a bright day, the hardest for
// dark text on a see-through panel, and a dark dusk, the hardest for light text.
const WORLDS = {
  day: { sky: 0xa9dcf7, hemi: [0xe4f4ff, 0x6a8f4e, 1.8], sun: [0xfff4e0, 2.4], sunAt: [-10, 22, 12], eyes: 0 },
  dusk: { sky: 0x121833, hemi: [0x5a6aa8, 0x1a1626, 0.55], sun: [0xffa868, 0.9], sunAt: [-24, 8, 6], eyes: 1.6 },
};

// Draws the Phase 0 island in `container`, from above at an angle, with an
// orthographic camera, so sizes and distances read the same everywhere on screen
// (PLAN.md §4). The robot drives its circuit by the clock while `moving`: it's a
// test model for the editor lab, not the simulation, which runs on world ticks
// from Phase 1.
export function createView(container, { world = "day", moving = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // the soft variant is gone from three 0.186
  container.appendChild(renderer.domElement);
  count("views", 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  scene.add(hemi, sun);

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

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  const cam = { x: 0, z: 0, zoom: 1 };
  let selected = null;
  let robotAngle = 0;
  let last = 0;

  function place() {
    camera.zoom = cam.zoom;
    camera.position.set(cam.x + LOOK.x * DISTANCE, LOOK.y * DISTANCE, cam.z + LOOK.z * DISTANCE);
    camera.lookAt(cam.x, 0, cam.z);
    camera.updateProjectionMatrix();
  }

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    const aspect = w / h;
    const halfH = (aspect >= 1 ? VIEW : VIEW / aspect) / 2;
    Object.assign(camera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    place();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function setWorld(name) {
    const w = WORLDS[name] ?? WORLDS.day;
    scene.background.setHex(w.sky);
    hemi.color.setHex(w.hemi[0]);
    hemi.groundColor.setHex(w.hemi[1]);
    hemi.intensity = w.hemi[2];
    sun.color.setHex(w.sun[0]);
    sun.intensity = w.sun[1];
    sun.position.set(...w.sunAt);
    island.materials.eye.emissiveIntensity = w.eyes;
  }
  setWorld(world);

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const toNdc = (clientX, clientY) => {
    const rect = renderer.domElement.getBoundingClientRect();
    return ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2);
  };

  return {
    canvas: renderer.domElement,
    info: renderer.info,
    // Draws a frame. `now` is the page clock in ms, which moves the test robot.
    render(now) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
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
      renderer.render(scene, camera);
    },
    // Moves the view by a drag of (dx, dy) screen pixels, as if the ground were
    // dragged along under the pointer.
    panBy(dx, dy) {
      const perPixel = (camera.top - camera.bottom) / cam.zoom / renderer.domElement.clientHeight;
      const right = new THREE.Vector3(LOOK.z, 0, -LOOK.x).normalize();
      const away = new THREE.Vector3(-LOOK.x, 0, -LOOK.z).normalize();
      const sinUp = LOOK.y; // screen-up covers more ground than screen-across
      cam.x -= (right.x * dx - (away.x * dy) / sinUp) * perPixel;
      cam.z -= (right.z * dx - (away.z * dy) / sinUp) * perPixel;
      cam.x = Math.max(-25, Math.min(25, cam.x));
      cam.z = Math.max(-25, Math.min(25, cam.z));
      place();
    },
    zoomBy(factor) {
      cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom * factor));
      place();
    },
    // The id of the thing under the screen point, or null.
    pick(clientX, clientY) {
      raycaster.setFromCamera(toNdc(clientX, clientY), camera);
      for (const hit of raycaster.intersectObjects(pickable, true)) {
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
      at.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + ((at.x + 1) / 2) * rect.width, y: rect.top + ((1 - at.y) / 2) * rect.height };
    },
    get state() {
      return { x: cam.x, z: cam.z, zoom: cam.zoom, selected };
    },
    // Puts the camera back where `state` says, and selects what it had selected.
    restore({ x = 0, z = 0, zoom = 1, selected: id = null }) {
      Object.assign(cam, { x, z, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) });
      place();
      this.select(id);
    },
    setWorld,
    setMoving(on) {
      moving = on;
    },
    // Puts the test robot `angle` radians round its circuit; about 3.6 is behind
    // the editor panel, on the screen's left.
    robotAt(angle) {
      robotAngle = angle;
    },
    dispose() {
      ro.disconnect();
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        for (const m of [obj.material].flat()) m?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss(); // let the browser have the WebGL context back now, not whenever it collects it
      renderer.domElement.remove();
      count("views", -1);
    },
  };
}
