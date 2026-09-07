# Frozen current-main execution core

## Disposition

**The supported core integration is complete and frozen after the answer-omission
correction.** The current affected candidate passed **313/313 tests in 12 complete
files**, fresh changed-file diagnostics, app typecheck and app build. The earlier
**2537/2537 in 41 files** and lead critical82 pass remain pre-correction evidence;
they were not repeated or relabeled as a full-tree pass for this revision.
Main remains the session, canonical acceptance, WorkPlan repair, native apply,
receipt and mutable result/recap owner. UI production and harness patches remain
unapplied and are now handed to lead/Grok. This is not whole-feature/browser/full
repository GREEN: the UI does not yet consume the new detail, and the three
separate legacy assertions below remain disclosed.

Worktree: `/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570`.
Branch: `fix/ai-unbounded-execution-main`.
HEAD: `5891c52bff4d86cefc6e2002f21339d66a828d73`, unchanged.
Resolved model: `opencodex/gpt-6-astra`, high (PI environment checked at entry).
No delegation, commits, merges, rebases, pushes, browser/image work, live provider
calls or remote DB writes. Reference trees were read only. No editor UI, styles,
game content, test/e2e or editor-observability changes.

## Frozen artifacts

- `frozen-core.patch`: complete 32-file integration delta, including all five new
  test files, against the worktree HEAD. SHA-256:
  `d83e3c405b6b3c82d65942eaab7071dde2fb14fdc07077b1246a8b4c6bad9747`.
- `frozen-files.sha256`: every changed/new product, test and wiki file.
- `frozen-core-source.sha256`: eight production modules in the current integration.
- `ANSWER-OMISSION-VERIFICATION.md`: current correction, exact RED/GREEN and limits.
- `answer-omission-green.json` / `.log`, `answer-omission-typecheck.log`,
  `answer-omission-build.log`: current affected-candidate validation.
- `frozen-core.json` / `.log`, `frozen-typecheck.log`, `frozen-build.log`: retained
  **pre-correction** full integration evidence. Original patch/manifests/reports are
  preserved under `*.pre-answer-omission.*`; original RED logs are unchanged.
- `HANDOFF-STATUS.md`: requested checkpoint and exact legacy-failure summary.
- `openwiki/editor-ai-panel.md`, new top section: shipped core/API documentation.

Production hashes:

```
f7053015170e8f4ee42a5b32586c3a0035373ccdb65461f0fa9b9c1579535cbc  src/ai/assistantSession.ts
d6ccc03e284bcfbbbcf592e757547f167bf9b0aca72e52b29195a1b001ae901a  src/ai/assistantAcceptanceLedger.ts
8a7e2994e9b54319093f15dc88b38129b92679a221587d89c0f35998fae7792a  src/ai/assistantRequestContract.ts
0f1aafe2cbbce02d4ba070e9dbc177a03d830fadccf03cf3b25237720cccfc4f  src/ai/intentDeclaration.ts
0923fa87b8160550ec102f0ae1048c9c4fe817042fa17a476f488420a27130a0  src/ai/intentDeclarationClient.ts
b4044a801ce95eef7b2ab0c12933e73e156a238854fd23bc75b4cc65b1f80137  src/ai/activityLog.ts
eeddeeb5a88120af60d780308a6304c553344d97c55260ec443e5957f12f7039  src/ai/activityLogTypes.ts
6e7c762e616be3b6ddac2d5d1f68c80a69877330dcdc0b3adc9b9c90482e632e  src/ai/runRecap.ts
```

## Delivered contracts

1. **Host lifetime before awaits.** Explicit non-Ask new-goal archives immutable
   assessment/source history and retires canonical, domain, pending extraction,
   draft and retry authority before preparation. Main's detached/store-backed
   baseline rule survives. Same-goal additions and explicit resume retain original
   facts/baselines/scope; old-goal backlog cannot execute after retirement.
2. **One canonical denominator.** Raw capture, anchored extraction, exact-field
   accepted user amendments, host withdrawal projection and additive volume enter
   main's ledger. Its evaluate signature, strict selectors, exact registered
   verification/freshness, action receipts, draft veto and flat schemas survive.
  `markAnswer` is a narrow host classification, not fake withdrawal; it now also
  rejects uncovered numeric/preservation source. Source/domain inconsistencies
  recover without discarding validated predicates or those raw constraints. Old eligible
   uncovered source and NPC extraction recover only in the active goal.
3. **One finite-segment driver.** Authorized Do rotates positive round/token
   segments. No cumulative48 or repair-count terminal cap remains. Thresholds
   select changed strategies; exact failed candidates stay excluded until the
   relevant arguments/prerequisites change. Complete batch responses and partial
   successful work survive. Current applied required outcomes can finish without
   model approval. Detached/manual behavior remains finite; genuine queued, abort,
   project-switch, explicit quick-reply and evidenced external boundaries survive.
4. **One apply/result authority.** Main `recordAppliedProject` transfers pending
   calls exactly once. Native commitProject/wiki/receipt ownership is retained;
   checkpoints do not copy the old duplicate append/clear tail. `RunOutcome` stays
   canonical. RequestExecution adds live rounds/segment/recovery and finer boundary
   detail, derived from the same current assessment/proof facts without donating
   unrelated receipts to delivery. Proof-only retry settles the original mutable
   handle, recap/audit and subscribers without authoring replay; current source,
   domain and explicit-verifier checks can reopen work. Old invocation/proof owners
   cannot finalize newer questions or restored same-ID requests. Project identity
   wins coincident abort, including terminal-publication callbacks.

NPC correction remains deliberately narrow: unique original event/item/changeItem
amount ownership can retire an approved exact count, including late-valid recovery.
Positive grant, one-time and unrelated reward constraints remain. No general
natural-language cancellation or arbitrary genre inference was introduced.

## Pre-omission full candidate verification (historical)

One successful invocation, no skipped/name-filtered cases:

```sh
npm test -- \
  test/assistantAcceptance.test.ts test/assistantAcceptanceCost.test.ts \
  test/assistantAcceptancePromiseBaseline.test.ts test/assistantAcceptanceRequestBaseline.test.ts \
  test/assistantAcceptanceSession.test.ts test/assistantAcceptanceSelectors.test.ts \
  test/assistantRequestContract.test.ts test/assistantAcceptanceSourceIntegration.test.ts \
  test/toolSchemaProviderCompat.test.ts test/actionAcceptanceRequirements.test.ts \
  test/actionAcceptanceProof.test.ts test/volumeContract.test.ts test/workPlanIdentity.test.ts \
  test/intentDeclarationClient.test.ts test/intentDeclaration.test.ts \
  test/agentVerification.test.ts test/runRecap.test.ts test/aiRequiredOutcomes.test.ts \
  test/aiNewGoalEarlyOwnership.test.ts test/aiNewGoalDraftRetirement.test.ts \
  test/aiRunOutcome.test.ts test/aiRunOutcomeApply.test.ts test/aiRunOutcomeOwnership.test.ts \
  test/aiRunOutcomeLifecycle.test.ts test/aiRunOutcomeIntegration.test.ts \
  test/projectWikiDelivery.test.ts test/aiRunEndProof.test.ts test/storePersistenceProof.test.ts \
  test/aiAssistantSession.test.ts test/aiUnboundedExecution.test.ts \
  test/assistantCoreIntegration.test.ts test/assistantQuestionAuthority.test.ts \
  test/npcRewardAmendment.test.ts test/npcRewardExtractionRecovery.test.ts \
  test/npcRewardSession.test.ts test/assistantDependencyRetry.test.ts test/aiWorkItemStall.test.ts \
  test/assistantVerificationEvidence.test.ts test/aiMilestoneTurnAccounting.test.ts \
  test/aiComposerModeSession.test.ts test/aiAskPendingPlan.test.ts \
  --maxWorkers=1 --reporter=json \
  --outputFile=.omo/evidence/core-integration/frozen-core.json
npm run typecheck:app
GOMAXPROCS=2 VITE_CACHE_DIR="$PWD/.omo/evidence/core-integration/build-cache" npm run build:app
```

- Tests: exit 0, **41 files / 2537 passed / 0 failed / 0 pending**, approximately
  1159.61 seconds from the JSON run interval. The JSON's 150 suite count includes
  nested describe blocks; it is not a claim of 150 files.
- Includes schema1423, RunOutcome437, session54, proof48, native store proof18,
  source62+29, source/selector/baseline/required/action controls, WorkPlan identity13,
  live main owners/wiki, unbounded/U1c18 (64 real applied segments), H5/backlog20,
  NPC19+22+16 and explicit core-seam16 controls. No model/DB transport was real.
- Public execution was exercised through real send/retry/tool/ledger/apply/store
  APIs, not a private replacement scheduler. Proof fixtures retain real serializer,
  in-memory wire transport, store-issued receipts and currentness checks. Native
  apply fixtures were corrected to make actual store changes rather than return
  fictitious applied snapshots.
- App typecheck: exit 0. App build: exit 0, **58.87s**. Six mixed static/dynamic
  import warnings and >500 kB chunk warning remain. Full product/player/standalone
  builds were not claimed or substituted for the requested app build.
- LSP was requested for all 30 changed TS files before build. Each received clean
  diagnostics during implementation. This lane's final refreshes for
  `assistantSession.ts` and `assistantCoreIntegration.test.ts` timed out at 3000ms.
  **Root subsequently reported both final refreshes successful: No diagnostics
  found.** The final diagnostic gap is closed by that lead verification; this lane
  did not repeat those checks. App typecheck independently passed. No Markdown LSP
  exists.
- `git diff --check` is clean. Seven production hashes matched after validation.
  Final owned-worktree process scan found no Node/Bun/esbuild runtime process.

### Lead verification closeout

The lead independently parsed the earlier frozen JSON and confirmed **2537 passed
/ 0 failed**, verified all seven then-current source hashes, and supplied the clean
diagnostics above. The lead subsequently reported critical82 passed with matching
hashes. It then reopened the concrete omission defect now documented in
`ANSWER-OMISSION-VERIFICATION.md`. Those earlier passes did not cover the defect;
the new six-case behavioral RED and current 313-case affected GREEN are separate.
Commit and subsequent UI release remain lead-owned. This child lane has no pending
implementation or validation command.

## Previously disclosed legacy failures and comparator (not rerun for this correction)

These are not included in the 41-file GREEN command and are not hidden, skipped,
deleted or credited as GREEN. Full current-tree gates remain lead-owned.

Comparator: unchanged f22
`/home/main/z-project/rpg-zzu-unbounded-main-review-01a07570/.omo/gates-vitest-report.json`.
The lead's baseline is app typecheck0/CSS0, Vitest17967 pass/199 fail/18189 total,
surface failure; this lane compared the actual assertion messages below.

| Remaining assertion | Candidate evidence | Pinned f22 comparison |
| --- | --- | --- |
| `aiAutonomousRunSmoke.test.ts` local house lifecycle, candidate L228 | `agent_run_local_only` existence: expected true, received false | Same assertion at f22 L225: expected true, received false |
| Same file, mocked remote-house proof, candidate L266 | stoppedReason expected `final`, received `error` | Same assertion at f22 L263: expected `final`, received `error` |
| `assistantSessionIntent.test.ts:114`, F-05 auto routing | Exact model response sentence expected; received empty string | Same assertion fails on f22, but observed old incomplete-acceptance notice instead; observed payloads are **not identical** |

`legacy-adjacent.json` initially recorded 17 pass / 4 fail. The fourth was a real
continuation-audit regression; reuse of captured intent now publishes its actual
continuation audit. `last-seams.json` then recorded 45 pass / 1 fail across core,
NPC amendments and intent, with only F-05 remaining in the intent file. No NPC
obligation failure was waived because it appeared upstream: the unrelated skipped
replan case now retains main's repair identity and remaining NPC obligation, and
all 19 NPC lifecycle tests passed in the final candidate.

The house smoke's source has no anchored extraction contract, and its remote mock
still returns the obsolete saved-without-receipt/reload shape. Raw history cannot
authorize proof. No source omission, fabricated receipt or reload shortcut was
introduced to make those assertions pass. Real direct/planned persistence, local
completion and no-replay behavior are covered by the final core/native P1 suites.
The F-05 assertion pins prose rather than a machine policy field; it remains
disclosed unchanged. This is a supported-core result, not blanket adjacent GREEN.

## RED and development failure accounting

- `session-red.log`: initial setup attempt failed because `apply_patch` was not on
  PATH; no tests existed yet. This collection failure is **not behavioral RED**.
  The existing codex apply_patch executable was then used for all code edits.
- `session-behavior-red.log`: actual public session tests ran before production
  edits, **2 failed**: pre-await source snapshot was undefined, and genuine-answer
  execution detail was undefined. No missing-module/export collection failure.
- Original ported behavior RED remains in the preserved reference evidence:
  `h5-final-verification.md`, `npc-late-valid-verification.md`,
  `m1-u1c-verification.md` and their named original RED logs under the parent
  `.omo/evidence/ai-unbounded`. Those references were retained, not regenerated or
  substituted with this candidate's later GREEN.
- `proof-first.log`: **45 pass / 2 fail**. Finer verified detail incorrectly
  required run-owned delivery on compatible human-edit reproof / restored owner.
  It now uses current required acceptance and current proof while main still owns
  delivery attribution; the final 48-test proof file passes.
- `main-first.log`: **54 pass / 75 fail**, plus Vitest RPC `onTaskUpdate` timeout.
  `owners-second.log`: **108 pass / 18 fail**; `owners-third.log`: **93 pass / 2 fail**.
  These development failures are not GREEN. Fixes preserved pre-preparation main
  ownership, manual pending publication, initial failed-owner extraction on resume,
  and exact source-aware fixture/action expectations. Final owner suites pass.
- `adjacent-first.log`: process deadline **900s**, incomplete run after stall5,
  NPC17 pass/2 fail and dependency21. Endless legacy fixtures did not represent the
  new authorized recovery contract. Explicit event-driven abort controls and real
  apply/source fixtures replaced cap-based or fictitious-apply assumptions.
  `adjacent-second.log`: **75 pass / 3 fail**, corrected at queued-entry,
  applied-checkpoint and source-repair seams. No individual deadline was raised.
- `canonical-first.log`: process deadline **600s**, incomplete, with source62
  recorded passed. It is not GREEN. The request-baseline fixture was subsequently
  given real native application/source extraction and explicit recovery stop;
  its six controls and all canonical tests pass in the final candidate.
- Earlier split passes (seams93, canonical1683, session54, baselines6, feature72)
  are development evidence only. The **2537** invocation validated the earlier
  pre-omission frozen candidate. The current correction has its separate **313**
  affected-test pass; no full-tree rerun is claimed. No sleeps/polling were
  introduced; proof cleanup aborts/releases/awaits pending work before restoring
  fixture globals. No baselines, warning allowlists or caps were raised.

## Precise UI handoff

Prepared files remain untouched/unapplied:
`.omo/evidence/ui-integration-patch/ui-production.apply.patch` and
`ui-test-harness.apply.patch`. Exported shapes match `INTERFACE-ASSUMPTIONS.md`.
The new top wiki section is the frozen core contract.

- `assistantSession.ts` exports `ExternalBlocker`, `RequestExecution` and the
  `SessionEvent` member `{ type: "run_state"; execution }`; `run_outcome` stays.
- `TurnResult.execution?`, `RunRecap.execution?` coexist with `runOutcome?`.
  Harness retains main acceptance/outcome/proof and adds requests/execution.
  `getExecution()` is read-only/currentness-aware. `getRequestHistory()` exposes
  isolated retired source history, never a resume queue.
- `AiActivityResult` adds execution/acceptance/requests and recap.execution; activity
  builder and compact recap retain both axes. Historical parsing never restores
  live authority. `AGENT_RUN_MAX_TOTAL_STEPS` remains exported for legacy parsing
  only; live UI budget must use `roundCap`, `rounds`, `segment`.
- Keep main RunOutcome rendering and settlement. Use execution only for live/finer
  detail. In particular `verified` detail is not permission to label an unrelated
  human receipt as this run's `persisted-verified` delivery.
- Ordinary apply must conjoin main non-Ask and missing-legacy-execution or
  `manual-segment`; never replay autonomous applied work. Retain
  `recordApplyRejected`, true commitProject accounting and session wiki onDelivery.
- Do remains autonomous across chat/auto agent modes. Explicit user Continue uses
  host `goalAction: "resume"` via `userResume`; raw continuation cannot escalate
  Ask/Plan. **Confirm-level Do preview** separately accepts a real second ordinary
  Do confirmation, matching B1. This distinction has a direct regression test.
- Busy queued entry remains real composer Enter. Preserve project-switch detail,
  U1a/U1b serialization, both axes and zero late apply after retirement. Internal
  rollover never becomes a terminal budget-exhausted/Continue offer.

No UI API rename is needed. Lead/Grok can integrate the prepared UI patches against
this frozen core, then own full11, current-tree full gates, review and PR. No
additional core implementation or full-repository gate is queued in this lane.
