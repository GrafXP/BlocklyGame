import { act, block, chain, input, mine, number, workspace } from "../src/content/build.js";

// Programs for tests, written as Blockly's JSON (src/content/build.js) with
// short block ids, so a test can say which block it expects: program(go("a",
// "pile"), pickUp("b")) is "when started: go to pile, pick up wood".

export const start = (id = "start") => block("island_when_started", id);
export const program = (...blocks) => workspace(chain(start(), ...blocks));

// A place or item is the id, in the input's shadow block (`${id}-place`,
// `${id}-item`), or a block over it, such as a setting: go("g", my("s",
// "destination")).
export const go = (id, place) => act("robot_go_to", id, place);
export const pickUp = (id, item = "wood") => act("robot_pick_up", id, item);
export const my = mine;
export const unload = (id) => block("robot_unload", id);
export const make = (id, item = "plank") => block("building_make", id, { fields: { ITEM: item } });
export const build = (id, what = "bridge") => block("building_build", id, { fields: { BLUEPRINT: what } });
export const assemble = (id, team) => block("building_assemble", id, { fields: { TEAM: team } });
// Supply building `to` from places `from`, each a “from” block `${id}-<place>`.
export const supply = (id, to, ...from) =>
  block("robot_supply", id, { fields: { PLACE: to }, ...(from.length && { inputs: { FROM: input(...from.map((place) => block("supply_from", `${id}-${place}`, { fields: { PLACE: place } }))) } }) });
export const needs = (id, place, item) => block("sense_needs", id, { fields: { PLACE: place, ITEM: item } });
export const space = (id, item, place) => block("sense_space", id, { fields: { ITEM: item, PLACE: place } });
export const wait = (id, steps) => block("control_wait_steps", id, { fields: { STEPS: steps } });

// `body` is a list of blocks: an empty one is an empty statement input.
const statements = (body) => (body.length ? input(...body) : {});
export const forever = (id, ...body) => block("control_forever", id, { inputs: { DO: statements(body) } });
export const repeat = (id, times, ...body) =>
  block("controls_repeat_ext", id, { inputs: { TIMES: typeof times === "number" ? number(times, `${id}-n`) : input(times), DO: statements(body) } });
export const until = (id, test) => block("control_wait_until", id, { inputs: test ? { UNTIL: input(test) } : {} });

// If, with else ifs and an else: branches [[test, [blocks…]], …], and the
// else's blocks, or null for none.
export function when(id, branches, otherwise = null) {
  const inputs = {};
  branches.forEach(([test, body], i) => {
    if (test) inputs[`IF${i}`] = input(test);
    if (body.length) inputs[`DO${i}`] = input(...body);
  });
  if (otherwise?.length) inputs.ELSE = input(...otherwise);
  const extraState = {};
  if (branches.length > 1) extraState.elseIfCount = branches.length - 1;
  if (otherwise) extraState.hasElse = true;
  return block("controls_if", id, { inputs, ...(Object.keys(extraState).length && { extraState }) });
}

// Values.
export const num = (id, n) => block("math_number", id, { fields: { NUM: n } });
export const stock = (id, item, place) => block("sense_stock", id, { fields: { ITEM: item, PLACE: place } });
export const basket = (id) => block("sense_basket", id);
export const compare = (id, a, op, b) => block("logic_compare", id, { fields: { OP: op }, inputs: { A: input(a), B: input(b) } });
