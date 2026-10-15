import { block, chain, input, number, workspace } from "./build.js";

// The island's starter programs (PLAN.md §9), as Blockly workspaces. Block ids
// are fixed and readable, so tests and the debugger can name them.
//
// - collector: brings wood from the grove to the sawmill, two at a time.
// - courier: carries planks from the sawmill to the construction site.
// - stones: brings stone from the stone pit, across the stream, to the depot.
// - planks: the sawmill makes a plank whenever it has wood.
// - bridge: the construction site builds the bridge, once, from four planks.

const start = (p) => block("island_when_started", `${p}-start`, { x: 20, y: 20 });
const goTo = (p, place) => block("robot_go_to", `${p}-go-${place}`, { fields: { PLACE: place } });
const unload = (p) => block("robot_unload", `${p}-unload`);

// Fetches two of `item` from `from` to `to`, again and again.
function carry(p, { from, item, take, to }) {
  return workspace(
    chain(
      start(p),
      block("control_forever", `${p}-forever`, {
        inputs: {
          DO: input(
            goTo(p, from),
            block("controls_repeat_ext", `${p}-repeat`, {
              inputs: { TIMES: number(2, `${p}-times`), DO: input(block(take, `${p}-take`, { fields: { ITEM: item } })) },
            }),
            goTo(p, to),
            unload(p),
          ),
        },
      }),
    ),
  );
}

const planks = workspace(
  chain(
    start("planks"),
    block("control_forever", "planks-forever", {
      inputs: {
        DO: input(
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
      },
    }),
  ),
);

const bridge = workspace(chain(start("bridge"), block("building_build", "bridge-build", { fields: { BLUEPRINT: "bridge" } })));

export const ISLAND_PROGRAMS = [
  { id: "collector", source: carry("collector", { from: "grove", item: "wood", take: "robot_collect", to: "sawmill" }) },
  { id: "courier", source: carry("courier", { from: "sawmill", item: "plank", take: "robot_pick_up", to: "site" }) },
  { id: "stones", source: carry("stones", { from: "quarry", item: "stone", take: "robot_collect", to: "depot" }) },
  { id: "planks", source: planks },
  { id: "bridge", source: bridge },
];
