// The lab's toolbox: every Phase 0 block, in the categories children will see.
// Toolboxes filtered by capability and mission come with the editor (Phase 4).
const block = (type, extra = {}) => ({ kind: "block", type, ...extra });
const number = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

export const LAB_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    { kind: "category", name: "%{BKY_CAT_START}", categorystyle: "entry_category", contents: [block("island_when_started")] },
    {
      kind: "category",
      name: "%{BKY_CAT_ROBOT}",
      categorystyle: "robot_category",
      contents: [block("robot_go_to"), block("robot_collect"), block("robot_unload")],
    },
    { kind: "category", name: "%{BKY_CAT_BUILDING}", categorystyle: "building_category", contents: [block("building_make")] },
    {
      kind: "category",
      name: "%{BKY_CAT_CONTROL}",
      categorystyle: "control_category",
      contents: [
        block("controls_repeat_ext", { inputs: { TIMES: number(3) } }),
        block("control_forever"),
        block("controls_if"),
        block("controls_if", { extraState: { hasElse: true } }),
        block("control_wait_steps"),
      ],
    },
    { kind: "category", name: "%{BKY_CAT_SENSING}", categorystyle: "sensing_category", contents: [block("sense_stock")] },
    {
      kind: "category",
      name: "%{BKY_CAT_VALUES}",
      categorystyle: "values_category",
      contents: [block("math_number", { fields: { NUM: 4 } }), block("logic_compare", { inputs: { A: number(0), B: number(4) } })],
    },
  ],
};
