import { display, t } from "../i18n/index.js";
import { ITEMS } from "../sim/entities.js";
import { thing, thingAt } from "../sim/things.js";
import { reasonOf, statusOf } from "../sim/world.js";
import { identityOf } from "../render/identity.js";
import { blockChip } from "./chips.js";
import { amounts, describeAction, describeReason, progressOf } from "./describe.js";
import { esc } from "./dom.js";
import { activeBlock } from "./session.js";

// The inspector (PLAN.md §8, §11 Phase 3): what the selected robot, building or
// deposit is, what it's doing and waiting for, the block of its program it's
// at, and what it holds, all in words. With nothing selected, everything on the
// island as a list to choose from, so nobody needs to aim at the 3D world.

const KIND = { robot: "inspector.robot", building: "inspector.building", node: "inspector.resource" };

// A robot's mark: its colour and shape, as on its label and markers.
export function identityMark(world, id) {
  const it = identityOf(world, id);
  return it ? `<span class="identity ${it.shape}" style="--identity:${it.colour}" aria-hidden="true"></span>` : "";
}

function row(label, value) {
  return value ? `<div class="inspector-row"><dt>${esc(label)}</dt><dd>${value}</dd></div>` : "";
}

// What `place`, a building or deposit, holds of each item it can, against how
// much.
function stock(place) {
  const caps = place.store.caps ?? {};
  const lines = ITEMS.filter((item) => caps[item]).map(
    (item) => `<li><span>${esc(t(`item.${item}`))}</span> <span class="count">${esc(t("inspector.of", { have: place.store.items[item] ?? 0, cap: caps[item] }))}</span></li>`,
  );
  return lines.length ? `<ul class="stock">${lines.join("")}</ul>` : "";
}

// The inspector's markup for thing `id` of `world`, with Blockly's `words` for
// its block.
export function inspectorHtml(world, id, words) {
  const it = thing(world, id);
  if (!it) return "";
  const parts = [];
  const status = it.kind === "node" ? null : statusOf(it);
  if (status) {
    const why = reasonOf(it);
    parts.push(row(t("world.state"), `<span class="state ${status}">${esc(t(`state.${status}`))}</span>${why ? `<span class="why">${esc(describeReason(world, why))}</span>` : ""}`));
  }
  const block = activeBlock(it);
  if (block) parts.push(row(t("world.block"), blockChip(block, words)));
  const doing = describeAction(world, it);
  const done = progressOf(world, it);
  if (doing) parts.push(row(t("world.doing"), `${esc(doing)}${done ? `<progress max="${done.total}" value="${done.done}"></progress>` : ""}`));
  if (it.kind === "robot") {
    const at = thingAt(world, it.cell);
    if (at) parts.push(row(t("world.where"), esc(display(at.name))));
    const held = Object.values(it.store.items).reduce((a, b) => a + b, 0);
    parts.push(row(t("inspector.basket"), `<span class="basket"><span>${esc(amounts(it.store.items))}</span> <span class="count">${esc(t("inspector.of", { have: held, cap: it.store.total }))}</span></span>`));
  } else parts.push(row(t("world.has"), stock(it)));
  return `<header class="inspector-head">
      <h2>${identityMark(world, id)}${esc(display(it.name))}</h2>
      <p class="kind">${esc(t(KIND[it.kind]))}</p>
      <button class="button small" data-act="close">${esc(t("inspector.close"))}</button>
    </header>
    <dl>${parts.join("")}</dl>`;
}

// Everything on the island, to choose from.
export function everyoneHtml(world) {
  const items = [...world.entities, ...world.nodes].map(
    (e) => `<li><button class="pick" data-pick="${esc(e.id)}">${identityMark(world, e.id)}${esc(display(e.name))}</button></li>`,
  );
  return `<p class="hint">${esc(t("inspector.hint"))}</p><h2 class="everyone">${esc(t("inspector.everyone"))}</h2><ul class="picks">${items.join("")}</ul>`;
}
