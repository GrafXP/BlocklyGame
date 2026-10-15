import { display, t } from "../i18n/index.js";
import { blockChip } from "./chips.js";
import { amounts, describeReason } from "./describe.js";
import { esc } from "./dom.js";
import { detailsHtml, identityMark } from "./inspector.js";
import { blockOf, programName } from "./session.js";
import { entryIn } from "./snapshot.js";

// The execution overview (PLAN.md §8, "Every program is observable"): a row for
// every robot and building, on screen or not, with its program and version, the
// block it's at as a chip (outlined when it took that block in the latest
// step), its state, and why it waits or stopped; then the deposits with what
// they hold. The chosen one's row opens to show its details (inspector.js).
// Rows are drawn from the tick's snapshot (snapshot.js), and only those whose
// words changed are drawn again.
export function createOverview(el) {
  let shownWorld = null;
  const drawn = new Map(); // id → the markup its row last had

  // Row `id`'s markup.
  function rowHtml(world, snapshot, id, selected, words) {
    const it = [...world.entities, ...world.nodes].find((e) => e.id === id);
    const entry = entryIn(snapshot, id);
    const chosen = id === selected;
    const name = display(it.name);
    const head =
      `<button class="row-head" data-pick="${esc(id)}" aria-expanded="${chosen}">` +
      `${identityMark(world, id)}<span class="row-name">${esc(name)}</span>` +
      (entry ? `<span class="state ${entry.state}">${esc(t(`state.${entry.state}`))}</span>` : "") +
      `</button>`;
    const parts = [head];
    if (entry?.program) {
      const program = t("overview.program", { program: display(programName(entry.program)), revision: entry.revision });
      const newest = snapshot.programs.find((p) => p.id === entry.program)?.newest;
      const pending = newest > entry.revision ? t("overview.pending", { revision: newest }) : "";
      parts.push(`<p class="row-program" title="${esc(program)}">${esc(program)}</p>`);
      if (pending) parts.push(`<p class="row-pending">${esc(pending)}</p>`);
    }
    const node = entry?.block ? blockOf(entry.program, entry.revision, entry.block) : null;
    if (node) parts.push(`<div class="row-block">${blockChip(node, words, entry.fresh ? { className: "fresh", title: t("world.evaluated") } : {})}</div>`);
    if (entry?.reason) parts.push(`<p class="why">${esc(describeReason(world, entry.reason))}</p>`);
    if (!entry) parts.push(`<p class="row-has">${esc(amounts(it.store.items))}</p>`);
    if (chosen) parts.push(detailsHtml(world, id, entry, words));
    return parts.join("");
  }

  return {
    // Shows `world` as of `snapshot`, with thing `selected` open, its blocks
    // worded with Blockly's `words`.
    show(world, snapshot, selected, words) {
      if (shownWorld !== world) {
        const ids = [...world.entities, ...world.nodes].map((e) => e.id);
        el.innerHTML =
          `<p class="hint">${esc(t("inspector.hint"))}</p>` +
          `<h2 class="everyone">${esc(t("inspector.everyone"))}</h2>` +
          `<ul class="rows">${ids.map((id) => `<li class="row" data-row="${esc(id)}"></li>`).join("")}</ul>`;
        drawn.clear();
        shownWorld = world;
      }
      el.querySelector(".hint").hidden = !!selected;
      for (const li of el.querySelectorAll(".row")) {
        const id = li.dataset.row;
        const markup = rowHtml(world, snapshot, id, selected, words);
        if (drawn.get(id) === markup) continue;
        const entry = entryIn(snapshot, id);
        li.className = `row ${entry ? entry.state : "node"}${id === selected ? " selected" : ""}`;
        li.innerHTML = markup;
        drawn.set(id, markup);
      }
    },
    // Brings the chosen row into view.
    reveal(id) {
      el.querySelector(`.row[data-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
    },
  };
}
