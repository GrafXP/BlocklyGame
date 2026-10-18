import "../style/island.css";
import "../style/editor.css";
import { blocklyMessages, display, missionText, t } from "../i18n/index.js";
import { createBin } from "../lifecycle.js";
import { createMarkers } from "../blockly/markers.js";
import { surfaceAlphas, TREATMENTS, DEFAULT_TREATMENT } from "../blockly/treatments.js";
import { bindWorldInput } from "../render/input.js";
import { createIslandView } from "../render/island-view.js";
import { createMeter } from "../render/meter.js";
import { QUALITIES } from "../render/stage.js";
import { LAYOUT, LAYOUT_CHOICES } from "../content/free.js";
import { FACINGS, layout } from "../sim/placement.js";
import { RECIPES } from "../sim/recipes.js";
import { stateHash } from "../sim/replay.js";
import { thingsKey } from "../sim/things.js";
import { checkWorld } from "../sim/validate.js";
import { loadLocal, saveLocal } from "../storage/local.js";
import { blockIcon } from "./chips.js";
import { bindClock, clockMarkup, showClock } from "./clock.js";
import { amounts, describeReason } from "./describe.js";
import { esc, go, html, isDev } from "./dom.js";
import { openEditor } from "./editor.js";
import { icon, iconButton } from "./icons.js";
import { identityMark } from "./inspector.js";
import { languageChoice } from "./language-choice.js";
import { createFlyout } from "./flyout.js";
import { createLibraryPanel } from "./library.js";
import { createMissionCard } from "./mission.js";
import { createMissionOverlays } from "./mission-overlays.js";
import { createOverview } from "./overview.js";
import {
  addRobot,
  blockOf,
  blueprints,
  checkPlace,
  choose,
  currentLibrary,
  dismissNotice,
  libraryChanges,
  newFreeIsland,
  newGame,
  newProgramFor,
  nextCampaignMission,
  peekWorld,
  placeBuilding,
  rules,
  savePlay,
  setStock,
  showProgram,
  upcomingMission,
  usePlay,
} from "./session.js";
import { createSetup } from "./setup.js";
import { entryIn, takeSnapshot } from "./snapshot.js";
import { declutter } from "./tags.js";
import { createTogether } from "./together.js";

// Blockly's messages in the current language, to word blocks, without Blockly
// itself (main.js awaits this before the page is shown). Blockly is fetched when
// an editor or Programs Together first opens.
let words = null;
export async function ready() {
  words = (await blocklyMessages()).messages;
}
async function loadBlockly() {
  const blockly = await import("../blockly/workspace.js");
  await blockly.prepareBlockly();
  return blockly;
}

// What the page hands on to itself when it's opened again during this visit, as
// after a change of language, for each play: the camera, what's chosen, the
// panel open on the left (the editor, All programs or the program library),
// with its width, and how many hints show.
const keptFor = new Map();
const fresh = () => ({ camera: null, selected: null, panel: null, panelWidth: 0.42, hints: 0 });

const MIN_PANEL = 320; // px
const MIN_REST = 380; // px of world and overview kept beside the panel

// While a mission runs, it's saved this often, in ms of the page's time; and
// whenever the world pauses, its programs change, the page is hidden or left.
const SAVE_EVERY = 2000;

const loadQuality = () => {
  const q = loadLocal("display")?.quality;
  return QUALITIES[q] ? q : "high";
};

// The view's own controls: what each does, its words and its icon.
const VIEW_BUTTONS = [
  ["left", "view.turnLeft", "turnLeft"],
  ["right", "view.turnRight", "turnRight"],
  ["in", "view.zoomIn", "zoomIn"],
  ["out", "view.zoomOut", "zoomOut"],
  ["reset", "view.reset", "resetView"],
];
const GAP = 12; // px between the page's edge, its panels and its cards
const MIN_COACH = 300; // px the bubbles over the island need, at the least

// The free island (PLAN.md §11, Phases 3 and 4), where every program runs from
// the start, for this visit.
export const island = (el) => islandPage(el, "island");

// The campaign (PLAN.md §9, §11 Phase 7): the mission it's at, saved on the
// device as it's played.
export const play = (el) => islandPage(el, "campaign");

// A mission done before, played again on its own: the one the address names
// (?mission=m03), or the replay in hand.
export const replay = (el) => islandPage(el, "replay", { mission: new URLSearchParams(location.search).get("mission") });

// Free play, and the sandbox it grows into (src/content/free.js).
export const free = (el) => islandPage(el, "free");

// The bridge slice (PLAN.md §11, Phase 5), the mission of
// src/content/missions/slice.js, saved on the device as it's played.
export const slice = (el) => islandPage(el, "slice");

// The island in 3D: play `key`'s world (session.js) on its clock, drawn from
// the world as it stands, with the debugger round it. The world fills the
// window; over it, one line along the top (home, the title, and the panels'
// icons), the clock at the bottom, and the rest only when asked for or needed
// (PLAN.md §8, amendment of 18 October 2026). Robots and buildings can be
// looked at from any side and chosen by tapping them, their labels, or their
// rows in the overview, which opens on the right and lists every one with the
// block it's at and why it waits; the chosen one's flyout slides in on the
// right and says more (flyout.js). A robot or building's program opens in the
// editor on the left, over the world, from its Edit program button; one that
// runs none is given a new program as the editor opens. All programs shows
// every running program there instead, with everyone's markers. Every view
// shows the same tick: one snapshot (snapshot.js) is taken after the frame's
// ticks and drawn by all. A mission's card opens below its title, what it asks
// comes in a bubble above the clock, and the mission is saved as it's played,
// at tick boundaries. A mission begins with its briefing over the page, and
// ends with the win, fireworks and the way on (mission-overlays.js).
//
// Phase 6's tools, where the play offers them (session.js, tools): in the
// chosen one's flyout, its own copy of its program and a robot's team, name and
// settings (setup.js); Programs, the program library, in the panel on the left
// (library.js), which gives programs; and Build, which
// places a building where the player taps, its plan drawn green where it fits
// and red where it doesn't, with the reason.
function islandPage(el, key, { mission: asked = null } = {}) {
  const bin = createBin();
  const playing = usePlay(key, { mission: asked });
  const { mission } = playing;
  const ruled = rules();
  const offers = ruled.tools;
  const canBuild = offers.includes("build") && blueprints().length > 0;
  const giving = offers.includes("library"); // whether robots and buildings can be given programs
  const keeps = ["campaign", "replay", "free", "slice"].includes(key); // whether the play is saved on the device
  // What's kept is the play's, and a mission's own: the next mission starts
  // with nothing chosen and no hints shown.
  const keptKey = mission ? `${key}:${mission.id}` : key;
  if (!keptFor.has(keptKey)) keptFor.set(keptKey, fresh());
  const kept = keptFor.get(keptKey);
  let game = playing.game;
  game.pause();
  let selected = null;
  let hoverAt; // undefined: nothing new; null: the pointer left; { x, y }
  const title = mission ? missionText(`${mission.id}.title`) : key === "free" ? t(ruled.sandbox ? "sandbox.title" : "free.title") : t("island.title");
  document.title = t("page.title", { page: title, app: t("app.name") });

  const $ = html(
    el,
    `<div class="island-page${mission ? " playing" : ""}">
      <header class="island-bar">
        <div class="bar-start">
          <a class="button icon" href="/${location.search}" data-link aria-label="${esc(t("nav.home"))}" title="${esc(t("nav.home"))}">${icon("home")}</a>
          <h1 class="bar-title">${
            mission
              ? `<button type="button" class="title-button" data-drawer="mission" aria-expanded="false" aria-controls="mission-panel" title="${esc(t("mission.label"))}"><span class="title-text">${esc(title)}</span><span class="bar-goals" aria-hidden="true"></span>${icon("chevron", 18)}</button>`
              : `<span class="title-text">${esc(title)}</span>`
          }</h1>
        </div>
        <div class="bar-end">
          ${iconButton("robots", t("inspector.everyone"), { attrs: `data-drawer="overview" aria-expanded="false" aria-controls="overview"` })}
          ${iconButton("together", t("together.open"), { attrs: `data-panel="together" aria-pressed="false"` })}
          ${offers.includes("library") ? iconButton("library", t("library.open"), { attrs: `data-panel="library" aria-pressed="false"` }) : ""}
          ${canBuild ? iconButton("build", t("build.open"), { attrs: `data-build="open" aria-pressed="false"` }) : ""}
          ${ruled.sandbox ? iconButton("addRobot", t("sandbox.addRobot"), { attrs: `data-sandbox="robot"` }) + iconButton("island", t("sandbox.new"), { attrs: `data-sandbox="new" aria-expanded="false"` }) : ""}
          ${iconButton("gear", t("menu.settings"), { attrs: `data-menu="settings" aria-expanded="false" aria-controls="settings-menu"` })}
        </div>
      </header>
      <div class="island-main">
        <div class="island-stage"></div>
        <div class="tags"></div>
        <div class="coach">
          <p class="stall" role="status" hidden></p>
          ${
            canBuild
              ? `<p class="build-pending" role="status" hidden>${esc(t("build.pending"))}</p>
          <section class="build-card" hidden aria-label="${esc(t("build.open"))}">
            <p class="build-ask"></p>
            <p class="build-why" role="status"></p>
            <div class="build-actions">
              ${iconButton("turnRight", t("build.turn"), { attrs: `data-build="turn"` })}
              <button type="button" class="button primary" data-build="place" disabled>${icon("check")}${esc(t("build.place"))}</button>
              ${iconButton("close", t("build.cancel"), { attrs: `data-build="cancel"` })}
            </div>
          </section>`
              : ""
          }
          ${
            ruled.sandbox
              ? `<form class="sandbox-card" hidden aria-label="${esc(t("sandbox.new"))}">
            <p>${esc(t("sandbox.newAsk"))}</p>
            ${Object.entries(LAYOUT_CHOICES)
              .map(
                ([part, values]) =>
                  `<label>${esc(t(`sandbox.${part}`))} <select name="${part}">${values
                    .map((v) => `<option value="${v}"${v === LAYOUT[part] ? " selected" : ""}>${esc(typeof v === "number" ? String(v) : t(`sandbox.${part}.${v}`))}</option>`)
                    .join("")}</select></label>`,
              )
              .join("")}
            <div class="build-actions">
              <button class="button primary" type="submit">${icon("check")}${esc(t("sandbox.create"))}</button>
              ${iconButton("close", t("sandbox.cancel"), { attrs: `data-sandbox="cancel"` })}
            </div>
          </form>`
              : ""
          }
          ${mission ? `<div class="mission-coach"></div>` : ""}
        </div>
        <section class="editor-panel side-panel" hidden>
          ${iconButton("close", t("inspector.close"), { attrs: `data-panel="close"`, className: "panel-close" })}
          <div class="panel-body"></div>
          <div class="panel-handle" role="separator" aria-orientation="vertical" aria-label="${esc(t("panel.resize"))}" tabindex="0"></div>
        </section>
        ${mission ? `<section class="mission-panel" id="mission-panel" aria-label="${esc(t("mission.label"))}" hidden><div class="mission-card"></div></section>` : ""}
        <aside class="drawer overview-drawer" id="overview" aria-labelledby="overview-title" hidden>
          <header class="drawer-head"><h2 id="overview-title">${esc(t("inspector.everyone"))}</h2>${iconButton("close", t("inspector.close"), { attrs: `data-drawer="overview"` })}</header>
          <div class="inspector overview"></div>
        </aside>
        <aside class="flyout" id="flyout" aria-labelledby="flyout-title" hidden></aside>
        <div class="menu settings-menu" id="settings-menu" hidden>
          <p class="menu-label">${esc(t("language.choose"))}</p>
          ${languageChoice({ group: "segmented language-choice" })}
          <p class="menu-label">${esc(t("quality.label"))}</p>
          <div class="segmented quality" role="group" aria-label="${esc(t("quality.label"))}">
            <button type="button" data-quality="low">${esc(t("quality.low"))}</button><button type="button" data-quality="high">${esc(t("quality.high"))}</button>
          </div>
          ${isDev() ? `<pre class="counters"></pre>` : ""}
        </div>
        <div class="island-tools">
          <div class="view-tools">
            <div class="menu view-controls" id="view-controls" role="group" aria-label="${esc(t("view.controls"))}" hidden>
              ${VIEW_BUTTONS.map(([act, key, name]) => iconButton(name, t(key), { attrs: `data-view="${act}"` })).join("")}
            </div>
            ${iconButton("camera", t("view.controls"), { attrs: `data-menu="view" aria-expanded="false" aria-controls="view-controls"` })}
          </div>
          <div class="transport">${clockMarkup(mission ? { resetTitle: t("clock.resetMission") } : {})}</div>
        </div>
      </div>
    </div>`,
  );
  const main = $(".island-main");

  // --- Drawers and menus ------------------------------------------------------
  // The mission's panel and the overview slide in when asked for, and stay
  // until closed; a menu (the settings, the view's controls) closes at the
  // next tap anywhere else. What's open is kept for the next opening of the
  // page, as after a change of language.
  const drawers = (kept.drawers ??= { mission: false, overview: false });
  let menu = null; // "settings", "view", or null
  function showDrawers() {
    const missionPanel = $(".mission-panel");
    if (missionPanel) missionPanel.hidden = !drawers.mission;
    const aside = $(".overview-drawer");
    aside.hidden = !drawers.overview;
    for (const b of $(".island-bar").querySelectorAll("[data-drawer]")) b.setAttribute("aria-expanded", String(!!drawers[b.dataset.drawer]));
    main.style.setProperty("--aside", drawers.overview ? `${aside.offsetWidth + GAP}px` : "0px");
    placeFlyout();
    placeCoach();
    placeTags();
  }
  // The bubbles between whatever is open: the panel on the left or the
  // mission's, and the overview or the flyout on the right; where that leaves
  // too little room, between the panels alone, or else over the whole world.
  function placeCoach() {
    const width = main.clientWidth;
    const side = panel ? sidePanel.offsetLeft + sidePanel.offsetWidth : 0;
    const aside = drawers.overview ? $(".overview-drawer").offsetWidth + GAP : 0;
    const missionPanel = $(".mission-panel");
    const fly = $(".flyout");
    const left = Math.max(side, missionPanel && !missionPanel.hidden ? missionPanel.offsetLeft + missionPanel.offsetWidth : 0);
    const right = Math.max(aside, fly.hidden ? 0 : width - fly.offsetLeft);
    const fits = (l, r) => width - l - r - 2 * GAP >= MIN_COACH;
    const [l, r] = fits(left, right) ? [left, right] : fits(side, aside) ? [side, aside] : [0, 0];
    main.style.setProperty("--coach-l", `${l}px`);
    main.style.setProperty("--coach-r", `${r}px`);
  }
  function toggleDrawer(name, open = !drawers[name]) {
    if (name === "mission" && !mission) return;
    drawers[name] = open;
    showDrawers();
    if (name === "overview" && open && selected) overview.reveal(selected);
  }
  function showMenu(name) {
    menu = name;
    $(".settings-menu").hidden = menu !== "settings";
    $(".view-controls").hidden = menu !== "view";
    for (const b of el.querySelectorAll("[data-menu]")) b.setAttribute("aria-expanded", String(b.dataset.menu === menu));
  }

  // --- The world in 3D ------------------------------------------------------
  const view = createIslandView($(".island-stage"), { quality: loadQuality() });
  bin.add(() => view.dispose());
  if (kept.camera) view.restoreCamera(kept.camera);
  bindWorldInput(bin, view.canvas, view, {
    onSelect: (id, x, y) => (placing ? aim(x, y, true) : select(id)),
    onHover: (x, y) => (hoverAt = x === null ? null : { x, y }),
  });

  // --- Choosing -------------------------------------------------------------
  // Chooses thing `id`, or nothing, and shows it at once unless `draw` is false.
  // While the mission's card asks the player to point at their guess, the
  // choice is the guess too.
  function select(id, draw = true) {
    const exists = id && [...game.world.entities, ...game.world.nodes].some((e) => e.id === id);
    if (exists) card?.pointed(id);
    if ((exists ? id : null) !== selected) setup.reset();
    selected = exists ? id : null;
    view.select(selected);
    for (const tag of tagsEl.children) tag.classList.toggle("selected", tag.dataset.pick === selected);
    refresh();
    if (!draw) return;
    showWorld(false);
    if (selected) overview.reveal(selected);
    placeFlyout();
  }
  bin.on(el, "click", (e) => {
    const menuAct = e.target.closest("[data-menu]")?.dataset.menu;
    if (menu && !menuAct && !e.target.closest(".menu")) showMenu(null);
    if (menuAct) {
      showMenu(menu === menuAct ? null : menuAct);
      return;
    }
    const drawerAct = e.target.closest("[data-drawer]")?.dataset.drawer;
    if (drawerAct) {
      toggleDrawer(drawerAct);
      return;
    }
    if (selected && setup.handle(e, selected)) {
      refresh();
      return;
    }
    const build = e.target.closest("[data-build]")?.dataset.build;
    if (build) {
      if (build === "open") placing ? stopPlacing() : startPlacing();
      else if (build === "turn") turnPlan();
      else if (build === "cancel") stopPlacing();
      else if (build === "place") place();
      return;
    }
    const sandbox = e.target.closest("[data-sandbox]")?.dataset.sandbox;
    if (sandbox) {
      if (sandbox === "robot") {
        const id = addRobot();
        if (id) refresh();
      } else if (sandbox === "new" || sandbox === "cancel") showLayout(sandbox === "new" && $(".sandbox-card").hidden);
      else if (sandbox === "more" || sandbox === "less") {
        const { at, item } = e.target.closest("[data-sandbox]").dataset;
        const have = peekWorld().entities.concat(peekWorld().nodes).find((it) => it.id === at)?.store.items[item] ?? 0;
        setStock(at, item, Math.max(0, have + (sandbox === "more" ? 1 : -1)));
        refresh();
      }
      return;
    }
    const pick = e.target.closest("[data-pick]");
    const act = e.target.closest("[data-act]")?.dataset.act;
    const panelAct = e.target.closest("[data-panel]")?.dataset.panel;
    if (pick) select(pick.closest(".row-head") && pick.dataset.pick === selected ? null : pick.dataset.pick);
    else if (act === "close") select(null);
    else if (act === "edit") editFor(selected);
    else if (panelAct === "close") closePanel();
    else if (panelAct === "together") (panel?.kind === "together" ? closePanel() : openPanel({ kind: "together" }));
    else if (panelAct === "library") (panel?.kind === "library" ? closePanel() : openPanel({ kind: "library" }));
  });
  // The setup's dropdowns and its name's form (setup.js).
  for (const type of ["change", "submit"]) {
    bin.on(el, type, (e) => {
      if (selected && setup.handle(e, selected)) refresh();
    });
  }

  // --- The sandbox's new island ------------------------------------------------
  // The layout to start from: robots, supplies, the bridge and the workshop
  // (src/content/free.js). Starting it lays the island out anew, keeping the
  // programs, and opens the page again on it.
  function showLayout(open) {
    const form = $(".sandbox-card");
    if (!form) return;
    form.hidden = !open;
    $('[data-sandbox="new"]').setAttribute("aria-expanded", String(open));
  }
  bin.on(el, "submit", (e) => {
    if (!e.target.closest(".sandbox-card")) return;
    e.preventDefault();
    const data = new FormData(e.target);
    const layout = Object.fromEntries(Object.keys(LAYOUT_CHOICES).map((part) => [part, part === "robots" ? Number(data.get(part)) : data.get(part)]));
    newFreeIsland(layout);
    go(location.pathname + location.search, "replace");
  });
  // Escape closes what was opened last: a menu, placing, the flyout, the
  // mission's panel, then the overview.
  bin.on(document, "keydown", (e) => {
    if (e.key !== "Escape") return;
    if (menu) showMenu(null);
    else if (placing) stopPlacing();
    else if (e.target.closest?.(".side-panel, .setup")) return;
    else if (selected) select(null);
    else if (drawers.mission) toggleDrawer("mission", false);
    else if (drawers.overview) toggleDrawer("overview", false);
  });

  // --- Placing a building ------------------------------------------------------
  // The plan follows the pointer, or the last tap; it can be turned, and placed
  // where it fits, at the next step (session.js).
  let placing = null; // { blueprint, facing, at: { x, z } | null, pinned, problem }
  function startPlacing() {
    placing = { blueprint: blueprints()[0].blueprint, facing: "south", at: null, pinned: false, problem: null };
    showPlacing();
  }
  function stopPlacing() {
    placing = null;
    view.showPlan(null);
    showPlacing();
  }
  const request = () => ({ blueprint: placing.blueprint, facing: placing.facing, ...placing.at });
  // Aims the plan at the cell under screen point (x, y); `pin` keeps it there
  // until the next tap.
  const aim = (x, y, pin) => aimCell(view.cellAt(x, y), pin);
  // Aims the plan at cell `cell`, { x, z }, with the cell in its middle.
  function aimCell(cell, pin) {
    if (!cell) return;
    const { area } = layout({ blueprint: placing.blueprint, facing: placing.facing, x: 0, z: 0 });
    placing.at = { x: cell.x - Math.floor((area.w - 1) / 2), z: cell.z - Math.floor((area.d - 1) / 2) };
    placing.pinned ||= pin;
    showPlan();
  }
  function turnPlan() {
    placing.facing = FACINGS[(FACINGS.indexOf(placing.facing) + 1) % FACINGS.length];
    if (placing.at) showPlan();
    showPlacing();
  }
  function showPlan() {
    const check = checkPlace(request());
    placing.problem = check.problem ?? null;
    view.showPlan({ ...layout(request()), ok: !check.problem });
    showPlacing();
  }
  // Places the plan, if it still fits: the world may have moved on since it
  // was aimed, a robot onto it.
  function place() {
    if (!placing?.at) return;
    if (!placeBuilding(request())) {
      showPlan();
      return;
    }
    stopPlacing();
    refresh();
  }
  function showPlacing() {
    const card = $(".build-card");
    const button = $('[data-build="open"]');
    button?.setAttribute("aria-pressed", String(!!placing));
    card.hidden = !placing;
    if (!placing) return;
    $(".build-ask").textContent = t(`build.ask.${placing.blueprint}`);
    const why = !placing.at ? "" : placing.problem ? describeReason(peekWorld(), placing.problem) : t("build.fits", { amounts: amounts(RECIPES[placing.blueprint].inputs) });
    const line = $(".build-why");
    line.textContent = why;
    line.classList.toggle("bad", !!placing.problem);
    $('[data-build="place"]').disabled = !placing.at || !!placing.problem;
  }

  // --- Labels ---------------------------------------------------------------
  // One button for each robot, building and deposit, over it in the world.
  const tagsEl = $(".tags");
  const sizes = new Map(); // id → { w, h }, measured when a label's words change
  let tagsShown = null; // the world the labels are for, and what things it has
  const tagWords = new Map(); // id → what its label last said
  function tagContent(w, snap, e) {
    const entry = entryIn(snap, e.id);
    const status = entry?.state ?? null;
    const why = entry?.reason ?? null;
    const block = entry?.block ? blockOf(entry.program, entry.revision, entry.block) : null;
    const blockPicture = block ? blockIcon(block.type) : null;
    const name = display(e.name);
    const stateWord = status ? t(`state.${status}`) : "";
    return {
      key: [name, status, blockPicture, why ? describeReason(w, why) : ""].join("|"),
      className: `tag ${status ?? "node"}${e.id === selected ? " selected" : ""}`,
      label: status ? t("tag.label", { name, state: stateWord }) : name,
      title: why ? t("tag.title", { state: stateWord, reason: describeReason(w, why) }) : stateWord || name,
      html:
        identityMark(w, e.id) +
        (blockPicture ? `<span class="bubble"><img src="${blockPicture}" alt="" width="18" height="18"></span>` : "") +
        `<span class="tag-name">${esc(name)}</span>` +
        (status === "waiting" || status === "error" ? `<span class="badge ${status}" aria-hidden="true"></span>` : ""),
    };
  }
  function showTags(w, snap) {
    if (tagsShown?.world !== w || tagsShown.things !== thingsKey(w)) {
      tagsEl.innerHTML = [...w.entities, ...w.nodes].map((e) => `<button class="tag" data-pick="${esc(e.id)}"></button>`).join("");
      tagWords.clear();
      tagsShown = { world: w, things: thingsKey(w) };
    }
    let resized = false;
    for (const e of [...w.entities, ...w.nodes]) {
      const c = tagContent(w, snap, e);
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
  // Puts each label over its thing, none covering another, and none under the
  // bar along the top, the panel on the left or the overview on the right.
  function placeTags() {
    // Where the panels are as laid out, not as drawn while they slide in.
    const area = tagsEl.getBoundingClientRect();
    const left = panel ? area.left + sidePanel.offsetLeft + sidePanel.offsetWidth : area.left;
    const right = drawers.overview ? area.left + $(".overview-drawer").offsetLeft : area.right;
    const top = $(".island-bar").getBoundingClientRect().bottom;
    const labels = [];
    for (const tag of tagsEl.children) {
      const id = tag.dataset.pick;
      const at = view.anchorOf(id);
      const size = sizes.get(id);
      const inside = at && size && at.x > left && at.x < right && at.y - size.h > top && at.y < area.bottom;
      tag.hidden = !inside;
      if (inside) labels.push({ id, x: at.x - area.left, y: at.y - area.top - 4, ...size });
    }
    for (const [id, { x, y }] of declutter(labels)) {
      const { w, h } = sizes.get(id);
      const tag = tagsEl.querySelector(`[data-pick="${CSS.escape(id)}"]`);
      tag.style.transform = `translate(${Math.round(x - w / 2)}px, ${Math.round(y - h)}px)`;
    }
  }

  // --- The overview, the flyout, and the mission's panel ----------------------
  const overview = createOverview($(".overview"));
  const flyout = createFlyout($(".flyout"));
  const setup = createSetup({ onOpenProgram: (program) => openPanel({ kind: "editor", program }) });
  // The flyout below the bar on the right; with the overview open, beside it,
  // level with the chosen one's row.
  function placeFlyout() {
    const fly = $(".flyout");
    if (fly.hidden) return;
    const row = drawers.overview && selected && overview.rowOf(selected);
    if (!row) {
      fly.style.top = "";
      return;
    }
    const area = main.getBoundingClientRect();
    const least = $(".island-bar").getBoundingClientRect().bottom - area.top;
    const top = row.getBoundingClientRect().top - area.top;
    fly.style.top = `${Math.round(Math.max(least, Math.min(top, area.height - fly.offsetHeight - GAP)))}px`;
  }
  bin.on($(".overview"), "scroll", placeFlyout);
  bin.on(window, "resize", () => {
    showDrawers();
    showPanelState();
  });
  const card = mission
    ? createMissionCard($(".mission-card"), bin, {
        mission,
        kept: (kept.card ??= {}),
        replay: key === "replay",
        next: key === "campaign" && !!upcomingMission(),
        coach: $(".mission-coach"),
        progress: $(".bar-goals"),
        // A hint asked for from its offer opens the panel that shows it.
        onHint: () => toggleDrawer("mission", true),
        onLook: (id) => select(id),
        onOpen: (program) => openPanel({ kind: "editor", program }),
        // A start or the whole program, put into the editor's draft: the
        // editor open on it is closed first, keeping what it holds, then
        // opened again on the new draft.
        onShow: (program, which) => {
          if (panel?.kind === "editor") closePanel();
          if (showProgram(program, which)) openPanel({ kind: "editor", program });
        },
        onRestart: () => {
          game = newGame();
          showWorld(false);
        },
        onNext: goOn,
        onDismiss: () => {
          dismissNotice();
          refresh();
        },
      })
    : null;
  // The briefing and the win. The world pauses as the win opens, and goes on
  // as it was if the player keeps playing.
  let wonWhileRunning = false;
  const overlays = mission
    ? createMissionOverlays($(".island-page"), bin, {
        mission,
        kept: kept.overlays?.play === playing ? kept.overlays : (kept.overlays = { play: playing }),
        replay: key === "replay",
        next: key === "campaign" && !!upcomingMission(),
        onWin: () => {
          wonWhileRunning = game.clock.running;
          game.pause();
        },
        onKeep: () => {
          if (wonWhileRunning) game.run();
        },
        onNext: goOn,
      })
    : null;
  // On to the next mission, which opens the page again; after a replay, or
  // the campaign's last mission, back to the title page.
  function goOn() {
    if (key === "campaign" && nextCampaignMission()) go(`/play${location.search}`, "replace");
    else go(`/${location.search}`);
  }

  // --- The panel on the left: the editor, or every program together ---------
  const sidePanel = $(".side-panel");
  const panelBody = $(".panel-body");
  let panel = null; // { kind, program?, view }
  let opening = 0; // the latest panel asked for, while Blockly is fetched
  async function openPanel(want) {
    const ticket = ++opening;
    if (want.kind === "editor") game.pause(); // editing pauses the world (PLAN.md §5)
    const blockly = await loadBlockly();
    if (!bin.open || ticket !== opening) return;
    closePanel(false);
    if (drawers.mission) toggleDrawer("mission", false); // it would lie over the panel
    sidePanel.hidden = false;
    sidePanel.dataset.kind = want.kind;
    const markers = { createMarkers };
    const onPick = (id) => select(id);
    const pane =
      want.kind === "editor"
        ? openEditor(panelBody, { blockly, markers, programId: want.program, onPick })
        : want.kind === "library"
          ? createLibraryPanel(panelBody, { onEdit: (program) => openPanel({ kind: "editor", program }) })
          : createTogether(panelBody, { blockly, markers, onPick });
    panel = { ...want, view: pane };
    kept.panel = want;
    showPanelState();
    refresh();
  }
  function closePanel(forget = true) {
    if (forget) opening++;
    panel?.view.dispose();
    panel = null;
    if (forget) kept.panel = null;
    sidePanel.hidden = true;
    showPanelState();
  }
  bin.add(() => {
    opening++;
    panel?.view.dispose();
  });
  // Opens the editor on what robot or building `id` runs. Where the play gives
  // programs, one that runs none is given a new one of its own.
  function editFor(id) {
    const e = peekWorld().entities.find((it) => it.id === id);
    let program = e?.runtime?.kind === "program" ? e.runtime.program : null;
    if (e && !program && giving) program = newProgramFor(id);
    if (program) openPanel({ kind: "editor", program });
  }

  function showPanelState() {
    $('[data-panel="together"]').setAttribute("aria-pressed", String(panel?.kind === "together"));
    $('[data-panel="library"]')?.setAttribute("aria-pressed", String(panel?.kind === "library"));
    main.style.setProperty("--side", panel ? `${sidePanel.offsetLeft + sidePanel.offsetWidth}px` : "0px");
    placeCoach();
    placeTags();
  }

  // The panel's look: the Calm treatment over the world at the background
  // opacity Phase 0 settled on, as CSS variables on <html>, since Blockly puts
  // its dropdowns on <body> (src/style/editor.css).
  const root = document.documentElement;
  const look = TREATMENTS[DEFAULT_TREATMENT];
  const alphas = surfaceAlphas(0.6);
  const vars = {
    "--panel-rgb": look.panel.rgb.join(" "),
    "--panel-ink": look.panel.ink,
    "--panel-alpha": alphas.panel,
    "--toolbox-rgb": look.toolbox.rgb.join(" "),
    "--toolbox-ink": look.toolbox.ink,
    "--toolbox-selected-ink": look.toolbox.selectedInk,
    "--toolbox-alpha": alphas.toolbox,
    "--flyout-alpha": alphas.flyout,
    "--block-ink": look.blockInk,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.treatment = DEFAULT_TREATMENT;
  bin.add(() => {
    for (const k of Object.keys(vars)) root.style.removeProperty(k);
    delete root.dataset.treatment;
  });

  // Dragging the panel's edge sets its width.
  const handle = $(".panel-handle");
  const setWidth = (px) => {
    const room = main.getBoundingClientRect().width;
    const width = Math.min(room - MIN_REST, Math.max(MIN_PANEL, px));
    kept.panelWidth = width / room;
    applyWidth();
  };
  const applyWidth = () => {
    sidePanel.style.width = `max(${MIN_PANEL}px, ${kept.panelWidth * 100}%)`;
    showPanelState();
  };
  let resizing = false;
  bin.on(handle, "pointerdown", (e) => {
    resizing = true;
    handle.setPointerCapture(e.pointerId);
  });
  bin.on(handle, "pointermove", (e) => resizing && setWidth(e.clientX - sidePanel.getBoundingClientRect().left));
  bin.on(handle, "pointerup", () => (resizing = false));
  bin.on(handle, "pointercancel", () => (resizing = false));
  bin.on(handle, "keydown", (e) => {
    const step = { ArrowLeft: -24, ArrowRight: 24 }[e.key];
    if (!step) return;
    e.preventDefault();
    setWidth(sidePanel.getBoundingClientRect().width + step);
  });
  applyWidth();

  // --- Every view from one snapshot -----------------------------------------
  let snapshot = null;
  let shown = null; // what the views show: { world, tick, selected, changes, queued }
  function showWorld(drew) {
    const w = game.world;
    let resized = false;
    const now = { world: w, tick: w.tick, selected, changes: libraryChanges(), queued: game.queueVersion };
    if (!shown || Object.keys(now).some((k) => now[k] !== shown[k])) {
      if (shown && shown.world !== w) select(null, false);
      snapshot = takeSnapshot(w, currentLibrary());
      resized = showTags(w, snapshot);
      overview.show(w, snapshot, selected, words);
      flyout.show(w, snapshot, selected, words, { setup: (id) => setup.html(id, ruled.sandbox ? [...offers, "stock"] : offers, w), make: giving });
      placeFlyout();
      placeCoach();
      panel?.view.show(w, snapshot, selected);
      if (canBuild) $(".build-pending").hidden = !game.pending.some((c) => c.type === "place");
      const stall = $(".stall");
      stall.hidden = !w.stall;
      stall.textContent = w.stall ? describeReason(w, { code: "stall" }) : "";
      card?.show(w, { notice: playing.notice, changed: playing.changed });
      overlays?.show(w);
      shown = { ...now, selected };
    }
    if (drew || resized) placeTags();
    showClock(el, game);
  }
  // Draws the views again at the next frame.
  const refresh = () => (shown = null);

  bindClock(bin, el, { game: () => game, reset: () => (game = newGame()), changed: () => showWorld(false), chosen: () => selected });

  // --- Saving a mission ---------------------------------------------------------
  // At a tick boundary, which is wherever this runs: ticks only happen within a
  // frame. The editor's draft is saved into the library first, so an edit made
  // just before the page goes isn't lost.
  let saved = null; // { world, tick, changes, done, time } at the last save
  function save(now = performance.now()) {
    if (!keeps) return;
    panel?.view.flush?.();
    savePlay();
    saved = { world: game.world, tick: game.world.tick, changes: libraryChanges(), done: game.world.mission?.done ?? null, time: now };
  }
  // Saves when something has changed: every SAVE_EVERY ms while the world runs,
  // at once when it's paused or the mission has just been done.
  function saveIfChanged(now) {
    const w = game.world;
    if (saved && saved.world === w && saved.tick === w.tick && saved.changes === libraryChanges()) return;
    if (!saved || !game.clock.running || saved.done !== (w.mission?.done ?? null) || now - saved.time >= SAVE_EVERY) save(now);
  }
  if (keeps) {
    bin.on(window, "pagehide", () => save());
    bin.add(() => save());
  }

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
  bin.on(document, "visibilitychange", () => {
    game.hidden(document.hidden);
    if (document.hidden) save(); // iPadOS may discard a hidden tab without another word (PLAN.md §10)
  });
  bin.frames((now) => {
    const began = performance.now();
    game.frame(now);
    if (keeps) saveIfChanged(now);
    if (hoverAt !== undefined) {
      if (placing) {
        if (hoverAt && !placing.pinned) aim(hoverAt.x, hoverAt.y, false);
        view.canvas.style.cursor = "crosshair";
      } else {
        const id = hoverAt ? view.pick(hoverAt.x, hoverAt.y) : null;
        view.hover(id);
        view.canvas.style.cursor = id ? "pointer" : "";
      }
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

  // Leaving: hand on the camera, the choice and the panel to the next opening.
  bin.add(() => Object.assign(kept, { camera: view.camera, selected }));

  view.sync(game.world);
  showDrawers();
  showWorld(true);
  select(kept.selected);
  view.frame(performance.now());
  placeTags();
  if (kept.panel) openPanel(kept.panel);

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
      library: () => currentLibrary(),
      // The player's choices `commands` (session.js), made at the next step.
      choose(commands) {
        choose(commands);
        refresh();
      },
      snapshot: () => snapshot,
      // Opens the editor of program `program`, or All programs; resolves once
      // it's open.
      async open(kind, program) {
        await openPanel({ kind, program });
        showWorld(false);
      },
      close: () => closePanel(),
      panel: () => (panel ? { kind: panel.kind, program: panel.program ?? null } : null),
      // The world as it will be at the next step, and the library panel's
      // programs as it shows them.
      peek: () => peekWorld(),
      programs: () => (panel?.kind === "library" ? panel.view.programs() : []),
      // Placing: the plan aimed at cell (x, z), as a tap there would; and
      // what the card says.
      aimAt(x, z) {
        if (!placing) startPlacing();
        aimCell({ x, z }, true);
      },
      placing: () => (placing ? { ...placing, why: $(".build-why").textContent } : null),
      editor: () => (panel?.kind === "editor" ? panel.view.editor : null),
      markers: () => panel?.view.markerRects() ?? [],
      badges: () => panel?.view.badges() ?? [],
      panels: () => (panel?.kind === "together" ? panel.view.panels() : []),
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
      // The play shown: its key, the mission's state, and its notice; and
      // saving it now, as the page does by itself.
      play: () => ({ key, mission: game.world.mission, notice: playing.notice, progress: playing.progress }),
      // Which of the mission's big windows is open: "briefing", "win", or null.
      overlay: () => overlays?.open() ?? null,
      save: () => save(),
    };
    bin.add(() => delete window.islandPage);
  }

  return () => bin.dispose();
}
