import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_BLOCKS, blockIndex, readWorkspace } from "../src/programming/adapter.js";
import { COMPILER_VERSION, LIMITS, compile } from "../src/programming/compiler.js";
import { checkProgram } from "../src/programming/runtime.js";
import { ISLAND_PROGRAMS } from "../src/content/programs.js";
import { block, call, chain, changeVar, getVar, input, routine, setVar, withVariables, workspace } from "../src/content/build.js";
import { CODES } from "../src/sim/codes.js";
import { basket, compare, forever, go, make, my, num, pickUp, program, repeat, start, stock, unload, until, wait, when } from "./programs.js";

// The compiler (PLAN.md §7, §12): Blockly's JSON in, the game's instructions
// out, each visible one with the id of its block; and what can't work as
// written, as codes with block ids. All in Node, without Blockly.

// A workspace Blockly 13.4.0 saved itself (made by test/fixtures/README.md's
// steps): random block ids, positions, shadows under blocks, a disabled block,
// an If with an else if and an else, and a stack left lying about.
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/blockly-workspace.json", import.meta.url), "utf8"));

const codes = (list) => list.map(({ code, block }) => (block ? `${code} ${block}` : code));
const visible = (code) => code.filter((ins) => ins.block).map((ins) => `${ins.op} ${ins.block}`);

test("the adapter reads Blockly's own JSON: stacks in order, shadows where no block covers them, disabled blocks left out", () => {
  const { tree, problem } = readWorkspace(FIXTURE);
  assert.equal(problem, undefined);
  const index = blockIndex(tree);
  assert.equal(tree.stacks.length, 2, "the start's stack and a stray one");
  assert.equal(tree.stacks[0][0].type, "island_when_started");
  const types = [...index.values()].map((n) => n.type);
  for (const type of ["control_forever", "controls_repeat_ext", "controls_if", "logic_compare", "sense_stock", "math_number", "robot_go_to"]) assert.ok(types.includes(type), type);
  const disabled = JSON.stringify(FIXTURE).match(/"id":"([^"]+)","disabledReasons"/)[1];
  assert.equal(index.has(disabled), false, "the disabled Wait isn't read");
  const repeat = [...index.values()].find((n) => n.type === "controls_repeat_ext");
  assert.equal(repeat.inputs.TIMES.length, 1);
  assert.equal(repeat.inputs.TIMES[0].shadow, true, "the number is the toolbox's shadow");
  assert.deepEqual(
    repeat.inputs.DO.map((n) => n.type),
    ["robot_pick_up", "robot_pick_up"],
    "the block after the disabled one follows on",
  );
  const lessThan = [...index.values()].find((n) => n.fields.OP === "LT");
  assert.deepEqual([lessThan.inputs.B[0].fields.NUM, lessThan.inputs.B[0].shadow], [4, false], "a block covers the shadow under it");
  const ifBlock = [...index.values()].find((n) => n.type === "controls_if");
  assert.deepEqual(ifBlock.extra, { elseIfCount: 1, hasElse: true });
  // An action's place is its shadow, or the setting that covers it.
  const goes = [...index.values()].filter((n) => n.type === "robot_go_to").map((n) => [n.inputs.PLACE[0].type, n.inputs.PLACE[0].fields.PLACE ?? null, n.inputs.PLACE[0].shadow]);
  assert.deepEqual(goes, [
    ["value_place", "grove", true],
    ["value_place", "sawmill", true],
    ["setting_destination", null, false],
  ]);
  // The fixture compiles; its stray stack is a warning.
  const { program, errors, warnings } = compile(FIXTURE);
  assert.deepEqual(errors, []);
  assert.deepEqual(codes(warnings), [`program.unused ${tree.stacks[1][0].id}`]);
  assert.ok(program.code.length > 5);
  assert.deepEqual(
    program.code.filter((ins) => ins.args).map((ins) => Object.values(ins.args)[0].slot),
    ["item", "destination"],
    "the settings are worked out as their blocks run",
  );
});

test("the adapter refuses what isn't a workspace, and one too big to be a child's", () => {
  for (const bad of [null, 3, "blocks", [], { blocks: { blocks: {} } }, { blocks: { blocks: [{ id: "a" }] } }, { blocks: { blocks: [{ type: "x", id: "a", fields: [] }] } }]) {
    assert.deepEqual(readWorkspace(bad).problem, { code: "program.unreadable" }, JSON.stringify(bad));
  }
  const twice = workspace(chain(block("island_when_started", "a"), block("robot_unload", "a")));
  assert.deepEqual(readWorkspace(twice).problem, { code: "program.unreadable" }, "two blocks with one id");
  const long = workspace(chain(start(), ...Array.from({ length: MAX_BLOCKS }, (_, i) => unload(`u${i}`))));
  assert.deepEqual(compile(long).errors, [{ code: "program.tooBig", limit: MAX_BLOCKS }]);
  assert.deepEqual(readWorkspace({}).tree, { stacks: [], count: 0, variables: [] }, "an empty workspace is a workspace");
});

test("a program compiles to instructions, each visible one with its block's id; the start block is none", () => {
  const { program: p, errors, warnings } = compile(
    program(go("g", "pile"), repeat("r", 2, pickUp("c")), when("i", [[compare("cmp", stock("s", "wood", "pile"), "GT", num("n", 0)), [unload("u")]]], [wait("w", 3)])),
  );
  assert.deepEqual([errors, warnings], [[], []]);
  assert.equal(p.compiler, COMPILER_VERSION);
  assert.equal(p.start, "start");
  assert.deepEqual(p.needs, ["goTo", "pickUp", "unload", "wait"]);
  assert.deepEqual(p.code, [
    { op: "act", block: "g", intent: { type: "goTo", target: "pile" } },
    { op: "repeat", block: "r", times: { op: "number", block: "r-n", value: 2 }, exit: 4 },
    { op: "act", block: "c", intent: { type: "pickUp", item: "wood" } },
    { op: "jump", to: 1 },
    {
      op: "if",
      block: "i",
      branches: [{ test: { op: "compare", block: "cmp", cmp: "GT", a: { op: "stock", block: "s", item: "wood", at: "pile" }, b: { op: "number", block: "n", value: 0 } }, to: 5 }],
      otherwise: 7,
    },
    { op: "act", block: "u", intent: { type: "unload" } },
    { op: "jump", to: 8 },
    { op: "act", block: "w", intent: { type: "wait", steps: 3 } },
    { op: "end" },
  ]);
  assert.deepEqual(checkProgram(p), []);
});

test("Forever loops back to itself; else ifs are tried in order; empty bodies are fine", () => {
  const { program: p } = compile(
    program(
      forever(
        "f",
        when(
          "i",
          [
            [compare("a", basket("b"), "EQ", num("two", 2)), [unload("u")]],
            [compare("c", basket("b2"), "LT", num("one", 1)), []],
          ],
          [],
        ),
      ),
    ),
  );
  assert.deepEqual(visible(p.code), ["forever f", "if i", "act u"]);
  const at = p.code.findIndex((ins) => ins.op === "if");
  assert.deepEqual(
    p.code[at].branches.map((b) => [b.test.block, b.to]),
    [
      ["a", at + 1],
      ["c", at + 3],
    ],
  );
  assert.equal(p.code.at(-2).op, "jump");
  assert.equal(p.code.at(-2).to, 0, "the end of Forever's body goes back to Forever");
  assert.deepEqual(p.needs, ["basket", "unload"]);
  assert.deepEqual(checkProgram(p), []);
});

test("the island's starter programs compile, and every visible instruction is a block of the program", () => {
  for (const { id, source } of ISLAND_PROGRAMS) {
    const { program: p, errors, warnings } = compile(source, { places: ["grove", "sawmill", "site", "depot", "quarry", "camp"] });
    assert.deepEqual([errors, warnings], [[], []], id);
    const index = blockIndex(readWorkspace(source).tree);
    for (const ins of p.code.filter((i) => i.block)) assert.ok(index.has(ins.block), `${id}: ${ins.block}`);
    assert.deepEqual(checkProgram(p), [], id);
  }
  const planks = compile(ISLAND_PROGRAMS.find((p) => p.id === "planks").source).program;
  assert.deepEqual(visible(planks.code), ["forever planks-forever", "until planks-until", "act planks-make"]);
});

test("the same workspace always compiles to the same program, whatever the order of its JSON's keys", () => {
  const source = ISLAND_PROGRAMS[0].source;
  const reversed = (value) =>
    Array.isArray(value) ? value.map(reversed) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reversed(v)])) : value;
  assert.deepEqual(compile(reversed(source)), compile(source));
  assert.deepEqual(JSON.parse(JSON.stringify(compile(source))), compile(source), "and it's plain data");
});

test("what can't work as written is an error with its block's id, and every error is found at once", () => {
  const { program: p, errors } = compile(
    workspace(
      chain(
        start(),
        repeat("r", { ...num("half", 2.5) }),
        block("controls_repeat_ext", "empty-r"),
        until("u"),
        when("i", [[compare("cmp", compare("inner", num("x", 1), "LT", num("y", 2)), "EQ", num("z", 1)), []]]),
        block("logic_boolean", "bool"),
        pickUp("gold", "gold"),
        wait("w", 0),
        go("nowhere", "Grove!"),
        block("robot_go_to", "no-place"),
      ),
      chain(start("start-2"), unload("u2")),
    ),
  );
  assert.equal(p, null);
  assert.deepEqual(codes(errors), [
    "program.twoStarts start-2",
    "program.whole half",
    "program.empty empty-r",
    "program.empty u",
    "program.wantNumber cmp",
    "program.unsupported bool",
    "program.unsupported gold-item",
    "program.whole w",
    "program.unsupported nowhere-place",
    "program.empty no-place",
  ]);
  assert.deepEqual(errors[1], { code: "program.whole", block: "half", min: -LIMITS.number, max: LIMITS.number });
  assert.deepEqual(errors[7], { code: "program.whole", block: "w", min: 1, max: 999 });
});

test("a program needs a start block, and a stack that isn't under it is only a warning", () => {
  assert.deepEqual(codes(compile(workspace(unload("u"))).errors), ["program.noStart"]);
  assert.deepEqual(codes(compile({}).errors), ["program.noStart"]);
  const { program: p, warnings } = compile(workspace(chain(start(), unload("u")), chain(wait("w", 1), unload("u2")), stock("s", "wood", "grove")));
  assert.ok(p);
  assert.deepEqual(codes(warnings), ["program.unused w", "program.unused s"]);
  assert.deepEqual(visible(p.code), ["act u"]);
  // A disabled start block starts nothing.
  const off = workspace(chain({ ...start(), disabledReasons: ["MANUALLY_DISABLED"] }, unload("u")));
  assert.deepEqual([codes(compile(off).errors), codes(compile(off).warnings)], [["program.noStart"], ["program.unused u"]]);
});

test("for a robot or building, and an island, the compiler checks what it can do and where it can go", () => {
  const robotProgram = program(go("g", "moon"), pickUp("c"), make("m"), until("u", compare("cmp", basket("b"), "GT", num("n", 0))));
  assert.deepEqual(codes(compile(robotProgram, { type: "helper", places: ["grove"] }).errors), ["program.target g-place", "program.cannot m"]);
  assert.deepEqual(codes(compile(robotProgram, { type: "sawmill" }).errors), ["program.cannot g", "program.cannot c", "program.cannot b"]);
  assert.deepEqual(codes(compile(program(make("m", "kit")), { type: "sawmill" }).errors), ["program.cannot m"], "the sawmill makes planks, not kits");
  assert.deepEqual(compile(program(make("m", "kit"))).errors, [], "without a robot or building to run on, only the blocks are checked");
});

test("an action's place or item is part of its intent when the blocks give it, and worked out as it runs when it's a setting", () => {
  const { program: p, errors } = compile(program(go("g", "grove"), pickUp("c", my("i", "item")), go("d", my("dest", "destination")), pickUp("p", "kit")));
  assert.deepEqual(errors, []);
  assert.deepEqual(
    p.code.filter((ins) => ins.op === "act"),
    [
      { op: "act", block: "g", intent: { type: "goTo", target: "grove" } },
      { op: "act", block: "c", intent: { type: "pickUp" }, args: { item: { op: "setting", block: "i", slot: "item" } } },
      { op: "act", block: "d", intent: { type: "goTo" }, args: { target: { op: "setting", block: "dest", slot: "destination" } } },
      { op: "act", block: "p", intent: { type: "pickUp", item: "kit" } },
    ],
  );
  assert.deepEqual(p.needs, ["goTo", "pickUp", "settings"], "reading settings is something the robot must be able to do");
  assert.deepEqual(checkProgram(p), []);
  // Only robots have settings; a setting under a shadow that holds a place
  // the island hasn't is still fine, since the setting is what counts.
  assert.deepEqual(codes(compile(program(go("g", my("s", "source"))), { type: "sawmill" }).errors), ["program.cannot s", "program.cannot g"]);
  assert.deepEqual(compile(program(go("g", my("s", "source"), { under: "moon" })), { type: "helper", places: ["grove"] }).errors, []);
});

test("blocks nested too deeply are an error, not a stack overflow", () => {
  // Ten Repeats inside each other are fine; what's in the tenth is too deep.
  let body = unload("u");
  for (let i = 0; i <= LIMITS.nesting; i++) body = repeat(`r${i}`, 1, body);
  assert.deepEqual(codes(compile(program(body)).errors), ["program.tooDeep u"]);
  let fine = unload("u");
  for (let i = 0; i < LIMITS.nesting; i++) fine = repeat(`r${i}`, 1, fine);
  assert.deepEqual(compile(program(fine)).errors, []);
  let value = num("n", 1);
  for (let i = 0; i < LIMITS.expression; i++) value = compare(`c${i}`, value, "EQ", num(`m${i}`, 1));
  assert.deepEqual(codes(compile(program(until("u", value))).errors), ["program.tooDeep n", "program.tooDeep m0"]);
});

test("a damaged compiled program is found out before it runs", () => {
  const { program: p } = compile(program(repeat("r", 2, unload("u"))));
  const damaged = (change) => {
    const copy = structuredClone(p);
    change(copy.code);
    return checkProgram(copy);
  };
  assert.deepEqual(checkProgram(p), []);
  assert.notDeepEqual(damaged((code) => (code[2].to = 99)), []);
  assert.notDeepEqual(damaged((code) => (code[0].exit = -1)), []);
  assert.notDeepEqual(damaged((code) => (code[1].intent = { type: "fly" })), []);
  assert.notDeepEqual(damaged((code) => code.pop()), [], "it would run off the end");
  assert.notDeepEqual(damaged((code) => (code[0].times = { op: "random", block: "x" })), []);
  assert.notDeepEqual(checkProgram({ code: [] }), []);
});

test("the compiler can report every program code, each with the values the table of codes lists", () => {
  // A value input that holds a number where a test belongs, as only a damaged
  // workspace can.
  const swapped = workspace(chain(start(), block("control_wait_until", "u", { inputs: { UNTIL: input(num("n", 1)) } })));
  assert.deepEqual(codes(compile(swapped).errors), ["program.wantTest u"]);
  let deep = unload("u");
  for (let i = 0; i <= LIMITS.nesting; i++) deep = repeat(`r${i}`, 1, deep);
  const bad = [
    null,
    {},
    workspace(chain(start(), ...Array.from({ length: MAX_BLOCKS }, (_, i) => unload(`u${i}`)))),
    workspace(chain(start(), block("logic_boolean", "b"), until("u"), until("v", compare("c", compare("d", num("x", 1), "LT", num("y", 1)), "EQ", num("z", 0))))),
    workspace(chain(start(), wait("w", 1.5), go("g", "moon"), make("m")), chain(start("s2")), unload("stray")),
    swapped,
    // A number where a place goes, and a place where an item goes.
    program(block("robot_go_to", "gn", { inputs: { PLACE: input(num("n2", 1)) } }), block("robot_pick_up", "cp", { inputs: { ITEM: input(block("value_place", "vp", { fields: { PLACE: "grove" } })) } })),
    program(deep),
    // Blocks of one's own: a use of none, two of one name, one with two
    // inputs, one using itself through another, and a Set of an input.
    withVariables(
      workspace(
        chain(start(), call("none", "nowhere"), call("ca", "a")),
        routine("a", "a", null, call("cb", "b")),
        routine("b", "b", null, call("cab", "a")),
        routine("a2", "A"),
        block("procedures_defnoreturn", "two", { fields: { NAME: "two" }, extraState: { params: [{ name: "x", id: "x" }, { name: "y", id: "y" }] } }),
        routine("in", "in", { id: "p", name: "p" }, setVar("sp", { id: "p" }, 1), changeVar("cp", { id: "p" }, getVar("gp", { id: "p" }))),
      ),
      [{ id: "x", name: "x" }, { id: "y", name: "y" }, { id: "p", name: "p" }],
    ),
  ];
  const found = bad.flatMap((source) => {
    const { errors, warnings } = compile(source, { type: "helper", places: ["grove"] });
    return [...errors, ...warnings];
  });
  for (const problem of found) {
    const { code, ...values } = problem;
    assert.ok(code in CODES, code);
    assert.deepEqual(Object.keys(values).sort(), [...CODES[code]].sort(), code);
  }
  const programCodes = Object.keys(CODES).filter((code) => code.startsWith("program."));
  assert.deepEqual([...new Set(found.map((p) => p.code))].sort(), programCodes.sort());
});
