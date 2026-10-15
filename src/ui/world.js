import "../style/world.css";
import { blocklyMessages, display, t } from "../i18n/index.js";
import { createBin } from "../lifecycle.js";
import { createGame, SPEEDS } from "../game.js";
import { ISLAND } from "../content/island.js";
import { blockIndex, readWorkspace } from "../programming/adapter.js";
import { createWorld, reasonOf, statusOf } from "../sim/world.js";
import { stateHash } from "../sim/replay.js";
import { checkWorld } from "../sim/validate.js";
import { kindOf } from "../sim/terrain.js";
import { robotPose } from "../render/pose.js";
import { blockChip } from "./chips.js";
import { describeAction, describeReason, amounts, placeName, progressOf } from "./describe.js";
import { esc, html, isDev } from "./dom.js";
import { languageChoice } from "./language-choice.js";

const CELL = 14; // px a cell on the map

const GROUND = { water: "#3c8fd6", sand: "#e2c98f", grass: "#79b85a", gap: "#2f74b8", bridge: "#a8713f" };

// The game this page shows. It outlives the page: leaving and coming back, or a
// change of language, which opens the page again, finds the world as it was, and
// paused (PLAN.md §8).
let game = null;
const newGame = () => createGame(createWorld(ISLAND));

// The island's programs, read once, to find the block each entity is at by its
// id. (The world keeps only their compiled instructions.)
let sources = null;
const blockOf = (programId, blockId) => {
  sources ??= new Map(ISLAND.programs.map(({ id, source }) => [id, blockIndex(readWorkspace(source).tree)]));
  return sources.get(programId)?.get(blockId) ?? null;
};

// Blockly's messages in the current language, to word the blocks: Blockly's
// catalogue and the game's blocks, without Blockly itself (main.js awaits this
// before the page is shown).
let words = null;
export async function ready() {
  words = (await blocklyMessages()).messages;
}

// The world lab (PLAN.md §11, Phases 1 and 2): the island's world on its clock,
// without the 3D island or the editor yet. Run, Pause and Step drive every robot
// and building together; a map shows where they are, and a table what each is
// doing, holding and waiting for, and the block of its program it's at. The
// robots and buildings run the island's starter programs
// (src/content/programs.js).
export function world(el) {
  const bin = createBin();
  game ??= newGame();
  game.pause();

  const $ = html(
    el,
    `<div class="world-page">
      <header class="world-bar">
        <a class="button small" href="/${location.search}" data-link>${t("nav.home")}</a>
        <h1>${t("world.title")}</h1>
        <div class="clock">
          <button class="button primary small" data-act="run"></button>
          <button class="button small" data-act="step">${t("clock.step")}</button>
          <div class="segmented" role="group" aria-label="${esc(t("clock.speed"))}">
            ${SPEEDS.map((s) => `<button data-speed="${s}">${t("clock.speedValue", { speed: s })}</button>`).join("")}
          </div>
          <output class="ticks" aria-live="off"></output>
          <button class="button small" data-act="reset">${t("world.reset")}</button>
        </div>
        ${languageChoice({ group: "segmented language-choice" })}
      </header>
      <p class="stall" role="status" hidden></p>
      <div class="world-main">
        <div class="world-map" aria-hidden="true"><canvas></canvas><div class="things"></div><div class="robots"></div></div>
        <table class="world-table">
          <thead><tr><th>${t("world.name")}</th><th>${t("world.where")}</th><th>${t("world.block")}</th><th>${t("world.doing")}</th><th>${t("world.has")}</th><th>${t("world.state")}</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>`,
  );

  // --- The map ------------------------------------------------------------
  const canvas = $("canvas");
  let drawn = null; // the navigation revision and world the map shows
  function drawMap() {
    const w = game.world;
    const { terrain } = w;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = terrain.width * CELL * ratio;
    canvas.height = terrain.height * CELL * ratio;
    canvas.style.width = `${terrain.width * CELL}px`;
    canvas.style.height = `${terrain.height * CELL}px`;
    const g = canvas.getContext("2d");
    g.scale(ratio, ratio);
    for (let cell = 0; cell < terrain.kinds.length; cell++) {
      g.fillStyle = GROUND[kindOf(terrain, cell)];
      g.fillRect((cell % terrain.width) * CELL, Math.floor(cell / terrain.width) * CELL, CELL, CELL);
    }
    g.strokeStyle = "rgb(29 38 51 / 0.35)";
    for (const it of [...w.entities, ...w.nodes]) {
      for (const cell of it.access ?? []) g.strokeRect((cell % terrain.width) * CELL + 3.5, Math.floor(cell / terrain.width) * CELL + 3.5, CELL - 7, CELL - 7);
    }
    $(".things").innerHTML = [...w.entities, ...w.nodes]
      .filter((it) => it.area)
      .map(
        ({ type, name, area: { x, z, w: wide, d } }) =>
          `<div class="thing ${type}" title="${esc(display(name))}" style="left:${x * CELL}px;top:${z * CELL}px;width:${wide * CELL}px;height:${d * CELL}px"></div>`,
      )
      .join("");
    $(".robots").innerHTML = w.entities
      .filter((e) => e.kind === "robot")
      .map((r) => `<div class="robot" data-id="${r.id}" title="${esc(display(r.name))}">${r.name.params?.n ?? ""}</div>`)
      .join("");
    drawn = { world: w, nav: w.nav };
  }

  function placeRobots() {
    const alpha = game.clock.alpha;
    for (const r of game.world.entities) {
      if (r.kind !== "robot") continue;
      const { x, z } = robotPose(game.world, r, alpha);
      const dot = el.querySelector(`.robot[data-id="${r.id}"]`);
      if (dot) dot.style.transform = `translate(${x * CELL}px, ${z * CELL}px)`;
    }
  }

  // --- The table and the clock's controls ----------------------------------
  const tbody = $("tbody");
  function where(w, e) {
    if (e.kind !== "robot") return "";
    const here = [...w.entities, ...w.nodes].find((it) => it.access?.includes(e.cell));
    return here ? display(here.name) : t("world.cell", { x: e.cell % w.terrain.width, z: Math.floor(e.cell / w.terrain.width) });
  }
  // The block `e`'s program is at, as a chip; marked when it was evaluated in
  // the latest step.
  function block(w, e) {
    const run = e.runtime;
    const node = run?.kind === "program" && run.block ? blockOf(run.program, run.block) : null;
    if (!node) return "";
    const fresh = run.evaluated?.tick === w.tick;
    return blockChip(node, words, fresh ? { className: "fresh", title: t("world.evaluated") } : {});
  }
  function row(w, e) {
    const status = e.kind === "node" ? null : statusOf(e);
    const why = e.kind === "node" ? null : reasonOf(e);
    const done = progressOf(w, e);
    return `<tr data-id="${e.id}" class="${status ?? "node"}">
      <th scope="row">${esc(display(e.name))}</th>
      <td>${esc(where(w, e))}</td>
      <td class="block">${block(w, e)}</td>
      <td>${esc(describeAction(w, e))}${done ? `<progress max="${done.total}" value="${done.done}"></progress>` : ""}</td>
      <td>${esc(amounts(e.store.items))}</td>
      <td>${status ? `<span class="state">${t(`state.${status}`)}</span>` : ""}${why ? `<span class="why">${esc(describeReason(w, why))}</span>` : ""}</td>
    </tr>`;
  }
  let shownTick = -1;
  function showWorld() {
    const w = game.world;
    if (drawn?.world !== w || drawn.nav !== w.nav) drawMap();
    if (shownTick !== w.tick) {
      tbody.innerHTML = [...w.entities, ...w.nodes].map((e) => row(w, e)).join("");
      const stall = $(".stall");
      stall.hidden = !w.stall;
      stall.textContent = w.stall ? describeReason(w, { code: "stall" }) : "";
      shownTick = w.tick;
    }
    $(".ticks").textContent = t("clock.ticks", { tick: w.tick });
    const run = $('[data-act="run"]');
    run.textContent = game.clock.running ? t("clock.pause") : t("clock.run");
    run.setAttribute("aria-pressed", String(game.clock.running));
    for (const b of el.querySelectorAll("[data-speed]")) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === game.clock.speed));
    placeRobots();
  }

  bin.on($(".clock"), "click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    if (button.dataset.speed) game.clock.setSpeed(Number(button.dataset.speed));
    else if (button.dataset.act === "run") (game.clock.running ? game.pause : game.run)();
    else if (button.dataset.act === "step") game.step();
    else if (button.dataset.act === "reset") {
      const speed = game.clock.speed;
      game = newGame();
      game.clock.setSpeed(speed);
    }
    showWorld();
  });
  bin.on(document, "visibilitychange", () => game.hidden(document.hidden));
  bin.frames((now) => {
    game.frame(now);
    showWorld();
  });
  bin.add(() => game.pause());
  showWorld();

  // The ?dev hooks, for the browser tests.
  if (isDev()) {
    window.world = {
      get game() {
        return game;
      },
      state: () => structuredClone(game.world),
      hash: () => stateHash(game.world),
      problems: () => checkWorld(game.world),
      place: (id) => placeName(game.world, id),
    };
    bin.add(() => delete window.world);
  }

  return () => bin.dispose();
}
