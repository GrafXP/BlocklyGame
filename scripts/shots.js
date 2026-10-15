// Pictures of the editor lab: the Phase 0 treatments (docs/phase0.md), each over
// a bright and a dark world, a range of background opacities, blur, open
// dropdowns, an iPad-sized screen, and how long frames take with blur and
// without; and the languages (docs/languages.md): German and the pseudo-language
// on the title page and in the lab. Builds the app, serves it, and writes to
// docs/phase0/ and docs/languages/. Run it after changing how the editor looks:
// npm run shots, or for some groups only: npm run shots -- languages ipad.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium, webkit, devices } from "@playwright/test";
import { LANGUAGES as LISTED, SOURCE } from "../src/i18n/languages.js";

const GROUPS = ["treatments", "opacity", "blur", "dropdowns", "frames", "ipad", "languages"];
const asked = process.argv.slice(2);
for (const group of asked) if (!GROUPS.includes(group)) throw new Error(`No group "${group}"; there are ${GROUPS.join(", ")}.`);
const want = (group) => !asked.length || asked.includes(group);

const TRANSLATED = LISTED.map((l) => l.code).filter((code) => code !== SOURCE);
const PHASE0 = new URL("../docs/phase0/", import.meta.url);
const LANGUAGES = new URL("../docs/languages/", import.meta.url);
const PORT = 4178;
const BEHIND = 3.6; // radians round its circuit: the test robot behind the editor, clear of the trees
// The game follows the browser's language; the pictures choose theirs.
const DESKTOP = { viewport: { width: 1440, height: 900 }, locale: "en-US" };
const IPAD = { ...devices["iPad Pro 11 landscape"], locale: "en-US" };
mkdirSync(PHASE0, { recursive: true });
mkdirSync(LANGUAGES, { recursive: true });

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
await browser.close();

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
