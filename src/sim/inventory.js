import { thing } from "./things.js";

// Stores of items (PLAN.md §4): a robot's basket, a building's stock, a deposit.
// A store is plain data:
//
//   { items: { wood: 2 }, caps: { wood: 4, plank: 4 } | total: 2, in: {}, out: {} }
//
// `caps` limits each item a building takes (an item it has no cap for, it doesn't
// take); `total` limits a basket's items of any kinds together. `out` is items
// promised to leave and `in` room promised to items on their way, by actions
// under way: what's available is what's there and not promised, and the room is
// what's free and not promised. Counts are whole numbers; an item at 0 is left out.

export const count = (store, item) => store.items[item] ?? 0;
export const available = (store, item) => count(store, item) - (store.out[item] ?? 0);
const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

// The room for more of `item`.
export function room(store, item) {
  if (store.caps) return (store.caps[item] ?? 0) - count(store, item) - (store.in[item] ?? 0);
  return store.total - sum(store.items) - sum(store.in);
}

// A store holding `items` (counts of 0 left out), limited by `caps` or `total`.
export const makeStore = ({ items = {}, caps, total } = {}) => ({
  items: Object.fromEntries(Object.entries(items).filter(([, n]) => n)),
  ...(caps ? { caps: { ...caps } } : { total }),
  in: {},
  out: {},
});

function add(counts, item, n) {
  const next = (counts[item] ?? 0) + n;
  if (next) counts[item] = next;
  else delete counts[item];
}

// Promises `n` of `item` to leave (dir "out") or room for them to arrive ("in")
// at thing `at`. Returns the hold, which the action keeps until it settles or
// releases it.
export function reserve(world, at, dir, item, n) {
  add(thing(world, at).store[dir], item, n);
  return { at, dir, item, n };
}

// The action is done: what was promised happens, all at once.
export function settle(world, holds) {
  for (const { at, dir, item, n } of holds) {
    const store = thing(world, at).store;
    add(store[dir], item, -n);
    add(store.items, item, dir === "out" ? -n : n);
  }
}

// The action was cancelled: the promises go, and nothing moves.
export function release(world, holds) {
  for (const { at, dir, item, n } of holds) add(thing(world, at).store[dir], item, -n);
}

// Sets the count of `item` at `store`, within what's promised: never below what
// is promised to leave, nor above the room left by what's promised to arrive.
export function setCount(store, item, n) {
  const low = store.out[item] ?? 0;
  const high = store.caps ? (store.caps[item] ?? 0) - (store.in[item] ?? 0) : store.total - sum(store.items) + count(store, item) - sum(store.in);
  const value = Math.max(low, Math.min(high, n));
  add(store.items, item, value - count(store, item));
  return value;
}
