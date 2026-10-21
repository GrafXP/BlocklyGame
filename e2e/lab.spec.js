import { test, expect } from "@playwright/test";
import { PLACES } from "../src/blockly/blocks.js";

// The Phase 0 acceptance checks (PLAN.md §11): the editor over the 3D world, its
// treatments, transparency, gestures, serialization, resizing and cleanup. Each
// test gets a fresh browser context, so nothing saved carries over between them.

// Opens the lab with the test hooks on and the robot standing still, so frames
// repeat exactly; then applies `settings` (src/ui/lab-settings.js).
async function openLab(page, settings = {}) {
  await page.goto("/lab?dev");
  await page.waitForFunction(() => window.lab && document.querySelector(".editor-host .blocklySvg"));
  await page.evaluate((s) => window.lab.set(s), { moving: false, ...settings });
  await frames(page);
}

// Waits for the page to draw twice: changes made before are on screen after.
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const lab = (page, fn, arg) => page.evaluate(fn, arg);
const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

async function drag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

// A point on the editor's workspace with no block on it: near the top, right of
// the sample program and its markers.
async function emptyWorkspacePoint(page) {
  const panel = await page.locator(".editor-panel").boundingBox();
  return { x: panel.x + panel.width * 0.72, y: panel.y + panel.height * 0.12 };
}

// WCAG contrast of two CSS rgb() colours.
function contrast(a, b) {
  const lum = (css) => {
    const [r, g, bl] = css.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("Blockly's media comes from the app, never from static.blockly.com", async ({ page }) => {
  const external = [];
  const media = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost")) external.push(r.url());
  });
  page.on("response", (r) => {
    if (r.url().includes("/blockly-media/")) media.push([r.url().split("/").pop(), r.status()]);
  });
  await openLab(page);
  expect(external).toEqual([]);
  expect(media.length).toBeGreaterThan(0);
  expect(media.filter(([, status]) => status !== 200)).toEqual([]);
});

test("the world shows through the editor's background, and not through a solid one", async ({ page }) => {
  await openLab(page, { opacity: 0.5, markers: false });
  const clip = { ...(await emptyWorkspacePoint(page)), width: 80, height: 50 };
  const shot = async (world) => {
    await lab(page, (w) => window.lab.set({ world: w }), world);
    await frames(page);
    return page.screenshot({ clip });
  };
  expect((await shot("day")).equals(await shot("dusk"))).toBe(false);

  await lab(page, () => window.lab.set({ opacity: 1 }));
  expect((await shot("day")).equals(await shot("dusk"))).toBe(true);

  // See-through backgrounds, solid blocks.
  const look = await page.evaluate(() => ({
    svg: getComputedStyle(document.querySelector(".editor-host .blocklySvg")).backgroundColor,
    block: getComputedStyle(document.querySelector(".editor-host .blocklyDraggable > .blocklyPath")).fillOpacity,
  }));
  expect(look.svg).toBe("rgba(0, 0, 0, 0)");
  expect(look.block).toBe("1");
});

test("saving and loading the program loses nothing, and it's there after a reload", async ({ page }) => {
  await openLab(page);
  const trip = await lab(page, () => window.lab.roundTrip());
  expect(trip).toMatchObject({ ok: true, blocks: 18 });

  const start = await lab(page, () => window.lab.blockRect("start"));
  await drag(page, { x: start.x + 30, y: start.y + start.height - 12 }, { x: start.x + 130, y: start.y + start.height + 28 });
  const moved = await lab(page, () => window.lab.save().blocks.blocks[0]);
  expect(moved.x).toBeGreaterThan(80);
  await page.waitForTimeout(700); // the program is saved 400 ms after a change
  await page.reload();
  await page.waitForFunction(() => window.lab && document.querySelector(".editor-host .blocklySvg"));
  const reloaded = await lab(page, () => window.lab.save().blocks.blocks[0]);
  expect({ x: reloaded.x, y: reloaded.y }).toEqual({ x: moved.x, y: moved.y });
});

test("the editor follows the panel's size and the window's", async ({ page }) => {
  await openLab(page);
  const sizes = () =>
    page.evaluate(() => ({
      panel: document.querySelector(".editor-panel").getBoundingClientRect().width,
      editor: document.querySelector(".editor-host .blocklySvg").getBoundingClientRect().width,
    }));
  const before = await sizes();
  const handle = centre(await page.locator(".panel-handle").boundingBox());
  await drag(page, handle, { x: handle.x - 220, y: handle.y });
  await expect.poll(async () => (await sizes()).panel).toBeLessThan(before.panel - 180);
  await expect.poll(async () => Math.abs((await sizes()).panel - (await sizes()).editor)).toBeLessThan(2);

  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width - 200, height: viewport.height - 100 });
  await expect.poll(async () => Math.abs((await sizes()).panel - (await sizes()).editor)).toBeLessThan(2);
  const svgHeight = await page.evaluate(() => document.querySelector(".editor-host .blocklySvg").getBoundingClientRect().height);
  expect(Math.round(svgHeight)).toBe(viewport.height - 100);
});

test("gestures on the editor stay in the editor; the world takes its own", async ({ page }, testInfo) => {
  await openLab(page);
  const wheel = !testInfo.project.use.isMobile; // Playwright can't turn a wheel in mobile WebKit
  const camera = () => lab(page, () => window.lab.camera());
  const still = await camera();

  // Drag a block: it moves, the world doesn't.
  const unload = await lab(page, () => window.lab.blockRect("unload"));
  await drag(page, { x: unload.x + 18, y: unload.y + unload.height / 2 }, { x: unload.x + 220, y: unload.y + 160 });
  const after = await lab(page, () => window.lab.blockRect("unload"));
  expect(after.x - unload.x).toBeGreaterThan(150);
  expect(await camera()).toEqual(still);

  // Scroll the workspace and turn the wheel over it: still nothing in the world.
  const empty = await emptyWorkspacePoint(page);
  await drag(page, empty, { x: empty.x - 60, y: empty.y - 50 });
  if (wheel) {
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.wheel(0, 400);
  }
  await frames(page);
  expect(await camera()).toEqual(still);

  // A click on the editor where the depot is, underneath, doesn't select it.
  const depot = await lab(page, () => window.lab.screenOf("depot"));
  const panel = await page.locator(".editor-panel").boundingBox();
  expect(depot.x).toBeLessThan(panel.x + panel.width);
  await page.mouse.click(depot.x, depot.y);
  expect((await camera()).selected).toBe(null);

  // Beside the editor, the world answers: a click selects, a drag pans, the
  // wheel zooms.
  const rock = await lab(page, () => window.lab.screenOf("rock-1"));
  expect(rock.x).toBeGreaterThan(panel.x + panel.width);
  await page.mouse.click(rock.x, rock.y);
  expect((await camera()).selected).toBe("rock-1");
  await drag(page, { x: rock.x, y: rock.y + 120 }, { x: rock.x - 100, y: rock.y + 160 });
  const panned = await camera();
  expect(panned.x !== still.x || panned.z !== still.z).toBe(true);
  if (wheel) {
    await page.mouse.move(rock.x, rock.y);
    await page.mouse.wheel(0, -300);
    expect((await camera()).zoom).toBeGreaterThan(1);
  }
});

test("a finger drags blocks in the editor and pans and pinches the world", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "touch is sent through the Chrome DevTools Protocol");
  await openLab(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  async function swipe(paths, steps = 12) {
    await touch("touchStart", paths.map((p) => p[0]));
    for (let i = 1; i <= steps; i++) {
      await touch(
        "touchMove",
        paths.map(([[x0, y0], [x1, y1]]) => [x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]),
      );
    }
    await touch("touchEnd", []);
  }
  const camera = () => lab(page, () => window.lab.camera());
  const still = await camera();

  const unload = await lab(page, () => window.lab.blockRect("unload"));
  const from = [unload.x + 18, unload.y + unload.height / 2];
  await swipe([[from, [from[0] + 200, from[1] + 150]]]);
  await frames(page);
  const after = await lab(page, () => window.lab.blockRect("unload"));
  expect(after.x - unload.x).toBeGreaterThan(150);
  expect(await camera()).toEqual(still);

  const rock = await lab(page, () => window.lab.screenOf("rock-1"));
  await swipe([[[rock.x, rock.y + 100], [rock.x - 120, rock.y + 140]]]);
  const panned = await camera();
  expect(panned.x !== still.x || panned.z !== still.z).toBe(true);

  const c = [rock.x, rock.y + 150];
  await swipe([
    [[c[0] - 30, c[1]], [c[0] - 120, c[1]]],
    [[c[0] + 30, c[1]], [c[0] + 120, c[1]]],
  ]);
  expect((await camera()).zoom).toBeGreaterThan(1.5);
});

test("taps open dropdowns in the editor and select things in the world", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, "for the touch devices");
  await openLab(page);
  const field = await lab(page, () => window.lab.fieldRect("go-grove-place", "PLACE"));
  await page.touchscreen.tap(...Object.values(centre(field)));
  await expect(page.locator(".blocklyDropDownDiv .blocklyMenuItem")).toHaveCount(PLACES.length);
  await page.locator(".blocklyDropDownDiv .blocklyMenuItem", { hasText: "depot" }).tap();
  expect(await lab(page, () => window.lab.save().blocks.blocks[0].next.block.inputs.DO.block.inputs.PLACE.shadow.fields.PLACE)).toBe("depot");

  const rock = await lab(page, () => window.lab.screenOf("rock-1"));
  await page.touchscreen.tap(rock.x, rock.y);
  expect((await lab(page, () => window.lab.camera())).selected).toBe("rock-1");
});

test("dropdowns open over the editor with readable choices in every treatment", async ({ page }) => {
  await openLab(page);
  for (const treatment of ["classic", "calm", "bold"]) {
    await lab(page, (t) => window.lab.set({ treatment: t }), treatment);
    await frames(page);
    const field = await lab(page, () => window.lab.fieldRect("go-grove-place", "PLACE"));
    await page.mouse.click(field.x + field.width / 2, field.y + field.height / 2);
    const menu = page.locator(".blocklyDropDownDiv");
    await expect(menu).toBeVisible();
    await expect(menu.locator(".blocklyMenuItem")).toHaveCount(PLACES.length);
    if (treatment !== "classic") {
      // classic is Blockly's own colouring, the baseline
      const colours = await page.evaluate(() => ({
        text: getComputedStyle(document.querySelector(".blocklyDropDownDiv .blocklyMenuItemContent")).color,
        back: getComputedStyle(document.querySelector(".blocklyDropDownDiv")).backgroundColor,
      }));
      expect(contrast(colours.text, colours.back), `${treatment}: ${JSON.stringify(colours)}`).toBeGreaterThanOrEqual(4.5);
    }
    await menu.locator(".blocklyMenuItem", { hasText: "camp" }).click();
    await expect(menu).toBeHidden();
    expect(await lab(page, () => window.lab.save().blocks.blocks[0].next.block.inputs.DO.block.inputs.PLACE.shadow.fields.PLACE)).toBe("camp");
  }
  expect((await lab(page, () => window.lab.camera())).selected).toBe(null);
});

test("switching treatments keeps the program and changes how it's drawn", async ({ page }) => {
  await openLab(page);
  const program = JSON.stringify(await lab(page, () => window.lab.save()));
  for (const [treatment, renderer] of [
    ["bold", "island-roomy"],
    ["classic", "zelos"],
    ["calm", "zelos"],
  ]) {
    await lab(page, (t) => window.lab.set({ treatment: t }), treatment);
    const classes = await page.locator(".editor-host .injectionDiv").getAttribute("class");
    expect(classes).toContain(`${renderer}-renderer`);
    expect(classes).toContain(`island-${treatment}-theme`);
    expect(JSON.stringify(await lab(page, () => window.lab.save()))).toBe(program);
  }
  // The roomy renderer draws the same block bigger.
  await lab(page, () => window.lab.set({ treatment: "calm" }));
  const calm = await lab(page, () => window.lab.blockRect("unload"));
  await lab(page, () => window.lab.set({ treatment: "bold" }));
  const bold = await lab(page, () => window.lab.blockRect("unload"));
  expect(bold.height).not.toBe(calm.height);
});

test("markers sit beside their blocks, follow them, and share a block side by side", async ({ page }) => {
  await openLab(page, { markers: true });
  const placed = async () => {
    const marks = await lab(page, () => window.lab.markerRects());
    const blocks = Object.fromEntries(await Promise.all(marks.map(async (m) => [m.block, await lab(page, (id) => window.lab.blockRect(id), m.block)])));
    return { marks, blocks };
  };
  let { marks, blocks } = await placed();
  expect(marks.map((m) => m.entity).sort()).toEqual(["r1", "r2", "saw"]);
  for (const m of marks) {
    const b = blocks[m.block];
    expect(m.rect.left).toBeGreaterThan(b.left);
    expect(m.rect.top).toBeGreaterThanOrEqual(b.top - 2);
    expect(m.rect.top).toBeLessThan(b.bottom);
  }

  // Scroll the workspace: the markers go with the blocks.
  const r1 = marks.find((m) => m.entity === "r1").rect;
  const empty = await emptyWorkspacePoint(page);
  await drag(page, empty, { x: empty.x + 40, y: empty.y + 30 });
  await expect.poll(async () => (await lab(page, () => window.lab.markerRects())).find((m) => m.entity === "r1").rect.left).toBeCloseTo(r1.left + 40, -1);

  // One step on, Robo 2 has caught up with Robo 1, which is on a long action.
  await lab(page, () => window.lab.step());
  await expect.poll(async () => (await lab(page, () => window.lab.markerRects())).filter((m) => m.block === "pick-up").length).toBe(2);
  ({ marks } = await placed());
  const [a, b] = marks.filter((m) => m.block === "pick-up").sort((p, q) => p.rect.left - q.rect.left);
  expect(b.rect.left).toBeGreaterThanOrEqual(a.rect.right);
  expect(Math.abs(a.rect.top - b.rect.top)).toBeLessThan(1);
});

test("leaving the lab lets go of everything it made, and it opens again", async ({ page }) => {
  await openLab(page);
  const during = await lab(page, () => window.island.counts());
  expect(during).toMatchObject({ bins: 1, views: 1, editors: 1 });
  expect(during.blocklyWorkspaces).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home")).toBeVisible();
  // Blockly keeps one canvas of its own on <body> for measuring text, made once
  // for the life of the page; that one stays, and only ever one.
  const after = await page.evaluate(() => ({
    ...window.island.counts(),
    canvases: document.querySelectorAll("canvas:not(.blocklyComputeCanvas)").length,
    measuring: document.querySelectorAll("canvas.blocklyComputeCanvas").length,
    blocklySvgs: document.querySelectorAll(".blocklySvg").length,
    hooks: typeof window.lab,
    treatment: document.documentElement.dataset.treatment ?? null,
    variables: document.documentElement.style.length,
  }));
  expect(after).toEqual({
    bins: 0,
    listeners: 0,
    views: 0,
    editors: 0,
    blocklyWorkspaces: 0,
    canvases: 0,
    measuring: 1,
    blocklySvgs: 0,
    hooks: "undefined",
    treatment: null,
    variables: 0,
  });

  await page.getByRole("link", { name: "Editor lab" }).click();
  await page.waitForFunction(() => window.lab && document.querySelector(".editor-host .blocklySvg"));
  expect(await lab(page, () => window.island.counts())).toMatchObject({ bins: 1, views: 1, editors: 1 });
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home")).toBeVisible();
  expect(await page.evaluate(() => document.querySelectorAll("canvas").length)).toBe(1);
});
