import { display, formatNumber, t } from "../i18n/index.js";
import { ITEMS } from "../sim/entities.js";
import { thing, thingAt } from "../sim/things.js";
import { identityOf } from "../render/identity.js";
import { blockChip } from "./chips.js";
import { amounts, describeAction, messageWords, placeName, progressOf } from "./describe.js";
import { esc } from "./dom.js";
import { blockOf } from "./session.js";

// The inspector (PLAN.md §8): what the chosen robot, building or deposit is
// doing, in words, opened in its row of the overview (overview.js): what it's
// doing and how far it's got, where it is, what it holds against how much
// room there is, what its block read in this step, how far round its Repeat
// it is, what its variables hold, which of the player's own blocks it's inside,
// and the messages in its inbox (PLAN.md §11, Phase 8). A robot or building's
// program can be opened from here.

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

// A reading in words: a number, whether a condition is true, or a setting's
// place or item in `world`.
export function readingWords(value, world) {
  if (typeof value === "boolean") return t(value ? "reading.true" : "reading.false");
  if (typeof value === "string") return ITEMS.includes(value) ? t(`item.${value}`) : placeName(world, value);
  return formatNumber(value);
}

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
    parts.push(row(t("world.doing"), `${esc(doing || t("world.nothing"))}${bar}`));
  }
  if (it.kind === "robot") {
    const at = thingAt(world, it.cell);
    parts.push(row(t("world.where"), at ? esc(display(at.name)) : "–"));
    const held = Object.values(it.store.items).reduce((a, b) => a + b, 0);
    parts.push(row(t("inspector.basket"), `<span class="basket"><span>${esc(amounts(it.store.items))}</span> <span class="count">${esc(t("inspector.of", { have: held, cap: it.store.total }))}</span></span>`));
  } else parts.push(row(t("world.has"), stock(it)));
  if (entry) {
    parts.push(row(t("inspector.reads"), readings(world, entry, words)));
    if (entry.round) parts.push(row(t("inspector.loop"), esc(t("inspector.round", { count: entry.round.count, times: entry.round.times }))));
    if (entry.memory.length) parts.push(row(t("inspector.memory"), memoryHtml(entry)));
    if (entry.inside.length) parts.push(row(t("inspector.inside"), esc(entry.inside.map((f) => routineName(entry, f.routine)).join(" › "))));
    if (entry.listens || entry.inbox.length) parts.push(row(t("inspector.inbox"), inboxHtml(world, entry)));
  }
  return `<div class="details">
      <p class="kind">${esc(t(KIND[it.kind]))}</p>
      ${it.kind === "node" ? `<p class="kind">${esc(t("inspector.resourceNote"))}</p>` : ""}
      <dl>${parts.join("")}</dl>
    </div>`;
}

// The chosen thing's buttons, for its snapshot entry `entry` (null for a
// deposit): Edit program for a robot or building that has a program, running,
// stopped or parked, and Close. The overview puts them under the thing's name.
export function detailsActions(entry) {
  return `<div class="details-actions">${
    entry?.program ? `<button class="button small primary" data-act="edit">${esc(t("inspector.edit"))}</button>` : ""
  }<button class="button small" data-act="close">${esc(t("inspector.close"))}</button></div>`;
}
