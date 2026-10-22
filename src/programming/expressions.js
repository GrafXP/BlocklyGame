import { shortOf } from "../sim/actions.js";
import { reason } from "../sim/codes.js";
import { can, typeOf } from "../sim/entities.js";
import { count, room } from "../sim/inventory.js";
import { RECIPES } from "../sim/recipes.js";
import { needs } from "../sim/supply.js";
import { thing } from "../sim/things.js";

// Evaluating a compiled expression (compiler.js) for `entity`, against the world
// as it stands in the runtimes' phase of a tick (PLAN.md §6, phase 4): every
// runtime reads the same world, and none changes it, so what one program sees
// never depends on which ran first. Values are whole numbers, booleans, and
// ids: of places and of items. A setting is the entity's own, so robots sharing
// a program read their own (PLAN.md §5), and so is a variable, which lives in
// the entity's runtime (runtime.js): robots sharing a program each remember
// their own. A routine's input is the value its call gave, in the call's frame.
// An expression is at most LIMITS.expression deep, so evaluating one is bounded.

// What can't be worked out as written: the program stops with `reason`.
export class Fault extends Error {
  constructor(problem) {
    super(problem.code);
    this.problem = problem;
  }
}

const COMPARE = {
  EQ: (a, b) => a === b,
  NEQ: (a, b) => a !== b,
  LT: (a, b) => a < b,
  LTE: (a, b) => a <= b,
  GT: (a, b) => a > b,
  GTE: (a, b) => a >= b,
};

// The thing an expression's `at` names, or a Fault.
function placeOf(expr, world) {
  const t = thing(world, expr.at);
  if (!t) throw new Fault(reason("error.target", { target: expr.at, block: expr.block }));
  return t;
}

export function evaluate(expr, entity, world) {
  switch (expr.op) {
    case "number":
      return expr.value;
    case "stock":
      return count(placeOf(expr, world).store, expr.item);
    // Whether the place's order still needs some of the item (supply.js); room
    // for more of it, what isn't promised to arrive.
    case "needs":
      return needs(world, placeOf(expr, world), expr.item) > 0;
    case "space":
      return Math.max(0, room(placeOf(expr, world).store, expr.item));
    // Whether this building could start the recipe now: every ingredient here,
    // and room for the whole batch (actions.js, shortOf). It holds nothing:
    // Make checks again as it starts.
    case "ready": {
      if (!typeOf(entity).recipes?.includes(expr.item)) throw new Fault(reason("error.cannot", { action: "make", block: expr.block }));
      return shortOf(entity, RECIPES[expr.item]) === null;
    }
    case "basket": {
      if (!can(entity, "basket")) throw new Fault(reason("error.cannot", { action: "basket", block: expr.block }));
      return Object.values(entity.store.items).reduce((a, b) => a + b, 0);
    }
    case "compare":
      return COMPARE[expr.cmp](evaluate(expr.a, entity, world), evaluate(expr.b, entity, world));
    case "place":
    case "item":
      return expr.value;
    case "var":
      return entity.runtime?.vars?.[expr.var] ?? 0;
    case "arg": {
      const frame = entity.runtime?.frames?.at(-1);
      if (!frame || !(expr.param in frame.args)) throw new Fault(reason("error.busy", { block: expr.block }));
      return frame.args[expr.param];
    }
    case "setting": {
      if (!can(entity, "settings")) throw new Fault(reason("error.cannot", { action: "settings", block: expr.block }));
      const value = entity.settings[expr.slot];
      if (value == null) throw new Fault(reason("error.setting", { setting: expr.slot, block: expr.block }));
      return value;
    }
    default:
      throw new Error(`no expression ${expr.op}`);
  }
}
