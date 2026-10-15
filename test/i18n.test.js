import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGUES, LANGUAGE, t } from "../src/i18n/index.js";
import { BLOCKS } from "../src/blockly/blocks.js";
import { LAB_TOOLBOX } from "../src/blockly/toolboxes.js";

const SRC = new URL("../src/", import.meta.url);
const sources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".js") ? [path] : [];
  });

test("t fills placeholders and shows a missing key as itself", () => {
  assert.equal(t("lab.selected", { name: "Robot" }), "Selected: Robot");
  assert.equal(t("no.such.key"), "no.such.key");
});

test("every interface key the code uses is in the catalogue", () => {
  const used = new Set();
  for (const file of sources(fileURLToPath(SRC))) {
    for (const m of readFileSync(file, "utf8").matchAll(/\bt\("([\w.]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 10);
  const missing = [...used].filter((key) => !(key in CATALOGUES[LANGUAGE].ui));
  assert.deepEqual(missing, []);
});

test("every block message the blocks and toolbox refer to is in the catalogue", () => {
  const text = JSON.stringify([BLOCKS, LAB_TOOLBOX]);
  const refs = [...text.matchAll(/%\{BKY_(\w+)\}/g)].map((m) => m[1]);
  assert.ok(refs.length > 20);
  for (const [language, catalogue] of Object.entries(CATALOGUES)) {
    const missing = refs.filter((key) => !(key in catalogue.blocks));
    assert.deepEqual(missing, [], language);
  }
});

test("each block message has one placeholder per input or field, in order", () => {
  for (const [language, catalogue] of Object.entries(CATALOGUES)) {
    for (const def of BLOCKS) {
      const key = def.message0.match(/^%\{BKY_(\w+)\}$/)?.[1];
      assert.ok(key, `${def.type}'s first line is a message reference`);
      const placeholders = [...catalogue.blocks[key].matchAll(/%(\d+)/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
      const expected = def.args0.map((_, i) => i + 1);
      assert.deepEqual(placeholders, expected, `${language} ${key}`);
    }
  }
});
