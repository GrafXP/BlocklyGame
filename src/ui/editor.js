import { display, formatList, t } from "../i18n/index.js";
import { DEFAULT_TREATMENT } from "../blockly/treatments.js";
import { toolboxFor } from "../blockly/toolboxes.js";
import { isChanged, latest, programDoc, resetDraft, sameBlocks, setDraft } from "../programming/programs.js";
import { programOf } from "../programming/runtime.js";
import { esc } from "./dom.js";
import { identityMark } from "./inspector.js";
import { marksFor } from "./marks.js";
import { createWarnings } from "./problems.js";
import { createProgramChoice } from "./program-choice.js";
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
// Opened for a robot or building, from its Edit program button, the editor's
// head starts with that one's program to choose: another of those it can run,
// or a new one (program-choice.js).
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

// `host` is the panel's content; `blockly` the module src/blockly/workspace.js,
// with prepareBlockly done, and `markers` src/blockly/markers.js. `entity` is
// the robot or building it was opened for, whose program can be chosen at its
// head, or null. `onPick(id)` chooses an entity whose marker was tapped.
export function openEditor(host, { blockly, markers: markerModule, programId, entity = null, onPick }) {
  const library = currentLibrary();
  const doc = programDoc(library, programId);
  const { types, builds } = programContext(programId);
  const { blocks, blank } = rules();
  host.innerHTML = `<div class="code-head">
      ${entity ? `<div class="code-choice"></div>` : ""}
      <h2 class="code-title">${esc(display(doc.name))}</h2>
      <p class="code-runners"></p>
      <p class="code-state" role="status"></p>
      <p class="code-affects"></p>
      <p class="code-problems" role="alert"></p>
      <div class="code-actions">
        <button class="button small primary" data-code="apply">${esc(t("editor.apply"))}</button>
        <button class="button small" data-code="undo">${esc(t("editor.undo"))}</button>
        <button class="button small" data-code="starter" title="${esc(t("editor.starterTitle"))}">${esc(t("editor.starter"))}</button>
        ${blank ? `<button class="button small" data-code="blank" title="${esc(t("editor.blankTitle"))}">${esc(t("editor.blank"))}</button>` : ""}
      </div>
    </div>
    <div class="code-host"></div>`;
  const $ = (sel) => host.querySelector(sel);
  const codeHost = $(".code-host");
  const choice = entity ? createProgramChoice($(".code-choice"), entity) : null;

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
    const marks = runners.map((e) => identityMark(currentGame().world, e.id)).join("");
    draw(".code-runners", runners.length ? `${marks}${esc(t("editor.runners", { names }))}` : esc(t("editor.noRunners")));
    draw(".code-affects", changed && runners.length && !checked?.errors.length ? `${marks}${esc(t("editor.affects", { names }))}` : "");
    // A program the world doesn't have yet, such as a copy given a moment ago,
    // arrives with the next step.
    const arriving = !programOf(world, programId) && runners.length > 0;
    let state;
    if (checked?.errors.length) state = t("editor.problems");
    else if (changed) state = parked ? t("editor.parkedChanged") : t("editor.changed", { revision: running });
    else if (newest > running || arriving) state = t("editor.pending", { revision: newest });
    else state = parked ? t("editor.parked") : t("editor.running", { revision: running });
    $(".code-state").textContent = state;
    $('[data-code="apply"]').disabled = !changed || !!checked?.errors.length;
    $('[data-code="undo"]').disabled = !changed;
    $('[data-code="starter"]').disabled = sameBlocks(doc.draft, doc.starter);
    choice?.show();
    showMarks();
  }

  // Sets the markup of `sel` in the head, if it's new.
  function draw(sel, markup) {
    const el = $(sel);
    if (el.innerHTML !== markup) el.innerHTML = markup;
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
  host.addEventListener("change", onChoice);
  function onChoice(e) {
    choice?.handle(e);
  }
  function onClick(e) {
    if (choice?.handle(e)) return;
    const act = e.target.closest("[data-code]")?.dataset.code;
    if (!act) return;
    if (timer) settle();
    if (act === "apply") {
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
      host.removeEventListener("change", onChoice);
      marks.dispose();
      editor.dispose();
      host.innerHTML = "";
    },
  };
}
