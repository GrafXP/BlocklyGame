import "../style/island.css";
import { blocklyMessages, display, t } from "../i18n/index.js";
import { createBin } from "../lifecycle.js";
import { bindWorldInput } from "../render/input.js";
import { createIslandView } from "../render/island-view.js";
import { createMeter } from "../render/meter.js";
import { QUALITIES } from "../render/stage.js";
import { stateHash } from "../sim/replay.js";
import { checkWorld } from "../sim/validate.js";
import { reasonOf, statusOf } from "../sim/world.js";
import { loadLocal, saveLocal } from "../storage/local.js";
import { blockIcon } from "./chips.js";
import { bindClock, clockMarkup, showClock } from "./clock.js";
import { describeReason } from "./describe.js";
import { esc, html, isDev } from "./dom.js";
import { everyoneHtml, identityMark, inspectorHtml } from "./inspector.js";
import { languageChoice } from "./language-choice.js";
import { activeBlock, currentGame, newGame } from "./session.js";
import { declutter } from "./tags.js";

// Blockly's messages in the current language, to word blocks, without Blockly
// itself (main.js awaits this before the page is shown).
let words = null;
export async function ready() {
  words = (await blocklyMessages()).messages;
}

// What the page hands on to itself when it's opened again during this visit, as
// after a change of language: the camera, and what's selected.
let kept = { camera: null, selected: null };

const loadQuality = () => {
  const q = loadLocal("display")?.quality;
  return QUALITIES[q] ? q : "high";
};

// The icons of the view's buttons, drawn in the button's own colour.
const ICON = (inner) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const VIEW_BUTTONS = [
  ["left", "view.turnLeft", ICON(`<path d="M9 7H5V3"/><path d="M5.6 7A8 8 0 1 1 4 12"/>`)],
  ["right", "view.turnRight", ICON(`<path d="M15 7h4V3"/><path d="M18.4 7A8 8 0 1 0 20 12"/>`)],
  ["in", "view.zoomIn", ICON(`<path d="M12 5v14M5 12h14"/>`)],
  ["out", "view.zoomOut", ICON(`<path d="M5 12h14"/>`)],
  ["reset", "view.reset", ICON(`<path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/>`)],
];

// The island in 3D (PLAN.md §11, Phase 3): the visit's world (session.js) on its
// clock, drawn from the world as it stands. Robots and buildings can be looked
// at from any side, chosen by tapping them, their labels, or the list in the
// inspector, which says what the chosen one is doing. Each robot and building
// has a label with the picture of the block it's at, and a mark when it waits or
// has stopped with an error, whose reason shows on hover.
export function island(el) {
  const bin = createBin();
  let game = currentGame();
  game.pause();
  let selected = null;
  let hoverAt; // undefined: nothing new; null: the pointer left; { x, y }

  const $ = html(
    el,
    `<div class="island-page">
      <header class="island-bar">
        <a class="button small" href="/${location.search}" data-link>${t("nav.home")}</a>
        <h1>${t("island.title")}</h1>
        ${clockMarkup()}
        ${languageChoice({ group: "segmented language-choice" })}
      </header>
      <div class="island-main">
        <div class="island-stage"></div>
        <div class="tags"></div>
        <p class="stall" role="status" hidden></p>
        <aside class="inspector" aria-label="${esc(t("inspector.label"))}"></aside>
        <div class="island-tools">
          <div class="view-controls" role="group" aria-label="${esc(t("view.controls"))}">
            ${VIEW_BUTTONS.map(([act, key, icon]) => `<button class="button icon" data-view="${act}" aria-label="${esc(t(key))}" title="${esc(t(key))}">${icon}</button>`).join("")}
          </div>
          <div class="quality"><span>${t("quality.label")}</span>
            <div class="segmented" role="group" aria-label="${esc(t("quality.label"))}">
              <button data-quality="low">${t("quality.low")}</button><button data-quality="high">${t("quality.high")}</button>
            </div>
          </div>
          ${isDev() ? `<pre class="counters"></pre>` : ""}
        </div>
      </div>
    </div>`,
  );

  // --- The world in 3D ------------------------------------------------------
  const view = createIslandView($(".island-stage"), { quality: loadQuality() });
  bin.add(() => view.dispose());
  if (kept.camera) view.restoreCamera(kept.camera);
  bindWorldInput(bin, view.canvas, view, {
    onSelect: (id) => select(id),
    onHover: (x, y) => (hoverAt = x === null ? null : { x, y }),
  });

  // --- Choosing -------------------------------------------------------------
  function select(id) {
    const exists = id && [...game.world.entities, ...game.world.nodes].some((e) => e.id === id);
    selected = exists ? id : null;
    view.select(selected);
    for (const tag of tagsEl.children) tag.classList.toggle("selected", tag.dataset.pick === selected);
    showInspector();
  }
  bin.on(el, "click", (e) => {
    const pick = e.target.closest("[data-pick]");
    if (pick) select(pick.dataset.pick);
    else if (e.target.closest('[data-act="close"]')) select(null);
  });
  bin.on(document, "keydown", (e) => {
    if (e.key === "Escape" && selected) select(null);
  });

  // --- Labels ---------------------------------------------------------------
  // One button for each robot, building and deposit, over it in the world.
  const tagsEl = $(".tags");
  const sizes = new Map(); // id → { w, h }, measured when a label's words change
  let tagsShown = null; // the world the labels are for
  const tagWords = new Map(); // id → what its label last said
  function tagContent(w, e) {
    const status = e.kind === "node" ? null : statusOf(e);
    const why = e.kind === "node" ? null : reasonOf(e);
    const block = activeBlock(e);
    const icon = block ? blockIcon(block.type) : null;
    const name = display(e.name);
    const stateWord = status ? t(`state.${status}`) : "";
    return {
      key: [name, status, icon, why ? describeReason(w, why) : ""].join("|"),
      className: `tag ${status ?? "node"}${e.id === selected ? " selected" : ""}`,
      label: status ? t("tag.label", { name, state: stateWord }) : name,
      title: why ? t("tag.title", { state: stateWord, reason: describeReason(w, why) }) : stateWord || name,
      html:
        identityMark(w, e.id) +
        (icon ? `<span class="bubble"><img src="${icon}" alt="" width="18" height="18"></span>` : "") +
        `<span class="tag-name">${esc(name)}</span>` +
        (status === "waiting" || status === "error" ? `<span class="badge ${status}" aria-hidden="true"></span>` : ""),
    };
  }
  function showTags(w) {
    if (tagsShown !== w) {
      tagsEl.innerHTML = [...w.entities, ...w.nodes].map((e) => `<button class="tag" data-pick="${esc(e.id)}"></button>`).join("");
      tagWords.clear();
      tagsShown = w;
    }
    let resized = false;
    for (const e of [...w.entities, ...w.nodes]) {
      const c = tagContent(w, e);
      if (tagWords.get(e.id) === c.key) continue;
      const tag = tagsEl.querySelector(`[data-pick="${CSS.escape(e.id)}"]`);
      tag.className = c.className;
      tag.innerHTML = c.html;
      tag.setAttribute("aria-label", c.label);
      tag.title = c.title;
      tagWords.set(e.id, c.key);
      sizes.set(e.id, { w: tag.offsetWidth, h: tag.offsetHeight });
      resized = true;
    }
    return resized;
  }
  // Puts each label over its thing, none covering another.
  function placeTags() {
    const area = tagsEl.getBoundingClientRect();
    const labels = [];
    for (const tag of tagsEl.children) {
      const id = tag.dataset.pick;
      const at = view.anchorOf(id);
      const size = sizes.get(id);
      const inside = at && size && at.x > area.left && at.x < area.right && at.y > area.top && at.y < area.bottom;
      tag.hidden = !inside;
      if (inside) labels.push({ id, x: at.x - area.left, y: at.y - area.top - 4, ...size });
    }
    for (const [id, { x, y }] of declutter(labels)) {
      const { w, h } = sizes.get(id);
      const tag = tagsEl.querySelector(`[data-pick="${CSS.escape(id)}"]`);
      tag.style.transform = `translate(${Math.round(x - w / 2)}px, ${Math.round(y - h)}px)`;
    }
  }

  // --- The inspector, the stall, the clock ----------------------------------
  const inspector = $(".inspector");
  function showInspector() {
    const w = game.world;
    inspector.innerHTML = selected ? inspectorHtml(w, selected, words) : everyoneHtml(w);
    inspector.classList.toggle("open", !!selected);
  }

  let shown = null; // the world and tick the page shows
  function showWorld(drew) {
    const w = game.world;
    let resized = false;
    if (shown?.world !== w || shown.tick !== w.tick) {
      if (shown?.world !== w) select(null);
      resized = showTags(w);
      if (selected || shown?.world !== w) showInspector();
      const stall = $(".stall");
      stall.hidden = !w.stall;
      stall.textContent = w.stall ? describeReason(w, { code: "stall" }) : "";
      shown = { world: w, tick: w.tick };
    }
    if (drew || resized) placeTags();
    showClock(el, game);
  }

  bindClock(bin, el, { game: () => game, reset: () => (game = newGame()), changed: () => showWorld(false) });

  // --- The view's own controls ----------------------------------------------
  bin.on($(".view-controls"), "click", (e) => {
    const act = e.target.closest("[data-view]")?.dataset.view;
    if (act === "left") view.turnBy(-1);
    else if (act === "right") view.turnBy(1);
    else if (act === "in") view.zoomBy(1.25);
    else if (act === "out") view.zoomBy(0.8);
    else if (act === "reset") view.reset();
  });
  const showQuality = () => {
    for (const b of el.querySelectorAll("[data-quality]")) b.setAttribute("aria-pressed", String(b.dataset.quality === view.quality));
  };
  bin.on($(".quality"), "click", (e) => {
    const q = e.target.closest("[data-quality]")?.dataset.quality;
    if (!q) return;
    view.setQuality(q);
    saveLocal("display", { ...loadLocal("display"), quality: q });
    showQuality();
  });
  showQuality();

  // --- Every frame ------------------------------------------------------------
  const meter = createMeter();
  bin.on(document, "visibilitychange", () => game.hidden(document.hidden));
  bin.frames((now) => {
    const began = performance.now();
    game.frame(now);
    if (hoverAt !== undefined) {
      const id = hoverAt ? view.pick(hoverAt.x, hoverAt.y) : null;
      view.hover(id);
      view.canvas.style.cursor = id ? "pointer" : "";
      hoverAt = undefined;
    }
    view.sync(game.world, { alpha: game.clock.alpha, now, running: game.clock.running });
    const drew = view.frame(now);
    showWorld(drew);
    meter.frame(now, performance.now() - began, drew ? view.info.render : null);
  });
  if (isDev()) {
    const counters = $(".counters");
    const timer = setInterval(() => (counters.textContent = meter.text()), 500);
    bin.add(() => clearInterval(timer));
  }
  bin.add(() => game.pause());

  // Leaving: hand on the camera and the selection to the next opening.
  bin.add(() => (kept = { camera: view.camera, selected }));

  view.sync(game.world);
  showWorld(true);
  select(kept.selected);
  view.frame(performance.now());
  placeTags();

  // The ?dev hooks, for the browser tests.
  if (isDev()) {
    window.islandPage = {
      get game() {
        return game;
      },
      get selected() {
        return selected;
      },
      select,
      camera: () => view.camera,
      quality: () => view.quality,
      // Where thing `id` is drawn, in world units, and on screen, in client pixels.
      positionOf: (id) => view.positionOf(id),
      screenOf: (id) => view.screenOf(id),
      // Each label's thing and box on screen.
      tags: () => [...tagsEl.children].filter((tag) => !tag.hidden).map((tag) => ({ id: tag.dataset.pick, rect: tag.getBoundingClientRect().toJSON() })),
      frames: () => meter.stats(),
      hash: () => stateHash(game.world),
      problems: () => checkWorld(game.world),
    };
    bin.add(() => delete window.islandPage);
  }

  return () => bin.dispose();
}
