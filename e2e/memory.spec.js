import { test, expect } from "@playwright/test";
import { act, block, call, chain, changeVar, input, routine, send, setVar, waitFor, withVariables, workspace } from "../src/content/build.js";
import { openDrawer } from "./ui.js";

// Phase 8 in a browser (PLAN.md §11): variables with their values beside the
// robot, blocks of one's own that the debugger follows in and out of, and
// messages with the inbox they arrive in; in the editor's toolbox, and in
// German. On the free island (/island), whose editor offers every block: the
// campaign's lessons for them are its workshops, still to be built
// (docs/campaign-planv2.md).

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
const open = async (page, query = "") => {
  await page.goto(`/island?dev${query}`);
  await page.waitForFunction(() => window.islandPage && document.querySelector(".tag:not([hidden])"));
  await frames(page);
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
// Steps the world until `holds(world)` or `limit` steps. Returns the step.
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
// Program `id`'s editor, with `source` put into it and applied.
async function applyIn(page, id, source) {
  await island(page, (p) => window.islandPage.open("editor", p), id);
  await island(page, (s) => window.islandPage.editor().load(s), source);
  await page.waitForTimeout(400); // the editor saves its draft
  await page.locator('[data-code="apply"]').click();
}

const start = (...blocks) => chain(block("island_when_started", "start", { x: 20, y: 20, deletable: false }), ...blocks);
const trip = (n) => [act("robot_go_to", `go-${n}`, "grove"), act("robot_collect", `collect-${n}`, "wood"), act("robot_go_to", `home-${n}`, "camp"), block("robot_unload", `unload-${n}`)];
const repeat = (id, times, ...blocks) => block("controls_repeat_ext", id, { inputs: { TIMES: { shadow: { type: "math_number", id: `${id}-n`, fields: { NUM: times } } }, DO: input(...blocks) } });

test("Memory offers set, change and get of the program's variable; the robot's row shows what it remembers", async ({ page }) => {
  await open(page);
  const order = { id: "v-order", name: "order" };
  await applyIn(page, "collector", withVariables(workspace(start(setVar("set", order, 0), repeat("rep", 3, ...trip(1), changeVar("change", order, 1)))), [order]));
  expect((await toolbox(page)).Memory).toEqual(["variables_set", "math_change", "variables_get"]);
  await island(page, () => window.islandPage.close());
  await stepUntil(page, (w) => "v-order" in (w.entities.find((e) => e.id === "r1").runtime.vars ?? {}), 20);
  await openDrawer(page, "overview");
  await frames(page);
  await expect(page.locator('.row[data-row="r1"] .row-memory')).toHaveText("order 0");
  await stepUntil(page, (w) => w.entities.find((e) => e.id === "r1").runtime.vars["v-order"] === 3);
  await frames(page);
  await expect(page.locator('.row[data-row="r1"] .row-memory')).toHaveText("order 3");
  await island(page, () => window.islandPage.select("r1"));
  await expect(page.locator(".details .memory")).toHaveText(/order\s*3/);
});

test("My blocks offers a new block and a use of the program's own; the debugger follows Robo 1 into it and back", async ({ page }) => {
  await open(page);
  const program = workspace(start(call("call", "bring wood"), call("call-2", "bring wood")), { ...routine("def", "bring wood", null, ...trip(1)), x: 40, y: 260 });
  await applyIn(page, "collector", program);
  expect((await toolbox(page))["My blocks"]).toEqual(["procedures_defnoreturn", "procedures_callnoreturn"]);
  await island(page, () => window.islandPage.select("r1"));
  await stepUntil(page, (w) => w.entities.find((e) => e.id === "r1").runtime.frames?.length === 1, 40);
  await frames(page);
  await expect(page.locator(".details .inspector-row", { hasText: "Inside" })).toContainText("bring wood");
  await expect(page.locator(".execution-markers .marker-badge.call")).toHaveCount(1);
  await stepUntil(page, (w) => !w.entities.find((e) => e.id === "r1").runtime.frames?.length, 400);
  await frames(page);
  await expect(page.locator(".execution-markers .marker-badge.call")).toHaveCount(0);
});

test("a building's toolbox has Messages; Robo 2 waits for the note, with its inbox shown, until the sawmill sends it", async ({ page }) => {
  await open(page);
  await applyIn(page, "courier", workspace(start(waitFor("wait", "plankReady"), act("robot_go_to", "go", "sawmill"), act("robot_pick_up", "pick", "plank"), act("robot_go_to", "to", "depot"), block("robot_unload", "unload"))));
  await island(page, () => window.islandPage.close());
  await stepUntil(page, (w) => w.tick >= 2, 2);
  await openDrawer(page, "overview");
  await frames(page);
  await expect(page.locator('.row[data-row="r2"] .why')).toHaveText("Waiting for the message “plank ready”");
  await island(page, () => window.islandPage.select("r2"));
  await expect(page.locator(".details .inspector-row", { hasText: "Inbox" })).toContainText("empty");
  await island(page, (p) => window.islandPage.open("editor", p), "planks");
  expect((await toolbox(page)).Messages).toEqual(["message_send", "message_wait"]);
  await applyIn(page, "planks", workspace(start(block("building_make", "make", { fields: { ITEM: "plank" } }), send("send", "plankReady", "r2"))));
  await island(page, () => window.islandPage.close());
  const moved = await stepUntil(page, (w) => w.entities.find((e) => e.id === "r2").action?.type === "move", 400);
  expect(moved).toBeLessThan(400);
});

test("a message waiting in an inbox is listed there, with who sent it", async ({ page }) => {
  await open(page);
  // Robo 3 carries stone and never waits for a message, so the note stays.
  await applyIn(page, "planks", workspace(start(send("send", "plankReady", "r3"))));
  await island(page, () => window.islandPage.close());
  await stepUntil(page, (w) => !!w.entities.find((e) => e.id === "r3").inbox?.length, 20);
  await island(page, () => window.islandPage.select("r3"));
  await frames(page);
  await expect(page.locator(".details .inbox")).toHaveText("“plank ready” from Sawmill");
});

test("in German, the editor's categories for memory and blocks of one's own are worded in German", async ({ page }) => {
  await open(page, "&lang=de");
  await island(page, () => window.islandPage.open("editor", "collector"));
  expect(Object.keys(await toolbox(page))).toEqual(expect.arrayContaining(["Merken", "Meine Bausteine"]));
  await openDrawer(page, "overview");
  await expect(page.locator('.row[data-row="r1"] .row-memory')).toHaveCount(0);
});
