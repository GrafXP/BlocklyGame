import { test, expect } from "@playwright/test";
import { ISLAND } from "../src/content/island.js";
import { advanceWorld, createWorld } from "../src/sim/world.js";
import { stateHash } from "../src/sim/replay.js";

// The Phase 1 acceptance in a browser (PLAN.md §11): the world lab's Run, Pause
// and Step on the one world clock, the same world as Node's for the same ticks,
// and a change of language that leaves the world as it was.

const world = (page, fn, arg) => page.evaluate(fn, arg);
const tick = (page) => world(page, () => window.world.game.world.tick);
const hash = (page) => world(page, () => window.world.hash());

async function openWorld(page, query = "") {
  await page.goto(`/world?dev${query}`);
  await page.waitForFunction(() => window.world && document.querySelector(".world-table tbody tr"));
}

// The world Node gets from `ticks` ticks of the island.
function nodeWorld(ticks) {
  const w = createWorld(ISLAND);
  while (w.tick < ticks) advanceWorld(w);
  return w;
}

test("the world opens paused; Step advances it exactly one tick, every robot and building with it", async ({ page }) => {
  await openWorld(page);
  await expect(page.locator(".ticks")).toHaveText("Steps: 0");
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.locator(".ticks")).toHaveText("Steps: 1");
  expect(await world(page, () => window.world.game.trace.evaluated.map((e) => e.entity))).toEqual(["r1", "r2", "r3", "sawmill", "site"]);
  await expect(page.locator('tr[data-id="r1"]')).toContainText("On the way to Grove");
  await expect(page.locator('tr[data-id="r3"]')).toContainText("No way to Stone pit");

  // Paused, nothing changes, however long.
  const before = await hash(page);
  await page.waitForTimeout(600);
  expect(await hash(page)).toBe(before);
  expect(await tick(page)).toBe(1);
});

test("Run moves the clock at the chosen speed, Pause stops it, and the world is Node's for the same ticks", async ({ page }) => {
  await openWorld(page);
  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Pause" }).click();
  const slow = await tick(page);
  expect(slow).toBeGreaterThanOrEqual(4); // ten a second at 1×, give or take a slow machine
  expect(slow).toBeLessThanOrEqual(14);
  await page.waitForTimeout(400);
  expect(await tick(page)).toBe(slow);

  await page.getByRole("button", { name: "4×" }).click();
  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Pause" }).click();
  expect((await tick(page)) - slow).toBeGreaterThan(20);

  // Whatever the browser's frames were, the world is the one Node makes from
  // the same number of ticks.
  expect(await hash(page)).toBe(stateHash(nodeWorld(await tick(page))));
  expect(await world(page, () => window.world.problems())).toEqual([]);
});

test("switching language reopens the page with the world exactly as it was, and paused", async ({ page }) => {
  await openWorld(page);
  await page.getByRole("button", { name: "4×" }).click();
  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(800);
  // Switching while it runs: the world stops where it is.
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "Deutsch" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "de" && window.world);
  await expect(page.getByRole("button", { name: "Los" })).toBeVisible();
  const ticks = await tick(page);
  const before = await hash(page);
  await page.waitForTimeout(400);
  expect(await tick(page)).toBe(ticks);
  await expect(page.locator(".ticks")).toHaveText(`Schritte: ${ticks}`);

  await page.getByRole("group", { name: "Sprache" }).getByRole("button", { name: "English" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "en" && window.world);
  expect(await hash(page)).toBe(before);
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
});

test("Start again gives a new world at step 0", async ({ page }) => {
  await openWorld(page);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.locator(".ticks")).toHaveText("Steps: 3");
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(page.locator(".ticks")).toHaveText("Steps: 0");
  expect(await hash(page)).toBe(stateHash(createWorld(ISLAND)));
});

test("leaving the world lab lets go of everything it made", async ({ page }) => {
  await openWorld(page);
  await page.getByRole("button", { name: "Run" }).click();
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home")).toBeVisible();
  expect(await page.evaluate(() => ({ ...window.island.counts(), hooks: typeof window.world }))).toEqual({ bins: 0, listeners: 0, hooks: "undefined" });
  // The world waited, paused, for the next visit.
  await page.getByRole("link", { name: "World lab" }).click();
  await page.waitForFunction(() => window.world);
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
});
