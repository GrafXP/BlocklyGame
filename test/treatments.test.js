import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCK_STYLES, FAMILIES, TOOLBOX_MIN, TREATMENTS, surfaceAlphas } from "../src/blockly/treatments.js";
import { BLOCKS } from "../src/blockly/blocks.js";
import { LAB_TOOLBOX } from "../src/blockly/toolboxes.js";
import { DEMO_ENTITIES } from "../src/ui/lab-demo.js";
import { BUILDING_MARK, IDENTITIES } from "../src/render/identity.js";

// WCAG 2 contrast. 4.5:1 is the level for ordinary text; block words are small
// and read by children, so nothing less will do.
const READABLE = 4.5;
const rgbOf = (c) => (typeof c === "string" ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c);
const luminance = (c) => {
  const [r, g, b] = rgbOf(c).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (rgb, alpha, behind) => rgb.map((v, i) => Math.round(v * alpha + behind[i] * (1 - alpha)));
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

// The classic treatment is Blockly's own colouring, kept as the baseline.
const restyled = Object.entries(TREATMENTS).filter(([name]) => name !== "classic");

test("words on blocks are readable on every block colour", () => {
  for (const [name, tr] of restyled) {
    for (const family of FAMILIES) {
      const ratio = contrast(tr.blockInk, tr.colours[family].primary);
      assert.ok(ratio >= READABLE, `${name} ${family}: ${ratio.toFixed(2)}`);
    }
  }
});

test("toolbox labels are readable over the brightest and darkest world", () => {
  for (const [name, tr] of Object.entries(TREATMENTS)) {
    for (const behind of [WHITE, BLACK]) {
      const ratio = contrast(tr.toolbox.ink, over(tr.toolbox.rgb, TOOLBOX_MIN, behind));
      assert.ok(ratio >= READABLE, `${name} over ${behind}: ${ratio.toFixed(2)}`);
    }
  }
});

test("a selected category's label is readable on its colour", () => {
  for (const [name, tr] of restyled) {
    for (const family of FAMILIES) {
      const ratio = contrast(tr.toolbox.selectedInk, tr.colours[family].primary);
      assert.ok(ratio >= READABLE, `${name} ${family}: ${ratio.toFixed(2)}`);
    }
  }
});

test("marker labels are readable on their own colour", () => {
  for (const e of [...DEMO_ENTITIES, ...IDENTITIES.map((it, i) => ({ ...it, id: `robot ${i}` })), { ...BUILDING_MARK, id: "a building" }]) {
    const ratio = contrast(e.ink, e.colour);
    assert.ok(ratio >= READABLE, `${e.id}: ${ratio.toFixed(2)}`);
  }
});

test("every treatment colours every family, and every style used has a family", () => {
  for (const [name, tr] of Object.entries(TREATMENTS)) {
    assert.deepEqual(Object.keys(tr.colours).sort(), [...FAMILIES].sort(), name);
  }
  for (const def of BLOCKS) assert.ok(def.style in BLOCK_STYLES, def.type);
  for (const category of LAB_TOOLBOX.contents) {
    assert.ok(FAMILIES.includes(category.categorystyle.replace(/_category$/, "")), category.categorystyle);
  }
});

test("surfaces follow the background opacity, within their limits", () => {
  assert.deepEqual(surfaceAlphas(0), { panel: 0, toolbox: TOOLBOX_MIN, flyout: 0.55 });
  assert.deepEqual(surfaceAlphas(1), { panel: 1, toolbox: 1, flyout: 1 });
  assert.deepEqual(surfaceAlphas(-2), surfaceAlphas(0));
  assert.deepEqual(surfaceAlphas(7), surfaceAlphas(1));
  let prev = surfaceAlphas(0);
  for (let o = 0.05; o <= 1; o += 0.05) {
    const now = surfaceAlphas(o);
    for (const k of ["panel", "toolbox", "flyout"]) assert.ok(now[k] >= prev[k], `${k} at ${o}`);
    prev = now;
  }
});
