import { display, formatList, t } from "../i18n/index.js";
import { DEFAULT_TREATMENT } from "../blockly/treatments.js";
import { sourceAt } from "../programming/programs.js";
import { esc } from "./dom.js";
import { identityMark } from "./inspector.js";
import { marksFor } from "./marks.js";
import { currentLibrary, programName } from "./session.js";

// Programs Together (PLAN.md §8): every program something runs, side by side,
// each as the blocks of the revision the world runs, never a draft, with a
// marker for each robot or building running it at its active block. Robots
// sharing a program each have their own marker, at the same block or at
// different ones. All of them move together with each Step, drawn from one
// tick's snapshot (snapshot.js).
//
// Each program is a read-only Blockly workspace as tall as its blocks. A
// workspace is only made while its panel is on screen or near it, and let go
// when it's scrolled well away, so a long list costs only what's in view
// (PLAN.md §13); the panel's heading and the overview's rows are always there.

const SCALE = 0.7; // smaller than the editor's, to show more at once
const PAD = 10; // px round the blocks
const NEAR = "300px"; // how near the view a panel has its workspace

export function createTogether(host, { blockly, markers: markerModule, onPick }) {
  host.innerHTML = `<div class="together-head"><h2>${esc(t("together.title"))}</h2></div><div class="together-list"></div><p class="together-empty" hidden>${esc(t("together.empty"))}</p>`;
  const list = host.querySelector(".together-list");
  const panels = new Map(); // program id → { el, revision, view?: { editor, marks } }
  let shown = { world: null, snapshot: null, selected: null };

  const observer = new IntersectionObserver(
    (seen) => {
      for (const { target, isIntersecting } of seen) {
        const panel = panels.get(target.dataset.program);
        if (!panel) continue;
        if (isIntersecting && !panel.view) mount(panel);
        else if (!isIntersecting && panel.view) unmount(panel);
      }
    },
    { root: list, rootMargin: NEAR },
  );

  // A workspace for `panel`, showing the revision it's for.
  function mount(panel) {
    const holder = panel.el.querySelector(".together-blocks");
    const editor = blockly.createEditor(holder, { treatment: DEFAULT_TREATMENT, state: sourceAt(currentLibrary(), panel.id, panel.revision), readOnly: true, scale: SCALE });
    const box = editor.contentBox();
    holder.style.height = `${Math.ceil(box.height + 2 * PAD)}px`;
    editor.showTopLeft(PAD);
    const marks = markerModule.createMarkers(holder, editor, blockly.Blockly, { onPick });
    panel.view = { editor, marks };
    draw(panel);
  }
  function unmount(panel) {
    panel.view.marks.dispose();
    panel.view.editor.dispose();
    panel.view = null;
  }

  function draw(panel) {
    const { world, snapshot, selected } = shown;
    if (!panel.view || !snapshot) return;
    const { list: marked, readings } = marksFor(world, snapshot, panel.id, selected);
    panel.view.marks.show(marked, readings);
  }

  function headHtml(world, program) {
    const names = program.runners.map((id) => display(world.entities.find((e) => e.id === id).name));
    return (
      `<h3>${esc(display(programName(program.id)))} <span class="together-version">${esc(t("together.version", { revision: program.revision }))}</span></h3>` +
      `<p class="together-runners">${program.runners.map((id) => identityMark(world, id)).join("")}${esc(t("editor.runners", { names: formatList(names) }))}</p>` +
      (program.newest > program.revision ? `<p class="row-pending">${esc(t("overview.pending", { revision: program.newest }))}</p>` : "")
    );
  }

  return {
    // Shows `world` as of `snapshot`, with `selected` chosen: a panel for each
    // program running, at the revision it runs, and everyone's markers.
    show(world, snapshot, selected) {
      shown = { world, snapshot, selected };
      const programs = snapshot.programs;
      host.querySelector(".together-empty").hidden = programs.length > 0;
      // Panels for programs no longer running go; a program's new revision
      // gets a new workspace.
      for (const [id, panel] of panels) {
        const now = programs.find((p) => p.id === id);
        if (now && now.revision === panel.revision) continue;
        observer.unobserve(panel.el);
        if (panel.view) unmount(panel);
        panel.el.remove();
        panels.delete(id);
      }
      programs.forEach((program, i) => {
        let panel = panels.get(program.id);
        if (!panel) {
          const el = document.createElement("section");
          el.className = "together-panel";
          el.dataset.program = program.id;
          el.innerHTML = `<header class="together-panel-head"></header><div class="together-blocks"></div>`;
          panel = { id: program.id, el, revision: program.revision, view: null, head: "" };
          panels.set(program.id, panel);
          observer.observe(el);
        }
        if (list.children[i] !== panel.el) list.insertBefore(panel.el, list.children[i] ?? null);
        const head = headHtml(world, program);
        if (panel.head !== head) {
          panel.el.querySelector(".together-panel-head").innerHTML = head;
          panel.head = head;
        }
        draw(panel);
      });
    },
    // For tests: each mounted panel's markers and badges.
    markerRects: () => [...panels.values()].flatMap((p) => (p.view ? p.view.marks.rects().map((r) => ({ ...r, program: p.id })) : [])),
    badges: () => [...panels.values()].flatMap((p) => (p.view ? p.view.marks.badges().map((b) => ({ ...b, program: p.id })) : [])),
    panels: () => [...panels.values()].map((p) => ({ program: p.id, revision: p.revision, mounted: !!p.view })),
    dispose() {
      observer.disconnect();
      for (const panel of panels.values()) if (panel.view) unmount(panel);
      panels.clear();
      host.innerHTML = "";
    },
  };
}
