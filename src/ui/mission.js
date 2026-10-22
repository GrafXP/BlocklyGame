import { display, missionText, t } from "../i18n/index.js";
import { mainProgram } from "../content/missions/campaign.js";
import { TYPES } from "../sim/entities.js";
import { count } from "../sim/inventory.js";
import { goalProgress } from "../sim/objectives.js";
import { RECIPES } from "../sim/recipes.js";
import { reasonOf, statusOf } from "../sim/status.js";
import { thing } from "../sim/things.js";
import { describeReason, placeName } from "./describe.js";
import { esc } from "./dom.js";
import { icon, iconButton } from "./icons.js";
import { picture, placePicture } from "./pictures.js";

// The mission card (PLAN.md §8, Main layout and Beginner support; §9): the
// goal in one short sentence, what's new, the goal with pictures and how far
// it has got, the hint ladder, and the reward once it's done. It
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
// the briefing and the win (mission-overlays.js). The card opens from the
// mission's title in the bar, and what it asks or offers by itself comes in a
// bubble over the island while it holds, the way on among them once the
// mission is done; the bar shows the goals as pictures throughout.
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

// A goal as the card shows it: pictures, `size` CSS pixels square, its words,
// and a note.
function goalView(world, goal, size = 32) {
  const { have, need, done, failed } = goalProgress(world, goal);
  const item = goal.item ? t(`item.${goal.item}`) : null;
  const pics = (name, n = need) =>
    n > 8 ? picture(name, { there: done, size }) : Array.from({ length: n }, (_, i) => picture(name, { there: done || i < Math.min(have, n), size })).join("");
  let pictures = "";
  let label = "";
  switch (goal.type) {
    case "reached": {
      // With pulses to land on the way, or a repair first: their pictures too.
      const robot = nameOf(world, goal.robot);
      const place = nameOf(world, goal.at);
      const tally = world.mission.tally;
      const along = (name, n, got) => Array.from({ length: n }, (_, i) => picture(name, { there: done || i < got, size })).join("");
      pictures = picture(placePicture(goal.at), { there: done, size });
      if (goal.hits) {
        pictures = along("pulse", goal.hits, tally.hits[goal.robot] ?? 0) + pictures;
        label = t("goal.reachedHits", { robot, place, need: goal.hits });
      } else if (goal.repairs) {
        pictures = along("shield", goal.repairs, tally.repairs[goal.robot] ?? 0) + pictures;
        label = t("goal.reachedRepairs", { robot, place });
      } else label = t("goal.reached", { robot, place });
      break;
    }
    case "hits":
      pictures = pics("pulse");
      label = t("goal.hits", { robot: nameOf(world, goal.by), have, need });
      break;
    case "repaired":
      pictures = pics("shield");
      label = t("goal.repaired", { robot: nameOf(world, goal.robot), have, need });
      break;
    case "holds":
      pictures = pics(goal.item);
      label = t("goal.holds", { robot: nameOf(world, goal.robot), have, need });
      break;
    case "delivered":
      pictures = goal.item ? pics(goal.item) : picture("basket", { there: done, size });
      label = goal.by
        ? t("goal.deliveredBy", { robot: nameOf(world, goal.by), place: nameOf(world, goal.to), have, need })
        : t("goal.delivered", { item, place: nameOf(world, goal.to), have, need });
      break;
    case "order": {
      // Each item's pictures, filled as its deliveries come.
      const got = (name) => world.mission.tally.unloads[`${goal.to}|${goal.by ?? "*"}|${name}`]?.items ?? 0;
      pictures = Object.entries(goal.items)
        .map(([name, n]) => Array.from({ length: n }, (_, i) => picture(name, { there: done || i < got(name), size })).join(""))
        .join("");
      label = t("goal.order", { place: nameOf(world, goal.to), have, need });
      break;
    }
    case "together":
      pictures = goal.items.map((name) => picture(name, { there: done, size })).join("");
      label = goal.by
        ? t("goal.togetherBy", { robot: nameOf(world, goal.by), place: nameOf(world, goal.to), have, need })
        : t("goal.together", { place: nameOf(world, goal.to), have, need });
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
      pictures = picture("bridge", { there: done, size: Math.round(size * 1.25) });
      label = t("goal.built", { place: nameOf(world, goal.at) });
      break;
    case "placed":
    case "constructed":
      pictures = picture(placePicture(goal.blueprint), { there: done, size: Math.round(size * 1.25) });
      label = t(`goal.${goal.type}`, { building: t(`entity.${goal.blueprint}`) });
      break;
    case "steady":
      pictures = pics(goal.item);
      label = t("goal.steady", { item, place: nameOf(world, goal.at), have, need });
      break;
    case "assembled": {
      // A building that makes guards (the workshop) makes a guard.
      const guards = TYPES[thing(world, goal.at)?.type]?.recipes?.includes("guard");
      pictures = pics(guards ? "guard" : "robot");
      label = t(guards ? "goal.assembledGuard" : "goal.assembled", { place: nameOf(world, goal.at), have, need });
      break;
    }
    case "remembers":
      pictures = pics("memory");
      label = t("goal.remembers", { robot: nameOf(world, goal.robot), have, need });
      break;
  }
  const notes = [];
  if (goal.exact) notes.push(t("goal.exact"));
  if (goal.load === 2) notes.push(t("goal.load"));
  if (goal.noWait) notes.push(goal.type === "made" ? t("goal.noWaitMake", { name: nameOf(world, goal.at) }) : t("goal.noWait", { robot: nameOf(world, goal.by) }));
  if (goal.type === "steady") notes.push(goal.after ? t("goal.steadyNote", { name: nameOf(world, goal.after) }) : t("goal.steadyAlone"));
  if (goal.type === "remembers") notes.push(t("goal.remembersNote"));
  if (goal.safe) notes.push(t("goal.safe", { robot: nameOf(world, goal.safe) }));
  return { pictures, label, note: failed ? t("goal.failed") : notes.join(" "), done, failed };
}

// The goals of `world`'s mission as small pictures alone, filling as they're
// met, for the bar along the top: how far the mission has got at a glance.
export function goalsPictures(world, goals) {
  return goals
    .map((goal) => {
      const v = goalView(world, goal, 22);
      return `<span class="goal-mini${v.done ? " met" : ""}${v.failed ? " failed" : ""}">${v.pictures}</span>`;
    })
    .join("");
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

// The card in `el` for `mission`, which the page shows when asked for (the
// mission's panel, island.js), and what it has to say without being asked in
// `coach`, each in a bubble over the island while it holds: the prediction
// before Run, the offer of a hint when everything has stopped,
// the offer to start again, a notice, the explanation and the way on once it's
// done. `progress`, in the bar along the top, shows the goals as pictures
// alone. `kept` holds what the card remembers across openings of the page
// (hints shown, the prediction, the explanation), and is changed as the player
// goes. `replay` says it's a mission played again on its own; `next` whether
// there's a mission after it to go on to.
//
// It calls `onLook(id)` when a hint asks for thing `id` to be chosen,
// `onHint()` when a hint is asked for, `onOpen(program)` to open a program's
// editor, `onShow(program, which)` to put a start ("start") or the whole
// program ("whole") into its editor, `onRestart()` when the player starts
// again from the card, `onNext()` to go on, and `onDismiss()` when the player
// has read a notice.
export function createMissionCard(el, bin, { mission, kept, replay = false, next = false, coach, progress = null, onLook, onHint, onOpen, onShow, onRestart, onNext, onDismiss }) {
  const key = (part) => `${mission.id}.${part}`;
  const has = (part) => missionText(key(part)) !== key(part);
  const isSlice = !!mission.progress;
  const main = isSlice ? null : mainProgram(mission);
  kept.hints ??= 0;
  kept.predict ??= mission.predict ? "ask" : "done"; // "ask", "pointing", "said", "done", or a thing's id
  kept.explained ??= false;

  el.innerHTML = `<div class="mission-head">
      ${mission.n ? `<p class="mission-chapter">${esc(t("mission.chapter", { chapter: mission.chapter, n: mission.n }))}</p>` : "<span></span>"}
      ${iconButton("close", t("inspector.close"), { attrs: `data-drawer="mission"` })}
    </div>
    <h2 class="mission-title">${esc(missionText(key("title")))}</h2>
    ${replay ? `<p class="mission-replay">${esc(t("mission.replaying", { n: mission.n }))}</p>` : ""}
    <p class="mission-goal">${esc(missionText(key("goal")))}</p>
    ${has("setup") ? `<p class="mission-setup">${esc(missionText(key("setup")))}</p>` : ""}
    ${isSlice ? `<div class="mission-progress" role="img"></div><p class="mission-building idle"></p>` : `<ul class="mission-goals" aria-label="${esc(t("mission.goals"))}"></ul>`}
    ${main ? `<div class="mission-actions"><button type="button" class="button" data-mission="open">${icon("blocks")}${esc(t("mission.open"))}</button></div>` : ""}
    <p class="mission-done" role="status"></p>
    <ol class="mission-hints"></ol>
    <button type="button" class="button mission-hint" data-mission="hint">${icon("hint")}<span class="hint-words"></span></button>`;
  coach.innerHTML = `<div class="mission-predict coach-bubble" hidden></div>
    <div class="coach-stuck coach-bubble" hidden><p class="mission-stuck" role="status">${esc(t("mission.stuck"))}</p><button type="button" class="button small coach-hint" data-mission="hint">${icon("hint", 18)}<span class="hint-words"></span></button></div>
    <div class="mission-again coach-bubble" hidden><p>${esc(t("mission.again"))}</p><button type="button" class="button small primary" data-mission="restart">${icon("restart", 18)}${esc(t("world.reset"))}</button></div>
    <div class="mission-notice coach-bubble" role="alert" hidden><p></p><button type="button" class="button small" data-mission="dismiss">${icon("check", 18)}${esc(t("mission.ok"))}</button></div>
    <div class="mission-explain coach-bubble" hidden></div>
    <div class="mission-next coach-bubble" hidden></div>`;
  el.setAttribute("aria-label", t("mission.label"));
  // The card's part `sel`, on the card or in a bubble.
  const $ = (sel) => el.querySelector(sel) ?? coach.querySelector(sel);
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

  const onClick = (e) => {
    const act = e.target.closest("[data-mission]")?.dataset.mission;
    if (act === "hint" && kept.hints < LADDER.length) {
      kept.hints++;
      if (kept.hints === 1) onLook?.(problem?.entity ?? mission.look);
      showHints();
      onHint?.();
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
  };
  bin.on(el, "click", onClick);
  bin.on(coach, "click", onClick);

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
    const more = t(kept.hints ? "mission.moreHint" : "mission.hint");
    for (const button of [el.querySelector(".mission-hint"), coach.querySelector(".coach-hint")]) {
      button.hidden = kept.hints >= LADDER.length || !!shown.done;
      const words = button.querySelector(".hint-words");
      if (words.textContent !== more) words.textContent = more;
    }
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
      if (progress && !isSlice) {
        const pictures = goalsPictures(w, m?.goals ?? []);
        if (drawn.get("progress") !== pictures) {
          drawn.set("progress", pictures);
          progress.innerHTML = pictures;
        }
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
      draw(".mission-next", `<button type="button" class="button primary" data-mission="next">${esc(t(replay || !next ? "mission.toMissions" : "mission.next"))}${icon("moving", 20)}</button>`);

      $(".coach-stuck").hidden = !stuck(w);
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
      const pictures = (size) =>
        Array.from({ length: need }, (_, i) => picture(item, { there: done || i < have, size })).join("") +
        `<span class="mission-arrow" aria-hidden="true">${icon("moving", Math.round(size * 0.6))}</span>` +
        picture(builds, { there: done, size: Math.round(size * 1.25) });
      strip.innerHTML = pictures(32);
      strip.setAttribute("aria-label", missionText(key("progress"), { have: done ? need : have, need }));
      if (progress) progress.innerHTML = pictures(22);
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
