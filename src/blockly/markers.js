import { esc } from "../ui/dom.js";

// Execution markers: which entity is at which block (PLAN.md §8). Blockly marks
// selected or highlighted blocks, but can't say whose turn a block is, and several
// robots sharing a program can be at different blocks, or the same one. So the
// markers are our own SVG, laid over the workspace: an outline round the block's
// top row, and a label for each entity there, to the block's right, with its
// colour, its shape (for those who can't tell the colours apart) and its name.
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
export const MIXED = "#1d2633"; // the outline of a block more than one entity is at

// `groups`: [{ blockId, box: { x, y, width, rowHeight }, entities: [...] }], in
// overlay pixels, each entity { id, name, colour, ink, shape }. Returns the
// outlines and labels to draw, labels in entity id order at each block.
export function layoutMarkers(groups) {
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
    let x = box.x + box.width + OUTLINE_GAP;
    const y = box.y + (box.rowHeight - PILL_HEIGHT) / 2;
    for (const entity of sorted) {
      const width = 2 * PILL_PAD + SHAPE_SIZE + 5 + entity.name.length * CHAR_WIDTH;
      pills.push({ blockId, entity, x, y, width, height: PILL_HEIGHT });
      x += width + PILL_GAP;
    }
  }
  return { outlines, pills };
}

const SVG = "http://www.w3.org/2000/svg";

function shapePath(shape, cx, cy) {
  const r = SHAPE_SIZE / 2;
  if (shape === "square") return `M${cx - r} ${cy - r}h${2 * r}v${2 * r}h${-2 * r}z`;
  if (shape === "triangle") return `M${cx} ${cy - r - 0.5}L${cx + r + 0.5} ${cy + r}H${cx - r - 0.5}z`;
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

// An overlay on editor `editor` (src/blockly/workspace.js) inside `host`, the
// element the workspace fills. show([{ entity, blockId }]) sets what's marked;
// the marks follow the blocks as the workspace scrolls, zooms, resizes or changes.
export function createMarkers(host, editor, Blockly) {
  const { workspace } = editor;
  const svg = document.createElementNS(SVG, "svg");
  svg.classList.add("execution-markers");
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
    const { outlines, pills } = layoutMarkers(groups);

    const parts = [];
    for (const o of outlines) {
      const rect = `x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="10"`;
      parts.push(`<rect class="marker-halo" ${rect}/><rect class="marker-outline" ${rect} stroke="${o.colour}" data-block="${o.blockId}"/>`);
    }
    for (const p of pills) {
      const { entity } = p;
      const cy = p.y + p.height / 2;
      parts.push(
        `<g class="marker-pill" data-entity="${entity.id}" data-block="${p.blockId}">` +
          `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="${p.height / 2}" fill="${entity.colour}"/>` +
          `<path d="${shapePath(entity.shape, p.x + PILL_PAD + SHAPE_SIZE / 2, cy)}" fill="${entity.ink}"/>` +
          `<text x="${p.x + PILL_PAD + SHAPE_SIZE + 5}" y="${cy}" fill="${entity.ink}">${esc(entity.name)}</text>` +
          `</g>`,
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

  return {
    show(list) {
      marked = list;
      schedule();
    },
    // What's drawn, for tests: each label's entity and block, and its box on screen.
    rects: () =>
      [...svg.querySelectorAll(".marker-pill")].map((g) => ({ entity: g.dataset.entity, block: g.dataset.block, rect: g.getBoundingClientRect().toJSON() })),
    dispose() {
      cancelAnimationFrame(frame);
      ro.disconnect();
      workspace.removeChangeListener(onChange);
      svg.remove();
    },
  };
}
