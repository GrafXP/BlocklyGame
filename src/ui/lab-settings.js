import { DEFAULT_TREATMENT, TREATMENTS } from "../blockly/treatments.js";

// The editor lab's controls, as remembered between visits. Whatever was saved,
// or wasn't, comes back as a whole, valid set.
export const LAB_DEFAULTS = {
  treatment: DEFAULT_TREATMENT,
  opacity: 0.6, // of the editor's background; 0 shows the world fully
  blur: false,
  world: "day",
  moving: true,
  markers: true,
  panelWidth: 0.56, // of the window's width
};

const clamp = (v, lo, hi, fallback) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);

export function normalizeLabSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const d = LAB_DEFAULTS;
  return {
    treatment: Object.hasOwn(TREATMENTS, s.treatment) ? s.treatment : d.treatment,
    opacity: clamp(s.opacity, 0, 1, d.opacity),
    blur: bool(s.blur, d.blur),
    world: s.world === "dusk" ? "dusk" : "day",
    moving: bool(s.moving, d.moving),
    markers: bool(s.markers, d.markers),
    panelWidth: clamp(s.panelWidth, 0.3, 0.85, d.panelWidth),
  };
}
