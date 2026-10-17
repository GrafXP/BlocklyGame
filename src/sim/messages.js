// Messages between robots and buildings (PLAN.md §7, coordination): a note
// with a name, from one program to one named robot or building, that a program
// there waits for with Wait For. A message carries nothing but its name: “plank
// ready” tells, it doesn't bring the plank (docs/campaign-plan.md, mission 36).
//
// - Send is an action of one step (actions.js): started in tick T, it ends in
//   tick T + 1, at the start of that tick (world.js, phase 2), and the message
//   is then in the recipient's inbox, for its program to take in the same tick.
//   Messages arrive in the order their Sends ended, and those that end in the
//   same tick in order of the sender's id.
// - An inbox holds INBOX_SIZE messages at most, counting those on their way. A
//   Send to a full one waits, “Workshop's mailbox is full”, and is tried again
//   every tick (PLAN.md §7: messages are never dropped).
// - Wait For takes the oldest message of its name from the inbox, and the
//   program goes on; with none there, it waits. Nothing else reads an inbox:
//   a message never starts a program or runs one of its own (one entry thread).
//
// An entity's inbox is entity.inbox, [{ message, from, sent }, …], oldest
// first: the message's name, the sender's id and the tick it was sent in. An
// empty inbox isn't kept, so a world without messages is as it always was.

export const INBOX_SIZE = 4;

// The messages there are, by id; each has its words in every language
// (message.<id> in ui.js, MESSAGE_<ID> in blocks.js).
export const MESSAGES = ["plankReady", "kitReady", "woodPlease", "plankPlease", "stonePlease", "stoneDelivered", "go"];

export const inboxOf = (entity) => entity.inbox ?? [];

// How many messages `entity`'s inbox holds or has on its way, in `world`.
export const queued = (world, entity) => inboxOf(entity).length + world.entities.filter((e) => e.action?.type === "send" && e.action.to === entity.id).length;

// `message` from `from`, sent in tick `sent`, arrives in `to`'s inbox.
export function deliver(to, { message, from, sent }) {
  (to.inbox ??= []).push({ message, from, sent });
}

// Takes the oldest message `message` out of `entity`'s inbox. Returns it, or
// null when there's none.
export function takeMessage(entity, message) {
  const i = inboxOf(entity).findIndex((m) => m.message === message);
  if (i < 0) return null;
  const [taken] = entity.inbox.splice(i, 1);
  if (!entity.inbox.length) delete entity.inbox;
  return taken;
}
