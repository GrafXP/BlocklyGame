import "./style/base.css";
import { LANGUAGE_EVENT, setLanguage, startLanguage, t } from "./i18n/index.js";
import { liveCounts } from "./lifecycle.js";
import { html, isDev } from "./ui/dom.js";
import { home } from "./ui/home.js";

const view = document.getElementById("view");
let cleanup = null;
let shown = null; // the path and query of the page that's showing

// A page is a function of the element to fill, returning its cleanup, and the
// message that names it in the browser's tab. Pages with Blockly or Three.js in
// them are fetched when first shown, so the title page opens without them.
const routes = {
  "/": { page: home },
  "/lab": { page: lazy(() => import("./ui/lab.js"), "lab"), title: "lab.title" },
};

// A page from a module fetched on demand. Its `ready()`, if it has one, fetches
// what it needs before it's shown, such as Blockly's words in this language.
function lazy(load, name) {
  return (el) => {
    let gone = false;
    let stop = null;
    load().then(async (m) => {
      await m.ready?.();
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
  const route = routes[location.pathname] ?? { page: notFound, title: "notFound.title" };
  document.title = route.title ? t("page.title", { page: t(route.title), app: t("app.name") }) : t("app.name");
  cleanup = route.page(view) || null;
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
  const choice = e.target.closest("[data-language]");
  if (choice) {
    setLanguage(choice.dataset.language);
    return;
  }
  const link = e.target.closest("a[data-link]");
  if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  navigate(link.getAttribute("href"), link.dataset.link);
});
window.addEventListener("go", (e) => navigate(e.detail.path, e.detail.how));
window.addEventListener("popstate", () => {
  if (location.pathname + location.search !== shown) render();
});

// A new language opens the page that's showing again, in it (PLAN.md §8). An
// address that asked for a language (?dev&lang=…) would ask again on reload, so
// it stops asking.
window.addEventListener(LANGUAGE_EVENT, () => {
  const query = location.search.slice(1).split("&").filter((p) => p && !p.startsWith("lang="));
  if (query.length !== location.search.slice(1).split("&").filter(Boolean).length) {
    history.replaceState(null, "", location.pathname + (query.length ? `?${query.join("&")}` : "") + location.hash);
  }
  render();
});

// The test hooks: what's still live, to check that leaving a page lets it all go.
if (isDev()) window.island = { ...window.island, counts: liveCounts };

startLanguage().then(render);
