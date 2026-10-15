import { display, formatNumber, t } from "../i18n/index.js";
import { ITEMS } from "../sim/entities.js";
import { thing, thingAt } from "../sim/things.js";
import { identityOf } from "../render/identity.js";
import { blockChip } from "./chips.js";
import { amounts, describeAction, progressOf } from "./describe.js";
import { esc } from "./dom.js";
import { blockOf } from "./session.js";

// The inspector (PLAN.md §8): what the chosen robot, building or deposit is
// doing, in words, opened in its row of the overview (overview.js): what it's
// doing and how far it's got, where it is, what it holds against how much
// room there is, what its block read in this step, and how far round its Repeat
// it is. A robot or building's program can be opened from here.

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

// A reading in words: a number, or whether a condition is true.
export const readingWords = (value) => (typeof value === "boolean" ? t(value ? "reading.true" : "reading.false") : formatNumber(value));

// What the active block read (snapshot.js), each sense or comparison as a chip
// with its value, in the order the block holds them.
function readings(entry, words) {
  const node = entry.block ? blockOf(entry.program, entry.revision, entry.block) : null;
  if (!node) return "";
  const lines = [];
  const visit = (n) => {
    for (const inner of Object.values(n.inputs)) {
      for (const child of inner) {
        if (child.id in entry.readings) lines.push(`<li>${blockChip(child, words)} <strong>${esc(readingWords(entry.readings[child.id]))}</strong></li>`);
        visit(child);
      }
    }
  };
  visit(node);
  return lines.length ? `<ul class="readings">${lines.join("")}</ul>` : "";
}

// The details of thing `id` of `world`: its snapshot entry `entry` (null for a
// deposit), with Blockly's `words` for its blocks.
export function detailsHtml(world, id, entry, words) {
  const it = thing(world, id);
  if (!it) return "";
  const parts = [];
  const doing = describeAction(world, it);
  const done = progressOf(world, it);
  if (doing) parts.push(row(t("world.doing"), `${esc(doing)}${done ? `<progress max="${done.total}" value="${done.done}"></progress>` : ""}`));
  if (it.kind === "robot") {
    const at = thingAt(world, it.cell);
    if (at) parts.push(row(t("world.where"), esc(display(at.name))));
    const held = Object.values(it.store.items).reduce((a, b) => a + b, 0);
    parts.push(row(t("inspector.basket"), `<span class="basket"><span>${esc(amounts(it.store.items))}</span> <span class="count">${esc(t("inspector.of", { have: held, cap: it.store.total }))}</span></span>`));
  } else parts.push(row(t("world.has"), stock(it)));
  if (entry) {
    parts.push(row(t("inspector.reads"), readings(entry, words)));
    if (entry.round) parts.push(row(t("inspector.loop"), esc(t("inspector.round", { count: entry.round.count, times: entry.round.times }))));
  }
  const actions = [
    entry?.program ? `<button class="button small primary" data-act="edit">${esc(t("inspector.edit"))}</button>` : "",
    `<button class="button small" data-act="close">${esc(t("inspector.close"))}</button>`,
  ].join("");
  return `<div class="details">
      <p class="kind">${esc(t(KIND[it.kind]))}</p>
      <dl>${parts.join("")}</dl>
      <div class="details-actions">${actions}</div>
    </div>`;
}
