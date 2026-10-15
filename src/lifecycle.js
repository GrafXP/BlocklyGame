// Every page owns what it adds to the document (listeners, observers, animation
// frames, Blockly workspaces, WebGL renderers) and gives all of it back when the
// page is left. A bin collects these as they're made, so a page's cleanup is one
// dispose() (main.js calls it), however the page was built.
//
// The live counts are for tests: after leaving a page, no bin, listener, editor or
// view of it should still be counted. Modules that hold resources outside a bin
// add their own count (count) or a probe of a library's state (probe).

const live = { bins: 0, listeners: 0 };
const probes = new Map();

export function createBin() {
  const undo = [];
  let open = true;
  live.bins++;

  const bin = {
    get open() {
      return open;
    },
    // Listens for `type` on `target` until the bin is emptied. Returns `fn`.
    on(target, type, fn, options) {
      if (!open) return fn;
      target.addEventListener(type, fn, options);
      live.listeners++;
      undo.push(() => {
        target.removeEventListener(type, fn, options);
        live.listeners--;
      });
      return fn;
    },
    // Calls `fn` when the bin is emptied: a dispose(), a disconnect(), a cancel.
    // Added after that, it's called at once: the page it belongs to is gone.
    add(fn) {
      if (open) undo.push(fn);
      else fn();
      return fn;
    },
    // Calls `fn(now)` every animation frame until the bin is emptied.
    frames(fn) {
      let id = 0;
      const frame = (now) => {
        id = requestAnimationFrame(frame);
        fn(now);
      };
      id = requestAnimationFrame(frame);
      bin.add(() => cancelAnimationFrame(id));
    },
    // Undoes everything, newest first. One failing undo doesn't stop the rest.
    dispose() {
      if (!open) return;
      open = false;
      live.bins--;
      while (undo.length) {
        try {
          undo.pop()();
        } catch (e) {
          console.error(e);
        }
      }
    },
  };
  return bin;
}

// Adds `delta` to the live count `name`: +1 when a resource is made, -1 when it's
// let go.
export function count(name, delta) {
  live[name] = (live[name] ?? 0) + delta;
}

// Reports `fn()` as the live count `name`, for state a library keeps itself.
export function probe(name, fn) {
  probes.set(name, fn);
}

export function liveCounts() {
  const counts = { ...live };
  for (const [name, fn] of probes) counts[name] = fn();
  return counts;
}
