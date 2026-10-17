import { missionText, t } from "../i18n/index.js";
import { esc } from "./dom.js";
import { startFireworks } from "./fireworks.js";
import { goalsMarkup } from "./mission.js";

// The mission's two big moments, each a window over the whole island page
// (PLAN.md §8, Beginner support):
//
// - The briefing, as the mission starts: its chapter and number, its title,
//   the goal in one sentence, what's set up, each goal with its pictures, and
//   one big Let's go.
// - The win, once it's done: fireworks bursting behind “Mission complete!”,
//   the mission's reward, and the way on. Next mission is the big, glowing
//   button; Keep playing is the small one, back to the island as it is, where
//   the card still offers the next mission. After a replay, or the last
//   mission, the big button goes back to the missions.
//
// Each is a modal <dialog>, so nothing behind it is pressed by mistake; Escape
// is Let's go on the briefing and Keep playing on the win. The briefing shows
// while the mission is at its start, step 0, until the player goes past it;
// the win once the mission is done, until the player keeps playing, and again
// after Start again and another win. `kept` remembers which the player has
// gone past, so a change of language, which opens the page again, shows what
// was showing.
//
// `onWin()` is called as the win opens, `onKeep()` when the player keeps
// playing, and `onNext()` for the big button.

const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.85 5.9 6.5.9-4.72 4.55 1.15 6.45L12 17.3l-5.78 3.1 1.15-6.45L2.65 9.4l6.5-.9z"/></svg>`;
const ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z"/></svg>`;

export function createMissionOverlays(root, bin, { mission, kept, replay = false, next = false, onWin, onKeep, onNext }) {
  const key = (part) => `${mission.id}.${part}`;
  const has = (part) => missionText(key(part)) !== key(part);
  const title = missionText(key("title"));
  kept.briefed ??= false;
  kept.kept ??= false; // whether the player kept playing after the win

  root.insertAdjacentHTML(
    "beforeend",
    `<dialog class="briefing" aria-labelledby="briefing-title">
      <div class="briefing-panel">
        ${mission.n ? `<p class="briefing-chapter">${esc(t("mission.chapter", { chapter: mission.chapter, n: mission.n }))}</p>` : ""}
        <h2 id="briefing-title">${esc(title)}</h2>
        ${replay ? `<p class="briefing-replay">${esc(t("mission.replaying", { n: mission.n }))}</p>` : ""}
        <p class="briefing-goal">${esc(missionText(key("goal")))}</p>
        ${has("setup") ? `<p class="briefing-setup">${esc(missionText(key("setup")))}</p>` : ""}
        <ul class="briefing-goals mission-goals" aria-label="${esc(t("mission.goals"))}"></ul>
        <button class="button briefing-go" data-overlay="go">${esc(t("briefing.go"))}</button>
      </div>
    </dialog>
    <dialog class="win" aria-labelledby="win-title">
      <canvas class="fireworks" aria-hidden="true"></canvas>
      <div class="win-panel">
        <div class="win-star">${STAR}</div>
        <p class="win-mission">${esc(mission.n ? t("win.mission", { n: mission.n, title }) : title)}</p>
        <h2 id="win-title">${esc(t("win.title"))}</h2>
        ${has("reward") ? `<p class="win-reward">${esc(missionText(key("reward")))}</p>` : ""}
        <div class="win-actions">
          <button class="button win-next" data-overlay="next" autofocus><span>${esc(t(next && !replay ? "mission.next" : "mission.toMissions"))}</span>${ARROW}</button>
          <button class="button win-keep" data-overlay="keep">${esc(t("win.keep"))}</button>
        </div>
      </div>
    </dialog>`,
  );
  const briefing = root.querySelector(".briefing");
  const win = root.querySelector(".win");
  let stopFireworks = null;

  function closeBriefing() {
    kept.briefed = true;
    if (briefing.open) briefing.close();
  }
  function openWin() {
    if (win.open) return;
    win.showModal();
    stopFireworks = startFireworks(win.querySelector(".fireworks"));
    onWin?.();
  }
  function closeWin() {
    stopFireworks?.();
    stopFireworks = null;
    if (win.open) win.close();
  }

  bin.on(root, "click", (e) => {
    const act = e.target.closest("[data-overlay]")?.dataset.overlay;
    if (act === "go") closeBriefing();
    else if (act === "keep") {
      kept.kept = true;
      closeWin();
      onKeep?.();
    } else if (act === "next") onNext?.();
  });
  // Escape: Let's go, or Keep playing.
  bin.on(briefing, "cancel", (e) => {
    e.preventDefault();
    closeBriefing();
  });
  bin.on(win, "cancel", (e) => {
    e.preventDefault();
    kept.kept = true;
    closeWin();
    onKeep?.();
  });
  bin.add(() => stopFireworks?.());

  return {
    // Shows what `world` calls for: the briefing at the mission's start, the
    // win once it's done.
    show(world) {
      const done = world.mission?.done != null;
      if (!done) kept.kept = false; // started again: the next win shows
      if (world.tick > 0) kept.briefed = true;
      if (!kept.briefed && !done) {
        if (!briefing.open) {
          const goals = briefing.querySelector(".briefing-goals");
          goals.innerHTML = goalsMarkup(world, world.mission?.goals ?? []);
          goals.hidden = !goals.children.length;
          briefing.showModal();
        }
      } else if (briefing.open) briefing.close();
      if (done && !kept.kept) openWin();
      else closeWin();
    },
    // Which is open: "briefing", "win", or null.
    open: () => (briefing.open ? "briefing" : win.open ? "win" : null),
  };
}
