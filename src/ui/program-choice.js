import { display, t } from "../i18n/index.js";
import { esc } from "./dom.js";
import { identityMark } from "./inspector.js";
import { COMMANDS, canRunProgram, choose, currentGame, currentLibrary, makeOwnCopy, newProgramFor, peekWorld, programName, sharedProgram } from "./session.js";
import { changeWords } from "./setup.js";

// The program of the robot or building the editor was opened for (PLAN.md §5,
// §11 Phase 6), at the editor's head (editor.js): chosen from the programs it
// can run, or a new one; where it comes from (its own, its team's, its
// kind's); its own copy of a shared program, and back to the shared one. A
// change is shown before it's made, as the library's Give to… shows it
// (changeWords); OK makes it, at the next step, and the editor goes over to
// the program the robot or building runs then (island.js).
//
// It shows the world as it will be at the next step (session.js, peekWorld),
// and is drawn again only when what it shows changes, so its dropdown stays put
// while the world runs.

// The choice of a new program, which no program's id can be.
const NEW = "+new";
const isRobot = (e) => e.kind === "robot";
const programIn = (e) => (e?.runtime?.kind === "program" ? e.runtime.program : null);

// The choice of robot or building `entityId`'s program, drawn in `el`.
export function createProgramChoice(el, entityId) {
  let asked = null; // { value, text, commands? }: a change waiting for OK; value is a program, NEW, or "copy"
  let drawn = "";

  // A preview's words: whom choice `value` starts again.
  function previewText(e, value) {
    const basket = isRobot(e) ? ` ${t("preview.basket")}` : "";
    if (value === NEW) return t("preview.new", { name: display(e.name) }) + basket;
    if (value === "copy") return t("preview.copy", { name: display(e.name), program: display(programName(programIn(e))) }) + basket;
    return changeWords(commandsFor(e, value));
  }
  // The commands that give `e` program `value`; its shared one is going back
  // to it.
  const commandsFor = (e, value) => COMMANDS.give(e.id, value && value === sharedProgram(e) ? null : value);

  function markup() {
    const world = peekWorld();
    const e = world.entities.find((it) => it.id === entityId);
    if (!e) return "";
    const running = programIn(e);
    const before = currentGame().world.entities.find((it) => it.id === entityId);
    const pending = !!before && programIn(before) !== running;
    const wanted = asked && asked.value !== "copy" ? asked.value : (running ?? "");
    const choices = currentLibrary()
      .programs.filter((doc) => (!doc.archived && canRunProgram(e.id, doc.id)) || doc.id === running)
      .map((doc) => [doc.id, display(doc.name)]);
    if (!running) choices.unshift(["", t("setup.noProgram")]);
    choices.push([NEW, t("editor.newProgram")]);
    const options = choices.map(([value, words]) => `<option value="${esc(value)}"${value === wanted ? " selected" : ""}>${esc(words)}</option>`);
    const team = isRobot(e) && e.role ? world.roles.find((r) => r.id === e.role) : null;
    const from = !running ? "" : e.own ? t("setup.own") : team?.program === running ? t("setup.fromTeam", { team: display(team.name) }) : t("setup.fromType");
    const shared = running && world.entities.some((it) => it.id !== e.id && programIn(it) === running);
    const buttons = [];
    // A copy of a program only it runs would change nothing.
    if (running && !(e.own && !shared)) buttons.push(`<button class="button small" data-choice="copy">${esc(t("setup.copy"))}</button>`);
    if (e.own && sharedProgram(e) && sharedProgram(e) !== e.own) buttons.push(`<button class="button small" data-choice="back">${esc(t("setup.back"))}</button>`);
    return (
      `<div class="setup-field"><label for="code-program">${identityMark(world, e.id)}${esc(t("editor.for", { name: display(e.name) }))}</label>` +
      `<select id="code-program" data-choice="program">${options.join("")}</select></div>` +
      (from ? `<p class="setup-note">${esc(from)}</p>` : "") +
      (pending ? `<p class="setup-note pending">${esc(t("settings.pending"))}</p>` : "") +
      (buttons.length ? `<div class="setup-buttons">${buttons.join("")}</div>` : "") +
      (asked?.text
        ? `<div class="setup-preview" role="status"><p>${esc(asked.text)}</p>` +
          `<button class="button small primary" data-choice="ok">${esc(t("setup.ok"))}</button> ` +
          `<button class="button small" data-choice="cancel">${esc(t("setup.cancel"))}</button></div>`
        : "")
    );
  }

  function show() {
    const html = markup();
    if (html === drawn) return;
    el.innerHTML = html;
    drawn = html;
  }

  // Asks about choice `value` for `e`, or forgets the question when it's what
  // `e` runs already.
  function ask(e, value) {
    if (value !== "copy" && value === (programIn(e) ?? "")) asked = null;
    else asked = { value, text: previewText(e, value), commands: value === NEW || value === "copy" ? null : commandsFor(e, value || null) };
  }

  return {
    show,
    // Handles a change or a click in the choice. Returns whether it was the
    // choice's.
    handle(event) {
      const act = event.target.closest?.("[data-choice]")?.dataset.choice;
      if (!act || !el.contains(event.target)) return false;
      const e = peekWorld().entities.find((it) => it.id === entityId);
      if (!e) return false;
      if (event.type === "change" && act === "program") ask(e, event.target.value);
      else if (event.type !== "click" || act === "program") return false;
      else if (act === "copy") ask(e, "copy");
      else if (act === "back") ask(e, sharedProgram(e));
      else if (act === "cancel") asked = null;
      else if (act === "ok" && asked) {
        if (asked.value === NEW) newProgramFor(entityId);
        else if (asked.value === "copy") makeOwnCopy(entityId);
        else choose(asked.commands);
        asked = null;
      }
      show();
      return true;
    },
  };
}
