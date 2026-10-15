import { display, t } from "../i18n/index.js";
import { blockChip, blockWords } from "./chips.js";
import { amounts, describeReason } from "./describe.js";
import { esc } from "./dom.js";
import { detailsActions, detailsHtml, identityMark } from "./inspector.js";
import { blockOf, programName } from "./session.js";
import { entryIn } from "./snapshot.js";

// The execution overview (PLAN.md §8, "Every program is observable"): a row for
// every robot and building, on screen or not, with its program and version, the
// block it's at as a chip (outlined when it took that block in the latest
// step), its state, and why it waits or stopped; then the deposits with what
// they hold. The chosen one's row opens to show its details (inspector.js).
// Rows are drawn from the tick's snapshot (snapshot.js).
//
// The list holds still while the world runs, so its buttons can be pressed:
// - Each row is made once, and only the parts whose words changed are drawn
//   again. A button is never replaced while it's there to be pressed: the
//   rows' heads keep theirs, and the chosen row's buttons are drawn again only
//   when the choice changes.
// - A row that isn't chosen keeps one height: its lines are kept, empty or not,
//   and each is one line, shortened with an ellipsis (the whole of it on hover).
//   The chosen row's buttons come first, under its name, so its details
//   changing below them doesn't move them.
export function createOverview(el) {
  let shownWorld = null;
  const rows = new Map(); // id → { li, head state, actions, info, details, drawn: { part → markup } }

  // Draws `part` of row `row` as `markup`, if that's new.
  function draw(row, part, markup) {
    if (row.drawn[part] === markup) return;
    row[part].innerHTML = markup;
    row.drawn[part] = markup;
  }

  // The lines under the head: its program and version, a newer version waiting
  // for the next step, its block, and why it waits or stopped; a deposit's
  // stock. A robot or building with a program always has its block and reason
  // lines, empty or not.
  function infoHtml(world, snapshot, it, entry, words) {
    if (!entry) return `<p class="row-has" title="${esc(amounts(it.store.items))}">${esc(amounts(it.store.items))}</p>`;
    if (!entry.program) return "";
    const parts = [];
    const program = t("overview.program", { program: display(programName(entry.program)), revision: entry.revision });
    parts.push(`<p class="row-program" title="${esc(program)}">${esc(program)}</p>`);
    const newest = snapshot.programs.find((p) => p.id === entry.program)?.newest;
    if (newest > entry.revision) parts.push(`<p class="row-pending">${esc(t("overview.pending", { revision: newest }))}</p>`);
    const node = entry.block ? blockOf(entry.program, entry.revision, entry.block) : null;
    const chip = node ? blockChip(node, words, entry.fresh ? { className: "fresh", title: t("world.evaluated") } : {}) : "";
    parts.push(`<div class="row-block"${node ? ` title="${esc(blockWords(node, words))}"` : ""}>${chip}</div>`);
    const why = entry.reason ? describeReason(world, entry.reason) : "";
    parts.push(`<p class="why"${why ? ` title="${esc(why)}"` : ""}>${esc(why)}</p>`);
    return parts.join("");
  }

  return {
    // Shows `world` as of `snapshot`, with thing `selected` open, its blocks
    // worded with Blockly's `words`.
    show(world, snapshot, selected, words) {
      if (shownWorld !== world) {
        const things = [...world.entities, ...world.nodes];
        el.innerHTML =
          `<p class="hint">${esc(t("inspector.hint"))}</p>` +
          `<h2 class="everyone">${esc(t("inspector.everyone"))}</h2>` +
          `<ul class="rows">${things
            .map(
              (it) =>
                `<li class="row" data-row="${esc(it.id)}">` +
                `<button class="row-head" data-pick="${esc(it.id)}" aria-expanded="false">${identityMark(world, it.id)}<span class="row-name">${esc(display(it.name))}</span><span class="state" hidden></span></button>` +
                `<div class="row-actions" hidden></div><div class="row-info"></div><div class="row-details"></div></li>`,
            )
            .join("")}</ul>`;
        rows.clear();
        for (const li of el.querySelectorAll(".row")) {
          const $ = (sel) => li.querySelector(sel);
          rows.set(li.dataset.row, { li, head: $(".row-head"), state: $(".state"), actions: $(".row-actions"), info: $(".row-info"), details: $(".row-details"), drawn: {} });
        }
        shownWorld = world;
      }
      el.querySelector(".hint").hidden = !!selected;
      for (const [id, row] of rows) {
        const it = [...world.entities, ...world.nodes].find((e) => e.id === id);
        const entry = entryIn(snapshot, id);
        const chosen = id === selected;
        const className = `row ${entry ? entry.state : "node"}${chosen ? " selected" : ""}`;
        if (row.li.className !== className) row.li.className = className;
        row.head.setAttribute("aria-expanded", String(chosen));
        if (entry) {
          const word = t(`state.${entry.state}`);
          if (row.state.textContent !== word || row.state.hidden) {
            row.state.hidden = false;
            row.state.className = `state ${entry.state}`;
            row.state.textContent = word;
          }
        }
        row.actions.hidden = !chosen;
        draw(row, "actions", chosen ? detailsActions(entry) : "");
        draw(row, "info", infoHtml(world, snapshot, it, entry, words));
        draw(row, "details", chosen ? detailsHtml(world, id, entry, words) : "");
      }
    },
    // Brings the chosen row into view.
    reveal(id) {
      rows.get(id)?.li.scrollIntoView({ block: "nearest" });
    },
  };
}
