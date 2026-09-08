# P3 ownership and stale-base evidence

## Status and source

The independent-review corrections are integrated at
`34d5b672ad30c2dec5a3d58fa761f83781a6ee35`. The
[repair integration report](repairs/integration/report.md) records 53 files / 883
passing focused tests, 12 passing Node checks, app typecheck/build and all eight
native scenarios at direct exit 0. This is scoped integration evidence, not
independent re-verification or P3 approval. Item5 was reopened after R1; the old
acceptance marker is revoked. Gate13, paired full-gate comparison and delivery
remain lead/verifier-owned. The overall goal is active.

| Repaired identity | Value |
| --- | --- |
| Integrated source commit | `34d5b672ad30c2dec5a3d58fa761f83781a6ee35` |
| HEAD/index tree before this docs change | `3dd432a2ae3e5397d5bf89f88f53417820aae3a4` |
| Product `src` tree | `b714cecaa714176397425f06f2a08b3cec1b8d6e` |
| Shipped `test` tree | `8dc21d3201fe4dd56dc5122358164a7517404927` |
| QA tree | `43620cb7d020d2e4fd77038af71ffe1f972992c9` |

[Final source](repairs/integration/raw/final-source.json) binds committed bytes;
[predecessor audit](repairs/integration/raw/predecessors.json) binds both fix reports
and original RED/GREEN packets at their retained worktree paths. The
[original independent report](../../../../../rpg-zzu-ai-harness-p3-verify-20260907/output/evidence/ai-harness/p3/independent/report.md)
remains **needs-fix for `450a1bbfb5013ff62759ebfc1b2e6e413082d860`**, not confirmed
or overwritten. Its R1 probe passed two controls and failed already-applied A
accounting. Its isolated human race exited 1 after 15 positive checks; the 24 stale
checks never ran. Neither finding establishes lost live A content, B corruption,
duplicate replay or an observed stale overwrite in that failed native attempt.

### Integrated corrections and recorded validation

- **Actual-before-subscriber accounting:** the shared adapter passes its existing
  owner-bound `onApplied` callback into both store replacement paths. It runs after
  the live mutation/counters, before activity/store observers can retire A and start
  B. A's same prepared cancellation result contains the real title in `appliedCalls`,
  no remaining proposed copy, and delivery `applied`; B independently finishes with
  no application/proposal and delivery `no-change`. No proof, replay or second ledger
  is created. If the accounting outcome observer throws, `finally` still completes
  activity/store/autosave notification and preserves the original error.
- **Bounded human-race ownership:** all transport waiters/retries share the finite
  human edit/save/read owner. Failure/cancellation/cleanup rejects the hold. Observers
  subscribe before Send and start only this race's unchanged completion timers just
  before successful release. Human evaluation and cleanup have explicit rejecting
  bounds. Action/completion 60,000 ms, mutation/render 10,000 ms, REST 30,000 ms and
  navigation 120,000 ms stay unchanged; no product request deadline is widened.
- [Human packet](repairs/integration/native-human-edit-race/actions.json), **39 checks**:
  hold 50, tile 7 at 53, width 336 at 58, exact `item_potion` price 137 at 64,
  independent saved readback 74, owner completion while held 75, release 76, final
  HTTP 77. At 75, result/activity are null, receipts empty and rejection count zero.
  After rejection all three values remain local/remote, successful receipts stay
  empty, two rejection notifications appear and outcome is `failed/unassessed/draft`.
  The lifetime Node controls, not this run's speed alone, prove the timer correction.
  Corrected-QA predecessor calibration retains all 39 checks and 18 P2 violations.
- [Late packet](repairs/integration/native-late-cancel/actions.json), **19 checks**:
  A terminal 5, B host 8, B terminal 9, release 10, actual original A host settlement
  11. Both real host values are `applied`; `lateObservations=[]` and B remains
  unchanged. [Transform binding](repairs/integration/raw/proposal-transform-binding.json)
  verifies the original promise observer, not an HTTP or terminal-only substitute.

The completed repair commands were dispatched by
`python3 output/evidence/ai-harness/p3/repairs/integration/run.py MODE` from the core
worktree. This retained runner writes fixed evidence paths; don't rerun it over the
packet. A fresh validation needs a new output/cache owner and free strict ports.
Every command held `$TMPDIR/p3-independent-repair-01a07564.lock` for its lifetime
with a 900-second bounded acquisition and distinct exit 75 for lock failure.
`TMPDIR=/dev/shm/rpg-zzu-ai-harness-p3-01a07564`; native scenarios ran serially.

| Recorded mode | Exact argv/environment and result |
| --- | --- |
| `focused` | [Receipt](repairs/integration/raw/focused-command.json), [JSON](repairs/integration/raw/focused.json): 53 files / 883 tests, exit 0. Original 52-file selection below plus `test/aiMutationApplyAccounting.test.ts`; four workers, private top-level Vitest cache, unchanged 15,000/90,000 ms test/hook bounds. |
| `node` | [Receipt](repairs/integration/raw/node-command.json): `node --test --test-timeout=1000 test/aiHarnessHumanLifetime.node.test.mjs output/evidence/ai-harness/p3/integration/validation/completion-wrapper.test.mjs`, 12/12, exit 0. |
| `typecheck`, `build` | [Typecheck receipt](repairs/integration/raw/typecheck-command.json), [build receipt](repairs/integration/raw/build-command.json): `npm run typecheck:app`, `npm run build`, both exit 0; original build warnings retained. |
| `human-edit-race`, `late-cancel` | [Human receipt](repairs/integration/raw/human-edit-race-command.json), [late receipt](repairs/integration/raw/late-cancel-command.json): `xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario NAME`, ports 50967 / 41217, both exit 0. |
| Six native preservation controls | [Summary](repairs/integration/raw/native-summary.json): proof-failure 60205, required-skip 59937, outcome-matrix 51175, retained-draft-ask 44779, wiki-delivery 60327, new-goal-draft 60295, each exit 0. Embedded-assertion scenarios aren't zero executed checks merely because `contractChecks` is empty. |

Unit/Node/compiler/build commands explicitly set proxy 0 and clear
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`,
`SUPABASE_ANON_KEY` and `SUPABASE_UPSTREAM_URL`. This isolates independent history
transport, not just store persistence. Native packets use fresh owned fixtures.
[Cleanup](repairs/integration/raw/cleanup.json) and the
[independent absence read](repairs/integration/raw/remote-absence.json) cover eight
owned projects and 42 exact commits across five tables, not ambient project impact.

The [first integrated focused attempt](repairs/integration/attempt-01-focused/focused.json)
remains exit 1, 881 pass / two failed exact cluster invocation assertions. The
correction adds the required `onApplied` callback expectation while retaining the
exact outer object, project/rebase and single-application controls. Predecessor
accounting/throwing-observer and lifetime/evaluation-bound REDs stay in their original
packets. This docs task ran no behavior tests or browser scenarios.

## Historical pre-review integration

Both P3 native races and six preserved native controls passed against the earlier
tested index committed as `9b2782f182cd1ae0b8fc8862de51a001a7ff3884`. The identities,
commands and observations below belong to that run, not the repaired source or
independent approval.

| Identity | Value |
| --- | --- |
| Approved merged P2 | `f22d64f7c2d95247189e8dacbffecc90dd0721d7` |
| Plan-metadata-only bootstrap | `3eceba70c0d58af825ec0ca5423f1468fd8dcd5e` |
| Integrated HEAD | `9b2782f182cd1ae0b8fc8862de51a001a7ff3884` |
| Tested index / integrated tree | `2fdc1dbd9ed48c3818cd24f5745560b1e3128b0a` |
| Product `src` tree | `8b2265557ab9ae5eb12beb068036a165adb02d35` |
| Shipped `test` tree | `9a6c37fbd506975524aa55ee0347f78dbea53f5f` |

Native packets label precommit HEAD `d5d5c015f`; their hashes and scoped index,
not that older HEAD label alone, bind them to the integrated commit.
[Integration report](integration/report.md) records that comparison, all commands,
raw direct exits, original failures and cleanup. [Docs report](docs/report.md)
records the documentation-only source review and validators. Some linked raw
packets are ignored files retained in the phase worktree for lead preservation,
not files guaranteed by a fresh checkout of this documentation commit.

## Historical contracts and their evidence

| Contract | Observed evidence |
| --- | --- |
| Retire execution authority, not retained work | [Epoch report](epochs/report.md), [reentry](epochs/reentry/report.md), [runner slot](epochs/runner-slot/report.md) and [exact restored case](epochs/runner-slot/exact-case/report.md). Terminal snapshots and successful-tool accounting precede synchronous callbacks. B can start while A is unresolved. A neither applies/proves through B nor clears B's runner slot; an orphan still owning A's slot releases it and the same runner accepts C after B. |
| Preserve applied A and current B after actual late completion | [Native late-cancel](integration/native-late-cancel/actions.json): direct exit 0, 19 checks, empty late observations and page/route errors. A's actual title remains applied; B's actual item stays at price 37 with current proof. After A's original host promise settles, B's bytes, outcome/proof, bridge, transcript, UI and activity remain unchanged. |
| Reject human-edit stale bases | [Stale producer](stale/report.md), [key-order correction](stale/key-order/report.md), [native human race](integration/native-human-edit-race/actions.json): direct exit 0, 39 checks, no page/route errors. Real editor changes to non-house tile, System width and existing `item_potion` price remain 7, 336 and 137 locally and remotely. No successful apply receipt; two rejection notifications; `failed / unassessed / draft`. Current-base apply once and exact Undo pass. |
| Recalculate, don't replay | `test/aiStaleProposal.test.ts` exercises real runner rejection, inspectable Ask draft, authorized fresh work against live data, no replay and undo. Key-order controls accept logically equal reordered objects but reject reordered arrays; same-byte replacement still invalidates lineage. |
| P1 authority remains | Native `proof-failure` and focused receipt/end-proof/commit-correlation controls preserve actual accepted receipt, read-only current proof, failure/retry, newer human edits and independent commit-history status. |
| P2 semantics remain | Native `required-skip`, `outcome-matrix`, `retained-draft-ask`, `wiki-delivery`, `new-goal-draft`, plus focused exact-verdict, requirement, current-error application, immutable history and Continue controls. Ask isn't apply authority, only genuine user scope actions retire/withdraw/resume, and current-owner wiki application/save owns its delivery. |

The local adapter requires a previously captured `ProposalBase`, checks lineage,
project identity and key-order-independent authored content, then rechecks immediately
before its synchronous undo/replacement section. Ordinary proposals retain live world
documents; reset proposals must match the world too. This earlier adapter called
`onApplied` before commit awaits but after store subscribers, the R1 gap corrected
above. Local accounting isn't an accepted persistence receipt. Later commit/wiki
awaits don't overwrite the old whole project again. See the
[API contract](../../../../openwiki/editor-ai-tools.md#p3-captured-proposal-base-2026-09-07),
[Panel lifecycle](../../../../openwiki/editor-ai-panel.md#p3-run-retirement-and-stale-drafts-2026-09-07)
and [publication boundaries](../../../../openwiki/editor-observability.md#p3-owner-bound-publication-2026-09-07).

## Exact native commands

These are historical pre-review integration commands, not runs on the repaired
source or runs performed by either docs node.
Run from `/home/main/z-project/rpg-zzu-ai-harness-p3-20260907` with Firefox/Xvfb and
Supabase access for fresh owned fixtures. Recorded ports are historical; a new run
needs a newly checked free strict port, owned cache child and fresh output directory.
Don't run the multi-control human race alongside test/build/browser jobs.

```sh
export TMPDIR=/dev/shm/rpg-zzu-ai-harness-p3-01a07564
QA_PORT=35959 QA_CACHE_ROOT="$TMPDIR/integration-st_01a07cbb/late-cancel" \
  EVIDENCE_DIR=output/evidence/ai-harness/p3/integration/native-late-cancel \
  xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario late-cancel
QA_PORT=34145 QA_CACHE_ROOT="$TMPDIR/integration-st_01a07cbb/human-edit-race" \
  EVIDENCE_DIR=output/evidence/ai-harness/p3/integration/native-human-edit-race \
  xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario human-edit-race
```

The command receipts are [late-cancel](integration/raw/late-cancel-command.json)
and [human-edit-race](integration/raw/human-edit-race-command.json). Both direct
exits are 0. The same entry also executed these controls, each exit 0:

| `--scenario` | Recorded port | Evidence |
| --- | ---: | --- |
| `proof-failure` | 45509 | [actions](integration/native-proof-failure/actions.json) |
| `required-skip` | 56233 | [actions](integration/native-required-skip/actions.json) |
| `outcome-matrix` | 49369 | [actions](integration/native-outcome-matrix/actions.json) |
| `retained-draft-ask` | 59883 | [actions](integration/native-retained-draft-ask/actions.json) |
| `wiki-delivery` | 55223 | [actions](integration/native-wiki-delivery/actions.json) |
| `new-goal-draft` | 36227 | [actions](integration/native-new-goal-draft/actions.json) |

Late-cancel arms its observer before A starts and proves A's original proposal-host
promise is pending while B finishes. A terminal activity is sequence 5, B terminal
is 9, release is 10, and actual A host settlement is 11. Final checks await the host
promise plus terminal activity, not HTTP delivery or rendering. The QA-only Vite
transform observes the returned API property only for this scenario and returns the
original promise unchanged. [Transform binding](integration/raw/proposal-transform-binding.json)
records the served instrumentation difference; product files aren't rewritten.

## Exact focused test command

This historical pre-review selection exited 0: 52 files, 872 passed, zero failed,
pending or todo. [Command receipt](integration/raw/focused-command.json) and
[raw JSON](integration/raw/focused.json) retain the original execution. The config
imports unchanged repository settings and explicitly sets top-level `cacheDir` to
`$TMPDIR/integration-st_01a07cbb/vitest`. Four workers and test/hook deadlines are
unchanged. `VITE_CACHE_DIR` alone isn't Vitest cache isolation.

```sh
export TMPDIR=/dev/shm/rpg-zzu-ai-harness-p3-01a07564
VITE_SUPABASE_USE_PROXY=0 VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= \
node scripts/run-vitest.mjs run \
  test/aiStaleProposal.test.ts test/aiGateCommitRejection.test.ts \
  test/projectResetTool.test.ts test/audioDescriptionToolStore.test.ts \
  test/storeMutationInstrumentation.test.ts test/aiRunnerSlotCleanup.test.ts \
  test/aiRunReentry.test.ts test/aiRunEpoch.test.ts test/aiRunEpochProof.test.ts \
  test/aiRunEpochPanel.test.ts test/aiAssistantTurnCleanup.test.ts \
  test/aiAssistantBridge.test.ts test/aiNewGoalDraftRetirement.test.ts \
  test/aiNewGoalEarlyOwnership.test.ts test/aiAskRetainedDraft.test.ts \
  test/aiAskPendingPlan.test.ts test/aiRunOutcomeOwnership.test.ts \
  test/aiOutcomeEntryOwnership.test.ts test/aiRunOutcomeLifecycle.test.ts \
  test/aiRunOutcomeIntegration.test.ts test/aiRunOutcomeApply.test.ts \
  test/aiRunOutcome.test.ts test/aiRunEndProof.test.ts test/storePersistenceProof.test.ts \
  test/aiApplyCommitCorrelation.test.ts test/applyChangesetToStore.test.ts \
  test/applyProposedProjectHouseProtection.test.ts test/aiRequiredOutcomes.test.ts \
  test/aiWorkPlanRequirementRepair.test.ts test/aiRequiredQuestionDispatch.test.ts \
  test/aiBlockedContinue.test.ts test/aiContinueUserAction.test.ts \
  test/aiOutcomeContinuationDelivery.test.ts test/aiOutcomeApplyPolicy.test.ts \
  test/projectWikiDelivery.test.ts test/projectWikiApplication.test.ts \
  test/projectWikiSession.test.ts test/assistantSessionCompaction.test.ts \
  test/aiRetryWorkPlanLifecycle.test.ts test/aiTurnAppliedAccounting.test.ts \
  test/aiChatObservability.test.ts test/aiChatPanelTransportError.test.ts \
  test/aiAutonomyRunSurface.test.ts test/aiAutonomousRunSurface.test.ts \
  test/aiPanelAutoExpand.test.ts test/aiPanelExpandShrink.test.ts \
  test/aiComposerEffortPanel.test.ts test/clusterAiModal.test.ts \
  test/clusterAiModalHouseProtection.test.ts test/clusterAiModalImageFirst.test.ts \
  test/clusterAiModalRangeClassify.test.ts test/supabaseProjectSync.test.ts \
  --config output/evidence/ai-harness/p3/integration/vitest.config.mjs \
  --configLoader runner --maxWorkers=4 --minWorkers=4 \
  --reporter=verbose --reporter=json \
  --outputFile=output/evidence/ai-harness/p3/integration/raw/focused.json
```

Integration also ran `npm run typecheck:app`,
`VITE_CACHE_DIR="$TMPDIR/integration-st_01a07cbb/build-vite" npm run build`, and
`node --test output/evidence/ai-harness/p3/integration/validation/completion-wrapper.test.mjs`,
each exit 0. Original build warnings remain visible. These aren't full gates.

## Original failures, isolation and limits

- [Archived producer history](integration/raw/history-binding.json) binds complete
  `qa-late-red.tar.gz`, `qa-human-red.tar.gz` and `late-green.tar.gz` under
  `integration/history/`, including original reports, raw attempts and cleanup.
  Original and corrected-observer P2 late-cancel both exit 1 with the same eight
  ownership violations. Final P2 human attempt-05 exits 1 with 18 safety violations,
  including actual item-price overwrite. Setup/deadline failures aren't behavioral RED.
- The terminal-only apparent late GREEN remains an unaccepted verification gap,
  not product success. The [historical lead item5 marker](integration/history/p3-late-cancel-accepted.json)
  accepted only the then-corrected source-bound item5 proof and authorized item6.
  That acceptance was revoked after independent R1; it doesn't approve the repair
  or all of P3.
- [First integration human attempt](integration/attempt-01-human-deadline/)
  exited 1 on `Deadline: human controls before stale model completion` and
  `Turn settle deadline`. Its release ordering was invalid. Isolated identical
  scripts/source later passed; no assertion or deadline changed in that historical
  rerun. Independent R2 then reproduced the failure in isolation. The repaired
  work-owned lifetime above replaces the competing timer; the isolated success
  alone wasn't a fix. Arbitrary-load success and complete CPU-time attribution
  aren't established.
- Unit history transport must be isolated independently of ProjectStore persistence.
  The [epoch preservation probe](epochs/reentry/preservation/report.md) exposed six
  exact ambient commit/change pairs, deleted and independently absence-checked.
  No broader cleanup or unmeasured project-row no-impact claim follows from that.
  [Testing guidance](../../../../openwiki/testing.md#project-history-transport-isolation)
  records the exact table keys and cache trap.
- The [frozen baseline manifest](integration/history/p3-baseline-f22d64f7c-complete.json)
  remains exit 1: 198 Vitest failures, 23 pending tests, the suite-only
  `runtimePictureStacking` failure and seven surface failures. The first watcher
  expiry remains incomplete. Compare final case/reason multiplicities and suite
  failures, not focused pass totals. Historical producer compiler/expanded-suite
  failures remain in their reports; no whole-test typecheck success is claimed.
- [Integration cleanup](integration/raw/cleanup.json) and each native action packet
  record nine owned fixtures, including the failed attempt, deleted with absence
  checks. Browsers, servers, routes, timers, gates, private caches and owned build
  outputs were closed/removed; all nine ports were independently rebound. Shared
  caches, foreign rows/worktrees and the lead-owned plan edit were preserved.

This evidence covers Linux native DOM/state/audit/remote readback and connected
unit seams. Screenshots are retained but subjective pixel approval is unverified;
registered window bridge observations aren't external MCP HTTP or remote telemetry
proof. These repairs don't establish a new log/evidence redaction guarantee; don't
publish credentials or assume raw packets are safe to publish without review.
No durable checkpoints, remote schema, distributed/two-tab writer guarantee,
generic DAG/code runner, coach marks, P4/P5 or whole-goal completion is claimed.
