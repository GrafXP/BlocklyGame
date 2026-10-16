import { display } from "../i18n/index.js";
import { markOf } from "../render/identity.js";
import { readingWords } from "./inspector.js";

// The execution markers of program `programId` (src/blockly/markers.js), from a
// tick's snapshot (snapshot.js): a marker for each entity running it at its
// active block, the chosen one `selected` marked as chosen, and the chosen
// one's readings as badges: ✓ and ✗ for conditions, numbers for senses, a
// place's or item's name for a setting.
// Returns { list, readings } for markers' show().
export function marksFor(world, snapshot, programId, selected) {
  const list = [];
  let readings = [];
  for (const entry of snapshot.entities) {
    if (entry.program !== programId || !entry.block) continue;
    const e = world.entities.find((it) => it.id === entry.id);
    if (!e) continue;
    list.push({ entity: { id: e.id, name: display(e.name), ...markOf(world, e.id), chosen: e.id === selected }, blockId: entry.block });
    if (e.id === selected) {
      readings = Object.entries(entry.readings).map(([blockId, value]) =>
        typeof value === "boolean"
          ? { blockId, text: value ? "✓" : "✗", kind: String(value) }
          : { blockId, text: readingWords(value, world), kind: typeof value === "string" ? "setting" : "number" },
      );
    }
  }
  return { list, readings };
}
