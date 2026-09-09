# New-map acceptance contract fix

Base: `ec4d9d2b8d93a6b49bfa77251bfdace9ab0c8974`.
Worktree: `/home/main/z-project/rpg-zzu-ai-new-map-acceptance-0907`.
Authorization: parent-relayed finalized `creation-acceptance-review.md`, after the
bounded offline diagnosis. No game/archived ledger migration is included.

## Diagnosis and captured evidence

Round5 evidence is read-only under the sibling adversarial worktree's
`output/evidence/ai-playable-final/round5/`.

- `first-harness.json` audit[16] first repaired a missing acceptance item with six
  syntactically valid criteria. Criterion[5] was
  `{"kind":"targetChange","target":{"newMapName":"지하실"}}`.
- audit[27] repeated those criteria in a plan. Duplicate IDs did not replace the
  original ledger item. audit[334] attempted replacement with literal map IDs and
  image criteria and was correctly refused as `immutable-valid`.
- Parsed messages[134] and [155] show the first five criteria passing; only the
  new-map change fails with `No original target baseline`. The cellar dimension
  passing proves that name binding was resolved, not missing.
- `final-ui.txt:252` retains that baseline failure. The final project has village
  20x15/five events and cellar 12x10/two events; no gameplay approval follows from
  those counts. `INITIAL.md` attributes the live turn's terminal error to quota429.
- The extracted fixture is equal to those three audit payloads, checked before
  handoff. Archived final-project SHA256 remains
  `df9648148a4d78ec829563987bb8059b8590abad3337a98606374ebe4ef606c5`.

The contradiction was parser/repair admission -> immutable request-baseline ledger
-> evaluator requiring before-content for a map binding that deliberately selected
an ID absent from that same baseline. Another map edit or later plan cannot repair
that contradiction. A literal mapId absent from the baseline has the same problem
for targetChange/preserve; first-use newMapName preservation is also unsupported.
A previously bound name *can* refer to original content in a later request baseline,
so a blanket syntactic ban on preserve/newMapName would break supported behavior.

## Minimal implementation

- `src/ai/assistantAcceptanceEvaluation.ts:63-71`: explicit newMapName change can
  measure original absence -> current bound-map presence. Existing missing-map and
  region validation run first; existing-map comparisons are unchanged. No baseline
  is synthesized, rebased, or mutated. A missing literal mapId never gets this pass.
- `src/ai/assistantAcceptanceLedger.ts:38-77`: adoption and repair use one contextual
  original-target check. Unsupported baseline-dependent targets become an atomic
  missing-criteria item with `unsupported-original-target`, criterionIndex and
  `criteria[i].target`, retaining repairability and actionable existing-ID/creation
  guidance. Invalid repairs return `malformed-criteria` without any ledger change.
  Existing valid items, their baselines and bindings remain immutable.
- Provider/planner guidance and `openwiki/editor-ai-panel.md` explain creation and
  unsupported preservation. The parser remains responsible for syntax, while the
  ledger owns validation that needs the original baseline and existing bindings.
- No changes to session/runner/transfer/provider/deadline/persistence code. The
  conservativeReachability source suffix was compared byte-for-byte with base.

## Regression seams

`test/assistantAcceptanceNewMapCharacterization.test.ts` contains 14 tests:

- Captured criterion array through both plan parsers and initial repair; all six
  applied facts now verify without rewriting the captured criteria.
- Three unsupported original-target combinations rejected atomically at adoption
  and repair, including region repairs, duplicate IDs, retained valid siblings,
  immutable original baselines and successful deliberate creation repair.
- Missing target, whole-map and valid-region applied creation, invalid region,
  draft-only state and applied undo.
- Existing same-name exclusion, ambiguity, unique binding, rename, deletion and
  replacement-ID no-rebinding, exercised specifically with targetChange.
- Existing-map modification/preservation and later-request previously bound names.
- Real session set_work_plan and repair_acceptance admission, actual create_map
  application, final acceptance, immutable repair rejection and clear/refresh.
- Real session early unsupported-target diagnostics and successful repair.

Provider/intent and external persistence are controlled in session tests; actual
session/tools/adoption/evaluation remain real. The creation sessions assert zero
fetch calls. Ledger-only tests use small synthetic maps; no archived game is run or
edited. No fixed sleeps, polling, prose assertions, skipped tests or timeout changes.

## Verification receipts and limitations

Raw final build/protected/typecheck receipts are in this worktree under
`evidence/ai-new-map-acceptance-0907/` (gitignored; retained for the parent):

| Validation | Result | Receipt |
|---|---|---|
| Red-first new contract, before production edits | 10 assertion failures, 4 passes; no timeouts | Session transcript; details below |
| Final behavioral acceptance run, seven files, maxWorkers=1 | 90 pass, 1 existing-test timeout; all 14 new tests pass | Session transcript; details below |
| Protected Vitest, 24 files, maxWorkers=1 | 368 pass, 0 fail, one run | `protected-vitest.txt` |
| Protected Bun wire/image/enum, four files | 59 pass, 0 fail, one run | `protected-bun.txt` |
| App typecheck + editor/player/standalone production build | exit 0 | `build.txt` |
| New test plus all transitive imports, TypeScript API without filtering | 0 diagnostics, exit 0 | `focused-typecheck.txt` |
| LSP on all three changed TypeScript production files and new test | No diagnostics | Session transcript |
| Extracted fixture JSON and source-payload equality | pass | Checked before handoff |
| git diff --check | pass | Checked before commit |

The red-first assertion failures were the captured six-criterion pass vector,
three unsupported-target admission cases, two valid creation scopes, unique applied
creation, both real-session creation admissions, and real-session early diagnostics.
The unchanged countercases (invalid region, missing selector syntax, existing-map
baselines and later-request bound names) passed before the fix.

Final acceptance command:

```
npm test -- test/assistantAcceptanceNewMapCharacterization.test.ts test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts test/assistantAcceptancePromiseBaseline.test.ts test/assistantAcceptanceRequestBaseline.test.ts test/assistantAcceptanceDiagnostics.test.ts test/assistantAcceptanceProvider.test.ts --maxWorkers=1
```

Its remaining failure (not removed, skipped, retried or assigned a new timeout):

```
FAIL test/assistantAcceptanceRequestBaseline.test.ts:67
per-request acceptance baselines > preserves a map created in A while B changes another map
Error: Test timed out in 15000ms.
Test Files 1 failed | 6 passed (7)
Tests 1 failed | 90 passed (91)
```

This is an unchanged test, not an assertion mismatch. It passed in the original
pre-edit characterization run; other unchanged tests in the same file timed out in
a later pre-edit run. The precise cause of this final timeout is not established.
Do not describe R3 or the complete acceptance command as green.

Earlier diagnosis-only probe history is retained, not counted as green validation:
five probe assertions initially failed because the helper discarded runTool's
replacement context.project; the probe was corrected. All nine then-current
characterizations passed alone. A subsequent combined run hit four 15s test
limits (two probe matrix tests, two unchanged request-baseline tests) and a Vitest
`Timeout calling "onTaskUpdate"`. The new matrix was split into bounded cases and
ledger fixtures no longer invoke the whole write pipeline; real-session coverage
still does. No assertion was weakened to hide a failure.

The first standalone app-typecheck command exceeded its 180s *command* limit without
compiler output. The later full build ran the same app typecheck and completed
successfully. Observed host load was 211.68 on 32 cores with 38.8GB swap used;
this is context, not a proven cause. Build warnings about chunk sizes/circular
exports/dynamic imports and an unresolved generated image are retained in build.txt.

The protected commands cover R1/R2/R4/R5/R7-R15 plus the latest numeric-enum
transport protection and accepted-revision persistence. R3's limitation is above.
R6/R16 require the parent's real new-project UI, gameplay, visual and save/reload
review; they are not closed by these offline tests. No full gates/all-green claim.
No DB/browser/model calls, archived game/ledger edits, env/9841 changes, push, PR or
merge. The requested commit contains only this bounded fix, tests/fixture and docs.
