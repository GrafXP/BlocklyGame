import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocal, saveLocal } from "../src/storage/local.js";

function memoryStorage() {
  const items = new Map();
  return {
    items,
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => items.set(k, String(v)),
  };
}

test("a saved value loads back, under the game's prefix", () => {
  const storage = memoryStorage();
  assert.equal(saveLocal("lab", { opacity: 0.4 }, storage), true);
  assert.deepEqual(loadLocal("lab", null, storage), { opacity: 0.4 });
  assert.deepEqual([...storage.items.keys()], ["robot-island:lab"]);
});

test("nothing saved, or something unreadable, gives the fallback", () => {
  const storage = memoryStorage();
  assert.equal(loadLocal("missing", "fallback", storage), "fallback");
  storage.setItem("robot-island:broken", "{not json");
  assert.equal(loadLocal("broken", "fallback", storage), "fallback");
});

test("storage that is missing, blocked or full is survived", () => {
  const blocked = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(loadLocal("lab", "fallback", blocked), "fallback");
  assert.equal(saveLocal("lab", 1, blocked), false);
  assert.equal(loadLocal("lab", "fallback", undefined), "fallback");
  assert.equal(saveLocal("lab", 1, undefined), false);
});
