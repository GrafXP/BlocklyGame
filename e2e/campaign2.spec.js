import { test, expect } from "@playwright/test";
import { letsGo, solveMission } from "./campaign-seed.js";
import { openDrawer } from "./ui.js";

// The second campaign in a browser (docs/campaign-planv2.md, delivery phase
// 1): at /play2, apart from the first, listed with the prototypes on the
// title page with a map of its own. Its mission 1 begins with its briefing and
// a program that's the start block alone; the win leads on to mission 2; and
// the first campaign doesn't move.

const opened = async (page) => {
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
};
// The block types in each category of the editor's toolbox.
const toolbox = (page) =>
  page.evaluate(() => {
    const box = window.islandPage.editor().workspace.getToolbox();
    const found = {};
    for (const item of box.getToolboxItems()) {
      box.setSelectedItem(item);
      found[item.getName()] = box.getFlyout().getWorkspace().getTopBlocks(false).map((b) => b.type);
    }
    box.clearSelection();
    return found;
  });

test("the new campaign starts at its mission 1 with the start block alone; its win leads on to mission 2, on its own map, and the first campaign stays at mission 1", async ({ page }) => {
  await page.goto("/?dev");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?dev");
  const map = page.locator(".chapters2");
  await expect(map.locator(".chapter h3")).toHaveText(["Chapter 1: Hello, Helper!0/5", "Chapter 2: Do It Again0/5"]);
  await expect(map.locator("li.current")).toHaveText(/Hello, Helper!/);
  await page.getByRole("link", { name: "The new campaign" }).click();
  await opened(page);
  await expect(page).toHaveURL(/\/play2\?dev$/);

  const briefing = page.locator(".briefing");
  await expect(briefing).toBeVisible();
  await expect(briefing.locator(".briefing-chapter")).toHaveText("Chapter 1 · Mission 1");
  await expect(briefing.locator("h2")).toHaveText("Hello, Helper!");
  await expect(briefing.locator(".briefing-goal")).toHaveText("Send Robo 1 to the grove.");
  await expect(briefing.locator(".briefing-setup")).toContainText("Give it a “go to” block to reach the grove");
  await letsGo(page);

  await openDrawer(page, "mission");
  await page.getByRole("button", { name: "Open the program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Mission 1: Robo 1");
  expect(await page.evaluate(() => window.islandPage.editor().workspace.getAllBlocks(false).map((b) => b.type))).toEqual(["island_when_started"]);
  expect(await toolbox(page)).toEqual({ Robot: ["robot_go_to"] });
  expect(await solveMission(page)).toBeLessThanOrEqual(150);

  const win = page.locator(".win");
  await expect(win).toBeVisible();
  await expect(win.locator(".win-reward")).toHaveText("Robo 1 found the grove!");
  await win.locator(".win-next").click();
  await opened(page);
  await expect(page.locator(".briefing h2")).toHaveText("One Piece of Wood");
  await expect(page).toHaveURL(/\/play2\?dev$/);
  expect(await page.evaluate(() => window.islandPage.library().programs.map((p) => p.id))).toEqual(["c2-m002"]);

  await letsGo(page);
  await page.getByRole("link", { name: "Home" }).click();
  await expect(map.locator("li.done")).toHaveCount(1);
  await expect(map.locator("li.current")).toHaveText(/One Piece of Wood/);
  await expect(page.locator(".missions .chapter li.done")).toHaveCount(0);
  await expect(page.locator(".home .play")).toHaveText("Play");
});
