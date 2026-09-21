# P2 backend outcome integration

**Current verified integration:** Typed continuation decisions replace projection-only prose classification; ordinary and milestone application share post-apply completion policy; trusted continuation/proof retry retains delivery while fresh queries do not. Fresh-entry delivery ownership is now established from trusted entry facts **before fallible context/intent awaits**, including real signal-aware intent cancellation and early failure. **657/657 tests in 20 files and a fresh complete build pass.** A fresh actual browser matrix again passes all **138 non-UI checks**, with its ten UI-hook failures retained. The verified early-entry and prior policy corrections below contain exact RED/GREEN commands and preserved limits.

**Earlier runner follow-up:** [Real blocked-work Continue availability](integration-blocked-control.md) completes the integration-owned runner split: the existing control is visible and actually clicked after Ask, including after native history folding. **524/524 scoped tests and a fresh complete build pass.** The strengthened real browser terminal contract remains RED because the Panel click still sends Ask instead of Do; the UI lane must fix that user boundary and obtain blocked/incomplete/no-change after the resumed unfinished run. No synthetic control or test-only goalAction shortcut is used.

**Earlier follow-up:** [Owned fixture I/O drainage](integration-fixture-drain.md), committed as `bd836d57a`, corrected cleanup before globals restoration and passed **35/35 affected/P1 tests** plus build. Its then-missing Continue control is superseded by the latest runner fix.

Initially integrated the producer contracts through the actual session, ordinary/milestone apply, P1 proof, bridge, activity serialization and recap paths. Initial scoped verification was **586/586 tests in 15 files, exit 0**, and the complete build is **exit 0**. The unchanged actual browser/API matrix passes **all 138 non-UI checks** across ten real cases. Its overall exit remains **1 solely for the ten missing UI outcome hooks**, which are explicitly owned by the next node. No assertions were removed or weakened to call that full scenario GREEN.

## Scope and committed identity

- Task `st_01a077c3`, integration node, approved plan items 3/4/12 only.
- Sole writable worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`; branch `agent/ai-harness-p2-20260906`.
- Entry HEAD: `d6a38018c4dfb8642d46a5b94b3f1bbcb7d888bc`, clean working tree/index. No upstream configured (lookup exit 128).
- Read full phase contract, requirements producer handoff, outcome and QA handoffs, AGENTS, OpenWiki quickstart/INDEX/PROJECT_WIKI, focused AI acceptance/workflow, editor routing and observability guidance before source edits. Read TypeScript/logging/refactor references. Project-specific npm/Vitest/native transport/custom-parser constraints took precedence over generic skill defaults.
- **Verified implementation commit:** `f4ae6118e5e44fe8f3d29727fb6fd15f1a75cd66` (`feat(ai): settle shared run outcomes through apply and publication`).
- Implementation tree `361db44a8b5ded766c9f83ae5e166e9839fbdec5`; `src` subtree `08297f34362bd6aae3b83f7943ab3cd811d98938`; `test` subtree `771efdeadcd0dfc850bb9ec61fc5551780095cb5`.
- Final tests, complete build and final actual API execution all ran against the exact source/test bytes committed there. No source/test edit followed those executions before the implementation commit; the later test-only drainage correction is linked above. The final API report's pre-commit HEAD is correctly retained rather than rewritten; its 16 source/harness hashes all match the implementation commit, verified in [integration-api-binding.log](integration-api-binding.log).
- Original report/evidence commit: `761ed517b188729130e26dad57196aa4218b19ab`, following the implementation commit and containing only `output/evidence/ai-harness/p2/integration*`. The later test-only follow-up commit is listed in the task handoff.

## Ordered inherited/imported/own commits

The requirements producer was already on the main P2 branch. Its authority was not imported over or replaced:

1. `a258dfaad4fc3eb763c09e93fb251b152bab4901` - initial canonical requirement implementation.
2. `9e01ca0525866ddfc262cfbe3e073a894c6c172b` - initial requirement evidence/API handoff.
3. `c6de2da052373e80aea9f5ec7d7293a64f178df4` - final requirement authority corrections.
4. `d6a38018c4dfb8642d46a5b94b3f1bbcb7d888bc` - terminal requirements handoff.

Verified both independent producer worktrees were clean, inspected their actual commit scopes and terminal heads, then ran exactly:

```sh
git cherry-pick 7f42772c92de52fab6ae74f1aa4b71d8e0420011 0d3793b45a0c24c0a651568367e04ac5f8ed61ca 0d623b5dd224ef28564c8d98cfcdcb54c55a1589 8f82a11b9df297c3d0ab396a44b316423f0ae395
```

Exit 0, no conflict or merge. Ordered mapping:

| Order | Producer SHA | Imported main-P2 SHA | Scope |
| --- | --- | --- | --- |
| 5 | `7f42772c92de52fab6ae74f1aa4b71d8e0420011` | `919ac0f940135b39250840c5c22627377210d96e` | Pure outcome, truth table, evidence |
| 6 | `0d3793b45a0c24c0a651568367e04ac5f8ed61ca` | `f59c1b4dc055c2df632279ed6d30f25a13cc436e` | Real-surface QA contracts |
| 7 | `0d623b5dd224ef28564c8d98cfcdcb54c55a1589` | `51a74685b611b071ae9c23a889b7a3462b2e345e` | Preserved old-source RED evidence |
| 8 | `8f82a11b9df297c3d0ab396a44b316423f0ae395` | `0ef465d1419561a7f137f2c4636fedfb06eb8bd6` | Actual user resume/Ask follow-up |
| 9 | own | `f4ae6118e5e44fe8f3d29727fb6fd15f1a75cd66` | Verified backend implementation and direct tests |
| 10 | own | `761ed517b188729130e26dad57196aa4218b19ab` | Original report and raw integration evidence |
| 11 | own | `bd836d57ae238405f9388dd346a35ca8371df242` | Fixture writer drainage, regression and actual Ask/resume handoff |
| 12 | own | `89584faf0470cfc4601fd791180ff1f659ec7e95` | Blocked-work Continue availability, native history retention and resumed terminal contract |
| 13 | own | `841ee4ae1fc7cd2564e857a2a8860a91a1e6c3e3` | Verified typed-stop, apply-policy and trusted-continuation corrections in this central deliverable |
| 14 | own | current task handoff SHA | Pre-await fresh-entry ownership, signal-aware regression, bounded small fixture and central evidence |

At the original integration handoff, terminal producer heads still equaled the two named terminal SHAs. `git diff 7f42772c9 HEAD -- src/ai/runOutcome.ts test/aiRunOutcome.test.ts`, `git diff 8f82a11b9 HEAD -- scripts/qa`, and the diff against `d6a38018c` for the canonical acceptance types/ledger/tool-verification authority were empty. The latest follow-up intentionally adds only two terminal-agreement assertion lines to the imported resume helper; it does not rewrite producer evidence or weaken its contract. All imported commits and own commits retain mandatory omo attribution. No push, merge, rebase, nested agent or shared-main worktree edit occurred.

## Backend contract and ownership map

### One outcome projection

`src/ai/runOutcome.ts` remains byte-for-byte producer code (SHA-256 `b5c44e295d3de495a728a33c9f122babe81ee47b61f31dc848234348ef35fa7f`). Every runtime outcome is derived by its `deriveRunOutcome`; no consumer evaluates requirements or parses model claims into an outcome.

The existing WorkPlan continuation policy now returns `RalphContinuationDecision`; `shouldRalphContinue` remains a compatible boolean wrapper around that same policy. The tool loop carries the actual decision to its return boundary, and the autonomous driver consumes it at its real stop branch. The projection-only `assistantTextLooksLikeQuestion(finalText)` call was removed. Existing quick-reply-marker, cap, blocked-item and continuation heuristics are unchanged; no second prose classification or requirement evaluator was introduced.

The session captures execution at the actual decision sites: final response, clarification/plan-only wait, stalled/required-blocked work, transport failure, cancellation, token/tool budget, driver budget and pending-user yield. Legacy `stoppedReason` values remain unchanged. In particular, a driver can yield to a pending user after an inner `max-tool-calls` return; its later `awaiting-user` decision is not overwritten by reconstructing execution from that legacy string.

The canonical `AssistantAcceptanceLedger` remains the only requirement-satisfaction authority. The session reads its assessed status; null remains unassessed. A store-backed getter checks whether the applied revision underlying a retained canonical pass still matches the live project. A stale pass is conservatively projected as incomplete until the existing canonical refresh evaluates it. This is freshness invalidation, not a second requirement evaluator or a mutation of the stored snapshot. It may conservatively downgrade an unrelated unrefreshed edit; normal editor store subscriptions already perform canonical refresh.

### Actual application and P1 proof

`recordAppliedProject(actualSuccess)` now transfers the pending call collection into the existing applied-call ledger at the real successful apply boundary, retaining both collections when later drafts are produced. Milestones no longer separately double-add those calls. The runner captures its pending array before application because successful settlement changes the returned result's pending collection; applied accounting and blueprint settlement still use the actual applied calls, not an emptied array.

An acceptance-only terminal stop records whether a pending ordinary draft still needs actual application after scheduling has finished. At the existing applied-state refresh, only the same actually applied project with no pending calls and a newly verified canonical assessment can settle that provisional block to `response-final`. Genuine work stalls, errors, cancellation, unfinished scheduling and adventure problems do not receive this promotion. The original result, recap and final event are refreshed before publication; equivalent milestone and ordinary paths therefore share completion policy.

`recordApplyRejected(onEvent?)` captures failed execution without rewriting `stoppedReason` or discarding the draft. Both actual proposal-host rejection and runner settlement use it. Ordinary successful apply still follows the existing host rebase and `proveAppliedRevision` path; no approval, auto-apply, undo, house guard, region approval or advisory behavior was changed.

Only an actual P1 flush receipt correlated to the current run's actual `commitProject` can become this run's accepted persistence fact. Commit-log `persisted`, newest/global receipts, model flags and status text cannot grant it. A passing proof must also refer to that receipt and remain current to project `persisted-verified`; stale or failed proof preserves accepted `persisted`, not verified. Public entry now establishes delivery retention synchronously from the normalized original instruction and host composer/goal action, before context/image/intent work can await or fail. Fresh entries clear the prior receipt, actual-apply metadata and applied-call collection at that boundary. The existing post-intent boundary remains able to revoke provisional retention when the effective request is a question; model output cannot grant delivery ownership. Host-authorized manual continuation and synthetic driver continuation retain their already-owned applied calls, apply metadata and receipt. Fresh requests and Ask queries clear that delivery ownership, including Ask containing the literal continuation token. A model `source: continuation` claim alone does not preserve delivery. Explicit `retryLastTurn` continues to retry proof without replaying applied tools. The mutable returned-result holder gives an in-flight proof an actual publication owner: an old proof cannot cancel or settle a newer query. P1 proof's existing overlapping-attempt guards and store authority are preserved.

### Publication surfaces

- `TurnResult.runOutcome`: optional in the public compatibility type; every real session completion populates it.
- `session.getRunOutcome()`: `RunOutcome | null`, null before a result exists; read-only, live freshness projection.
- `getHarnessSnapshot().runOutcome`: the same live getter.
- Session event: `{ type: "run_outcome", runOutcome }`.
- Original returned result handle: settled after ordinary apply/proof, not abandoned as an earlier draft clone.
- `TurnResult.recap.runOutcome`, compact `run-recap` audit JSON, bridge send response, `ActivityRecord.result.runOutcome`, and activity recap: updated before final publication. Compact recap is updated in its existing audit slot rather than appended as a duplicate.
- Activity builder now actually retains recap; previously the runner supplied it but serialization dropped it.
- Stored recap parsing accepts only the exact three-axis literal contract. Legacy records without outcome remain without outcome; no prose migration is performed.

The original session subscriber is retained for post-return apply rejection publication, so passive QA observation sees the actual final event without a new synthetic seam. Explicit callbacks still take precedence. Read-only getters do not settle historical result handles, write audit entries, save, prove, or mutate canonical evidence.

### User-only withdrawal handoff

The existing authority API remains:

```ts
session.withdrawRequirement({ acceptanceId, requirementId, reason }, onEvent?): boolean
```

It now refreshes the result's typed outcome after canonical withdrawal. A scoped local user boundary is exported from `src/editor/aiAssistantBridge.ts`:

```ts
withdrawAiRequirement({ acceptanceId, requirementId, reason }): boolean
```

The real panel registration refuses this action when disposed or busy and delegates to its current session. It is deliberately **not** a `BridgeCommand`, HTTP/MCP command, `window` tool, LLM schema or tool dispatcher. The UI node should invoke it (or the canonical session API with its normal event callback) only from a genuine scoped user action, then refresh the current snapshot/outcome surface. An unmet withdrawn item stays unmet in history while its denominator effect is canonical. No renderer, control, CSS or UI hook was authored here.

## Verified early-entry ownership refinement

This scoped correction starts at committed integration head `841ee4ae1fc7cd2564e857a2a8860a91a1e6c3e3` and stays on the same main P2 branch. The earlier post-intent delivery reset was too late: `buildUserTurnContent` and `declareTurnIntent` are awaited first. A fresh send could therefore reach the outer failed/cancelled result path with the previous run's verified receipt and applied calls still attached.

`sendUserMessage` now establishes the entry's delivery ownership before those fallible awaits, using only trusted entry facts: `options.instruction` (or the original text with its context footer stripped), explicit host resume/new-goal action and composer Ask mode. Only explicit continuation/resume outside Ask/new-goal can retain existing applied delivery. A shared three-field clearing method is used by entry and the existing post-intent boundary; the latter can still revoke retention for effective questions. No new run epoch, checkpoint, authority object or P3 framework was introduced. The single outcome projector, canonical ledger, P1 receipt/proof authority and existing late-owner guards are unchanged.

### Signal-aware failing-first evidence

`test/aiOutcomeEntryOwnership.test.ts` first creates actual ordinary applied work and verifies its genuine P1 receipt. The same session then invokes an injected intent transport that calls native `signal.throwIfAborted()` or throws an armed transport error. Unlike `fixedDeclarer`, it cannot silently ignore an already-aborted signal. Each case asserts that this second real intent-boundary invocation occurred, then compares returned outcome/applied calls, recap, getter, harness and final event; the prior result and historical proof receipt remain unchanged.

The twelve cases cover cancelled and failed entry for fresh requests, explicit continuation, Ask with the continuation token, new-goal with that token, and both directions of host instruction override. Ordinary and override-based explicit continuation must retain the still-owned verified work; every fresh/Ask/new-goal case must be no-change.

```sh
npm test -- test/aiOutcomeEntryOwnership.test.ts --maxWorkers 1 --minWorkers 1
```

- Initial exit **1**: six faithful delivery assertion failures, four 15-second test timeouts, two passing continuation controls. Raw [integration-entry-red.log](integration-entry-red.log) is preserved. The timeouts are not credited as behavior RED.
- Before changing production ownership, the fixture was reduced to the established P1 valid one-custom-tile shape, retaining the real map/database/resources and store/normalizer/save/proof path while dropping unrelated bundled tileset catalogs. No test timeout, signal assertion or expected outcome was changed. Repeating the exact command then exited **1 with eight faithful delivery failures and four passing continuation controls, zero timeouts**. Raw: [integration-entry-red-small-fixture.log](integration-entry-red-small-fixture.log). Fresh failed/cancelled entries actually returned `persisted-verified` where `no-change` was required.

The shared fixture now accepts a real intent-declarer dependency in addition to its existing scripted chat dependency. Its call-through writer drainage and bounded response-body cleanup remain intact. This is a fixture-size correction, not an I/O mock replacing the tested authority.

### Final verification and actual API proof

```sh
npm test -- test/aiOutcomeEntryOwnership.test.ts test/runOutcomeApplyFixture.test.ts test/aiOutcomeApplyPolicy.test.ts test/aiOutcomeContinuationDelivery.test.ts test/aiRunOutcome.test.ts test/aiRunOutcomeApply.test.ts test/aiRunOutcomeOwnership.test.ts test/aiRunOutcomeLifecycle.test.ts test/aiRunOutcomeIntegration.test.ts test/aiBlockedContinue.test.ts test/aiRequiredOutcomes.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts test/aiAssistantBridge.test.ts test/workPlan.test.ts test/aiRunEndProof.test.ts test/storePersistenceProof.test.ts test/assistantAcceptanceSession.test.ts test/aiActivityLog.test.ts test/runRecap.test.ts --maxWorkers 1 --minWorkers 1
npm run build
```

Both exit **0**. Tests: **657 passed, 20 files, zero failures/skips, 549.35s**. Build includes app typecheck, editor, player/SDK and standalone bundles. Raw: [integration-entry-green.log](integration-entry-green.log), [integration-entry-build.log](integration-entry-build.log). All three changed TypeScript files received fresh clear diagnostics. Source/test whitespace checks passed. Existing build warnings remain unsuppressed. No source/test edit followed these final executions.

```sh
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/integration-entry-surface xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario outcome-matrix
```

Overall exit **1 solely for the ten missing UI outcome hooks**, with **138/138 non-UI checks passing** on a fresh editor/bridge/session/store/LegacyDb execution. [integration-entry-binding.log](integration-entry-binding.log) verifies all 16 source/harness hashes against this corrected source and inventories cleanup. This matrix preserves the prior ten real cases; the new pre-intent-failure cases are covered through the actual session API and signal-aware injected intent boundary, not claimed as new browser cases.

Run-owned project `qa-ai-surface-e1712cec-2d35-476a-bae4-5ee0de9761bc` and its child rows/observed commits were deleted with absence proof. Browser, server, cache, page listeners/timers and port were released, `activeRoutes:0`, no reused listener. Configured key-value scan passed. All earlier REDs, intermediate results, prior test/build records and UI-lane limitations remain preserved; Ask-to-Do click wiring and full gates/exact-head approval are still downstream responsibilities.

Architectural review: the new helper clears only the existing applied-delivery facts and has two actual callers; there is no second evaluator or general lifecycle abstraction. Trusted entry parsing reuses the existing continuation token/context-footer semantics. No new casts, any annotations, non-null assertions, suppressions, sleeps/polling, prose assertions, logger or dependency changes. Fixture and regression pure LOC are 88 and 61; inherited session is 3981 under the fixed narrow no-redesign scope. Test fixture boundary checks concern genuinely optional map/tileset lookups; no product defensive layer or redundant post-delete verification was added. The existing attributed commit chain is extended with this verified correction, not left dirty.

## Verified stop/apply/continuation policy correction

This correction is based on committed integration head `89584faf0470cfc4601fd791180ff1f659ec7e95` and is delivered as another scoped commit on the same main P2 branch, not an uncommitted patch or separate outcome implementation. It changes `assistantSession.ts`, the existing WorkPlan continuation decision seam, two new direct test files and one optional fault-reset parameter in the existing drained fixture. The canonical acceptance ledger, pure `runOutcome.ts`, P1 store/proof authority and QA scripts are unchanged by this correction. Prior raw evidence remains intact.

### Faithful failing-first cases

```sh
npm test -- test/aiOutcomeApplyPolicy.test.ts test/aiOutcomeContinuationDelivery.test.ts --maxWorkers 1 --minWorkers 1
```

**Exit 1: four assertion failures and seven passing controls.** Raw: [integration-policy-red.log](integration-policy-red.log).

- Real ordinary resize application produced `blocked / satisfied / persisted-verified`, while its equivalent actual milestone path correctly produced `response-final / satisfied / persisted-verified`. The ordinary requirement was explicitly asserted unverified before application, then verified only by real applied content.
- A real unfinished plan stopped at `QUICK_REPLY_MARKER` without question prose, but the separate projection classifier returned blocked rather than awaiting-user. The test pins only the machine-consumed marker and typed result, not prompt wording.
- Trusted manual `계속` lost both accepted and verified delivery to no-change because public-send and non-driver resets cleared ownership before the actual resume decision.
- Passing controls already preserved genuine blocked/error/cancelled executions, direct proof retry, fresh query and Ask delivery exclusion. These assertions were retained unchanged.

The first implementation passed **51/51 cases** including all 40 existing WorkPlan tests (`npm test -- test/aiOutcomeApplyPolicy.test.ts test/aiOutcomeContinuationDelivery.test.ts test/workPlan.test.ts --maxWorkers 1 --minWorkers 1`, exit 0; [integration-policy-green-attempt.log](integration-policy-green-attempt.log)). The final implementation carries the decision until the actual return, so a later review/repair continuation cannot retain a prematurely recorded stop. Two additional real completed-milestone controls exercise manual continuation retrying a failed proof versus a fresh query; neither replays the title tool.

### Final verification

```sh
npm test -- test/aiOutcomeApplyPolicy.test.ts test/aiOutcomeContinuationDelivery.test.ts test/aiRunOutcome.test.ts test/aiRunOutcomeApply.test.ts test/aiRunOutcomeOwnership.test.ts test/aiRunOutcomeLifecycle.test.ts test/aiRunOutcomeIntegration.test.ts test/aiBlockedContinue.test.ts test/aiRequiredOutcomes.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts test/aiAssistantBridge.test.ts test/workPlan.test.ts test/aiRunEndProof.test.ts test/storePersistenceProof.test.ts test/assistantAcceptanceSession.test.ts test/aiActivityLog.test.ts test/runRecap.test.ts --maxWorkers 1 --minWorkers 1
npm run build
```

Both **exit 0**. Tests: **643 passed in 18 files, zero failed/skipped, 668.73s**, including the named plan suites and actual P1 proof adapters. Build includes app typecheck, editor, player/SDK and standalone bundles. Raw: [integration-policy-final-green.log](integration-policy-final-green.log), [integration-policy-build.log](integration-policy-build.log). No source/test edit followed these final executions. Fresh diagnostics on every changed TypeScript file were clear; two requests initially timed out during contention, and subsequent fresh session/continuation-test requests returned no diagnostics. No timeout was raised in tests and no assertion was weakened.

The new ordinary/milestone contract compares independently specified expected axes after native `resize_map`, actual `applyProposedProject`, canonical applied-state assessment and real store flush/read proof against the fixture's wire-level row. Separate negative cases prove actual independent blocked, failed and cancelled stops remain so even when the applied draft later satisfies the requirement. Continuation cases use the normal public `계속` token or existing proof retry; fresh query and Ask controls in the same session retain no old applied calls/delivery. The completed-plan manual continuation case actually retries its failed proof against the same receipt with one total title-tool execution. No general epoch, checkpoint, authorization or P3 framework was introduced.

### Actual API probe, cleanup and remaining scope

```sh
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/integration-policy-surface xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario outcome-matrix
```

Overall **exit 1 only for the ten absent UI outcome hooks**; all **138 backend/behavior checks pass**, with the original assertions unchanged. [integration-policy-binding.log](integration-policy-binding.log) verifies all 16 actual source/harness hashes against this corrected source and the cleanup receipt. Raw logs, actions, exit and screenshots are in [integration-policy-surface](integration-policy-surface/). This is a fresh editor/bridge/store/LegacyDb execution, not a reused earlier probe. It validates the original ten matrix cases; the new canonical apply-policy and continuation cases are actual-adapter integration tests, not claimed as additional browser cases.

Run-owned project `qa-ai-surface-86b3383b-439b-49c7-b044-d2365806b6aa` was deleted with child-table/commit absence proof. Browser, server, cache, listeners/timers and port were released; `activeRoutes:0`, no reused listener, configured key-value scan passed. The UI-lane Ask-to-Do user-click boundary and its deliberately RED resumed terminal assertions remain as documented in the runner handoff; this policy correction does not bypass them.

Architectural review: one canonical requirement ledger and one outcome projector remain; the new typed WorkPlan value is the existing scheduler's stop reason, not goal authority. The apply-pending flag records only the actual acceptance stop cause and settles only through the correlated actual applied-state refresh. New helper methods have one or zero parameters and two real callers; normalized facts remain typed, no parameters or caller data are mutated. No new any/casts/non-null assertions, suppressions, sleeps/polling, prose assertions, dependencies, logging framework or defensive re-query. The fixture retains bounded call-through writer drainage before restoring globals. Pure LOC: inherited session 3976, WorkPlan 878; drained fixture 73, new apply-policy tests 88, continuation tests 78. The explicit narrow phase scope still forbids unrelated restructuring of the inherited oversized owners. Source/test whitespace checks passed; raw log whitespace is retained.

## Own RED -> GREEN record

All commands ran in the sole writable worktree with existing npm/Vitest. Combined stdout/stderr is retained unchanged; npm exits were captured directly, not through a pipe. Source/hash binding above applies to final verification, not earlier REDs.

| Execution | Exact command | Exit/result | Raw evidence |
| --- | --- | --- | --- |
| Before wiring session/apply/serialization | `npm test -- test/aiRunOutcomeIntegration.test.ts test/aiRunOutcomeApply.test.ts --maxWorkers 2 --minWorkers 1` | 1: 10 assertion failures, 1 pass; actual returned session/apply results lack outcome, serializers drop it | [integration-red.log](integration-red.log) |
| Initial implementation | same command | 0: 11 passed | [integration-green-attempt.log](integration-green-attempt.log) |
| Post-return settlement regressions | `npm test -- test/aiRunOutcomeApply.test.ts --maxWorkers 2 --minWorkers 1` | 1: 2 failures, 5 passes; compact audit remained draft and original subscriber retained pre-rejection execution | [integration-settlement-red.log](integration-settlement-red.log) |
| First broad focused run | Final command below without Ownership/Lifecycle, workers 2/min 1 | 0: 578 passed, 13 files | [integration-focused-attempt.log](integration-focused-attempt.log) |
| Ownership/freshness RED | `npm test -- test/aiRunOutcomeOwnership.test.ts --maxWorkers 2 --minWorkers 1` | 1: 2 failures; late old cancellation changed new query, no-write canonical pass remained satisfied after live change | [integration-ownership-red.log](integration-ownership-red.log) |
| Ownership/lifecycle GREEN | `npm test -- test/aiRunOutcomeOwnership.test.ts test/aiRunOutcomeLifecycle.test.ts --maxWorkers 2 --minWorkers 1` | 0: 7 passed | [integration-lifecycle.log](integration-lifecycle.log) |
| Driver precedence RED | `npm test -- test/aiRunOutcomeLifecycle.test.ts -t 'driver user-wait' --maxWorkers 2 --minWorkers 1` | 1: actual awaiting-user driver decision became budget-exhausted; 5 cases runner-filtered only | [integration-driver-red.log](integration-driver-red.log) |
| Standalone app typecheck | `npm run typecheck:app` | 0 | [integration-typecheck.log](integration-typecheck.log) |
| Overloaded combined attempt | Final command below with workers 2/min 1 | Tool timeout at 360s, no npm exit captured; partial failures disclosed below, not GREEN | [integration-green.log](integration-green.log) |
| Complete final-source build | `npm run build` | 0: app typecheck, editor bundle, player/SDK and standalone bundle | [integration-build.log](integration-build.log) |
| Final serialized focused run | Exact command below | **0: 586 passed, 15 files, no failed/skipped tests; 507.39s** | [integration-final-green.log](integration-final-green.log) |

Final exact focused command:

```sh
npm test -- test/aiRunOutcome.test.ts test/aiRunOutcomeIntegration.test.ts test/aiRunOutcomeApply.test.ts test/aiRunOutcomeOwnership.test.ts test/aiRunOutcomeLifecycle.test.ts test/aiRequiredOutcomes.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts test/aiAssistantBridge.test.ts test/aiActivityLog.test.ts test/aiActivityLogIndex.test.ts test/runRecap.test.ts test/aiRunEndProof.test.ts test/aiTurnAppliedAccounting.test.ts test/aiApplyCommitCorrelation.test.ts --maxWorkers 1 --minWorkers 1
```

The timed-out combined attempt was real failure evidence, despite its initially chosen `integration-green.log` filename. It recorded five 15-second timeouts in existing `aiRunEndProof` cases and a later duplicate-count assertion failure. The process inspection showed no surviving matching owned test command, many unrelated full-suite workers, load averages about 193/204/144 on 32 cores, and nearly full 37GiB swap. No unrelated process was killed, no baseline test was changed, and no test timeout was raised. After completing the build, the **same source and assertions** passed the complete serial command above. This establishes final GREEN, not a claim to have repaired host contention or isolated the partial cascading failure.

New tests use actual sessions, native tools, canonical parsing and actual store/apply/flush/proof adapters. Only model transport is scripted in session tests; persistence unit/integration fixtures use a wire-level in-memory project row, not fabricated session proof or ledger snapshots. Async ownership tests arrange the exact transport callback/state transition, never sleeps or polling. Fake timers freeze unrelated autosave rather than advance time to force a pass. Teardown clears owned timers/mocks, restores env/globals, resets history and intent cache, and disables fixture persistence. No new prose/prompt assertions, casts, any, non-null assertions, suppressions or dependencies were added.

## Actual editor/API execution

Both unchanged full matrix executions used the registered real browser bridge, native session/tool/apply/store paths and real LegacyDb. Only LLM transport and the explicitly labeled commit-log transport fault were scripted. The first run preceded the later owner/driver hardening; the second binds the exact final source.

```sh
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/integration-api-probe xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario outcome-matrix
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/integration-api-final xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario outcome-matrix
```

Each process exited **1**, exclusively from 10 `visible UI typed outcome` checks (`actual: []`). Each has **138 passing backend/behavior checks**, no backend contract violation and no case execution error. Full unchanged assertions and failures remain in `actions.json` and raw command logs. The source-binding/explicit backend inventory command exited 0; it did not modify either scenario or claim the full scenario passed.

| Real case | Shared execution / goal / delivery |
| --- | --- |
| Query with a pre-existing foreign receipt | response-final / unassessed / no-change |
| Plan-only wait | awaiting-user / unassessed / no-change |
| Ordinary applied title and current remote proof | response-final / unassessed / persisted-verified |
| User abort after milestone save while proof GET is held | cancelled / unassessed / persisted |
| Live house protection rejects a stale ordinary draft | failed / unassessed / draft |
| Commit-log POST 503 while project persistence succeeds | response-final / unassessed / persisted-verified |
| Accepted save with real remote-content proof mismatch | response-final / unassessed / persisted |
| Tool budget exhaustion | budget-exhausted / unassessed / no-change |
| Bare legacy scheduler plan | response-final / unassessed / no-change |
| Existing explicit canonical acceptance | response-final / satisfied / no-change |

Agreement covers getter, harness, actual returned result, registered bridge harness/send response, serialized activity, returned recap, serialized activity recap and final typed event. Actual content, pending/applied calls and proof currentness remain part of the unchanged contracts.

Owned remote fixtures:

- First: `qa-ai-surface-34e39620-63d3-4b85-81d7-acb154ff1c9c`.
- Final: `qa-ai-surface-f43709da-1298-4d84-a8e0-9d1aa8530466`.

Both were absent before creation, positively ownership-checked, deleted, and proven absent with associated maps/tilesets/commits/changes. Both report browser/server/cache closure, released port, closed page listeners/timers, `activeRoutes:0` and no reused listener. Cleanup receipts and screenshots remain in their directories. Screenshots are evidence capture, not a claim of visual adjudication. Configured key-value scan passed for all integration text evidence; no credentials are included.

## Diagnostics, review and limits

- Every changed TypeScript file received LSP diagnostics. Final changed session and lifecycle test requests initially timed out at 3000ms during contention; subsequent fresh diagnostics returned no diagnostics. All other changed files returned no diagnostics. Markdown LSP is not configured; not credited as a validator.
- Final source/test and Markdown-only staged whitespace validation passed. The complete staged evidence check exited 2 solely for raw Vite/Vitest trailing spaces and final blank lines; those raw bytes were intentionally preserved rather than sanitized. Build warnings were retained: optional provider configuration, pre-existing circular/mixed chunks, unresolved forest image and chunk-size notices. No suppression or unrelated repair.
- Scope: only eight owned backend/glue source files and five direct test/fixture files. No requirement evaluator/ledger rewrite, model module change, store authority change, QA assertion change, UI styling/rendering, package/config change, wiki rewrite or hidden authorization tool.
- Single responsibilities remain session settlement, outcome serialization, bridge routing and actual-path contracts. The sole ledger and P1 receipt store still own authority. New normalized values are immutable; the result is explicitly a mutable session-owned settlement handle, not a second ledger.
- Stored outcome parsing is isolated at the existing recap input boundary; no unknown data crosses into runtime authority. Exact literal checks are parser validation, not model interpretation. New execution state assignments live at decision sites; no new incomplete tagged-union switch.
- No speculative defensive layer. Optional checks correspond to real legacy/missing values, late callbacks or receipt freshness. New methods have at most two arguments; existing large entrypoint signatures were preserved.
- Pure LOC after implementation: session 3953, activity 625, activity types 159, recap 215, bridge 251, panel registration file 2598, proposal host 329, runner 698; new tests/fixture 83/58/82/54/50. Recap is in the 200-250 warning band; split its parsing responsibility before a future substantive extension. The existing oversized integration owners (including bridge now 251) remain explicit technical debt: the phase's narrow ownership/no-redesign instruction overrides the generic skill's unrelated file-split rule. No fake SIZE_OK claim, line-packing workaround or broad restructuring was used.
- No helpers for hypothetical use; the private stored-outcome parser is a single boundary parser, and publication is reused by actual result/apply/proof/withdrawal seams. No destructive-operation re-query was added to product code. QA deletion absence checks are the explicitly required remote cleanup proof.
- Existing audit/log mechanisms are used; no logging framework or alternative persistence channel was added. Event/audit/result refresh is settlement, not a new requirement or persistence authority.

This node does **not** claim full P2 UI GREEN, user-click withdrawal/resume presentation, independent surface-node acceptance, a new P1 proof-failure browser run, full repository gates, external MCP transport verification or exact-head approval. Those remain the fixed downstream/lead responsibilities. The inherited producer REDs and all own RED/intermediate/final artifacts are preserved. No source change remains uncommitted after the verified implementation commit; this evidence-only handoff records the buildable backend result.
