// The island's ground: a grid of cells, each with a kind and a height (PLAN.md
// §4). Content draws it as rows of characters, one per cell; the world keeps
// those characters as one string, row after row, so a cell is an index into it:
// cell = z * width + x. Heights are a string of digits in the same order. A
// walkable kind has a whole-number cost to step onto (navigation.js).

export const KINDS = {
  "~": { id: "water", walk: false, height: 0 },
  ",": { id: "sand", walk: true, height: 1, cost: 1 },
  ".": { id: "grass", walk: true, height: 1, cost: 1 },
  "=": { id: "gap", walk: false, height: 0 }, // where a bridge will go
  "+": { id: "bridge", walk: true, height: 1, cost: 1 },
};

// The terrain drawn by `rows`, all the same length, of KINDS' characters.
export function parseTerrain(rows) {
  const width = rows[0]?.length ?? 0;
  for (const [z, row] of rows.entries()) {
    if (row.length !== width) throw new Error(`terrain row ${z} is ${row.length} cells, not ${width}`);
    for (const ch of row) if (!KINDS[ch]) throw new Error(`terrain row ${z}: no kind "${ch}"`);
  }
  const kinds = rows.join("");
  return { width, height: rows.length, kinds, heights: [...kinds].map((ch) => KINDS[ch].height).join("") };
}

export const cellAt = (terrain, x, z) => z * terrain.width + x;
export const xOf = (terrain, cell) => cell % terrain.width;
export const zOf = (terrain, cell) => Math.floor(cell / terrain.width);
export const inside = (terrain, x, z) => x >= 0 && z >= 0 && x < terrain.width && z < terrain.height;
export const kindOf = (terrain, cell) => KINDS[terrain.kinds[cell]].id;
export const groundWalkable = (terrain, cell) => KINDS[terrain.kinds[cell]].walk;
export const stepCost = (terrain, cell) => KINDS[terrain.kinds[cell]].cost;

// Changes the cells `cells` to kind `ch`, and their heights to its height.
export function setKind(terrain, cells, ch) {
  const kinds = [...terrain.kinds];
  const heights = [...terrain.heights];
  for (const cell of cells) {
    kinds[cell] = ch;
    heights[cell] = String(KINDS[ch].height);
  }
  terrain.kinds = kinds.join("");
  terrain.heights = heights.join("");
}

// The cells of the rectangle { x, z, w, d }.
export function areaCells(terrain, { x, z, w, d }) {
  const cells = [];
  for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) cells.push(cellAt(terrain, x + dx, z + dz));
  return cells;
}
