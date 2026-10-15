import "../style/lab.css";
import "../style/editor.css";
import { display, formatNumber, t } from "../i18n/index.js";
import { createBin } from "../lifecycle.js";
import { createView } from "../render/view.js";
import { createMeter } from "../render/meter.js";
import { bindWorldInput } from "../render/input.js";
import { Blockly, createEditor, prepareBlockly } from "../blockly/workspace.js";
import { createMarkers } from "../blockly/markers.js";
import { LAB_TOOLBOX } from "../blockly/toolboxes.js";
import { TREATMENTS, surfaceAlphas } from "../blockly/treatments.js";
import { loadLocal, saveLocal } from "../storage/local.js";
import { html, isDev } from "./dom.js";
import { languageChoice } from "./language-choice.js";
import { normalizeLabSettings } from "./lab-settings.js";
import { checkLabPrograms } from "./lab-check.js";
import { createWarnings } from "./problems.js";
import { demoMarkers, demoProgram } from "./lab-demo.js";

const MIN_PANEL = 320; // px; narrower and the toolbox crowds the program out
const MIN_WORLD = 160; // px of world kept beside the editor

// What the lab hands on to itself when it's left and opened again during this
// visit, as it is when the language changes (PLAN.md §8): the program, how far
// the markers have stepped, and the camera and what it has selected. The program
// is also saved on this device.
let kept = { program: null, markerStep: 0, camera: null };

// Blockly's words in the current language, before the lab is shown (main.js).
export const ready = prepareBlockly;

// The Phase 0 editor lab (PLAN.md §11): the Blockly editor in a panel over the 3D
// world, with controls to compare its visual treatments, how see-through it is
// over a bright or dark world with a robot moving behind, blur, and sample
// execution markers. Since Phase 2 the compiler checks its programs as they're
// edited, and marks what can't work at its block. The program and the controls
// are remembered on this device.
export function lab(el) {
  const bin = createBin();
  let settings = normalizeLabSettings(loadLocal("lab"));
  let markerStep = kept.markerStep;
  let editor = null;
  let markers = null;

  const $ = html(
    el,
    `<div class="lab">
      <div class="lab-world"></div>
      <section class="editor-panel" aria-label="${t("lab.title")}">
        <div class="editor-host"></div>
        <div class="panel-handle" role="separator" aria-orientation="vertical" aria-label="${t("lab.resize")}" tabindex="0"></div>
      </section>
      <aside class="lab-controls">
        <div class="lab-bar">
          <a class="button small" href="/${location.search}" data-link>${t("nav.home")}</a>
          <strong>${t("lab.title")}</strong>
          <button class="button small lab-fold" aria-expanded="true">${t("lab.hide")}</button>
        </div>
        <div class="lab-body">
          <div class="lab-row"><span>${t("lab.treatment")}</span>
            <div class="segmented" role="group" aria-label="${t("lab.treatment")}" data-control="treatment">
              ${Object.entries(TREATMENTS).map(([name, { label }]) => `<button data-value="${name}">${display(label)}</button>`).join("")}
            </div>
          </div>
          <label class="lab-row"><span>${t("lab.transparency")}</span>
            <span class="lab-range"><input type="range" min="0" max="100" step="5" data-control="opacity" /><output data-out="opacity"></output></span>
          </label>
          <div class="lab-row"><span>${t("lab.blur")}</span>
            <div class="segmented" role="group" aria-label="${t("lab.blur")}" data-control="blur">
              <button data-value="false">${t("lab.off")}</button><button data-value="true">${t("lab.on")}</button>
            </div>
          </div>
          <div class="lab-row"><span>${t("lab.world")}</span>
            <div class="segmented" role="group" aria-label="${t("lab.world")}" data-control="world">
              <button data-value="day">${t("lab.day")}</button><button data-value="dusk">${t("lab.dusk")}</button>
            </div>
          </div>
          <div class="lab-row"><span>${t("language.choose")}</span>
            ${languageChoice({ group: "segmented language-choice" })}
          </div>
          <div class="lab-row checks">
            <label><input type="checkbox" data-control="moving" /> ${t("lab.moving")}</label>
            <label><input type="checkbox" data-control="markers" /> ${t("lab.markers")}</label>
          </div>
          <div class="lab-row buttons">
            <button class="button small" data-action="step">${t("lab.step")}</button>
            <button class="button small" data-action="roundtrip">${t("lab.roundTrip")}</button>
            <button class="button small" data-action="reset">${t("lab.reset")}</button>
          </div>
          <p class="lab-status" aria-live="polite"></p>
          <p class="lab-selected">${t("lab.nothingSelected")}</p>
          <pre class="lab-fps"></pre>
        </div>
      </aside>
    </div>`,
  );
  const panel = $(".editor-panel");
  const host = $(".editor-host");
  const status = $(".lab-status");

  // --- The world behind ---------------------------------------------------
  const view = createView($(".lab-world"), { world: settings.world, moving: settings.moving });
  bin.add(() => view.dispose());
  bindWorldInput(bin, view.canvas, view, {
    onSelect(id) {
      view.select(id);
      showSelected();
    },
  });
  const showSelected = () => {
    const name = view.nameOf(view.state.selected);
    $(".lab-selected").textContent = name ? t("lab.selected", { name: display(name) }) : t("lab.nothingSelected");
  };
  if (kept.camera) {
    view.restore(kept.camera);
    showSelected();
  }
  const meter = createMeter();
  bin.frames((now) => {
    const began = performance.now();
    view.render(now);
    meter.frame(now, performance.now() - began, view.info.render);
  });
  const fps = $(".lab-fps");
  const fpsTimer = setInterval(() => (fps.textContent = meter.text()), 500);
  bin.add(() => clearInterval(fpsTimer));

  // --- The editor over it -------------------------------------------------
  let saveTimer = 0;
  const saveProgram = () => {
    clearTimeout(saveTimer);
    kept.program = editor.save();
    saveLocal("lab-program", kept.program);
  };
  const onChange = (e) => {
    if (e.isUiEvent || !editor) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveProgram();
      check();
    }, 400);
  };

  // What the compiler finds wrong, in the player's language: at its block as
  // Blockly's warning, or, for a problem with no block, in the status line.
  let problems = [];
  let warnings = null;
  function check() {
    problems = checkLabPrograms(editor.save());
    const general = warnings.show(problems);
    if (general.length || status.dataset.problems) {
      status.textContent = general.join(" ");
      status.dataset.problems = general.length ? "1" : "";
    }
  }

  function mount(state) {
    try {
      editor = createEditor(host, { treatment: settings.treatment, toolbox: LAB_TOOLBOX, state, onChange });
    } catch (e) {
      console.warn("The saved lab program couldn't be loaded; showing the sample.", e);
      editor = createEditor(host, { treatment: settings.treatment, toolbox: LAB_TOOLBOX, state: demoProgram(), onChange });
    }
    markers = createMarkers(host, editor, Blockly);
    showMarkers();
    warnings = createWarnings(editor.workspace);
    check();
  }
  function unmount() {
    markers?.dispose();
    editor?.dispose();
    markers = editor = null;
  }
  bin.add(unmount);

  const showMarkers = () =>
    markers?.show(settings.markers ? demoMarkers(markerStep).map(({ entity, blockId }) => ({ entity: { ...entity, name: display(entity.name) }, blockId })) : []);

  // The look: the treatment's colours and the surfaces' opacities, as CSS
  // variables on <html>, since Blockly puts its dropdowns on <body>, outside the
  // panel (src/style/editor.css).
  const root = document.documentElement;
  const vars = new Set();
  function applyLook() {
    const tr = TREATMENTS[settings.treatment];
    const a = surfaceAlphas(settings.opacity);
    const set = {
      "--panel-rgb": tr.panel.rgb.join(" "),
      "--panel-ink": tr.panel.ink,
      "--panel-alpha": a.panel,
      "--toolbox-rgb": tr.toolbox.rgb.join(" "),
      "--toolbox-ink": tr.toolbox.ink,
      "--toolbox-selected-ink": tr.toolbox.selectedInk,
      "--toolbox-alpha": a.toolbox,
      "--flyout-alpha": a.flyout,
      "--block-ink": tr.blockInk,
    };
    for (const [k, v] of Object.entries(set)) {
      root.style.setProperty(k, v);
      vars.add(k);
    }
    root.dataset.treatment = settings.treatment;
    panel.dataset.blur = settings.blur;
    panel.style.width = `${settings.panelWidth * 100}vw`;
  }
  bin.add(() => {
    for (const k of vars) root.style.removeProperty(k);
    delete root.dataset.treatment;
  });

  // --- The controls -------------------------------------------------------
  function syncControls() {
    for (const group of el.querySelectorAll(".segmented[data-control]")) {
      for (const b of group.querySelectorAll("button")) b.setAttribute("aria-pressed", String(settings[group.dataset.control]) === b.dataset.value);
    }
    $('[data-control="opacity"]').value = Math.round(settings.opacity * 100);
    $('[data-out="opacity"]').textContent = formatNumber(Math.round(settings.opacity * 100) / 100, { style: "percent" });
    $('[data-control="moving"]').checked = settings.moving;
    $('[data-control="markers"]').checked = settings.markers;
  }

  // Applies a change to the controls: what it touches, and remembers it.
  function update(change) {
    const before = settings;
    settings = normalizeLabSettings({ ...settings, ...change });
    if (settings.treatment !== before.treatment && editor) {
      const state = editor.save();
      unmount();
      applyLook();
      mount(state);
    } else applyLook();
    if (settings.world !== before.world) view.setWorld(settings.world);
    if (settings.moving !== before.moving) view.setMoving(settings.moving);
    if (settings.markers !== before.markers) showMarkers();
    syncControls();
    saveLocal("lab", settings);
  }

  bin.on($(".lab-body"), "click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const group = button.closest(".segmented[data-control]");
    if (group) {
      const raw = button.dataset.value;
      update({ [group.dataset.control]: raw === "true" ? true : raw === "false" ? false : raw });
    } else if (button.dataset.action === "step") {
      markerStep++;
      showMarkers();
    } else if (button.dataset.action === "roundtrip") roundTrip();
    else if (button.dataset.action === "reset") {
      markerStep = 0;
      editor.load(demoProgram());
      showMarkers();
    }
  });
  bin.on($('[data-control="opacity"]'), "input", (e) => update({ opacity: Number(e.target.value) / 100 }));
  bin.on($('[data-control="moving"]'), "change", (e) => update({ moving: e.target.checked }));
  bin.on($('[data-control="markers"]'), "change", (e) => update({ markers: e.target.checked }));
  bin.on($(".lab-fold"), "click", (e) => {
    const open = $(".lab-body").hidden;
    $(".lab-body").hidden = !open;
    e.target.setAttribute("aria-expanded", String(open));
    e.target.textContent = open ? t("lab.hide") : t("lab.show");
  });

  // Saves the program, loads that into the editor, and checks that saving again
  // gives the same: Blockly's JSON keeps everything, block ids included.
  function roundTrip() {
    const saved = JSON.stringify(editor.save());
    editor.load(JSON.parse(saved));
    const again = JSON.stringify(editor.save());
    const ok = again === saved;
    const blocks = editor.blockCount();
    status.textContent = ok ? t("lab.roundTripOk", { count: blocks, bytes: saved.length }) : t("lab.roundTripBad");
    showMarkers();
    return { ok, blocks, bytes: saved.length };
  }

  // Dragging the panel's edge sets its width; the editor follows (createEditor
  // watches its size).
  const handle = $(".panel-handle");
  const setWidth = (px) => update({ panelWidth: Math.min(window.innerWidth - MIN_WORLD, Math.max(MIN_PANEL, px)) / window.innerWidth });
  let resizing = false;
  bin.on(handle, "pointerdown", (e) => {
    resizing = true;
    handle.setPointerCapture(e.pointerId);
  });
  bin.on(handle, "pointermove", (e) => resizing && setWidth(e.clientX - panel.getBoundingClientRect().left));
  bin.on(handle, "pointerup", () => (resizing = false));
  bin.on(handle, "pointercancel", () => (resizing = false));
  bin.on(handle, "keydown", (e) => {
    const step = { ArrowLeft: -24, ArrowRight: 24 }[e.key];
    if (!step) return;
    e.preventDefault();
    setWidth(panel.getBoundingClientRect().width + step);
  });

  applyLook();
  syncControls();
  mount(kept.program ?? loadLocal("lab-program") ?? demoProgram());

  // Leaving: save the program now rather than when its timer would have, and hand
  // on what the lab opens with next. Added after the editor and the view, so it
  // runs before they're let go.
  bin.add(() => {
    if (editor) saveProgram();
    kept = { ...kept, markerStep, camera: view.state };
  });

  // The ?dev hooks, for the browser tests (e2e/) and the screenshots (scripts/).
  if (isDev()) {
    window.lab = {
      get settings() {
        return { ...settings };
      },
      set: update,
      camera: () => view.state,
      screenOf: (name) => view.screenOf(name),
      robotAt: (angle) => view.robotAt(angle),
      save: () => editor.save(),
      load(json) {
        editor.load(json);
        warnings.reset();
        check();
      },
      // The compiler's findings, as codes with block ids, and each block's warning.
      problems: () => problems,
      warning: (id) => {
        const icon = editor.workspace.getBlockById(id)?.getIcons().find((i) => i.getType().toString() === "warning");
        return icon ? icon.getText() : null;
      },
      blockCount: () => editor.blockCount(),
      workspace: () => editor.workspace,
      // The block's own shape, without the blocks after or inside it, which its
      // SVG group also holds.
      blockRect: (id) => editor.workspace.getBlockById(id)?.pathObject.svgPath.getBoundingClientRect().toJSON() ?? null,
      fieldRect: (blockId, field) => editor.workspace.getBlockById(blockId)?.getField(field)?.getSvgRoot().getBoundingClientRect().toJSON() ?? null,
      markerRects: () => markers.rects(),
      // Every block in every toolbox category, with its width on screen: longer
      // words make wider blocks, and Blockly never wraps them (PLAN.md §8).
      toolboxBlocks() {
        const toolbox = editor.workspace.getToolbox();
        const found = [];
        for (const item of toolbox.getToolboxItems()) {
          if (!item.isSelectable()) continue;
          toolbox.setSelectedItem(item);
          for (const block of toolbox.getFlyout().getWorkspace().getTopBlocks(false)) {
            found.push({ category: item.getName(), type: block.type, width: block.getSvgRoot().getBoundingClientRect().width });
          }
        }
        toolbox.clearSelection();
        return found;
      },
      step: () => {
        markerStep++;
        showMarkers();
      },
      roundTrip,
      frames: () => meter.stats(),
    };
    bin.add(() => delete window.lab);
  }

  return () => bin.dispose();
}
