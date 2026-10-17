import { test, expect } from "@playwright/test";
import { SLICE } from "../src/content/missions/slice.js";
import { stateHash } from "../src/sim/replay.js";
import { letsGo } from "./campaign-seed.js";
import { advanceWorld, createWorld } from "../src/sim/world.js";

// The Phase 5 acceptance in a browser (PLAN.md §11): the bridge slice, at /slice
// since Phase 7 made /play the campaign. Pause and Step move every program's
// marker and highlight together; the bridge is built by programs changed in the
// editor alone; a reload goes on from the same step; Start again keeps the
// programs; the hints and the reward work, in English and German. The title
// page's saved state and Start over are the campaign's now
// (e2e/campaign.spec.js).

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
const steps = (page, n) =>
  island(
    page,
    (k) => {
      for (let i = 0; i < k; i++) window.islandPage.game.step();
    },
    n,
  );
const tick = (page) => island(page, () => window.islandPage.game.world.tick);
// Steps until `done(world)` holds, at most to the mission's step bound.
const stepUntil = (page, done) =>
  island(
    page,
    ([test, limit]) => {
      const holds = new Function("w", `return (${test})(w)`);
      const game = window.islandPage.game;
      while (!holds(game.world) && game.world.tick < limit) game.step();
    },
    [done.toString(), SLICE.steps],
  );

async function openPlay(page, query = "") {
  await page.goto(`/slice?dev${query}`);
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
  await letsGo(page);
}
const open = async (page, kind, program) => {
  await island(page, ([k, p]) => window.islandPage.open(k, p), [kind, program]);
  await frames(page);
};

// Where every program's runtime is, from the world itself: entity → program@block.
const running = (page) =>
  island(page, () => Object.fromEntries(window.islandPage.game.world.entities.filter((e) => e.runtime?.block).map((e) => [e.id, `${e.runtime.program}@${e.runtime.block}`])));
const marked = (page) => island(page, () => Object.fromEntries(window.islandPage.markers().map((m) => [m.entity, `${m.program ?? "editor"}@${m.block}`])));
// Each overview row's chip, and whether it's outlined as evaluated in this step.
const chips = (page) =>
  island(page, () =>
    Object.fromEntries(
      [...document.querySelectorAll(".row")].filter((r) => r.querySelector(".chip")).map((r) => [r.dataset.row, `${r.querySelector(".chip").dataset.block}${r.querySelector(".chip.fresh") ? "!" : ""}`]),
    ),
  );
// What the world says each entity evaluated in its latest tick: entity → block!.
const evaluated = (page) =>
  island(page, () => {
    const w = window.islandPage.game.world;
    return Object.fromEntries(
      w.entities.filter((e) => e.runtime?.block).map((e) => [e.id, `${e.runtime.block}${e.runtime.evaluated?.tick === w.tick && e.runtime.evaluated.block === e.runtime.block ? "!" : ""}`]),
    );
  });

// Node's slice after `ticks` ticks with no commands.
function nodeHash(ticks) {
  const w = createWorld(SLICE.content);
  while (w.tick < ticks) advanceWorld(w);
  return stateHash(w);
}

// Changes the courier to take its planks to the construction site, and puts
// Build under the site's start block, in the editor, applying each.
async function fixPrograms(page) {
  await open(page, "editor", "courier");
  await island(page, () => window.islandPage.editor().workspace.getBlockById("courier-go-depot-place").getField("PLACE").setValue("site"));
  await page.locator('[data-code="apply"]').click();
  await expect(page.locator(".code-state")).toHaveText(/Version 2 starts with the next step|Version 2 is running/);
  await open(page, "editor", "bridge");
  // Dragged by its words (its left end is the warning that it won't run) to
  // just under the start block, where it snaps on.
  const [from, to] = await island(page, () => {
    const ws = window.islandPage.editor().workspace;
    const build = ws.getBlockById("bridge-build").getSvgRoot().getBoundingClientRect();
    const start = ws.getBlockById("bridge-start").getSvgRoot().getBoundingClientRect();
    const grab = { x: build.width * 0.4, y: build.height / 2 };
    return [
      { x: build.x + grab.x, y: build.y + grab.y },
      { x: start.x + grab.x, y: start.bottom + grab.y },
    ];
  });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => island(page, () => window.islandPage.editor().workspace.getBlockById("bridge-start").getNextBlock()?.id ?? null)).toBe("bridge-build");
  await page.locator('[data-code="apply"]').click();
  await expect(page.locator(".code-state")).toHaveText(/Version 2/);
  await island(page, () => window.islandPage.close());
}

test("the mission's card says the goal, and each Step moves and highlights all four programs together", async ({ page }) => {
  await openPlay(page);
  await expect(page.locator(".island-bar h1")).toHaveText("Across the Stream");
  await expect(page).toHaveTitle("Across the Stream · Robot Island");
  await expect(page.locator(".mission-goal")).toHaveText("Work together to build our bridge.");
  await expect(page.locator(".mission-progress")).toHaveAttribute("aria-label", "Planks at the construction site: 0 of 4");
  await expect(page.locator(".mission-progress .picture.missing")).toHaveCount(5);
  await open(page, "together");
  // Robo 3's stone carrier is there too, parked: no marker until it starts.
  const programs = ["bridge", "collector", "courier", "planks", "stones"];
  await expect(page.locator(".together-panel")).toHaveCount(programs.length);
  for (const n of [1, 2, 3, 4]) {
    await page.getByRole("button", { name: "Step", exact: true }).click();
    await expect(page.locator(".clock .ticks")).toHaveText(`Steps: ${n}`);
    const want = await running(page);
    for (const program of programs) {
      await page.locator(`.together-panel[data-program="${program}"]`).scrollIntoViewIfNeeded();
      await expect.poll(() => island(page, (p) => window.islandPage.panels().find((it) => it.program === p).mounted, program)).toBe(true);
      const got = Object.entries(await marked(page)).filter(([, at]) => at.startsWith(`${program}@`));
      expect(Object.fromEntries(got), `${program}'s markers after step ${n}`).toEqual(Object.fromEntries(Object.entries(want).filter(([, at]) => at.startsWith(`${program}@`))));
    }
    // The rows' chips are at the same blocks, outlined where a block was
    // evaluated in this very step.
    expect(await chips(page), `rows after step ${n}`).toEqual(await evaluated(page));
  }
  // The site's program ended at once: nothing is under its start block yet.
  await expect(page.locator('.row[data-row="site"] .state')).toHaveText("Stopped");
  await expect(page.locator('.row[data-row="r3"] .state')).toHaveText("Stopped");
  expect(await island(page, () => window.islandPage.hash())).toBe(nodeHash(4));

  // Run, then Pause: paused, the world stands still however many frames pass.
  await page.getByRole("button", { name: "4×" }).click();
  await page.getByRole("button", { name: "Run" }).click();
  await expect.poll(() => tick(page)).toBeGreaterThan(30);
  await page.getByRole("button", { name: "Pause" }).click();
  const paused = await tick(page);
  await frames(page, 20);
  expect(await tick(page)).toBe(paused);
  expect(await island(page, () => window.islandPage.hash())).toBe(nodeHash(paused));
  await page.getByRole("button", { name: "Step", exact: true }).click();
  expect(await tick(page)).toBe(paused + 1);
  expect(await island(page, () => window.islandPage.problems())).toEqual([]);
});

test("the bridge is built by programs changed in the editor, and the game goes on after a reload", async ({ page }) => {
  await openPlay(page);
  await fixPrograms(page);
  // A while of play at 4×, then steps (quicker, and the same) to the first two
  // planks at the site.
  await page.getByRole("button", { name: "4×" }).click();
  await page.getByRole("button", { name: "Run" }).click();
  await expect.poll(() => tick(page)).toBeGreaterThan(20);
  await page.getByRole("button", { name: "Pause" }).click();
  await stepUntil(page, (w) => w.entities.find((e) => e.id === "site").store.items.plank === 2);
  await frames(page);
  await expect(page.locator(".mission-progress")).toHaveAttribute("aria-label", "Planks at the construction site: 2 of 4");
  const before = await island(page, () => ({ tick: window.islandPage.game.world.tick, hash: window.islandPage.hash() }));

  await page.reload();
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
  expect(await island(page, () => ({ tick: window.islandPage.game.world.tick, hash: window.islandPage.hash() }))).toEqual(before);
  expect(await island(page, () => window.islandPage.game.clock.running)).toBe(false);
  await expect(page.locator(".clock .ticks")).toHaveText(`Steps: ${before.tick}`);
  await expect(page.locator(".mission-progress")).toHaveAttribute("aria-label", "Planks at the construction site: 2 of 4");
  await expect(page.locator('.row[data-row="r2"] .row-program')).toHaveText("Plank courier, version 2");

  await page.getByRole("button", { name: "Run" }).click();
  await expect.poll(() => tick(page)).toBeGreaterThan(before.tick + 10);
  await page.getByRole("button", { name: "Pause" }).click();
  await stepUntil(page, (w) => w.entities.find((e) => e.id === "site").action?.type === "make");
  await expect(page.locator(".mission-building")).toBeVisible();
  await stepUntil(page, (w) => w.mission.done !== null);
  await expect(page.locator(".mission-card")).toHaveClass(/done/);
  await expect(page.locator(".mission-done")).toHaveText("Done! The bridge is open! Robo 3 is crossing the stream to fetch stone.");
  await expect(page.locator(".mission-hint")).toBeHidden();
  const { mission } = await island(page, () => window.islandPage.play());
  expect(mission.done).toBeLessThanOrEqual(SLICE.steps);
  // The reward: Robo 3 has the stone carrier's job, over the bridge.
  await expect(page.locator('.row[data-row="r3"] .row-program')).toHaveText("Stone carrier, version 1");
  expect(await island(page, () => window.islandPage.game.world.entities.find((e) => e.id === "site").built)).toBe(true);
});

test("after a change while the world runs, Start again goes back to the start with the programs as applied", async ({ page }) => {
  await openPlay(page);
  await steps(page, 120);
  await expect(page.locator(".mission-again")).toBeHidden();
  await open(page, "editor", "courier");
  await island(page, () => window.islandPage.editor().workspace.getBlockById("courier-go-depot-place").getField("PLACE").setValue("site"));
  await page.locator('[data-code="apply"]').click();
  await island(page, () => window.islandPage.close());
  await expect(page.locator(".mission-again")).toBeVisible();
  await page.locator(".mission-again").getByRole("button", { name: "Start again" }).click();
  await expect(page.locator(".clock .ticks")).toHaveText("Steps: 0");
  await expect(page.locator(".mission-again")).toBeHidden();
  const programs = await island(page, () => window.islandPage.game.world.programs.map((p) => `${p.id} ${p.revision}`));
  expect(programs).toContain("courier 2");
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.locator('.row[data-row="r2"] .row-program')).toHaveText("Plank courier, version 2");
});

test("the hints come one at a time; Look chooses the construction site", async ({ page }) => {
  await openPlay(page);
  await page.getByRole("button", { name: "Hint" }).click();
  await expect(page.locator(".mission-hints li")).toHaveText(["Look: Look at the construction site. What does it need, and who brings it? Show me"]);
  expect(await island(page, () => window.islandPage.selected)).toBe("site");
  await expect(page.locator('.row[data-row="site"]')).toHaveClass(/selected/);
  await island(page, () => window.islandPage.select(null));
  await page.getByRole("button", { name: "Show me" }).click();
  expect(await island(page, () => window.islandPage.selected)).toBe("site");
  await page.getByRole("button", { name: "Another hint" }).click();
  await page.getByRole("button", { name: "Another hint" }).click();
  await expect(page.locator(".mission-hints li")).toHaveCount(3);
  await expect(page.locator(".mission-hints .hint-try")).toContainText("build bridge");
  await expect(page.locator(".mission-hint")).toBeHidden();
  // A change of language keeps them, in the new words.
  await page.getByRole("button", { name: "Deutsch" }).click();
  await expect(page.locator(".island-bar h1")).toHaveText("Über den Bach");
  await expect(page.locator(".mission-goal")).toHaveText("Baut zusammen unsere Brücke.");
  await expect(page.locator(".mission-hints li")).toHaveCount(3);
  await expect(page.locator(".mission-hints .hint-look strong")).toHaveText("Schau:");
});

test("Robo 3's program can be edited before it runs, and applying it starts Robo 3", async ({ page }) => {
  await openPlay(page);
  await steps(page, 5);
  await page.locator('.row-head[data-pick="r3"]').click();
  await expect(page.locator('.row[data-row="r3"] .state')).toHaveText("Stopped");
  await expect(page.locator('.row[data-row="r3"] .row-program')).toHaveText("Stone carrier, version 1");
  await page.locator(".row.selected").getByRole("button", { name: "Edit program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Stone carrier");
  await expect(page.locator(".code-state")).toHaveText("Not started yet. Change it and apply, and it starts.");
  await island(page, () => window.islandPage.editor().workspace.getBlockById("stones-go-depot-place").getField("PLACE").setValue("camp"));
  await expect(page.locator(".code-state")).toHaveText("Changed. Apply to start it.");
  await page.locator('[data-code="apply"]').click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.locator('.row[data-row="r3"] .row-program')).toHaveText("Stone carrier, version 2");
  await expect(page.locator('.row[data-row="r3"] .state')).not.toHaveText("Stopped");
  await expect(page.locator(".code-state")).toHaveText("Version 2 is running.");
});

test("a robot given a new program while it carries something starts with an empty basket", async ({ page }) => {
  await openPlay(page);
  await stepUntil(page, (w) => w.entities.find((e) => e.id === "r2").store.items.plank === 2);
  await open(page, "editor", "courier");
  await island(page, () => window.islandPage.editor().workspace.getBlockById("courier-go-depot-place").getField("PLACE").setValue("site"));
  await page.locator('[data-code="apply"]').click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  expect(await island(page, () => window.islandPage.game.world.entities.find((e) => e.id === "r2").store.items)).toEqual({});
});

test("the overview holds still while the world runs, and its buttons stay there to be pressed", async ({ page }) => {
  await openPlay(page);
  await fixPrograms(page);
  // Where everything in the list is, and whether each button is still the one
  // that was there at the start.
  const look = () =>
    island(page, () => {
      const top = (el) => Math.round(el.getBoundingClientRect().top);
      window.firstButtons ??= [...document.querySelectorAll(".island-side button")];
      return {
        list: top(document.querySelector(".overview")),
        heads: [...document.querySelectorAll(".row-head")].map(top),
        edit: document.querySelector('.row.selected [data-act="edit"]') && top(document.querySelector('.row.selected [data-act="edit"]')),
        replaced: window.firstButtons.filter((b) => !b.isConnected).length,
      };
    });
  // (The first step takes away the rows' notes that a new version starts with it.)
  await steps(page, 1);

  // Robo 1 chosen: the rows above it, and its buttons, keep their places, and
  // stay the same buttons.
  await island(page, () => window.islandPage.select("r1"));
  await frames(page);
  const chosen = await look();
  const above = (it) => ({ list: it.list, heads: it.heads.slice(0, 3), edit: it.edit, replaced: it.replaced });
  expect(chosen.edit).not.toBeNull();
  for (let i = 0; i < 10; i++) {
    await steps(page, 3);
    await frames(page);
    expect(above(await look()), `after step ${await tick(page)}`).toEqual(above(chosen));
  }

  // Nothing chosen: every row keeps its place, step after step, up to the
  // bridge being built, whose line on the card had its place kept too.
  await island(page, () => {
    window.islandPage.select(null);
    delete window.firstButtons;
  });
  await frames(page);
  const still = await look();
  while ((await tick(page)) < 230) {
    await steps(page, 10);
    await frames(page);
    expect(await look(), `after step ${await tick(page)}`).toEqual(still);
  }
  expect(await island(page, () => window.islandPage.game.world.entities.find((e) => e.id === "site").action?.type), "the bridge is being built by now").toBe("make");

  // And the buttons can be pressed while it runs: on past the bridge, whose
  // win pauses the world, and Keep playing runs it again.
  await island(page, () => window.islandPage.select("r1"));
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.locator(".win")).toBeVisible();
  expect(await island(page, () => window.islandPage.game.clock.running), "the win pauses the world").toBe(false);
  await page.locator(".win").getByRole("button", { name: "Keep playing" }).click();
  await expect(page.locator(".win")).toBeHidden();
  const from = await tick(page);
  await expect.poll(() => tick(page)).toBeGreaterThan(from + 5);
  await page.locator(".row.selected").getByRole("button", { name: "Edit program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Wood collector");
});

test("leaving the mission lets go of everything it made, and saves it on the way", async ({ page }) => {
  await openPlay(page);
  await page.getByRole("button", { name: "Run" }).click();
  await open(page, "together");
  await open(page, "editor", "courier");
  await expect.poll(() => tick(page)).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home")).toBeVisible();
  const counts = await page.evaluate(() => window.island.counts());
  expect(Object.keys(counts)).toEqual(expect.arrayContaining(["editors", "blocklyWorkspaces"]));
  for (const [what, n] of Object.entries(counts)) expect(n, what).toBe(0);
  expect(await page.evaluate(() => typeof window.islandPage)).toBe("undefined");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("robot-island:save.slice")).world.tick)).toBeGreaterThan(0);
});

test("a save the game can't use is let go, and the card says so", async ({ page }) => {
  await page.goto("/?dev");
  await page.evaluate(() => localStorage.setItem("robot-island:save.slice", JSON.stringify({ format: "robot-island", schema: 0 })));
  await openPlay(page);
  await expect(page.locator(".mission-notice")).toContainText("The saved game couldn't be used");
  expect(await tick(page)).toBe(0);
  await page.locator(".mission-notice").getByRole("button", { name: "OK" }).click();
  await expect(page.locator(".mission-notice")).toBeHidden();
});
