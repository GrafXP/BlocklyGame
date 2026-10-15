# Test fixtures

`blockly-workspace.json` is a workspace exactly as Blockly 13.4.0 saved it, for the adapter's tests (`test/compiler.test.js`). It was built in the editor lab through Blockly's own API (`workspace.newBlock`, `connection.connect`, `setDisabledReason`), not loaded from JSON, then saved with `Blockly.serialization.workspaces.save`. So it has what only Blockly writes: random block ids full of punctuation, positions, a shadow covered by a block, `disabledReasons`, and an If's `extraState`.

What it holds: when started → forever { go to grove; repeat 2 { collect wood; *(disabled)* wait 5 steps; collect wood }; go to sawmill; if planks at sawmill < 4 { unload } else if items in basket > 0 { wait 3 steps } else { wait until items in basket = 2 } }, and a stray “pick up planks” beside it.

`e2e/programs.spec.js` checks that Blockly still loads it and saves it unchanged. If a Blockly upgrade changes what it writes, build the same workspace again the same way and save it here.
