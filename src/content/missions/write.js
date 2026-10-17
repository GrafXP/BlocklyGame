import { act, block, chain, workspace } from "../build.js";

// Writing a mission's programs (docs/campaign-plan.md, “Authoring package for
// each mission”), as Blockly's JSON, with readable block ids: each program's
// ids begin with its own id and say what the block is, numbered from the
// second of a kind (m08-collect, m08-collect-2…), so tests, hints and the
// debugger can name them.
//
//   const p = writer("m07");
//   p.workspace(p.start(p.go("grove"), p.collect()), p.loose(p.repeat(3)))
//
// A program's main stack hangs from its start block, at the top left; loose
// stacks, blocks a mission lays beside it for the child to use, go below it,
// where Blockly marks them as not running until they're attached.

// The inputs of blocks that hold statements, rather than a value.
const insides = (b) =>
  ({ controls_repeat_ext: ["DO"], control_forever: ["DO"], controls_if: b.extraState?.hasElse ? ["DO0", "ELSE"] : ["DO0"] })[b.type] ?? [];

// Roughly how tall `blocks` are on the workspace, in rows: a statement a row,
// a loop's or an If's insides (one row when empty) and its foot more.
function rows(blocks) {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    for (const name of insides(b)) n += Math.max(1, rows(stack(b.inputs?.[name]?.block))) + 1;
  }
  return n;
}
const stack = (first) => {
  const list = [];
  for (let b = first; b; b = b.next?.block) list.push(b);
  return list;
};

const ROW = 52; // workspace units a statement takes, about, in the Calm treatment

// The workspace `write(writer(id))` makes: program(“m03”, (p) =>
// p.workspace(p.start(p.go("camp"), p.unload()))).
export const program = (id, write) => write(writer(id));

export function writer(p) {
  const used = new Map();
  const id = (base) => {
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? `${p}-${base}` : `${p}-${base}-${n}`;
  };
  // A value gap holding `value`: a number in a shadow, or a block with a
  // shadow number under it, as a toolbox's block comes.
  const gap = (value, fallback = 1) => {
    const shadow = { type: "math_number", id: id("n"), fields: { NUM: typeof value === "number" ? value : fallback } };
    return typeof value === "number" ? { shadow } : { shadow, block: value };
  };
  const body = (blocks) => (blocks.length ? { block: chain(...blocks) } : undefined);
  const inputs = (map) => Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined));

  const w = {
    // The start block, with `blocks` under it. It can't be deleted: every
    // program has its one (docs/campaign-plan.md: “a fixed When Started
    // block”), and no mission's toolbox offers another.
    start: (...blocks) => chain(block("island_when_started", id("start"), { x: 20, y: 20, deletable: false }), ...blocks),
    go: (place) => act("robot_go_to", id(`go-${typeof place === "string" ? place : place.type.replace("setting_", "")}`), place),
    collect: (item = "wood") => act("robot_collect", id("collect"), item),
    pickUp: (item = "plank") => act("robot_pick_up", id("pick"), item),
    unload: () => block("robot_unload", id("unload")),
    make: (item = "plank") => block("building_make", id("make"), { fields: { ITEM: item } }),
    build: (what = "bridge") => block("building_build", id("build"), { fields: { BLUEPRINT: what } }),
    wait: (steps) => block("control_wait_steps", id("wait"), { fields: { STEPS: steps } }),
    repeat: (times, ...blocks) => block("controls_repeat_ext", id("repeat"), { inputs: inputs({ TIMES: gap(times, 2), DO: body(blocks) }) }),
    forever: (...blocks) => block("control_forever", id("forever"), { inputs: inputs({ DO: body(blocks) }) }),
    until: (test) => block("control_wait_until", id("until"), { inputs: inputs({ UNTIL: test && { block: test } }) }),
    // If `test` then `then`, else `otherwise` (null: no else).
    when: (test, then = [], otherwise = null) =>
      block("controls_if", id("if"), {
        ...(otherwise && { extraState: { hasElse: true } }),
        inputs: inputs({ IF0: test && { block: test }, DO0: body(then), ELSE: otherwise ? body(otherwise) : undefined }),
      }),
    stock: (item, place) => block("sense_stock", id("stock"), { fields: { ITEM: item, PLACE: place } }),
    compare: (a, op, b) => block("logic_compare", id("compare"), { fields: { OP: op }, inputs: { A: gap(a, 0), B: gap(b, 0) } }),
    mine: (slot) => block(`setting_${slot}`, id(slot)),
    // Blocks lying apart, a stack of their own.
    loose: (...blocks) => chain(...blocks),
    // The workspace: the main stack, then loose stacks below it, one under
    // another.
    workspace(main, ...loose) {
      let y = 20 + (rows(stack(main)) + 1) * ROW;
      const placed = loose.map((first) => {
        const top = { ...first, x: 40, y };
        y += (rows(stack(first)) + 1) * ROW;
        return top;
      });
      return workspace(main, ...placed);
    },
  };
  return w;
}
