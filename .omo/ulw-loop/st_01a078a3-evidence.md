# R3 approval retirement evidence

- Evidence key: `r3`; task: `st_01a078a3`.
- Worktree/branch: `rpg-zzu-ai-full-context-r3` / `agent/ai-full-context-r3`.
- Base: `398ef9708fbbcc50b0d237e1b1a8f99870c28ea8`.
- Authority: R3 P1 in the lead's `ultrabrain-review-1.md`.

## Fix and integration boundary

`AssistantSession` binds approval to the loop attempt's original signal, rather
than the replaceable UI signal. A lifecycle wrapper retires approval on non-final
stops, abort, failed milestone apply and thrown execution/subscriber errors.
Review admission follows the public verdict callback, owner/current-candidate
checks and the existing output-budget check. Retained review/audit evidence is
not replaced with a fabricated approval.

`retryLastTurn` resumes the existing writer/reviewer loop for pending unapproved
drafts, even when the stop was not a provider error. The draft, original request,
review evidence and existing budgets stay in their existing owners. The public
retry/getter/event APIs and `canRetryLastTurn` meaning are unchanged. No apply/base
guard, catalog, original paging, parser, wiki coordinator, or combat-proof code
was changed. The loop body is now `executeTurnLoop`; `runTurnLoop` is its owning
lifecycle wrapper. R1/R2 can retain their shared apply and candidate guards.

## Red: actual cancelled-draft apply

Before production edits:

```sh
npm test -- test/assistantReviewApprovalLifecycle.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000
```

Exit 1: **7/7 failed** (`/tmp/r3-red.log`). Four combinations (ordinary/autonomous,
fresh/unset retry signal) failed at the real proposal host:
`expected 'applied' to be 'rejected'`. The callback cancelled the first independent
review; retry revived its authority without a fresh review. The same run observed
approval during an over-budget review callback and after both review/final-message
subscribers threw (`expected true to be false`). These were behavioral assertion
failures, not import/fixture failures.

## Green and adjacent checks

```sh
npm test -- test/assistantReviewApprovalLifecycle.test.ts test/assistantIndependentReview.test.ts test/independentReview.test.ts test/aiTurnAppliedAccounting.test.ts test/aiMilestoneTurnAccounting.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000
npm run typecheck:app
git diff --check
```

- Final focused run: exit 0, **5 files / 91 tests passed**, no skipped cases
  (`/tmp/r3-final-green.log`). Lifecycle suite: 9 passing tests.
- After abort, direct apply is rejected both immediately after replacing the
  signal and while a subscribed fresh review is held. No store/undo mutation
  occurs. Releasing a fresh current approval permits one real apply; undo restores
  the prior system. The writer's original edit executes only once.
- A completed approval remains tied to its original signal if aborted after
  return. Retrying requests a new independent review.
- Existing held late approval, malformed/provider/revision failures, shared
  budgets, repair loop, strict parser, ask refusal, milestone accounting and
  ordinary/autonomous applied-baseline checks all passed.
- The new already-applied proof retry passes the real save/read verifier over
  local project/map/tileset HTTP rows. It verifies the accepted revision without
  a second writer request, review or store replacement.
- LSP diagnostics: no errors/warnings on changed source and test after fixing
  the new test's ES2023 Promise typing and required `destructive` field.
- App typecheck: exit 0 (`/tmp/r3-types-final.log`). Its first invocation hit the
  120-second command deadline with no diagnostics, during host load >120;
  the completed invocation used a 600-second bound, without code/config changes.
- `git diff --check`: exit 0.

An intermediate expanded test run passed 90/91: the new local proof fixture
initially omitted map/tileset mirror endpoints required by the real store.
The fixture now retains those rows on its local wire; no production persistence
behavior or assertion was weakened. Its subsequent 9/9 run and final 91/91 run
passed (`/tmp/r3-lifecycle-final.log`, `/tmp/r3-final-green.log`).

## Limits

All edits and fixture writes stayed in this isolated worktree/process. No external
model, external DB, authored game content, full build/gates or browser run was
used. Direct proposal-host and autonomous application were exercised through
their real session/store/undo adapters with the repo's Node fake DOM. Lead-owned
integration, whole-goal validation and another ultrabrain review are still required
before merge; this evidence is not merge approval.
