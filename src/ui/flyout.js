import { display, t } from "../i18n/index.js";
import { thing } from "../sim/things.js";
import { esc } from "./dom.js";
import { iconButton, stateMark } from "./icons.js";
import { detailsActions, detailsHtml, identityMark } from "./inspector.js";
import { entryIn } from "./snapshot.js";

// The chosen robot, building or deposit's flyout (PLAN.md §8): chosen on the
// island or in the overview's list, it slides in on the right, beside the
// list and level with its row when the list is open (island.js places it), and
// has everything about it: its name and state; Edit program; what it's doing,
// where, what it holds, what its block read, what it remembers and the blocks
// it's inside, each line under an icon (inspector.js); and where its program
// comes from, with its own copy or back to the shared one, and a robot's team,
// name and settings (setup.js). Close, Escape, or choosing it again in the
// list closes it.
//
// It holds still while the world runs, as the list does: each part is drawn
// again only when it changes, so its buttons stay there to be pressed.

export function createFlyout(el) {
  el.innerHTML =
    `<div class="flyout-head"><div class="flyout-title"></div>` +
    iconButton("close", t("inspector.close"), { attrs: `data-act="close"`, className: "flyout-close" }) +
    `</div><div class="flyout-actions"></div><div class="flyout-details"></div><div class="flyout-setup"></div>`;
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
      draw("title", `${identityMark(world, it.id)}<h2 id="flyout-title">${esc(display(it.name))}</h2>` + (entry ? stateMark(entry.state) : ""));
      draw("actions", detailsActions(entry, { make }));
      draw("setup", setup(selected));
      draw("details", detailsHtml(world, selected, entry, words));
    },
  };
}
