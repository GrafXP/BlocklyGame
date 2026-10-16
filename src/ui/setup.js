import { display, formatList, t } from "../i18n/index.js";
import { ITEMS, SETTINGS } from "../sim/entities.js";
import { NAME_LENGTH } from "../sim/commands.js";
import { esc } from "./dom.js";
import { identityMark } from "./inspector.js";
import { picture } from "./pictures.js";
import {
  COMMANDS,
  canRunProgram,
  choose,
  currentLibrary,
  makeOwnCopy,
  nameRobot,
  peekWorld,
  preview,
  programName,
  setSetting,
  sharedProgram,
} from "./session.js";

// Who runs what, in the chosen robot or building's row of the overview (PLAN.md
// §5, §11 Phase 6): its program, chosen from those it can run, and where that
// comes from (its own, its team's, its kind's); a robot's team; its own copy of
// a shared program, and back to the shared one; a robot's name; and a robot's
// settings, which “my source”, “my item” and “my destination” read.
//
// A change of program or team is shown before it's made: every robot and
// building it starts again, with the program each will run (preview()), then
// OK makes it, at the next step. Settings and names are made at once, at the
// next step too, since they start nothing again.
//
// It shows the world as it will be at the next step (session.js, peekWorld), so
// a choice made while paused shows at once. It's drawn again only when what it
// shows changes, so its dropdowns stay put while the world runs.

const isRobot = (e) => e.kind === "robot";

// What `commands` would do at the next step, in words: everyone it starts again
// on another program, by program, or stops; or that nobody changes. Null when
// a command wouldn't fit.
export function changeWords(commands) {
  const world = peekWorld();
  const { ok, changed } = preview(commands);
  if (!ok) return null;
  if (!changed.length) return t("preview.nobody");
  const names = (ids) => formatList(ids.map((id) => display(world.entities.find((e) => e.id === id).name)));
  const groups = new Map();
  for (const { id, program } of changed) groups.set(program, [...(groups.get(program) ?? []), id]);
  const lines = [...groups].map(([program, ids]) =>
    program ? t("preview.program", { names: names(ids), program: display(programName(program) ?? program), count: ids.length }) : t("preview.stop", { names: names(ids), count: ids.length }),
  );
  if (changed.some(({ id }) => isRobot(world.entities.find((e) => e.id === id)))) lines.push(t("preview.basket"));
  return lines.join(" ");
}

// `onOpenProgram(id)` opens program `id` in the editor, as a robot's own copy
// is once it's made.
export function createSetup({ onOpenProgram }) {
  let asked = null; // { entity, commands, text, choice?, copy? }: a change waiting for OK
  let renaming = null; // the id of the robot being named

  // A preview's words: who starts what; or, for a copy, whose it is.
  function previewText(commands, { copy = null } = {}) {
    if (!copy) return changeWords(commands);
    const e = peekWorld().entities.find((it) => it.id === copy);
    const words = t("preview.copy", { name: display(e.name), program: display(programName(e.runtime.program)) });
    return isRobot(e) ? `${words} ${t("preview.basket")}` : words;
  }

  function ask(entity, commands, extra = {}) {
    asked = { entity, commands, text: previewText(commands, extra), ...extra };
  }

  // The markup of entity `id`'s setup, or "" when there's nothing to set.
  // `tools` are which of "library" and "settings" the play offers (session.js);
  // `now` is the world as it is, to tell what changes at the next step.
  function html(id, tools, now) {
    const world = peekWorld();
    const e = world.entities.find((it) => it.id === id);
    if (!e) return "";
    const parts = [];
    const library = tools.includes("library");
    if (library) parts.push(programHtml(world, e, now?.entities.find((it) => it.id === id)));
    if (library && isRobot(e)) parts.push(teamHtml(world, e), nameHtml(e));
    if (tools.includes("settings") && isRobot(e)) parts.push(settingsHtml(e, now?.entities.find((it) => it.id === id)));
    if (asked?.entity === id && asked.text) {
      parts.push(
        `<div class="setup-preview" role="status"><p>${esc(asked.text)}</p>` +
          `<button class="button small primary" data-setup="ok">${esc(t("setup.ok"))}</button> ` +
          `<button class="button small" data-setup="cancel">${esc(t("setup.cancel"))}</button></div>`,
      );
    }
    return parts.length ? `<div class="setup" data-entity="${esc(id)}">${parts.join("")}</div>` : "";
  }

  // Entity `e`'s program, team's or its own; `before` as the world has it now.
  function programHtml(world, e, before) {
    const running = e.runtime?.kind === "program" ? e.runtime.program : null;
    const pending = before && (before.runtime?.kind === "program" ? before.runtime.program : null) !== running;
    const shared = sharedProgram(e);
    const wanted = asked?.entity === e.id && asked.choice?.kind === "program" ? asked.choice.value : (running ?? "");
    const library = currentLibrary();
    const options = library.programs
      .filter((doc) => (!doc.archived && canRunProgram(e.id, doc.id)) || doc.id === running)
      .map((doc) => `<option value="${esc(doc.id)}"${doc.id === wanted ? " selected" : ""}>${esc(display(doc.name))}</option>`);
    if (!running) options.unshift(`<option value=""${wanted === "" ? " selected" : ""}>${esc(t("setup.noProgram"))}</option>`);
    const from = !running
      ? ""
      : e.own
        ? t("setup.own")
        : isRobot(e) && e.role && world.roles.find((r) => r.id === e.role)?.program === running
          ? t("setup.fromTeam", { team: display(world.roles.find((r) => r.id === e.role).name) })
          : t("setup.fromType");
    const others = running ? world.entities.filter((it) => it.id !== e.id && it.runtime?.kind === "program" && it.runtime.program === running) : [];
    const buttons = [];
    // A copy of a program only it runs would change nothing.
    if (running && !(e.own && !others.length)) buttons.push(`<button class="button small" data-setup="copy">${esc(t("setup.copy"))}</button>`);
    if (e.own && shared && shared !== e.own) buttons.push(`<button class="button small" data-setup="back">${esc(t("setup.back"))}</button>`);
    return (
      `<div class="setup-field"><label for="setup-program">${esc(t("setup.program"))}</label>` +
      `<select id="setup-program" data-setup="program">${options.join("")}</select></div>` +
      (from ? `<p class="setup-note">${esc(from)}</p>` : "") +
      (pending ? `<p class="setup-note pending">${esc(t("settings.pending"))}</p>` : "") +
      (others.length ? `<p class="setup-note">${others.map((it) => identityMark(world, it.id)).join("")}${esc(t("setup.alsoRuns", { names: formatList(others.map((it) => display(it.name))) }))}</p>` : "") +
      (buttons.length ? `<div class="setup-buttons">${buttons.join("")}</div>` : "")
    );
  }

  function teamHtml(world, e) {
    const wanted = asked?.entity === e.id && asked.choice?.kind === "team" ? asked.choice.value : (e.role ?? "");
    const options = [["", t("setup.noTeam")], ...world.roles.map((r) => [r.id, display(r.name)])].map(
      ([value, words]) => `<option value="${esc(value)}"${value === wanted ? " selected" : ""}>${esc(words)}</option>`,
    );
    return `<div class="setup-field"><label for="setup-team">${esc(t("setup.team"))}</label><select id="setup-team" data-setup="team">${options.join("")}</select></div>`;
  }

  function nameHtml(e) {
    if (renaming !== e.id) return `<div class="setup-buttons"><button class="button small" data-setup="rename">${esc(t("setup.rename"))}</button></div>`;
    return (
      `<form class="setup-rename" data-setup="name"><label for="setup-name">${esc(t("setup.name"))}</label>` +
      `<input id="setup-name" name="name" maxlength="${NAME_LENGTH}" value="${esc(display(e.name))}" autocomplete="off">` +
      `<button class="button small primary" type="submit">${esc(t("setup.ok"))}</button> <button class="button small" type="button" data-setup="cancel-name">${esc(t("setup.cancel"))}</button></form>`
    );
  }

  // A robot's settings, `before` as the world has them now.
  function settingsHtml(e, before) {
    const world = peekWorld();
    const places = [...world.entities, ...world.nodes].filter((it) => it.access?.length);
    const pending = before && Object.keys(SETTINGS).some((slot) => before.settings[slot] !== e.settings[slot]);
    const rows = Object.entries(SETTINGS).map(([slot, kind]) => {
      const value = e.settings[slot];
      const choices = kind === "item" ? ITEMS.map((item) => [item, t(`item.${item}`)]) : places.map((p) => [p.id, display(p.name)]);
      const options = [["", t("settings.none")], ...choices].map(([v, label]) => `<option value="${esc(v)}"${(value ?? "") === v ? " selected" : ""}>${esc(label)}</option>`);
      const pic = kind === "item" && value ? picture(value, { size: 20 }) : "";
      return `<div class="setup-field"><label for="setting-${slot}">${esc(t(`setting.${slot}`))}</label>${pic}<select id="setting-${slot}" data-setting="${slot}">${options.join("")}</select></div>`;
    });
    const note = pending ? `<p class="setup-note pending">${esc(t("settings.pending"))}</p>` : "";
    return `<fieldset class="settings"><legend>${esc(t("settings.title"))}</legend>${rows.join("")}${note}</fieldset>`;
  }

  return {
    html,
    // Forgets what was asked, as when another robot or building is chosen.
    reset() {
      asked = null;
      renaming = null;
    },
    // Handles a click, a change or a submit in the setup of the chosen entity
    // `id`. Returns whether it was the setup's; then it should be drawn again.
    handle(event, id) {
      const el = event.target.closest?.("[data-setup], [data-setting]");
      if (!el || !el.closest(".setup")) return false;
      const act = el.dataset.setup;
      if (event.type === "change" && el.dataset.setting) {
        setSetting(id, el.dataset.setting, el.value || null);
        return true;
      }
      if (event.type === "change" && act === "program") {
        const value = el.value || null;
        const shared = sharedProgram(peekWorld().entities.find((e) => e.id === id));
        // The shared program, chosen again, is going back to it.
        const commands = COMMANDS.give(id, value && value === shared ? null : value);
        ask(id, commands, { choice: { kind: "program", value: value ?? "" } });
        return true;
      }
      if (event.type === "change" && act === "team") {
        ask(id, COMMANDS.team(id, el.value || null), { choice: { kind: "team", value: el.value } });
        return true;
      }
      if (event.type === "submit" && act === "name") {
        event.preventDefault();
        nameRobot(id, new FormData(el).get("name"));
        renaming = null;
        return true;
      }
      if (event.type !== "click") return false;
      if (act === "copy") ask(id, [], { copy: id });
      else if (act === "back") ask(id, COMMANDS.give(id, null));
      else if (act === "rename") renaming = id;
      else if (act === "cancel-name") renaming = null;
      else if (act === "cancel") asked = null;
      else if (act === "ok" && asked) {
        if (asked.copy) {
          const program = makeOwnCopy(asked.copy);
          asked = null;
          if (program) onOpenProgram?.(program);
        } else {
          choose(asked.commands);
          asked = null;
        }
      } else return false;
      return true;
    },
  };
}
