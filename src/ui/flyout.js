import { display, t } from "../i18n/index.js";
import { thing } from "../sim/things.js";
import { esc } from "./dom.js";
import { detailsActions, detailsHtml, identityMark } from "./inspector.js";
import { entryIn } from "./snapshot.js";

// The chosen robot, building or deposit's flyout (PLAN.md §8): chosen in the
// overview's list or on the island, it opens beside the list, level with its
// row (island.js places it), and has everything about it: its name and state;
// Edit program; where its program comes from, with its own copy or back to the
// shared one, and a robot's team, name and settings (setup.js); and what it's
// doing, where, what it holds, what its block read, what it remembers and the
// blocks it's inside (inspector.js). Close, Escape, or choosing it again in the
// list closes it.
//
// It holds still while the world runs, as the list does: each part is drawn
// again only when it changes, so its buttons stay there to be pressed.

export function createFlyout(el) {
  el.innerHTML =
    `<div class="flyout-head"><div class="flyout-title"></div>` +
    `<button class="button small icon flyout-close" data-act="close" aria-label="${esc(t("inspector.close"))}" title="${esc(t("inspector.close"))}">×</button></div>` +
    `<div class="flyout-actions"></div><div class="flyout-setup"></div><div class="flyout-details"></div>`;
  const parts = {};
  for (const part of ["title", "actions", "setup", "details"]) parts[part] = el.querySelector(`.flyout-${part}`);
  const drawn = {};
  const draw = (part, markup) => {
    if (drawn[part] === markup) return;
    parts[part].innerHTML = markup;
    drawn[part] = markup;
  };

  return {
    // Shows thing `selected` of `world` as of `snapshot`, or nothing, its blocks
    // worded with Blockly's `words`; `setup(id)` gives its setup, and `make`
    // whether a robot or building without a program can be given one.
    show(world, snapshot, selected, words, { setup = () => "", make = false } = {}) {
      const it = selected ? thing(world, selected) : null;
      el.hidden = !it;
      if (!it) {
        for (const part of Object.keys(parts)) draw(part, "");
        return;
      }
      const entry = entryIn(snapshot, selected);
      draw(
        "title",
        `${identityMark(world, it.id)}<h2 id="flyout-title">${esc(display(it.name))}</h2>` + (entry ? `<span class="state ${entry.state}">${esc(t(`state.${entry.state}`))}</span>` : ""),
      );
      draw("actions", detailsActions(entry, { make }));
      draw("setup", setup(selected));
      draw("details", detailsHtml(world, selected, entry, words));
    },
  };
}
