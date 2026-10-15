// Small things kept in localStorage under "robot-island:<name>": settings, and
// until Phase 9 moves worlds and programs to IndexedDB (PLAN.md §10), the saved
// mission (saves.js).
//
// localStorage can be missing, full or blocked (private windows, node, a
// sandboxed frame); then nothing is remembered and the defaults apply.
const PREFIX = "robot-island:";

export function loadLocal(name, fallback = null, storage = globalThis.localStorage) {
  try {
    const text = storage?.getItem(PREFIX + name);
    return text == null ? fallback : JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Returns whether it was saved.
export function saveLocal(name, value, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(PREFIX + name, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Forgets `name`. Returns whether it could.
export function removeLocal(name, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.removeItem(PREFIX + name);
    return true;
  } catch {
    return false;
  }
}
