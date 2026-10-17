import { esc } from "../ui/dom.js";

// Execution markers: which entity is at which block (PLAN.md §8). Blockly marks
// selected or highlighted blocks, but can't say whose turn a block is, and several
// robots sharing a program can be at different blocks, or the same one. So the
// markers are our own SVG, laid over the workspace: an outline round the block's
// top row, and a label for each entity there, to the block's right, with its
// colour, its shape (for those who can't tell the colours apart) and its name.
// The chosen entity's label has a dark ring. Readings, what a block read when it
// was evaluated (src/ui/snapshot.js), sit as small badges on the top right
// corner of the block they belong to: a number, or ✓ and ✗ for true and false.
//
// layoutMarkers is the arithmetic, testable in node; createMarkers measures the
// blocks in the page and draws.

export const PILL_HEIGHT = 22;
const PILL_PAD = 8;
const PILL_GAP = 4;
const SHAPE_SIZE = 10;
const CHAR_WIDTH = 7; // px per character at the label's 12px; the labels are short
const OUTLINE_PAD = 3;
const OUTLINE_GAP = 6; // between the block and its first label
export const BADGE_HEIGHT = 18;
const BADGE_PAD = 6;
export const MIXED = "#1d2633"; // the outline of a block more than one entity is at

// `groups`: [{ blockId, box: { x, y, width, rowHeight }, entities: [...] }], in
// overlay pixels, each entity { id, name, colour, ink, shape, chosen? }.
// `readings`: [{ blockId, box, text, kind }], kind "number", "true", "false",
// "setting" or "call" (a use of one's own block the entity is inside).
// `right`: where the view ends; a block's labels that would run past it move
// left, onto the block's row, as far as its start. Returns the outlines, labels
// and badges to draw, labels in entity id order at each block.
export function layoutMarkers(groups, readings = [], right = Infinity) {
  const outlines = [];
  const pills = [];
  for (const { blockId, box, entities } of groups) {
    if (!entities.length) continue;
    const sorted = [...entities].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    outlines.push({
      blockId,
      x: box.x - OUTLINE_PAD,
      y: box.y - OUTLINE_PAD,
      width: box.width + 2 * OUTLINE_PAD,
      height: box.rowHeight + 2 * OUTLINE_PAD,
      colour: sorted.length === 1 ? sorted[0].colour : MIXED,
    });
    const widths = sorted.map((entity) => 2 * PILL_PAD + SHAPE_SIZE + 5 + entity.name.length * CHAR_WIDTH);
    const total = widths.reduce((a, b) => a + b + PILL_GAP, -PILL_GAP);
    let x = box.x + box.width + OUTLINE_GAP;
    if (x + total > right) x = Math.max(box.x + OUTLINE_GAP, right - OUTLINE_GAP - total);
    const y = box.y + (box.rowHeight - PILL_HEIGHT) / 2;
    sorted.forEach((entity, i) => {
      pills.push({ blockId, entity, x, y, width: widths[i], height: PILL_HEIGHT });
      x += widths[i] + PILL_GAP;
    });
  }
  const badges = readings.map(({ blockId, box, text, kind }) => {
    const width = Math.max(BADGE_HEIGHT, 2 * BADGE_PAD + [...text].length * CHAR_WIDTH);
    return { blockId, text, kind, x: box.x + box.width - width / 2, y: box.y - BADGE_HEIGHT / 2, width, height: BADGE_HEIGHT };
  });
  return { outlines, pills, badges };
}

const SVG = "http://www.w3.org/2000/svg";

export function shapePath(shape, cx, cy) {
  const r = SHAPE_SIZE / 2;
  if (shape === "square") return `M${cx - r} ${cy - r}h${2 * r}v${2 * r}h${-2 * r}z`;
  if (shape === "triangle") return `M${cx} ${cy - r - 0.5}L${cx + r + 0.5} ${cy + r}H${cx - r - 0.5}z`;
  if (shape === "diamond") return `M${cx} ${cy - r - 1}L${cx + r + 1} ${cy}L${cx} ${cy + r + 1}L${cx - r - 1} ${cy}z`;
  if (shape === "house") return `M${cx} ${cy - r - 0.5}L${cx + r + 0.5} ${cy - 0.5}V${cy + r}H${cx - r - 0.5}V${cy - 0.5}z`;
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

// An overlay on editor `editor` (src/blockly/workspace.js) inside `host`, the
// element the workspace fills. show(marks, readings) sets what's marked, as
// [{ entity, blockId }] and [{ blockId, text, kind }], and draws it at once, so
// it shows the same tick as the views drawn with it; the marks then follow the
// blocks as the workspace scrolls, zooms, resizes or changes. With `onPick`, a
// label can be tapped: onPick(entity id).
export function createMarkers(host, editor, Blockly, { onPick = null } = {}) {
  const { workspace } = editor;
  const svg = document.createElementNS(SVG, "svg");
  svg.classList.add("execution-markers");
  if (onPick) svg.classList.add("pickable");
  svg.setAttribute("aria-hidden", "true");
  const clip = document.createElementNS(SVG, "clipPath");
  clip.id = `markers-clip-${Math.random().toString(36).slice(2)}`;
  const clipRect = document.createElementNS(SVG, "rect");
  clip.appendChild(clipRect);
  const layer = document.createElementNS(SVG, "g");
  layer.setAttribute("clip-path", `url(#${clip.id})`);
  svg.append(clip, layer);
  host.appendChild(svg);

  let marked = [];
  let read = [];
  let dragging = false;
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  // Where block `id` is on the overlay, and how tall its first row is: a block
  // with statements inside (repeat, if) is outlined only down to them.
  function boxOf(id, origin) {
    const block = workspace.getBlockById(id);
    const path = block?.pathObject?.svgPath;
    if (!path || !block.rendered) return null;
    const r = path.getBoundingClientRect();
    const statement = block.inputList.find((input) => input.type === Blockly.inputs.inputTypes.STATEMENT);
    const rowHeight = statement ? statement.connection.getOffsetInBlock().y * workspace.scale : r.height;
    return { x: r.left - origin.left, y: r.top - origin.top, width: r.width, rowHeight: Math.min(rowHeight, r.height) };
  }

  function draw() {
    cancelAnimationFrame(frame);
    frame = 0;
    const origin = svg.getBoundingClientRect();
    // Only over the workspace, not the toolbox beside it.
    const area = workspace.getMetricsManager().getAbsoluteMetrics();
    clipRect.setAttribute("x", area.left);
    clipRect.setAttribute("y", area.top);
    clipRect.setAttribute("width", Math.max(0, origin.width - area.left));
    clipRect.setAttribute("height", Math.max(0, origin.height - area.top));

    const byBlock = new Map();
    for (const { entity, blockId } of marked) {
      if (!byBlock.has(blockId)) byBlock.set(blockId, []);
      byBlock.get(blockId).push(entity);
    }
    const groups = [];
    for (const [blockId, entities] of byBlock) {
      const box = boxOf(blockId, origin);
      if (box) groups.push({ blockId, box, entities });
    }
    const readings = read.map((r) => ({ ...r, box: boxOf(r.blockId, origin) })).filter((r) => r.box);
    const { outlines, pills, badges } = layoutMarkers(groups, readings, origin.width);

    const parts = [];
    for (const o of outlines) {
      const rect = `x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="10"`;
      parts.push(`<rect class="marker-halo" ${rect}/><rect class="marker-outline" ${rect} stroke="${o.colour}" data-block="${esc(o.blockId)}"/>`);
    }
    for (const p of pills) {
      const { entity } = p;
      const cy = p.y + p.height / 2;
      parts.push(
        `<g class="marker-pill${entity.chosen ? " chosen" : ""}" data-entity="${esc(entity.id)}" data-block="${esc(p.blockId)}">` +
          `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="${p.height / 2}" fill="${entity.colour}"/>` +
          `<path d="${shapePath(entity.shape, p.x + PILL_PAD + SHAPE_SIZE / 2, cy)}" fill="${entity.ink}"/>` +
          `<text x="${p.x + PILL_PAD + SHAPE_SIZE + 5}" y="${cy}" fill="${entity.ink}">${esc(entity.name)}</text>` +
          `</g>`,
      );
    }
    for (const b of badges) {
      parts.push(
        `<g class="marker-badge ${b.kind}" data-block="${esc(b.blockId)}">` +
          `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.height / 2}"/>` +
          `<text x="${b.x + b.width / 2}" y="${b.y + b.height / 2}">${esc(b.text)}</text></g>`,
      );
    }
    layer.innerHTML = parts.join("");
    if (dragging) schedule(); // a dragged block moves without events until it's dropped
  }

  const onChange = (e) => {
    if (e.type === Blockly.Events.BLOCK_DRAG) dragging = e.isStart;
    schedule();
  };
  workspace.addChangeListener(onChange);
  const ro = new ResizeObserver(schedule);
  ro.observe(host);
  const onClick = (e) => {
    const pill = e.target.closest?.(".marker-pill");
    if (pill) onPick(pill.dataset.entity);
  };
  if (onPick) svg.addEventListener("click", onClick);

  return {
    show(list, readings = []) {
      marked = list;
      read = readings;
      draw();
    },
    // What's drawn, for tests: each label's entity and block, and its box on screen.
    rects: () =>
      [...svg.querySelectorAll(".marker-pill")].map((g) => ({ entity: g.dataset.entity, block: g.dataset.block, chosen: g.classList.contains("chosen"), rect: g.getBoundingClientRect().toJSON() })),
    // Each badge's block and words.
    badges: () => [...svg.querySelectorAll(".marker-badge")].map((g) => ({ block: g.dataset.block, text: g.textContent })),
    dispose() {
      cancelAnimationFrame(frame);
      ro.disconnect();
      workspace.removeChangeListener(onChange);
      svg.removeEventListener("click", onClick);
      svg.remove();
    },
  };
}
