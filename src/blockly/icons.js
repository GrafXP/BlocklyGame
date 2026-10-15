// The small pictures at the front of the game's blocks, so a block can be known
// before its words are read. Each is a dark shape on a white disc, which reads the
// same on light and dark block colours. They're data URIs, so they work offline
// and under a CSP of img-src 'self' data:.
const INK = "#1d2633";
const disc = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff" stroke="${INK}" stroke-opacity=".18"/>` +
  `<g fill="${INK}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

const SHAPES = {
  start: `<path d="M10 7.5v9l6.5-4.5z"/>`,
  go: `<path d="M8.5 5.5v13" fill="none"/><path d="M9 6h7.5l-2 3 2 3H9z"/>`,
  collect: `<path d="M9 11.5l3-4 3 4" fill="none"/><path d="M6 11.5h12l-1.6 6.5H7.6z"/>`,
  unload: `<path d="M12 5v6.5M9.5 9l2.5 2.5L14.5 9" fill="none"/><rect x="6.5" y="13.5" width="11" height="5" rx="1"/>`,
  make: `<circle cx="12" cy="12" r="4.2" fill="none" stroke-width="2.6" stroke-dasharray="2.2 1.1"/><circle cx="12" cy="12" r="1.3" stroke="none"/>`,
  wait: `<path d="M8.5 6h7l-3.5 6 3.5 6h-7l3.5-6z" stroke-width="1.4"/>`,
  forever: `<path d="M16.8 13.2A5 5 0 1 1 15.6 8.4" fill="none"/><path d="M17.2 5.6v3.8h-3.8z" stroke-width="1"/>`,
};

export const ICONS = Object.fromEntries(Object.entries(SHAPES).map(([name, inner]) => [name, `data:image/svg+xml,${encodeURIComponent(disc(inner))}`]));
