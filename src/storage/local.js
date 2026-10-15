// Small settings kept in localStorage under "robot-island:<name>". Worlds and
// programs will go to IndexedDB (PLAN.md §10); this is for preferences only.
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
