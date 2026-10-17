import { test, expect } from "@playwright/test";

// The Phase 6 acceptance in a browser (PLAN.md §11), on the island: two robots
// on one team share code but keep their own runtimes and settings; a robot's
// own copy is edited without changing the others'; Apply names the robots it
// changes, and changes exactly those at the next step; settings plug into a
// shared program's actions; a building that doesn't fit says why, and one that
// fits becomes a construction site, then the workshop, which makes kits; the
// program library gives programs to teams, makes, names and puts them away;
// and every robot and building's Edit program opens its program, or a new one,
// with its program to choose at the editor's head.

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
const steps = async (page, n) => {
  await island(
    page,
    (k) => {
      for (let i = 0; i < k; i++) window.islandPage.game.step();
    },
    n,
  );
  await frames(page);
};
const entity = (page, id) => island(page, (i) => JSON.parse(JSON.stringify(window.islandPage.game.world.entities.find((e) => e.id === i))), id);

async function openIsland(page, query = "") {
  await page.goto(`/island?dev${query}`);
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
}
async function choose(page, id) {
  await island(page, (i) => window.islandPage.select(i), id);
  await frames(page);
}
const setup = (page) => page.locator(".row.selected .setup");
const choice = (page) => page.locator(".code-choice");
// The chosen robot or building's Edit program, pressed; resolves once the
// editor is open on program `program`.
async function editProgram(page, program) {
  await page.locator(".row.selected").getByRole("button", { name: "Edit program" }).click();
  await page.waitForFunction((p) => window.islandPage.panel()?.program === p, program);
  await frames(page);
}

test("two robots on one team share its program, each at its own block with its own settings", async ({ page }) => {
  await openIsland(page);
  await steps(page, 20);
  await choose(page, "r2");
  await editProgram(page, "courier");
  await expect(choice(page).locator(".setup-note")).toHaveText("Shared by its team: Plank team");
  await setup(page).locator("#setup-team").selectOption("wood-team");
  // The change is shown before it's made, naming the robot it changes.
  await expect(setup(page).locator(".setup-preview p")).toHaveText(
    "Robo 2 will run Wood collector from the next step, from the beginning. A robot that gets a new program starts with an empty basket.",
  );
  expect((await entity(page, "r2")).role, "nothing changes yet").toBe("plank-team");
  await setup(page).locator('[data-setup="ok"]').click();
  await expect(setup(page).locator(".setup-note.pending")).toHaveText("From the next step");
  // The editor open for Robo 2 goes over to the program it runs from now.
  await page.waitForFunction(() => window.islandPage.panel()?.program === "collector");
  await frames(page);
  await expect(choice(page).locator(".setup-note")).toHaveText(["Shared by its team: Wood team", "From the next step"]);
  await steps(page, 1);
  await expect(choice(page).locator(".setup-note")).toHaveText("Shared by its team: Wood team");
  await expect(page.locator(".code-runners")).toHaveText("Run by Robo 1, Robo 2");
  await island(page, () => window.islandPage.close());

  // One program, two runtimes: at different blocks, with different settings.
  await setup(page).locator("#setting-destination").selectOption("depot");
  await steps(page, 30);
  const [r1, r2] = [await entity(page, "r1"), await entity(page, "r2")];
  expect([r1.runtime.program, r2.runtime.program]).toEqual(["collector", "collector"]);
  expect(r1.runtime.block).not.toBe(r2.runtime.block);
  expect([r1.settings.destination, r2.settings.destination]).toEqual(["sawmill", "depot"]);
  await island(page, () => window.islandPage.open("together"));
  await frames(page);
  await expect(page.locator('.together-panel[data-program="collector"] .together-runners')).toHaveText("Run by Robo 1, Robo 2");
  expect((await island(page, () => window.islandPage.markers())).filter((m) => m.program === "collector").map((m) => m.entity).sort()).toEqual(["r1", "r2"]);
});

test("a robot's own copy is edited on its own; Apply names exactly the robots it changes, and changes those at the next step", async ({ page }) => {
  await openIsland(page);
  await choose(page, "r3");
  await setup(page).locator("#setup-team").selectOption("wood-team");
  await setup(page).locator('[data-setup="ok"]').click();
  await steps(page, 25);

  // The team's program: Apply names both.
  await island(page, () => window.islandPage.open("editor", "collector"));
  await frames(page);
  await expect(page.locator(".code-runners")).toHaveText("Run by Robo 1, Robo 3");
  await island(page, () => window.islandPage.editor().workspace.getBlockById("collector-go-sawmill-place").getField("PLACE").setValue("depot"));
  await expect(page.locator(".code-affects")).toHaveText("Apply changes it for Robo 1, Robo 3, from the next step.");
  const before = await island(page, () => window.islandPage.game.world.entities.map((e) => [e.id, JSON.stringify(e.runtime)]));
  await page.locator('[data-code="apply"]').click();
  await steps(page, 1);
  const after = await island(page, () => window.islandPage.game.world.entities.map((e) => [e.id, e.runtime?.revision ?? null, e.runtime?.evaluated?.tick ?? null]));
  const restarted = after.filter(([, revision]) => revision === 2).map(([id]) => id);
  expect(restarted).toEqual(["r1", "r3"]);
  expect(before.length).toBe(after.length);

  // Robo 3's own copy, made in the editor opened for it: only Robo 3 changes.
  await island(page, () => window.islandPage.close());
  await choose(page, "r3");
  await editProgram(page, "collector");
  await choice(page).locator('[data-choice="copy"]').click();
  await expect(choice(page).locator(".setup-preview p")).toHaveText(
    "Robo 3 gets its own copy of Wood collector. Change the copy, and only Robo 3 changes. A robot that gets a new program starts with an empty basket.",
  );
  await choice(page).locator('[data-choice="ok"]').click();
  // The editor goes over to it, named for Robo 3.
  await page.waitForFunction(() => window.islandPage.panel()?.program === "collector-r3");
  await frames(page);
  await expect(page.locator(".code-title")).toHaveText("Wood collector (Robo 3)");
  await expect(page.locator(".code-state")).toHaveText("Version 1 starts with the next step.");
  await steps(page, 1);
  await island(page, () => window.islandPage.editor().workspace.getBlockById("collector-times").getField("NUM").setValue(1));
  await expect(page.locator(".code-affects")).toHaveText("Apply changes it for Robo 3, from the next step.");
  await page.locator('[data-code="apply"]').click();
  await steps(page, 1);
  expect([(await entity(page, "r3")).runtime.program, (await entity(page, "r3")).runtime.revision]).toEqual(["collector-r3", 2]);
  expect([(await entity(page, "r1")).runtime.program, (await entity(page, "r1")).runtime.revision]).toEqual(["collector", 2]);

  // And back to the team's.
  await choice(page).locator('[data-choice="back"]').click();
  await choice(page).locator('[data-choice="ok"]').click();
  await page.waitForFunction(() => window.islandPage.panel()?.program === "collector");
  await steps(page, 1);
  expect((await entity(page, "r3")).runtime.program).toBe("collector");
});

test("the library gives the shared Collector to a team, and each robot does the job its settings say", async ({ page }) => {
  await openIsland(page);
  await choose(page, "r3");
  await setup(page).locator("#setup-team").selectOption("wood-team");
  await setup(page).locator('[data-setup="ok"]').click();
  await page.locator('[data-panel="library"]').click();
  const collector = page.locator('.lib-program[data-program="fetch"]');
  await expect(collector.locator(".lib-runners")).toHaveText("Nothing runs it.");
  await collector.locator('[data-lib="give"]').click();
  await collector.locator("#lib-target").selectOption("role:wood-team");
  await expect(collector.locator(".lib-give [role=status]")).toHaveText(
    "Robo 1, Robo 3 will run Collector from the next step, from the beginning. A robot that gets a new program starts with an empty basket.",
  );
  await collector.locator('[data-lib="give-ok"]').click();
  await steps(page, 1);
  await expect(collector.locator(".lib-runners")).toHaveText("Run by Robo 1, Robo 3");
  await expect(collector.locator(".lib-for")).toHaveText("Team program: Wood team");
  // The settings: grove, wood, sawmill for Robo 1 as the island gave them;
  // Robo 3 to fetch wood for the depot instead of stone.
  await choose(page, "r3");
  await setup(page).locator("#setting-source").selectOption("grove");
  await setup(page).locator("#setting-item").selectOption("wood");
  await steps(page, 1);
  const depot = (await entity(page, "depot")).store.items.wood ?? 0;
  await island(page, () => {
    const game = window.islandPage.game;
    while (game.world.tick < 200) game.step();
  });
  await frames(page);
  expect((await entity(page, "depot")).store.items.wood ?? 0).toBeGreaterThan(depot);
  // The program goes to “my source”: the setting, not a place.
  await island(page, () => window.islandPage.open("editor", "fetch"));
  await frames(page);
  expect(await island(page, () => window.islandPage.editor().workspace.getBlockById("fetch-source").type)).toBe("setting_source");
});

test("a building that doesn't fit says why; one that fits becomes a construction site, then the workshop, which makes kits", async ({ page }) => {
  await openIsland(page);
  await page.locator('[data-build="open"]').click();
  await expect(page.locator(".build-ask")).toHaveText("Where should the workshop go? Tap a spot on the island.");
  await island(page, () => window.islandPage.aimAt(14, 8));
  await expect(page.locator(".build-why")).toHaveText("It would stand where robots use this: Sawmill");
  await expect(page.locator('[data-build="place"]')).toBeDisabled();
  await island(page, () => window.islandPage.aimAt(20, 16));
  await expect(page.locator(".build-why")).toHaveText("It needs open ground, with open ground in front of it.");
  // East of the stream, before the bridge: it fits, since the bridge will reach it.
  await island(page, () => window.islandPage.aimAt(25, 17));
  await expect(page.locator(".build-why")).toHaveText("It fits here. Robots bring what the construction site needs: 2 stones, 4 planks.");
  await page.locator('[data-build="turn"]').click();
  expect((await island(page, () => window.islandPage.placing())).facing).toBe("west");
  await page.locator('[data-build="turn"]').click();
  await page.locator('[data-build="turn"]').click();
  await page.locator('[data-build="turn"]').click();
  await page.locator('[data-build="place"]').click();
  await expect(page.locator(".build-card")).toBeHidden();
  await expect(page.locator(".build-pending")).toHaveText("The construction site appears with the next step.");
  await steps(page, 1);
  await expect(page.locator(".build-pending")).toBeHidden();
  await expect(page.locator('.tag[data-pick="workshop"]')).toContainText("Workshop site");
  await choose(page, "workshop");
  await editProgram(page, "build-workshop");
  await expect(page.locator("#code-program option:checked")).toHaveText("Workshop builder");
  await expect(choice(page).locator(".setup-note")).toHaveText("Its own program");
  await island(page, () => window.islandPage.close());
  await expect(page.locator('.row[data-row="workshop"] .why')).toHaveText("Needs 4 planks · Workshop site has 0");

  // Its materials; it builds, becomes the workshop, and makes a kit.
  await island(page, () => {
    const game = window.islandPage.game;
    for (const [item, count] of [
      ["plank", 4],
      ["stone", 2],
    ])
      game.queue({ type: "stock", at: "workshop", item, count });
    while (game.world.entities.find((e) => e.id === "workshop").type !== "workshop") game.step();
  });
  await frames(page);
  await expect(page.locator('.tag[data-pick="workshop"]')).toContainText("Workshop");
  await expect(page.locator('.row[data-row="workshop"] .row-program')).toHaveText("Kit maker, version 1");
  await island(page, () => {
    const game = window.islandPage.game;
    game.queue({ type: "stock", at: "workshop", item: "plank", count: 2 });
    game.queue({ type: "stock", at: "workshop", item: "stone", count: 1 });
    for (let i = 0; i < 40; i++) game.step();
  });
  await frames(page);
  expect((await entity(page, "workshop")).store.items).toEqual({ kit: 1 });
  expect(await island(page, () => window.islandPage.problems())).toEqual([]);
});

test("the library makes a new program, names it, and puts away only what nothing runs; a robot's name stays the player's", async ({ page }) => {
  await openIsland(page);
  await page.locator('[data-panel="library"]').click();
  await expect(page.locator('.lib-program[data-program="collector"] [data-lib="archive"]')).toBeDisabled();
  await page.locator('[data-lib="new"]').click();
  await page.waitForFunction(() => window.islandPage.panel()?.program === "program");
  await frames(page);
  await expect(page.locator(".code-title")).toHaveText("New program 1");
  await expect(page.locator(".code-runners")).toHaveText("Nothing runs it yet. Apply it, then give it to a robot or building.");
  await page.locator('[data-panel="library"]').click();
  const fresh = page.locator('.lib-program[data-program="program"]');
  await fresh.locator('[data-lib="rename"]').click();
  await page.locator("#lib-name").fill("My job");
  await page.locator("#lib-name").press("Enter");
  await expect(fresh.locator(".lib-name")).toHaveText("My job");
  await fresh.locator('[data-lib="archive"]').click();
  await expect(fresh).toHaveCount(0);
  await page.locator(".lib-archived summary").click();
  await page.locator('.lib-archived [data-program="program"] [data-lib="restore"]').click();
  await expect(fresh).toHaveCount(1);

  // A robot's name, the player's words in every language.
  await choose(page, "r1");
  await setup(page).locator('[data-setup="rename"]').click();
  await page.locator("#setup-name").fill("Blinky");
  await page.locator("#setup-name").press("Enter");
  await steps(page, 1);
  await expect(page.locator('.tag[data-pick="r1"] .tag-name')).toHaveText("Blinky");
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "Deutsch" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "de" && window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
  await expect(page.locator('.tag[data-pick="r1"] .tag-name')).toHaveText("Blinky");
  await expect(page.locator('.tag[data-pick="r2"] .tag-name')).toHaveText("Robo 2");
  await expect(page.locator('[data-panel="library"]')).toHaveText("Programme");
});

test("every robot and building has Edit program: one without a program gets a new one, and the editor's head gives it another", async ({ page }) => {
  await openIsland(page);
  // The depot runs nothing: a new program of its own, from the next step.
  await choose(page, "depot");
  await editProgram(page, "program");
  await expect(page.locator(".code-title")).toHaveText("New program 1");
  await expect(page.locator("#code-program option:checked")).toHaveText("New program 1");
  await expect(choice(page).locator(".setup-note")).toHaveText(["Its own program", "From the next step"]);
  await steps(page, 1);
  expect((await entity(page, "depot")).runtime.program).toBe("program");
  await expect(page.locator(".code-runners")).toHaveText("Run by Depot");

  // Robo 1 runs its team's program; the dropdown offers the others it can run.
  await island(page, () => window.islandPage.close());
  await choose(page, "r1");
  await editProgram(page, "collector");
  expect(await island(page, () => window.islandPage.panel().entity)).toBe("r1");
  await page.locator("#code-program").selectOption("fetch");
  await expect(choice(page).locator(".setup-preview p")).toHaveText(
    "Robo 1 will run Collector from the next step, from the beginning. A robot that gets a new program starts with an empty basket.",
  );
  await choice(page).locator('[data-choice="cancel"]').click();
  await expect(page.locator("#code-program option:checked")).toHaveText("Wood collector");
  await page.locator("#code-program").selectOption("fetch");
  expect((await entity(page, "r1")).runtime.program, "nothing changes before OK").toBe("collector");
  await choice(page).locator('[data-choice="ok"]').click();
  await page.waitForFunction(() => window.islandPage.panel()?.program === "fetch");
  await steps(page, 1);
  expect([(await entity(page, "r1")).own, (await entity(page, "r1")).runtime.program]).toEqual(["fetch", "fetch"]);
  await expect(choice(page).locator(".setup-note")).toHaveText("Its own program");

  // A new program from there, too.
  await page.locator("#code-program").selectOption("+new");
  await expect(choice(page).locator(".setup-preview p")).toHaveText(
    "Robo 1 gets a new program from the next step, with only its start block. A robot that gets a new program starts with an empty basket.",
  );
  await choice(page).locator('[data-choice="ok"]').click();
  await page.waitForFunction(() => window.islandPage.panel()?.program === "program-2");
  await frames(page);
  await expect(page.locator(".code-title")).toHaveText("New program 2");
  // The row keeps the team and settings; the program is chosen in the editor.
  await expect(setup(page).locator("#setup-team")).toHaveCount(1);
  await expect(page.locator(".row.selected #setup-program, .row.selected [data-setup='copy']")).toHaveCount(0);
});

test("the bridge slice offers none of Phase 6's tools", async ({ page }) => {
  await page.goto("/?dev");
  await page.evaluate(() => localStorage.removeItem("robot-island:save.slice"));
  await page.goto("/slice?dev");
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await choose(page, "r2");
  await expect(page.locator('[data-panel="library"], [data-build]')).toHaveCount(0);
  await expect(page.locator(".row.selected .setup")).toHaveCount(0);
});
