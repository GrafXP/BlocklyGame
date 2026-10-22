import { t } from "../i18n/index.js";
import { esc } from "./dom.js";

// The game's icons (PLAN.md §8, amendment of 18 October 2026): a line drawing
// each, 24 units square, in the colour of the words round it. A button that is
// only an icon carries its words as aria-label and title, and a mark that is
// only an icon has its words beside it for screen readers (.vh), so nothing
// the game says is lost by saying it in a picture.

const PATHS = {
  // The page's own buttons.
  home: `<path d="M3 11l9-7 9 7"/><path d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5"/>`,
  chevron: `<path d="M6 9l6 6 6-6"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  gear: `<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="6.6"/>`,
  robots: `<rect x="4.5" y="8" width="15" height="11" rx="3"/><path d="M12 8V4.8"/><circle cx="12" cy="3.6" r="1.2"/><circle cx="9.3" cy="13" r="1.4" fill="currentColor"/><circle cx="14.7" cy="13" r="1.4" fill="currentColor"/><path d="M2 12.5v3M22 12.5v3"/>`,
  together: `<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/>`,
  library: `<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6"/>`,
  build: `<path d="M13.5 3.5l7 7-3 3-7-7z"/><path d="M12 8.5L3.6 16.9a1.6 1.6 0 0 0 0 2.2l1.3 1.3a1.6 1.6 0 0 0 2.2 0L15.5 12"/>`,
  addRobot: `<rect x="2.5" y="9" width="12" height="10" rx="2.5"/><path d="M8.5 9V6"/><circle cx="6.3" cy="13.8" r="1.1" fill="currentColor"/><circle cx="10.7" cy="13.8" r="1.1" fill="currentColor"/><path d="M19 4v7M15.5 7.5h7"/>`,
  island: `<path d="M2.5 18c2 0 2.2-1.5 4.7-1.5S10 18 12 18s2.3-1.5 4.8-1.5S19.5 18 21.5 18"/><path d="M5.5 15c1.2-3.6 3.6-5.5 6.5-5.5s5.3 1.9 6.5 5.5"/><path d="M12 9.5V3.5l4 2-4 2"/>`,
  camera: `<path d="M3.5 8.5h3.2l1.8-2.8h7l1.8 2.8h3.2v10.8h-17z"/><circle cx="12" cy="13.5" r="3.4"/>`,
  // The clock.
  play: `<path d="M8 5.2v13.6c0 .8.86 1.28 1.54.86l10.2-6.8a1 1 0 0 0 0-1.72L9.54 4.34C8.86 3.92 8 4.4 8 5.2z" fill="currentColor" stroke="none"/>`,
  pause: `<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>`,
  step: `<path d="M5.5 6.4v11.2c0 .7.8 1.1 1.4.7l8-5.6a.85.85 0 0 0 0-1.4l-8-5.6c-.6-.4-1.4 0-1.4.7z" fill="currentColor" stroke="none"/><path d="M18.5 5.5v13"/>`,
  next: `<rect x="2.5" y="3.5" width="12" height="6.5" rx="1.5"/><rect x="2.5" y="14" width="12" height="6.5" rx="1.5" fill="currentColor"/><path d="M19.5 4.5v11.5M16.5 13l3 3 3-3"/>`,
  restart: `<path d="M3.5 4.5v5h5"/><path d="M4.4 14.5A8 8 0 1 0 6.3 6.3L3.5 9.5"/>`,
  steps: `<path d="M3.5 19.5h4.5v-4.5h4.5v-4.5h4.5V6h3.5"/>`,
  // The view's own controls.
  turnLeft: `<path d="M9 7H5V3"/><path d="M5.6 7A8 8 0 1 1 4 12"/>`,
  turnRight: `<path d="M15 7h4V3"/><path d="M18.4 7A8 8 0 1 0 20 12"/>`,
  zoomIn: `<path d="M12 5v14M5 12h14"/>`,
  zoomOut: `<path d="M5 12h14"/>`,
  resetView: `<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>`,
  // The editor and the program library.
  check: `<path d="M4.5 12.5l4.8 4.8L19.5 7"/>`,
  undo: `<path d="M9 14.5L4 9.5l5-5"/><path d="M4 9.5h10.5a5.5 5.5 0 0 1 0 11H11"/>`,
  starter: `<path d="M12 21v-9"/><path d="M12 12C12 7.6 9 5.5 4.5 5.5c0 4.4 3 6.5 7.5 6.5z"/><path d="M12 14.5c0-3.9 2.6-6 7.5-6 0 3.9-2.6 6-7.5 6z"/>`,
  blank: `<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14.5 3v4.5H19"/>`,
  history: `<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/><path d="M12 7.5V12l3 2"/>`,
  blocks: `<path d="M3 4h5.5l1.5 1.5h3L14.5 4H21v6h-6.5L13 11.5h-3L8.5 10H3z"/><path d="M3 14h5.5l1.5 1.5h3l1.5-1.5H21v6H3z"/>`,
  pencil: `<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>`,
  give: `<path d="M2.5 12h10"/><path d="M9 8l4 4-4 4"/><circle cx="18.5" cy="8" r="2.6"/><path d="M14.8 20c0-2.6 1.6-4.6 3.7-4.6s3.7 2 3.7 4.6"/>`,
  copy: `<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h3.5"/>`,
  archive: `<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V20h14V8.5"/><path d="M10 12.5h4"/>`,
  restore: `<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V20h14V8.5"/><path d="M12 18v-6.5M9.5 14l2.5-2.5 2.5 2.5"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  // The mission.
  hint: `<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v.5h5V16c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>`,
  // What a robot or building is doing, and has.
  doing: `<path d="M2.5 12h4l3-7.5 5 15 3-7.5h4"/>`,
  where: `<path d="M12 21s-7-6.1-7-11.4a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`,
  basket: `<path d="M3 10h18l-2 10H5z"/><path d="M7 10l3-6M17 10l-3-6"/>`,
  has: `<path d="M3 7.5l9-4.5 9 4.5v9.5l-9 4.5-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9.5"/>`,
  reads: `<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  loop: `<path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-2a4 4 0 0 1 4-4h12"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5v2a4 4 0 0 1-4 4H4"/>`,
  memory: `<path d="M4 4h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-4 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 9.5h8"/>`,
  inside: `<rect x="3" y="3.5" width="18" height="17" rx="2.5"/><rect x="7" y="9" width="10" height="6" rx="1.2"/>`,
  inbox: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>`,
  // A building's order, a list on a clipboard; a robot's Supply, a load on its way.
  order: `<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9.5 4V2.8h5V4"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>`,
  supply: `<rect x="2.5" y="8" width="8" height="7" rx="1.2"/><path d="M13 11.5h7.5M17.5 8.5l3 3-3 3"/><path d="M2.5 19h18"/>`,
  // A robot's shield, and the opponent's side.
  shield: `<path d="M12 3l7.5 3v5.5c0 4.8-3.3 7.9-7.5 9.5-4.2-1.6-7.5-4.7-7.5-9.5V6z"/>`,
  opponent: `<path d="M12 3l7.5 3v5.5c0 4.8-3.3 7.9-7.5 9.5-4.2-1.6-7.5-4.7-7.5-9.5V6z"/><path d="M9 9l6 6M15 9l-6 6"/>`,
  team: `<circle cx="9" cy="8" r="3.2"/><path d="M2.8 20c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6"/><circle cx="17.2" cy="9" r="2.6"/><path d="M16.5 14.1c2.8.4 4.7 2.8 4.7 5.9"/>`,
  // A robot or building's state.
  ready: `<circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>`,
  moving: `<path d="M4 12h14M13 6l6 6-6 6"/>`,
  working: `<circle cx="12" cy="12" r="2.6"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M6 18l1.8-1.8M16.2 7.8L18 6"/>`,
  waiting: `<circle cx="5.5" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor" stroke="none"/>`,
  stopped: `<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>`,
  error: `<path d="M12 6.5v7.5"/><circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none"/>`,
  pending: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
};

// Icon `name` as SVG markup, `size` CSS pixels square.
export function icon(name, size = 22) {
  return `<svg class="icon icon-${name}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
}

// A button that is icon `name` alone, named `label`, its tooltip `title`;
// `attrs` are its other attributes, `className` its classes beside
// "button icon".
export const iconButton = (name, label, { attrs = "", className = "", title = label } = {}) =>
  `<button type="button" class="button icon${className ? ` ${className}` : ""}" aria-label="${esc(label)}" title="${esc(title)}"${attrs ? ` ${attrs}` : ""}>${icon(name)}</button>`;

// A robot or building's state as its icon, its word for screen readers and
// on hover.
export function stateMark(state) {
  const word = t(`state.${state}`);
  return `<span class="state ${state}" title="${esc(word)}">${icon(state, 14)}<span class="vh">${esc(word)}</span></span>`;
}

// Number `n` in a bubble, saying `words` on hover; `className` gives its look.
export const num = (n, words = "", className = "") => `<span class="num${className ? ` ${className}` : ""}"${words ? ` title="${esc(words)}"` : ""}>${esc(String(n))}</span>`;
