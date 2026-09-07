# P2 source-backed characterization baseline

The existing focused contracts pass: **34/34 tests, two files, exit 0**. P2 itself is **not implemented or verified** at this baseline. Canonical acceptance already prevents a skipped execution plan from satisfying unmet promises; the missing work is requirement lifecycle/trust extensions and a shared typed execution/goal/delivery projection, not a second ledger.

## Scope and source binding

- Task: `st_01a0777d`, baseline-only node; approved plan items 3/4 and operating gate 12.
- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`; branch: `agent/ai-harness-p2-20260906`; no upstream configured.
- Inspected/tested HEAD: `e827eb5c8371ff87ea29231a124806f687c3aba2`; tree: `90e4dcaae23e36c148a79cacc2981cd26da00e32`.
- P1 merged commit: `58105616bb4b970f8012e43fc20498bbe9c9d11a`; tree: `0ef1046d14e7dc2c750ee635b72e373a7ff4ac13`.
- `git diff --name-status 0ef1046d HEAD` lists only `.omo/plans/ai-harness-omo-adoption.md`. This is source equivalence, **not whole-tree equality**.
- Equal subtree IDs at both revisions: `src` = `7cffd2bbcc3208e91510aec30a50a703a783b255`; `test` = `d3f153dbf7d1d2cf43067280d74a00b9ac90c722`; `scripts` = `b4422873b68cdc72c9687074550a0a23cf6cebac`.
- Source/test/script/package/config comparison exited 0; tracked worktree source comparison exited 0. Exact commands/results: [baseline-source.log](baseline-source.log).

Read authority: the complete lead `phase-p2.md`, root `AGENTS.md`, `openwiki/quickstart.md`, `openwiki/INDEX.md`, `openwiki/PROJECT_WIKI.md`, focused acceptance/AI workflow and editor-observability guidance, approved plan items, and actual source below. `INDEX.md`/`PROJECT_WIKI.md` are under `openwiki`, not the repository root. P1 authority artifacts referenced by the plan were read from their canonical shared evidence location; no shared-main file was edited.

## New execution in this node

```sh
cd /home/main/z-project/rpg-zzu-ai-harness-p2-20260906
npm test -- test/assistantVerificationEvidence.test.ts test/workItemOutcome.test.ts --maxWorkers 2 --minWorkers 1
```

**Exit 0**; Vitest 3.2.4; 34 passed, zero failed; reported duration 37.24s. One execution, no retry. Local npm/Vitest used the existing worktree `node_modules` symlink; no dependency install or configuration change.

| Existing suite | Result | What this execution establishes |
| --- | --- | --- |
| `assistantVerificationEvidence.test.ts` | 20 passed | Execution `ok:true` does not override explicit negative verdicts; failed rechecks revoke success; successful writes stale explicit checks; rejected writes do not; corrected invocations recover; advisory failures remain reports rather than blocking scheduler progress; different targets/key order and item-local versus goal evidence retain current contracts. |
| `workItemOutcome.test.ts` | 14 passed | Real `create_map` output remains unauthored until content changes; unrelated maps are excluded; automatic and explicit completion honor the supplied artifact gate; legacy behavior without a gate remains. |

Raw combined stdout/stderr is unmodified in [baseline-tests.log](baseline-tests.log), bounded to the actual 36 lines / 4,073 bytes. [Command](baseline-tests.command.txt) and [receipt](baseline-tests.receipt.json) bind execution, exit, counts and source. The shell captured npm's exit directly, not a pipeline's last command.

Limits: these are existing mixed unit/session/tool tests, not a new full-app E2E. The verification suite scripts the LLM, overrides selected verification tool results, and uses an in-memory apply boundary for advisory-layer cases. Existing test prose assertions/casts were neither extended nor repaired. No new behavior or prompt/prose tests belong to this node. There were no failures in this scoped run to repair or conceal; this is not a claim about the whole repository suite.

## Canonical P1 reuse: historical, not rerun

Let `E` be `/home/main/z-project/rpg-zzu/.omo/evidence/ai-harness-implementation`.
The original focused receipt/log and complete build receipt/log were inspected. Their hashes, plus the original Vitest JSON and approval/merge records, are pinned in [baseline-reused-p1.sha256](baseline-reused-p1.sha256). These external canonical artifacts are referenced, not copied or relabeled as P2 executions; the JSON report is hash-pinned, while the counts below were read from the raw default log and terminal receipt.

| Reused execution | Recorded identity and result |
| --- | --- |
| `E/p1-merge-3f7b89d6-focused.json`, `-focused.log`, `-focused-vitest.json` | Synthetic commit `7ee3e54e5e99bafcef880ae0dc4a7be327cb963f`, tree `0ef1046d14e7dc2c750ee635b72e373a7ff4ac13`, unchanged before/after. **202/202 tests, 13 files, exit 0**. Started `2026-09-06T15:07:44.744Z`, finished `2026-09-06T15:09:44.858Z`. |
| `E/p1-merge-3f7b89d6-build.json`, `-build.log` | Same synthetic commit/tree, unchanged before/after. **`npm run build`, exit 0**. Started `2026-09-06T15:07:46.672Z`, finished `2026-09-06T15:09:25.670Z`. Includes app typecheck, editor, player/SDK and standalone build. |

Original focused command (executed in the now-cleaned P1 merge-check worktree, **not here**):

```sh
npm test -- test/aiRunEndProof.test.ts test/storePersistenceProof.test.ts test/storePersistenceLineage.test.ts test/aiApplyCommitCorrelation.test.ts test/aiComposerModeSession.test.ts test/assistantAcceptance.test.ts test/assistantAcceptancePromiseBaseline.test.ts test/assistantAcceptanceRequestBaseline.test.ts test/assistantAcceptanceSession.test.ts test/assistantImageEvidence.test.ts test/proposalCompleteness.test.ts test/aiAssistantTurnCleanup.test.ts test/aiTurnAppliedAccounting.test.ts --maxWorkers 2 --minWorkers 1 --reporter default --reporter json --outputFile /home/main/z-project/rpg-zzu/.omo/evidence/ai-harness-implementation/p1-merge-3f7b89d6-focused-vitest.json
npm run build
```

This evidence is relevant because all tracked executable/test/build inputs are identical to the P1 merge tree. It covers the 61 owned persistence-proof cases plus canonical acceptance, per-promise/per-request baselines, shared images, composer modes, cleanup and applied-call accounting. In particular, the historical acceptance-session suite passed cases retaining the original denominator across skip/replan and refusing run-end proof for completed plans with unmet acceptance. **Do not classify existing explicit `acceptance` plans as unassessed merely because P2's `requirements` field is absent.**

Preserved limitations: the build log contains optional-provider-key, circular-chunk, mixed static/dynamic import, unresolved runtime-asset and chunk-size warnings. The P1 compatibility approval retains the separate exact-PR full gate's **exit 1**, legacy failures and unhandled-error-reporting limitation; that full gate was not a clean gate on this source and was not rerun here. Historical P1 editor/remote/probe results and their cleanup remain under their original approval; this node claims no fresh browser, remote, visual-quality or complete-gate proof. P1's final merge/approval is recorded in `E/p1-merge-receipt.json`; the earlier premature PR647 merge is not retroactively approved.

## Source characterization and reuse seams

Line references below are to the inspected HEAD, before downstream producer edits.

### Requirement authority already exists

- `src/ai/assistantAcceptance.ts:3-33,55-120`: canonical statuses are `pending | working | verifying | verified | blocked`; promises have `{id,title,criteria}`. Structural criteria cover dimensions, scoped map/event counts, target change, preservation, conservative reachability and image review. Unknown criterion fields/kinds or any malformed criterion fail the whole array closed to `null`; missing/malformed declarations produce repair obligations. Model-provided evidence is not accepted as evaluation authority.
- `src/ai/assistantAcceptanceLedger.ts:13-144`: one session-owned ledger, detached per-promise pre-request baselines, stable first unique new-map bindings, duplicate IDs cannot replace obligations. Repair only replaces malformed/missing criteria, not valid requirements. Actual applied state supplies evidence; changed unapplied target content remains verifying rather than verified. Snapshots are frozen. All existing promises participate in the denominator; optionality and withdrawal are not modeled yet.
- `src/ai/assistantSession.ts:1194-1254,1644-1658,1976-1999,2175-2178`: session owns adoption, refresh and request baselines independently of replacement WorkPlans. Canonical acceptance is consulted at response/continuation/proof boundaries (`:1548-1577,2605-2610,2762-2768,3574-3587`). Skipping an item is not permission to erase its retained canonical promise.
- `src/ai/assistantImageEvidence.ts:12-69` plus ledger `:79-119`: only captured, rendered/delivered receipts can cover exact clipped regions; current content fingerprints govern lifetime, and a later explicit passing review is required. Draft matching does not retire an otherwise current draft image against older applied state. Image review is not persistence or runtime-playthrough proof. Reuse this store; do not fork it.

### Scheduler completion is not whole-goal satisfaction

- `src/ai/workPlan.ts:34-76`: WorkItem has `doneWhen`, `successTools`, mutable status/note; WorkPlan already has optional `acceptance`. There is no `requirements` or `requirementIds` field.
- `workPlan.ts:724-834`: success-tool evidence and an optional artifact gate constrain automatic/explicit completion. `src/ai/workItemOutcome.ts` supplies artifact checks; session `:2276-2305` applies them to actual draft maps, target changes, boss phases, quests and NPCs.
- `workPlan.ts:869-883`: skip sets `status="skipped"`, advances scheduling, and `isWorkPlanComplete` accepts **done OR skipped**. Session skip (`:2245-2253`) reports scheduler progress only. This predicate is not proof of a satisfied goal.
- Bare scheduler plans with no canonical assessment have no whole-goal proof today. P2 must project them as `unassessed`; declared but malformed obligations must remain incomplete/repairable. Existing explicit acceptance remains assessed.

### Tool verdict reuse, without expanding advisory authority

- `src/ai/agentVerification.ts:35-39,246-310`: the registered verification family uses `parseToolVerdict` to distinguish execution success from negative checked-artifact verdicts. Reuse this parser; do not create a parallel verdict interpretation.
- `src/ai/toolVerificationEvidence.ts:3-56`: storage key is stable serialization of **tool name plus full args**. Successful corrected invocations supersede earlier execution failures; real negative verdicts remain target-bound. Successful writes stale explicit checks; automatic clean advisory checks do not create future required checks.
- Existing public `passed(name)` aggregates every stored target for that name; it does **not** answer whether one declared exact scope has a fresh explicit pass. No canonical tool-verdict criterion/query exists yet. P2 needs the narrow exact-scope seam on this store, not tool-name-only satisfaction or model-asserted `passed` flags.
- Session `:2264-2274,2330-2369` separates item evidence from goal evidence, resets item-local evidence on item change, and uses real results for explicit success; advisory observation returns before success credit. Preserve that distinction.

### Existing ask-reactivation and request-retention gaps

These are **source-backed gaps, not a new failing runtime reproduction**:

1. `executeUserTurn` sets composer/driver flags, then at `assistantSession.ts:1625-1638` every non-driver message clears Ralph attempts, block reasons and repeated-tool failures and calls `reactivateBlockedWorkItems`.
2. Only afterwards (`:1642`) is intent declared and ask mode applied. `workPlan.ts:856-866` changes blocked items to pending and activates the first one. Therefore a genuine question, including explicit ask mode, can mutate blocked scheduling/retry state before being recognized as a question.
3. `assistantSession.ts:1649-1667` also resets acceptance repair attempts, resumes the ledger and clears verification evidence for non-continuation requests. `:1683-1694` resets item evidence/pending proposals for non-continuations. Questions do not yet have the P2 evidence-preservation contract. Synthetic driver continuation already bypasses the early reactivation reset; it is not new user authorization.
4. `:1650-1654` lets non-continuation `intent.resetsContext` clear images and the entire acceptance ledger. Runtime-owned original request/scope provenance, archived-incomplete goals and a narrow user-only withdrawal API do not exist. P2 must move reactivation behind actual intent and preserve obligations/history; model reset/skip/note claims cannot authorize withdrawal.

The historical composer-mode tests establish ask's write refusal and plan behavior, **not** preservation of blocked-item retry counters or the new withdrawal contract.

### Existing result consumers and P1 authority

| Surface | Existing source contract / P2 gap |
| --- | --- |
| Session result/events/harness | `assistantSession.ts:233-309`: `TurnResult.stoppedReason` is `final \| max-tool-calls \| token-budget \| error \| aborted`; separate proposed/applied call arrays, workPlan, recap; acceptance and persistence events. `getHarnessSnapshot` (`:1458-1467`) exposes live proof, not a typed outcome. No `getRunOutcome`, `runOutcome` or `run_outcome` event. |
| Recap | `src/ai/runRecap.ts:23-34,107-126,140-163`: token/process/stoppedReason accounting, not execution/goal/delivery authority. Session creates it before ordinary runner apply (`assistantSession.ts:2754-2790`). |
| Ordinary apply | `src/editor/panels/aiTurnRunner.ts:462-543`: accounts both call collections, discards pending work on abort without undoing applied milestones, replays only pending calls, awaits actual apply response, then calls `proveAppliedRevision` and rechecks ownership. P2 must settle the same result/recap here before publication. |
| Activity | `src/ai/activityLogTypes.ts:23-58,74-104` defines `AiActivityResult`/`AiActivityLogRecord`, with optional legacy accounting fields. Runner `:676-716` supplies result/recap; `src/ai/activityLog.ts:425-441` explicitly constructs serialized result and currently does not forward recap. New outcome fields must reach actual serialization, not merely the input type. No outcome field exists today. |
| Bridge | `src/editor/aiAssistantBridge.ts:31-55,80-83,145-157`: result has status/audit/unknown harness, and commands are send/status/audit/harness/abort. No typed outcome or user withdrawal entry point. |
| Persistence | `assistantSession.ts:2605-2697`: `recordAppliedProject`, currentness-checked `getRunEndProof`, and shared retryable `proveAppliedRevision` use actual `store.flush().receipt` and `store.verifyPersistedRevision`. Receipt freshness and attempt ownership are rechecked before success. Commit metadata is optional and separate; a commit-log failure does not imply project-save failure. Existing receipt/proof authority must remain the only source of delivery persistence facts. |

## Missing P2 API/scenario inventory

The source search in [baseline-source.log](baseline-source.log) returned **exit 1 / no matches**, not a passing behavior check. `git ls-files` returned no requested new module/test paths. The existing QA parser at `scripts/qa/ai-harness-contracts.mjs:15-16` accepts only `proof-failure`; it was not invoked with unsupported scenarios just to manufacture RED.

| Required contract | Baseline status |
| --- | --- |
| WorkPlan requirements, item requirement IDs, required-default-true, optional skip, runtime source provenance, stable history and genuine user withdrawal | **Missing**. Existing canonical acceptance is the reuse point, not a replacement target. |
| Exact-scope tool-verdict criterion/query with existing lifetime/advisory semantics | **Missing**. Name-only `passed` is insufficient. |
| `src/ai/runOutcome.ts`, exported `RunOutcome`/`deriveRunOutcome` | **Missing**. |
| All six execution states, three goal states, five delivery states as independent typed facts | **Missing**. No current prose/status inference is credited. |
| Same projection across TurnResult/getter/harness/event/bridge/activity/recap and real apply settlement | **Missing**. |
| `[data-testid="ai-run-outcome"]` with execution/goal/delivery attributes; scoped user-only `[data-testid="ai-requirement-withdraw"]` | **Missing**. No UI pass. |
| `required-skip` real editor scenario (required vs optional, remaining content, replan retention, actual user withdrawal) | **Missing/not run**. Historical canonical skip tests are not this P2 scenario. |
| `outcome-matrix` real editor/remote agreement (query, awaiting user, cancelled/applied, apply refusal, commit-log failure, failed proof) | **Missing/not run**. P1 proof cases cover underlying authority, not the new projection. |
| `test/aiRequiredOutcomes.test.ts`, `test/aiRunOutcome.test.ts` | **Missing** at baseline. No fabricated RED or new behavior test added here. |

The fixed producer contract projects normalized owner-supplied facts only: null assessment -> unassessed, verified canonical assessment -> satisfied, other assessed states -> incomplete. Delivery precedence is pending draft -> draft; else no applied run work -> no-change; else current verified proof -> persisted-verified; accepted persistence -> persisted; otherwise applied. Prior/global receipts, model flags, tool names and `commit.persisted` cannot supply run-owned authority. These are **required future semantics**, not baseline passes.

## Delivery, cleanup and limitations

This node writes only `output/evidence/ai-harness/p2`: this report, the new test command/receipt/raw log, source-check raw log, and P1 hash manifest. One evidence-only commit on the current P2 branch is authorized; its SHA is supplied in the task handoff (a commit cannot contain its own final hash). Prior ordered lineage is P1 merge `58105616b` -> bootstrap `e827eb5c8` -> baseline evidence commit.

Evidence validation: `sha256sum --check output/evidence/ai-harness/p2/baseline-reused-p1.sha256` exited 0 for all seven original artifacts. Full staged whitespace check exited **2** solely for `baseline-tests.log:36: new blank line at EOF`; the raw Vitest output is intentionally retained byte-for-byte, not sanitized. The check on the other five evidence files exited 0. Markdown LSP diagnostics were unavailable (no `.md` server configured), not passed. All six evidence files measure below 200 nonblank/noncomment lines; no product code was authored, so code architecture/type/variant/logging changes and new behavior tests are not applicable.

No source/test/manifest/wiki changes, dependencies, DB content, browser/server/listener/route resources, new worktrees, merges, nested agents, pushes or full gates were created by this node. The synchronous scoped test process returned exit 0. Existing shared dependency/cache resources were not removed. Canonical P1 evidence was read only; historical cleanup remains its own receipt, not a fresh service/port check.

This baseline is input to the three producers, not P2 completion or exact-head approval. Requirements owns lifecycle/authority extensions; outcome-model owns only pure projection; QA owns failing-first real-surface contracts. Each behavior producer must obtain its own faithful RED and final GREEN. The lead retains full gates, integration, exact-head ultrabrain approval and delivery authority. No unrelated baseline repair or redesign is authorized by these findings.
