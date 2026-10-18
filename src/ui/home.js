import { missionText, t } from "../i18n/index.js";
import { esc, html, isDev } from "./dom.js";
import { languageChoice } from "./language-choice.js";

// The title page, a game's menu for children. It leads to the campaign, at the
// mission it's at (PLAN.md §9), with how far it got when it's saved on this
// device; and to the mission map: every chapter's missions as tiles, those
// done with a star, to play again on their own, the one the campaign is at to
// go on with, and the rest locked until then. With ?dev every mission opens,
// played on its own as one done is, so testing one leaves the campaign as it
// is. Below the map: free play once mission 15 is done, which becomes the
// sandbox after mission 25; Start over, for the next player of a playtest; the
// languages; and, folded away but for ?dev, the second campaign as far as it's
// built (docs/campaign-planv2.md), with its own map, and the prototypes of the
// phases so far: the bridge slice, the island in 3D, the editor lab and the
// world lab. Its one listener
// is on its own element, and goes with it: the title page holds nothing that
// outlives it (src/lifecycle.js).

// The map's pictures, drawn in the colour of the words beside them.
const ICONS = {
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.85 5.9 6.5.9-4.72 4.55 1.15 6.45L12 17.3l-5.78 3.1 1.15-6.45L2.65 9.4l6.5-.9z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6c0 .8.86 1.28 1.54.86l10.7-6.8a1 1 0 0 0 0-1.72L9.54 4.34C8.86 3.92 8 4.4 8 5.2z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h.5A1.5 1.5 0 0 1 19 11.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-8A1.5 1.5 0 0 1 6.5 10zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0z"/></svg>`,
};

// What each state of a mission's tile says under its title, with its picture:
// done, the one the campaign is at, open with ?dev, and locked.
const STATES = {
  done: { icon: "star", words: "home.replay" },
  current: { icon: "play", words: "home.here" },
  open: { icon: "play", words: "home.try" },
  later: { icon: "lock", words: "home.locked" },
};

export function home(el) {
  let gone = false;
  // The ?dev flag goes along, so the pages' test hooks stay on.
  const link = (path) => `${path}${path.includes("?") && location.search ? `&${location.search.slice(1)}` : location.search}`;
  const $ = html(
    el,
    `<div class="home-screen">
      <div class="page home">
        <img class="home-icon" src="/icon.svg" alt="" width="104" height="104" />
        <h1>${t("app.name")}</h1>
        <p class="tagline">${t("home.tagline")}</p>
        <a class="button primary play" href="${link("/play")}" data-link><span class="play-icon">${ICONS.play}</span><span class="play-words">${esc(t("home.play"))}</span></a>
        <p class="note">${t("home.playNote")} <strong class="saved" role="status"></strong></p>
        <section class="missions" aria-labelledby="home-missions">
          <h2 id="home-missions">${esc(t("home.missions"))}</h2>
          ${isDev() ? `<p class="note dev-note">${esc(t("home.devOpen"))}</p>` : ""}
          <div class="chapters"></div>
        </section>
        <a class="button free" href="${link("/free")}" data-link hidden></a>
        <p class="note free-note"></p>
        <div class="start-over" hidden>
          <button class="button small" data-home="ask" aria-expanded="false">${t("home.startOver")}</button>
          <div class="ask" hidden>
            <p>${t("home.startOverAsk")}</p>
            <button class="button small primary" data-home="yes">${t("home.startOverYes")}</button>
            <button class="button small" data-home="no">${t("home.startOverNo")}</button>
          </div>
        </div>
        ${languageChoice({ button: "button small" })}
        <details class="grown-ups"${isDev() ? " open" : ""}>
          <summary>${esc(t("home.prototypes"))}</summary>
          <a class="button small" href="${link("/play2")}" data-link>${esc(t("home.campaign2"))}</a>
          <p class="note">${t("home.campaign2Note")}</p>
          <div class="chapters chapters2"></div>
          <a class="button small" href="${link("/slice")}" data-link>${esc(missionText("slice.title"))}</a>
          <p class="note">${t("home.sliceNote")}</p>
          <a class="button small" href="${link("/island")}" data-link>${t("home.island")}</a>
          <p class="note">${t("home.islandNote")}</p>
          <a class="button small" href="${link("/lab")}" data-link>${t("home.lab")}</a>
          <p class="note">${t("home.labNote")}</p>
          <a class="button small" href="${link("/world")}" data-link>${t("home.world")}</a>
          <p class="note">${t("home.worldNote")}</p>
        </details>
      </div>
    </div>`,
  );

  // Mission `m`'s tile in state `state` (STATES): a link to play it, unless
  // it's locked; the one the campaign is at plays at `at`, its page.
  function tile(m, state, at) {
    const { icon, words } = STATES[state];
    const inside =
      `<span class="tile-n">${m.n}</span>` +
      `<span class="tile-title">${esc(missionText(`${m.id}.title`))}</span>` +
      `<span class="tile-state">${ICONS[icon]}${esc(t(words))}</span>`;
    const to = state === "current" ? at : `/replay?mission=${m.id}`;
    return `<li value="${m.n}" class="${state}">${state === "later" ? `<div class="tile">${inside}</div>` : `<a class="tile" href="${link(to)}" data-link>${inside}</a>`}</li>`;
  }

  // Every chapter of `chapters` ([{ n, title, missions }]) on a map, with how
  // many of its missions are done (`done`, a set of ids); mission `at` is
  // the one the campaign is at, played at page `page`.
  function map(chapters, done, at, page) {
    const stateOf = (m) => (done.has(m.id) ? "done" : m === at ? "current" : isDev() ? "open" : "later");
    return chapters
      .map(({ n, title, missions }) => {
        const stars = missions.filter((m) => done.has(m.id)).length;
        return (
          `<section class="chapter chapter-${n}">` +
          `<h3><span class="chapter-title">${esc(t("home.chapter", { n, title }))}</span><span class="chapter-stars">${ICONS.star}${stars}/${missions.length}</span></h3>` +
          `<ol>${missions.map((m) => tile(m, stateOf(m), page)).join("")}</ol></section>`
        );
      })
      .join("");
  }

  // How far the campaigns got, from the session, fetched only now: the title
  // page opens without the simulation.
  let session = null;
  let campaign = null;
  let campaign2 = null;
  function show() {
    const status = session.campaignStatus();
    const status2 = session.campaignStatus("campaign2");
    const open = session.unlocked();
    const at = status?.mission ?? campaign.CAMPAIGN[0];
    $(".play-words").textContent = status ? t("home.continue", { n: at.n, title: missionText(`${at.id}.title`) }) : t("home.play");
    $(".saved").textContent = !status ? "" : status.done ? t("home.completed") : status.saved && status.tick ? t("home.saved", { tick: status.tick }) : "";
    $(".start-over").hidden = !status && !status2;
    asking(false);

    // Every chapter's missions on the map, with how many of them are done.
    const chapters = Array.from({ length: campaign.CHAPTER_COUNT }, (_, i) => i + 1).map((n) => ({ n, title: t(`chapter.${n}`), missions: campaign.chapterMissions(n) }));
    $(".missions .chapters").innerHTML = map(chapters, new Set(status?.completed ?? []), at, "/play");

    // The second campaign's, among the prototypes.
    const done2 = status2?.completed ?? [];
    const chapters2 = campaign2.CHAPTERS2.map(({ chapter, missions }) => ({ n: chapter, title: t(`chapter2.${chapter}`), missions }));
    $(".chapters2").innerHTML = map(chapters2, new Set(done2), status2?.mission ?? campaign2.firstOpen(done2), "/play2");

    // Free play, once the bridge is built; the sandbox once the workshop works.
    const free = $(".free");
    free.hidden = !open.free;
    free.textContent = t(open.sandbox ? "home.sandbox" : "home.free");
    $(".free-note").textContent = open.sandbox ? t("home.sandboxNote") : open.free ? t("home.freeNote") : t("home.freeLocked");
  }
  function asking(on) {
    $(".start-over .ask").hidden = !on;
    $('[data-home="ask"]').setAttribute("aria-expanded", String(on));
  }
  Promise.all([import("./session.js"), import("../content/missions/campaign.js"), import("../content/missions/v2/index.js")]).then(([s, c, c2]) => {
    if (gone) return;
    session = s;
    campaign = c;
    campaign2 = c2;
    show();
  });
  $(".home").addEventListener("click", (e) => {
    const act = e.target.closest("[data-home]")?.dataset.home;
    if (act === "ask") asking(true);
    else if (act === "no") asking(false);
    else if (act === "yes" && session) {
      session.forgetCampaign();
      show();
    }
  });
  return () => (gone = true);
}
