import { formatNumber, t } from "../i18n/index.js";

// Graphics counters (PLAN.md §11, Phase 3; §12, performance): frames a second
// over the last second, the slowest frame, the time the game's own code took a
// frame, and what the renderer drew in the last one (three's renderer.info).
// For developers, behind ?dev; the numbers decide quality settings, not play.
export function createMeter() {
  const frames = []; // [time, interval, work]
  let prev = 0;
  let drawn = { calls: 0, triangles: 0 };
  const stats = () => {
    const n = frames.length;
    if (n < 2) return { fps: 0, slowest: 0, work: 0, ...drawn };
    const span = frames[n - 1][0] - frames[0][0];
    return {
      fps: span > 0 ? ((n - 1) * 1000) / span : 0,
      slowest: Math.max(...frames.map((f) => f[1])),
      work: frames.reduce((s, f) => s + f[2], 0) / n,
      ...drawn,
    };
  };
  return {
    // A frame at `now` ms, whose own code took `work` ms. `render` is three's
    // renderer.info.render after it, or null when nothing was drawn.
    frame(now, work, render) {
      // A long gap (the page was hidden) starts the count again.
      if (prev && now - prev > 1000) frames.length = 0;
      frames.push([now, prev ? now - prev : 0, work]);
      prev = now;
      if (render) drawn = { calls: render.calls, triangles: render.triangles };
      while (frames.length && now - frames[0][0] > 1000) frames.shift();
    },
    stats,
    text() {
      const s = stats();
      const work = formatNumber(s.work, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return [
        t("meter.frames", { fps: Math.round(s.fps), slowest: Math.round(s.slowest) }),
        t("meter.work", { work, count: s.calls }),
        t("meter.triangles", { count: s.triangles }),
      ].join("\n");
    },
  };
}
