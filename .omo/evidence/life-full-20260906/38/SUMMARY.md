# Task 38 evidence summary

## Scope and policy
Test-only alignment with the approved lossless policy. The old assertion expected invalid animal progress/counts to normalize to zero and authored animals to be seeded. The approved boundary instead rejects non-JSON Infinity/NaN originals with LifeReconciliationError and quarantines JSON-safe invalid originals as one unresolved, unpayable claim without resurrection or guessed payout.

## Before
Command: npm test -- test/p1FoundationSchema.test.ts -t "sanitizes hostile P1 state"
Exit: 1 (captured in RED.txt). Failure: LifeReconciliationError farmAnimals/farm_animal_1: invalid-state.

## After
Command: npm test -- test/p1FoundationSchema.test.ts test/p1SessionPersistence.test.ts test/lifeRecoveryPersistence.test.ts test/lifeRecoveryRecordKeys.test.ts
Exit: 0; 4 files, 89 tests passed.
Diagnostics: language-service diagnostics for test/p1FoundationSchema.test.ts: no diagnostics found.
git diff --check: exit 0.

## Coverage added
- Exact typed LifeReconciliationError fields are asserted for unrepresentable farm-animal source, captured from the actual thrown value.
- The complete live session, including NaN/Infinity, is compared unchanged after the failed writer; a confirmed non-null prior slot byte string from saveSlotKey(2) remains unchanged after the combined failed save action.
- A separate valid-animal writer control preserves the NaN-weather assertion; JSON-safe hostile direct input retains exactly one empty-items unresolved original, no authored-animal resurrection, no payout, unchanged input/inventory/gold, and the direct meteor-weather rejection.
- Two subsequent snapshots are created from restored states and saved/read/applied, proving stable claim sequence and no active animal.
- Initial review gaps disclosed: the first commit used an incorrect hardcoded slot key, did not assert non-null prior bytes or the combined failed-save action, used an asymmetric matcher cast, did not preserve direct-input/inventory/gold explicitly, replayed the original snapshot instead of creating round-trip snapshots, and omitted the separate valid-animal NaN-weather writer control.
- Existing valid-animal and legacy-omission controls remain untouched.

## Repository/resource cleanup
Initial HEAD: 66f2cdb756a5a95eda07cae6103b82dfe7298b8a
Initial code tree: 944315667d23fd9d65de95d33a35215e7f925e68
Initial test tree: recorded by git diff before edit; no unrelated paths changed.
QA lock: /tmp/rpg-zzu-life-full-qa-01a0727b.lock; flock bounded timeout 900 used for both runs; no background processes or temporary runtime resources created.
Only test/p1FoundationSchema.test.ts and this task evidence are staged; no product, wiki, baseline, dependency, WISH, or root-state changes.
