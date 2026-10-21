import { ref } from "../../i18n/index.js";
import { act, block, call, chain, changeVar, getVar, number, routine, send, setVar, waitFor, withVariables, workspace } from "../build.js";

// Writing a mission's programs (docs/campaign-plan.md, “Authoring package for
// each mission”), as Blockly's JSON, with readable block ids: each program's
// ids begin with its own id and say what the block is, numbered from the
// second of a kind (m08-pick, m08-pick-2…), so tests, hints and the
// debugger can name them.
//
//   const p = writer("m07");
//   p.workspace(p.start(p.go("grove"), p.pickUp()), p.loose(p.repeat(3)))
//
// A program's main stack hangs from its start block, at the top left; loose
// stacks, blocks a mission lays beside it for the child to use, go below it,
// where Blockly marks them as not running until they're attached. A block of
// the player's own (a routine) is a stack of its own, laid out the same way.
//
// Variables, routines and their inputs are named by message references:
// p.variable("order") is the variable `${id}-order`, named by variable.order in
// ui.js, worded as the program is given out (wordStarter). The workspace
// lists every variable its blocks use.

// The inputs of blocks that hold statements, rather than a value.
const insides = (b) =>
  ({ controls_repeat_ext: ["DO"], control_forever: ["DO"], controls_if: b.extraState?.hasElse ? ["DO0", "ELSE"] : ["DO0"], procedures_defnoreturn: ["STACK"], robot_supply: ["FROM"] })[b.type] ?? [];

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

// Program `id` of mission `n`, run by `who` (a name), as the library names it:
// “Mission 3: Robo 1”.
export const named = (id, n, who, source) => ({ id, name: ref("programName.mission", { n, name: who }), source });

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
  const variables = new Map(); // id → { id, name }: those the blocks use
  const named = (kind, key) => {
    const v = { id: `${p}-${key}`, name: ref(`${kind}.${key}`) };
    variables.set(v.id, v);
    return v;
  };
  const short = (v) => v.id.slice(p.length + 1);
  // What a use of a routine gives its input: a number, a place (a picture
  // dropdown, in a shadow, as a toolbox gives it), or a block.
  const arg = (value) =>
    typeof value === "number"
      ? number(value, id("n"))
      : typeof value === "string"
        ? { shadow: { type: "value_place", id: id("place"), fields: { PLACE: value } } }
        : { block: value };

  const w = {
    // The start block, with `blocks` under it. It can't be deleted: every
    // program has its one (docs/campaign-plan.md: “a fixed When Started
    // block”), and no mission's toolbox offers another.
    start: (...blocks) => chain(block("island_when_started", id("start"), { x: 20, y: 20, deletable: false }), ...blocks),
    go: (place) => act("robot_go_to", id(`go-${typeof place === "string" ? place : place.type.replace("setting_", "")}`), place),
    pickUp: (item = "wood") => act("robot_pick_up", id("pick"), item),
    unload: () => block("robot_unload", id("unload")),
    make: (item = "plank") => block("building_make", id("make"), { fields: { ITEM: item } }),
    build: (what = "bridge") => block("building_build", id("build"), { fields: { BLUEPRINT: what } }),
    // A new robot for team `team`.
    assemble: (team) => block("building_assemble", id("assemble"), { fields: { TEAM: team } }),
    // Supply building `to` from the places `from`, in that order.
    supply: (to, ...from) =>
      block("robot_supply", id("supply"), {
        fields: { PLACE: to },
        inputs: { FROM: { block: chain(...from.map((place) => block("supply_from", id(`from-${place}`), { fields: { PLACE: place } }))) } },
      }),
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
    needs: (place, item) => block("sense_needs", id("needs"), { fields: { PLACE: place, ITEM: item } }),
    space: (item, place) => block("sense_space", id("space"), { fields: { ITEM: item, PLACE: place } }),
    compare: (a, op, b) => block("logic_compare", id("compare"), { fields: { OP: op }, inputs: { A: gap(a, 0), B: gap(b, 0) } }),
    mine: (slot) => block(`setting_${slot}`, id(slot)),
    // Memory: a variable of the program, Set, Change and Get.
    variable: (key) => named("variable", key),
    set: (v, value) => setVar(id(`set-${short(v)}`), v, value),
    change: (v, by) => changeVar(id(`change-${short(v)}`), v, by),
    get: (v) => getVar(id(`get-${short(v)}`), v),
    // A block of one's own, named by routine.<key>, with its input `param`
    // (p.input("destination"), named by input.<key>) or null; and a use of it.
    input: (key) => named("input", key),
    routine: (key, param, ...blocks) => routine(id(`def-${key}`), ref(`routine.${key}`), param, ...blocks),
    call: (key, param = null, value = null) => call(id(`call-${key}`), ref(`routine.${key}`), param, value === null ? null : arg(value)),
    // Messages.
    send: (message, to) => send(id("send"), message, to),
    waitFor: (message) => waitFor(id("wait-for"), message),
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
      return withVariables(workspace(main, ...placed), [...variables.values()]);
    },
  };
  return w;
}
