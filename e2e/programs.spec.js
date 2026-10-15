import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ISLAND_PROGRAMS } from "../src/content/programs.js";

// Programs in the editor (PLAN.md §7, §11, Phase 2): what Blockly saves is what
// the compiler reads in Node, and what the compiler finds wrong shows at its
// block, in the player's language.

const FIXTURE = JSON.parse(readFileSync(new URL("../test/fixtures/blockly-workspace.json", import.meta.url), "utf8"));
const lab = (page, fn, arg) => page.evaluate(fn, arg);

async function editorReady(page, lang = "en") {
  await page.waitForFunction((l) => document.documentElement.lang === l && window.lab && document.querySelector(".editor-host .blocklySvg"), lang);
}

test("Blockly loads the adapter's fixture and the island's programs, and saves each exactly as it was", async ({ page }) => {
  await page.goto("/lab?dev");
  await editorReady(page);
  for (const json of [FIXTURE, ...ISLAND_PROGRAMS.map((p) => p.source)]) {
    const saved = await lab(
      page,
      (j) => {
        window.lab.load(j);
        return window.lab.save();
      },
      json,
    );
    expect(saved).toEqual(json);
  }
});

test("the editor marks what can't work at its block, in the player's language, until it's put right", async ({ page }) => {
  await page.goto("/lab?dev");
  await editorReady(page);
  expect(await lab(page, () => window.lab.problems()), "the sample has no problems").toEqual([]);

  // A Repeat with no count, and a block lying beside the program.
  const broken = {
    blocks: {
      languageVersion: 0,
      blocks: [
        { type: "island_when_started", id: "start", x: 30, y: 30, next: { block: { type: "controls_repeat_ext", id: "repeat" } } },
        { type: "robot_unload", id: "stray", x: 60, y: 220 },
      ],
    },
  };
  await lab(page, (j) => window.lab.load(j), broken);
  const warning = (id) => lab(page, (i) => window.lab.warning(i), id);
  await expect.poll(() => warning("repeat")).toBe("Something is missing: put a block in this block's gap.");
  expect(await warning("stray")).toBe("This isn't under the start block, so it won't run.");
  expect(await warning("start")).toBe(null);
  expect(await lab(page, () => window.lab.problems())).toEqual([
    { code: "program.empty", block: "repeat" },
    { code: "program.unused", block: "stray" },
  ]);

  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "Deutsch" }).click();
  await editorReady(page, "de");
  await expect.poll(() => warning("repeat")).toBe("Hier fehlt etwas: Setze einen Baustein in die Lücke.");
  expect(await warning("stray")).toBe("Das hängt nicht unter dem Start-Baustein und läuft deshalb nicht.");

  // Put under the start, the stray block runs, and its warning goes.
  await lab(page, () => {
    const ws = window.lab.workspace();
    ws.getBlockById("repeat").getInput("DO").connection.connect(ws.getBlockById("stray").previousConnection);
  });
  await expect.poll(() => warning("stray")).toBe(null);
  expect(await warning("repeat")).toBe("Hier fehlt etwas: Setze einen Baustein in die Lücke.");
});

test("with no start block at all, the editor says so beside the program", async ({ page }) => {
  await page.goto("/lab?dev");
  await editorReady(page);
  await lab(page, () => window.lab.load({ blocks: { languageVersion: 0, blocks: [{ type: "robot_unload", id: "alone", x: 40, y: 40 }] } }));
  await expect(page.locator(".lab-status")).toHaveText("This program needs a “when started” block to start from.");
  await lab(page, () => window.lab.load({ blocks: { languageVersion: 0, blocks: [{ type: "island_when_started", id: "s", x: 40, y: 40 }] } }));
  await expect(page.locator(".lab-status")).toHaveText("");
});
