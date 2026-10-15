import { SPEEDS } from "../game.js";
import { t } from "../i18n/index.js";
import { esc } from "./dom.js";

// The world clock's controls (PLAN.md §6, §8): Run and Pause, Step, Next block,
// the speeds, the steps so far, and Start again, the same on every page that
// shows the world.

export const clockMarkup = () =>
  `<div class="clock">
    <button class="button primary small" data-act="run"></button>
    <button class="button small" data-act="step">${t("clock.step")}</button>
    <button class="button small" data-act="next" title="${esc(t("clock.nextTitle"))}">${t("clock.next")}</button>
    <div class="segmented" role="group" aria-label="${esc(t("clock.speed"))}">
      ${SPEEDS.map((s) => `<button data-speed="${s}">${t("clock.speedValue", { speed: s })}</button>`).join("")}
    </div>
    <output class="ticks" aria-live="off"></output>
    <button class="button small" data-act="reset">${t("world.reset")}</button>
  </div>`;

// Binds the controls in `el` to the game `game()` gives. Next block steps until
// the robot or building `chosen()` gives takes its next block, or, with none,
// anyone does (game.js). Start again calls `reset()`; `changed()` follows every
// press.
export function bindClock(bin, el, { game, reset, changed, chosen = () => null }) {
  bin.on(el.querySelector(".clock"), "click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const g = game();
    if (button.dataset.speed) g.clock.setSpeed(Number(button.dataset.speed));
    else if (button.dataset.act === "run") (g.clock.running ? g.pause : g.run)();
    else if (button.dataset.act === "step") g.step();
    else if (button.dataset.act === "next") g.nextBlock(chosen());
    else if (button.dataset.act === "reset") reset();
    changed();
  });
}

// Shows `game`'s clock on the controls in `el`.
export function showClock(el, game) {
  el.querySelector(".clock .ticks").textContent = t("clock.ticks", { tick: game.world.tick });
  const run = el.querySelector('.clock [data-act="run"]');
  const label = game.clock.running ? t("clock.pause") : t("clock.run");
  if (run.textContent !== label) run.textContent = label;
  run.setAttribute("aria-pressed", String(game.clock.running));
  for (const b of el.querySelectorAll(".clock [data-speed]")) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === game.clock.speed));
}
