import { t } from "../i18n/index.js";
import { baseOf, loadVersion, parentOf, programDoc, sameBlocks, sourceAt } from "../programming/programs.js";
import { esc } from "./dom.js";
import { currentLibrary } from "./session.js";

// The history of the program in the editor (PLAN.md §5), folded away under the
// editor's head until Versions opens it: every version applied, as a tree,
// oldest at the top. A version made from the one before follows it in line;
// versions made from an older one, put back into the draft and applied, branch
// off under it, indented, and the newest goes on in line. Each says whether the
// world runs it, and which one the draft came from.
//
// Tapping a version puts it into the draft, to change and apply: nothing runs
// it until it's applied. A draft with changes no version has is kept, and
// shown at the bottom, “Current, not applied yet”, to go back to
// (programs.js, loadVersion).

// The history of program `programId`, drawn in `el` while it's open.
export function createHistory(el, programId) {
  let open = false;
  let drawn = "";

  // The tree, with revision `running` the one the world runs.
  function markup(running) {
    const doc = programDoc(currentLibrary(), programId);
    const has = (revision) => doc.published.some((p) => p.revision === revision);
    const children = new Map(); // revision → indexes of the versions made from it
    const roots = [];
    doc.published.forEach((p, i) => {
      const parent = parentOf(doc, i);
      if (parent != null && has(parent)) children.set(parent, [...(children.get(parent) ?? []), i]);
      else roots.push(i);
    });
    const base = baseOf(doc);
    const changed = !sameBlocks(doc.draft, sourceAt(currentLibrary(), programId, base));
    const entry = (revision, marks, { kept = false } = {}) =>
      `<button class="history-entry${revision === base && !kept ? " base" : ""}${kept ? " kept" : ""}" data-version="${kept ? "kept" : revision}">` +
      `<span>${esc(kept ? t("history.kept") : t("history.version", { revision }))}</span>${marks.map((m) => `<small>${esc(m)}</small>`).join("")}</button>`;
    // The line of versions from index `i`: each with the branches made from it
    // indented under it, then on with the newest made from it.
    const line = (i) => {
      const items = [];
      for (let at = i; at !== undefined; ) {
        const { revision } = doc.published[at];
        const made = children.get(revision) ?? [];
        const marks = [];
        if (revision === running) marks.push(t("history.running"));
        if (revision === base) marks.push(t(changed ? "history.editingChanged" : "history.editing"));
        const branches = made.slice(0, -1).map((b) => `<ul class="history-branch">${line(b)}</ul>`);
        items.push(`<li>${entry(revision, marks)}${branches.join("")}</li>`);
        at = made.at(-1);
      }
      return items.join("");
    };
    const kept = doc.kept ? `<li>${entry(null, [t("history.keptFrom", { revision: doc.kept.from })], { kept: true })}</li>` : "";
    return `<p class="history-hint">${esc(t("history.hint"))}</p><ul class="history-tree">${roots.map(line).join("")}${kept}</ul>`;
  }

  return {
    get open() {
      return open;
    },
    toggle() {
      open = !open;
    },
    // Draws the tree, if it's open and has changed; `running` is the revision
    // the world runs.
    show(running) {
      const html = open ? markup(running) : "";
      el.hidden = !open;
      if (html === drawn) return;
      el.innerHTML = html;
      drawn = html;
    },
    // Puts version `which` (a revision, or "kept") into the draft. Returns
    // whether it did.
    pick(which) {
      return loadVersion(currentLibrary(), programId, which === "kept" ? "kept" : Number(which));
    },
  };
}
