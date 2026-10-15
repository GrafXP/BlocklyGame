import { language, languages, t } from "../i18n/index.js";
import { esc } from "./dom.js";

// The choice of language (PLAN.md §8): each language under its own name and in
// its own language (lang=…), never as a flag. A click switches at once; main.js
// listens for data-language anywhere on the page.
export function languageChoice({ group = "language-choice", button = "" } = {}) {
  const choices = languages()
    .map(({ code, name, locale }) => `<button type="button" class="${button}" lang="${locale ?? code}" data-language="${code}" aria-pressed="${code === language()}">${esc(name)}</button>`)
    .join("");
  return `<div class="${group}" role="group" aria-label="${esc(t("language.choose"))}">${choices}</div>`;
}
