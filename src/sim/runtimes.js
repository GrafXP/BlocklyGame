import { scriptRuntime } from "./script.js";

// What drives each entity, by entity.runtime.kind. Phase 2 adds compiled
// programs beside the scripts.
export const RUNTIMES = { script: scriptRuntime };

export const runtimeOf = (entity) => (entity.runtime ? RUNTIMES[entity.runtime.kind] : null);
