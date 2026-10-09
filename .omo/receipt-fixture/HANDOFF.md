# C003 accepted-receipt fixture correction

Task: `st_01a07cb5`. Test-only correction on
`agent/ai-full-context-functional-integration`, starting clean at
`52894a442bf177df09606617da07255e54919c9c`.
Sole write worktree: `/home/main/z-project/rpg-zzu-ai-full-context-functional-integration`.

## Delivered contract

- `test/aiAssistantSession.test.ts`: retain exactly one verification call and
  assert its complete options `{ signal: undefined, validate }`, using the actual
  captured callback, not `objectContaining` or an arbitrary-function matcher.
  Invoke it on a cloned current project and assert success (`undefined`).
  Explicitly assert receipt reference identity at both verification and run-end
  proof. Preserve one flush, no reload, succeeded/verified proof, saved-audit
  count, planner count, driver continuation, and no-stall assertions unchanged.
- `test/functionalPersistenceProof.test.ts`: strengthen the existing broken
  purchase case, reusing its real `functionalFixture`, Session, acceptance
  evaluation, store save/read, and in-memory transport. Spies call through.
  After an earlier verified acceptance, save a project with gold=1. Assert the
  evaluator receives a distinct canonical project with gold=1, exact verification
  options, the same receipt, no reload, and failed/unverified proof. Exercise the
  actual callback against both the original valid fixture (accepted) and that
  canonical project (nonempty failure). Assert the entire underlying proof equals
  `{ kind: "failed", receipt, message: problem }`, tying rejection to the callback
  without pinning diagnostic prose. Preserve the no-saved-audit assertion.
- No implementation, test helper, timeout, sleep, polling, or test-selection source
  changes. No existing assertion removed or weakened.

The canonical validation is intentionally retained. Source trace:
`maybeRunEndProof` -> `proveAppliedRevision` ->
`store.verifyPersistedRevision` -> identity-matched canonical read ->
`acceptance.functionalProblems` -> real functional scene evaluation.
The title-only fixture has no functional purchase obligation, so its callback
success is paired with the existing purchase fixture's meaningful rejection.

## Executed evidence

All commands below ran from the owned worktree with one Vitest worker and the
repository's original test deadlines. Logs are retained locally under `.omo/`
but are not added to the test-only commit.

1. RED, before edits, exit 1 (15.30s):
   `npm test -- test/aiAssistantSession.test.ts -t 'completed remote plan verifies its accepted receipt without reloading' --maxWorkers=1 --minWorkers=1`
   Log: `.omo/receipt-fixture-red.log`.
   One failed assertion at line 1056, one actual call; the argument diff was
   exactly `+ "validate": [Function validate]` versus `{ signal: undefined }`.
2. Exact GREEN, exit 0 (26.66s): same command as RED.
   **1 passed, 53 deselected by the requested name filter**.
   Log/exit: `.omo/receipt-fixture-exact-green.{log,exit}`.
3. Functional GREEN, exit 0 (33.60s):
   `npm test -- test/functionalPersistenceProof.test.ts --maxWorkers=1 --minWorkers=1`
   **4 passed**, including real canonical rejection and stale-read rejection.
   Log/exit: `.omo/receipt-fixture-functional-green.{log,exit}`.
4. Related GREEN, exit 0 (133.41s):
   `npm test -- test/aiRunEndProof.test.ts --maxWorkers=1 --minWorkers=1`
   **30 passed**, including cancellation, overlapping proof ownership, retry,
   current receipt identity, commit correlation, and normal applied proposals.
   Log/exit: `.omo/receipt-fixture-related-green.{log,exit}`.
5. Both changed files: LSP diagnostics returned **no diagnostics**. TypeScript
   **5.9.3**, using repository `tsconfig.json`, returned **0 changed-file/config
   diagnostics, exit 0**. The compiler API created the configured program and
   requested `getSyntacticDiagnostics(source)` and
   `getSemanticDiagnostics(source)` for only the two changed test files, plus
   config/options diagnostics. This is not a claim that whole-repository test
   types pass. Log/exit: `.omo/receipt-fixture-types.{log,exit}`.
6. `git diff --check`: exit 0. `git diff --exit-code 9c5cf9b25 --
   src/ai/assistantSession.ts src/ai/assistantAcceptanceLedger.ts
   src/ai/functionalAcceptanceEvaluation.ts src/project/store.ts
   test/fixtures/functionalAcceptance.ts`: exit 0, confirming the supplied
   relevant source/helper equality to final9c5c.

An earlier combined GREEN invocation was interrupted by the tool's 180-second
shell deadline after reporting all 30 related tests and the exact receipt test
passed, before the functional suite reported. It is **not** counted as a passing
command. Its log is `.omo/receipt-fixture-green.log`. The completed per-file
commands above replace that incomplete command-level evidence; no test timeout
was changed and no failed assertion was retried to hide a failure.

## Scope and limits

Only the two existing tests and this handoff belong in the commit. `apply_patch`
is not installed on this workstation; patches were applied with a shell
`apply_patch() { git apply --recount -; }` wrapper. No other worktree was edited.
No build/full gate, UI/image/browser/provider/live DB work, push, PR, or merge.
Store-count/surface baseline attribution and final successor approval remain
parent-owned and are not settled by this fixture correction.
