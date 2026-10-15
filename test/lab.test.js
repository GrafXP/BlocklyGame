import { test } from "node:test";
import assert from "node:assert/strict";
import { LAB_DEFAULTS, normalizeLabSettings } from "../src/ui/lab-settings.js";
import { DEMO_ENTITIES, demoMarkers, demoProgram } from "../src/ui/lab-demo.js";
import { checkLabPrograms } from "../src/ui/lab-check.js";

test("lab settings: nothing saved gives the defaults", () => {
  assert.deepEqual(normalizeLabSettings(null), LAB_DEFAULTS);
  assert.deepEqual(normalizeLabSettings("junk"), LAB_DEFAULTS);
});

test("lab settings: whatever was saved comes back valid", () => {
  const s = normalizeLabSettings({ treatment: "neon", opacity: 3, blur: "yes", world: "night", moving: false, panelWidth: 0.01, extra: 1 });
  assert.deepEqual(s, { ...LAB_DEFAULTS, opacity: 1, moving: false, panelWidth: 0.3 });
  assert.equal(normalizeLabSettings({ opacity: Number.NaN }).opacity, LAB_DEFAULTS.opacity);
  assert.equal(normalizeLabSettings({ treatment: "bold", world: "dusk" }).treatment, "bold");
});

// Every block in a Blockly JSON workspace, nested ones included.
function blocksIn(state) {
  const found = [];
  const visit = (b) => {
    if (!b) return;
    found.push(b);
    visit(b.next?.block);
    for (const input of Object.values(b.inputs ?? {})) {
      visit(input.block);
      visit(input.shadow);
    }
  };
  state.blocks.blocks.forEach(visit);
  return found;
}

test("the sample program's block ids are unique, and the sample markers point at its blocks", () => {
  const ids = blocksIn(demoProgram()).map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of DEMO_ENTITIES) for (const id of e.path) assert.ok(ids.includes(id), `${e.id} → ${id}`);
});

test("the sample markers move along their paths, and two robots meet at one block", () => {
  const at = (step) => Object.fromEntries(demoMarkers(step).map((m) => [m.entity.id, m.blockId]));
  assert.deepEqual(at(0), { r1: "collect", r2: "go-grove", saw: "if" });
  assert.equal(at(1).r1, "collect", "Robo 1 is on a long action");
  assert.equal(at(1).r2, "collect", "and Robo 2 catches up with it");
  assert.equal(at(2).r1, "go-mill");
});

test("the lab's two programs, each under its own start block, compile without a problem; a stack taken out is unused", () => {
  assert.deepEqual(checkLabPrograms(demoProgram()), []);
  // "unload" taken out of the collector's Repeat, and left lying beside it.
  const state = demoProgram();
  const unload = blocksIn(state).find((b) => b.id === "unload");
  delete blocksIn(state).find((b) => b.next?.block === unload).next;
  state.blocks.blocks.push(unload);
  // And the sawmill's comparison taken out of its If.
  delete blocksIn(state).find((b) => b.id === "if").inputs.IF0;
  assert.deepEqual(checkLabPrograms(state), [
    { code: "program.empty", block: "if" },
    { code: "program.unused", block: "unload" },
  ]);
  assert.deepEqual(checkLabPrograms({}), [{ code: "program.noStart" }]);
});
