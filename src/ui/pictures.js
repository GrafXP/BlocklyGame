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
  bridge: `<path d="M2 11h20v3H2z"/><path d="M4 14v4M20 14v4M4 18q8-6 16 0" fill="none"/><path d="M3 11V8M21 11V8M3 8h18" fill="none"/>`,
  workshop: `<path d="M3 20V11l9-6 9 6v9z"/><path d="M9 20v-5h6v5M16 7V4h2v4.5" fill="none"/>`,
  // Places a robot goes to, and a basket for a trip.
  grove: `<path d="M12 3l6 8h-3l4 5H5l4-5H6z"/><path d="M12 16v5" fill="none"/>`,
  camp: `<path d="M12 4L3 20h18z"/><path d="M12 4v16M9 20l3-6 3 6" fill="none"/>`,
  depot: `<path d="M4 9h16v11H4z"/><path d="M4 9l2-4h12l2 4M10 13h4" fill="none"/>`,
  place: `<path d="M6 21V4"/><path d="M6 4h12l-3 4 3 4H6" />`,
  basket: `<path d="M3 10h18l-2 10H5z"/><path d="M7 10l3-6M17 10l-3-6M8 14v3M12 14v3M16 14v3" fill="none"/>`,
};

const COLOURS = {
  wood: ["#b9783d", "#6e4019"],
  stone: ["#aab1b9", "#4d555e"],
  plank: ["#d39a5b", "#7a4a1f"],
  kit: ["#f0a830", "#7a4d06"],
  bridge: ["#a8713f", "#5c3a17"],
  workshop: ["#f4f1ea", "#7a3a26"],
  grove: ["#5fae5a", "#2d6a2a"],
  camp: ["#f1c86b", "#7d5a12"],
  depot: ["#c9a26b", "#6a4b1e"],
  place: ["#ef6b5b", "#7f2a20"],
  basket: ["#e5c48a", "#7a5a2a"],
};

// The picture for place `id`, when a goal is to get there.
export const placePicture = (id) => (["grove", "camp", "depot", "workshop"].includes(id) ? id : "place");

// Picture `name` as SVG markup, `size` CSS pixels square; `there` false draws
// its outline only.
export function picture(name, { there = true, size = 32 } = {}) {
  const [fill, ink] = COLOURS[name];
  const paint = there ? `fill="${fill}" stroke="${ink}"` : `fill="none" stroke="#7d8896" stroke-dasharray="3 2"`;
  return `<svg class="picture${there ? "" : " missing"}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><g ${paint} stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${SHAPES[name]}</g></svg>`;
}
