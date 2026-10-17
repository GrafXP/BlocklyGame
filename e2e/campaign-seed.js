import { missionStart } from "../src/campaign.js";
import { CAMPAIGN, campaignMission } from "../src/content/missions/campaign.js";
import { makeSave } from "../src/storage/saves.js";

// Helpers for the browser tests of the campaign (not tests themselves).

// The campaign saved on the device at the start of mission `id`, every mission
// before it done, and `id` too with `done`, as if the player had played that
// far: built in node, put into the page's localStorage, which is cleared first.
// The page is the title page afterwards, in `query`'s language.
export async function seedCampaign(page, id, { done = false, query = "" } = {}) {
  const mission = campaignMission(id);
  const library = { programs: [] };
  const world = missionStart(mission, library);
  const completed = CAMPAIGN.slice(0, mission.n - (done ? 0 : 1)).map((m) => m.id);
  const save = makeSave({ content: { id: "campaign", version: 1 }, mission: id, world, library, checkpoint: world, progress: { completed } });
  await page.goto(`/?dev${query}`);
  await page.evaluate((text) => {
    localStorage.clear();
    localStorage.setItem("robot-island:save.campaign", text);
  }, JSON.stringify(save));
  await page.goto(`/?dev${query}`);
}

// Solves the mission the island page shows, as a player would: each program
// its reference changes loaded into the editor and applied, then its choices
// made, and steps until it's done. Returns the step it was done at.
export async function solveMission(page) {
  const id = await page.evaluate(() => window.islandPage.play().mission.id);
  const { reference } = campaignMission(id);
  for (const [program, source] of Object.entries(reference.programs ?? {})) {
    const has = await page.evaluate((p) => window.islandPage.library().programs.some((d) => d.id === p), program);
    if (!has) continue;
    await page.evaluate((p) => window.islandPage.open("editor", p), program);
    await page.evaluate((s) => window.islandPage.editor().load(s), source);
    await page.waitForTimeout(400); // the editor saves its draft
    await page.locator('[data-code="apply"]').click();
  }
  await page.evaluate(() => window.islandPage.close());
  await page.evaluate((commands) => window.islandPage.choose(commands), reference.commands ?? []);
  return page.evaluate(() => {
    const game = window.islandPage.game;
    while (game.world.mission.done === null && game.world.tick < 3000) game.step();
    return game.world.mission.done;
  });
}
