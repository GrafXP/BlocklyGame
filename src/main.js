import "./style/base.css";
import { t } from "./i18n/index.js";
import { liveCounts } from "./lifecycle.js";
import { html, isDev } from "./ui/dom.js";
import { home } from "./ui/home.js";

const view = document.getElementById("view");
let cleanup = null;
let shown = null; // the path and query of the page that's showing

// A page is a function of the element to fill, returning its cleanup. Pages with
// Blockly or Three.js in them are fetched when first shown, so the title page
// opens without them.
const routes = {
  "/": home,
  "/lab": lazy(() => import("./ui/lab.js"), "lab"),
};

function lazy(load, name) {
  return (el) => {
    let gone = false;
    let stop = null;
    load().then((m) => {
      if (!gone) stop = m[name](el);
    });
    return () => {
      gone = true;
      stop?.();
    };
  };
}

function notFound(el) {
  html(el, `<div class="page"><h1>${t("notFound.title")}</h1><p>${t("notFound.text")}</p><p><a href="/" data-link>${t("nav.home")}</a></p></div>`);
}

function render() {
  try {
    cleanup?.();
  } catch (e) {
    console.error(e);
  }
  cleanup = null;
  view.innerHTML = "";
  cleanup = (routes[location.pathname] ?? notFound)(view) || null;
  shown = location.pathname + location.search;
}

// Goes to `path`, as a link with data-link does. data-link="replace" takes this
// page's place in the history instead of adding to it.
function navigate(path, how = "") {
  const url = new URL(path, location.href);
  const to = url.pathname + url.search;
  if (to !== shown) {
    if (how === "replace") history.replaceState(null, "", url);
    else history.pushState(null, "", url);
  }
  render();
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-link]");
  if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  navigate(link.getAttribute("href"), link.dataset.link);
});
window.addEventListener("go", (e) => navigate(e.detail.path, e.detail.how));
window.addEventListener("popstate", () => {
  if (location.pathname + location.search !== shown) render();
});

// The test hooks: what's still live, to check that leaving a page lets it all go.
if (isDev()) window.island = { counts: liveCounts };

render();
