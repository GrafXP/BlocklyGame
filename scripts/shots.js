// Pictures of the editor lab for comparing the Phase 0 treatments (docs/phase0.md):
// each treatment over a bright and a dark world, a range of background
// opacities, blur, open dropdowns, and an iPad-sized screen; and how long frames
// take with blur and without. Builds the app, serves it, and writes to
// docs/phase0/. Run it after changing how the editor looks: npm run shots.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium, webkit, devices } from "@playwright/test";

const OUT = new URL("../docs/phase0/", import.meta.url);
const PORT = 4178;
const BEHIND = 3.6; // radians round its circuit: the test robot behind the editor, clear of the trees
mkdirSync(OUT, { recursive: true });

await build({ logLevel: "warn" });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: "warn" });
const base = `http://localhost:${PORT}`;

// Opens the lab in `browser` with `settings`, the robot behind the editor and
// the markers one step on (two robots at one block), and the controls folded.
async function openLab(browser, settings, context = { viewport: { width: 1440, height: 900 } }) {
  const page = await (await browser.newContext(context)).newPage();
  await page.goto(`${base}/lab?dev`);
  await page.waitForFunction(() => window.lab && document.querySelector(".editor-host .blocklySvg"));
  await page.evaluate(
    ([s, angle]) => {
      window.lab.set({ moving: false, markers: true, ...s });
      window.lab.robotAt(angle);
      window.lab.step();
    },
    [settings, BEHIND],
  );
  await page.click(".lab-fold");
  await page.waitForTimeout(300);
  return page;
}

async function shot(page, name) {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.jpg`, OUT)), type: "jpeg", quality: 82 });
  console.log(`  ${name}.jpg`);
  await page.context().close();
}

const browser = await chromium.launch();
console.log("Treatments, day and dusk:");
for (const treatment of ["classic", "calm", "bold"]) {
  for (const world of ["day", "dusk"]) await shot(await openLab(browser, { treatment, world, opacity: 0.6 }), `${treatment}-${world}`);
}

console.log("Background opacity:");
for (const [treatment, world] of [
  ["calm", "day"],
  ["bold", "dusk"],
]) {
  for (const opacity of [0.3, 0.6, 0.85]) await shot(await openLab(browser, { treatment, world, opacity }), `${treatment}-${world}-${Math.round(opacity * 100)}`);
}

console.log("Blur:");
for (const [treatment, world] of [
  ["calm", "day"],
  ["bold", "dusk"],
]) {
  await shot(await openLab(browser, { treatment, world, opacity: 0.4, blur: true }), `${treatment}-${world}-40-blur`);
  await shot(await openLab(browser, { treatment, world, opacity: 0.4, blur: false }), `${treatment}-${world}-40`);
}

console.log("Dropdowns:");
for (const treatment of ["calm", "bold"]) {
  const page = await openLab(browser, { treatment, world: "day", opacity: 0.6 });
  const field = await page.evaluate(() => window.lab.fieldRect("go-grove", "PLACE"));
  await page.mouse.click(field.x + field.width / 2, field.y + field.height / 2);
  await page.waitForSelector(".blocklyDropDownDiv .blocklyMenuItem");
  await page.waitForTimeout(300);
  await shot(page, `${treatment}-dropdown`);
}

// Frame times with the robot moving, blur off and on. Headless Chromium draws
// WebGL in software, so these compare blur with none on this machine; they
// say nothing of an iPad's GPU.
console.log("Frame times:");
const frames = {};
for (const blur of [false, true]) {
  const page = await openLab(browser, { treatment: "calm", world: "day", opacity: 0.4, blur, moving: true });
  await page.waitForTimeout(3000);
  frames[blur ? "blur" : "none"] = await page.evaluate(() => window.lab.frames());
  await page.context().close();
}
console.log(frames);
writeFileSync(new URL("frames.json", OUT), `${JSON.stringify({ note: "headless Chromium, software WebGL, 1440x900; for comparing blur with none only", frames }, null, 2)}\n`);
await browser.close();

console.log("iPad (WebKit, 1194x834 at 2x):");
const safari = await webkit.launch();
await shot(await openLab(safari, { treatment: "calm", world: "day", opacity: 0.6 }, { ...devices["iPad Pro 11 landscape"] }), "ipad-calm-day");
await shot(await openLab(safari, { treatment: "bold", world: "dusk", opacity: 0.6 }, { ...devices["iPad Pro 11 landscape"] }), "ipad-bold-dusk");
await safari.close();

await server.close();
