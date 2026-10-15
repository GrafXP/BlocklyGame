import { t } from "../i18n/index.js";
import { html } from "./dom.js";
import { languageChoice } from "./language-choice.js";

// The title page. For now it leads to the prototypes of the phases so far: the
// island in 3D, the editor lab and the world lab; the campaign and the sandbox
// come later (PLAN.md §11).
export function home(el) {
  // The ?dev flag goes along, so the labs' test hooks stay on.
  const island = `/island${location.search}`;
  const lab = `/lab${location.search}`;
  const world = `/world${location.search}`;
  html(
    el,
    `<div class="page home">
      <img class="home-icon" src="/icon.svg" alt="" width="96" height="96" />
      <h1>${t("app.name")}</h1>
      <p class="tagline">${t("home.tagline")}</p>
      <a class="button primary" href="${island}" data-link>${t("home.island")}</a>
      <p class="note">${t("home.islandNote")}</p>
      <a class="button" href="${lab}" data-link>${t("home.lab")}</a>
      <p class="note">${t("home.labNote")}</p>
      <a class="button" href="${world}" data-link>${t("home.world")}</a>
      <p class="note">${t("home.worldNote")}</p>
      ${languageChoice({ button: "button small" })}
    </div>`,
  );
}
