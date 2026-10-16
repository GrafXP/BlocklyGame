import { test, expect } from "@playwright/test";
import { ISLAND } from "../src/content/island.js";
import { stateHash } from "../src/sim/replay.js";
import { advanceWorld, createWorld } from "../src/sim/world.js";

// The Phase 4 acceptance in a browser (PLAN.md §11): one Step visibly updates
// every program panel; Next block stops when the chosen robot takes a new block,
// with everyone else moved on by the same ticks; robots sharing a program have
// their own labels at their own blocks; a long action keeps its block; and a
// draft being edited can't mislabel the code that runs.

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

async function openIsland(page) {
  await page.goto("/island?dev");
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
}
const open = async (page, kind, program) => {
  await island(page, ([k, p]) => window.islandPage.open(k, p), [kind, program]);
  await frames(page);
};

// Where every program's runtime is, from the world itself: entity → block.
const running = (page) =>
  island(page, () => Object.fromEntries(window.islandPage.game.world.entities.filter((e) => e.runtime?.block).map((e) => [e.id, `${e.runtime.program}@${e.runtime.block}`])));
// What the markers show: entity → program@block.
const marked = (page) => island(page, () => Object.fromEntries(window.islandPage.markers().map((m) => [m.entity, `${m.program ?? "editor"}@${m.block}`])));
// The block each overview row's chip shows: entity → block.
const chips = (page) => island(page, () => Object.fromEntries([...document.querySelectorAll(".row")].filter((r) => r.querySelector(".chip")).map((r) => [r.dataset.row, r.querySelector(".chip").dataset.block])));
const blockOnly = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.split("@")[1]]));

// Node's island after `ticks` ticks with no commands.
function nodeHash(ticks) {
  const w = createWorld(ISLAND);
  while (w.tick < ticks) advanceWorld(w);
  return stateHash(w);
}

test("one Step moves every marker in every program panel, the rows and the labels with them", async ({ page }) => {
  await openIsland(page);
  await open(page, "together");
  const programs = ["bridge", "collector", "courier", "planks", "stones"];
  await expect(page.locator(".together-panel")).toHaveCount(programs.length);
  expect(await marked(page)).toEqual({});
  for (const n of [1, 2, 3]) {
    await page.getByRole("button", { name: "Step", exact: true }).click();
    await expect(page.locator(".clock .ticks")).toHaveText(`Steps: ${n}`);
    const want = await running(page);
    expect(Object.keys(want).sort()).toEqual(["r1", "r2", "r3", "sawmill", "site"]);
    // Panels well out of view have no workspace (PLAN.md §13); each, scrolled
    // to, shows everyone running it where the world has them.
    for (const program of programs) {
      await page.locator(`.together-panel[data-program="${program}"]`).scrollIntoViewIfNeeded();
      await expect.poll(() => island(page, (p) => window.islandPage.panels().find((it) => it.program === p).mounted, program)).toBe(true);
      const got = Object.entries(await marked(page)).filter(([, at]) => at.startsWith(`${program}@`));
      const runs = Object.entries(want).filter(([, at]) => at.startsWith(`${program}@`));
      expect(Object.fromEntries(got), `${program}'s markers after step ${n}`).toEqual(Object.fromEntries(runs));
    }
    expect(await chips(page), `rows after step ${n}`).toEqual(blockOnly(want));
  }
  // The labels over the world show each one's block too.
  await expect(page.locator('.tag[data-pick="sawmill"] .bubble img')).toBeVisible();
});

test("running at 4×, every frame's views show one tick: markers, rows and the clock agree", async ({ page }) => {
  await openIsland(page);
  await open(page, "together");
  await page.getByRole("button", { name: "4×" }).click();
  await page.getByRole("button", { name: "Run" }).click();
  // Read after the page's own frame callback, on each of 40 frames.
  const { bad: mixed, checked, ticks } = await island(
    page,
    () =>
      new Promise((resolve) => {
        const bad = [];
        const ticks = new Set();
        let checked = 0;
        let left = 40;
        const look = () => {
          const snap = window.islandPage.snapshot();
          ticks.add(snap.tick);
          const at = Object.fromEntries(snap.entities.filter((e) => e.block).map((e) => [e.id, e.block]));
          for (const m of window.islandPage.markers()) {
            checked++;
            if (at[m.entity] !== m.block) bad.push(`tick ${snap.tick}: marker ${m.entity}@${m.block}, snapshot ${at[m.entity]}`);
          }
          for (const row of document.querySelectorAll(".row")) {
            const chip = row.querySelector(".chip");
            if (chip && at[row.dataset.row] !== chip.dataset.block) bad.push(`tick ${snap.tick}: row ${row.dataset.row}@${chip.dataset.block}`);
          }
          if (document.querySelector(".clock .ticks").textContent !== `Steps: ${snap.tick}`) bad.push(`tick ${snap.tick}: clock says ${document.querySelector(".clock .ticks").textContent}`);
          if (--left > 0) requestAnimationFrame(() => requestAnimationFrame(look));
          else resolve({ bad, checked, ticks: ticks.size });
        };
        requestAnimationFrame(() => requestAnimationFrame(look));
      }),
  );
  await page.getByRole("button", { name: "Pause" }).click();
  expect(mixed).toEqual([]);
  expect(checked, "markers looked at").toBeGreaterThan(40);
  expect(ticks, "different ticks seen").toBeGreaterThan(8);
});

test("Next block stops when the chosen robot takes a new block, with every other entity moved on by the same ticks", async ({ page }) => {
  await openIsland(page);
  await island(page, () => window.islandPage.select("r1"));
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Next block" }).click();
    seen.push(await island(page, () => [window.islandPage.game.world.tick, window.islandPage.game.world.entities.find((e) => e.id === "r1").runtime.block]));
  }
  expect(seen).toEqual([
    [1, "collector-forever"],
    [2, "collector-go-grove"],
    [26, "collector-repeat"],
    [27, "collector-take"],
  ]);
  expect(await island(page, () => window.islandPage.hash())).toBe(nodeHash(27));
  await expect(page.locator(".clock .ticks")).toHaveText("Steps: 27");
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  // With nothing chosen, it stops at anyone's next block.
  await island(page, () => window.islandPage.select(null));
  await page.getByRole("button", { name: "Next block" }).click();
  const tick = await island(page, () => window.islandPage.game.world.tick);
  expect(tick).toBeGreaterThan(27);
  expect(await island(page, () => window.islandPage.hash())).toBe(nodeHash(tick));
});

test("robots sharing a program each have a label of their own, at the same block or at different ones", async ({ page }) => {
  await openIsland(page);
  await steps(page, 27); // Robo 1 collecting at the grove
  await island(page, () => window.islandPage.game.queue({ type: "assign", entity: "r3", program: "collector" }));
  await steps(page, 1);
  await open(page, "together");
  const collector = async () => (await island(page, () => window.islandPage.markers())).filter((m) => m.program === "collector");
  const pair = await collector();
  expect(pair.map((m) => m.entity).sort()).toEqual(["r1", "r3"]);
  const [r1, r3] = ["r1", "r3"].map((id) => pair.find((m) => m.entity === id));
  expect(r1.block).toBe("collector-take");
  expect(r3.block).toBe("collector-forever");
  await expect(page.locator('.together-panel[data-program="collector"] .marker-pill text')).toHaveText(["Robo 1", "Robo 3"]);
  // Different colours, not only names.
  const colours = await page.locator('.together-panel[data-program="collector"] .marker-pill rect').evaluateAll((rects) => rects.map((r) => r.getAttribute("fill")));
  expect(new Set(colours).size).toBe(2);
  await expect(page.locator('.together-panel[data-program="collector"] .together-runners')).toHaveText("Run by Robo 1, Robo 3");

  // At one block, side by side.
  await steps(page, 40);
  const at = await collector();
  const together = at[0].block === at[1].block;
  if (together) expect(at[0].rect.right <= at[1].rect.left + 1 || at[1].rect.right <= at[0].rect.left + 1).toBe(true);

  // Tapping a label chooses its robot, and its readings show.
  await page.locator('.together-panel[data-program="collector"] .marker-pill[data-entity="r3"]').click();
  expect(await island(page, () => window.islandPage.selected)).toBe("r3");
  expect((await collector()).find((m) => m.entity === "r3").chosen).toBe(true);
});

test("a long action keeps its block marked, step after step, and only the first step marks it as new", async ({ page }) => {
  await openIsland(page);
  await open(page, "together");
  await steps(page, 2);
  for (let i = 0; i < 6; i++) {
    expect((await marked(page)).r1).toBe("collector@collector-go-grove");
    await expect(page.locator('.row[data-row="r1"] .chip')).toHaveClass(i === 0 ? /fresh/ : /^(?!.*fresh)/);
    await steps(page, 3);
    await frames(page);
  }
  await expect(page.locator('.row[data-row="r1"] .state')).toHaveText("Moving");
});

test("the chosen one's block shows what it read: numbers on senses, ✓ or ✗ on conditions, in its row too", async ({ page }) => {
  await openIsland(page);
  await open(page, "together");
  await steps(page, 2);
  await island(page, () => window.islandPage.select("sawmill"));
  await page.locator('.together-panel[data-program="planks"]').scrollIntoViewIfNeeded();
  await expect.poll(() => island(page, () => window.islandPage.badges().map((b) => `${b.block}=${b.text}`).sort())).toEqual(["planks-compare=✗", "planks-wood=0"]);
  const row = page.locator(".row.selected .readings");
  await expect(row.locator("li")).toHaveText(["wood at sawmill > 0 not true", "wood at sawmill 0"]);
});

test("the editor offers only what its robot or building can do, and only places on the island", async ({ page }) => {
  await openIsland(page);
  await open(page, "editor", "planks");
  await expect(page.locator(".code-title")).toHaveText("Plank maker");
  await expect(page.locator(".code-runners")).toHaveText("Run by Sawmill");
  expect(await page.locator(".code-host .blocklyToolboxCategoryLabel").allTextContents()).toEqual(["Start", "Buildings", "Control", "Sensing", "Values"]);
  expect(await island(page, () => window.islandPage.editor().workspace.getBlockById("planks-make").getField("ITEM").getOptions(false))).toEqual([["planks", "plank"]]);
  await open(page, "editor", "collector");
  expect(await page.locator(".code-host .blocklyToolboxCategoryLabel").allTextContents()).toEqual(["Start", "Robot", "Control", "Sensing", "Values"]);
  expect((await island(page, () => window.islandPage.editor().workspace.getBlockById("collector-go-grove-place").getField("PLACE").getOptions(false))).map((o) => o[1])).toEqual(["grove", "sawmill", "site", "depot", "camp", "quarry"]);
});

test("a draft being edited never moves the marks of the code that runs; Apply takes effect at the next step", async ({ page }) => {
  await openIsland(page);
  await steps(page, 30); // Robo 1 at the grove, collecting
  await island(page, () => window.islandPage.select("r1"));
  await open(page, "editor", "collector");
  const state = page.locator(".code-state");
  await expect(state).toHaveText("Version 1 is running.");
  await expect.poll(() => marked(page)).toEqual({ r1: "editor@collector-take" });
  const apply = page.getByRole("button", { name: "Apply" });
  await expect(apply).toBeDisabled();

  // Moving the program about changes nothing that runs: the marks stay.
  await island(page, () => window.islandPage.editor().workspace.getBlockById("collector-start").moveBy(60, 30));
  await page.waitForTimeout(500);
  await expect(state).toHaveText("Version 1 is running.");
  expect(await marked(page)).toEqual({ r1: "editor@collector-take" });

  // Taking the Repeat out of the loop is a change: the editor's marks go, as
  // they'd point at blocks that don't run that way yet.
  await island(page, () => window.islandPage.editor().workspace.getBlockById("collector-repeat").unplug(true));
  await expect(state).toHaveText("Changed. Apply to run it; until then, version 1 keeps running.");
  expect(await marked(page)).toEqual({});
  await expect(apply).toBeEnabled();
  // The overview still shows the block that runs, and the world goes on with it.
  await steps(page, 1);
  await expect(page.locator('.row[data-row="r1"] .row-program')).toHaveText("Wood collector, version 1");
  expect(await island(page, () => window.islandPage.game.world.entities.find((e) => e.id === "r1").runtime.revision)).toBe(1);

  // A place there isn't is marked at its block, and can't be applied.
  await island(page, () => window.islandPage.editor().workspace.getBlockById("collector-go-sawmill-place").getField("PLACE").setValue("nowhere"));
  await expect(state).toHaveText("Put the marked blocks right, then apply.");
  await expect(apply).toBeDisabled();
  expect(await island(page, () => window.islandPage.editor().workspace.getBlockById("collector-go-sawmill").getIcons().map((i) => i.getText?.()))).toEqual(["No such place: nowhere"]);
  await island(page, () => window.islandPage.editor().workspace.getBlockById("collector-go-sawmill-place").getField("PLACE").setValue("depot"));
  await expect(apply).toBeEnabled();

  // Apply: waits for the next step.
  const tick = await island(page, () => window.islandPage.game.world.tick);
  await apply.click();
  await expect(state).toHaveText("Version 2 starts with the next step.");
  await expect(page.locator('.row[data-row="r1"] .row-pending')).toHaveText("Version 2 starts with the next step");
  expect(await island(page, () => window.islandPage.game.world.tick)).toBe(tick);
  expect(await marked(page)).toEqual({});
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(state).toHaveText("Version 2 is running.");
  await expect(page.locator('.row[data-row="r1"] .row-program')).toHaveText("Wood collector, version 2");
  await expect.poll(() => marked(page)).toEqual({ r1: "editor@collector-forever" });

  // Undo changes and Starter program work on the draft only.
  await page.getByRole("button", { name: "Starter program" }).click();
  await expect(state).toHaveText("Changed. Apply to run it; until then, version 2 keeps running.");
  await page.getByRole("button", { name: "Undo changes" }).click();
  await expect(state).toHaveText("Version 2 is running.");
});

test("opening the editor pauses the world; the draft and the panel outlast a change of language", async ({ page }) => {
  await openIsland(page);
  await page.getByRole("button", { name: "Run" }).click();
  await island(page, () => window.islandPage.select("r2"));
  await page.locator(".row.selected").getByRole("button", { name: "Edit program" }).click();
  await expect(page.locator(".code-title")).toHaveText("Plank courier");
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  await island(page, () => window.islandPage.editor().workspace.getBlockById("courier-go-site-place").getField("PLACE").setValue("depot"));
  await expect(page.locator(".code-state")).toHaveText("Changed. Apply to run it; until then, version 1 keeps running.");
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "Deutsch" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "de" && window.islandPage?.panel()?.kind === "editor" && document.querySelector(".code-host .blocklySvg"));
  await expect(page.locator(".code-title")).toHaveText("Bretterbote");
  await expect(page.locator(".code-state")).toHaveText("Geändert. Übernimm es, damit es läuft; bis dahin läuft Version 1 weiter.");
  expect(await island(page, () => window.islandPage.editor().workspace.getBlockById("courier-go-site-place").getField("PLACE").getText())).toBe("Lagerhaus");
  await page.getByRole("button", { name: "Schließen" }).first().click();
  expect(await island(page, () => window.islandPage.panel())).toBe(null);
});
