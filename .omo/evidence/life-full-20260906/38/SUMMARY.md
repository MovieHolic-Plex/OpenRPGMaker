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
- Exact typed LifeReconciliationError fields are asserted for unrepresentable farm-animal source.
- The complete live session, including NaN/Infinity, is compared unchanged after the failed writer; an existing valid slot byte string is also unchanged.
- JSON-safe hostile direct input produces exactly one empty-items unresolved original, no authored-animal resurrection, no payout, invalid weather remains separately rejected, and repeated save/read/apply is stable.
- Existing valid-animal and legacy-omission controls remain untouched.

## Repository/resource cleanup
Initial HEAD: 66f2cdb756a5a95eda07cae6103b82dfe7298b8a
Initial code tree: 944315667d23fd9d65de95d33a35215e7f925e68
Initial test tree: recorded by git diff before edit; no unrelated paths changed.
QA lock: /tmp/rpg-zzu-life-full-qa-01a0727b.lock; flock bounded timeout 900 used for both runs; no background processes or temporary runtime resources created.
Only test/p1FoundationSchema.test.ts and this task evidence are staged; no product, wiki, baseline, dependency, WISH, or root-state changes.
