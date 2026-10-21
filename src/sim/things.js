// Finding things in the world by id: robots and buildings (world.entities) and
// resource deposits (world.nodes), each kept in order of id. The island has a
// few dozen things at most, so a search is quicker than keeping an index in step.

export const thing = (world, id) => world.entities.find((e) => e.id === id) ?? world.nodes.find((n) => n.id === id) ?? null;

// Whether robot `robot` stands where it can reach thing `id`: on one of its
// interaction cells.
export const isAt = (world, robot, id) => thing(world, id)?.access?.includes(robot.cell) ?? false;

// The building or deposit whose interaction cells include `cell` and that
// `fits`: where a robot there picks up or unloads. Buildings come before
// deposits, each in id order, so the answer never depends on anything else.
export function thingAt(world, cell, fits = () => true) {
  for (const list of [world.entities, world.nodes]) {
    for (const t of list) if (t.access?.includes(cell) && fits(t)) return t;
  }
  return null;
}

// What things there are, and what each is, in one string: it changes when a
// building is placed, or a construction site becomes its building, and views
// made thing by thing are made again then.
export const thingsKey = (world) => [...world.entities, ...world.nodes].map((t) => `${t.id}:${t.type}`).join(" ");
