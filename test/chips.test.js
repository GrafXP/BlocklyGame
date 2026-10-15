import { test } from "node:test";
import assert from "node:assert/strict";
import { ENGLISH, loadBlocklyMessages, loadMessages } from "../src/i18n/index.js";
import { BLOCKS } from "../src/blockly/blocks.js";
import { LAB_TOOLBOX, toolboxFor } from "../src/blockly/toolboxes.js";
import { blockIndex, readWorkspace } from "../src/programming/adapter.js";
import { ISLAND_PROGRAMS } from "../src/content/programs.js";
import { blockChip, blockColour, blockWords } from "../src/ui/chips.js";
import { compare, num, program, stock } from "./programs.js";

// Blocks as chips outside Blockly (PLAN.md §8): in the words the block has in
// the editor, in the player's language.

const english = await loadBlocklyMessages("en", ENGLISH.blocks);
const german = await loadBlocklyMessages("de", (await loadMessages("de")).blocks);
const island = new Map(ISLAND_PROGRAMS.flatMap(({ source }) => [...blockIndex(readWorkspace(source).tree)]));
const words = (id, messages = english) => blockWords(island.get(id), messages);

test("a block's chip has the block's words, its dropdowns' labels and the blocks in its gaps", () => {
  assert.equal(words("collector-go-grove"), "go to grove");
  assert.equal(words("collector-repeat"), "repeat 2 times");
  assert.equal(words("courier-take"), "pick up planks");
  assert.equal(words("courier-go-site"), "go to construction site");
  assert.equal(words("planks-until"), "wait until wood at sawmill > 0");
  assert.equal(words("bridge-build"), "build bridge");
  assert.equal(words("planks-forever"), "forever");
});

test("in German, a chip has the German block's words", () => {
  assert.equal(words("collector-go-grove", german), "gehe zu Wäldchen");
  assert.equal(words("collector-repeat", german), "wiederhole 2-mal:");
  assert.equal(words("planks-until", german), "warte bis Holz bei Sägewerk > 0");
  assert.equal(words("stones-go-quarry", german), "gehe zu Steinbruch");
});

test("an empty gap shows as …, and a comparison in a comparison is in brackets", () => {
  const { tree } = readWorkspace(program(compare("outer", compare("inner", stock("s", "plank", "site"), "LTE", num("n", 4)), "EQ", null)));
  const outer = blockIndex(tree).get("outer");
  assert.equal(blockWords(outer, english), "(planks at construction site ≤ 4) = …");
});

test("every block a program can hold has words for its chip, a colour and, for the game's blocks, a picture", () => {
  const toolboxes = [LAB_TOOLBOX, toolboxFor(["helper"]), toolboxFor(["sawmill"]), toolboxFor(["site"])];
  const types = new Set([...BLOCKS.map((b) => b.type), ...[...JSON.stringify(toolboxes).matchAll(/"type":"(\w+)"/g)].map((m) => m[1])]);
  for (const type of types) {
    const text = blockWords({ id: "x", type, fields: {}, inputs: {} }, english);
    assert.notEqual(text, type, `${type} has words`);
    assert.doesNotMatch(text, /%|BKY/, type);
    assert.notEqual(blockColour(type), "#d9dee5", `${type} has a colour family`);
  }
  assert.match(blockChip(island.get("collector-go-grove"), english), /<img src="data:image\/svg\+xml,/);
  assert.match(blockChip(island.get("collector-go-grove"), english, { title: 'a "b"' }), /title="a &quot;b&quot;"/);
});
