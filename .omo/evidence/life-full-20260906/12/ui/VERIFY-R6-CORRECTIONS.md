# Parent correction to verify-r5

The committed product and Task52 acceptance stay intact at
`2c136343eae7e39700fe4b0752d96b6e9c89e70d`.
The independently recorded91-test pass and observed native domain results remain
historical evidence. The parent does not accept the blanket "no swallowed
unexpected timeout" claim from empty stderr and exit0 alone.

## Actual source findings

1. `verify-r5/native/native-qa-general.mjs:635` catches a rejected hand-slot
   transition and continues with a current-label read.
2. `verify-r5/native/native-qa-rug.mjs:743,748` catches rejected storage waits
   and converts them to null.
3. Every native script clears localStorage from addInitScript. In the rug
   script the window flag is document-scoped, so it cannot make that clearing
   first-document-only across a new document.
4. The rug's new-slot assertion should establish that slot2 was absent before
   the Save and retain the successful changed-storage signal, not merely
   establish that two keys exist afterward.

These are harness/acceptance defects, not a demonstrated product regression.
Do not invent an actual timeout in a trace where none occurred. Preserve the
original source and all raw verify-r5 receipts.

## Bounded correction

Only the existing `verify-live-ui` node is rerun. Its new output is `verify-r6/`.
The producer, fixtures, combined commit, CLI, and independent91-test run are
not rerun for unchanged product/test inputs.

Copy the owned native adapters to the new evidence directory, preserving
verify-r5. Make awaited action failures reject visibly. Keep legitimate
finally/disposal cleanup distinct from action-error suppression. If an action
is already at the desired state, establish that before triggering a key;
do not wait for a nonexistent transition and then catch its timeout.

Use fresh owned profiles and assert the owned initial save namespace is empty;
do not clear saved data on every document initialization. Require the new-slot2
write transition and record its before/after state. A hard-page-reload behavior
is not claimed unless actually exercised.

Rerun the three affected native groups once on the corrected adapters and frozen
commit. Keep all original semantic assertions: all six mutations, refusals and
costs, real rendered NPC overlap, actual nonblocking-rug passage, divergent live
state before Load, restored live state and newly saved slot2.

Each execution gets preserved command/source/input/output/exit evidence. Refuse
to overwrite frozen receipts; failed attempts must remain before another run.
Any cleanup error must remain visible and prevent a confirmed final verdict.
No product/test/wiki/config/Git changes, new debug API, timing-luck retry,
weakened assertions, or unrelated refactoring.

The final composite verdict must distinguish reused independent91-test/source
evidence from newly executed native results and account for every original
Task12 requirement. Task13 remains gated on parent acceptance of that verdict.
