# Reviewloop component evidence

## Delivered

- Base: `9e148d8efc816c976531ac705604814bc6a1b231`, branch `agent/ai-full-context`.
- Replaced same-conversation, >8-write self-review with an isolated read-only
  supervisor invocation for completed write batches. Fresh system/user context,
  no writer conversation/success prose, no executable tools or tool dispatch.
- Review inputs retain original request, complete relevant before/after original
  projections, actual changed values, tool results, draft acceptance, available
  current images and executable evidence. Original read-credit bookkeeping is not
  duplicated. Oversized complete inputs fail explicitly, never silently truncate.
- Structured findings feed actual repairs into the same draft and a new revision
  receives a new review. Existing read gates, detached drafts, output/round caps,
  three-attempt repair bound, unchanged-failure stop and cancellation remain.
- Required current map images and failed/stale explicit scene/walkthrough checks
  cannot be approved. Nonvisual record/dialogue work has no invented placement-image
  prerequisite. Advisory evidence remains visible without becoming an unconditional
  pre-existing lint blocker. Acceptance and persistence proof stay separate.
- Unapproved/error/budget/cancelled writes cannot apply via normal runner, direct
  proposal host, cluster, region or autonomous milestone paths. Completed work-item
  milestones are batched until the current draft passes review. Approval is invalid
  after a revision change or cancellation and cannot be revived by undo.
- Region clipping/seam preparation runs before review on the same draft. Later
  partial/schedule/room edits cannot borrow the old approval. Existing house,
  commit, undo and persistence boundaries remain. Evaluation retains measured draft
  results and review evidence but never reports an unapproved solver as passed.
- `TurnResult.review`, `result_review` events, harness snapshot and the existing
  injected ChatFn provide deterministic real-surface-friendly observability.

## Exact regression command (initial component)

```sh
npm test -- test/assistantIndependentReview.test.ts
```

Exit 1, 1 failed: expected two independent review invocations, received zero.
`/tmp/reviewloop-red.log`. The preceding malformed patch/no-test-file invocation
was tooling failure, not regression evidence. No apply_patch executable exists;
patches used shell `apply_patch() { git apply --whitespace=nowarn -; }` with unified
patches (manual new-file patches used --recount).

## Authentic provider defect and fix

The lead's real authenticated Gemini response returned HTTP 200 / stop with one
complete `json` code fence. Direct JSON.parse incorrectly rejected it. This defect
was missed by the original unfenced test responses and is explicitly acknowledged.
Source evidence: `.omo/ulw-loop/live-review-provider.md`.

The parser now normalizes only one whole-response fence (optional json label), then
applies the unchanged JSON/revision/verdict/findings/finish-reason/tool-call checks.
Prose, partial JSON/fences, multiple fences and other language labels remain errors.
The public session repair-to-approval test now uses fenced responses on both reviews.

Red:

```sh
npm test -- test/independentReview.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000
```

Exit 1, 3 failed / 19 passed: valid json/bare fences were rejected as malformed JSON;
the fenced stale revision never reached revision validation. `/tmp/reviewloop-fence-red.log`.

Final green after provider fix:

```sh
npm test -- test/independentReview.test.ts test/assistantIndependentReview.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000
npm run typecheck:app
```

- Exit 0, 2 files / 48 tests passed in one complete run. `/tmp/reviewloop-fence-green.log`.
- App typecheck exit 0. `/tmp/reviewloop-fence-types.log`.
- LSP diagnostics requested on all changed TS source/test files before typecheck;
  no diagnostics. Last fence source/two tests checked again before final typecheck.

## Focused adjacent verification

Immediately before the parser-only provider fix:

```sh
npm test -- test/independentReview.test.ts test/assistantIndependentReview.test.ts test/assistantAcceptanceSession.test.ts test/assistantVisualEvidenceSession.test.ts test/aiTurnAppliedAccounting.test.ts test/regionTaskRun.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000
npm run typecheck:app
npx vite build --configLoader runner
```

- Exit 0, 6 files / 113 tests passed, no unhandled errors. `/tmp/reviewloop-final-green.log`.
- App typecheck exit 0. `/tmp/reviewloop-final-types.log`.
- Editor production build exit 0, built in 1m 6s. Existing large-chunk warnings
  remained. `/tmp/reviewloop-editor-build.log`. This build preceded the fence fix;
  no post-fix build was run, per lead instruction. Player/standalone/full gates
  are lead-owned.
- `git diff --check`: exit 0 before commit.
- Public `AssistantSession.sendUserMessage`, actual tool execution, region runner,
  direct proposal host and actual local autonomous apply/undo boundaries are exercised.
  Test transports are deterministic; all external fetches in apply fixtures are stubbed.

## Intermediate failures (resolved, not suppressed)

- Initial typecheck found unused ADVENTURE_AUTHORING_GUIDE/adventureRepairAttempts;
  obsolete self-review remnants were removed. Final app types are clean.
- Initial repair fixture incorrectly asserted escaped JSON and omitted the required
  fresh DB read. It now parses the finding and performs an actual read before repair.
- Scene test fixture initially conflated transport ok with data.ok. It now proves
  transport success plus actual failed scene verdict cannot earn approval.
- Adjacent acceptance and region fixtures were migrated to structured review results;
  clipping/seam work was moved before review rather than weakening the stale gate.
- Evaluation fixture initially consumed its write as the default autonomy planner
  response. Its explicit direct-mode config now exercises the intended solver path.
- Overloaded-machine fork runs hit 15s test deadlines and Vitest onTaskUpdate RPC
  timeout, including one run with 40 passing assertions but exit 1. Logs:
  `/tmp/reviewloop-adjacent.log`, `/tmp/reviewloop-adjacent-fixed2.log`.
  No failure was hidden: final runs use a single thread worker and bounded 60s
  computational test deadlines, no sleeps/polling or timing-based success.

## Real editor evidence owned by lead

Read `.omo/ulw-loop/lead-review-ui-probe.md`: real Firefox composer + intercepted
model HTTP proved 321 -> structured repair -> 654 -> independent revision-2 approval,
real store apply and undo back to 50; repeated rejection of draft999 and cancellation
with late approval of draft777 both left store50 unchanged, with zero page errors.
This is lead-observed in-progress-tree evidence, not my claim of final-tree/live-model QA.
The lead owns repeating both wrong/correct live provider probes after the fence fix.

## Residual integration concerns / exact legacy candidates

No currently failing case remains in the executed focused suite; no app type error
remains. No repository-wide sweep was run, per lead scope. These read-but-unrun old
scripted cases still assume the removed self-review/immediate milestone behavior:

- `test/aiMilestoneTurnAccounting.test.ts`:
  - `한 항목이 실행 한도로 나뉘어도 앞선 성공과 미적용 제안을 이어서 완료한다`
    uses a one-round cap and assumes writes apply before independent review.
  - `마일스톤 쓰기는 자동 계속(%s) 후에도 정산에 남는다` (false/true) calls removed
    private buildReviewPrompt and asserts old self-review prose/milestone sequencing.
- `test/evals.test.ts`: `모킹 LLM 툴콜 루프가 골든 태스크를 완성한다` returns only writer
  prose and lacks independent structured review/current image evidence.

These are precise migration candidates, NOT observed failures on the final tree.
The lead may delegate them in isolated integration trees; this component did not
silently bypass review to keep old mocks green.

Explicit implementation limits: whole evidence must fit the supervisor window;
asset-transport changes without a reviewable projection fail closed; authored starting
state is reviewable (corrected in the follow-up below);
manual partial/schedule/reroll changes to an approved region require another reviewed
request instead of reusing approval. Final INDEX regeneration, full repository gates,
external ultrabrain/deep repairs, final UI/provider QA and merge remain lead-owned.
No authored games, live DB writes, privileged remote verification, push, PR or merge
were performed by this component.


## Lead follow-up: no-write closure, applied baseline and authored start state

Follow-up base: `5cab5e2c1ea16bf32af376e1c3591d949c4a1daf`. Overall regression
reference remains original `b9dec50fb6159e8be220b42eb59e526808b92b97`, not merely
the immediately preceding component commit. No merge or broad legacy sweep.

- Reproduced two no-write authoring defects: unmet acceptance returned `final`,
  and completion-only requirements could publish writer success before recap
  correction. The no-tool boundary now checks both existing requirement sources,
  uses the existing bounded repair allowance, then returns error without publishing
  the unsupported success text. Questions still do not invoke independent review.
- Baseline concern was checked through real production paths and already passed:
  ordinary proposal-host application and autonomous milestone application refresh
  baselineProject via rebaseProject. After approved/applied turn A, rejected turn B,
  failed clean-sync while B remains pending, and unrelated approved/applied turn C,
  A's title remains intact in the store, baseline and draft. No redundant production
  baseline change was made. Tests also assert clean-sync after A succeeds.
- Corrected the blanket /session rejection. ProjectSession/ProjectStartState is
  explicitly the editor-authored new-game seed (project/types/project.ts); the real
  runtime PlaySession is separate (project/session.ts). Review changes now include
  the exact authored /session before/after values. Actual set_session_start and
  upsert_test_preset tools pass review for party/inventory/gold/preset changes.
  A separate startSession test mutates live runtime gold and proves review inputs
  still contain only the authored starting gold. Asset transport omission remains
  explicit and fail-closed. Earlier runtime-session-limit wording in this historical
  evidence is superseded by this correction.

Red command:

```sh
npm test -- test/assistantIndependentReview.test.ts test/aiTurnAppliedAccounting.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000 -t 'no-write authoring|authored start-state|applied baseline across'
```

Exit 1, 3 failed / 2 passed (48 unrelated tests excluded by the command filter).
Both no-write cases returned final instead of error; authored session was permanently
changes_requested. Both real apply/baseline cases passed before production edits.
Log: `/tmp/reviewloop-followup-red.log`.

Final unfiltered focused green:

```sh
npm test -- test/independentReview.test.ts test/assistantIndependentReview.test.ts test/assistantAcceptanceSession.test.ts test/assistantVisualEvidenceSession.test.ts test/aiTurnAppliedAccounting.test.ts test/regionTaskRun.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000
npm run typecheck:app
git diff --check
```

- Exit 0, 6 files / 129 tests passed in one complete run, no skipped tests or
  unhandled errors. `/tmp/reviewloop-followup-green.log`.
- App typecheck exit 0. `/tmp/reviewloop-followup-types.log`.
- LSP diagnostics on all five changed TS files before typecheck: none.
- No currently failing focused case or production type error remains. Build and
  live/final-tree QA remain lead-owned, as requested; no additional build wave.
- No live DB write: real local apply paths ran with remote persistence disabled and
  external fetch stubbed. No authored game content, push, PR, merge or unrelated edits.
