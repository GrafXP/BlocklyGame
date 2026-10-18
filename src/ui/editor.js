import { display, formatList, t } from "../i18n/index.js";
import { DEFAULT_TREATMENT } from "../blockly/treatments.js";
import { toolboxFor } from "../blockly/toolboxes.js";
import { isChanged, latest, programDoc, resetDraft, sameBlocks, setDraft } from "../programming/programs.js";
import { programOf } from "../programming/runtime.js";
import { esc } from "./dom.js";
import { icon, iconButton } from "./icons.js";
import { identityMark } from "./inspector.js";
import { marksFor } from "./marks.js";
import { createWarnings } from "./problems.js";
import { createHistory } from "./history.js";
import { applyProgram, checkProgram, currentGame, currentLibrary, libraryChanged, programContext, rules, showProgram } from "./session.js";

// The program editor (PLAN.md §5, "Editing and applying"): the Blockly editor for
// one program, in a panel over the world. It edits the program's draft, which
// the world never runs; Apply checks it, and its new revision reaches the world
// at the next tick boundary, by Step or Run (src/sim/commands.js). Until then the
// program is marked as waiting to start, and the old revision runs on. Undo
// changes takes the draft back to the newest revision; Starter program, to what
// the game gave it; and in a chapter's project or free play, Start from
// nothing leaves the start block alone.
//
// Versions, at the head, opens the program's history: every version applied,
// as a tree, each to put back into the draft (history.js).
//
// The head says little in words: the version in a bubble whose look says
// whether it runs, has changed, waits for the next step or has problems; who
// runs it by mark and name; and the actions as icons, Apply beside its word.
// The sentences it stands for are there for screen readers.
//
// The toolbox offers only what the robots or buildings running the program can
// do, and its dropdowns only what's on the island (src/blockly/toolboxes.js,
// choices.js). The compiler checks the draft as it's edited, and marks what
// can't work at its block. Who runs the program is named above it, and, while
// the draft has changes, everyone Apply will start again (PLAN.md §11, Phase 6:
// shared Apply affects precisely the listed entities), as at the next step.
//
// Its markers show where each entity running the program is, only while the
// draft is the very program that runs, block for block (the same instructions
// from the same blocks): a changed draft could put a mark on a block that isn't
// running, so then they're hidden, and Programs Together shows the running
// revision instead.

// Debounce of saving the draft and checking it after an edit, in ms.
const SETTLE = 300;

// The icon beside the version in its bubble, for each state of the program.
const VERSION_ICON = { running: "play", changed: "pencil", pending: "pending", parked: "ready", problems: "error" };

// `host` is the panel's content; `blockly` the module src/blockly/workspace.js,
// with prepareBlockly done, and `markers` src/blockly/markers.js. `onPick(id)`
// chooses an entity whose marker was tapped.
export function openEditor(host, { blockly, markers: markerModule, programId, onPick }) {
  const library = currentLibrary();
  const doc = programDoc(library, programId);
  const { types, builds } = programContext(programId);
  const { blocks, blank } = rules();
  host.innerHTML = `<div class="code-head">
      <div class="code-line">
        <h2 class="code-title">${esc(display(doc.name))}</h2>
        <span class="code-version"></span>
      </div>
      <p class="code-who" aria-hidden="true"></p>
      <p class="code-runners vh"></p>
      <p class="code-state vh" role="status"></p>
      <p class="code-affects vh"></p>
      <p class="code-problems" role="alert"></p>
      <div class="code-actions">
        <button type="button" class="button primary" data-code="apply">${icon("check")}${esc(t("editor.apply"))}</button>
        ${iconButton("undo", t("editor.undo"), { attrs: `data-code="undo"` })}
        ${iconButton("starter", t("editor.starter"), { attrs: `data-code="starter"`, title: t("editor.starterTitle") })}
        ${blank ? iconButton("blank", t("editor.blank"), { attrs: `data-code="blank"`, title: t("editor.blankTitle") }) : ""}
        <button type="button" class="button icon history-toggle" data-code="history" aria-expanded="false" aria-controls="code-history" aria-label="${esc(t("history.open"))}" title="${esc(t("history.open"))}">${icon("history")}<span class="num history-count" aria-hidden="true"></span></button>
      </div>
      <div class="code-history" id="code-history" hidden></div>
    </div>
    <div class="code-host"></div>`;
  const $ = (sel) => host.querySelector(sel);
  const codeHost = $(".code-host");
  const history = createHistory($(".code-history"), programId);

  // The island and robot or building type the dropdowns offer choices for;
  // the blocks the play has unlocked, of those they can use.
  const context = { world: currentGame().world, type: types.length === 1 ? types[0] : null, builds };
  const toolbox = toolboxFor(types, { builds, blocks });
  const editor = blockly.createEditor(codeHost, { treatment: DEFAULT_TREATMENT, toolbox: toolbox.contents.length ? toolbox : null, state: doc.draft, context, onChange });
  const warnings = createWarnings(editor.workspace);
  const marks = markerModule.createMarkers(codeHost, editor, blockly.Blockly, { onPick });

  let checked = null; // checkProgram's last result
  let timer = 0;
  let shown = { world: null, snapshot: null, selected: null };

  // Saves the draft, checks it, and says what that means.
  function settle() {
    clearTimeout(timer);
    timer = 0;
    setDraft(library, programId, editor.save());
    check();
    libraryChanged();
  }
  function onChange(e) {
    if (e.isUiEvent) return;
    clearTimeout(timer);
    timer = setTimeout(settle, SETTLE);
  }
  function check() {
    checked = checkProgram(programId);
    const general = warnings.show([...checked.errors, ...checked.warnings]);
    $(".code-problems").textContent = general.join(" ");
    showState();
  }

  // Whether the draft is the program the world runs, block for block.
  function runsAsDrawn(world) {
    const running = programOf(world, programId);
    return !!(checked?.program && running && JSON.stringify(checked.program.code) === JSON.stringify(running.code));
  }

  function showState() {
    const world = currentGame().world;
    const running = programOf(world, programId)?.revision ?? latest(doc).revision;
    const newest = latest(doc).revision;
    const changed = isChanged(doc);
    // Everyone who has it has it parked: it hasn't started (runtime.js).
    const { runners } = programContext(programId);
    const parked = runners.length > 0 && runners.every((e) => e.runtime.parked);
    const names = formatList(runners.map((e) => display(e.name)));
    const affects = changed && runners.length && !checked?.errors.length;
    // Who runs it, by mark and name; once the draft has changes, marked as
    // those Apply starts again. The sentences are for screen readers.
    draw(
      ".code-who",
      runners.length
        ? (affects ? icon("restart", 16) : "") + runners.map((e) => `<span class="who">${identityMark(currentGame().world, e.id)}${esc(display(e.name))}</span>`).join("")
        : esc(t("editor.noRunners")),
    );
    $(".code-who").classList.toggle("affects", !!affects);
    draw(".code-runners", esc(runners.length ? t("editor.runners", { names }) : t("editor.noRunners")));
    draw(".code-affects", affects ? esc(t("editor.affects", { names })) : "");
    // A program the world doesn't have yet, such as a copy given a moment ago,
    // arrives with the next step.
    const arriving = !programOf(world, programId) && runners.length > 0;
    let state;
    let mark; // [the version's look, the version in its bubble]
    if (checked?.errors.length) [state, mark] = [t("editor.problems"), ["problems", running]];
    else if (changed) [state, mark] = [parked ? t("editor.parkedChanged") : t("editor.changed", { revision: running }), ["changed", running]];
    else if (newest > running || arriving) [state, mark] = [t("editor.pending", { revision: newest }), ["pending", newest]];
    else [state, mark] = [parked ? t("editor.parked") : t("editor.running", { revision: running }), [parked ? "parked" : "running", running]];
    $(".code-state").textContent = state;
    // The version as a number in a bubble, its look saying what the sentence
    // says: running, changed, waiting for the next step, not started, or wrong.
    const version = $(".code-version");
    version.title = state;
    version.dataset.state = mark[0];
    draw(".code-version", `${icon(VERSION_ICON[mark[0]], 14)}${esc(String(mark[1]))}`);
    $('[data-code="apply"]').disabled = !changed || !!checked?.errors.length;
    $('[data-code="undo"]').disabled = !changed;
    $('[data-code="starter"]').disabled = sameBlocks(doc.draft, doc.starter);
    $(".history-count").textContent = String(doc.published.length);
    $('[data-code="history"]').setAttribute("aria-expanded", String(history.open));
    history.show(programOf(world, programId)?.revision ?? null);
    showMarks();
  }

  // Sets the markup of `sel` in the head, if it's new.
  const drawn = new Map();
  function draw(sel, markup) {
    if (drawn.get(sel) === markup) return;
    drawn.set(sel, markup);
    $(sel).innerHTML = markup;
  }

  // The markers and readings of the snapshot last shown.
  function showMarks() {
    const { world, snapshot, selected } = shown;
    if (!snapshot || !runsAsDrawn(world)) marks.show([]);
    else {
      const { list, readings } = marksFor(world, snapshot, programId, selected);
      marks.show(list, readings);
    }
  }

  function load(json) {
    editor.load(json);
    warnings.reset();
    settle();
  }

  host.addEventListener("click", onClick);
  function onClick(e) {
    const version = e.target.closest("[data-version]")?.dataset.version;
    const act = e.target.closest("[data-code]")?.dataset.code;
    if (!act && !version) return;
    if (timer) settle();
    if (version) {
      // A version from the history into the draft: in the editor, not running.
      if (history.pick(version)) load(doc.draft);
    } else if (act === "history") {
      history.toggle();
      showState();
    } else if (act === "apply") {
      applyProgram(programId);
      showState();
    } else if (act === "undo" || act === "starter") {
      resetDraft(library, programId, act === "starter" ? "starter" : "applied");
      load(doc.draft);
    } else if (act === "blank" && showProgram(programId, "blank")) load(doc.draft);
  }

  check();

  return {
    programId,
    editor,
    // Draws `world` as of `snapshot`, with `selected` chosen: the state, and the
    // markers when they can be trusted.
    show(world, snapshot, selected) {
      context.world = world;
      shown = { world, snapshot, selected };
      showState();
    },
    markerRects: () => marks.rects(),
    badges: () => marks.badges(),
    // Saves the draft now, rather than when its timer would have.
    flush() {
      if (timer) settle();
    },
    dispose() {
      if (timer) settle();
      host.removeEventListener("click", onClick);
      marks.dispose();
      editor.dispose();
      host.innerHTML = "";
    },
  };
}
