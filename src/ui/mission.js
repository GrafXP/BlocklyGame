import { display, missionText, t } from "../i18n/index.js";
import { mainProgram } from "../content/missions/campaign.js";
import { count } from "../sim/inventory.js";
import { goalProgress } from "../sim/objectives.js";
import { RECIPES } from "../sim/recipes.js";
import { reasonOf, statusOf } from "../sim/status.js";
import { thing } from "../sim/things.js";
import { describeReason, placeName } from "./describe.js";
import { esc } from "./dom.js";
import { picture, placePicture } from "./pictures.js";

// The mission card (PLAN.md §8, Main layout and Beginner support; §9): the
// goal in one short sentence, what's new, each goal with pictures and how far
// it has got, the trials, the hint ladder, and the reward once it's done. It
// reads the world and never changes it; goals are met in the world itself
// (src/sim/objectives.js). Following the campaign plan's teaching support:
//
// - Before Run, it asks for a prediction: said aloud, or by pointing at a thing
//   on the island; or skipped. After success, it asks for an explanation, to
//   tell someone, or skip. Nothing is written or marked.
// - The hints come one at a time, when asked for, and cost nothing: Look points
//   at the evidence (and chooses the thing it's about), Think asks one
//   question, Try says what to change, and offers a start or the whole program
//   in the editor. They answer the problem in view: a full basket gets its own
//   question, not the mission's. When everything has stopped or stalled short
//   of the goal, the card offers a hint, without interrupting.
// - “Open the program” opens the program the mission is about.
// - After a program was applied mid-run, it offers to start again: an applied
//   program starts from its start while the rest has moved on, so a change is
//   best watched from the mission's checkpoint (PLAN.md §9).
//
// The mission's start and its end have big windows of their own over the page,
// the briefing and the win (mission-overlays.js); the card stays beside the
// island throughout, with the way on once the mission is done.
//
// Phase 5's bridge slice keeps its strip of planks filling towards the bridge
// (`mission.progress`); the campaign's missions show their goals instead.

const LADDER = ["look", "think", "try"];

// How far a slice-like mission (with `progress`) has got in `world`: how many
// of the `item` its building needs it has (`have` of `need`), the work on it
// under way ({ done, total } in steps, or null), and whether it's `done`.
export function missionProgress(world, mission) {
  const { at, recipe } = mission.progress;
  const site = thing(world, at);
  const [[item, need]] = Object.entries(RECIPES[recipe].inputs);
  const a = site?.action;
  const building = a?.type === "make" && a.recipe === recipe ? { done: world.tick - a.start, total: a.end - a.start } : null;
  return { item, have: Math.min(need, site ? count(site.store, item) : 0), need, building, done: world.mission?.done != null };
}

const nameOf = (world, id) => placeName(world, id);

// The problem in view that mission `mission`'s hints answer: the first of its
// problems one of its robots or buildings is in ({ entity, key }), else a
// robot or building whose program stopped with an error ({ entity, error }),
// else null.
export function problemInView(world, mission) {
  for (const p of mission.problems ?? []) {
    const e = thing(world, p.entity);
    if (e && reasonOf(e)?.code === p.code) return { entity: p.entity, key: p.key };
  }
  const failed = world.entities.find((e) => e.error);
  return failed ? { entity: failed.id, error: failed.error } : null;
}

// Whether `world` has come to a standstill short of its mission's goal:
// stalled, or every robot and building stopped, after it has run.
export function stuck(world) {
  if (!world.mission || world.mission.done !== null || world.tick === 0) return false;
  return !!world.stall || world.entities.every((e) => ["stopped", "error"].includes(statusOf(e)));
}

// A goal as the card shows it: pictures, its words, and a note.
function goalView(world, goal) {
  const { have, need, done, failed } = goalProgress(world, goal);
  const item = goal.item ? t(`item.${goal.item}`) : null;
  const pics = (name, n = need) =>
    n > 8 ? picture(name, { there: done }) : Array.from({ length: n }, (_, i) => picture(name, { there: done || i < Math.min(have, n) })).join("");
  let pictures = "";
  let label = "";
  switch (goal.type) {
    case "reached":
      pictures = picture(placePicture(goal.at), { there: done });
      label = t("goal.reached", { robot: nameOf(world, goal.robot), place: nameOf(world, goal.at) });
      break;
    case "holds":
      pictures = pics(goal.item);
      label = t("goal.holds", { robot: nameOf(world, goal.robot), have, need });
      break;
    case "delivered":
      pictures = goal.item ? pics(goal.item) : picture("basket", { there: done });
      label = goal.by
        ? t("goal.deliveredBy", { robot: nameOf(world, goal.by), place: nameOf(world, goal.to), have, need })
        : t("goal.delivered", { item, place: nameOf(world, goal.to), have, need });
      break;
    case "trips":
      pictures = pics("basket");
      label = t("goal.trips", { robot: nameOf(world, goal.by), have, need });
      break;
    case "made":
      pictures = pics(goal.item);
      label = need ? t("goal.made", { item, place: nameOf(world, goal.at), have, need }) : t("goal.madeNone", { item, place: nameOf(world, goal.at), have });
      break;
    case "built":
      pictures = picture("bridge", { there: done, size: 40 });
      label = t("goal.built", { place: nameOf(world, goal.at) });
      break;
    case "steady":
      pictures = pics(goal.item);
      label = t("goal.steady", { item, place: nameOf(world, goal.at), have, need });
      break;
    case "remembers":
      pictures = pics("memory");
      label = t("goal.remembers", { robot: nameOf(world, goal.robot), have, need });
      break;
  }
  const notes = [];
  if (goal.exact) notes.push(t("goal.exact"));
  if (goal.load === 2) notes.push(t("goal.load"));
  if (goal.noWait) notes.push(t("goal.noWait", { robot: nameOf(world, goal.by) }));
  if (goal.type === "steady") notes.push(goal.after ? t("goal.steadyNote", { name: nameOf(world, goal.after) }) : t("goal.steadyAlone"));
  if (goal.type === "remembers") notes.push(t("goal.remembersNote"));
  return { pictures, label, note: failed ? t("goal.failed") : notes.join(" "), done, failed };
}

// The items of a list of `goals` of `world`'s mission, as the card and the
// briefing (mission-overlays.js) show them: pictures, words and a note, and
// whether each is met or failed.
export function goalsMarkup(world, goals) {
  return goals
    .map((goal) => {
      const v = goalView(world, goal);
      return `<li class="goal${v.done ? " met" : ""}${v.failed ? " failed" : ""}"><span class="goal-pictures" aria-hidden="true">${v.pictures}</span><span class="goal-words">${esc(v.label)}${v.note ? `<small>${esc(v.note)}</small>` : ""}</span></li>`;
    })
    .join("");
}

// The card in `el` for `mission`. `kept` holds what the card remembers across
// openings of the page (hints shown, the prediction, the explanation), and is
// changed as the player goes. `replay` says it's a mission played again on its
// own; `next` whether there's a mission after it to go on to.
//
// It calls `onLook(id)` when a hint asks for thing `id` to be chosen,
// `onOpen(program)` to open a program's editor, `onShow(program, which)` to
// put a start ("start") or the whole program ("whole") into its editor,
// `onRestart()` when the player starts again from the card, `onNext()` to go
// on, and `onDismiss()` when the player has read a notice.
export function createMissionCard(el, bin, { mission, kept, replay = false, next = false, onLook, onOpen, onShow, onRestart, onNext, onDismiss }) {
  const key = (part) => `${mission.id}.${part}`;
  const has = (part) => missionText(key(part)) !== key(part);
  const isSlice = !!mission.progress;
  const main = isSlice ? null : mainProgram(mission);
  const trials = mission.trials ?? [];
  kept.hints ??= 0;
  kept.predict ??= mission.predict ? "ask" : "done"; // "ask", "pointing", "said", "done", or a thing's id
  kept.explained ??= false;

  el.innerHTML = `${mission.n ? `<p class="mission-chapter">${esc(t("mission.chapter", { chapter: mission.chapter, n: mission.n }))}</p>` : ""}
    <h2 class="mission-title">${esc(missionText(key("title")))}</h2>
    ${replay ? `<p class="mission-replay">${esc(t("mission.replaying", { n: mission.n }))}</p>` : ""}
    <p class="mission-goal">${esc(missionText(key("goal")))}</p>
    ${has("setup") ? `<p class="mission-setup">${esc(missionText(key("setup")))}</p>` : ""}
    ${isSlice ? `<div class="mission-progress" role="img"></div><p class="mission-building idle"></p>` : `<ul class="mission-goals" aria-label="${esc(t("mission.goals"))}"></ul>`}
    ${trials.length > 1 ? `<ol class="mission-trials" aria-label="${esc(t("mission.trials"))}"></ol><p class="mission-passed" role="status" hidden></p>` : ""}
    <div class="mission-predict" hidden></div>
    ${main ? `<div class="mission-actions"><button class="button small" data-mission="open">${esc(t("mission.open"))}</button></div>` : ""}
    <p class="mission-done" role="status"></p>
    <div class="mission-explain" hidden></div>
    <div class="mission-next" hidden></div>
    <div class="mission-again" hidden><p>${esc(t("mission.again"))}</p><button class="button small primary" data-mission="restart">${esc(t("world.reset"))}</button></div>
    <p class="mission-stuck" role="status" hidden>${esc(t("mission.stuck"))}</p>
    <ol class="mission-hints"></ol>
    <button class="button small mission-hint" data-mission="hint"></button>
    <div class="mission-notice" role="alert" hidden><p></p><button class="button small" data-mission="dismiss">${esc(t("mission.ok"))}</button></div>`;
  el.setAttribute("aria-label", t("mission.label"));
  const $ = (sel) => el.querySelector(sel);
  const drawn = new Map();
  // Sets the markup of `sel`, if it's new.
  const draw = (sel, markup) => {
    if (drawn.get(sel) === markup) return;
    drawn.set(sel, markup);
    $(sel).innerHTML = markup;
  };
  let world = null;
  let shown = {};
  let problem = null;

  bin.on(el, "click", (e) => {
    const act = e.target.closest("[data-mission]")?.dataset.mission;
    if (act === "hint" && kept.hints < LADDER.length) {
      kept.hints++;
      if (kept.hints === 1) onLook?.(problem?.entity ?? mission.look);
      showHints();
    } else if (act === "look") onLook?.(problem?.entity ?? mission.look);
    else if (act === "open") onOpen?.(main);
    else if (act === "start" || act === "whole") onShow?.(e.target.closest("[data-program]").dataset.program, act);
    else if (act === "restart") onRestart?.();
    else if (act === "next") onNext?.();
    else if (act === "dismiss") onDismiss?.();
    else if (act === "point") kept.predict = "pointing";
    else if (act === "said") kept.predict = "said";
    else if (act === "skip") kept.predict = "done";
    else if (act === "explained") kept.explained = true;
    else return;
    if (world) card.show(world, shown.options);
  });

  // The hint ladder, as far as the player has asked for it, answering the
  // problem in view.
  function showHints() {
    const words = (step) => {
      if (step === "think" && problem?.key) return missionText(key(`problem.${problem.key}`));
      if (step === "look" && problem?.error && world) return t("problem.error", { name: nameOf(world, problem.entity), reason: describeReason(world, problem.error) });
      return missionText(key(`hint.${step}`));
    };
    const tryButtons = () => {
      const starts = Object.keys(mission.scaffold ?? {});
      const wholes = Object.keys(mission.reference?.programs ?? {}).filter((id) => mission.programs?.some((p) => p.id === id));
      return (
        starts.map((id) => `<button class="button small" data-mission="start" data-program="${esc(id)}">${esc(t("mission.start"))}</button>`).join("") +
        wholes.map((id) => `<button class="button small" data-mission="whole" data-program="${esc(id)}">${esc(wholes.length > 1 ? t("mission.wholeOf", { name: display(mission.programs.find((p) => p.id === id).name) }) : t("mission.whole"))}</button>`).join("")
      );
    };
    draw(
      ".mission-hints",
      LADDER.slice(0, kept.hints)
        .map(
          (step) =>
            `<li class="hint-${step}"><strong>${esc(t(`mission.${step}`))}</strong> ${esc(words(step))}` +
            (step === "look" ? ` <button class="button small" data-mission="look">${esc(t("mission.show"))}</button>` : "") +
            (step === "try" && !isSlice ? `<span class="hint-buttons">${tryButtons()}</span>` : "") +
            `</li>`,
        )
        .join(""),
    );
    const button = $(".mission-hint");
    button.hidden = kept.hints >= LADDER.length || !!shown.done;
    button.textContent = t(kept.hints ? "mission.moreHint" : "mission.hint");
  }

  // The prediction before Run: asked while the world hasn't run, and the guess
  // shown once made, until the mission is done.
  function showPredict(done) {
    const box = $(".mission-predict");
    const asking = !done && world.tick === 0 && ["ask", "pointing"].includes(kept.predict);
    const guess = !["ask", "pointing", "said", "done"].includes(kept.predict) ? kept.predict : null;
    box.hidden = !asking && !(guess && !done);
    const point = mission.predict === "point";
    draw(
      ".mission-predict",
      box.hidden
        ? ""
        : guess
        ? `<p>${esc(t("mission.guess", { name: nameOf(world, guess) }))}</p>`
        : kept.predict === "pointing"
          ? `<p><strong>${esc(t("mission.predictLabel"))}</strong> ${esc(t("mission.pointing"))}</p><button class="button small" data-mission="skip">${esc(t("mission.skip"))}</button>`
          : `<p><strong>${esc(t("mission.predictLabel"))}</strong> ${esc(missionText(key("predict")))}</p>` +
            (point ? `<button class="button small primary" data-mission="point">${esc(t("mission.point"))}</button>` : `<button class="button small primary" data-mission="said">${esc(t("mission.said"))}</button>`) +
            `<button class="button small" data-mission="skip">${esc(t("mission.skip"))}</button>`,
    );
  }

  const card = {
    // Shows how far the mission has got in `world`; the play's `notice`
    // ("discarded", "unsaved" or null), and whether a program was `changed`
    // since the game started (session.js).
    show(w, options = {}) {
      const { notice = null, changed = false } = options;
      world = w;
      const m = w.mission;
      const done = m?.done != null;
      const before = shown;
      shown = { options, done, notice, again: changed && !done, problem: JSON.stringify(problemInView(w, mission)) };
      problem = JSON.parse(shown.problem);

      if (isSlice) showStrip(w, done, before);
      else draw(".mission-goals", goalsMarkup(w, m?.goals ?? []));
      if (trials.length > 1 && m) {
        draw(
          ".mission-trials",
          trials
            .map((_, i) => {
              const state = i < m.passed.length ? "passed" : i === m.trial && !done ? "current" : "later";
              return `<li class="trial ${state}"><strong>${esc(t("mission.trialLabel", { n: i + 1 }))}</strong> ${esc(missionText(key(`trial.${i + 1}`)))}</li>`;
            })
            .join(""),
        );
        const justPassed = !done && m.passed.length && m.passed.at(-1) === w.tick;
        const line = $(".mission-passed");
        line.hidden = !justPassed;
        line.textContent = justPassed ? t("mission.trialPassed", { n: m.passed.length, what: missionText(key(`trial.${m.trial + 1}`)) }) : "";
      }
      showPredict(done);

      if (done !== before.done) {
        el.classList.toggle("done", done);
        draw(".mission-done", done ? `<strong>${esc(t("mission.done"))}</strong> ${esc(missionText(key("reward")))}` : "");
      }
      const explain = $(".mission-explain");
      explain.hidden = !done || kept.explained || !has("explain");
      draw(".mission-explain", has("explain") ? `<p><strong>${esc(t("mission.explainLabel"))}</strong> ${esc(missionText(key("explain")))}</p><button class="button small" data-mission="explained">${esc(t("mission.explained"))}</button>` : "");
      const onward = $(".mission-next");
      onward.hidden = !done || isSlice;
      draw(".mission-next", `<button class="button primary" data-mission="next">${esc(t(replay || !next ? "mission.toMissions" : "mission.next"))}</button>`);

      $(".mission-stuck").hidden = !stuck(w);
      $(".mission-hint").classList.toggle("offer", stuck(w));
      if (shown.again !== before.again) $(".mission-again").hidden = !shown.again;
      if (notice !== before.notice) {
        $(".mission-notice").hidden = !notice;
        $(".mission-notice p").textContent = notice ? t(`mission.${notice}`) : "";
      }
      showHints();
    },
    // The player chose thing `id` on the island: the guess, while the card
    // asks to point. Returns whether it took it.
    pointed(id) {
      if (kept.predict !== "pointing" || !id) return false;
      kept.predict = id;
      if (world) card.show(world, shown.options);
      return true;
    },
  };

  // Phase 5's strip: the planks the bridge needs, filling as they arrive, then
  // the work on it.
  function showStrip(w, done, before) {
    const { have, need, item, building } = missionProgress(w, mission);
    const builds = RECIPES[mission.progress.recipe].builds;
    const work = building && !done ? `${building.done}/${building.total}` : "";
    shown.have = have;
    shown.work = work;
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
  }

  return card;
}
