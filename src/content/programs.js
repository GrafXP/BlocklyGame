import { ref } from "../i18n/index.js";
import { act, block, chain, input, mine, number, workspace } from "./build.js";

// The island's starter programs (PLAN.md §9), as Blockly workspaces. Block ids
// are fixed and readable, so tests and the debugger can name them. Their names
// are messages, worded when shown, until the player renames them (PLAN.md §8).
//
// - collector: brings wood from the grove to the sawmill, two at a time.
// - courier: carries planks from the sawmill to the construction site.
// - stones: brings stone from the stone pit, across the stream, to the depot.
// - fetch: the shared collector, with “my source”, “my item” and “my
//   destination” in its actions' inputs, so each robot running it does the job
//   its settings say (docs/campaign-plan.md, mission 22).
// - planks: the sawmill makes a plank whenever it has wood.
// - bridge: the construction site builds the bridge, once, from four planks.
// - kits: the workshop makes kits, two planks and a stone each, for ever.
// - build-workshop: a workshop's construction site builds it, once.

export const start = (p) => block("island_when_started", `${p}-start`, { x: 20, y: 20 });
const goTo = (p, place) => act("robot_go_to", `${p}-go-${place}`, place);
const unload = (p) => block("robot_unload", `${p}-unload`);
const forever = (id, ...body) => block("control_forever", id, { inputs: { DO: input(...body) } });
const twice = (p, ...body) => block("controls_repeat_ext", `${p}-repeat`, { inputs: { TIMES: number(2, `${p}-times`), DO: input(...body) } });

// Fetches two of `item` from `from` to `to`, again and again.
export function carry(p, { from, item, to }) {
  return workspace(chain(start(p), forever(`${p}-forever`, goTo(p, from), twice(p, act("robot_pick_up", `${p}-take`, item)), goTo(p, to), unload(p))));
}

// The same, from the robot's own source to its own destination, with its own
// item: “go to my source”, and so on.
export function fetchBySettings(p) {
  return workspace(
    chain(
      start(p),
      forever(
        `${p}-forever`,
        act("robot_go_to", `${p}-go-source`, mine(`${p}-source`, "source")),
        twice(p, act("robot_pick_up", `${p}-take`, mine(`${p}-item`, "item"))),
        act("robot_go_to", `${p}-go-destination`, mine(`${p}-destination`, "destination")),
        unload(p),
      ),
    ),
  );
}

const planks = workspace(
  chain(
    start("planks"),
    forever(
      "planks-forever",
      block("control_wait_until", "planks-until", {
        inputs: {
          UNTIL: input(
            block("logic_compare", "planks-compare", {
              fields: { OP: "GT" },
              inputs: {
                A: input(block("sense_stock", "planks-wood", { fields: { ITEM: "wood", PLACE: "sawmill" } })),
                B: number(0, "planks-zero"),
              },
            }),
          ),
        },
      }),
      block("building_make", "planks-make", { fields: { ITEM: "plank" } }),
    ),
  ),
);

// A construction site's program: build `what`, once.
export const builder = (p, what) => workspace(chain(start(p), block("building_build", `${p}-build`, { fields: { BLUEPRINT: what } })));

const kits = workspace(chain(start("kits"), forever("kits-forever", block("building_make", "kits-make", { fields: { ITEM: "kit" } }))));

export const ISLAND_PROGRAMS = [
  { id: "collector", name: ref("programName.collector"), source: carry("collector", { from: "grove", item: "wood", to: "sawmill" }) },
  { id: "courier", name: ref("programName.courier"), source: carry("courier", { from: "sawmill", item: "plank", to: "site" }) },
  { id: "stones", name: ref("programName.stones"), source: carry("stones", { from: "quarry", item: "stone", to: "depot" }) },
  { id: "fetch", name: ref("programName.fetch"), source: fetchBySettings("fetch") },
  { id: "planks", name: ref("programName.planks"), source: planks },
  { id: "bridge", name: ref("programName.bridge"), source: builder("bridge", "bridge") },
  { id: "kits", name: ref("programName.kits"), source: kits },
  { id: "build-workshop", name: ref("programName.buildWorkshop"), source: builder("build-workshop", "workshop") },
];
