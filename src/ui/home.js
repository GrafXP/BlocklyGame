import { missionText, t } from "../i18n/index.js";
import { esc, html } from "./dom.js";
import { languageChoice } from "./language-choice.js";

// The title page. It leads to the bridge slice, the mission of Phase 5, and
// below it to the prototypes of the phases so far: the free island in 3D, the
// editor lab and the world lab; the campaign and the sandbox come later
// (PLAN.md §11). The mission says how far it got when it's saved on this device,
// and can be started over, for the next player of a playtest. Its one listener
// is on its own element, and goes with it: the title page holds nothing that
// outlives it (src/lifecycle.js).
export function home(el) {
  let gone = false;
  // The ?dev flag goes along, so the pages' test hooks stay on.
  const link = (path) => `${path}${location.search}`;
  const $ = html(
    el,
    `<div class="page home">
      <img class="home-icon" src="/icon.svg" alt="" width="96" height="96" />
      <h1>${t("app.name")}</h1>
      <p class="tagline">${t("home.tagline")}</p>
      <a class="button primary" href="${link("/play")}" data-link>${esc(missionText("slice.title"))}</a>
      <p class="note">${t("home.playNote")} <strong class="saved" role="status"></strong></p>
      <div class="start-over" hidden>
        <button class="button small" data-home="ask" aria-expanded="false">${t("home.startOver")}</button>
        <div class="ask" hidden>
          <p>${t("home.startOverAsk")}</p>
          <button class="button small primary" data-home="yes">${t("home.startOverYes")}</button>
          <button class="button small" data-home="no">${t("home.startOverNo")}</button>
        </div>
      </div>
      <a class="button" href="${link("/island")}" data-link>${t("home.island")}</a>
      <p class="note">${t("home.islandNote")}</p>
      <a class="button" href="${link("/lab")}" data-link>${t("home.lab")}</a>
      <p class="note">${t("home.labNote")}</p>
      <a class="button" href="${link("/world")}" data-link>${t("home.world")}</a>
      <p class="note">${t("home.worldNote")}</p>
      ${languageChoice({ button: "button small" })}
    </div>`,
  );

  // How far the mission got, from the session, fetched only now: the title page
  // opens without the simulation.
  let session = null;
  function showSaved() {
    const summary = session.playSummary("slice");
    $(".saved").textContent = !summary ? "" : summary.completed ? t("home.completed") : summary.saved && summary.tick ? t("home.saved", { tick: summary.tick }) : "";
    $(".start-over").hidden = !summary;
    asking(false);
  }
  function asking(on) {
    $(".start-over .ask").hidden = !on;
    $('[data-home="ask"]').setAttribute("aria-expanded", String(on));
  }
  import("./session.js").then((m) => {
    if (gone) return;
    session = m;
    showSaved();
  });
  $(".home").addEventListener("click", (e) => {
    const act = e.target.closest("[data-home]")?.dataset.home;
    if (act === "ask") asking(true);
    else if (act === "no") asking(false);
    else if (act === "yes" && session) {
      session.forgetPlay("slice");
      showSaved();
    }
  });
  return () => (gone = true);
}
