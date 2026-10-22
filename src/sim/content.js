import { SETTINGS, SIDES, TYPES } from "./entities.js";
import { makeStore } from "./inventory.js";
import { cellAt, inside } from "./terrain.js";

// Robots, buildings and deposits as content describes them (src/content/
// island.js), made into world state: createWorld makes a world's things this
// way, a mission's setup adds them (staging.js), and so does the sandbox's
// `add` command. Who runs what is the caller's to settle.
//
// A robot is { id, type, name, cell: [x, z], items?, role?, settings?,
// program?, side?, shield? }, the player's unless its side says, its shield
// whole unless said (combat.js); a building { id, type, name, area, access: [[x, z], …], items?,
// caps?, order?, program?, blueprint?, gap?, built? }; a deposit { id, type, name,
// area, access, items, caps, regrow? }. `built` is for a construction site
// whose bridge is already there.

// Thing `given` on `terrain`, as world state. `where` names the content, for a
// developer reading an error.
export function makeThing(terrain, given, where = "content") {
  const cell = ([x, z]) => {
    if (!inside(terrain, x, z)) throw new Error(`${where}: cell ${x}, ${z} is off the map`);
    return cellAt(terrain, x, z);
  };
  const type = TYPES[given.type];
  if (!type) throw new Error(`${where}: ${given.id} has no type "${given.type}"`);
  if (type.kind === "node") {
    return {
      id: given.id,
      kind: "node",
      type: given.type,
      name: given.name,
      area: { ...given.area },
      access: given.access.map(cell),
      store: makeStore({ items: given.items, caps: given.caps }),
      ...(given.regrow && { regrow: { ...given.regrow } }),
    };
  }
  const base = { id: given.id, kind: type.kind, type: given.type, name: given.name, own: given.program ?? null };
  const runner = { action: null, pending: null, error: null, runtime: null };
  if (type.kind === "robot") {
    const settings = Object.fromEntries(Object.keys(SETTINGS).map((slot) => [slot, given.settings?.[slot] ?? null]));
    const side = given.side ?? "player";
    if (!SIDES.includes(side)) throw new Error(`${where}: ${given.id} is on no side "${side}"`);
    const shield = given.shield ?? type.shield;
    if (!(Number.isInteger(shield) && shield >= 0 && shield <= type.shield)) throw new Error(`${where}: ${given.id}'s shield can't be ${shield}`);
    return { ...base, side, role: given.role ?? null, settings, cell: cell(given.cell), shield, store: makeStore({ items: given.items, total: type.basket }), ...runner };
  }
  const blueprint = given.blueprint ?? (given.gap ? "bridge" : null);
  return {
    ...base,
    area: { ...given.area },
    access: given.access.map(cell),
    store: makeStore({ items: given.items, caps: given.caps }),
    ...(given.order && { order: { ...given.order } }),
    ...(blueprint && { blueprint, built: !!given.built }),
    ...(given.gap && { gap: given.gap.map(cell) }),
    ...runner,
  };
}

// `thing` put into `list`, kept in order of id.
export function insertById(list, thing) {
  const at = list.findIndex((t) => t.id > thing.id);
  list.splice(at < 0 ? list.length : at, 0, thing);
}
