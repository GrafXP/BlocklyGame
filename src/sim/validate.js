import { walkable } from "./navigation.js";

// The rules a world keeps after every tick (PLAN.md §12), for the tests and for
// checking a loaded save later. Returns what's broken, for a developer to read;
// [] when all is well.
export function checkWorld(world) {
  const problems = [];
  const fail = (text) => problems.push(text);

  plainData(world, "world", fail);
  if (!Number.isInteger(world.tick) || world.tick < 0) fail(`tick ${world.tick}`);

  const ids = new Set();
  for (const [name, list] of [
    ["entities", world.entities],
    ["nodes", world.nodes],
  ]) {
    for (let i = 0; i < list.length; i++) {
      if (ids.has(list[i].id)) fail(`${list[i].id} twice`);
      ids.add(list[i].id);
      if (i && !(list[i - 1].id < list[i].id)) fail(`${name} out of id order at ${list[i].id}`);
    }
  }

  // Every hold of every action, added up, is what the stores have promised.
  const held = new Map();
  for (const e of world.entities) {
    for (const { at, dir, item, n } of e.action?.holds ?? []) {
      const key = `${at} ${dir} ${item}`;
      held.set(key, (held.get(key) ?? 0) + n);
    }
  }
  for (const t of [...world.entities, ...world.nodes]) {
    const { items, caps, total } = t.store;
    for (const dir of ["in", "out"]) {
      for (const [item, n] of Object.entries(t.store[dir])) {
        if (!(n > 0)) fail(`${t.id} ${dir} ${item} is ${n}`);
        if (held.get(`${t.id} ${dir} ${item}`) !== n) fail(`${t.id} ${dir} ${item} is ${n}, but actions hold ${held.get(`${t.id} ${dir} ${item}`) ?? 0}`);
        held.delete(`${t.id} ${dir} ${item}`);
      }
    }
    for (const [item, n] of Object.entries(items)) {
      if (!(n > 0)) fail(`${t.id} has ${n} ${item}`);
      if ((t.store.out[item] ?? 0) > n) fail(`${t.id} promises more ${item} than it has`);
    }
    if (caps) {
      for (const item of new Set([...Object.keys(items), ...Object.keys(t.store.in)])) {
        if ((items[item] ?? 0) + (t.store.in[item] ?? 0) > (caps[item] ?? 0)) fail(`${t.id} holds more ${item} than its cap`);
      }
    } else {
      const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
      if (sum(items) + sum(t.store.in) > total) fail(`${t.id}'s basket holds more than ${total}`);
    }
  }
  for (const key of held.keys()) fail(`actions hold ${key}, which no store has promised`);

  const walk = walkable(world);
  for (const e of world.entities) {
    if ([e.action, e.pending, e.error].filter(Boolean).length > 1) fail(`${e.id} is doing, waiting or failed at once`);
    if (e.kind === "robot" && !walk[e.cell]) fail(`${e.id} stands on cell ${e.cell}, which can't be walked on`);
  }
  return problems;
}

// Only whole numbers, strings, booleans, null, plain arrays and objects: what
// saves and loads exactly, and is the same on every machine (PLAN.md §6).
function plainData(value, path, fail) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) fail(`${path} is ${value}, not a whole number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => plainData(v, `${path}[${i}]`, fail));
    return;
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [k, v] of Object.entries(value)) plainData(v, `${path}.${k}`, fail);
    return;
  }
  fail(`${path} is ${typeof value}, not plain data`);
}
