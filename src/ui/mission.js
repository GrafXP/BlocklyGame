import { missionText, t } from "../i18n/index.js";
import { count } from "../sim/inventory.js";
import { RECIPES } from "../sim/recipes.js";
import { thing } from "../sim/things.js";
import { esc } from "./dom.js";
import { picture } from "./pictures.js";

// The mission card (PLAN.md §8, Main layout; §9): the goal in one short
// sentence with pictures, how far it has got, the hint ladder, and the reward
// once it's done. It reads the world and never changes it; the goal is met in
// the world itself (src/sim/objectives.js).
//
// The hints come one at a time, when asked for, and cost nothing: Look points
// at the evidence (and chooses the thing it's about), Think asks one question,
// Try says what to change (docs/campaign-plan.md, “A consistent hint ladder”).
//
// After a program was applied, the card offers to start again: an applied
// program starts from its start, but a robot keeps what it carries, and a
// courier with a full basket that starts by picking up waits for room for ever.
// From the mission's checkpoint, with the programs as applied, every change is
// watched from the beginning (PLAN.md §9).

const LADDER = ["look", "think", "try"];

// How far mission `mission` has got in `world`: how many of the `item` its
// building needs it has (`have` of `need`), the work on it under way
// ({ done, total } in steps, or null), and whether the mission is `done`.
export function missionProgress(world, mission) {
  const { at, recipe } = mission.progress;
  const site = thing(world, at);
  const [[item, need]] = Object.entries(RECIPES[recipe].inputs);
  const a = site?.action;
  const building = a?.type === "make" && a.recipe === recipe ? { done: world.tick - a.start, total: a.end - a.start } : null;
  return { item, have: Math.min(need, site ? count(site.store, item) : 0), need, building, done: world.mission?.done != null };
}

// The card in `el` for `mission`. `hints` is how many hints show to begin with;
// `onHints(n)` hears when that changes, `onLook(id)` when the Look hint asks for
// thing `id` to be chosen, `onRestart()` when the player starts again from the
// card, and `onDismiss()` when the player has read a notice.
export function createMissionCard(el, bin, { mission, hints = 0, onHints, onLook, onRestart, onDismiss }) {
  const key = (part) => `${mission.id}.${part}`;
  const builds = RECIPES[mission.progress.recipe].builds;
  el.innerHTML = `<h2 class="mission-title">${esc(missionText(key("title")))}</h2>
    <p class="mission-goal">${esc(missionText(key("goal")))}</p>
    <div class="mission-progress" role="img"></div>
    <p class="mission-building idle"></p>
    <p class="mission-done" role="status"></p>
    <div class="mission-again" hidden><p>${esc(t("mission.again"))}</p><button class="button small primary" data-mission="restart">${esc(t("world.reset"))}</button></div>
    <ol class="mission-hints"></ol>
    <button class="button small mission-hint" data-mission="hint"></button>
    <div class="mission-notice" role="alert" hidden><p></p><button class="button small" data-mission="dismiss">${esc(t("mission.ok"))}</button></div>`;
  el.setAttribute("aria-label", t("mission.label"));
  const $ = (sel) => el.querySelector(sel);
  let shown = {};

  bin.on(el, "click", (e) => {
    const act = e.target.closest("[data-mission]")?.dataset.mission;
    if (act === "hint" && hints < LADDER.length) {
      hints++;
      onHints?.(hints);
      if (hints === 1) onLook?.(mission.look);
      showHints();
    } else if (act === "look") onLook?.(mission.look);
    else if (act === "restart") onRestart?.();
    else if (act === "dismiss") onDismiss?.();
  });

  function showHints() {
    $(".mission-hints").innerHTML = LADDER.slice(0, hints)
      .map(
        (step) =>
          `<li class="hint-${step}"><strong>${esc(t(`mission.${step}`))}</strong> ${esc(missionText(key(`hint.${step}`)))}` +
          (step === "look" ? ` <button class="button small" data-mission="look">${esc(t("mission.show"))}</button>` : "") +
          `</li>`,
      )
      .join("");
    const button = $(".mission-hint");
    button.hidden = hints >= LADDER.length || !!shown.done;
    button.textContent = t(hints ? "mission.moreHint" : "mission.hint");
  }
  showHints();

  return {
    // Shows how far the mission has got in `world`; the play's `notice`
    // ("discarded", "unsaved" or null), and whether a program was `changed`
    // since the game started (session.js).
    show(world, { notice = null, changed = false } = {}) {
      const { have, need, item, building, done } = missionProgress(world, mission);
      const work = building && !done ? `${building.done}/${building.total}` : "";
      const again = changed && !done;
      const before = shown;
      shown = { have, done, work, notice, again };
      if (have !== before.have || done !== before.done) {
        const strip = $(".mission-progress");
        strip.innerHTML =
          Array.from({ length: need }, (_, i) => picture(item, { there: done || i < have })).join("") +
          `<span class="mission-arrow" aria-hidden="true">→</span>` +
          picture(builds, { there: done, size: 40 });
        strip.setAttribute("aria-label", missionText(key("progress"), { have: done ? need : have, need }));
      }
      // The work's line keeps its place, unseen, until the work starts, so the
      // overview below holds still; once the mission is done it goes.
      if (work !== before.work || done !== before.done) {
        const p = $(".mission-building");
        p.hidden = done;
        p.classList.toggle("idle", !work);
        p.innerHTML = `${esc(t(`action.build.${builds}`))} <progress max="${building?.total ?? 1}" value="${building?.done ?? 0}"></progress>`;
      }
      if (done !== before.done) {
        el.classList.toggle("done", done);
        $(".mission-done").innerHTML = done ? `<strong>${esc(t("mission.done"))}</strong> ${esc(missionText(key("reward")))}` : "";
        showHints();
      }
      if (again !== before.again) $(".mission-again").hidden = !again;
      if (notice !== before.notice) {
        $(".mission-notice").hidden = !notice;
        $(".mission-notice p").textContent = notice ? t(`mission.${notice}`) : "";
      }
    },
  };
}
