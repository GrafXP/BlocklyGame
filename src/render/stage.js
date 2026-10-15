import * as THREE from "three";
import { count } from "../lifecycle.js";

// A 3D stage in a page (PLAN.md §4, §8): a WebGL renderer filling its
// container, a scene with sky, hemisphere light and a sun, and an orthographic
// camera looking down at an angle, so sizes and distances read the same
// everywhere on screen. The camera pans, zooms, turns by quarter turns and goes
// back to where it started; none of it touches the world. The editor lab's view
// (view.js) and the island (island-view.js) are built on it.
//
// The camera's math is plain functions of its state, testable in Node:
//   { x, z, zoom, turn }  the point looked at, the zoom, and quarter turns (0–3)

export const QUALITIES = {
  // The simple setting is for older iPads: one pixel per CSS pixel, no shadows.
  low: { pixelRatio: 1, shadows: false },
  high: { pixelRatio: 2, shadows: true },
};

const DISTANCE = 60;
const LOOK_ACROSS = Math.hypot(1, 1.25); // the camera is this far across…
const LOOK_UP = 1.15; // …for this far up: high, but not straight down
const BASE_ANGLE = Math.atan2(1, 1.25); // from the south-east, a little more south than east
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 3;
const TURN_MS = 380;

// The unit vector from the point looked at to the camera, `angle` radians
// round from the start (a quarter turn is π/2).
export function lookFrom(angle) {
  const a = BASE_ANGLE + angle;
  return new THREE.Vector3(Math.sin(a) * LOOK_ACROSS, LOOK_UP, Math.cos(a) * LOOK_ACROSS).normalize();
}

// How far the point looked at moves for a drag of (dx, dy) screen pixels, with
// `perPixel` world units a pixel, looking from `look`: as if the ground were
// dragged along under the pointer. Screen-up covers more ground than across.
export function panDelta(look, dx, dy, perPixel) {
  const right = new THREE.Vector3(look.z, 0, -look.x).normalize();
  const away = new THREE.Vector3(-look.x, 0, -look.z).normalize();
  return {
    x: -(right.x * dx - (away.x * dy) / look.y) * perPixel,
    z: -(right.z * dx - (away.z * dy) / look.y) * perPixel,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (f) => 1 - (1 - f) ** 3;

// A stage in `container`. `view` is how many world units the screen's short
// side shows at zoom 1; `bounds` how far from the middle the camera may pan;
// `home` the camera state Reset goes back to.
export function createStage(container, { view = 30, bounds = 25, home = { x: 0, z: 0, zoom: 1, turn: 0 }, quality = "high" } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.type = THREE.PCFShadowMap; // the soft variant is gone from three 0.186
  container.appendChild(renderer.domElement);
  count("views", 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(hemi, sun, sun.target);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  const cam = { ...home };
  let angle = cam.turn * (Math.PI / 2); // drawn; follows cam.turn over TURN_MS
  let turning = null; // { from, to, start }
  let dirty = true;

  function place() {
    const look = lookFrom(angle);
    camera.zoom = cam.zoom;
    camera.position.set(cam.x + look.x * DISTANCE, look.y * DISTANCE, cam.z + look.z * DISTANCE);
    camera.lookAt(cam.x, 0, cam.z);
    camera.updateProjectionMatrix();
    dirty = true;
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    const aspect = w / h;
    const halfH = (aspect >= 1 ? view : view / aspect) / 2;
    Object.assign(camera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    place();
  }

  let settings = null;
  function setQuality(name) {
    settings = QUALITIES[name] ?? QUALITIES.high;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
    renderer.shadowMap.enabled = settings.shadows;
    sun.castShadow = settings.shadows;
    scene.traverse((o) => {
      if (o.material) for (const m of [o.material].flat()) m.needsUpdate = true; // shadows on or off recompiles them
    });
    resize();
  }
  setQuality(quality);

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // A quarter turn to the left (-1) or right (+1), or more, drawn over a moment.
  function turnBy(steps) {
    cam.turn = (((cam.turn + steps) % 4) + 4) % 4;
    const to = (turning?.to ?? angle) + steps * (Math.PI / 2);
    turning = { from: angle, to, start: null };
    dirty = true;
  }

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const toNdc = (clientX, clientY) => {
    const rect = renderer.domElement.getBoundingClientRect();
    return ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2);
  };
  const projected = new THREE.Vector3();

  return {
    renderer,
    scene,
    camera,
    hemi,
    sun,
    canvas: renderer.domElement,
    info: renderer.info,
    get quality() {
      return Object.keys(QUALITIES).find((k) => QUALITIES[k] === settings);
    },
    setQuality,
    // Whether something changed since the last draw.
    get dirty() {
      return dirty;
    },
    invalidate() {
      dirty = true;
    },
    // Moves a turn on to `now` ms. Returns whether the camera is still turning.
    update(now) {
      if (!turning) return false;
      turning.start ??= now;
      const f = Math.min(1, (now - turning.start) / TURN_MS);
      angle = turning.from + (turning.to - turning.from) * ease(f);
      if (f >= 1) turning = null;
      place();
      return !!turning;
    },
    render() {
      renderer.render(scene, camera);
      dirty = false;
    },
    panBy(dx, dy) {
      const perPixel = (camera.top - camera.bottom) / cam.zoom / renderer.domElement.clientHeight;
      const d = panDelta(lookFrom(angle), dx, dy, perPixel);
      cam.x = clamp(cam.x + d.x, -bounds, bounds);
      cam.z = clamp(cam.z + d.z, -bounds, bounds);
      place();
    },
    zoomBy(factor) {
      cam.zoom = clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX);
      place();
    },
    turnBy,
    // Back to where the camera started, turning the shorter way round.
    reset() {
      const steps = home.turn - cam.turn;
      Object.assign(cam, { x: home.x, z: home.z, zoom: home.zoom });
      if (steps) turnBy(((steps + 6) % 4) - 2);
      place();
    },
    // Whether the camera is turning.
    get turning() {
      return !!turning;
    },
    get state() {
      return { ...cam };
    },
    restore({ x = home.x, z = home.z, zoom = home.zoom, turn = home.turn } = {}) {
      Object.assign(cam, { x: clamp(x, -bounds, bounds), z: clamp(z, -bounds, bounds), zoom: clamp(zoom, ZOOM_MIN, ZOOM_MAX), turn: ((turn % 4) + 4) % 4 });
      angle = cam.turn * (Math.PI / 2);
      turning = null;
      place();
    },
    // What's under the screen point among `objects`, nearest first.
    raycast(clientX, clientY, objects) {
      raycaster.setFromCamera(toNdc(clientX, clientY), camera);
      return raycaster.intersectObjects(objects, true);
    },
    // Where world point `p` is on screen, in client pixels.
    project(p) {
      projected.copy(p).project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + ((projected.x + 1) / 2) * rect.width, y: rect.top + ((1 - projected.y) / 2) * rect.height };
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
