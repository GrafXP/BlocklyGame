const TAP = 8; // px a pointer can wander and still tap rather than drag

// The world's own pointer handling, on its canvas only: drag to pan, wheel or
// pinch to zoom, tap to select (`onSelect(id, x, y)`, with the thing tapped, or
// null, and where), and with a mouse, `onHover(x, y)` as it moves over the
// world and `onHover(null)` as it leaves. The editor lies over the
// canvas, so a gesture that starts on the editor never reaches here (PLAN.md
// §8); listeners live in `bin` and go when the page does.
export function bindWorldInput(bin, canvas, view, { onSelect, onHover = null }) {
  const pointers = new Map(); // id → { x, y, startX, startY }
  let dragged = false;
  let pinch = 0; // the distance between two pointers, while pinching

  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  bin.on(canvas, "pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
    if (pointers.size === 1) dragged = false;
    if (pointers.size === 2) {
      dragged = true; // a pinch is never a tap
      pinch = spread();
    }
  });

  bin.on(canvas, "pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (!pointers.size && e.pointerType === "mouse") onHover?.(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 1) {
      if (!dragged && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > TAP) dragged = true;
      if (dragged) view.panBy(dx, dy);
    } else if (pointers.size === 2) {
      const now = spread();
      if (pinch > 0 && now > 0) view.zoomBy(now / pinch);
      pinch = now;
    }
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    if (e.type === "pointerup" && pointers.size === 1 && !dragged) onSelect(view.pick(e.clientX, e.clientY), e.clientX, e.clientY);
    pointers.delete(e.pointerId);
    pinch = 0;
  };
  bin.on(canvas, "pointerup", end);
  bin.on(canvas, "pointercancel", end);
  if (onHover) bin.on(canvas, "pointerleave", () => onHover(null));

  bin.on(
    canvas,
    "wheel",
    (e) => {
      e.preventDefault();
      view.zoomBy(Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );
}
