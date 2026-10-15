// Fills `el` with `markup` and returns a querySelector for it.
export function html(el, markup) {
  el.innerHTML = markup;
  return (sel) => el.querySelector(sel);
}

// Text made safe to put in markup.
export const esc = (text) =>
  String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// Goes to another page, as a link with data-link does (main.js listens).
export function go(path, how = "") {
  window.dispatchEvent(new CustomEvent("go", { detail: { path, how } }));
}

// The ?dev flag: test hooks on window and the lab's measurements.
export const isDev = () => new URLSearchParams(location.search).has("dev");
