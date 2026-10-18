import { test, expect } from "@playwright/test";
import { ENGLISH } from "../src/i18n/index.js";
import { LANGUAGES } from "../src/i18n/languages.js";
import { NOT_WORDS, UNUSED_BLOCKLY } from "../src/i18n/blockly-unused.js";
import { overrides as germanOverrides } from "../src/i18n/de/blockly.js";
import { letsGo, seedCampaign, solveMission } from "./campaign-seed.js";
import { openDrawer } from "./ui.js";

// The language checks of PLAN.md §12 that need a browser: the title page and the
// editor lab in each language, chosen by the browser or by the player; a switch
// in mid-session that leaves the program, the markers and the selection as they
// were; no text cut off; toolbox blocks no wider than MAX_BLOCK; nothing left
// unmarked by the pseudo-language; and Blockly reading only messages that are
// translated.

// The widest a toolbox block may be, in CSS pixels at the editor's starting
// scale. An iPad in landscape shows the editor 668 px wide by default; this
// keeps the open flyout under half of the workspace beside the toolbox.
const MAX_BLOCK = 240;

const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const lab = (page, fn, arg) => page.evaluate(fn, arg);

async function editorReady(page, lang) {
  await page.waitForFunction((l) => document.documentElement.lang === l && window.lab && document.querySelector(".editor-host .blocklySvg"), lang);
  await frames(page);
}

async function openLab(page, lang, query = "") {
  await page.goto(`/lab?dev${query}`);
  await editorReady(page, lang);
  await lab(page, () => window.lab.set({ moving: false }));
}

async function drag(page, from, to, steps = 10) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

// The left end of block `id`, clear of its fields.
async function blockStart(page, id) {
  const r = await lab(page, (i) => window.lab.blockRect(i), id);
  return { x: r.x + 12, y: r.y + r.height / 2 };
}

// A point on the editor's workspace with no block on it.
async function emptyPoint(page) {
  const panel = await page.locator(".editor-panel").boundingBox();
  return { x: panel.x + panel.width * 0.72, y: panel.y + panel.height * 0.12 };
}

const blockText = (page, id) => lab(page, (i) => window.lab.workspace().getBlockById(i).getSvgRoot().textContent, id);
// The items of a menu, without the keyboard shortcuts Blockly shows beside them.
const menuTexts = (page, selector) =>
  page.locator(`${selector} .blocklyMenuItemContent`).evaluateAll((items) =>
    items.map((item) => {
      const label = item.cloneNode(true);
      label.querySelector(".blocklyShortcut")?.remove();
      return label.textContent.trim();
    }),
  );

async function openDropdown(page, id, field) {
  const r = await lab(page, ([i, f]) => window.lab.fieldRect(i, f), [id, field]);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await expect(page.locator(".blocklyDropDownDiv .blocklyMenuItem").first()).toBeVisible();
}

async function openContextMenu(page, at) {
  await page.mouse.click(at.x, at.y, { button: "right" });
  await expect(page.locator(".blocklyContextMenu")).toBeVisible();
}

// Rests the pointer on block `id` until its tooltip shows, and returns that.
async function tooltip(page, id) {
  const at = await blockStart(page, id);
  await page.mouse.move(at.x, at.y);
  await page.mouse.move(at.x + 2, at.y);
  const tip = page.locator(".blocklyTooltipDiv");
  await expect(tip).toBeVisible();
  const text = await tip.textContent();
  await page.mouse.move(5, 5);
  return text;
}

const mutator = (page, open) => lab(page, (o) => window.lab.workspace().getBlockById("if").getIcons()[0].setBubbleVisible(o), open);

// Does what a player does with the editor: every toolbox category, a dropdown,
// the menus of a block and of the workspace, the if block's own editor, and
// keyboard navigation. `check(what)` runs at each, while it's on screen.
async function exercise(page, check = async () => {}) {
  const categories = await lab(page, () => window.lab.workspace().getToolbox().getToolboxItems().length);
  for (let i = 0; i < categories; i++) {
    await lab(page, (n) => window.lab.workspace().getToolbox().selectItemByPosition(n), i);
    await frames(page);
    await check(`toolbox category ${i + 1}`);
  }
  await lab(page, () => window.lab.workspace().getToolbox().clearSelection());
  await openDropdown(page, "go-grove-place", "PLACE");
  await check("dropdown");
  await page.keyboard.press("Escape");
  await openContextMenu(page, await blockStart(page, "unload"));
  await check("block menu");
  await page.keyboard.press("Escape");
  await openContextMenu(page, await emptyPoint(page));
  await check("workspace menu");
  await page.keyboard.press("Escape");
  await mutator(page, true);
  await frames(page);
  await check("if block's editor");
  await mutator(page, false);
  const start = await blockStart(page, "go-grove");
  await page.mouse.click(start.x, start.y);
  for (const key of ["ArrowDown", "ArrowDown", "ArrowRight", "ArrowLeft", "ArrowUp"]) await page.keyboard.press(key);
  await check("keyboard");
  await page.keyboard.press("Escape");
}

// The same for the island's editor of the collector's program: every toolbox
// category, and the place dropdown, which the island fills.
async function exerciseIslandEditor(page, check) {
  const categories = await page.evaluate(() => window.islandPage.editor().workspace.getToolbox().getToolboxItems().length);
  for (let i = 0; i < categories; i++) {
    await page.evaluate((n) => window.islandPage.editor().workspace.getToolbox().selectItemByPosition(n), i);
    await frames(page);
    await check(`island toolbox category ${i + 1}`);
  }
  await page.evaluate(() => window.islandPage.editor().workspace.getToolbox().clearSelection());
  const r = await page.evaluate(() => window.islandPage.editor().workspace.getBlockById("collector-go-grove-place").getField("PLACE").getSvgRoot().getBoundingClientRect().toJSON());
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await expect(page.locator(".blocklyDropDownDiv .blocklyMenuItem").first()).toBeVisible();
  await check("island place dropdown");
  await page.keyboard.press("Escape");
}

// Text on the page with words in plain letters, outside anything marked with a
// language of its own (the language choice: each language's name, in it).
// Hidden text counts too: a screen reader still says it. A letter on its own is
// a key on the keyboard (D, Blockly's shortcut for Duplicate), the same in every
// language. Blockly 13.4.0 fixes the names of the modifier keys in its shortcut
// hints (Control + Z, or ⌘ Shift Z on Apple devices) when it loads, so they stay
// English in every language (docs/languages.md); those, and only in a
// shortcut, are let through.
function unmarkedText() {
  const plain = (text) =>
    text
      .replace(/\b(Control|Alt|Shift)(?= (\+ )?\S)/g, "")
      .split(/[^\p{L}]+/u)
      .some((word) => word.length > 1 && /[A-Za-z]/.test(word));
  const own = (el) => el.closest("[lang]:not(html), script, style");
  const found = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode()); ) {
    const text = n.nodeValue.trim();
    if (plain(text) && !own(n.parentElement)) found.add(text);
  }
  const attrs = ["aria-label", "title", "alt", "placeholder", "aria-roledescription", "aria-valuetext", "aria-description"];
  for (const el of document.querySelectorAll(attrs.map((a) => `[${a}]`).join(","))) {
    if (own(el)) continue;
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (value && plain(value)) found.add(`${attr}="${value}"`);
    }
  }
  if (plain(document.title)) found.add(`<title>${document.title}`);
  return [...found];
}

// Elements whose text doesn't fit in them, or that run off the window. Blockly
// draws in SVG, which the toolbox test measures instead. An ellipsis is a
// deliberate shortening, with the whole text on hover; words for screen
// readers alone (.vh) aren't on screen to be cut off.
function clippedText() {
  const found = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg, .injectionDiv, .blocklyWidgetDiv, .blocklyDropDownDiv, .blocklyTooltipDiv, .vh")) continue;
    if (![...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim())) continue;
    const style = getComputedStyle(el);
    if (style.display === "inline" || style.display === "contents" || style.textOverflow === "ellipsis") continue;
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 || r.left < -1 || r.right > innerWidth + 1) {
      found.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")}: "${el.textContent.trim().slice(0, 60)}"`);
    }
  }
  return found;
}

test.describe("with a German browser", () => {
  test.use({ locale: "de-AT" });

  test("the title page is in German, and the player's choice of English is remembered", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page).toHaveTitle("BlocklyBots");
    await expect(page.locator(".tagline")).toHaveText("Programmiere Roboter und Gebäude und erwecke eine Insel wieder zum Leben.");
    await page.locator(".grown-ups summary").click();
    await expect(page.getByRole("link", { name: "Editor-Labor" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Sprache" }).getByRole("button", { name: "Deutsch" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator(".tagline")).toHaveText("Program robots and buildings to bring an island back to life.");
    await expect(page.getByRole("group", { name: "Language" }).getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator(".tagline")).toHaveText("Program robots and buildings to bring an island back to life.");
  });

  test("the editor lab is in German: page, toolbox, blocks, dropdowns, menus, tooltips and markers", async ({ page }) => {
    await openLab(page, "de");
    await expect(page).toHaveTitle("Editor-Labor · BlocklyBots");
    await expect(page.locator(".lab-bar strong")).toHaveText("Editor-Labor");
    await expect(page.locator('[data-out="opacity"]')).toHaveText("60 %");
    expect(await page.locator(".editor-host .blocklyToolboxCategoryLabel").allTextContents()).toEqual(["Start", "Roboter", "Gebäude", "Steuerung", "Fühlen", "Werte"]);
    for (const [id, words] of [
      ["go-grove", ["gehe zu", "Wäldchen"]],
      ["repeat", ["wiederhole", "-mal"]],
      ["stock", ["Bretter", "bei", "Sägewerk"]],
      ["forever", ["wiederhole fortlaufend"]],
    ]) {
      const text = (await blockText(page, id)).replace(/ /g, " ");
      for (const w of words) expect(text, id).toContain(w);
    }
    await expect(page.locator(".editor-host .blocklyZoomIn")).toHaveAttribute("aria-label", "Vergrößern");
    expect(await page.locator(".execution-markers text").allTextContents()).toEqual(expect.arrayContaining(["Robo 1", "Robo 2", "Sägewerk"]));

    await openDropdown(page, "go-grove-place", "PLACE");
    expect(await menuTexts(page, ".blocklyDropDownDiv")).toEqual(["Wäldchen", "Sägewerk", "Baustelle", "Lagerhaus", "Camp", "Steinbruch", "Werkstatt"]);
    await page.locator(".blocklyDropDownDiv .blocklyMenuItem", { hasText: "Lagerhaus" }).click();
    expect(await lab(page, () => window.lab.save().blocks.blocks[0].next.block.inputs.DO.block.inputs.PLACE.shadow.fields.PLACE)).toBe("depot");

    await openContextMenu(page, await blockStart(page, "unload"));
    expect(await menuTexts(page, ".blocklyContextMenu")).toEqual(expect.arrayContaining(["Baustein löschen", "Kommentar hinzufügen"]));
    await expect(page.locator(".blocklyContextMenu .blocklyShortcut").last()).toHaveText(/Entf/); // a key's German name
    await page.keyboard.press("Escape");
    expect(await tooltip(page, "unload")).toBe("Lege alles aus dem Korb in das Gebäude hier.");

    // The controls, wider in German, can cover the rock on a small screen.
    await page.getByRole("button", { name: "Steuerung ausblenden" }).click();
    const rock = await lab(page, () => window.lab.screenOf("rock-1"));
    await page.mouse.click(rock.x, rock.y);
    await page.getByRole("button", { name: "Labor-Steuerung" }).click();
    await expect(page.locator(".lab-selected")).toHaveText("Ausgewählt: Felsen 1");
  });

  test("Blockly reads only messages that are in German, and none the game says it doesn't use", async ({ page }) => {
    const [english, german] = await Promise.all([import("blockly/msg/en"), import("blockly/msg/de")]);
    await openLab(page, "de");
    await exercise(page);
    await tooltip(page, "repeat");
    const reads = await lab(page, () => window.island.blocklyReads());
    expect(reads.length).toBeGreaterThan(40);
    const unused = reads.filter((key) => !NOT_WORDS.test(key) && UNUSED_BLOCKLY.some(({ keys }) => keys.test(key)));
    expect(unused, "read, though src/i18n/blockly-unused.js says the game doesn't use them").toEqual([]);
    const untranslated = reads.filter((key) => !(key in ENGLISH.blocks) && !NOT_WORDS.test(key) && !(key in germanOverrides) && german[key] === english[key]);
    expect(untranslated, "read, and still in English").toEqual([]);
  });
});

test("an English browser gets English, and so does one in a language not on offer", async ({ browser }) => {
  for (const locale of ["en-GB", "fr-FR"]) {
    const page = await (await browser.newContext({ locale })).newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("BlocklyBots");
    await expect(page.locator(".tagline")).toHaveText("Program robots and buildings to bring an island back to life.");
    await page.context().close();
  }
});

test("switching language in the lab keeps the program, markers, camera and selection exactly", async ({ page }) => {
  await openLab(page, "en");
  await lab(page, () => window.lab.set({ markers: true }));
  await lab(page, () => window.lab.step());
  const rock = await lab(page, () => window.lab.screenOf("rock-1"));
  await page.mouse.click(rock.x, rock.y);
  await drag(page, { x: rock.x, y: rock.y + 120 }, { x: rock.x - 80, y: rock.y + 150 });
  // A change just before the switch, too soon for the lab's own saving to catch.
  const unload = await blockStart(page, "unload");
  await drag(page, unload, { x: unload.x + 200, y: unload.y + 140 });
  const marks = async () => (await lab(page, () => window.lab.markerRects())).map(({ entity, block }) => `${entity}@${block}`).sort();
  const before = {
    program: JSON.stringify(await lab(page, () => window.lab.save())),
    camera: await lab(page, () => window.lab.camera()),
    markers: await marks(),
    live: await lab(page, () => window.island.counts()),
  };
  expect(before.camera.selected).toBe("rock-1");
  expect(before.markers).toContain("r2@collect");

  for (const [group, name, lang, selected] of [
    ["Language", "Deutsch", "de", "Ausgewählt: Felsen 1"],
    ["Sprache", "English", "en", "Selected: Rock 1"],
  ]) {
    await page.getByRole("group", { name: group }).getByRole("button", { name }).click();
    await editorReady(page, lang);
    expect(JSON.stringify(await lab(page, () => window.lab.save()))).toBe(before.program);
    expect(await lab(page, () => window.lab.camera())).toEqual(before.camera);
    await expect.poll(() => marks()).toEqual(before.markers);
    await expect(page.locator(".lab-selected")).toHaveText(selected);
    expect(await lab(page, () => window.island.counts()), "the old editor and view are gone").toEqual(before.live);
  }
  // And the program was saved on the way, for the next visit.
  await page.reload();
  await editorReady(page, "en");
  expect(JSON.stringify(await lab(page, () => window.lab.save()))).toBe(before.program);
});

// The world lab, `ticks` steps on: robots under way, waiting, and in the end
// the whole world stalled, each in words.
async function worldAt(page, query, ticks) {
  await page.goto(`/world?dev${query}`);
  await page.waitForFunction(() => window.world);
  await page.evaluate((n) => {
    for (let i = 0; i < n; i++) window.world.game.step();
  }, ticks);
  await frames(page);
}

// The island in 3D, `ticks` steps on, with `id` chosen, so the overview, open,
// and the labels' marks say what it's doing and why, and with `panel` open on
// the left: ["editor", program] or ["together"].
async function islandAt(page, query, ticks, id, panel = null) {
  await page.goto(`/island?dev${query}`);
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag"));
  await page.evaluate(
    ([n, which]) => {
      for (let i = 0; i < n; i++) window.islandPage.game.step();
      window.islandPage.select(which);
    },
    [ticks, id],
  );
  await openDrawer(page, "overview");
  if (panel) await page.evaluate(([kind, program]) => window.islandPage.open(kind, program), panel);
  await frames(page);
}

// The island's Phase 6 tools at their fullest: Robo 2's setup with a change of
// team waiting for OK, the program library with a Give to… open, and the Build
// card saying why a building doesn't fit.
async function islandTools(page, query) {
  await islandAt(page, query, 20, "r2", ["library"]);
  await page.locator("#setup-team").selectOption("wood-team");
  await page.locator('.lib-program[data-program="fetch"] [data-lib="give"]').click();
  await page.locator('[data-build="open"]').click();
  await page.evaluate(() => window.islandPage.aimAt(14, 8));
  await frames(page);
}

// The editor's Versions open on Robo 1's program: version 2 applied, then
// version 1 put back into the draft, the changes not applied kept at the
// bottom.
async function islandHistory(page, query) {
  await islandAt(page, query, 20, "r1", ["editor", "collector"]);
  const times = (n) => page.evaluate((v) => window.islandPage.editor().workspace.getBlockById("collector-times").getField("NUM").setValue(v), n);
  await times(3);
  await page.waitForTimeout(400);
  await page.locator('[data-code="apply"]').click();
  await page.evaluate(() => window.islandPage.game.step());
  await times(4);
  await page.waitForTimeout(400);
  await page.locator('[data-code="history"]').click();
  await page.locator('[data-version="1"]').click();
  await frames(page);
}

// The bridge slice at /slice, from its start, as `state` asks: `broken`, a save
// it can't use (the card says so); `fixed`, the courier and the site's programs
// changed in the editor and applied; `ticks` steps on, or until the mission is
// `done`; `changed`, the courier applied once more after that (the card offers
// to start again); and `hints` of the hint ladder showing.
async function playAt(page, query, { broken = false, fixed = false, ticks = 0, done = false, changed = false, hints = 0 } = {}) {
  await page.goto(`/?dev${query}`);
  await page.evaluate((b) => {
    localStorage.removeItem("robot-island:save.slice");
    if (b) localStorage.setItem("robot-island:save.slice", JSON.stringify({ format: "robot-island", schema: 0 }));
  }, broken);
  await page.goto(`/slice?dev${query}`);
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag"));
  await letsGo(page);
  const apply = async () => {
    await page.waitForTimeout(400); // the editor saves its draft
    await page.locator('[data-code="apply"]').click();
  };
  if (fixed) {
    await page.evaluate(() => window.islandPage.open("editor", "courier"));
    await page.evaluate(() => window.islandPage.editor().workspace.getBlockById("courier-go-depot-place").getField("PLACE").setValue("site"));
    await apply();
    await page.evaluate(() => window.islandPage.open("editor", "bridge"));
    await page.evaluate(() => {
      const ws = window.islandPage.editor().workspace;
      ws.getBlockById("bridge-start").nextConnection.connect(ws.getBlockById("bridge-build").previousConnection);
    });
    await apply();
    await page.evaluate(() => window.islandPage.close());
  }
  await page.evaluate(
    ([n, untilDone]) => {
      const game = window.islandPage.game;
      for (let i = 0; i < n || (untilDone && game.world.mission.done === null && i < 2000); i++) game.step();
    },
    [ticks, done],
  );
  if (changed) {
    await page.evaluate(() => window.islandPage.open("editor", "courier"));
    await page.evaluate(() => window.islandPage.editor().workspace.getBlockById("courier-go-depot-place").getField("PLACE").setValue("depot"));
    await apply();
    await page.evaluate(() => window.islandPage.close());
  }
  // The mission's panel open, unless it's done and the win is over the page
  // (or about to be, at the next frame).
  if (!(await page.evaluate(() => window.islandPage.game.world.mission?.done != null))) await openDrawer(page, "mission");
  for (let i = 0; i < hints; i++) await page.locator(".mission-hint").click();
  await frames(page);
}

// What the play page shows in each test of its words.
const PLAY_STATES = [{ hints: 3 }, { broken: true }, { fixed: true, ticks: 60, changed: true }, { fixed: true, done: true }];

// The campaign's pages, as `state` asks, from a campaign saved at mission
// `mission` (campaign-seed.js): `hints` of its ladder showing; with `passed`,
// its whole program shown and applied and the first trial passed; `stuck`, run
// until everything waits; `chosen`, a robot or building chosen; `done`, solved,
// with the win showing; or `replay`, a mission done before played again; or
// free play grown into the sandbox, with the grove chosen and the new island's
// layout asked for. With `briefing`, the mission's briefing is left showing.
async function campaignAt(page, query, { mission = "c2-m001", briefing = false, hints = 0, passed = false, stuck = false, chosen = null, done = false, replay = null, sandbox = false, steps = 0 } = {}) {
  await seedCampaign(page, sandbox ? "c2-m025" : mission, { done: sandbox, query });
  await page.goto(sandbox ? `/free?dev${query}` : replay ? `/replay?dev${query}&mission=${replay}` : `/play?dev${query}`);
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag"));
  if (!briefing) await letsGo(page);
  // The mission's panel open, and the overview, so their words are checked too.
  const panels = async () => {
    if (!sandbox) await openDrawer(page, "mission");
    await openDrawer(page, "overview");
  };
  if (!briefing) await panels();
  if (passed) {
    for (let i = 0; i < 3; i++) await page.locator(".mission-hint").click();
    await page.locator('[data-mission="whole"]').click();
    await page.waitForFunction(() => window.islandPage.panel()?.kind === "editor");
    await page.waitForTimeout(400);
    await page.locator('[data-code="apply"]').click();
    await page.evaluate(() => {
      window.islandPage.close();
      const game = window.islandPage.game;
      while (game.world.mission.trial === 0) game.step();
    });
    await panels();
  } else for (let i = 0; i < hints; i++) await page.locator(".mission-hint").click();
  if (stuck) await page.evaluate(() => {
    const game = window.islandPage.game;
    while (!game.world.stall && game.world.tick < 2000) game.step();
  });
  if (done) await solveMission(page);
  if (steps) await page.evaluate((n) => Array.from({ length: n }, () => window.islandPage.game.step()), steps);
  if (chosen) await page.evaluate((id) => window.islandPage.select(id), chosen);
  if (sandbox) {
    await page.evaluate(() => window.islandPage.select("grove"));
    await page.locator('[data-sandbox="new"]').click();
  }
  await frames(page);
}

const CAMPAIGN_STATES = [
  { mission: "c2-m016", briefing: true },
  { mission: "c2-m001", hints: 3 },
  { mission: "c2-m010", stuck: true, hints: 2 },
  { mission: "c2-m016", passed: true },
  { mission: "c2-m020", chosen: "r1", hints: 1 },
  { mission: "c2-m025", done: true },
  { mission: "c2-m006", replay: "c2-m003" },
  { sandbox: true },
  // A building waiting for what's missing, with the hint that asks about it,
  // and a robot on its way across the bridge.
  { mission: "c2-m024", chosen: "workshop", stuck: true, hints: 2 },
  { mission: "c2-m021", chosen: "r1", steps: 40 },
];

// The title page with the campaign saved at mission 6, every mission done so
// far listed, and Start over asking.
async function homeAsking(page, query) {
  await seedCampaign(page, "c2-m006", { query });
  await expect(page.locator(".start-over")).toBeVisible();
  await page.locator('[data-home="ask"]').click();
  await frames(page);
}

// Every block in every category of the island editor's toolbox, with its width
// on screen.
const islandToolboxBlocks = (page) =>
  page.evaluate(() => {
    const toolbox = window.islandPage.editor().workspace.getToolbox();
    const found = [];
    for (const item of toolbox.getToolboxItems()) {
      if (!item.isSelectable()) continue;
      toolbox.setSelectedItem(item);
      for (const block of toolbox.getFlyout().getWorkspace().getTopBlocks(false)) found.push({ type: block.type, width: block.getSvgRoot().getBoundingClientRect().width });
    }
    toolbox.clearSelection();
    return found;
  });

test("the pseudo-language leaves no text unmarked, on the title page, in the editor, in the world or in the slice", async ({ page }) => {
  test.setTimeout(300_000); // every page of the game, the campaign's among them
  await page.goto("/?dev&lang=pseudo");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
  await page.waitForSelector(".home .chapter");
  expect(await page.evaluate(unmarkedText)).toEqual([]);
  await page.locator('.home a[href^="/lab"]').click();
  await editorReady(page, "en-XA");
  expect(await page.evaluate(unmarkedText)).toEqual([]);
  await exercise(page, async (what) => expect(await page.evaluate(unmarkedText), what).toEqual([]));
  expect(await tooltip(page, "go-grove")).not.toMatch(/[A-Za-z]/);
  for (const ticks of [2, 300, 1200]) {
    await worldAt(page, "&lang=pseudo", ticks);
    expect(await page.evaluate(unmarkedText), `world at step ${ticks}`).toEqual([]);
  }
  await expect(page.locator(".stall")).toBeVisible();
  for (const [ticks, id, panel] of [
    [2, null],
    [2, "r1"],
    [60, "sawmill"],
    [1200, "site"],
    [2, "sawmill", ["together"]],
    [30, "r1", ["editor", "collector"]],
  ]) {
    await islandAt(page, "&lang=pseudo", ticks, id, panel);
    expect(await page.evaluate(unmarkedText), `island at step ${ticks}, ${id} chosen, ${panel} open`).toEqual([]);
  }
  // The editor's toolbox, a changed draft, a problem, and an Apply waiting for
  // the next step.
  await exerciseIslandEditor(page, async (what) => expect(await page.evaluate(unmarkedText), what).toEqual([]));
  await page.evaluate(() => window.islandPage.editor().workspace.getBlockById("collector-go-sawmill-place").getField("PLACE").setValue("nowhere"));
  await expect(page.locator(".code-problems, .code-state")).not.toHaveText(["", ""]);
  await page.waitForTimeout(500);
  // "nowhere" is the place the test typed, which the dropdown and the problem
  // show by its id, as the program holds it: not words of the game's.
  expect((await page.evaluate(unmarkedText)).filter((text) => !/^(aria-label=".*: )?nowhere"?$/.test(text)), "a problem").toEqual([]);
  expect((await page.evaluate(() => window.islandPage.editor().workspace.getBlockById("collector-go-sawmill").getIcons()[0].getText())).replace("nowhere", "")).not.toMatch(/[A-Za-z]{2}/);
  await page.evaluate(() => window.islandPage.editor().workspace.getBlockById("collector-go-sawmill-place").getField("PLACE").setValue("depot"));
  await page.waitForTimeout(500);
  await page.locator('[data-code="apply"]').click();
  expect(await page.evaluate(unmarkedText), "an Apply waiting").toEqual([]);
  await islandTools(page, "&lang=pseudo");
  expect(await page.evaluate(unmarkedText), "the island's setup, library and Build card").toEqual([]);
  await islandHistory(page, "&lang=pseudo");
  expect(await page.evaluate(unmarkedText), "the editor's versions").toEqual([]);
  // The mission: its card with every hint, a save it can't use, the offer to
  // start again, and the reward; and the title page asking to start over.
  for (const state of PLAY_STATES) {
    await playAt(page, "&lang=pseudo", state);
    expect(await page.evaluate(unmarkedText), `play ${JSON.stringify(state)}`).toEqual([]);
  }
});

// The campaign apart, on a page of its own: a page that has made dozens of 3D
// views before can lose WebGL on WebKit (“context lost”), which says nothing
// about the words.
test("the pseudo-language leaves no text unmarked in the campaign, or on the title page asking to start over", async ({ page }) => {
  test.setTimeout(300_000);
  for (const state of CAMPAIGN_STATES) {
    await campaignAt(page, "&lang=pseudo", state);
    expect(await page.evaluate(unmarkedText), `campaign ${JSON.stringify(state)}`).toEqual([]);
  }
  await homeAsking(page, "&lang=pseudo");
  expect(await page.evaluate(unmarkedText), "the title page asking to start over").toEqual([]);
});

// Every listed language, and the pseudo-language, a third longer than English.
const everyLanguage = [...LANGUAGES.map(({ code }) => [code, `&lang=${code}`]), ["en-XA", "&lang=pseudo"]];

for (const [lang, query] of everyLanguage) {
  test(`no text is cut off or runs off the window (${lang})`, async ({ page }) => {
    test.setTimeout(300_000); // every page of the game, the campaign's among them
    await page.goto(`/?dev${query}`);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await page.waitForSelector(".home .chapter");
    expect(await page.evaluate(clippedText)).toEqual([]);
    await page.locator('.home a[href^="/lab"]').click();
    await editorReady(page, lang);
    await lab(page, () => window.lab.roundTrip()); // the longest line the lab writes
    await page.waitForTimeout(600); // and the frame meter's
    expect(await page.evaluate(clippedText)).toEqual([]);
    const controls = await page.locator(".lab-controls").boundingBox();
    expect(controls.x).toBeGreaterThanOrEqual(0);
    expect(controls.x + controls.width).toBeLessThanOrEqual(page.viewportSize().width);
    for (const ticks of [300, 1200]) {
      await worldAt(page, query, ticks);
      expect(await page.evaluate(clippedText), `world at step ${ticks}`).toEqual([]);
    }
    for (const [ticks, id, panel] of [
      [2, null],
      [60, "sawmill"],
      [300, "r2"],
      [2, "sawmill", ["together"]],
      [30, "r1", ["editor", "collector"]],
    ]) {
      await islandAt(page, query, ticks, id, panel);
      expect(await page.evaluate(clippedText), `island at step ${ticks}, ${id} chosen, ${panel} open`).toEqual([]);
    }
    await islandTools(page, query);
    expect(await page.evaluate(clippedText), "the island's setup, library and Build card").toEqual([]);
    await islandHistory(page, query);
    expect(await page.evaluate(clippedText), "the editor's versions").toEqual([]);
    for (const state of PLAY_STATES) {
      await playAt(page, query, state);
      expect(await page.evaluate(clippedText), `play ${JSON.stringify(state)}`).toEqual([]);
    }
  });

  // The campaign on a page of its own, as above.
  test(`no text is cut off or runs off the window in the campaign (${lang})`, async ({ page }) => {
    test.setTimeout(300_000);
    for (const state of CAMPAIGN_STATES) {
      await campaignAt(page, query, state);
      expect(await page.evaluate(clippedText), `campaign ${JSON.stringify(state)}`).toEqual([]);
    }
    await homeAsking(page, query);
    expect(await page.evaluate(clippedText), "the title page asking to start over").toEqual([]);
  });
}

for (const [lang, query] of everyLanguage.slice(0, LANGUAGES.length)) {
  test(`every toolbox block is at most ${MAX_BLOCK} px wide (${lang})`, async ({ page }) => {
    await openLab(page, lang, query);
    for (const treatment of ["calm", "bold"]) {
      await lab(page, (t) => window.lab.set({ treatment: t }), treatment);
      await frames(page);
      const blocks = await lab(page, () => window.lab.toolboxBlocks());
      expect(blocks.length).toBeGreaterThan(10);
      const wide = blocks.filter((b) => b.width > MAX_BLOCK).map((b) => `${b.type}: ${Math.round(b.width)} px`);
      expect(wide, `${lang}, ${treatment}`).toEqual([]);
    }
    // And the island editor's, for a robot, the sawmill and the construction site.
    for (const program of ["collector", "planks", "bridge"]) {
      await islandAt(page, query, 0, null, ["editor", program]);
      const blocks = await islandToolboxBlocks(page);
      expect(blocks.length).toBeGreaterThan(8);
      const wide = blocks.filter((b) => b.width > MAX_BLOCK).map((b) => `${b.type}: ${Math.round(b.width)} px`);
      expect(wide, `${lang}, island editor for ${program}`).toEqual([]);
    }
  });
}
