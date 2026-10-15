import { t } from "../i18n/index.js";
import { html } from "./dom.js";
import { languageChoice } from "./language-choice.js";

// The title page. For now it leads to the Phase 0 editor lab; the campaign and the
// sandbox come later (PLAN.md §11).
export function home(el) {
  // The ?dev flag goes along, so the lab's test hooks stay on.
  const lab = `/lab${location.search}`;
  html(
    el,
    `<div class="page home">
      <img class="home-icon" src="/icon.svg" alt="" width="96" height="96" />
      <h1>${t("app.name")}</h1>
      <p class="tagline">${t("home.tagline")}</p>
      <a class="button primary" href="${lab}" data-link>${t("home.lab")}</a>
      <p class="note">${t("home.labNote")}</p>
      ${languageChoice({ button: "button small" })}
    </div>`,
  );
}
