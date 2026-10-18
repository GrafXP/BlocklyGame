// Helpers for the browser tests of the island page's controls (not tests
// themselves): what's folded away opens from its icon, as a player opens it
// (src/ui/island.js, PLAN.md §8, amendment of 18 October 2026).

// Opens drawer `name`, "mission" or "overview", from its icon in the bar, if
// it isn't open already.
export async function openDrawer(page, name) {
  const toggle = page.locator(`.island-bar [data-drawer="${name}"]`);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

// Opens menu `name`, "settings" or "view" (the view's controls), from its
// icon, if it isn't open already.
export async function openMenu(page, name) {
  const toggle = page.locator(`[data-menu="${name}"]`);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

// Presses the speed button until the clock runs at `speed` (0.5, 1, 2 or 4).
export async function setSpeed(page, speed) {
  const button = page.locator('.clock [data-act="speed"]');
  for (let i = 0; i < 4 && (await button.textContent()) !== `${speed}×`; i++) await button.click();
}
