import { reason } from "../sim/codes.js";
import { can } from "../sim/entities.js";
import { count } from "../sim/inventory.js";
import { thing } from "../sim/things.js";

// Evaluating a compiled expression (compiler.js) for `entity`, against the world
// as it stands in the runtimes' phase of a tick (PLAN.md §6, phase 4): every
// runtime reads the same world, and none changes it, so what one program sees
// never depends on which ran first. Values are whole numbers, booleans, and
// ids: of places and of items. A setting is the entity's own, so robots sharing
// a program read their own (PLAN.md §5). An expression is at most
// LIMITS.expression deep, so evaluating one is bounded.

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

export function evaluate(expr, entity, world) {
  switch (expr.op) {
    case "number":
      return expr.value;
    case "stock": {
      const t = thing(world, expr.at);
      if (!t) throw new Fault(reason("error.target", { target: expr.at, block: expr.block }));
      return count(t.store, expr.item);
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
