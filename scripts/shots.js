// Pictures of the editor lab: the Phase 0 treatments (docs/phase0.md), each over
// a bright and a dark world, a range of background opacities, blur, open
// dropdowns, an iPad-sized screen, and how long frames take with blur and
// without; the languages (docs/languages.md): German and the pseudo-language on
// the title page and in the lab; programs (docs/phase2.md): the world lab's
// robots and buildings at their blocks, and the editor marking a program's
// problems; the island in 3D (docs/phase3.md); and the island's editor and
// debugger (docs/phase4.md). Builds the app, serves it, and writes to
// docs/phase0/, docs/languages/, docs/phase2/, docs/phase3/ and docs/phase4/. Run
// it after changing how the editor or the island looks: npm run shots, or for
// some groups only: npm run shots -- languages ipad.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium, webkit, devices } from "@playwright/test";
import { LANGUAGES as LISTED, SOURCE } from "../src/i18n/languages.js";

const GROUPS = ["treatments", "opacity", "blur", "dropdowns", "frames", "ipad", "languages", "programs", "island", "debugger"];
const asked = process.argv.slice(2);
for (const group of asked) if (!GROUPS.includes(group)) throw new Error(`No group "${group}"; there are ${GROUPS.join(", ")}.`);
const want = (group) => !asked.length || asked.includes(group);

const TRANSLATED = LISTED.map((l) => l.code).filter((code) => code !== SOURCE);
const PHASE0 = new URL("../docs/phase0/", import.meta.url);
const LANGUAGES = new URL("../docs/languages/", import.meta.url);
const PHASE2 = new URL("../docs/phase2/", import.meta.url);
const PHASE3 = new URL("../docs/phase3/", import.meta.url);
const PHASE4 = new URL("../docs/phase4/", import.meta.url);
const PORT = 4178;
const BEHIND = 3.6; // radians round its circuit: the test robot behind the editor, clear of the trees
// The game follows the browser's language; the pictures choose theirs.
const DESKTOP = { viewport: { width: 1440, height: 900 }, locale: "en-US" };
const IPAD = { ...devices["iPad Pro 11 landscape"], locale: "en-US" };
mkdirSync(PHASE0, { recursive: true });
mkdirSync(LANGUAGES, { recursive: true });
mkdirSync(PHASE2, { recursive: true });
mkdirSync(PHASE3, { recursive: true });
mkdirSync(PHASE4, { recursive: true });

await build({ logLevel: "warn" });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: "warn" });
const base = `http://localhost:${PORT}`;

// Opens the lab in `browser`, in language `lang`, with `settings`, the robot
// behind the editor and the markers one step on (two robots at one block), and
// the controls folded unless `controls`.
async function openLab(browser, settings, { context = DESKTOP, lang = "en", controls = false } = {}) {
  const page = await (await browser.newContext(context)).newPage();
  await page.goto(`${base}/lab?dev&lang=${lang}`);
  await page.waitForFunction(() => window.lab && document.querySelector(".editor-host .blocklySvg"));
  await page.evaluate(
    ([s, angle]) => {
      window.lab.set({ moving: false, markers: true, ...s });
      window.lab.robotAt(angle);
      window.lab.step();
    },
    [settings, BEHIND],
  );
  if (!controls) await page.click(".lab-fold");
  await page.waitForTimeout(300);
  return page;
}

async function openDropdown(page) {
  const field = await page.evaluate(() => window.lab.fieldRect("go-grove", "PLACE"));
  await page.mouse.click(field.x + field.width / 2, field.y + field.height / 2);
  await page.waitForSelector(".blocklyDropDownDiv .blocklyMenuItem");
  await page.waitForTimeout(300);
}

async function shot(page, name, dir = PHASE0) {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.jpg`, dir)), type: "jpeg", quality: 82 });
  console.log(`  ${name}.jpg`);
  await page.context().close();
}

const browser = await chromium.launch();
if (want("treatments")) {
  console.log("Treatments, day and dusk:");
  for (const treatment of ["classic", "calm", "bold"]) {
    for (const world of ["day", "dusk"]) await shot(await openLab(browser, { treatment, world, opacity: 0.6 }), `${treatment}-${world}`);
  }
}

if (want("opacity")) {
  console.log("Background opacity:");
  for (const [treatment, world] of [
    ["calm", "day"],
    ["bold", "dusk"],
  ]) {
    for (const opacity of [0.3, 0.6, 0.85]) await shot(await openLab(browser, { treatment, world, opacity }), `${treatment}-${world}-${Math.round(opacity * 100)}`);
  }
}

if (want("blur")) {
  console.log("Blur:");
  for (const [treatment, world] of [
    ["calm", "day"],
    ["bold", "dusk"],
  ]) {
    await shot(await openLab(browser, { treatment, world, opacity: 0.4, blur: true }), `${treatment}-${world}-40-blur`);
    await shot(await openLab(browser, { treatment, world, opacity: 0.4, blur: false }), `${treatment}-${world}-40`);
  }
}

if (want("dropdowns")) {
  console.log("Dropdowns:");
  for (const treatment of ["calm", "bold"]) {
    const page = await openLab(browser, { treatment, world: "day", opacity: 0.6 });
    await openDropdown(page);
    await shot(page, `${treatment}-dropdown`);
  }
}

// Frame times with the robot moving, blur off and on. Headless Chromium draws
// WebGL in software, so these compare blur with none on this machine; they
// say nothing of an iPad's GPU.
if (want("frames")) {
  console.log("Frame times:");
  const frames = {};
  for (const blur of [false, true]) {
    const page = await openLab(browser, { treatment: "calm", world: "day", opacity: 0.4, blur, moving: true });
    await page.waitForTimeout(3000);
    frames[blur ? "blur" : "none"] = await page.evaluate(() => window.lab.frames());
    await page.context().close();
  }
  console.log(frames);
  writeFileSync(new URL("frames.json", PHASE0), `${JSON.stringify({ note: "headless Chromium, software WebGL, 1440x900; for comparing blur with none only", frames }, null, 2)}\n`);
}

// Every language besides English (German is the long-text language), and the
// pseudo-language, which shows text no catalogue gave in plain letters and text
// cut off without its closing bracket.
if (want("languages")) {
  console.log("Languages:");
  for (const lang of [...TRANSLATED, "pseudo"]) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 700 }, locale: "en-US" })).newPage();
    await page.goto(`${base}/?dev&lang=${lang}`);
    await page.waitForSelector(".home");
    await shot(page, `home-${lang}`, LANGUAGES);
    await shot(await openLab(browser, { treatment: "calm", world: "day", opacity: 0.6 }, { lang, controls: true }), `lab-${lang}`, LANGUAGES);
  }
  for (const lang of TRANSLATED) {
    await shot(await openLab(browser, { treatment: "calm", world: "day", opacity: 0.6 }, { lang }), `calm-day-${lang}`, LANGUAGES);
    await shot(await openLab(browser, { treatment: "bold", world: "dusk", opacity: 0.6 }, { lang }), `bold-dusk-${lang}`, LANGUAGES);
    for (const [category, name] of [
      [1, "robot"],
      [3, "control"],
      [4, "sensing"],
    ]) {
      const page = await openLab(browser, { treatment: "calm", world: "day", opacity: 0.6 }, { lang });
      await page.evaluate((n) => window.lab.workspace().getToolbox().selectItemByPosition(n), category);
      await page.waitForTimeout(300);
      await shot(page, `calm-toolbox-${name}-${lang}`, LANGUAGES);
    }
    const page = await openLab(browser, { treatment: "calm", world: "day", opacity: 0.6 }, { lang });
    await openDropdown(page);
    await shot(page, `calm-dropdown-${lang}`, LANGUAGES);
  }
}
// The world lab `ticks` steps on, each robot and building at its block; and the
// editor with a broken program, its warnings worded at their blocks.
if (want("programs")) {
  console.log("Programs:");
  for (const [lang, ticks] of [
    ["en", 2],
    ["de", 2],
    ["en", 300],
  ]) {
    const page = await (await browser.newContext(DESKTOP)).newPage();
    await page.goto(`${base}/world?dev&lang=${lang}`);
    await page.waitForFunction(() => window.world && document.querySelector(".world-table tbody tr"));
    await page.evaluate((n) => {
      for (let i = 0; i < n; i++) window.world.game.step();
    }, ticks);
    await page.waitForTimeout(300);
    await shot(page, `world-${ticks}-${lang}`, PHASE2);
  }
  for (const lang of ["en", "de"]) {
    const page = await openLab(browser, { treatment: "calm", world: "day", opacity: 0.6, markers: false }, { lang });
    await page.evaluate(() => {
      window.lab.load({
        blocks: {
          languageVersion: 0,
          blocks: [
            { type: "island_when_started", id: "start", x: 40, y: 90, next: { block: { type: "controls_repeat_ext", id: "repeat", inputs: { DO: { block: { type: "robot_collect", id: "collect", fields: { ITEM: "wood" } } } } } } },
            { type: "robot_unload", id: "stray", x: 70, y: 300 },
          ],
        },
      });
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      for (const id of ["repeat", "stray"]) {
        window.lab.workspace().getBlockById(id).getIcons().find((i) => i.getType().toString() === "warning").setBubbleVisible(true);
      }
    });
    await page.waitForTimeout(300);
    await shot(page, `lab-problems-${lang}`, PHASE2);
  }
}
// The island in 3D, `ticks` steps on, with `chosen` selected, turned `turn`
// quarter turns, in graphics `quality`, and `before(page)` done first.
async function openIsland(browser, { context = DESKTOP, lang = "en", ticks = 0, chosen = null, turn = 0, quality = "high", panel = null, before = null } = {}) {
  const page = await (await browser.newContext(context)).newPage();
  await page.addInitScript((q) => localStorage.setItem("robot-island:display", JSON.stringify({ quality: q })), quality);
  await page.goto(`${base}/island?dev&lang=${lang}`);
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag"));
  if (before) await before(page);
  await page.evaluate(
    ([n, id]) => {
      for (let i = 0; i < n; i++) window.islandPage.game.step();
      window.islandPage.select(id);
    },
    [ticks, chosen],
  );
  for (let i = 0; i < turn; i++) await page.click('[data-view="right"]');
  if (panel) await page.evaluate(([kind, program]) => window.islandPage.open(kind, program), panel);
  await page.waitForTimeout(900);
  return page;
}
// Robo 3 joins Robo 1 on the collector's program.
const share = (page) =>
  page.evaluate(() => {
    window.islandPage.game.queue({ type: "assign", entity: "r3", program: "collector" });
    for (let i = 0; i < 20; i++) window.islandPage.game.step();
  });
// The collector's draft changed, its marks hidden, and the change applied, to
// start at the next step.
async function changeAndApply(page) {
  await page.evaluate(() => window.islandPage.editor().workspace.getBlockById("collector-go-sawmill").getField("PLACE").setValue("depot"));
  await page.waitForTimeout(500);
}
if (want("island")) {
  console.log("The island:");
  await shot(await openIsland(browser), "island-start", PHASE3);
  await shot(await openIsland(browser, { ticks: 30, chosen: "r1" }), "island-collecting", PHASE3);
  await shot(await openIsland(browser, { ticks: 249, chosen: "r2" }), "island-bridge", PHASE3);
  await shot(await openIsland(browser, { ticks: 60, chosen: "sawmill", turn: 1 }), "island-turned", PHASE3);
  await shot(await openIsland(browser, { ticks: 60, chosen: "sawmill", lang: "de" }), "island-de", PHASE3);
  await shot(await openIsland(browser, { ticks: 30, quality: "low" }), "island-simple", PHASE3);
}
if (want("debugger")) {
  console.log("The debugger:");
  for (const lang of ["en", "de"]) {
    await shot(await openIsland(browser, { lang, ticks: 2, chosen: "sawmill", panel: ["together"] }), `together-${lang}`, PHASE4);
    await shot(await openIsland(browser, { lang, ticks: 30, chosen: "r1", panel: ["editor", "collector"] }), `editor-${lang}`, PHASE4);
  }
  await shot(await openIsland(browser, { before: share, chosen: "r3", ticks: 8, panel: ["together"] }), "together-shared", PHASE4);
  const changed = await openIsland(browser, { ticks: 30, chosen: "r1", panel: ["editor", "collector"] });
  await changeAndApply(changed);
  await changed.waitForTimeout(300);
  await changed.screenshot({ path: fileURLToPath(new URL("editor-changed.jpg", PHASE4)), type: "jpeg", quality: 82 });
  console.log("  editor-changed.jpg");
  await changed.click('[data-code="apply"]');
  await changed.waitForTimeout(300);
  await shot(changed, "editor-applied", PHASE4);
}
await browser.close();

if (want("island") || want("debugger")) {
  const safari = await webkit.launch();
  if (want("island")) await shot(await openIsland(safari, { context: IPAD, ticks: 30, chosen: "site" }), "island-ipad", PHASE3);
  if (want("debugger")) {
    await shot(await openIsland(safari, { context: IPAD, ticks: 2, chosen: "sawmill", panel: ["together"] }), "together-ipad", PHASE4);
    await shot(await openIsland(safari, { context: IPAD, ticks: 30, chosen: "r1", panel: ["editor", "collector"] }), "editor-ipad", PHASE4);
  }
  await safari.close();
}

if (want("ipad") || want("languages")) {
  console.log("iPad (WebKit, 1194x834 at 2x):");
  const safari = await webkit.launch();
  if (want("ipad")) {
    await shot(await openLab(safari, { treatment: "calm", world: "day", opacity: 0.6 }, { context: IPAD }), "ipad-calm-day");
    await shot(await openLab(safari, { treatment: "bold", world: "dusk", opacity: 0.6 }, { context: IPAD }), "ipad-bold-dusk");
  }
  if (want("languages")) {
    for (const lang of TRANSLATED) {
      await shot(await openLab(safari, { treatment: "calm", world: "day", opacity: 0.6 }, { context: IPAD, lang, controls: true }), `ipad-calm-day-${lang}`, LANGUAGES);
    }
  }
  await safari.close();
}

await server.close();
