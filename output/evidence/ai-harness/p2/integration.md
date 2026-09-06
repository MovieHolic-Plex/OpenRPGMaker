# P2 backend outcome integration

Integrated the producer contracts through the actual session, ordinary/milestone apply, P1 proof, bridge, activity serialization and recap paths. Final scoped verification is **586/586 tests in 15 files, exit 0**, and the complete build is **exit 0**. The unchanged actual browser/API matrix passes **all 138 non-UI checks** across ten real cases. Its overall exit remains **1 solely for the ten missing UI outcome hooks**, which are explicitly owned by the next node. No assertions were removed or weakened to call that full scenario GREEN.

## Scope and committed identity

- Task `st_01a077c3`, integration node, approved plan items 3/4/12 only.
- Sole writable worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`; branch `agent/ai-harness-p2-20260906`.
- Entry HEAD: `d6a38018c4dfb8642d46a5b94b3f1bbcb7d888bc`, clean working tree/index. No upstream configured (lookup exit 128).
- Read full phase contract, requirements producer handoff, outcome and QA handoffs, AGENTS, OpenWiki quickstart/INDEX/PROJECT_WIKI, focused AI acceptance/workflow, editor routing and observability guidance before source edits. Read TypeScript/logging/refactor references. Project-specific npm/Vitest/native transport/custom-parser constraints took precedence over generic skill defaults.
- **Verified implementation commit:** `f4ae6118e5e44fe8f3d29727fb6fd15f1a75cd66` (`feat(ai): settle shared run outcomes through apply and publication`).
- Implementation tree `361db44a8b5ded766c9f83ae5e166e9839fbdec5`; `src` subtree `08297f34362bd6aae3b83f7943ab3cd811d98938`; `test` subtree `771efdeadcd0dfc850bb9ec61fc5551780095cb5`.
- Final tests, complete build and final actual API execution all ran against the exact source/test bytes committed there. No source/test edit followed those executions. The final API report's pre-commit HEAD is correctly retained rather than rewritten; its 16 source/harness hashes all match the implementation commit, verified in [integration-api-binding.log](integration-api-binding.log).
- This report/evidence commit follows the implementation commit and contains only `output/evidence/ai-harness/p2/integration*`. Its own final SHA is in the task handoff because a commit cannot embed its own SHA.

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
| 10 | own | task handoff SHA | This report and raw integration evidence |

Final terminal producer heads still equal the two named terminal SHAs. `git diff 7f42772c9 HEAD -- src/ai/runOutcome.ts test/aiRunOutcome.test.ts`, `git diff 8f82a11b9 HEAD -- scripts/qa`, and the diff against `d6a38018c` for the canonical acceptance types/ledger/tool-verification authority were empty. All imported commits and own commits retain mandatory omo attribution. No push, merge, rebase, nested agent or shared-main worktree edit occurred.

## Backend contract and ownership map

### One outcome projection

`src/ai/runOutcome.ts` remains byte-for-byte producer code (SHA-256 `b5c44e295d3de495a728a33c9f122babe81ee47b61f31dc848234348ef35fa7f`). Every runtime outcome is derived by its `deriveRunOutcome`; no consumer evaluates requirements or parses model claims into an outcome.

The session captures execution at the actual decision sites: final response, clarification/plan-only wait, stalled/required-blocked work, transport failure, cancellation, token/tool budget, driver budget and pending-user yield. Legacy `stoppedReason` values remain unchanged. In particular, a driver can yield to a pending user after an inner `max-tool-calls` return; its later `awaiting-user` decision is not overwritten by reconstructing execution from that legacy string.

The canonical `AssistantAcceptanceLedger` remains the only requirement-satisfaction authority. The session reads its assessed status; null remains unassessed. A store-backed getter checks whether the applied revision underlying a retained canonical pass still matches the live project. A stale pass is conservatively projected as incomplete until the existing canonical refresh evaluates it. This is freshness invalidation, not a second requirement evaluator or a mutation of the stored snapshot. It may conservatively downgrade an unrelated unrefreshed edit; normal editor store subscriptions already perform canonical refresh.

### Actual application and P1 proof

`recordAppliedProject(actualSuccess)` now transfers the pending call collection into the existing applied-call ledger at the real successful apply boundary, retaining both collections when later drafts are produced. Milestones no longer separately double-add those calls. The runner captures its pending array before application because successful settlement changes the returned result's pending collection; applied accounting and blueprint settlement still use the actual applied calls, not an emptied array.

`recordApplyRejected(onEvent?)` captures failed execution without rewriting `stoppedReason` or discarding the draft. Both actual proposal-host rejection and runner settlement use it. Ordinary successful apply still follows the existing host rebase and `proveAppliedRevision` path; no approval, auto-apply, undo, house guard, region approval or advisory behavior was changed.

Only an actual P1 flush receipt correlated to the current run's actual `commitProject` can become this run's accepted persistence fact. Commit-log `persisted`, newest/global receipts, model flags and status text cannot grant it. A passing proof must also refer to that receipt and remain current to project `persisted-verified`; stale or failed proof preserves accepted `persisted`, not verified. No-write new user runs clear delivery ownership. The mutable returned-result holder gives an in-flight proof an actual publication owner: an old proof cannot cancel or settle a newer query. P1 proof's existing overlapping-attempt guards and store authority are preserved.

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

Both unchanged full matrix executions used the registered real browser bridge, native session/tool/apply/store paths and real Supabase. Only LLM transport and the explicitly labeled commit-log transport fault were scripted. The first run preceded the later owner/driver hardening; the second binds the exact final source.

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
