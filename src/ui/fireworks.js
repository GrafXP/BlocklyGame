// Fireworks for a mission done (mission-overlays.js): rockets rise from the
// bottom of `canvas` and burst into sparks that spread, fall and fade, a new
// one every half second or so for `duration` ms; then the last sparks die
// away. Drawn on a 2D canvas the size of its box, at the device's pixel ratio,
// each frame fading the one before so the sparks leave trails. Nothing here
// touches the world: it's the page's own, and Math.random is fine.
//
// With reduced motion asked for, there are none: the win says it in words.
// Returns a function that stops them and clears the canvas.

const COLOURS = ["#ffd23f", "#ff6b6b", "#4ecdc4", "#a66cff", "#ff9f1c", "#5dd39e", "#7cc6fe"];
const RISE = 520; // a rocket's gravity, px/s²
const FALL = 160; // a spark's, px/s²
const DRAG = 1.6; // how fast a spark slows, per second
const MOST = 900; // sparks at once, at most

const random = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function startFireworks(canvas, { duration = 5000 } = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx || matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const rockets = [];
  const sparks = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let last = null;
  let next = 0;
  const begun = performance.now();

  function fit() {
    const ratio = Math.min(2, devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  // A rocket from the bottom, to burst between a fifth and a half of the way
  // down: fast enough to stop rising there.
  function launch() {
    const top = random(0.2, 0.5) * height;
    rockets.push({ x: random(0.12, 0.88) * width, y: height, vx: random(-60, 60), vy: -Math.sqrt(2 * RISE * (height - top)), colour: pick(COLOURS) });
  }

  // Rocket `r` bursts: sparks in every direction, in its colour and a little
  // white, each living a second or two.
  function burst(r) {
    const n = Math.min(Math.round(random(60, 90)), MOST - sparks.length);
    const power = random(200, 320);
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + random(-0.1, 0.1);
      const speed = power * random(0.35, 1);
      const life = random(1.1, 1.9);
      sparks.push({ x: r.x, y: r.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, left: life, colour: Math.random() < 0.15 ? "#ffffff" : r.colour });
    }
  }

  function draw(now) {
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    const launching = now - begun < duration;
    if (launching && now >= next) {
      launch();
      next = now + random(350, 700);
    }

    // The frame before fades: trails, on a canvas that stays see-through.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgb(0 0 0 / 0.22)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy += RISE * dt;
      if (r.vy >= 0) {
        burst(r);
        rockets.splice(i, 1);
        continue;
      }
      ctx.fillStyle = r.colour;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const slow = Math.exp(-DRAG * dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vx *= slow;
      s.vy = s.vy * slow + FALL * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.left -= dt;
      if (s.left <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, (s.left / s.life) * 1.5);
      ctx.fillStyle = s.colour;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (launching || rockets.length || sparks.length) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, width, height);
  }

  fit();
  addEventListener("resize", fit);
  // Two at once to begin with, so the first burst comes straight away.
  launch();
  launch();
  next = begun + 300;
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("resize", fit);
    ctx.clearRect(0, 0, width, height);
  };
}
