import "../style/world.css";
import { blocklyMessages, display, t } from "../i18n/index.js";
import { createBin } from "../lifecycle.js";
import { reasonOf, statusOf } from "../sim/world.js";
import { stateHash } from "../sim/replay.js";
import { checkWorld } from "../sim/validate.js";
import { kindOf } from "../sim/terrain.js";
import { robotPose } from "../render/pose.js";
import { blockChip } from "./chips.js";
import { bindClock, clockMarkup, showClock } from "./clock.js";
import { activeBlock, currentGame, newGame, usePlay } from "./session.js";
import { describeAction, describeReason, amounts, placeName, progressOf } from "./describe.js";
import { esc, html, isDev } from "./dom.js";
import { languageChoice } from "./language-choice.js";

const CELL = 14; // px a cell on the map

const GROUND = { water: "#3c8fd6", sand: "#e2c98f", grass: "#79b85a", gap: "#2f74b8", bridge: "#a8713f" };

// Blockly's messages in the current language, to word the blocks: Blockly's
// catalogue and the game's blocks, without Blockly itself (main.js awaits this
// before the page is shown).
let words = null;
export async function ready() {
  words = (await blocklyMessages()).messages;
}

// The world lab (PLAN.md §11, Phases 1 and 2): the visit's world (session.js)
// on its clock, as a map and a table. Run, Pause and Step drive every robot and
// building together; the map shows where they are, and the table what each is
// doing, holding and waiting for, and the block of its program it's at. The
// robots and buildings run the island's starter programs
// (src/content/programs.js). The island page shows the same world in 3D.
export function world(el) {
  const bin = createBin();
  usePlay("island");
  let game = currentGame();
  game.pause();

  const $ = html(
    el,
    `<div class="world-page">
      <header class="world-bar">
        <a class="button small" href="/${location.search}" data-link>${t("nav.home")}</a>
        <h1>${t("world.title")}</h1>
        ${clockMarkup()}
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
    const node = activeBlock(e);
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
  let shown = null; // the world and tick the table shows
  function showWorld() {
    const w = game.world;
    if (drawn?.world !== w || drawn.nav !== w.nav) drawMap();
    if (shown?.world !== w || shown.tick !== w.tick) {
      tbody.innerHTML = [...w.entities, ...w.nodes].map((e) => row(w, e)).join("");
      const stall = $(".stall");
      stall.hidden = !w.stall;
      stall.textContent = w.stall ? describeReason(w, { code: "stall" }) : "";
      shown = { world: w, tick: w.tick };
    }
    showClock(el, game);
    placeRobots();
  }

  bindClock(bin, el, { game: () => game, reset: () => (game = newGame()), changed: showWorld });
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
