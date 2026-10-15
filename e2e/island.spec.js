import { test, expect } from "@playwright/test";
import { pointAt, sharedSpots } from "../src/render/grid.js";
import { robotPose } from "../src/render/pose.js";

// The Phase 3 acceptance in a browser (PLAN.md §11): the island in 3D, its robots
// and buildings chosen from any side on desktop and iPad, robots moving smoothly
// while the world runs and drawn exactly where the world has them when it's
// paused.

const frames = (page, n = 2) => page.evaluate((k) => new Promise((r) => {
  let left = k;
  const next = () => (--left > 0 ? requestAnimationFrame(next) : r());
  requestAnimationFrame(next);
}), n);
const island = (page, fn, arg) => page.evaluate(fn, arg);
const steps = (page, n) => island(page, (k) => {
  for (let i = 0; i < k; i++) window.islandPage.game.step();
}, n);
const selected = (page) => island(page, () => window.islandPage.selected);

async function openIsland(page, query = "") {
  await page.goto(`/island?dev${query}`);
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
}

// Taps (or clicks) the screen point `p`.
async function tap(page, p, touch) {
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

// Of `ids`, the first whose model shows on screen, not under a label or panel,
// and where.
async function clearSpot(page, ids) {
  return island(page, (list) => {
    for (const id of list) {
      const p = window.islandPage.screenOf(id);
      if (p && document.elementFromPoint(p.x, p.y)?.tagName === "CANVAS") return { id, ...p };
    }
    return null;
  }, ids);
}

// Where the world has each robot, in world units, when it's paused.
async function committed(page) {
  const world = await island(page, () => structuredClone(window.islandPage.game.world));
  const spots = sharedSpots(world);
  return Object.fromEntries(
    world.entities
      .filter((e) => e.kind === "robot")
      .map((r) => {
        const pose = robotPose(world, r, 0);
        const p = pointAt(world.terrain, pose.x, pose.z);
        const s = spots.get(r.id) ?? { x: 0, z: 0 };
        return [r.id, { x: p.x + s.x, z: p.z + s.z }];
      }),
  );
}
const drawn = (page) => island(page, () => Object.fromEntries(["r1", "r2", "r3"].map((id) => [id, window.islandPage.positionOf(id)])));

test("the island opens paused, with a label over every robot, building and deposit", async ({ page }) => {
  await openIsland(page);
  await expect(page.locator(".clock .ticks")).toHaveText("Steps: 0");
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  await expect(page.locator(".tag")).toHaveCount(9);
  await expect(page.getByRole("button", { name: "Robo 1: Ready" })).toBeVisible();
  await expect(page.locator(".inspector")).toContainText("Tap a robot or building");
  expect(await island(page, () => window.islandPage.problems())).toEqual([]);
});

test("tapping a robot or building in the world chooses it, and the inspector says what it's doing; tapping the water lets go", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  await openIsland(page);
  await steps(page, 30);
  await frames(page);
  for (const ids of [
    ["r1", "r2", "r3"],
    ["sawmill", "site", "depot", "quarry"],
  ]) {
    const spot = await clearSpot(page, ids);
    expect(spot, `one of ${ids} can be tapped`).not.toBeNull();
    await tap(page, spot, touch);
    expect(await selected(page)).toBe(spot.id);
    const name = await page.locator(`.tag[data-pick="${spot.id}"] .tag-name`).textContent();
    await expect(page.locator(".inspector h2")).toHaveText(name);
    await expect(page.locator(".tag.selected")).toHaveCount(1);
  }
  await expect(page.locator(".inspector dl")).not.toBeEmpty();
  const stage = await page.locator(".island-stage").boundingBox();
  await tap(page, { x: stage.x + 30, y: stage.y + 30 }, touch);
  expect(await selected(page)).toBe(null);
  await expect(page.locator(".inspector")).toContainText("Tap a robot or building");
});

test("a label or the list chooses too; the inspector shows the block, what it's doing and what it holds; Escape lets go", async ({ page }) => {
  await openIsland(page);
  await steps(page, 2);
  await page.getByRole("button", { name: "Robo 1: Moving" }).click();
  expect(await selected(page)).toBe("r1");
  const inspector = page.locator(".inspector");
  await expect(inspector.locator("h2")).toHaveText("Robo 1");
  await expect(inspector).toContainText("Moving");
  await expect(inspector.locator(".chip")).toHaveText("go to grove");
  await expect(inspector).toContainText("On the way to Grove");
  await expect(inspector).toContainText("0 of 2");
  await page.keyboard.press("Escape");
  expect(await selected(page)).toBe(null);
  await inspector.getByRole("button", { name: "Sawmill" }).click();
  expect(await selected(page)).toBe("sawmill");
  await expect(inspector).toContainText("Waiting until its condition is true");
  await expect(inspector).toContainText("Wood 0 of 4");
  // A label's mark says why on hover.
  await expect(page.locator('.tag[data-pick="site"]')).toHaveAttribute("title", "Waiting: Needs 4 planks · Construction site has 0");
  await inspector.getByRole("button", { name: "Close" }).click();
  expect(await selected(page)).toBe(null);
});

test("turned a quarter, the island is seen from another side, and its things can still be chosen there; Reset view turns it back", async ({ page }, testInfo) => {
  await openIsland(page);
  const before = await island(page, () => window.islandPage.screenOf("sawmill"));
  await page.getByRole("button", { name: "Turn right" }).click();
  await page.waitForTimeout(600); // the turn takes a moment to draw
  await frames(page);
  expect((await island(page, () => window.islandPage.camera())).turn).toBe(1);
  const after = await island(page, () => window.islandPage.screenOf("sawmill"));
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(50);
  const spot = await clearSpot(page, ["sawmill", "camp", "depot", "site"]);
  await tap(page, spot, !!testInfo.project.use.hasTouch);
  expect(await selected(page)).toBe(spot.id);
  await page.getByRole("button", { name: "Zoom in" }).click();
  expect((await island(page, () => window.islandPage.camera())).zoom).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.waitForTimeout(600);
  expect(await island(page, () => window.islandPage.camera())).toMatchObject({ turn: 0, zoom: 1 });
});

test("paused, every robot is drawn exactly where the world has it, on its way or not", async ({ page }) => {
  await openIsland(page);
  for (const n of [4, 7, 31]) {
    await steps(page, n);
    await frames(page);
    const want = await committed(page);
    const got = await drawn(page);
    for (const id of Object.keys(want)) {
      expect(got[id].x, `${id} after ${n} more steps`).toBeCloseTo(want[id].x, 5);
      expect(got[id].z, `${id} after ${n} more steps`).toBeCloseTo(want[id].z, 5);
    }
  }
});

test("running, a robot moves smoothly between its cells, never faster than it walks, and paused stands where the world has it", async ({ page }) => {
  await openIsland(page);
  await steps(page, 2); // Robo 1 sets off for the grove, ten cells away
  await page.getByRole("button", { name: "Run" }).click();
  // Sampled every frame for a second: where it's drawn, and the clock's time.
  const samples = await island(
    page,
    () =>
      new Promise((resolve) => {
        const out = [];
        const began = performance.now();
        const take = () => {
          const p = window.islandPage.positionOf("r1");
          const { world, clock } = window.islandPage.game;
          out.push([p.x, p.z, world.tick + clock.alpha]);
          if (performance.now() - began < 1000) requestAnimationFrame(take);
          else resolve(out);
        };
        requestAnimationFrame(take);
      }),
  );
  await page.getByRole("button", { name: "Pause" }).click();
  const offCentre = (v) => Math.abs(v - Math.floor(v) - 0.5) > 0.02;
  expect(samples.filter(([x, z]) => offCentre(x) || offCentre(z)).length, "between cells, often").toBeGreaterThan(3);
  for (let i = 1; i < samples.length; i++) {
    const moved = Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]);
    expect(moved, `frame ${i}`).toBeLessThanOrEqual((samples[i][2] - samples[i - 1][2]) / 3 + 1e-6); // a cell every 3 ticks
  }
  await frames(page);
  const want = await committed(page);
  const got = await drawn(page);
  expect(got.r1.x).toBeCloseTo(want.r1.x, 5);
  expect(got.r1.z).toBeCloseTo(want.r1.z, 5);
});

test("labels never cover one another", async ({ page }) => {
  await openIsland(page);
  for (const n of [0, 30, 120]) {
    await steps(page, n);
    await frames(page);
    const tags = await island(page, () => window.islandPage.tags());
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const [a, b] = [tags[i].rect, tags[j].rect];
        const apart = a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;
        expect(apart, `${tags[i].id} and ${tags[j].id} after ${n}`).toBe(true);
      }
    }
  }
});

test("the island and the world lab show one world; a change of language keeps it, the camera and the choice", async ({ page }) => {
  await openIsland(page);
  await steps(page, 12);
  await page.getByRole("button", { name: "Turn right" }).click();
  await island(page, () => window.islandPage.select("r2"));
  const hash = await island(page, () => window.islandPage.hash());

  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "Deutsch" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "de" && window.islandPage && document.querySelector(".tag"));
  await expect(page.getByRole("button", { name: "Los" })).toBeVisible();
  expect(await island(page, () => window.islandPage.hash())).toBe(hash);
  expect(await selected(page)).toBe("r2");
  expect((await island(page, () => window.islandPage.camera())).turn).toBe(1);
  await expect(page.locator(".inspector .kind")).toHaveText("Roboter");
  await expect(page.locator('.tag[data-pick="sawmill"]')).toContainText("Sägewerk");

  await page.getByRole("link", { name: "Startseite" }).click();
  await page.getByRole("link", { name: "Welt-Labor" }).click();
  await page.waitForFunction(() => window.world);
  expect(await page.evaluate(() => window.world.hash())).toBe(hash);
});

test("the graphics setting is remembered on this device", async ({ page }) => {
  await openIsland(page);
  expect(await island(page, () => window.islandPage.quality())).toBe("high");
  await page.getByRole("group", { name: "Graphics" }).getByRole("button", { name: "Simple" }).click();
  expect(await island(page, () => window.islandPage.quality())).toBe("low");
  await openIsland(page);
  expect(await island(page, () => window.islandPage.quality())).toBe("low");
  await expect(page.getByRole("group", { name: "Graphics" }).getByRole("button", { name: "Simple" })).toHaveAttribute("aria-pressed", "true");
});

test("the graphics counters say what the frames drew", async ({ page }) => {
  await openIsland(page);
  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(700);
  const stats = await island(page, () => window.islandPage.frames());
  expect(stats.calls).toBeGreaterThan(10);
  expect(stats.triangles).toBeGreaterThan(1000);
  await expect(page.locator(".counters")).toContainText("draw calls");
});

test("leaving the island lets go of everything it made", async ({ page }) => {
  await openIsland(page);
  await page.getByRole("button", { name: "Run" }).click();
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home")).toBeVisible();
  expect(await page.evaluate(() => ({ ...window.island.counts(), hooks: typeof window.islandPage }))).toEqual({ bins: 0, listeners: 0, views: 0, hooks: "undefined" });
});
