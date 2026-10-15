import { ref } from "../i18n/index.js";

// The editor lab's sample: a collector robot's program and a sawmill's, as
// Blockly's JSON serialization, with fixed block ids so the sample markers can
// point at them. Two robots share the first program, as robots sharing a role
// will (PLAN.md §5); the sawmill runs the second.

const block = (type, id, extra = {}) => ({ type, id, ...extra });
const next = (b) => ({ block: b });
const chain = (...blocks) => {
  for (let i = blocks.length - 1; i > 0; i--) blocks[i - 1].next = next(blocks[i]);
  return blocks[0];
};
const number = (n, id) => ({ shadow: { type: "math_number", id, fields: { NUM: n } } });

export function demoProgram() {
  const collector = chain(
    block("island_when_started", "start", { x: 30, y: 30 }),
    block("controls_repeat_ext", "repeat", {
      inputs: {
        TIMES: number(3, "times"),
        DO: next(
          chain(
            block("robot_go_to", "go-grove", { fields: { PLACE: "grove" } }),
            block("robot_collect", "collect", { fields: { ITEM: "wood" } }),
            block("robot_go_to", "go-mill", { fields: { PLACE: "sawmill" } }),
            block("robot_unload", "unload"),
          ),
        ),
      },
    }),
  );
  const sawmill = chain(
    block("island_when_started", "mill-start", { x: 30, y: 470 }),
    block("control_forever", "forever", {
      inputs: {
        DO: next(
          block("controls_if", "if", {
            extraState: { hasElse: true },
            inputs: {
              IF0: next(
                block("logic_compare", "compare", {
                  fields: { OP: "LT" },
                  inputs: {
                    A: next(block("sense_stock", "stock", { fields: { ITEM: "plank", PLACE: "sawmill" } })),
                    B: number(4, "four"),
                  },
                }),
              ),
              DO0: next(block("building_make", "make", { fields: { ITEM: "plank" } })),
              ELSE: next(block("control_wait_steps", "wait", { fields: { STEPS: 5 } })),
            },
          }),
        ),
      },
    }),
  );
  return { blocks: { languageVersion: 0, blocks: [collector, sawmill] } };
}

// Who the sample markers stand for. Their names are messages, as the game's own
// names are until the player renames a robot (PLAN.md §8). `every`: how many lab
// steps each one takes per block, so a robot on a long action falls behind and
// the two meet.
export const DEMO_ENTITIES = [
  { id: "r1", name: ref("entity.robo", { n: 1 }), colour: "#c2410c", ink: "#ffffff", shape: "circle", every: 2, path: ["repeat", "go-grove", "collect", "go-mill", "unload"], at: 2 },
  { id: "r2", name: ref("entity.robo", { n: 2 }), colour: "#1864ab", ink: "#ffffff", shape: "square", every: 1, path: ["repeat", "go-grove", "collect", "go-mill", "unload"], at: 1 },
  { id: "saw", name: ref("entity.sawmill"), colour: "#24733a", ink: "#ffffff", shape: "triangle", every: 1, path: ["forever", "if", "make"], at: 1 },
];

// Where each sample marker is after `step` lab steps.
export function demoMarkers(step) {
  return DEMO_ENTITIES.map((e) => ({ entity: e, blockId: e.path[(e.at + Math.floor(step / e.every)) % e.path.length] }));
}
