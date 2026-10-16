import { display, formatList, t } from "../i18n/index.js";
import { esc } from "./dom.js";
import { identityMark } from "./inspector.js";
import { COMMANDS, canRunProgram, choose, createProgram, currentLibrary, duplicateProgram, libraryChanged, nameProgram, peekWorld, programUse, putAway } from "./session.js";
import { changeWords } from "./setup.js";

// The program library (PLAN.md §5, §11 Phase 6), in the panel on the left:
// every program, its version, who runs it, and whose shared program it is (a
// team's, or every building of a kind's). From here a program can be edited,
// given to a team, to every building of a kind or to one robot or building,
// copied, renamed, put away when nothing runs it, and brought back; and a new
// one made. Giving a program shows first whom it starts again, every one by
// name, as the inspector's choices do (setup.js); OK makes it, at the next step.
//
// It shows the world as it will be at the next step (session.js, peekWorld),
// and is drawn again only when the library, who runs what, or what's open in
// it changes, so its controls hold still while the world runs.

export function createLibraryPanel(host, { onEdit }) {
  host.innerHTML = `<div class="library-head"><h2>${esc(t("library.title"))}</h2>
      <button class="button small primary" data-lib="new">${esc(t("library.new"))}</button></div>
    <div class="library-list"></div>`;
  const list = host.querySelector(".library-list");
  let giving = null; // { program, target, text }: a Give to… open
  let renaming = null; // the id of the program being named
  let drawn = "";

  // Whom program `id` can be given to: each team, each kind of building there
  // is, and each robot or building, as [value, words].
  function targets(world, id) {
    const robots = world.entities.filter((e) => e.kind === "robot");
    const out = [];
    if (robots.some((e) => canRunProgram(e.id, id))) for (const r of world.roles) out.push([`role:${r.id}`, t("library.giveTeam", { team: display(r.name) })]);
    const types = [...new Set(world.entities.filter((e) => e.kind === "building").map((e) => e.type))].sort();
    for (const type of types) {
      const one = world.entities.find((e) => e.type === type);
      if (canRunProgram(one.id, id)) out.push([`type:${type}`, t("library.giveType", { type: typeName(type) })]);
    }
    for (const e of world.entities) if (canRunProgram(e.id, id)) out.push([`one:${e.id}`, t("library.giveOne", { name: display(e.name) })]);
    return out;
  }
  const typeName = (type) => t(`entity.${type}`);

  const commandsFor = (program, target) => {
    const [kind, id] = target.split(":");
    if (kind === "role") return COMMANDS.shared({ role: id }, program);
    if (kind === "type") return COMMANDS.shared({ entityType: id }, program);
    return COMMANDS.give(id, program);
  };

  function programHtml(world, doc) {
    const use = programUse(doc.id);
    const running = world.programs.find((p) => p.id === doc.id);
    const revision = running?.revision ?? doc.published.at(-1).revision;
    const names = use.runners.map((id) => world.entities.find((e) => e.id === id));
    const runners = names.length
      ? `<p class="lib-runners">${names.map((e) => identityMark(world, e.id)).join("")}${esc(t("editor.runners", { names: formatList(names.map((e) => display(e.name))) }))}</p>`
      : `<p class="lib-runners">${esc(t("library.unused"))}</p>`;
    const shared = [
      ...use.roles.map((id) => t("library.forTeam", { team: display(world.roles.find((r) => r.id === id).name) })),
      ...use.types.map((type) => t("library.forType", { type: typeName(type) })),
    ].map((words) => `<p class="lib-for">${esc(words)}</p>`);
    const unused = !use.runners.length && !use.roles.length && !use.types.length;
    const title =
      renaming === doc.id
        ? `<form class="lib-rename" data-lib="name" data-program="${esc(doc.id)}"><label for="lib-name">${esc(t("library.name"))}</label>` +
          `<input id="lib-name" name="name" maxlength="40" value="${esc(display(doc.name))}" autocomplete="off">` +
          `<button class="button small primary" type="submit">${esc(t("library.ok"))}</button> <button class="button small" type="button" data-lib="cancel-name">${esc(t("library.cancel"))}</button></form>`
        : `<h3><span class="lib-name">${esc(display(doc.name))}</span> <span class="together-version">${esc(t("together.version", { revision }))}</span></h3>`;
    let give = "";
    if (giving?.program === doc.id) {
      const options = targets(world, doc.id).map(([value, words]) => `<option value="${esc(value)}"${value === giving.target ? " selected" : ""}>${esc(words)}</option>`);
      give =
        `<div class="lib-give"><label for="lib-target">${esc(t("library.giveTo", { program: display(doc.name) }))}</label>` +
        `<select id="lib-target" data-lib="target">${options.join("")}</select>` +
        (giving.text ? `<p class="setup-preview-text" role="status">${esc(giving.text)}</p>` : "") +
        `<button class="button small primary" data-lib="give-ok">${esc(t("library.ok"))}</button> <button class="button small" data-lib="give-cancel">${esc(t("library.cancel"))}</button></div>`;
    }
    return (
      `<li class="lib-program" data-program="${esc(doc.id)}">${title}${runners}${shared.join("")}` +
      `<div class="lib-actions">` +
      `<button class="button small" data-lib="edit">${esc(t("library.edit"))}</button>` +
      `<button class="button small" data-lib="give" aria-expanded="${giving?.program === doc.id}">${esc(t("library.give"))}</button>` +
      `<button class="button small" data-lib="duplicate">${esc(t("library.duplicate"))}</button>` +
      `<button class="button small" data-lib="rename">${esc(t("library.rename"))}</button>` +
      `<button class="button small" data-lib="archive"${unused ? "" : ` disabled title="${esc(t("library.archiveTitle"))}"`}>${esc(t("library.archive"))}</button>` +
      `</div>${give}</li>`
    );
  }

  function draw() {
    const world = peekWorld();
    const docs = currentLibrary().programs;
    const kept = docs.filter((d) => !d.archived);
    const away = docs.filter((d) => d.archived);
    const html =
      `<ul class="lib-programs">${kept.map((doc) => programHtml(world, doc)).join("")}</ul>` +
      (away.length
        ? `<details class="lib-archived"${list.querySelector(".lib-archived")?.open ? " open" : ""}><summary>${esc(t("library.archived", { count: away.length }))}</summary><ul>` +
          away.map((doc) => `<li data-program="${esc(doc.id)}"><span>${esc(display(doc.name))}</span> <button class="button small" data-lib="restore">${esc(t("library.restore"))}</button></li>`).join("") +
          `</ul></details>`
        : "");
    if (html === drawn) return;
    list.innerHTML = html;
    drawn = html;
    list.querySelector("#lib-name")?.focus();
  }

  function openGive(program) {
    const world = peekWorld();
    const [first] = targets(world, program);
    giving = { program, target: first?.[0] ?? null, text: first ? changeWords(commandsFor(program, first[0])) : null };
  }

  function onEvent(e) {
    const el = e.target.closest("[data-lib]");
    if (!el) return;
    const act = el.dataset.lib;
    const program = el.closest("[data-program]")?.dataset.program;
    if (e.type === "change" && act === "target") {
      giving = { program, target: el.value, text: changeWords(commandsFor(program, el.value)) };
    } else if (e.type === "submit" && act === "name") {
      e.preventDefault();
      nameProgram(program, new FormData(el).get("name"));
      renaming = null;
    } else if (e.type !== "click") return;
    else if (act === "new") onEdit(createProgram());
    else if (act === "edit") onEdit(program);
    else if (act === "give") giving?.program === program ? (giving = null) : openGive(program);
    else if (act === "give-cancel") giving = null;
    else if (act === "give-ok" && giving?.target) {
      choose(commandsFor(giving.program, giving.target));
      giving = null;
    } else if (act === "duplicate") duplicateProgram(program);
    else if (act === "rename") renaming = program;
    else if (act === "cancel-name") renaming = null;
    else if (act === "archive") putAway(program, true);
    else if (act === "restore") putAway(program, false);
    else return;
    libraryChanged();
    draw();
  }
  for (const type of ["click", "change", "submit"]) host.addEventListener(type, onEvent);

  draw();
  return {
    // The world moved on, or the library changed: draw again if what's shown
    // has changed. An open Give to… keeps its choice and words its preview
    // again, as who runs what may have changed.
    show() {
      if (giving) giving.text = giving.target ? changeWords(commandsFor(giving.program, giving.target)) : null;
      draw();
    },
    // For tests: each program's id, name, runners and shared uses, as shown.
    programs: () => currentLibrary().programs.map((doc) => ({ id: doc.id, name: display(doc.name), archived: !!doc.archived, ...programUse(doc.id) })),
    dispose() {
      for (const type of ["click", "change", "submit"]) host.removeEventListener(type, onEvent);
      host.innerHTML = "";
    },
  };
}
