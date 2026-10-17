# Robot Island: a 40-mission campaign

Campaign plan · 15 October 2026 · Ages 7–9 · Adopted in PLAN.md the same day

This is a new campaign design for the game described in [PLAN.md](../PLAN.md). It expands the earlier 12-mission outline into **40 short missions in eight chapters**, with room to practise before another idea arrives. PLAN.md has adopted it in place of its original 12 missions (PLAN.md §9 and §16, Campaign). This document is the content specification: what each mission teaches and asks of the child. PLAN.md says what the game provides for it and in which phase.

The campaign follows one growing island: make camp, learn to carry materials, open the sawmill, build the bridge, and restore the workshop district. The final project is to prepare the island for a welcome celebration by running a small, dependable production network.

## Learning and pacing

- **Missions 1–25 form the main learning journey.** A child who finishes them has programmed sequences, loops, decisions, and cooperating workers. Mission 25 is a satisfying achievement in its own right.
- **Missions 26–40 are the advanced continuation.** Memory, routines, and messages are introduced through small, supported examples. Younger children may want to play these with an adult or return later.
- Target **3–6 minutes** for the first five missions, **5–10 minutes** for ordinary missions, and **10–15 minutes** for chapter projects. These are design targets to test with children, not deadlines or measured completion times.
- A play session can be one or two missions. Save after every mission and during longer projects; never require an entire chapter in one sitting.
- Introduce one main programming idea at a time. A new item or action can reuse a familiar idea, but it still needs a short demonstration.
- Alternate completing a starter, changing a working example, repairing a mistake, and making a small program independently. Do not make all 40 missions blank-workspace exercises.
- Use quantities from 1 to 4 for most tasks. Later projects may need up to 8 raw materials, shown as grouped pictures. Avoid multiplication worksheets, negative counters, and typing-heavy naming tasks.
- Offer a short prediction before Run and a short explanation after success. These can be spoken, pointed at, or skipped; reading and writing must not become the programming test.
- Introduce Pause and Step through guided play. Offer Step to Next Block for long walks; do not make a child press Step dozens of times to finish an action.

Every mission has one visible main goal. Optional experiments have no effect on progression. There are no countdowns, penalties for hints, lost lives, or mandatory speed/block-count scores.

## Chapter map

| Chapter | Missions | What the child learns | Visible milestone |
| --- | --- | --- | --- |
| 1. Hello, Helper! | 1–5 | Instructions, order, testing, fixing one mistake | Camp has its first supplies |
| 2. Do It Again | 6–10 | Repeat, loop bodies, basket limits, small nested loops | Regular deliveries reach camp |
| 3. A Working Island | 11–15 | Building programs, transfers, simultaneous programs, Forever | The bridge opens |
| 4. Look Before You Act | 16–20 | Reading counts, If, Else, Wait Until, controlled production | The island keeps a useful reserve |
| 5. Give Everyone a Job | 21–25 | Shared programs, settings, individual copies, a production recipe | The workshop makes its first kits |
| 6. Remember the Job | 26–30 | Variables, changing values, countdowns, separate memories | The team fulfils counted orders |
| 7. Make Your Own Blocks | 31–35 | Procedures, reuse, inputs, breaking a job into parts | A reusable kit-delivery plan works |
| 8. Talk and Work Together | 36–40 | Messages, request/reply, diagnosing a stalled team, system design | The island is ready to welcome visitors |

Open a small free-play area after mission 15 using the blocks already learned. Expand it after mission 25. Advanced lessons remain available without making them a condition of enjoying sandbox play.

## World rules the campaign must respect

These details keep the lessons consistent with the existing game rather than implying a different kind of Blockly game.

- `Go To` chooses a named place and finds the route. These missions teach program order, not grid steering, turns, or coordinates.
- `Collect` takes one raw material from a source. `Pick Up` takes one item from a building. They are introduced separately.
- A helper's basket holds **two items total**, including mixed items. `Unload` transfers the whole basket. A three-item recipe needs more than one delivery.
- The sawmill turns **one wood into one plank**. The bridge needs **four planks**. The planned workshop turns **two planks plus one stone into one kit**.
- An action completes before the next action in that program. A missing supply or full store makes an action wait; the action is not skipped.
- `Forever` keeps doing a job. It does not mean that a later block will eventually run. A one-time construction action belongs outside Forever.
- All robots and buildings share Run, Pause, and Step. One Step advances the world, not just the selected robot. A long action can remain highlighted across several steps.
- A condition describes the world when it is checked. Stock is not a reservation, and `If` checks again only when the program reaches it again.
- Reusing a program does not make robots share their current block or memory. Each robot runs its own instance.
- A message goes to an inbox and is consumed by an explicit matching wait/receive. It does not interrupt the receiver or start a second script.

Use the existing three helpers and building categories throughout. Shelters, signs, bunting, and restored scenery are possible visual rewards, not additional resource systems or recipes. No mission depends on batteries, weather, farming, combat, conveyors, or more robot chassis.

## Mission cards

The quoted sentence is proposed child-facing mission text. The other fields are authoring notes. Unless stated otherwise, a mission follows the previous one and uses already learned blocks. Earlier programs may be supplied as working helpers, but their contribution must be visible. Only the program or small section being taught should need editing.

All numerical goals below refer to the mission's marked order or a change since its starting checkpoint, not to unrelated stock left over from earlier missions. Exact-order lessons use dedicated destination stock and account for deliveries still in progress before showing success.

### Chapter 1 — Hello, Helper!

#### 01. Hello, Helper!

“Help Robo 1 find the grove.”

- **Learn:** A block tells a robot what to do.
- **Setup and support:** One selectable helper, a clearly marked grove, and a fixed `When Started` block. Offer only `Go To`; preselect the grove. Point to Apply and Run in context.
- **Player task:** Attach the action and run the program.
- **Success:** Robo 1 reaches the grove's interaction point.
- **Hint / talk:** “Put the instruction under Start.” Ask the child to point to the place the robot will go before running.

#### 02. One Piece of Wood

“Put one piece of wood in the basket.”

- **Learn:** An action can change what a robot carries.
- **Setup and support:** Robo 1 starts at the grove with an empty basket. Show its two basket spaces as pictures. Supply Start and introduce `Collect Wood`.
- **Player task:** Add Collect and watch one wood appear in the basket.
- **Success:** The robot holds one wood after collection completes.
- **Hint / talk:** “The robot is already beside the wood.” Ask what changed and what did not.

#### 03. Bring It Home

“Bring your wood back to camp.”

- **Learn:** Instructions run from top to bottom.
- **Setup and support:** Start at the grove carrying the wood from mission 2. Offer `Go To Camp` and the new `Unload Basket`, with two visible spaces in the starter.
- **Player task:** Put travel before unloading.
- **Success:** One wood reaches camp and the robot's basket is empty.
- **Hint / talk:** “Where must the robot be before it can unload?” Follow the highlight from travel to unloading.

#### 04. The Mixed-Up Instructions

“Something is in the wrong place. Help Robo 1 fix it.”

- **Learn:** Debugging means noticing what happened and changing a cause.
- **Setup and support:** A fresh empty robot at camp; a four-action delivery program tries Collect before Go To Grove. Supply every needed block.
- **Player task:** Predict the first action, use Step to see the problem, then move the misplaced block. Demonstrate Step to Next Block for the corrected walk.
- **Success:** The repaired program delivers one wood without the location error.
- **Hint / talk:** “Which instruction needs the robot to be at the grove?” Change one thing, then try again.

#### 05. Camp Is Ready

“Bring two pieces of wood for our camp.”

- **Learn:** Make a complete short sequence independently; no new block.
- **Setup and support:** Empty basket at camp; a picture strip shows grove, two wood, camp, empty basket. Provide Start and familiar blocks, without placing the sequence for the child.
- **Player task:** Go to the grove, collect twice, return, and unload. Two separate one-item trips are also valid.
- **Success:** Two new wood reach camp.
- **Hint / talk:** “Tell the robot the whole job.” Reveal a small camp improvement and ask the child to describe their instructions in order.

### Chapter 2 — Do It Again

#### 06. Again, Please!

“Can one Repeat block collect two pieces?”

- **Learn:** Repeat does its inside instructions a chosen number of times.
- **Setup and support:** Robo 1 starts at the grove. Show one Collect block beside a starter `Repeat 2` with one gap. (Two Collects, as first planned, were one stack: dragging it put both into the loop, and the third Collect waited for room in the basket forever.) Keep the count fixed at first.
- **Player task:** Put Collect inside Repeat. Travel home is already supplied after the loop.
- **Success:** Two wood are collected and delivered.
- **Hint / talk:** “What happens once? How many times should it happen?” Point to each basket space as a round finishes.

#### 07. A Whole Trip Again

“Bring three pieces, one trip at a time.”

- **Learn:** A loop can repeat an entire sequence.
- **Setup and support:** Start at camp. Supply one working trip: go to grove, collect one, go to camp, unload. Show three empty delivery pictures.
- **Player task:** Put the whole trip inside `Repeat 3`.
- **Success:** Three one-item deliveries complete, with the robot ending empty at camp.
- **Hint / talk:** “Which parts must happen on every trip?” Compare repeating Collect with repeating the whole journey.

#### 08. Two Basket Spaces

“Bring four pieces without overfilling the basket.”

- **Learn:** A program must respect a physical limit.
- **Setup and support:** A starter tries to collect three times before unloading. Show two basket spaces and let the third collection wait visibly. Provide a partly filled plan for two trips.
- **Player task:** Make each trip collect two items before returning. An outer `Repeat 2` with two ordinary Collect blocks is enough; do not introduce nesting yet.
- **Success:** Four wood reach camp, and no trip needs more than two basket spaces.
- **Hint / talk:** “The basket is full. What must happen before another collection?” Waiting is a clue, not a punishment.

#### 09. A Repeat Inside a Repeat

“Make two trips, with two pieces on each trip.”

- **Learn:** An inner loop finishes as part of each outer round.
- **Setup and support:** Reuse the working two-trip program. Its outer loop and travel actions are already placed. Highlight only the two adjacent Collect blocks.
- **Player task:** Replace those two blocks with an inner `Repeat 2 → Collect`.
- **Success:** Four wood arrive in two full-basket deliveries.
- **Hint / talk:** “Two pieces for this trip; then the next trip begins.” Animate the two loop counts separately. Do not require multiplication vocabulary.

#### 10. The Loop Detective

“The robot collects wood, but never brings it home. Find out why.”

- **Learn:** Review loop boundaries and diagnose a full-basket wait.
- **Setup and support:** A supplied three-trip loop has Go To Camp and Unload accidentally placed after the loop. All action choices and the repeat count are correct.
- **Player task:** Move the return-and-unload pair inside the loop; use the highlight and basket to check the repair.
- **Success:** Exactly three one-item deliveries finish without a full-basket stall.
- **Hint / talk:** “What is repeated? What is left until the very end?” Award a delivery badge without introducing another mechanic.

### Chapter 3 — A Working Island

#### 11. Wake Up the Sawmill

“Turn one piece of wood into a plank.”

- **Learn:** A building can run a program too.
- **Setup and support:** The sawmill already holds one wood and has output space. Focus selection on the sawmill; introduce `Make Plank` under Start.
- **Player task:** Program the sawmill and watch its input become its output.
- **Success:** One plank is produced by the building.
- **Hint / talk:** “Which thing does the making?” Show that making takes time while the same action remains highlighted; no Wait block is needed.

#### 12. The Plank Courier

“Take two planks from the sawmill to the depot.”

- **Learn:** Pick Up takes a finished item from a building.
- **Setup and support:** The sawmill holds two planks. Supply travel and unloading, with a familiar Repeat containing a new Pick Up gap.
- **Player task:** Pick up two planks and deliver them to the depot.
- **Success:** Two planks move from the sawmill into the depot.
- **Hint / talk:** “Collect finds raw materials. Pick Up takes something stored here.” Use different source pictures as well as words.

#### 13. Two Jobs at Once

“Bring wood while the sawmill gets ready to make planks.”

- **Learn:** Separate programs work at the same time on one world clock.
- **Setup and support:** The sawmill starts empty with a supplied `Repeat 2 → Make Plank` program. The child has a familiar two-wood delivery program with its destination left to choose.
- **Player task:** Deliver to the sawmill, then pause and inspect both programs together.
- **Success:** The robot supplies two wood and the sawmill produces two planks.
- **Hint / talk:** “The sawmill is waiting for wood. Who can bring it?” One Step advances both workers; no message or guessed delay is needed.

#### 14. Keep It Going

“Keep bringing wood while your friends make and move planks.”

- **Learn:** Forever keeps a useful job running.
- **Setup and support:** Supplied sawmill and courier programs repeatedly make planks and take them to a roomy depot. Show their existing loops. Give the child the collector's known one-item delivery trip.
- **Player task:** Wrap that trip in Forever. Show how Pause stops the whole world.
- **Success:** At least four new planks reach the depot while the collector completes multiple trips.
- **Hint / talk:** “What should happen after this delivery?” Explain that a worker waiting for supplies may still be doing the right job.

#### 15. Across the Stream

“Work together to build our bridge.”

- **Learn:** Combine familiar programs into a production chain. `Build Bridge` is a new action using the familiar building-program pattern.
- **Setup and support:** Keep the collector and sawmill working. The courier has a destination gap; the site has Start and a Build Bridge block to attach. Use a four-plank picture on the site.
- **Player task:** Send planks to the site and start its one-time building program. Observe collector → sawmill → courier → site.
- **Success:** The site consumes four planks, completes the bridge, and opens the route across the stream.
- **Hint / talk:** “Follow one piece of wood all the way to the bridge.” Celebrate with a crossing and unlock basic free play. Never put Build Bridge in Forever.

### Chapter 4 — Look Before You Act

#### 16. How Many Are Ready?

“Look at the sawmill's stock and take what is ready.”

- **Learn:** A sensor supplies a number from the world.
- **Setup and support:** One isolated courier starts at a sawmill holding one or two planks. No other program changes that stock during the pickup. Supply `Repeat [gap] → Pick Up Plank`, followed by travel and unloading.
- **Player task:** Put the sawmill's plank-count sensor into Repeat. Show the number it reads before running.
- **Success:** The courier transfers the starting stock correctly in two visible trials: one plank and two planks.
- **Hint / talk:** “The number comes from the shelf.” Explain that Repeat reads its count when the loop starts; it does not keep changing the count as items are taken.

#### 17. Only When We Need It

“Make a plank only when the shelf has fewer than two.”

- **Learn:** If chooses whether to do an action, using a true-or-false comparison.
- **Setup and support:** Offer If with a preassembled `planks at sawmill < 2` condition. The sawmill has wood and room. Show the condition as a readable picture question before showing the comparison symbol.
- **Player task:** Put Make Plank inside If.
- **Success:** In two small trials, starting with one plank makes one more; starting with two makes none.
- **Hint / talk:** “Is the shelf below the line?” A single If checks once. Repeated checking is reserved for mission 20.

#### 18. This Job or That Job

“If the sawmill has a plank, bring it home. Otherwise, bring it wood.”

- **Learn:** Else chooses another action when the condition is false.
- **Setup and support:** A supplied `If planks at sawmill > 0` has a working plank-delivery branch. Offer Else and a familiar wood-delivery sequence. Give the sawmill no active production job during either trial, making the choice unambiguous.
- **Player task:** Place the wood job in Else.
- **Success:** One trial with a plank delivers it to the depot; another with none delivers wood to the sawmill.
- **Hint / talk:** “Which path will run this time?” Both branches return with an empty basket, and only one branch runs per check.

#### 19. Wait for a Full Load

“Wait until two planks are ready, then take both.”

- **Learn:** Wait Until holds the program at a condition until it becomes true.
- **Setup and support:** A working sawmill makes two planks over time. Supply a courier program with a gap before its two pickups. The courier starts at camp.
- **Player task:** Add `Wait Until planks at sawmill >= 2` before travelling to the sawmill.
- **Success:** The courier departs only once two planks are ready, then delivers both together. Repeat with the producer starting later.
- **Hint / talk:** “What should become true before the trip starts?” Pick Up already waits for a missing item; this wait deliberately chooses when the whole batch journey begins. Do not guess a number of waiting steps.

#### 20. Just Enough Planks

“Keep two planks ready when our friends take some away.”

- **Learn:** Combine sensing, If, and Forever into a feedback loop; no new block.
- **Setup and support:** A reliable collector supplies wood. A supplied courier removes one plank on each of two visible visits, waiting for the reserve first. Provide a Forever shell and the condition from mission 17.
- **Player task:** Make the sawmill repeatedly check whether its stock is below two before making one plank.
- **Success:** The sawmill builds and restores a two-plank reserve after both removals, without making a third plank when two are already ready and inputs/output space are available.
- **Hint / talk:** “When does the program look again?” Observe a complete settled producer cycle after the final refill, not just the instant the count reaches two.

### Chapter 5 — Give Everyone a Job

#### 21. Two Helpers, One Plan

“Give both helpers the same stone-delivery job.”

- **Learn:** Multiple robots can use one shared program.
- **Setup and support:** The bridge is open; the stone pit has ample stone. Provide one working program that makes two one-stone trips from pit to depot. Introduce library assignment with a preview naming both affected robots.
- **Player task:** Assign the same program to two helpers.
- **Success:** Each helper completes two deliveries, for four new stone at the depot.
- **Hint / talk:** “They share the instructions. Must they be on the same block?” Show both markers, including when one waits briefly for the other.

#### 22. Same Plan, Different Places

“One helper brings wood. The other brings stone.”

- **Learn:** Per-robot settings let a shared program do different jobs.
- **Setup and support:** Supply the shared collector with `my Source`, `my Item`, and `my Destination` already in its action inputs. Show three picture-based settings on each robot. Both sources are raw-material nodes.
- **Player task:** Set one helper to grove/wood/depot and the other to stone pit/stone/depot.
- **Success:** Each helper completes its two one-item deliveries, with two wood and two stone arriving.
- **Hint / talk:** “The plan is the same. Which choices belong to this robot?” Do not introduce child-defined procedure inputs yet.

#### 23. One Edit Helps Everyone

“Teach both collectors to carry two pieces on a trip.”

- **Learn:** Applying an edit to a shared program updates everyone assigned to it.
- **Setup and support:** Begin paused, with empty baskets and no unfinished actions. Reuse the two configured collectors. The shared program has one trip; the collection section is highlighted.
- **Player task:** Change that section to Repeat 2, inspect the affected-robots preview, and apply once.
- **Success:** Each helper uses the revised program and completes a two-item delivery of its configured material.
- **Hint / talk:** “Who will use this change?” Observe both baskets. Restart from a clean mission checkpoint for comparisons, since Apply restarts the affected programs.

#### 24. A Special Job for One

“Keep one collector working. Give the other a one-trip job.”

- **Learn:** An individual copy can change without changing a shared original.
- **Setup and support:** Two helpers share a supplied Forever collector. The special helper's new job is one delivery using its existing settings; this changes behavior, not just a destination.
- **Player task:** Make an individual copy for that helper and remove its Forever wrapper. Preview which robot the edit affects.
- **Success:** The special helper completes one trip and stops; the other completes at least two trips using the unchanged shared program.
- **Hint / talk:** “Is this change for everyone or just this helper?” Offer returning to the shared job as an optional experiment.

#### 25. Our First Workshop

“Bring the workshop what it needs to make two kits.”

- **Learn:** Combine familiar deliveries to satisfy a recipe; no new programming structure.
- **Setup and support:** Open the planned workshop. Show one kit as two plank pictures plus one stone picture. Stage four planks at the sawmill and at least two stone at the pit. Supply a workshop program that makes two kits once materials arrive.
- **Player task:** Give one robot two full-basket plank trips and another one two-stone trip. Use familiar library/settings tools where useful; do not force raw-material Collect and building Pick Up into one identical program.
- **Success:** The workshop consumes four planks and two stone and produces two kits.
- **Hint / talk:** “Can all three recipe pieces fit in one basket?” Restore part of the workshop district, celebrate the main campaign milestone, and expand free play.

### Chapter 6 — Remember the Job

#### 26. A Number to Remember

“Remember how many deliveries the order needs.”

- **Learn:** A variable is a named piece of a robot's memory.
- **Setup and support:** Introduce one variable, `order`, with a live number display. Supply `set order to [number]` and a familiar one-item delivery loop with its count missing.
- **Player task:** Put the value of order into Repeat. Try an order of two and then three, changing only the remembered number between clean trials.
- **Success:** Each trial completes exactly its requested number of one-item deliveries.
- **Hint / talk:** “Where can the robot look up the number?” Keep the name supplied and editable; do not require keyboard entry.

#### 27. Count Finished Deliveries

“Keep a count of the trips you have finished.”

- **Learn:** Change a variable as the program runs.
- **Setup and support:** Supply `set delivered to 0` before a three-trip loop. Introduce `change delivered by 1`, with the number display beside the basket and destination.
- **Player task:** Put the increment after Unload inside the loop.
- **Success:** Three completed one-item deliveries produce a remembered count of three. The count does not rise while an unload is still waiting or in progress.
- **Hint / talk:** “When is a delivery really finished?” Pause immediately before and after unloading to compare the value.

#### 28. How Many Are Left?

“Finish the order, then wait for another job.”

- **Learn:** A changing value can control whether more work happens.
- **Setup and support:** Supply `set remaining to 3` and a Forever shell beginning with `Wait Until remaining > 0`. Reuse the one-item delivery trip. Show three order pictures that can be crossed off.
- **Player task:** Put `change remaining by -1` after the successful unload. Explain it as “one fewer”, not a lesson about negative numbers.
- **Success:** Three items are delivered, remaining becomes zero, and the robot waits before collecting a fourth.
- **Hint / talk:** “What should the robot remember after this delivery?” Optional experiment: change the starting order to two and run a fresh trial.

#### 29. My Count, Your Count

“Give two helpers two deliveries each.”

- **Learn:** Robots using shared code still have separate variables.
- **Setup and support:** Both helpers use the same program: set delivered to zero, repeat two deliveries, increment after each. Start them at different reachable places so they make progress at different times. No shared/global variable is introduced.
- **Player task:** Assign the program and inspect the two live values during the run.
- **Success:** Each helper ends with delivered equal to two; together they deliver four items.
- **Hint / talk:** “This helper says one. What might the other say?” Do not imply that changing one variable changes the other robot's memory.

#### 30. The Forgetful Counter

“Three deliveries arrived, but the counter says one. Repair the memory.”

- **Learn:** Review initialization and updating by debugging.
- **Setup and support:** Supply a three-trip program that resets delivered to zero inside every loop round, then increments after unloading. The physical deliveries work correctly.
- **Player task:** Watch the value and move initialization before the loop.
- **Success:** Three deliveries complete and the final count is three. Repeat from the mission checkpoint to show that a new run starts at zero.
- **Hint / talk:** “Which instruction makes the robot forget?” Celebrate explaining the mismatch, not merely moving the highlighted block.

### Chapter 7 — Make Your Own Blocks

#### 31. My Delivery Block

“Give this whole delivery job a name.”

- **Learn:** A procedure packages a familiar sequence as one callable block.
- **Setup and support:** Supply a complete one-wood delivery sequence and a procedure named `Bring Wood`. Introduce its matching call block. No inputs or return values yet.
- **Player task:** Move the sequence into the procedure and call it twice from Start.
- **Success:** Both calls return after unloading; two wood arrive at camp.
- **Hint / talk:** “What is hidden inside your new block?” Let the child open the routine and follow execution entering it and coming back.

#### 32. Fix It in One Place

“One repair can fix every use of your delivery block.”

- **Learn:** Reused behavior is maintained in its definition.
- **Setup and support:** A main program calls Bring Wood three times. Its supplied definition is missing Unload, eventually causing a full-basket wait. All three calls refer to the same procedure.
- **Player task:** Repair the definition once, then restart from the empty-basket checkpoint.
- **Success:** Three successful deliveries finish without changing each call.
- **Hint / talk:** “Where does this block get its instructions?” Compare the definition with the places it is used.

#### 33. One Routine, Two Destinations

“Use your delivery block for camp and the depot.”

- **Learn:** An input gives a routine a choice for this call.
- **Setup and support:** Add one destination input to the existing Bring Wood definition. Source and item remain fixed. Provide two calls with picture dropdowns; use the input in the return Go To block.
- **Player task:** Call Bring Wood with camp, then with depot.
- **Success:** One wood reaches each destination using the same definition.
- **Hint / talk:** “What changes between these two calls?” Explain that a robot setting belongs to the robot, while this input belongs to one use of the routine.

#### 34. Tell the Routine How Many

“Ask for one delivery, then ask for three.”

- **Learn:** Practise a procedure input as a number, using familiar Repeat.
- **Setup and support:** Supply `Bring Some Wood(amount)` with a fixed destination and a Repeat-count gap. Each repeated trip carries one item, so any taught count respects basket capacity.
- **Player task:** Put amount into the loop count and call the routine with one and then three.
- **Success:** The first call delivers one wood; the second adds three, for four total.
- **Hint / talk:** “Does three mean three things in the basket, or three trips?” Keep one input per routine; additional inputs are an optional later experiment.

#### 35. Little Jobs Make a Big Job

“Build a kit-delivery plan from smaller jobs.”

- **Learn:** Break a larger task into named, understandable parts; no new block.
- **Setup and support:** Stage four planks at the sawmill and two stone at the pit. A supplied workshop makes two kits. Offer picture job cards and starter definitions for Bring Two Planks, Bring One Stone, and Deliver One Kit; each finishes with an empty basket.
- **Player task:** Complete the familiar action sequences and call the three jobs in order inside Repeat 2. Other helpers have no active job, so this stays a one-robot planning task.
- **Success:** Two kits are produced and delivered to the depot. Pick Up naturally waits if the workshop is still making a kit.
- **Hint / talk:** “Which little job must happen before the next?” Draw or point through the three-part plan before running. Multiple valid decompositions are welcome.

### Chapter 8 — Talk and Work Together

#### 36. You Have a Message

“Tell the courier when a plank is ready.”

- **Learn:** One program can send a named message that another explicitly waits for.
- **Setup and support:** The sawmill holds one wood. Its program makes a plank, then has a Send gap. The courier already has Wait For `plank ready`, followed by the familiar pickup and delivery sequence. Show both inboxes.
- **Player task:** Send `plank ready` to that courier after Make Plank. Step through sending and receiving, then swap which small gap the child fills in an optional replay.
- **Success:** The matching message is sent after production, consumed by the courier's wait, and one plank reaches the depot.
- **Hint / talk:** “The note tells your friend something; it does not carry the plank.” This introduces messages even though a simple pickup could wait for stock without one.

#### 37. Ask, Deliver, Reply

“Bring one stone each time the workshop asks for it.”

- **Learn:** A request and a reply coordinate repeated work.
- **Setup and support:** The workshop holds four planks. Supply its two-order program: send `stone please`, wait for `stone delivered`, make a kit. Supply the collector's Forever/Wait For structure and familiar stone trip.
- **Player task:** Place the reply after unloading at the workshop, then follow the two-message exchange.
- **Success:** Two requests cause two stone deliveries and two kits. Each reply follows its completed delivery; the workshop has only one outstanding request at a time.
- **Hint / talk:** “Who starts the conversation? Who answers?” Use two named message choices, without payloads, broadcasts, or hidden event handlers.

#### 38. Everybody Is Waiting

“The team has stopped. Find the missing first move.”

- **Learn:** Diagnose a coordination problem across programs.
- **Setup and support:** Reuse mission 37's small network, but the workshop waits for `stone delivered` before sending its first request. The collector correctly waits for `stone please`. Show both waits and the empty inboxes.
- **Player task:** Follow who is waiting for whom and move the initial request before its reply wait.
- **Success:** Two complete request/delivery/reply cycles produce two kits without manual nudges or guessed delays.
- **Hint / talk:** “Can either friend send the first note?” The defect is ordering, not an invisible lost message. Restore the same checkpoint for the corrected run.

#### 39. The Celebration Rehearsal

“Give everyone a job and deliver one finished kit.”

- **Learn:** Plan and test a small complete system; no new block.
- **Setup and support:** Three helpers, grove, stone pit, sawmill, workshop, and depot. Offer previously learned programs/routines as selectable starters. Show the recipe chain and three robot job cards.
- **Player task:** Choose the jobs, set destinations, and test the full chain. A clear reference plan is: one robot supplies wood; one carries two planks and then one stone to the workshop; one takes finished kits to the depot. The buildings run their own programs.
- **Success:** One kit made from this mission's supplied raw materials reaches the depot, with each stage visible in the overview.
- **Hint / talk:** “Where is the next missing piece?” Let the child fix one observed issue and save the working plan for the finale. Messages are available, not compulsory when stock-waiting already works.

#### 40. Welcome to Robot Island!

“Use your team's plan to deliver four kits for our celebration.”

- **Learn:** Extend, explain, and repair a cooperating system; no new feature in the finale.
- **Setup and support:** Carry forward the rehearsal's programs. Prepare a visible four-kit order, at least eight wood and four stone, and enough storage. Keep all required routes open. Use a longer familiar courier route as a visible test variation, not a surprise hazard.
- **Player task:** Adapt the plan for four kits, use counters/routines/messages where helpful, and watch supplies flow without manually moving items or restarting workers to make progress.
- **Success:** Four newly made kits reach the depot. Each recipe's materials are accounted for, and the production network completes the order under both the normal and slower-courier rehearsal conditions. Ordinary temporary waits are allowed.
- **Hint / talk:** “Show one thing your program remembers, repeats, decides, or tells a friend.” Celebrate the restored island and preserve the child's programs in sandbox. Do not require every advanced block family in one solution.

## Teaching support and progression

### A consistent hint ladder

Every mission should offer these three levels, with no score penalty:

1. **Look:** Point to relevant evidence: the basket, a stock count, a highlighted block, a waiting reason, or an inbox.
2. **Think:** Ask one concrete question about the new idea. Each card's Hint / talk line provides a starting point.
3. **Try:** Show a partial arrangement with one meaningful choice left. Offer a complete worked example if the child still wants help, then a small replay variation they can try themselves.

Help should respond to the observed problem. A full-basket hint should not appear when the destination is wrong. After repeated unchanged runs or a persistent stall, gently offer the next hint; do not interrupt a child who is still editing or exploring.

### Scaffolding that gradually fades

| Stage | Default support | Evidence of understanding |
| --- | --- | --- |
| First encounter | Demonstration, fixed numbers, one gap | Predict the next visible action |
| Practice | Working example with one meaningful change | Make it work with a different number/place |
| Debugging | A program with one deliberate mistake | Point to the cause and test a repair |
| Chapter project | Goal pictures and reusable starters | Choose jobs, run, observe, and adjust |

Keep a “Show me a start” option in projects. An advanced child can choose a blank workspace or a changed layout; a younger child can finish from scaffolds. Both receive the same mission completion reward.

World outcomes decide mission completion. Never require the reference solution's exact block arrangement. A sequence can solve a task intended to practise Repeat; acknowledge the success, then offer the Repeat version as a teaching prompt or variation. For reuse and memory lessons, show program assignments and live values as learning evidence without requiring fixed block IDs, variable names, or workspace coordinates.

### Reading, language, and accessibility

- Keep the main instruction to one short sentence, supported by source, item, quantity, and destination pictures.
- Use consistent terms from [the glossary](glossary.md): basket, stock, Collect, Pick Up, program, and step. Explain a new word through an action before relying on the label alone.
- Provide English and German mission text, hints, rewards, and accessible descriptions when content is implemented. The English lines in this plan are source drafts, not completed localization.
- Use shapes/icons alongside robot colors and condition colors. Make quantity visible without needing to distinguish red from green.
- Offer optional read-aloud, repeatable demonstrations, large touch targets, and a persistent objective card. Text, speech, and pictures should describe the same task.
- Never require a child to calculate simulation timing. Wait N Steps, if exposed for optional experiments, is not a substitute for sensing or messages.

## Checkpoints, resources, and reliable goals

The island grows across chapters, but each lesson needs a clear, recoverable starting situation.

1. **Preserve the settlement and the child's work.** Keep a mission-start checkpoint. Restart restores the starting world and resets execution while preserving the child's edited programs, as specified in the project's checkpoint policy. Keep unapplied drafts available too. Offer “Back to starter program” separately.
2. **Make setup changes visible.** If a lesson stages planks, supplies an order, parks unused helpers, or prepares an isolated trial, show that preparation. Each mission begins with its resources reset, every building empty and every deposit full, so stage on top of that rather than relying on what an earlier mission left.
3. **Control who can touch lesson resources.** Especially in missions 16–19, give only the relevant producer/consumer active jobs in the mission setup. A count-comparison lesson should not accidentally become a race for reservations. This does not introduce separate clocks or individual Pause controls.
4. **Budget the whole chain.** Two kits require four planks and two stone; four kits require eight wood, converted to eight planks, plus four stone. Do not count the same material twice or rely on unknown leftovers. Finite stone supplies need explicit top-ups as the campaign progresses.
5. **Budget destination space too.** Default baskets stay at two. Explicitly author storage capacities, preloaded amounts, and output room for each mission. When introducing four staged planks, ensure the shelf can hold them; when making kits, provide a compatible kit store.
6. **Judge completed actions.** Do not award a delivery when a robot starts unloading. For exact orders, check the destination, completed deliveries, and remaining/in-progress actions so an imminent extra delivery does not pass unnoticed. A halted final program is appropriate for finite-order lessons, not a requirement for every continuous system.
7. **Exercise both condition outcomes.** Missions 16–19 use visible small trials with a reset between them. Explain what changed. Do not reject a child with an undisclosed test case or require a timing trick.
8. **Observe stable behavior where needed.** Mission 20 needs sufficient ongoing supply to expose overproduction, storage above the two-plank target, and observation after refills and pending jobs settle. The final missions must run long enough to finish the requested kits; intermediate empty shelves and visible resource waits are normal.
9. **Keep earlier replays separate.** Use the programs, targets, and unlocks from that mission's saved checkpoint. A replay must not replace the main settlement with an earlier version.

## Implementation dependencies and handoff

This plan was grounded in the [phase 2 findings](phase2.md), [phase 3 findings](phase3.md), [block labels](../src/i18n/en/blocks.js), [entity rules](../src/sim/entities.js), and [recipes](../src/sim/recipes.js). The status column names the phase of PLAN.md §11 that provides each capability, as of 15 October 2026, when Phase 4 was complete. It is not a claim that the campaign is playable now.

| Needed capability | First mission | Status / authoring requirement |
| --- | --- | --- |
| Sequence, movement, collection, unloading, Repeat | 1–7 | In place (Phases 1–2); mission layouts, starters, and teaching UI come with Phase 7 |
| Pause, active-block inspection, Step to Next Block, editor Apply | 4 | In place (Phase 4, [phase 4 findings](phase4.md)); tutorial prompts can describe the finished interaction |
| Nested Repeat, basket capacity, readable waiting reasons | 8–10 | In place; author deliberately small loops and valid recovery paths (Phase 7) |
| Building Make, Pick Up, Forever, bridge construction | 11–15 | In place; mission gating and boundary transitions come with Phase 7 |
| Stock sensing, comparisons, If/Else, Wait Until | 16–20 | In place (Phase 2); tightly controlled trials and objective observation come with Phase 7 |
| Library assignment, shared-edit preview, per-entity settings, individual copies | 21–24 | In place (Phase 6, [phase 6 findings](phase6.md)): teams, type defaults and own programs, settings in action inputs, previews naming every robot a change starts again, own copies and back to the shared program; mission unlocks come with Phase 7 |
| Workshop entity, kit recipe, kit rendering and valid stores | 25 | In place (Phase 6): the workshop, two planks and a stone to a kit, kit stores, and placing it on a construction site |
| Variables, set/change/read, visible local values | 26–30 | Phase 8; values local to each entity, reset predictably on restart |
| Non-recursive procedures and typed inputs | 31–35 | Phase 8; mission 33 needs a destination input, mission 34 a numeric input |
| Send, matching Wait For Message, inbox display | 36–38 | Phase 8; explicit receive, next-step delivery, one entry thread, no payload/broadcast requirement for this campaign |
| Mission objectives, hints, checkpoints, replay, progressive unlocks, translated text | All | In place for missions 1–25 (Phase 7, [phase 7 findings](phase7.md)): goals on completed work with exact orders and trials, hints that answer the problem in view, mission-start checkpoints on one growing island, replays apart from it, unlocks per mission, free play and the sandbox, English and German text, and `verify:missions` |

No mission requires AND/OR, recursion, lists, return values, global variables, message payloads, broadcasts, or child-defined object types. These can become future expansion topics. Nested loops appear only in a small guided example and remain optional in later projects.

### Authoring package for each mission

When implementation reaches campaign authoring, prepare:

- Starting checkpoint/additions, enabled entities and programs, inventories, capacities, and reachable interaction points.
- Previously available blocks plus the narrow new unlock, filtered for the selected robot/building.
- A starter, three hints, accessible goal pictures, source English text, and reviewed German text.
- An observable completion rule, deliberate failure example, recovery path, and any clearly explained variant trial.
- At least one reference program per participating entity, including supplied helper programs, with a resource budget and a generous simulation-step completion bound.
- A small visible reward, next-mission transition, and isolated replay state.

Reference programs should be run using the real simulation and the mission's actual toolbox. Check the full sequence as well as isolated missions so leftover stock, shared edits, and unlocks do not break the next lesson. This document specifies the intended content; it does not supply or claim to have tested executable mission definitions.

### Relationship to the original rollout

The existing Phase 5 bridge slice remains a useful implementation milestone. In this teaching sequence, the child reaches that complete bridge after 15 shorter missions instead of six compressed ones. The original introductory concepts extend through mission 25; the original advanced concepts occupy missions 26–40.

PLAN.md has been updated to match: Phase 7 builds the mission infrastructure and chapters 1–5 with free play, Phase 8 the advanced features with chapters 6–8, and its checks, release checklist, and risks follow the 40 missions (PLAN.md §16, Campaign).

### Playtest gates

| After | What to observe | If children struggle |
| --- | --- | --- |
| Mission 5 | Can they order a delivery and identify the active instruction? | Shorten the route, reduce reading, and repeat the prediction exercise |
| Mission 10 | Can they distinguish one action from one repeated trip and explain a full basket? | Make loop boundaries clearer and replay the two-space basket example |
| Mission 15 | Can they identify which worker is waiting and who supplies it? | Show fewer programs at once, then reconnect the whole chain |
| Mission 20 | Can they predict both sides of a condition and explain when it is checked again? | Return to isolated one/two-plank trials before continuous production |
| Mission 25 | Can they assign jobs and split a three-piece recipe across deliveries? | Keep a recipe picture pinned and offer the earlier collector/courier starters |
| Mission 30 | Can they distinguish a remembered delivery count from current stock? | Put the memory display beside completed delivery pictures and step through one update |
| Mission 35 | Can they explain a routine's job and what its input changes? | Reuse one short definition and one input; delay additional routines |
| Mission 40 | Can they find a missing supply or message and make a purposeful repair? | Return to the one-kit rehearsal with one visible problem at a time |

Measure hint use, mistaken mental models, and whether children can explain a repair, alongside completion. Tune the content with both younger and older children in the target range before treating the timing or difficulty targets as established.
