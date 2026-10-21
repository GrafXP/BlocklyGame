import { display, formatNumber, t } from "../i18n/index.js";
import { ITEMS } from "../sim/entities.js";
import { thing, thingAt } from "../sim/things.js";
import { identityOf } from "../render/identity.js";
import { blockChip } from "./chips.js";
import { amount, amounts, describeAction, messageWords, placeName, progressOf } from "./describe.js";
import { esc } from "./dom.js";
import { icon } from "./icons.js";
import { picture } from "./pictures.js";
import { blockOf } from "./session.js";

// The inspector (PLAN.md §8): what the chosen robot, building or deposit is
// doing, in words, in its flyout beside the overview (flyout.js): what it's
// doing and how far it's got, where it is, what it holds against how much
// room there is, what its block read in this step, how far round its Repeat
// it is, what its variables hold, which of the player's own blocks it's inside,
// and the messages in its inbox (PLAN.md §11, Phase 8). A robot or building's
// program is opened from here, or a new one made for it.

const KIND = { robot: "inspector.robot", building: "inspector.building", node: "inspector.resource" };

// A robot's mark: its colour and shape, as on its label and markers.
export function identityMark(world, id) {
  const it = identityOf(world, id);
  return it ? `<span class="identity ${it.shape}" style="--identity:${it.colour}" aria-hidden="true"></span>` : "";
}

// A line of the details: its icon `name`, with `label` for screen readers and
// on hover, and its value.
function row(name, label, value) {
  return value ? `<div class="inspector-row"><dt title="${esc(label)}">${icon(name, 18)}<span class="vh">${esc(label)}</span></dt><dd>${value}</dd></div>` : "";
}

// “3 of 4” as a fraction, “3/4”, with the words for screen readers and on hover.
const fraction = (have, cap) => `<span class="count" title="${esc(t("inspector.of", { have, cap }))}">${esc(formatNumber(have))}/${esc(formatNumber(cap))}</span>`;

// What `counts` holds, as each item's picture and number: “[wood] 3 [plank] 1”;
// "" when it holds nothing.
export function itemsMarkup(counts, size = 18) {
  return ITEMS.filter((item) => counts[item])
    .map((item) => `<span class="item-count">${picture(item, { size })}${esc(formatNumber(counts[item]))}</span>`)
    .join("");
}

// What `place`, a building or deposit, holds of each item it can, against how
// much: its picture and the fraction.
function stock(place) {
  const caps = place.store.caps ?? {};
  const lines = ITEMS.filter((item) => caps[item]).map(
    (item) => `<li>${picture(item, { size: 20 })}<span class="vh">${esc(t(`item.${item}`))}</span> ${fraction(place.store.items[item] ?? 0, caps[item])}</li>`,
  );
  return lines.length ? `<ul class="stock">${lines.join("")}</ul>` : "";
}

// A reading in words: a number, whether a condition is true, or a setting's
// place or item in `world`.
export function readingWords(value, world) {
  if (typeof value === "boolean") return t(value ? "reading.true" : "reading.false");
  if (typeof value === "string") return ITEMS.includes(value) ? t(`item.${value}`) : placeName(world, value);
  return formatNumber(value);
}

// A robot's Supply under way (src/sim/supply.js): what it brings, from where
// to where, and which step it's at. (With nothing to bring, its Doing line says
// why.)
const supplyWords = (world, plan) =>
  esc(t("inspector.supplying", { amount: amount(plan.item, plan.n), from: placeName(world, plan.from), to: placeName(world, plan.to), step: plan.step + 1, steps: plan.steps.length }));

// What the active block read (snapshot.js), each sense, comparison or setting
// as a chip with its value, in the order the block holds them.
function readings(world, entry, words) {
  const node = entry.block ? blockOf(entry.program, entry.revision, entry.block) : null;
  if (!node) return "";
  const lines = [];
  const visit = (n) => {
    for (const inner of Object.values(n.inputs)) {
      for (const child of inner) {
        if (child.id in entry.readings) lines.push(`<li>${blockChip(child, words)} <strong>${esc(readingWords(entry.readings[child.id], world))}</strong></li>`);
        visit(child);
      }
    }
  };
  visit(node);
  return lines.length ? `<ul class="readings">${lines.join("")}</ul>` : "";
}

// What `entry`'s variables hold now (snapshot.js): “order 3 · delivered 1”,
// or "" when its program has none.
export const memoryWords = (entry) => entry.memory.map((m) => `${m.name} ${formatNumber(m.value)}`).join(" · ");

// The name of the player's own block whose definition is block `routine` of
// `entry`'s program.
function routineName(entry, routine) {
  const name = blockOf(entry.program, entry.revision, routine)?.fields.NAME;
  return typeof name === "string" ? name : name ? display(name) : "…";
}

// Its variables, each name with its number.
function memoryHtml(entry) {
  return `<ul class="memory">${entry.memory.map((m) => `<li><span>${esc(m.name)}</span> <strong>${esc(formatNumber(m.value))}</strong></li>`).join("")}</ul>`;
}

// The messages in its inbox, oldest first, or that it's empty.
function inboxHtml(world, entry) {
  if (!entry.inbox.length) return esc(t("inspector.inboxEmpty"));
  return `<ul class="inbox">${entry.inbox.map((m) => `<li>${esc(t("inspector.message", { message: messageWords(m.message), name: placeName(world, m.from) }))}</li>`).join("")}</ul>`;
}

// The details of thing `id` of `world`: its snapshot entry `entry` (null for a
// deposit), with Blockly's `words` for its blocks. A robot or building always
// has its Doing line, with its progress bar kept in place while idle, and a
// robot its Where line, so the details hold still between one action and the
// next.
export function detailsHtml(world, id, entry, words) {
  const it = thing(world, id);
  if (!it) return "";
  const parts = [];
  if (it.kind !== "node") {
    const doing = describeAction(world, it);
    const done = progressOf(world, it);
    const bar = done ? `<progress max="${done.total}" value="${done.done}"></progress>` : `<progress class="idle" max="1" value="0"></progress>`;
    parts.push(row("doing", t("world.doing"), `${esc(doing || t("world.nothing"))}${bar}`));
  }
  if (it.kind === "robot") {
    const at = thingAt(world, it.cell);
    parts.push(row("where", t("world.where"), at ? esc(display(at.name)) : "–"));
    const held = Object.values(it.store.items).reduce((a, b) => a + b, 0);
    parts.push(row("basket", t("inspector.basket"), `<span class="basket"><span title="${esc(amounts(it.store.items))}">${itemsMarkup(it.store.items)}<span class="vh">${esc(amounts(it.store.items))}</span></span> ${fraction(held, it.store.total)}</span>`));
    if (it.supply && !it.supply.idle) parts.push(row("supply", t("inspector.supply"), supplyWords(world, it.supply)));
  } else {
    parts.push(row("has", t("world.has"), stock(it)));
    // What it orders, which Supply brings.
    if (it.order) parts.push(row("order", t("inspector.order"), `<span title="${esc(amounts(it.order))}">${itemsMarkup(it.order)}<span class="vh">${esc(amounts(it.order))}</span></span>`));
  }
  if (entry) {
    parts.push(row("reads", t("inspector.reads"), readings(world, entry, words)));
    if (entry.round) parts.push(row("loop", t("inspector.loop"), esc(t("inspector.round", { count: entry.round.count, times: entry.round.times }))));
    if (entry.memory.length) parts.push(row("memory", t("inspector.memory"), memoryHtml(entry)));
    if (entry.inside.length) parts.push(row("inside", t("inspector.inside"), esc(entry.inside.map((f) => routineName(entry, f.routine)).join(" › "))));
    if (entry.listens || entry.inbox.length) parts.push(row("inbox", t("inspector.inbox"), inboxHtml(world, entry)));
  }
  // What kind of thing it is goes without saying on screen: its mark and its
  // name say it. Screen readers hear it.
  return `<div class="details">
      <p class="kind vh">${esc(t(KIND[it.kind]))}</p>
      ${it.kind === "node" ? `<p class="kind vh">${esc(t("inspector.resourceNote"))}</p>` : ""}
      <dl>${parts.join("")}</dl>
    </div>`;
}

// The chosen thing's Edit program, for its snapshot entry `entry` (null for a
// deposit): for every robot and building where the play can make it a program
// (`make`), and for one that has a program, running, stopped or parked,
// anywhere; else "". The flyout puts it under the thing's name.
export function detailsActions(entry, { make = false } = {}) {
  return entry && (entry.program || make) ? `<div class="details-actions"><button type="button" class="button primary" data-act="edit">${icon("blocks")}${esc(t("inspector.edit"))}</button></div>` : "";
}
