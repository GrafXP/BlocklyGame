// Small pictures of items and of what gets built, for the mission card
// (mission.js), so a goal reads before its words do (docs/campaign-plan.md:
// “supported by source, item, quantity, and destination pictures”). Each is
// inline SVG, filled when it's there and a dashed outline of itself when it's
// still to come, so the two differ by shape and not only by colour. They're
// decoration: the words beside them say the same for screen readers.

const SHAPES = {
  wood: `<rect x="3" y="9" width="18" height="8" rx="4"/><circle cx="19" cy="13" r="2.4" fill="none"/>`,
  stone: `<path d="M4 17l2.5-7 6-3 6.5 3 1 7z"/><path d="M9 11l3 2 4-2" fill="none"/>`,
  plank: `<rect x="1.5" y="7.5" width="21" height="9" rx="1.5"/><path d="M4.5 10.5h8M9 13.5h10" fill="none"/>`,
  kit: `<path d="M4 9l8-4 8 4v8l-8 4-8-4z"/><path d="M4 9l8 4 8-4M12 13v8" fill="none"/>`,
  // A bucket of water, an apple for food, a charge pack's battery.
  water: `<path d="M5 9h14l-1.7 11H6.7z"/><path d="M5.5 9q6.5-7 13 0" fill="none"/><path d="M7.5 12.5q2.3 1.5 4.5 0t4.5 0" fill="none"/>`,
  food: `<circle cx="12" cy="14" r="6.5"/><path d="M12 7.5c0-2 .9-3.4 2.8-4" fill="none"/><path d="M11.8 7.6c-2.2-1.6-4.6-.9-5.3 1 1.9.9 3.9.6 5.3-1z"/>`,
  pack: `<rect x="5.5" y="6" width="13" height="15" rx="2"/><path d="M9.5 6V3.5h5V6"/><path d="M13 9.5l-3 4.5h4l-3 4.5" fill="none"/>`,
  // A stone block, cut square, with its joints; lumps of charcoal; a rock of
  // ore with its specks of iron; an iron bar, an ingot.
  block: `<rect x="3" y="7.5" width="18" height="10" rx="1"/><path d="M3 12.5h18M10 7.5v5M14 12.5v5" fill="none"/>`,
  charcoal: `<path d="M3 18l2.5-5 4-1.5 2.5 2.5 4-2.5 3 1.5 2 5z"/><path d="M8 15l1.5 1.5M15 15l.5 2" fill="none"/>`,
  ironOre: `<path d="M4 17l2.5-7 6-3 6.5 3 1 7z"/><path d="M9.5 12.5h.01M14.5 14.5h.01M13 10.5h.01" fill="none" stroke-width="2.6"/>`,
  iron: `<path d="M3 17l3-7h12l3 7z"/><path d="M6 10l1.6 3.5h8.8L18 10" fill="none"/>`,
  // A new robot, for a goal that makes one.
  robot: `<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V5" fill="none"/><circle cx="12" cy="4" r="1.2"/><path d="M9 13h.01M15 13h.01" fill="none" stroke-width="2.6"/>`,
  // A guard, its shield and a pulse it sends, for a goal about guarding.
  guard: `<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V5" fill="none"/><circle cx="12" cy="4" r="1.2"/><path d="M8.5 12.5h7" fill="none" stroke-width="2.2"/><path d="M12 14.5l3 1.2v1.5c0 1.1-1.3 1.9-3 2.3-1.7-.4-3-1.2-3-2.3v-1.5z" fill="none" stroke-width="1.2"/>`,
  shield: `<path d="M12 3l7.5 3v5.5c0 4.8-3.3 7.9-7.5 9.5-4.2-1.6-7.5-4.7-7.5-9.5V6z"/><path d="M12 7v10M8 11.5h8" fill="none"/>`,
  pulse: `<circle cx="14" cy="12" r="5"/><path d="M2.5 12h4M4 8.5l3 1.5M4 15.5l3-1.5" fill="none"/>`,
  // The rally flag, and the crossing at the bridge.
  flag: `<path d="M6 21V3" fill="none"/><path d="M6.5 4h12l-3 4 3 4h-12z"/>`,
  crossing: `<path d="M2 12h20v3H2z"/><path d="M5 15v4M19 15v4" fill="none"/><path d="M2 20.5q2.5-1.5 5 0t5 0 5 0 5 0" fill="none"/><path d="M12 3l4 3h-2.5v3h-3V6H8z"/>`,
  bridge: `<path d="M2 11h20v3H2z"/><path d="M4 14v4M20 14v4M4 18q8-6 16 0" fill="none"/><path d="M3 11V8M21 11V8M3 8h18" fill="none"/>`,
  workshop: `<path d="M3 20V11l9-6 9 6v9z"/><path d="M9 20v-5h6v5M16 7V4h2v4.5" fill="none"/>`,
  // The smelter: a furnace with its chimney and the glow of its mouth.
  smelter: `<path d="M3 20V10h12v10z"/><path d="M15 20v-5h6v5zM6 10V4h3.5v6" /><path d="M6.5 16.5q2.5-3 5 0" fill="none"/>`,
  // Places a robot goes to, and a basket for a trip.
  grove: `<path d="M12 3l6 8h-3l4 5H5l4-5H6z"/><path d="M12 16v5" fill="none"/>`,
  camp: `<path d="M12 4L3 20h18z"/><path d="M12 4v16M9 20l3-6 3 6" fill="none"/>`,
  depot: `<path d="M4 9h16v11H4z"/><path d="M4 9l2-4h12l2 4M10 13h4" fill="none"/>`,
  place: `<path d="M6 21V4"/><path d="M6 4h12l-3 4 3 4H6" />`,
  basket: `<path d="M3 10h18l-2 10H5z"/><path d="M7 10l3-6M17 10l-3-6M8 14v3M12 14v3M16 14v3" fill="none"/>`,
  // A thought: one for each count a robot is to remember.
  memory: `<path d="M4 4h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-4 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 9.5h8" fill="none"/>`,
};

const COLOURS = {
  wood: ["#b9783d", "#6e4019"],
  stone: ["#aab1b9", "#4d555e"],
  plank: ["#d39a5b", "#7a4a1f"],
  kit: ["#f0a830", "#7a4d06"],
  water: ["#6db5ea", "#1f5f99"],
  food: ["#e8594a", "#8a2318"],
  pack: ["#86d35f", "#2f6b1c"],
  block: ["#d8d2c5", "#5e584d"],
  charcoal: ["#55565c", "#18181b"],
  ironOre: ["#b0826a", "#4f3022"],
  iron: ["#c3cdd8", "#4a5563"],
  smelter: ["#e7c9ad", "#7a3a26"],
  robot: ["#f4f1ea", "#475467"],
  guard: ["#e3e7ee", "#24456b"],
  shield: ["#8fd3ff", "#1c5c8a"],
  pulse: ["#ffd84d", "#a2620a"],
  flag: ["#ef6b5b", "#7f2a20"],
  crossing: ["#a8713f", "#5c3a17"],
  bridge: ["#a8713f", "#5c3a17"],
  workshop: ["#f4f1ea", "#7a3a26"],
  grove: ["#5fae5a", "#2d6a2a"],
  camp: ["#f1c86b", "#7d5a12"],
  depot: ["#c9a26b", "#6a4b1e"],
  place: ["#ef6b5b", "#7f2a20"],
  basket: ["#e5c48a", "#7a5a2a"],
  memory: ["#f3b3c8", "#8a2c52"],
};

// The picture for place `id`, when a goal is to get there.
export const placePicture = (id) => (["grove", "camp", "depot", "workshop", "smelter", "flag", "crossing"].includes(id) ? id : "place");

// Picture `name` as SVG markup, `size` CSS pixels square; `there` false draws
// its outline only.
export function picture(name, { there = true, size = 32 } = {}) {
  const [fill, ink] = COLOURS[name];
  const paint = there ? `fill="${fill}" stroke="${ink}"` : `fill="none" stroke="#7d8896" stroke-dasharray="3 2"`;
  return `<svg class="picture${there ? "" : " missing"}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><g ${paint} stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${SHAPES[name]}</g></svg>`;
}
