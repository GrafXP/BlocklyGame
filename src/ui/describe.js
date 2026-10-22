import { display, formatList, hasMessage, t } from "../i18n/index.js";
import { ITEMS } from "../sim/entities.js";
import { RECIPES } from "../sim/recipes.js";
import { thing } from "../sim/things.js";

// The world in words, in the player's language. The simulation reports codes
// with values (src/sim/codes.js) and keeps names as message references; this is
// where they become text, and nowhere else (PLAN.md §8).

export const amount = (item, count) => t(`count.${item}`, { count });

// Counts of items, as a list: "2 wood, 1 plank", or "nothing".
export function amounts(counts) {
  const parts = ITEMS.filter((item) => counts[item]).map((item) => amount(item, counts[item]));
  return parts.length ? formatList(parts) : t("world.nothing");
}

// The name of thing `id`, or the id itself when there's no such thing (a program
// can name one that isn't there).
export function placeName(world, id) {
  const found = thing(world, id);
  return found ? display(found.name) : id;
}

const actionName = (action) => (hasMessage(`action.name.${action}`) ? t(`action.name.${action}`) : action);

// The name of team `id` of `world`, or the id itself when there's no such team.
export function teamName(world, id) {
  const team = world?.roles.find((r) => r.id === id);
  return team ? display(team.name) : id;
}

// A message's words, “plank ready”, or its id when the game has none for it.
export const messageWords = (message) => (hasMessage(`message.${message}`) ? t(`message.${message}`) : message);

// A reason (codes.js) in words. The compiler's codes (program.*) need no world:
// describeReason(null, problem).
export function describeReason(world, reason) {
  switch (reason.code) {
    case "wait.item":
      return t("wait.item", { amount: amount(reason.item, reason.need), place: placeName(world, reason.at), have: reason.have });
    case "wait.space":
      return t("wait.space", { amount: amount(reason.item, reason.need), place: placeName(world, reason.at), free: reason.free });
    case "wait.route":
      return t("wait.route", { place: placeName(world, reason.target) });
    case "wait.message":
      return t("wait.message", { message: messageWords(reason.message) });
    case "wait.mailbox":
      return t("wait.mailbox", { name: placeName(world, reason.to) });
    case "error.recipient":
    case "error.source":
      return t(reason.code, { target: placeName(world, reason.target) });
    case "error.team":
      return t(reason.code, { team: teamName(world, reason.team) });
    case "supply.full":
    case "supply.noOrder":
    case "supply.basket":
      return t(reason.code, { place: placeName(world, reason.to) });
    case "supply.none":
      return t(reason.code, { item: t(`item.${reason.item}`), place: placeName(world, reason.to) });
    case "error.cannot":
    case "error.notHere":
    case "program.cannot":
      return t(reason.code, { action: actionName(reason.action) });
    case "error.setting":
      return t(reason.code, { setting: t(`setting.${reason.setting}`) });
    case "place.taken":
    case "place.blocks":
    case "place.cutOff":
      return t(reason.code, { thing: placeName(world, reason.thing) });
    case "place.robot":
      return t(reason.code, { robot: placeName(world, reason.robot) });
    default:
      // Every other code's values go into its message as they are: ids,
      // numbers and limits. Its `block` is where the editor shows it.
      return t(reason.code, reason);
  }
}

// What `entity` is doing, in words; "" when it isn't doing anything.
export function describeAction(world, entity) {
  const a = entity.action;
  if (!a) return "";
  switch (a.type) {
    // A Guard's or an Advance's few steps, or a whole Go To's way.
    case "move":
      return t(a.cells === undefined ? "action.move" : "action.toward", { place: placeName(world, a.target) });
    case "fire":
      return t("action.fire", { name: placeName(world, a.at) });
    case "watch":
    case "repair":
    case "reboot":
      return t(`action.${a.type}`);
    case "pickUp":
      return t("action.pickUp", { amount: amount(a.item, 1) });
    case "unload": {
      const out = {};
      for (const { dir, item, n } of a.holds) if (dir === "out") out[item] = n;
      return t("action.unload", { amounts: amounts(out) });
    }
    case "make": {
      const recipe = RECIPES[a.recipe];
      if (recipe.assembles) return t(recipe.assembles === "guard" ? "action.assembleGuard" : "action.assemble", { team: teamName(world, a.role) });
      return recipe.builds ? t(`action.build.${recipe.builds}`) : t("action.make", { amount: amounts(recipe.outputs) });
    }
    // A Supply with nothing to bring says why, while it waits its moment.
    case "wait":
      return entity.supply?.idle ? describeReason(world, entity.supply.idle) : t("action.wait", { count: a.end - world.tick });
    case "send":
      return t("action.send", { message: messageWords(a.message), name: placeName(world, a.to) });
    default:
      return a.type;
  }
}

// How far `entity`'s action has got: { done, total } in ticks, or null.
export function progressOf(world, entity) {
  const a = entity.action;
  return a ? { done: world.tick - a.start, total: a.end - a.start } : null;
}
