import { test, expect } from "@playwright/test";
import { seedCampaign, solveMission } from "./campaign-seed.js";

// The Phase 7 acceptance in a browser (PLAN.md §11): the campaign at /play,
// from a fresh player's mission 1 on to the next; the mission card's
// prediction, hints that answer the problem in view, trials, “Show me a
// start” and starting from nothing; missions played again on their own; free
// play after mission 15, the sandbox after 25; and the title page's Start
// over. Later missions start from a campaign saved at them (campaign-seed.js).

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
};
// The block types in each category of the editor's toolbox.
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
// Runs the clock at 4× until `done(world)` holds or the clock stops.
const runUntil = (page, done) =>
  island(
    page,
    (test) =>
      new Promise((resolve) => {
        const holds = new Function("w", `return (${test})(w)`);
        const game = window.islandPage.game;
        game.clock.setSpeed(4);
        game.run();
        const look = () => (holds(game.world) || !game.clock.running ? resolve(game.world.tick) : setTimeout(look, 50));
        look();
      }),
    done.toString(),
  );

test("a fresh player starts at mission 1: the card asks for a guess, the editor offers only “go to”, and done leads on to mission 2, which a reload keeps", async ({ page }) => {
  await page.goto("/?dev");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?dev");
  await expect(page.locator(".home .play")).toHaveText("Play");
  await expect(page.locator(".home .free")).toBeHidden();
  await expect(page.locator(".home .free-note")).toHaveText("Free play opens after mission 15.");
  await page.locator(".home .play").click();
  await ready(page);
  await expect(page).toHaveTitle("Hello, Helper! · Robot Island");
  await expect(page.locator(".mission-chapter")).toHaveText("Chapter 1 · Mission 1");
  await expect(page.locator(".mission-goal")).toHaveText("Help Robo 1 find the grove.");
  await expect(page.locator(".goal")).toHaveText(["Robo 1 → Grove"]);
  await expect(page.locator('[data-panel="library"]')).toBeVisible();
  await expect(page.locator("[data-build]")).toHaveCount(0);

  // The guess, by pointing at the grove.
  await page.getByRole("button", { name: "Point to it" }).click();
  await page.locator('.tag[data-pick="grove"]').click();
  await expect(page.locator(".mission-predict")).toHaveText("Your guess: Grove");

  await page.getByRole("button", { name: "Open the program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Mission 1: Robo 1");
  expect(await toolbox(page)).toEqual({ Robot: ["robot_go_to"] });
  expect(await solveMission(page)).toBeLessThanOrEqual(150);
  await frames(page);
  await expect(page.locator(".mission-card")).toHaveClass(/done/);
  await expect(page.locator(".mission-done")).toHaveText("Done! Robo 1 found the grove!");
  await expect(page.locator(".mission-explain")).toContainText("Tell someone what your block told Robo 1 to do.");
  await page.getByRole("button", { name: "Next mission" }).click();
  await ready(page);
  await expect(page.locator(".island-bar h1")).toHaveText("One Piece of Wood");
  await expect(page.locator(".clock .ticks")).toHaveText("Steps: 0");
  const grove = await island(page, () => window.islandPage.game.world.nodes.find((n) => n.id === "grove").access);
  expect(grove).toContain(await island(page, () => window.islandPage.game.world.entities.find((e) => e.id === "r1").cell));

  await page.reload();
  await ready(page);
  await expect(page.locator(".island-bar h1")).toHaveText("One Piece of Wood");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home .play")).toHaveText("Mission 2: One Piece of Wood");
  await expect(page.locator(".chapter li.done")).toHaveCount(1);
  await expect(page.locator(".chapter li.done")).toContainText("Hello, Helper!");
});

test("a mission with trials pauses when one is passed, saying what changes next, then goes on to the next", async ({ page }) => {
  await seedCampaign(page, "m16");
  await page.goto("/play?dev");
  await ready(page);
  await expect(page.locator(".trial")).toHaveText(["Trial 1: One plank at the sawmill", "Trial 2: Two planks at the sawmill"]);
  await expect(page.locator(".trial.current")).toHaveText("Trial 1: One plank at the sawmill");
  for (let i = 0; i < 3; i++) await page.locator(".mission-hint").click();
  await page.getByRole("button", { name: "Show me the whole program" }).click();
  await expect(page.locator(".code-state")).toHaveText(/^Changed/);
  await page.waitForTimeout(400);
  await page.locator('[data-code="apply"]').click();
  await island(page, () => window.islandPage.close());
  const passed = await runUntil(page, (w) => w.mission.trial === 1);
  await frames(page);
  expect(await island(page, () => window.islandPage.game.clock.running)).toBe(false);
  expect(await island(page, () => window.islandPage.game.world.mission.passed)).toEqual([passed]);
  await expect(page.locator(".mission-passed")).toHaveText("Trial 1 passed! Next: Two planks at the sawmill. Press Run.");
  await expect(page.locator(".trial.passed")).toHaveCount(1);
  await runUntil(page, (w) => w.mission.done !== null);
  await frames(page);
  await expect(page.locator(".trial.passed")).toHaveCount(2);
  await expect(page.locator(".mission-card")).toHaveClass(/done/);
});

test("the hints answer the problem in view, and the card offers one once everything has come to a stop", async ({ page }) => {
  await seedCampaign(page, "m08");
  await page.goto("/play?dev");
  await ready(page);
  await expect(page.locator(".mission-stuck")).toBeHidden();
  await runUntil(page, (w) => !!w.stall);
  await page.getByRole("button", { name: "Pause" }).click();
  await frames(page);
  await expect(page.locator(".mission-stuck")).toBeVisible();
  await expect(page.locator(".mission-hint")).toHaveClass(/offer/);
  await page.locator(".mission-hint").click();
  expect(await island(page, () => window.islandPage.selected)).toBe("r1");
  await page.locator(".mission-hint").click();
  await expect(page.locator(".mission-hints .hint-think")).toHaveText("Think: The basket is full. What must happen before another collection?");
});

test("a project offers a start, and starting from nothing; “Undo changes” brings the blocks back", async ({ page }) => {
  await seedCampaign(page, "m05");
  await page.goto("/play?dev");
  await ready(page);
  for (let i = 0; i < 3; i++) await page.locator(".mission-hint").click();
  await page.getByRole("button", { name: "Show me a start" }).click();
  await expect(page.locator(".code-title")).toHaveText("Mission 5: Robo 1");
  const blocks = () => island(page, () => window.islandPage.editor().workspace.getAllBlocks(true).filter((b) => !b.isShadow()).map((b) => b.type));
  expect(await blocks()).toEqual(["island_when_started", "robot_go_to", "robot_collect"]);
  await page.waitForTimeout(400);
  await page.locator('[data-code="apply"]').click();
  await page.getByRole("button", { name: "Start from nothing" }).click();
  expect(await blocks()).toEqual(["island_when_started"]);
  await page.getByRole("button", { name: "Undo changes" }).click();
  expect(await blocks()).toEqual(["island_when_started", "robot_go_to", "robot_collect"]);
  expect(await island(page, () => window.islandPage.editor().workspace.getBlockById("m05-start").isDeletable())).toBe(false);
});

test("the title page's mission map: stars for the missions done, the one the campaign is at to go on with, the rest locked; with ?dev every one opens on its own", async ({ page }) => {
  await seedCampaign(page, "m05");
  await page.goto("/");
  await expect(page.locator(".chapter")).toHaveCount(5);
  await expect(page.locator(".chapter-1 h3")).toHaveText("Chapter 1: Hello, Helper!4/5");
  await expect(page.locator(".chapter li.done")).toHaveCount(4);
  await expect(page.locator(".chapter li.done").first()).toContainText("Play again");
  await expect(page.locator(".chapter li.current")).toHaveText(["5Camp Is ReadyYou're here"]);
  await expect(page.locator(".chapter li.later")).toHaveCount(20);
  await expect(page.locator(".chapter li.later a")).toHaveCount(0);
  await expect(page.locator(".dev-note")).toHaveCount(0);
  await expect(page.locator(".grown-ups")).not.toHaveAttribute("open");
  await page.locator(".chapter li.current a").click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator(".island-bar h1")).toHaveText("Camp Is Ready");

  await page.goto("/?dev");
  await expect(page.locator(".dev-note")).toBeVisible();
  await expect(page.locator(".grown-ups")).toHaveAttribute("open");
  await expect(page.locator(".chapter li.later")).toHaveCount(0);
  await expect(page.locator(".chapter li.open")).toHaveCount(20);
  await page.locator('.chapter li[value="12"]').getByRole("link", { name: "Try it" }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/replay\?mission=m12&dev$/);
  await expect(page.locator(".mission-chapter")).toHaveText("Chapter 3 · Mission 12");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home .play")).toHaveText("Mission 5: Camp Is Ready");
});

test("a mission done before can be played again on its own, and the campaign stays as it was", async ({ page }) => {
  await seedCampaign(page, "m05");
  await expect(page.locator(".home .play")).toHaveText("Mission 5: Camp Is Ready");
  await page.locator(".chapter li").nth(2).getByRole("link", { name: "Play again" }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/replay\?mission=m03/);
  await expect(page.locator(".mission-replay")).toHaveText("You're playing mission 3 again. Your island and your programs in the missions stay as they are.");
  await solveMission(page);
  await frames(page);
  await page.getByRole("button", { name: "Back to the missions" }).click();
  await expect(page.locator(".home .play")).toHaveText("Mission 5: Camp Is Ready");
  const campaign = await page.evaluate(() => JSON.parse(localStorage.getItem("robot-island:save.campaign")));
  expect(campaign.mission).toBe("m05");
  expect(campaign.library.programs.find((p) => p.id === "m03").published.length).toBe(1);
});

test("free play opens after mission 15 with the player's programs, and grows into the sandbox after 25", async ({ page }) => {
  await seedCampaign(page, "m16");
  await expect(page.locator(".home .free")).toHaveText("Free play");
  await page.locator(".home .free").click();
  await ready(page);
  await expect(page.locator(".island-bar h1")).toHaveText("Free play");
  await expect(page.locator('[data-panel="library"]')).toBeVisible();
  await expect(page.locator('[data-build], [data-sandbox]')).toHaveCount(0);
  expect(await island(page, () => window.islandPage.library().programs.map((p) => p.id))).toEqual(expect.arrayContaining(["collector", "m01", "m15"]));

  await seedCampaign(page, "m25", { done: true });
  await expect(page.locator(".home .free")).toHaveText("Sandbox");
  await page.locator(".home .free").click();
  await ready(page);
  await expect(page.locator(".island-bar h1")).toHaveText("Sandbox");
  await page.getByRole("button", { name: "Add a robot" }).click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.locator('.row[data-row="r4"]')).toBeVisible();
  await page.getByRole("button", { name: "New island…" }).click();
  await page.locator('.sandbox-card select[name="robots"]').selectOption("5");
  await page.locator('.sandbox-card select[name="workshop"]').selectOption("built");
  await page.getByRole("button", { name: "Start this island" }).click();
  await ready(page);
  expect(await island(page, () => window.islandPage.game.world.entities.filter((e) => e.kind === "robot").length)).toBe(5);
  await expect(page.locator('.row[data-row="workshop"]')).toBeVisible();
});

test("Start over on the title page forgets the campaign, free play and replays, after asking", async ({ page }) => {
  await seedCampaign(page, "m05");
  await page.getByRole("button", { name: "Start over…" }).click();
  await expect(page.locator(".start-over .ask")).toBeVisible();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.locator(".start-over .ask")).toBeHidden();
  await page.getByRole("button", { name: "Start over…" }).click();
  await page.locator(".start-over .ask").getByRole("button", { name: "Start over" }).click();
  await expect(page.locator(".home .play")).toHaveText("Play");
  await expect(page.locator(".start-over")).toBeHidden();
  await expect(page.locator(".chapter li.done")).toHaveCount(0);
  await expect(page.locator(".chapter li.current")).toContainText("You're here");
  expect(await page.evaluate(() => localStorage.getItem("robot-island:save.campaign"))).toBeNull();
});
