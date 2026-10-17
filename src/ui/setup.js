import { display, formatList, t } from "../i18n/index.js";
import { ITEMS, SETTINGS } from "../sim/entities.js";
import { NAME_LENGTH } from "../sim/commands.js";
import { esc } from "./dom.js";
import { picture } from "./pictures.js";
import { COMMANDS, choose, nameRobot, peekWorld, preview, programName, setSetting } from "./session.js";

// The chosen robot's team, name and settings, in its row of the overview
// (PLAN.md §5, §11 Phase 6): a team shares its program, and the settings are
// what “my source”, “my item” and “my destination” read. In the sandbox, a
// building's or deposit's supplies too. A robot or building's program is
// chosen in the editor, opened from its Edit program button
// (program-choice.js).
//
// A change of team is shown before it's made: every robot it starts again,
// with the program each will run (preview()), then OK makes it, at the next
// step. Settings and names are made at once, at the next step too, since they
// start nothing again.
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

export function createSetup() {
  let asked = null; // { entity, commands, text, choice }: a change of team waiting for OK
  let renaming = null; // the id of the robot being named

  function ask(entity, commands, extra = {}) {
    asked = { entity, commands, text: changeWords(commands), ...extra };
  }

  // The markup of thing `id`'s setup, or "" when there's nothing to set.
  // `tools` are which of "library", "settings" and "stock" (the sandbox's
  // supplies) the play offers (session.js); `now` is the world as it is, to
  // tell what changes at the next step.
  function html(id, tools, now) {
    const world = peekWorld();
    const e = world.entities.find((it) => it.id === id);
    const node = world.nodes.find((it) => it.id === id);
    const parts = [];
    const library = tools.includes("library");
    if (e && library && isRobot(e)) parts.push(teamHtml(world, e, now?.entities.find((it) => it.id === id)), nameHtml(e));
    if (e && tools.includes("settings") && isRobot(e)) parts.push(settingsHtml(e, now?.entities.find((it) => it.id === id)));
    if (tools.includes("stock") && (e ?? node)?.store.caps) parts.push(stockHtml(e ?? node));
    if (asked?.entity === id && asked.text) {
      parts.push(
        `<div class="setup-preview" role="status"><p>${esc(asked.text)}</p>` +
          `<button class="button small primary" data-setup="ok">${esc(t("setup.ok"))}</button> ` +
          `<button class="button small" data-setup="cancel">${esc(t("setup.cancel"))}</button></div>`,
      );
    }
    return parts.length ? `<div class="setup" data-entity="${esc(id)}">${parts.join("")}</div>` : "";
  }

  // Robot `e`'s team, `before` as the world has it now.
  function teamHtml(world, e, before) {
    const wanted = asked?.entity === e.id && asked.choice?.kind === "team" ? asked.choice.value : (e.role ?? "");
    const options = [["", t("setup.noTeam")], ...world.roles.map((r) => [r.id, display(r.name)])].map(
      ([value, words]) => `<option value="${esc(value)}"${value === wanted ? " selected" : ""}>${esc(words)}</option>`,
    );
    const pending = before && before.role !== e.role ? `<p class="setup-note pending">${esc(t("settings.pending"))}</p>` : "";
    return `<div class="setup-field"><label for="setup-team">${esc(t("setup.team"))}</label><select id="setup-team" data-setup="team">${options.join("")}</select></div>${pending}`;
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

  // A building's or deposit's supplies, one more or one fewer of each item it
  // keeps, in the sandbox; the island page handles the buttons (island.js).
  function stockHtml(thing) {
    const rows = ITEMS.filter((item) => thing.store.caps[item]).map((item) => {
      const n = thing.store.items[item] ?? 0;
      const name = t(`item.${item}`);
      const button = (act, sign, off) =>
        `<button class="button small icon" data-sandbox="${act}" data-at="${esc(thing.id)}" data-item="${item}" aria-label="${esc(t(`sandbox.${act}`, { item: name }))}"${off ? " disabled" : ""}>${sign}</button>`;
      return `<div class="setup-field stock-field">${picture(item, { size: 20 })}<span>${esc(t("inspector.of", { have: n, cap: thing.store.caps[item] }))}</span>${button("less", "−", n === 0)}${button("more", "+", n >= thing.store.caps[item])}</div>`;
    });
    return `<fieldset class="settings"><legend>${esc(t("sandbox.stock"))}</legend>${rows.join("")}</fieldset>`;
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
      if (act === "rename") renaming = id;
      else if (act === "cancel-name") renaming = null;
      else if (act === "cancel") asked = null;
      else if (act === "ok" && asked) {
        choose(asked.commands);
        asked = null;
      } else return false;
      return true;
    },
  };
}
