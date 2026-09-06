# P2 canonical requirements and question-safe continuation

Implemented and committed the complete requirement authority producer, including all review corrections. Latest actual validation passed **124/124 tests in eight files**, app typechecking passed, and the complete build passed. Those executions were reused for final Git delivery because source/test contents did not change afterwards; no tests or build were rerun merely to finish Git. This is backend/session proof, not integrated UI, bridge, outcome-projection, remote persistence or final P2 approval.

## Source and ownership

- Task: `st_01a07785`; approved items 3/4/12; requirements producer.
- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`.
- Branch: `agent/ai-harness-p2-20260906`; no upstream configured.
- Input baseline: `3fc590429a74fe2f77fd6c3ab6d83d61a7822ab3`.
- Initial implementation: `a258dfaad4fc3eb763c09e93fb251b152bab4901`; tree `92873d269097d96f31e8245248ea32ca3d1d41d4`.
- Initial evidence commit: `9e01ca0525866ddfc262cfbe3e073a894c6c172b`.
- **Final verified source commit: `c6de2da052373e80aea9f5ec7d7293a64f178df4`.** It contains every reviewed question-dispatch, fixture/link-independence, cost and original-utterance correction.
- Final source commit tree: `0c482e42eb90003942e5c4fee3d4bc314474b752`.
- Exact source subtree: `43fe80b4887cbb0318bec3218303164b2f10443d`; exact test subtree: `3f72a957c064f897baf4535ae167d70e263384e3`.
- The latest 124-test/typecheck/build commands ran against the exact source/test contents subsequently committed above. No source/test edits followed those executions. The final report/evidence commit changes only `output/evidence/ai-harness/p2`; its SHA is in the handoff.
- Read the complete lead phase contract, `baseline.md`, AGENTS, quickstart, INDEX navigation, PROJECT_WIKI, focused AI acceptance and editor-observability/routing guidance before source edits.
- Eleven changed source/test files across the complete producer: acceptance types/parser, ledger, evaluation, tool schema, exact verification query, WorkPlan, requirement/ask/resume session regions, and four new test/fixture files. No dependencies, manifests, result/proof projection, UI, bridge, activity log, recap, QA scripts, nested agents, full gates, merges or pushes.

## Canonical APIs for integration/UI

### Definitions and denominator

`WorkPlan.requirements?: readonly AcceptancePromise[]` and `WorkItem.requirementIds?: readonly string[]` are supported by both the planner parser/materializer and real `set_work_plan` dispatch. The declaration shape is `{ id, title, required?, criteria }`; omitted `required` becomes true. Existing explicit `acceptance` is still assessed, and both fields feed the **same** `AssistantAcceptanceLedger`. If both fields reuse one ID, the legacy acceptance definition is adopted first; later duplicate IDs cannot weaken it. Requirement authority does not depend on item links: unlinked declarations are adopted, and replans dropping both links and declarations cannot erase retained obligations. Bare legacy fixtures now explicitly omit both new fields; legacy explicit acceptance requires neither.

Aggregate `AcceptanceStatus` is unchanged: `pending | working | verifying | verified | blocked`. Only active required items participate in its denominator. A nonempty assessed contract with no active required items is aggregate `verified`; that does **not** verify an optional or withdrawn item. Individual status/evidence remains independently evaluated. A skipped required item remains open. A skipped optional item may remain `working` with `passed:false` while the aggregate is `verified`.

Malformed/empty declarations fail closed as repair obligations. Malformed criteria or a malformed required flag cannot activate optionality: they remain required until genuinely repaired/satisfied or explicitly withdrawn. `repair_acceptance` still cannot replace valid original criteria. Bare legacy scheduler plans without an assessed/inferred spatial contract remain `null`/unassessed; the existing inferred missing-spatial-contract repair baseline is preserved.

`session.getAcceptanceSnapshot(): AcceptanceSnapshot | null` remains the canonical current assessment API. `refreshAcceptance(project, onEvent?)` is the existing applied-state/undo refresh; integration must keep routing real applied-state changes through it. Do not use scheduling completion as goal satisfaction. Outcome integration should project `null -> unassessed`, aggregate `verified -> satisfied`, every other aggregate assessed status -> incomplete; it must not recompute optionality/withdrawal from the WorkPlan.

### Host-owned provenance

Every newly adopted canonical item has metadata:

```ts
source: {
  requestId: string;
  text: string;
  scope: {
    mapId: string;
    region: { x: number; y: number; width: number; height: number };
  } | null;
}
```

The session supplies the normalized original user instruction, `(options.instruction ?? stripContextFooter(text)).trim()`, and host `SessionTurnOptions.scope` before planning/tools; the request ID is session-local. Transport wrappers and synthesized editor footer facts are not attributed to the user. Scope remains separate metadata. The ledger freezes the detached source metadata. Original source, criteria, per-request pre-write baseline and new-map binding survive skip, replan and repair. Model-supplied source, withdrawal, evidence and passed fields confer no authority. Metadata fields are optional in the public snapshot type for existing manually constructed/legacy consumers; current ledger snapshots populate `required` and `source`.

### Implemented user-only withdrawal (not deferred)

```ts
session.withdrawRequirement(
  { acceptanceId: snapshot.id, requirementId: item.id, reason: userReason },
  onEvent?,
): boolean
```

This is an actual synchronous session API backed by the sole ledger, not a planned UI contract. It requires the current acceptance ID, an existing requirement, a nonempty reason and an item not already withdrawn. It returns false for a stale goal ID, missing item, repeated withdrawal or blank reason. Success publishes the usual `acceptance` event when a callback is supplied.

The canonical item's withdrawal metadata is `{ acceptanceId, requirementId, reason, source: "user" }`. The original source and observed evidence are retained; neither `required` nor `status` is rewritten to pretend the item passed. Sibling requirements remain in the denominator. There is deliberately **no** `withdraw_requirement` LLM tool, schema or dispatcher path. A fabricated tool invocation with `source:"user"` cannot trigger the API.

The integration/UI caller owns the real click/bridge-user-action boundary and existing session-owner guards. Pass the displayed snapshot ID and item ID from that actual user action; never call this API on model output or an inferred `resetsContext`. This producer did not add UI or bridge routing.

### Explicit continuation and goal history

`sendUserMessage(text, onEvent?, signal?, { goalAction: "resume" | "new-goal", ... })` carries a host-only action. It is forwarded through the public entry point, not parsed from model data.

- `resume` resets stalled-item/Ralph/repeated-failure and acceptance/adventure repair counters, resumes the current ledger, and reactivates blocked work. Existing exact manual continuation tokens such as `continue` and `계속` also authorize resume after the real intent decision.
- Questions, including explicit composer ask and declared question intent in do mode, use the question path and preserve blocked items, retry counters, request baselines and relevant goal evidence. Declared questions do not enter the autonomous driver. Direct mutation tools and secondary scheduling/failure paths remain blocked: attempted skip/complete/replan/acceptance repair/review/reset cannot reactivate work or rewrite counters. Read-only WorkPlan and project inspection remain allowed across model rounds.
- Model `source:"continuation"` alone is not resume authorization. Synthetic driver continuation cannot use a carried host action to reactivate work or start a new goal.
- `new-goal` archives the current immutable acceptance snapshot before resetting the active goal. It does not withdraw or satisfy the prior goal. Model `resetsContext` alone cannot erase that ledger.
- `session.getAcceptanceHistory(): readonly AcceptanceSnapshot[]` returns a frozen array of archived snapshots. This is historical evidence, not another mutable requirement ledger. Incomplete history remains incomplete. History is session-owned/in-memory; no project/history-storage migration is claimed.
- Ask mode overrides goal actions: a question cannot incidentally resume or replace its goal.

### Exact verification criterion

```ts
{ kind: "toolVerdict", tool: "check_reachability", args: {
  mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }]
} }
```

`tool` must be in the existing verification tool family; `args` is the full native invocation object, not just a tool name. `ToolVerificationEvidence.passedScope(tool, args)` reuses stable full-argument keys and `parseToolVerdict`. Only a current explicit host-observed passing result supplies canonical proof. Wrong targets, negative verdicts, model claims, advisory-only results and stale checks do not pass. A clean advisory check may preserve an already-current explicit pass but cannot renew one after a write.

The session passes its existing goal evidence store into `AssistantAcceptanceLedger.evaluate(applied, draft, verification?)`; callers that supply no evidence fail closed for tool verdicts. Successful writes retire prior checks. Applied-state refresh/rebase retires checks after content changes, including checks recorded **before** the requirement was declared; undo does not revive them. An unapplied draft cannot become satisfied from a passing tool verdict. Existing name-level scheduler/advisory APIs retain their prior behavior. `ToolVerificationEvidence.hasChecks(): boolean` is a constant-time query on the existing storage: absent acceptance and checks skip refresh fingerprints/cloning while retaining image maintenance. With tool-verdict promises, full applied/draft project comparison occurs once per evaluation and not at all for identical references; detached same-content refreshes preserve valid proof.

## Complete follow-up record

All four correction reports are committed with their original RED and intermediate results. Their statements about uncommitted work describe the time of each experiment; the final source commit above supersedes that delivery status without rewriting the historical evidence.

| Follow-up | Report and retained evidence | Result at that checkpoint |
| --- | --- | --- |
| Native fixture correction | [Correction log](requirements-fixture-correction.log); `check_reachability` uses `targets`, not `to` | 35/35, exit 0 |
| Adversarial question dispatch | [Question-dispatch report](requirements-question-dispatch.md), including fixture-precondition RED, faithful dispatch/read RED, GREEN, typecheck and build logs | 114/114, typecheck/build exit 0 |
| Bare legacy and unlinked requirements | [Link-independence report](requirements-link-independence.md), including fixture-fidelity RED and GREEN | 116/116, exit 0 |
| Bounded comparison/refresh cost | [Cost report](requirements-cost.md), including deterministic count RED, GREEN, typecheck and build logs | 122/122, typecheck/build exit 0 |
| Original user utterance | [Original-utterance report](requirements-source-utterance.md), including provenance RED and final GREEN/typecheck/build logs | **124/124, typecheck/build exit 0** |

Latest source-bound raw evidence: [124-test log](requirements-source-utterance-green.log), [app typecheck](requirements-source-utterance-typecheck.log), [complete build](requirements-source-utterance-build.log). All earlier `requirements*.log` artifacts below and in the linked reports remain byte-for-byte preserved.

## Executed verification and preserved RED

All commands ran from the named P2 worktree using its npm/Vitest installation. Each shell redirected stdout/stderr, captured npm's exit immediately, printed it and exited with it; no pipeline exit was credited.

Latest actual commands, all exit 0 (tests: 124 passed, eight files, 50.13s):

```sh
npm test -- test/assistantAcceptanceCost.test.ts test/aiRequiredQuestionDispatch.test.ts test/aiRequiredOutcomes.test.ts test/assistantVerificationEvidence.test.ts test/workItemOutcome.test.ts test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts test/assistantAcceptanceRequestBaseline.test.ts --maxWorkers 2 --minWorkers 1
npm run typecheck:app
npm run build
```

The following initial implementation chronology is preserved as historical evidence; it is superseded by the final source-bound executions linked above.

| Execution | Exit | Raw evidence / result |
| --- | --- | --- |
| Initial new test file, before source edits | 1 | `requirements-red.log`: 21 failed / 5 passed. Includes one wrong native test argument (`to` instead of `targets`); not credited as product RED. Retained unmodified. |
| Corrected contract tests, still before source edits | 1 | `requirements-red-contracts.log`: 23 failed / 3 passed. Native check succeeds but canonical requirements are missing; required/optional/metadata/parser/withdrawal/history/verdict and both question paths fail. Legacy compatibility and explicit resume controls pass. |
| First required six-file command | 1 | `requirements-green-attempt.log`: 100 passed / 1 failed. Remaining declared-question fixture reused the process-wide intent cache from another case; explicit before/after cache cleanup fixed test isolation, not production behavior. |
| Added malformed-optional and advisory-preservation edge tests | 1 | `requirements-edge-red.log`: 29 passed / 2 failed, proving both edge defects before their source corrections. |
| Six-file run after edge fixes | 0 | `requirements-green.log`: 109 passed. `requirements-typecheck-final.log` and `requirements-build.log` also exited 0 for this intermediate source. |
| New pre-declaration stale-evidence regression | 1 | `requirements-late-evidence-red.log`: expected blocked, received verified. Command: `npm test -- test/aiRequiredOutcomes.test.ts -t 'pre-declaration' --maxWorkers 2 --minWorkers 1`. The other cases are runner-filtered here only, not skipped in source/final verification. |
| Initial completed six-file command | **0** | **`requirements-final-tests.log`: 110 passed, six files; 83.63s**. New file contributes 35 cases. |
| Initial completed app typecheck | **0** | **`requirements-final-typecheck.log`**. |
| Initial completed build | **0** | **`requirements-final-build.log`**: app typecheck, editor Vite, player/SDK, standalone bundle. |

During final packaging, fresh LSP diagnostics on all seven follow-up source/test files reported no diagnostics; the complete staged source/test diff and scope were inspected, and its whitespace check exited 0. The earlier original-utterance session LSP request timed out after 3000ms: that timeout remains disclosed and was not counted as a pass. Actual app typecheck/build succeeded at that checkpoint. Markdown diagnostics are unavailable because no `.md` language server is configured. Source/test identity is pinned above and rechecked across the evidence-only commit; no validation command was rerun solely for Git delivery. The initial unsuccessful `apply_patch` lookup exited 127 before any edit; all source edits used the provided exact file-edit tool instead.

The complete staged evidence whitespace check exited **2**, solely for raw Vite/Vitest trailing spaces and final blank lines. Those original bytes were deliberately retained, not sanitized; source/test and Markdown-only staged whitespace checks exited **0**. All **34** `requirements*` artifacts on disk are present in the index, including every original RED and intermediate result. No existing raw requirements log was modified.

Build warnings remain visible: absent optional provider keys, pre-existing circular record-picker chunks, mixed static/dynamic imports, unresolved runtime forest PNG and chunk-size notices. These warning classes are already characterized by the baseline; none was suppressed or repaired out of scope.

## Actual entry-point proof and limits

`test/requiredOutcomeFixture.ts` replaces only chat/intent LLM transports. New session tests invoke real `AssistantSession.sendUserMessage`, native WorkPlan normalization/dispatch, skip, failed writes, `check_reachability`, canonical evaluation, applied-state refresh/rebase, host withdrawal and explicit continuation. They use the real blank-project fixture and actual registered tools; there is no fake ledger, fake acceptance snapshot, fake store proof or fabricated verification response in these session cases. Unit verdict matrix cases intentionally feed the evidence-store API directly to distinguish exact source/lifetime semantics.

Observable session evidence includes scheduler `skipped` while required assessment stays blocked, optional `passed:false` while the required denominator clears, real native reachability `ok:true` producing assessment, original blocked snapshots retained after ask/new-goal, scoped withdrawal leaving a sibling blocked, failure counters retained during ask, and an in-progress work-plan event only after explicit resume. Tests subscribe by installing event collectors before actions; no sleeps/polling/time-luck waits were added. New tests assert machine values, not prompt prose. Intent-cache cleanup runs before and after each new case.

Existing focused suites additionally exercise applied resize/undo, request baselines, synthetic/manual continuation baselines, shared image evidence and P1 persistence-proof exclusion while acceptance is open. Their existing adapter fakes are unchanged. No fresh browser/UI/remote DB proof, full gate, P1 full proof-suite rerun or exact-head reviewer approval is claimed. Those belong to the downstream nodes/lead under the fixed phase contract.

## Post-write architecture review

1. One authority: the existing ledger owns active requirement satisfaction; archived immutable snapshots are not a second ledger. Parser, evaluation, schemas and verification query retain their existing responsibilities.
2. Boundary purity: existing custom structural parsing is reused, without dependencies. Native verification args stay an opaque typed record for exact-key matching; real tool parsers validate execution inputs. Host source/action metadata never comes from model declarations.
3. Variant discrimination: new typed criterion dispatch is exhaustive with `assertNever`; parser rejection remains fail-closed.
4. Escape hatches: no new `any`, casts, non-null assertions, suppression or ignored errors.
5. No speculative defensive layer; runtime checks are parser/host-action boundary checks or existing optional evidence contracts.
6. The only added session adoption helper serves all three existing planner/fallback/tool callers.
7. RED and final GREEN above lock the introduced authority behavior; legacy acceptance/image/request-baseline cases remain green.
8. New public methods take at most three parameters. Existing session entry points, ledger constructor and tool observation signatures were preserved rather than redesigned.
9. No redundant destructive-operation verification was added.
10. New names describe positive facts/actions (`required`, `source`, `withdrawal`, `startsGoal`, `resumesGoal`, `passedScope`).
11. Existing audit reactivation reporting moved with its decision; no logging framework, log projection or new logging surface was added.

Measured nonblank/noncomment LOC: acceptance 141, ledger 158, schemas 30, evaluation 120, verification 56, fixture 42, requirement suite 228, question-dispatch suite 59, cost suite 49. The requirement suite is in the 200-250 warning band: split its authority and continuation groups before adding more cases. Existing `workPlan.ts` (873) and `assistantSession.ts` (3840) remain oversized; the explicit phase scope forbids the unrelated structural split that a generic size rule would otherwise request. The refactor reference was read; no scope-expanding restructure or size-exemption fiction was introduced.

## Cleanup and handoff

No servers, browsers, routes, ports, remote fixtures, new worktrees or nested workers were created. Synchronous test/build processes returned their recorded exits. Build artifacts remain in the worktree's normal ignored `dist`; shared dependencies/caches were not removed. The initial source commit and final seven-file source/test correction commit contain only authorized code/tests. All follow-up reports plus every original/intermediate/final requirements log are committed under this evidence directory; the primary report links the complete chronology. Historical reports retain their original then-uncommitted status notes rather than fabricating earlier commits. Final Git handoff checks the complete staged evidence scope, preserved artifact coverage, unchanged source/test subtrees and clean working status. No push or merge occurred; the lead still owns integration, complete gates and approval.
