# Adversarial question dispatch follow-up

The requested secondary-path regression is reproduced and fixed. Final verification: **114/114 tests across seven files, app typecheck exit 0, complete build exit 0**. These follow-up edits are uncommitted on top of `9e01ca0525866ddfc262cfbe3e073a894c6c172b` in `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`.

## Reproduction and minimal fix

New `test/aiRequiredQuestionDispatch.test.ts` runs four real-session cases: explicit composer ask versus declared question intent, each with read-only calls alone versus attempted mutations followed by reads. The fixture uses actual plan dispatch, four rejected native map writes to reach the real stall threshold, a blocked first item, a pending sibling, a required obligation and a repairable obligation. Only LLM transports are scripted.

Mutation attempts cover `skip_work_item`, `complete_work_item`, `set_work_plan`, `repair_acceptance`, `review_acceptance` and `reset_project`. All must return the existing machine-consumed `composer-mode-ask` refusal. `get_work_plan` and a subsequent `get_project_summary` must both succeed. Final snapshots and emitted WorkPlan snapshots must retain the original scheduling state. Required obligations, Ralph/failure/repair counters and block reasons remain unchanged. Declared question cases also carry a model `resetsContext:true` claim.

Direct tool refusal was already correct. The failing path was after dispatch:

1. `noteSuccessfulTools` called scheduler advancement, which reactivated blocked work after a read.
2. A refused native reset was counted as a new execution failure, replacing the blocked item's existing failure counter.
3. The old failure threshold stopped read-only questions before their next inspection call.

Three existing session guards now exclude ask mode: `noteSuccessfulTools`, `noteRepeatedToolFailure`, and `hasRepeatedToolFailureStall`. No dispatcher, event-cloning, acceptance-denominator, UI, persistence, logging or proof-projection redesign was needed. `emitWorkPlan` is unchanged.

## Evidence chronology

- `requirements-question-dispatch-red.log`: exit 1, four fixture-precondition failures. The first fixture used three rejected writes, while the real threshold is four. This log is retained but **not** credited as product RED.
- `requirements-question-dispatch-contract-red.log`: exit 1 after correcting the fixture; both attempted-mutation cases changed blocked scheduling to `in_progress` despite all direct mutation calls being refused.
- `requirements-question-dispatch-read-red.log`: exit 1, four faithful failures after requiring a second read. Both mutation cases changed scheduling; both read-only cases stopped before `get_project_summary`. All occurred before the three source guards were changed.
- `requirements-question-dispatch-green.log`: exit 0, **114 tests passed / seven files / 60.46s**.
- `requirements-question-dispatch-typecheck.log`: exit 0.
- `requirements-question-dispatch-build.log`: exit 0; editor, player/SDK and standalone builds. Existing circular-chunk, mixed-import, optional-provider-key, unresolved runtime PNG and chunk-size warnings remain unsuppressed.

Commands ran directly in the assigned worktree; stdout/stderr were redirected and npm's exit was captured immediately, without a pipeline:

```sh
npm test -- test/aiRequiredQuestionDispatch.test.ts --maxWorkers 2 --minWorkers 1
npm test -- test/aiRequiredQuestionDispatch.test.ts test/aiRequiredOutcomes.test.ts test/assistantVerificationEvidence.test.ts test/workItemOutcome.test.ts test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts test/assistantAcceptanceRequestBaseline.test.ts --maxWorkers 2 --minWorkers 1
npm run typecheck:app
npm run build
```

## Fixture and review notes

The preceding `to -> targets` reachability fixture correction remains in the working diff. Fresh diagnostics also found three invalid `Project.name` fixture assignments introduced by this producer earlier; these now modify the real `Project.meta.title` field. Earlier stale-evidence tests therefore use valid project content, not an extra unknown property. No product change was made to accommodate invalid fixture data.

Diagnostics on all three changed/new source/test files now report no errors; `git diff --check` exited 0. The new suite is 59 nonblank/noncomment LOC and owns only question-dispatch invariants. Existing files remain 203 LOC for requirement tests and 3838 for the session; the session change replaces three guard lines without adding structural scope. The prior test-file warning band and explicit restriction against unrelated session refactoring still apply.

Review: no second authority, new abstractions, parameter expansion, type escape hatches, logging changes, prose assertions, sleeps or polling. Existing transport fixture and exact event capture are reused; the intent cache is cleared before/after each case. Each changed guard has a regression that would fail without it: blocked reactivation, failure-counter mutation, or premature read termination.

No commit, push, merge, browser/server resource, remote fixture or full gate was created by this follow-up. Raw logs and this report are in the ignored evidence directory until the owning delivery node stages them. Browser/UI integration and lead approval remain outside this follow-up's scope.
