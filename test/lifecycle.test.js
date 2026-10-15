import { test } from "node:test";
import assert from "node:assert/strict";
import { createBin, count, liveCounts, probe } from "../src/lifecycle.js";

test("a bin's listeners hear events until it's emptied, and are counted while live", () => {
  const target = new EventTarget();
  const heard = [];
  const before = liveCounts();
  const bin = createBin();
  bin.on(target, "ping", (e) => heard.push(e.type));
  assert.equal(liveCounts().bins, before.bins + 1);
  assert.equal(liveCounts().listeners, before.listeners + 1);
  target.dispatchEvent(new Event("ping"));
  bin.dispose();
  target.dispatchEvent(new Event("ping"));
  assert.deepEqual(heard, ["ping"]);
  assert.deepEqual(liveCounts(), before);
});

test("emptying a bin undoes newest first, once", () => {
  const order = [];
  const bin = createBin();
  bin.add(() => order.push("first"));
  bin.add(() => order.push("second"));
  bin.dispose();
  bin.dispose();
  assert.deepEqual(order, ["second", "first"]);
  assert.equal(bin.open, false);
});

test("something added to an emptied bin is undone at once", () => {
  const bin = createBin();
  bin.dispose();
  let undone = false;
  bin.add(() => (undone = true));
  assert.ok(undone);
  const target = new EventTarget();
  let heard = false;
  bin.on(target, "ping", () => (heard = true));
  target.dispatchEvent(new Event("ping"));
  assert.equal(heard, false);
});

test("one failing undo doesn't stop the rest", (t) => {
  const logged = [];
  t.mock.method(console, "error", (e) => logged.push(e.message));
  const bin = createBin();
  let ran = false;
  bin.add(() => (ran = true));
  bin.add(() => {
    throw new Error("broken dispose");
  });
  bin.dispose();
  assert.ok(ran);
  assert.deepEqual(logged, ["broken dispose"]);
});

test("counts and probes report what modules hold outside bins", () => {
  const before = liveCounts().widgets ?? 0;
  count("widgets", 1);
  assert.equal(liveCounts().widgets, before + 1);
  count("widgets", -1);
  assert.equal(liveCounts().widgets, before);
  let n = 3;
  probe("library", () => n);
  assert.equal(liveCounts().library, 3);
  n = 0;
  assert.equal(liveCounts().library, 0);
});
