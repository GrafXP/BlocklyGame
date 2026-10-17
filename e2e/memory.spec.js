import { test, expect } from "@playwright/test";
import { letsGo, seedCampaign, solveMission } from "./campaign-seed.js";

// Phase 8 in a browser (PLAN.md §11): variables with their values beside the
// robot, blocks of one's own that the debugger follows in and out of, and
// messages with the inbox they arrive in; in the editor's toolbox as each
// mission unlocks them, and in German. Missions start from a campaign saved at
// them (campaign-seed.js).

const frames = (page, n = 2) =>
  page.evaluate(
    (k) =>
      new Promise((r) => {
        let left = k;
        const next = () => (--left > 0 ? requestAnimationFrame(next) : r());
        requestAnimationFrame(next);
      }),
    n,
  );
const island = (page, fn, arg) => page.evaluate(fn, arg);
const ready = async (page) => {
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
  await letsGo(page);
};
const open = async (page, query = "") => {
  await page.goto(`/play?dev${query}`);
  await ready(page);
};
// What each category of the editor's toolbox offers, by block type: a
// category filled as it's opened (Memory, My blocks) as its flyout has it.
const toolbox = (page) =>
  island(page, () => {
    const box = window.islandPage.editor().workspace.getToolbox();
    const found = {};
    for (const item of box.getToolboxItems()) {
      box.setSelectedItem(item);
      found[item.getName()] = box.getFlyout().getWorkspace().getTopBlocks(false).map((b) => b.type);
    }
    box.clearSelection();
    return found;
  });
// Steps the world until `holds(world)` or `limit` steps.
const stepUntil = (page, holds, limit = 600) =>
  island(
    page,
    ([test, max]) => {
      const done = new Function("w", `return (${test})(w)`);
      const game = window.islandPage.game;
      while (!done(game.world) && game.world.tick < max) game.step();
      return game.world.tick;
    },
    [holds.toString(), limit],
  );

test("mission 26: Memory offers the program's variable, the robot's row shows what it remembers, and the order is delivered", async ({ page }) => {
  await seedCampaign(page, "m26");
  await open(page);
  await expect(page.locator('.row[data-row="r1"] .row-memory')).toHaveText("order 0");
  await page.getByRole("button", { name: "Open the program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Mission 26: Robo 1");
  const box = await toolbox(page);
  expect(box.Memory).toEqual(["variables_set", "variables_get"]);
  expect(box["My blocks"]).toBeUndefined();
  expect(await solveMission(page)).toBeLessThanOrEqual(500);
  await frames(page);
  await expect(page.locator(".mission-card")).toHaveClass(/done/);
  await expect(page.locator('.row[data-row="r1"] .row-memory')).toHaveText("order 3");
  await island(page, () => window.islandPage.select("r1"));
  await expect(page.locator(".details .memory")).toHaveText(/order\s*3/);
});

test("mission 31: My blocks offers a new block and a use of the program's own; the debugger follows Robo 1 into it and back", async ({ page }) => {
  await seedCampaign(page, "m31");
  await open(page);
  await page.getByRole("button", { name: "Open the program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Mission 31: Robo 1");
  expect((await toolbox(page))["My blocks"]).toEqual(["procedures_defnoreturn", "procedures_callnoreturn"]);
  const def = await island(page, () => {
    const b = window.islandPage.editor().workspace.getAllBlocks(false).find((it) => it.type === "procedures_defnoreturn");
    return b.toString().replace(/\s+/g, " ");
  });
  expect(def).toMatch(/^my block bring wood /);
  for (let i = 0; i < 3; i++) await page.locator(".mission-hint").click();
  await page.getByRole("button", { name: "Show me the whole program" }).click();
  await page.waitForTimeout(400);
  await page.locator('[data-code="apply"]').click();
  await island(page, () => window.islandPage.select("r1"));
  await stepUntil(page, (w) => w.entities.find((e) => e.id === "r1").runtime.frames?.length === 1);
  await frames(page);
  await expect(page.locator(".details .inspector-row", { hasText: "Inside" })).toContainText("bring wood");
  await expect(page.locator(".execution-markers .marker-badge.call")).toHaveCount(1);
  await stepUntil(page, (w) => w.mission.done !== null, 400);
  await frames(page);
  await expect(page.locator(".mission-card")).toHaveClass(/done/);
  await expect(page.locator(".execution-markers .marker-badge.call")).toHaveCount(0);
});

test("mission 36: a building's toolbox has Messages; Robo 2 waits for the note, with its inbox shown, and the plank arrives", async ({ page }) => {
  await seedCampaign(page, "m36");
  await open(page);
  await island(page, () => window.islandPage.game.step());
  await frames(page);
  await expect(page.locator('.row[data-row="r2"] .why')).toHaveText("Waiting for the message “plank ready”");
  await island(page, () => window.islandPage.select("r2"));
  await expect(page.locator(".details .inspector-row", { hasText: "Inbox" })).toContainText("empty");
  await page.getByRole("button", { name: "Open the program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Mission 36: Sawmill");
  expect((await toolbox(page)).Messages).toEqual(["message_send", "message_wait"]);
  expect(await solveMission(page)).toBeLessThanOrEqual(400);
  await frames(page);
  await expect(page.locator(".mission-card")).toHaveClass(/done/);
});

test("a message waiting in an inbox is listed there, with who sent it", async ({ page }) => {
  await seedCampaign(page, "m37");
  await open(page);
  // The workshop asks at its second step; Robo 3's program is stopped before
  // it can take the request, which waits in its inbox.
  await island(page, () => window.islandPage.game.queue({ type: "script", entity: "r3", steps: [] }));
  await stepUntil(page, (w) => !!w.entities.find((e) => e.id === "r3").inbox, 20);
  await island(page, () => window.islandPage.select("r3"));
  await frames(page);
  await expect(page.locator(".details .inbox")).toHaveText("“stone please” from Workshop");
});

test("in German, a starter's block of its own and its variables are worded in German, and so are the categories", async ({ page }) => {
  await seedCampaign(page, "m33", { query: "&lang=de" });
  await open(page, "&lang=de");
  await page.getByRole("button", { name: "Programm öffnen" }).click();
  await expect(page.locator(".code-title")).toHaveText("Auftrag 33: Robo 1");
  const words = await island(page, () =>
    window.islandPage
      .editor()
      .workspace.getAllBlocks(false)
      .filter((b) => ["procedures_defnoreturn", "procedures_callnoreturn"].includes(b.type))
      .map((b) => b.toString().replace(/\s+/g, " ")),
  );
  expect(words[0]).toMatch(/^mein Baustein Holz holen mit: Ziel gehe zu Wäldchen/);
  expect(words.slice(1)).toEqual(["Holz holen mit: Ziel Camp", "Holz holen mit: Ziel Lagerhaus"]);
  expect(Object.keys(await toolbox(page))).toEqual(expect.arrayContaining(["Merken", "Meine Bausteine"]));
  await expect(page.locator('.row[data-row="r1"] .row-memory')).toHaveCount(0);
});
