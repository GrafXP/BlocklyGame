import { SPEEDS } from "../game.js";
import { t } from "../i18n/index.js";
import { icon, iconButton } from "./icons.js";

// The world clock's controls (PLAN.md §6, §8): Start again, Run and Pause,
// Step, Next block, the speed, and the steps so far, the same on every page
// that shows the world. Each is an icon, with its words as its name and
// tooltip; the speed is one button that goes on to the next speed with each
// press, and the steps a number. `resetTitle` says what Start again does, where
// it needs saying.

export const clockMarkup = ({ resetTitle = "" } = {}) =>
  `<div class="clock">
    ${iconButton("restart", t("world.reset"), { attrs: `data-act="reset"`, title: resetTitle || t("world.reset") })}
    <button type="button" class="button icon run" data-act="run"></button>
    ${iconButton("step", t("clock.step"), { attrs: `data-act="step"` })}
    ${iconButton("next", t("clock.next"), { attrs: `data-act="next"`, title: t("clock.nextTitle") })}
    <button type="button" class="button speed" data-act="speed"></button>
    <output class="ticks">${icon("steps", 16)}<span class="ticks-n"></span></output>
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
    const act = button.dataset.act;
    if (act === "speed") g.clock.setSpeed(SPEEDS[(SPEEDS.indexOf(g.clock.speed) + 1) % SPEEDS.length]);
    else if (act === "run") (g.clock.running ? g.pause : g.run)();
    else if (act === "step") g.step();
    else if (act === "next") g.nextBlock(chosen());
    else if (act === "reset") reset();
    changed();
  });
}

// Shows `game`'s clock on the controls in `el`, changing only what's new.
export function showClock(el, game) {
  const ticks = el.querySelector(".clock .ticks");
  const tick = String(game.world.tick);
  const n = ticks.querySelector(".ticks-n");
  if (n.textContent !== tick) {
    n.textContent = tick;
    const words = t("clock.ticks", { tick: game.world.tick });
    ticks.setAttribute("aria-label", words);
    ticks.title = words;
  }
  const run = el.querySelector('.clock [data-act="run"]');
  const running = String(game.clock.running);
  if (run.getAttribute("aria-pressed") !== running) {
    const label = game.clock.running ? t("clock.pause") : t("clock.run");
    run.innerHTML = icon(game.clock.running ? "pause" : "play", 28);
    run.setAttribute("aria-label", label);
    run.title = label;
    run.setAttribute("aria-pressed", running);
  }
  const speed = el.querySelector('.clock [data-act="speed"]');
  const value = t("clock.speedValue", { speed: game.clock.speed });
  if (speed.textContent !== value) {
    speed.textContent = value;
    const words = t("clock.speedIs", { speed: game.clock.speed });
    speed.setAttribute("aria-label", words);
    speed.title = words;
  }
}
