import { test, expect } from "@playwright/test";
import { letsGo, seedCampaign, solveMission } from "./campaign-seed.js";
import { openDrawer } from "./ui.js";

// The campaign in a browser (PLAN.md §11, Phase 7; docs/campaign-planv2.md):
// at /play, from a fresh player's mission 1, its program the start block
// alone, on to the next, each mission beginning with its briefing and ending
// with the win; the mission card's one goal, its prediction, hints that answer
// the problem in view, and “Show me a start”; a building's program the child
// writes; missions played again on their own; free play after mission 15, the
// sandbox after 25; and the title page's Start over. Later missions start from
// a campaign saved at them (campaign-seed.js).

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
// The island page open; and past its mission's briefing, ready to play.
const opened = async (page) => {
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
};
const ready = async (page) => {
  await opened(page);
  await letsGo(page);
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

test("a fresh player starts at mission 1 with its briefing: the card asks for a guess, the program is the start block alone, the editor offers only “go to”, and the win leads on to mission 2, which a reload keeps", async ({ page }) => {
  await page.goto("/?dev");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?dev");
  await expect(page.locator(".home .play")).toHaveText("Play");
  await expect(page.locator(".home .free")).toBeHidden();
  await expect(page.locator(".home .free-note")).toHaveText("Free play opens after mission 15.");
  await page.locator(".home .play").click();
  await opened(page);
  // The mission begins with its briefing: what it's about, and Let's go.
  const briefing = page.locator(".briefing");
  await expect(briefing).toBeVisible();
  await expect(briefing.locator(".briefing-chapter")).toHaveText("Chapter 1 · Mission 1");
  await expect(briefing.locator("h2")).toHaveText("Hello, Helper!");
  await expect(briefing.locator(".briefing-goal")).toHaveText("Send Robo 1 to the grove.");
  await expect(briefing.locator(".briefing-setup")).toContainText("Give it a “go to” block to reach the grove");
  await expect(briefing.locator(".goal")).toHaveText(["Robo 1 → Grove"]);
  await briefing.getByRole("button", { name: "Let's go!" }).click();
  await expect(briefing).toBeHidden();
  await expect(page).toHaveTitle("Hello, Helper! · BlocklyBots");
  await expect(page.locator(".mission-chapter")).toHaveText("Chapter 1 · Mission 1");
  await expect(page.locator(".mission-goal")).toHaveText("Send Robo 1 to the grove.");
  await expect(page.locator(".mission-card .goal")).toHaveText(["Robo 1 → Grove"]);
  await expect(page.locator('[data-panel="library"]')).toBeVisible();
  await expect(page.locator("[data-build]")).toHaveCount(0);

  // The guess, by pointing at the grove.
  await page.getByRole("button", { name: "Point to it" }).click();
  await page.locator('.tag[data-pick="grove"]').click();
  await expect(page.locator(".mission-predict")).toHaveText("Your guess: Grove");

  // The mission's panel opens from its title, with the program to open.
  await expect(page.locator(".mission-panel")).toBeHidden();
  await openDrawer(page, "mission");
  await page.getByRole("button", { name: "Open the program" }).click();
  await expect(page.locator(".mission-panel")).toBeHidden(); // it would lie over the editor
  await expect(page.locator(".code-title")).toHaveText("Mission 1: Robo 1");
  expect(await island(page, () => window.islandPage.editor().workspace.getAllBlocks(false).map((b) => b.type))).toEqual(["island_when_started"]);
  expect(await toolbox(page)).toEqual({ Robot: ["robot_go_to"] });
  expect(await solveMission(page)).toBeLessThanOrEqual(150);
  await frames(page);
  // Done: the win, the world paused behind it, Next mission the big button.
  const win = page.locator(".win");
  await expect(win).toBeVisible();
  await expect(win.locator("h2")).toHaveText("Mission complete!");
  await expect(win.locator(".win-mission")).toHaveText("Mission 1: Hello, Helper!");
  await expect(win.locator(".win-reward")).toHaveText("Robo 1 found the grove!");
  await expect(win.locator(".win-next")).toHaveText("Next mission");
  await expect(win.locator(".win-next")).toBeFocused();
  expect(await island(page, () => window.islandPage.game.clock.running)).toBe(false);
  // Keep playing: back to the island, whose card offers the next mission too.
  await win.getByRole("button", { name: "Keep playing" }).click();
  await expect(win).toBeHidden();
  await expect(page.locator(".mission-card")).toHaveClass(/done/);
  await expect(page.locator(".mission-done")).toHaveText("Done! Robo 1 found the grove!");
  await expect(page.locator(".mission-explain")).toContainText("Tell someone what your block told Robo 1 to do.");
  await page.locator(".mission-next").getByRole("button", { name: "Next mission" }).click();
  await opened(page);
  await expect(page.locator(".briefing h2")).toHaveText("One Piece of Wood");
  await letsGo(page);
  await expect(page.locator(".island-bar h1")).toHaveText("One Piece of Wood");
  await expect(page.locator(".clock .ticks")).toHaveText("0");
  const grove = await island(page, () => window.islandPage.game.world.nodes.find((n) => n.id === "grove").access);
  expect(grove).toContain(await island(page, () => window.islandPage.game.world.entities.find((e) => e.id === "r1").cell));
  expect(await island(page, () => window.islandPage.library().programs.map((p) => p.id)), "mission 2's own programs alone").toEqual(["c2-m002"]);

  await page.reload();
  await ready(page);
  await expect(page.locator(".island-bar h1")).toHaveText("One Piece of Wood");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home .play")).toHaveText("Mission 2: One Piece of Wood");
  await expect(page.locator(".missions .chapter li.done")).toHaveCount(1);
  await expect(page.locator(".missions .chapter li.done")).toContainText("Hello, Helper!");
});

test("a mission has one goal, from one start: once it's met the mission is done, and the win's Next mission goes on", async ({ page }) => {
  await seedCampaign(page, "c2-m016");
  await page.goto("/play?dev");
  await ready(page);
  await expect(page.locator(".mission-card .goal")).toHaveText(["Depot · Planks: 0 of 2"]);
  await openDrawer(page, "mission");
  for (let i = 0; i < 3; i++) await page.locator(".mission-hint").click();
  await page.getByRole("button", { name: "Show me the whole program" }).click();
  await expect(page.locator(".code-state")).toHaveText(/^Changed/);
  await page.waitForTimeout(400);
  await page.locator('[data-code="apply"]').click();
  await island(page, () => window.islandPage.close());
  const seen = await runUntil(page, (w) => w.mission.done !== null);
  await frames(page);
  expect(await island(page, () => window.islandPage.game.world.mission.done)).toBeLessThanOrEqual(seen);
  await expect(page.locator(".mission-card .goal.met")).toHaveText(["Depot · Planks: 2 of 2"]);
  await expect(page.locator(".mission-card")).toHaveClass(/done/);
  await page.locator(".win").getByRole("button", { name: "Next mission" }).click();
  await opened(page);
  await expect(page.locator(".briefing h2")).toHaveText("Only When We Need It");
  expect(await island(page, () => window.islandPage.play().mission.id)).toBe("c2-m017");
});

test("the hints answer the problem in view, and the card offers one once everything has come to a stop", async ({ page }) => {
  await seedCampaign(page, "c2-m008");
  await page.goto("/play?dev");
  await ready(page);
  await expect(page.locator(".mission-stuck")).toBeHidden();
  await runUntil(page, (w) => !!w.stall);
  await page.getByRole("button", { name: "Pause" }).click();
  await frames(page);
  await expect(page.locator(".mission-stuck")).toBeVisible();
  await expect(page.locator(".mission-hint")).toHaveClass(/offer/);
  // The bubble's Hint gives the first hint, in the mission's panel, which opens.
  await expect(page.locator(".mission-panel")).toBeHidden();
  await page.locator(".coach-hint").click();
  await expect(page.locator(".mission-panel")).toBeVisible();
  await expect(page.locator(".coach-hint")).toBeHidden();
  expect(await island(page, () => window.islandPage.selected)).toBe("r1");
  await page.locator(".mission-hint").click();
  await expect(page.locator(".mission-hints .hint-think")).toHaveText("Think: The basket is full. What must happen before Robo 1 can pick up more?");
});

test("the help offers a start; Starter program goes back to the start block alone, and “Undo changes” brings the blocks back", async ({ page }) => {
  await seedCampaign(page, "c2-m005");
  await page.goto("/play?dev");
  await ready(page);
  await openDrawer(page, "mission");
  for (let i = 0; i < 3; i++) await page.locator(".mission-hint").click();
  await page.getByRole("button", { name: "Show me a start" }).click();
  await expect(page.locator(".code-title")).toHaveText("Mission 5: Robo 1");
  const blocks = () => island(page, () => window.islandPage.editor().workspace.getAllBlocks(true).filter((b) => !b.isShadow()).map((b) => b.type));
  expect(await blocks()).toEqual(["island_when_started", "robot_go_to", "robot_pick_up"]);
  await page.waitForTimeout(400);
  await page.locator('[data-code="apply"]').click();
  await expect(page.getByRole("button", { name: "Start from nothing" })).toHaveCount(0);
  await page.getByRole("button", { name: "Starter program" }).click();
  expect(await blocks()).toEqual(["island_when_started"]);
  await page.getByRole("button", { name: "Undo changes" }).click();
  expect(await blocks()).toEqual(["island_when_started", "robot_go_to", "robot_pick_up"]);
  expect(await island(page, () => window.islandPage.editor().workspace.getBlockById("c2-m005-start").isDeletable())).toBe(false);
});

test("the title page's mission map: stars for the missions done, the one the campaign is at to go on with, the rest locked; with ?dev every one opens on its own", async ({ page }) => {
  await seedCampaign(page, "c2-m005");
  await page.goto("/");
  await expect(page.locator(".missions .chapter")).toHaveCount(12);
  await expect(page.locator(".missions .chapter-1 h3")).toHaveText("Chapter 1: Hello, Helper!4/5");
  await expect(page.locator(".missions .chapter li.done")).toHaveCount(4);
  await expect(page.locator(".missions .chapter li.done").first()).toContainText("Play again");
  await expect(page.locator(".missions .chapter li.current")).toHaveText(["5Camp Is ReadyYou're here"]);
  await expect(page.locator(".missions .chapter li.later")).toHaveCount(55);
  await expect(page.locator(".missions .chapter li.later a")).toHaveCount(0);
  await expect(page.locator(".dev-note")).toHaveCount(0);
  await expect(page.locator(".grown-ups")).not.toHaveAttribute("open");
  await page.locator(".missions .chapter li.current a").click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator(".island-bar h1")).toHaveText("Camp Is Ready");

  await page.goto("/?dev");
  await expect(page.locator(".dev-note")).toBeVisible();
  await expect(page.locator(".grown-ups")).toHaveAttribute("open");
  await expect(page.locator(".missions .chapter li.later")).toHaveCount(0);
  await expect(page.locator(".missions .chapter li.open")).toHaveCount(55);
  await page.locator('.missions .chapter li[value="12"]').getByRole("link", { name: "Try it" }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/replay\?mission=c2-m012&dev$/);
  await expect(page.locator(".mission-chapter")).toHaveText("Chapter 3 · Mission 12");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home .play")).toHaveText("Mission 5: Camp Is Ready");
});

test("a mission done before can be played again from its start, and the campaign stays as it was", async ({ page }) => {
  await seedCampaign(page, "c2-m005");
  await expect(page.locator(".home .play")).toHaveText("Mission 5: Camp Is Ready");
  await page.locator(".missions .chapter li").nth(2).getByRole("link", { name: "Play again" }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/replay\?mission=c2-m003/);
  await expect(page.locator(".mission-replay")).toHaveText("You're playing mission 3 again, from the beginning. The other missions stay as they are.");
  expect(await island(page, () => window.islandPage.library().programs.map((p) => p.id))).toEqual(["c2-m003"]);
  await solveMission(page);
  await frames(page);
  await page.locator(".win").getByRole("button", { name: "Back to the missions" }).click();
  await expect(page.locator(".home .play")).toHaveText("Mission 5: Camp Is Ready");
  const campaign = await page.evaluate(() => JSON.parse(localStorage.getItem("robot-island:save.campaign")));
  expect(campaign.mission).toBe("c2-m005");
  expect(campaign.library.programs.map((p) => p.id)).toEqual(["c2-m005"]);
});

test("free play opens after mission 15 with programs of its own, and grows into the sandbox after 25", async ({ page }) => {
  await seedCampaign(page, "c2-m016");
  await expect(page.locator(".home .free")).toHaveText("Free play");
  await page.locator(".home .free").click();
  await ready(page);
  await expect(page.locator(".island-bar h1")).toHaveText("Free play");
  await expect(page.locator('[data-panel="library"]')).toBeVisible();
  await expect(page.locator('[data-build], [data-sandbox]')).toHaveCount(0);
  const programs = await island(page, () => window.islandPage.library().programs.map((p) => p.id));
  expect(programs).toContain("collector");
  expect(programs.filter((id) => /^c2-/.test(id)), "the missions' programs stay in them").toEqual([]);

  await seedCampaign(page, "c2-m025", { done: true });
  await expect(page.locator(".home .free")).toHaveText("Sandbox");
  await page.locator(".home .free").click();
  await ready(page);
  await expect(page.locator(".island-bar h1")).toHaveText("Sandbox");
  await page.getByRole("button", { name: "Add a robot" }).click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await openDrawer(page, "overview");
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
  await seedCampaign(page, "c2-m005");
  await page.getByRole("button", { name: "Start over…" }).click();
  await expect(page.locator(".start-over .ask")).toBeVisible();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.locator(".start-over .ask")).toBeHidden();
  await page.getByRole("button", { name: "Start over…" }).click();
  await page.locator(".start-over .ask").getByRole("button", { name: "Start over" }).click();
  await expect(page.locator(".home .play")).toHaveText("Play");
  await expect(page.locator(".start-over")).toBeHidden();
  await expect(page.locator(".missions .chapter li.done")).toHaveCount(0);
  await expect(page.locator(".missions .chapter li.current")).toContainText("You're here");
  expect(await page.evaluate(() => localStorage.getItem("robot-island:save.campaign"))).toBeNull();
});

test("in mission 15 the child writes the construction site's program, while the courier brings its planks; the bridge opens free play", async ({ page }) => {
  await page.goto("/?dev");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/replay?mission=c2-m015&dev");
  await opened(page);
  await expect(page.locator(".briefing h2")).toHaveText("Across the Stream");
  await letsGo(page);
  await openDrawer(page, "mission");
  await page.getByRole("button", { name: "Open the program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Mission 15: Construction site");
  expect(await island(page, () => window.islandPage.editor().workspace.getAllBlocks(false).map((b) => b.type))).toEqual(["island_when_started"]);
  expect((await toolbox(page)).Buildings).toEqual(["building_build"]);
  expect(await solveMission(page)).toBeLessThanOrEqual(600);
  await expect(page.locator(".win .win-reward")).toHaveText("The bridge is open! Robo 2 is crossing the stream to fetch stone. Free play is open too.");
  expect(await island(page, () => window.islandPage.game.world.entities.find((e) => e.id === "site").built)).toBe(true);
});

test("in mission 26 the Build tool places the workshop's site, which shows the bill it still needs; that's the mission done", async ({ page }) => {
  await seedCampaign(page, "c2-m026");
  await page.goto("/play?dev");
  await ready(page);
  await openDrawer(page, "mission");
  await expect(page.getByRole("button", { name: "Open the program" })).toHaveCount(0);
  await expect(page.locator(".mission-card .goal")).toHaveText(["Workshop: its site placed"]);
  await page.locator('[data-build="open"]').click();
  await expect(page.locator(".build-ask")).toHaveText("The workshop goes on its plot, marked on the island.");
  // The plan stands on the plot at once; a tap anywhere keeps it there.
  await expect(page.locator(".build-why")).toHaveText("It fits here. Robots bring what the construction site needs: 2 stones, 4 planks.");
  await island(page, () => window.islandPage.aimAt(12, 20));
  expect(await island(page, () => window.islandPage.placing())).toMatchObject({ at: { x: 24, z: 16 }, facing: "south" });
  await page.locator('[data-build="place"]').click();
  await island(page, () => window.islandPage.game.step());
  await frames(page);
  await expect(page.locator(".win .win-reward")).toHaveText("The workshop has its site! Tap it to see the pieces it still needs.");
  expect(await island(page, () => window.islandPage.game.world.entities.find((e) => e.id === "workshop").type)).toBe("site");
});

test("in mission 28 the plan starts on the plot that would block the bridge, and says so; the other plot fits, and the workshop gets built", async ({ page }) => {
  await seedCampaign(page, "c2-m028");
  await page.goto("/play?dev");
  await ready(page);
  await page.locator('[data-build="open"]').click();
  await expect(page.locator(".build-ask")).toHaveText("The workshop goes on one of the plots marked on the island. Tap one to choose it.");
  await expect(page.locator('[data-build="turn"]')).toBeHidden();
  await expect(page.locator(".build-why")).toHaveText("Robots couldn't get to this any more: Stone pit");
  await expect(page.locator('[data-build="place"]')).toBeDisabled();
  await island(page, () => window.islandPage.aimAt(26, 18));
  expect(await island(page, () => window.islandPage.placing())).toMatchObject({ at: { x: 24, z: 16 }, facing: "south" });
  await expect(page.locator(".build-why")).toHaveText("It fits here. Robots bring what the construction site needs: 2 stones, 4 planks.");
  await page.locator('[data-build="place"]').click();
  await island(page, () => window.islandPage.game.step());
  await frames(page);
  expect(await island(page, () => window.islandPage.game.world.mission.done)).not.toBeNull();
  await expect(page.locator(".win .win-reward")).toHaveText("The site has a way in! Watch Robo 1 bring the pieces, and the workshop being built.");
  expect(await runUntil(page, (w) => w.entities.find((e) => e.id === "workshop").type === "workshop")).toBeLessThan(1500);
});
