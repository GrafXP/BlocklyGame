import { test } from "node:test";
import assert from "node:assert/strict";
import { MIXED, PILL_HEIGHT, layoutMarkers } from "../src/blockly/markers.js";

const robo = (id, colour = "#d9480f") => ({ id, name: `Robo ${id}`, colour, ink: "#ffffff", shape: "circle" });
const box = { x: 100, y: 50, width: 180, rowHeight: 40 };

test("one entity: an outline round the block's top row in its colour, its label to the right", () => {
  const { outlines, pills } = layoutMarkers([{ blockId: "b", box, entities: [robo("r1")] }]);
  assert.equal(outlines.length, 1);
  assert.equal(outlines[0].colour, "#d9480f");
  assert.ok(outlines[0].x < box.x && outlines[0].x + outlines[0].width > box.x + box.width);
  assert.ok(outlines[0].height > box.rowHeight && outlines[0].height < box.rowHeight + 10);
  assert.equal(pills.length, 1);
  assert.ok(pills[0].x > box.x + box.width);
  assert.equal(pills[0].y + PILL_HEIGHT / 2, box.y + box.rowHeight / 2); // centred on the row
});

test("several entities at one block: a mixed outline and a label each, in id order, side by side", () => {
  const { outlines, pills } = layoutMarkers([{ blockId: "b", box, entities: [robo("r2", "#1864ab"), robo("r1")] }]);
  assert.equal(outlines[0].colour, MIXED);
  assert.deepEqual(
    pills.map((p) => p.entity.id),
    ["r1", "r2"],
  );
  assert.ok(pills[1].x >= pills[0].x + pills[0].width, "labels don't overlap");
  assert.equal(pills[0].y, pills[1].y);
});

test("a block with nobody at it gets no marks", () => {
  const { outlines, pills } = layoutMarkers([{ blockId: "b", box, entities: [] }]);
  assert.deepEqual(outlines, []);
  assert.deepEqual(pills, []);
});

test("a longer name makes a wider label", () => {
  const [short] = layoutMarkers([{ blockId: "b", box, entities: [{ ...robo("a"), name: "Bo" }] }]).pills;
  const [long] = layoutMarkers([{ blockId: "b", box, entities: [{ ...robo("a"), name: "Sawmill north" }] }]).pills;
  assert.ok(long.width > short.width);
});
