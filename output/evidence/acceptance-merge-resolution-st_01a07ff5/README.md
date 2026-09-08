# Local main-into-feature merge resolution

Branch: `fix/acceptance-gate-regressions`. Task: `st_01a07ff5`.

Parents (in order):
1. `e01811cfb6e3ca72f933b4a729b5894345b4bd41` (ours)
2. `8ab349dfc21cb0c0c22a554f74a25bdeb05ab741` (existing MERGE_HEAD)

Only conflict: `test/aiChatObservability.test.ts`. Both parent files/diff and
current AssistantSession, independentReview, and panel apply gate were inspected.
No merge restart, production edits, shared-main changes, push, or PR operation.
All initially staged automatic merge results are retained unchanged.

## Resolution

- Preserve independent request coverage with the original 6x5 named-map criterion.
- Classify coverage/review before generic JSON intent requests. Account separately
  for intent, coverage, review, streamed chat, and non-streaming author execution.
- Route each author stage by actual tool-result count; convert upstream SSE scripts
  to JSON for non-streaming create execution. Repeated final continuations alone
  may reuse the final reply, bounded by the existing MAX_RALPH_ATTEMPTS_PER_ITEM.
- Preserve real method-forwarding send/refresh spies, subscriptions before Send,
  exact 6x5 ghost bounds, one applied call, verified acceptance, satisfied/applied
  outcome, terminal result, ghost cleanup, and the unchanged 10,000ms deadline.
- Preserve the narrow toolImageRenderer double, real full new-map show_map_region,
  and production independent-review audit approval. Additionally assert the review
  request contains an actual image part and no required problems, and that the
  approved review event occurs while the new map is still absent from the store.
- Composed create sequence: intent=1, coverage=1, review=1, chat=0, execute=3.
  Upstream now evaluates draft acceptance during review, so this successful draft
  does not require the former acceptance-repair rounds. Question path stays SSE.

## Verification (direct process exits; one worker; no live provider/DB calls)

Working directory: `/home/main/z-project/rpg-zzu-ai-acceptance-live-qa`.

1. `npm test -- test/aiChatObservability.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism`
   - Marker-only composition first: exit 1, 8 passed / 1 failed. First create
     request has zero tool results; the old execute fixture requires one and the
     terminal subscription expires at its original deadline. Raw output and exact
     composed fixture: `composed-red.log`, `.exit`, and `composed-red.ts.txt`.
2. `npm test -- test/aiChatObservability.test.ts test/requestCoverage.test.ts test/fakeDomSelectContracts.test.ts test/eventEditorStagedState.test.ts test/independentReview.test.ts test/assistantIndependentReview.test.ts test/assistantReviewApprovalLifecycle.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism`
   - Exit 1: 108 passed / 1 failed across 7 files, retained in `focused.log`/`.exit`.
   - Observability 9/9; request coverage 14/14; staged state 14/14;
     independent review 23/23; session review 29/29; approval lifecycle 9/9.
   - Fake-DOM contracts 10/11: unchanged line 248 expects `[second, first]` after
     reversing input. Incoming aiStickyChecklist now prioritizes working before
     pending, yielding `[first, second]`. This is outside the conflict resolution;
     neither the test nor production/helper code was changed. No retry or skip.
3. `npm run typecheck:app`: exit 0 (`typecheck-app.log`/`.exit`).
4. LSP diagnostics on the changed test: no diagnostics. Unstaged `git diff --check`
   before staging: exit 0; staged check scoped to the resolved test and README: exit 0.
   Whole staged `git diff --cached --check`: exit 2, reporting incoming whitespace
   and verbatim raw-log/diff whitespace (`staged-whitespace.log`/`.exit`). Those
   incoming files and raw evidence were deliberately not reformatted.

The real panel Send surface was exercised through the existing fake DOM test;
this is not browser/pixel or saved-project QA. Full suite/build were not rerun:
the lead owns final build/review and gate-delta triage. Earlier gate/build and
live/player evidence remain version-bound, not evidence for this merged tree.
No existing evidence was overwritten; `previous-evidence.sha256.json` records
114 existing candidate/raw recovery files as observed after focused verification.
Incoming automatic deletions of old `output/evidence/acceptance-live` tracked
artifacts were already in the merge index on entry and were not altered here;
the original bytes remain available from the first parent.

Edits used an `apply_patch` shell function backed by `git apply --whitespace=error-all`
because no apply_patch executable is installed on this workstation. No repository
helper was added. The raw red and focused failure evidence are retained, not greenwashed.
