import "./style/base.css";
import { LANGUAGE_EVENT, missionText, setLanguage, startLanguage, t } from "./i18n/index.js";
import { liveCounts } from "./lifecycle.js";
import { html, isDev } from "./ui/dom.js";
import { home } from "./ui/home.js";

const view = document.getElementById("view");
let cleanup = null;
let shown = null; // the path and query of the page that's showing

// A page is a function of the element to fill, returning its cleanup, and what
// names it in the browser's tab: a message, or a function giving the words.
// Pages other than the title page are fetched when first shown, so it opens
// without Blockly, Three.js or the world. /play is the campaign, at the mission
// it's at, /replay?mission=… a mission played again, /free free play and the
// sandbox, and /slice Phase 5's bridge slice (src/ui/island.js); the island
// page names the tab after the mission once it knows which.
const routes = {
  "/": { page: home },
  "/play": { page: lazy(() => import("./ui/island.js"), "play"), title: "campaign.title" },
  "/replay": { page: lazy(() => import("./ui/island.js"), "replay"), title: "campaign.title" },
  "/free": { page: lazy(() => import("./ui/island.js"), "free"), title: "free.title" },
  "/slice": { page: lazy(() => import("./ui/island.js"), "slice"), title: () => missionText("slice.title") },
  "/lab": { page: lazy(() => import("./ui/lab.js"), "lab"), title: "lab.title" },
  "/world": { page: lazy(() => import("./ui/world.js"), "world"), title: "world.title" },
  "/island": { page: lazy(() => import("./ui/island.js"), "island"), title: "island.title" },
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
  const page = typeof route.title === "function" ? route.title() : route.title && t(route.title);
  document.title = page ? t("page.title", { page, app: t("app.name") }) : t("app.name");
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
