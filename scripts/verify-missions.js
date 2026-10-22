// Checks every mission of the campaign headlessly (PLAN.md §9, Verification;
// §11, Phase 7; docs/campaign-planv2.md): npm run verify:missions. For each
// mission, from its start (src/campaign.js: every mission stands alone), with
// its own toolbox and resources:
//
// - its starter programs alone don't do it: the lesson needs the child (and a
//   Repair or Change lesson's program needs its fault fixed, or its change);
//   but a mission to watch, they do (src/campaign.js, authoringProblems);
// - its reference solution does, within the mission's steps,
//   taking no more raw materials than its budget, the world keeping its rules
//   after every tick;
// - its toolbox offers every block the solution uses, its goals' stores have
//   room for what they count, and the deposits hold its budget, and it keeps
//   the campaign plan's authoring rules (missionProblems);
// - its words are in every listed language.
import { pathToFileURL } from "node:url";
import { missionProblems, missionStart, playMission, referenceCommands } from "../src/campaign.js";
import { CAMPAIGN } from "../src/content/missions/campaign.js";
import { missionKeys } from "../src/content/missions/index.js";
import { LANGUAGES } from "../src/i18n/languages.js";
import { checkWorld } from "../src/sim/validate.js";

const copy = (value) => JSON.parse(JSON.stringify(value));

// Plays `mission` from checkpoint `world` with `library`, the reference
// applied at the first step, checking the world's rules each tick. Returns
// { done, ticks, problems }.
function playReference(mission, world, library, rules) {
  const problems = [];
  const commands = referenceCommands(world, library, mission);
  const done = playMission(world, commands, mission.steps, (w) => {
    if (rules && !problems.length) for (const p of checkWorld(w)) problems.push(`${mission.id} at step ${w.tick}: ${p}`);
  });
  if (!done) problems.push(`${mission.id}: not done in ${mission.steps} steps`);
  for (const [item, n] of Object.entries(world.mission.collected)) {
    if (n > (mission.budget?.[item] ?? 0)) problems.push(`${mission.id}: took ${n} ${item} from the deposits, its budget is ${mission.budget?.[item] ?? 0}`);
  }
  return { done, ticks: world.tick, problems };
}

// Every mission of `missions`, the campaign's unless said, from its start.
// Returns { problems, rows }: what's wrong, and for each mission the steps its
// reference took. `rules` checks the world's rules after every tick (slower).
export async function verifyCampaign({ rules = true, missions = CAMPAIGN } = {}) {
  const problems = [];
  const rows = [];

  for (const mission of missions) {
    const { world: checkpoint, library } = missionStart(mission);
    problems.push(...missionProblems(mission, checkpoint), ...checkWorld(checkpoint).map((p) => `${mission.id} checkpoint: ${p}`));
    const starter = copy(checkpoint);
    const alone = playMission(starter, [], mission.steps);
    // A mission to watch (src/campaign.js) is done by the world alone.
    if (alone && !mission.watch) problems.push(`${mission.id}: its starter programs do it alone, at step ${starter.tick}`);
    if (!alone && mission.watch) problems.push(`${mission.id}: a mission to watch, not done by itself in ${mission.steps} steps`);
    const run = playReference(mission, copy(checkpoint), copy(library), rules);
    problems.push(...run.problems);
    rows.push({ id: mission.id, steps: mission.steps, ticks: run.done ? run.ticks : null });
  }

  for (const { code } of LANGUAGES) {
    const words = (await import(`../src/i18n/${code}/missions.js`)).default;
    for (const mission of missions) for (const key of missionKeys(mission)) if (!(key in words)) problems.push(`${code}: no words for ${key}`);
  }
  return { problems, rows };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, rows } = await verifyCampaign();
  for (const { id, steps, ticks } of rows) console.log(`${id}  ${String(ticks ?? "–").padStart(4)} of ${steps} steps`);
  if (problems.length) {
    console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
    for (const p of problems) console.error(`  ${p}`);
    process.exitCode = 1;
  } else console.log(`\nAll ${rows.length} missions verified.`);
}
