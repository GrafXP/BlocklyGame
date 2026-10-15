// Laying out labels over the 3D world (PLAN.md §8), so none covers another.
// Each label `{ id, x, y, w, h }` wants its bottom middle at (x, y), in screen
// pixels. The lowest on screen, nearest the camera, keeps its place; one that
// would cover a label already placed moves up above it, `gap` pixels clear.
// Returns Map id → { x, y }, each label's bottom middle. Ties go by id, so the
// same labels always land the same way.
export function declutter(labels, gap = 2) {
  const order = [...labels].sort((a, b) => b.y - a.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const placed = [];
  const out = new Map();
  for (const label of order) {
    const left = label.x - label.w / 2;
    const right = label.x + label.w / 2;
    let bottom = label.y;
    for (let moves = 0; moves <= placed.length; moves++) {
      const top = bottom - label.h;
      const hit = placed.find((p) => left < p.right + gap && right > p.left - gap && top < p.bottom + gap && bottom > p.top - gap);
      if (!hit) break;
      bottom = hit.top - gap;
    }
    placed.push({ left, right, top: bottom - label.h, bottom });
    out.set(label.id, { x: label.x, y: bottom });
  }
  return out;
}
