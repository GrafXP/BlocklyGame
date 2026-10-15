import * as Blockly from "blockly/core";
import { display } from "../i18n/index.js";
import { choicesFor } from "./choices.js";

// The "field_choice" dropdown (src/blockly/blocks.js): it offers what its list
// (src/blockly/choices.js) finds for the island and the robot or building whose
// program the workspace holds, its choice context. A workspace without one, the
// editor lab's, offers every value the block's definition lists.
//
// It never changes a program by being opened: it holds any id it's given, and
// offers it too, by its id when nothing names it. Whether the program can use
// it (a place there is, a recipe the building has) is the compiler's to say,
// at its block.

const contexts = new WeakMap(); // workspace → { world, type }

// The choice context of `workspace`'s dropdowns, and of its toolbox's: set before
// any block is loaded into it.
export const setChoiceContext = (workspace, context) => contexts.set(workspace, context);

function contextOf(field) {
  const workspace = field.getSourceBlock()?.workspace;
  if (!workspace) return null;
  // A toolbox's blocks are on a workspace of their own, which names the editor's.
  return contexts.get(workspace) ?? (workspace.targetWorkspace && contexts.get(workspace.targetWorkspace)) ?? null;
}

const word = (label) => (typeof label === "string" ? Blockly.utils.parsing.replaceMessageReferences(label) : display(label));

function optionsOf(field, list, every) {
  const context = contextOf(field);
  const offered = context ? choicesFor(list, context) : every;
  const options = offered.map(([label, value]) => [word(label), value]);
  const value = field.getValue();
  if (typeof value === "string" && value && !options.some(([, v]) => v === value)) {
    const known = every.find(([, v]) => v === value);
    options.push([known ? word(known[0]) : value, value]);
  }
  return options.length ? options : every.map(([label, value]) => [word(label), value]);
}

class FieldChoice extends Blockly.FieldDropdown {
  // `list`: the name of the list of choices; `every`: the definition's options.
  // The menu is worked out each time it opens, so it follows the island.
  constructor(list, every, config) {
    super(function () {
      return optionsOf(this, list, every);
    }, undefined, config);
  }

  static fromJson(json) {
    return new this(json.choices, json.options, json);
  }

  doClassValidation_(value) {
    return typeof value === "string" && value !== "" ? value : null;
  }

  doValueUpdate_(value) {
    this.generatedOptions = null; // so the menu has the new value
    super.doValueUpdate_(value);
  }
}

let registered = false;
export function registerFields() {
  if (registered) return;
  Blockly.fieldRegistry.register("field_choice", FieldChoice);
  registered = true;
}
