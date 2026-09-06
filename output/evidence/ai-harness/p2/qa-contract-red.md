# P2 real-surface contracts: old-source RED

Follow-up: [actual user resume after Ask](qa-user-actions-red.md) adds a fifth required-skip lifecycle case and records real premature reactivation plus the missing existing continue control. The original execution records below remain unchanged.

The executable `required-skip` and `outcome-matrix` scenarios are delivered. The final owned-port sequence produced **P1 GREEN (exit 0), required-skip RED (exit 1), and outcome-matrix RED (exit 1)**. These REDs follow actual editor execution; no missing outcome was replaced by a fake value. P2 implementation/GREEN remains integration-owned.

## Scope and source binding

- Task: `st_01a07787`, QA producer, approved plan items 3/4/12 only.
- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-qa-20260906`; branch: `agent/ai-harness-p2-qa-20260906`; no upstream configured.
- Execution HEAD: `e827eb5c8371ff87ea29231a124806f687c3aba2`; HEAD tree: `90e4dcaae23e36c148a79cacc2981cd26da00e32`; unchanged `src` subtree: `7cffd2bbcc3208e91510aec30a50a703a783b255`.
- Harness commit: `0d3793b45` (`test(ai): add P2 real-surface outcome contracts`). It contains only seven `scripts/qa` files. The executions preceded this commit; each final `actions.json.sourceHashes` binds the exact committed harness bytes plus eight relevant source files. All 45 final hash comparisons passed after execution. This is not a claim that a dirty execution HEAD already contained the new scripts.
- `git diff --exit-code HEAD -- src test package.json` exited 0 before the harness commit. No product/test/design/wiki/manifest/dependency changes, other-worktree writes, nested agents, full gates, merges or pushes were made.
- Read the complete phase contract, baseline report, root AGENTS, OpenWiki quickstart/INDEX/PROJECT_WIKI, focused AI acceptance/workflow and editor-observability guidance, and the actual session, bridge, runner, activity, parser, store/protection paths. `INDEX.md` and `PROJECT_WIKI.md` live under `openwiki`, not the root.

## Final commands and raw evidence

Working directory for every command below is the QA worktree above. Commands were sequential, never concurrent on `QA_PORT=37025`. `xvfb-run -a` owns a separate display for headed Firefox on this Linux worker.

```sh
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/verified-proof-failure xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario proof-failure
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/verified-required-skip xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario required-skip
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/verified-outcome-matrix xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario outcome-matrix
```

Each linked directory contains exact `command.txt`, captured process `exit-code.txt`, unmodified combined `command.log`, `server.log`, `actions.json`, and PNGs. The shell captured the executable's exit directly, not a pipe's exit. The enclosing sequential driver exited normally after retaining all three individual exits.

| Scenario | Exit | Actual result | Final fixture project ID |
| --- | --- | --- | --- |
| [proof-failure](verified-proof-failure/actions.json) | 0 | Original assertions GREEN: remote mismatch fails; same-revision retry succeeds without replay; newer live edit remains untouched/stale; latest revision verifies | `qa-ai-surface-cfb5d702-d23b-409f-960f-b4f37c4bc417` |
| [required-skip](verified-required-skip/actions.json) | 1 | Four real session executions; 57 checks, 45 contract violations, plus missing user-withdrawal control assertion | `qa-ai-surface-9e074aef-0549-491e-b069-c5eb9290c89d` |
| [outcome-matrix](verified-outcome-matrix/actions.json) | 1 | All ten cases finish real actions; 148 checks, 38 pass, 110 missing typed-surface violations; zero case execution failures | `qa-ai-surface-ab6f743b-29d2-40f1-9f51-418d8cde5d43` |

### Actual violated assertions

The first required-skip contract failure occurs **after** successful real `set_work_plan` and `skip_work_item`, an observed skipped scheduler item, terminal activity serialization and remaining zero map events:

```text
required-skip: getRunOutcome exists after execution
false !== true
```

The raw checks also compare missing getter/harness/TurnResult/bridge/activity/recap/event values against `{ execution: "blocked", goal: "incomplete", delivery: "no-change" }`. `acceptance` is actually null on this old source; the canonical-retention assertion fails rather than manufacturing a requirement snapshot. The later user case records:

```text
user-withdrawal: genuine user withdrawal control exists
0 !== 1
```

That assertion is an immediate count check on the exact scoped UI hook after real execution, not a selector timeout. The user action cannot run on old UI; its post-click assertions remain executable and unchanged for integration. No case is conditionally skipped because `getRunOutcome` is absent.

The matrix first executes real `get_project_summary`, then observes the same missing API/fields. Its final aggregate failure is:

```text
P2 real-surface contracts violated; see contractChecks
110 !== 0
```

Each individual violation retains its label, expected/actual value and stack in `contractChecks`; missing JavaScript properties remain absent in raw serialized observations. `getterAvailable: false` is an observation, not a substitute outcome. All ten cases have real terminal results and activity records.

## Scenario contracts

### Required skip

Inputs use `{id,title,required?,criteria}` and item `requirementIds`. Required-default-true omits `required`; optional explicitly sets false. Structural criteria reuse `eventCount` and `mapDimensions`, with the actual 20x15 map ID read from the normalized fixture. There are no tool-name-only criteria or prose assertions.

| Case | Real action | Required new outcome |
| --- | --- | --- |
| required-skip | Declare one required event, skip its work; actual event count remains zero | blocked / incomplete / no-change |
| optional-skip | Retain a satisfied measured-size obligation and skip the unmet optional event | response-final / satisfied / no-change; optional item retained and not verified |
| replan-preserves-required | Declare/skip required event, then replace plan with measured-size requirement and skip it | blocked / incomplete / no-change; both canonical IDs retained |
| user-withdrawal | Declare measured size plus required event, skip both, then click the scoped withdrawal hook | Initially blocked / incomplete / no-change; after actual user action, goal satisfied, original unsatisfied item retained |

The initial scheduling plan intentionally has **no requirements field**; only the scripted `set_work_plan` declares the new definitions. This avoids conflating an empty/malformed declaration with a bare legacy plan. New conversation uses the real visible `ai-new-chat` control, not the obsolete hidden `ai-new-session` hook.

### Outcome matrix

Every row compares getter, harness, actual returned TurnResult, bridge harness, bridge send response, serialized activity result, TurnResult recap, activity recap, final typed event and visible UI attributes. Expected values derive from the scenario input, not from another observed output.

| Case | Actual boundary exercised | Required execution / goal / delivery |
| --- | --- | --- |
| query-no-change | Real read tool, no writes; fixture already has a real foreign-to-run receipt | response-final / unassessed / no-change |
| awaiting-user | Real composer **plan** mode; published in-progress work item, no tool execution | awaiting-user / unassessed / no-change |
| ordinary-apply | Real title tool, ordinary runner apply, save and current normalized remote proof | response-final / unassessed / persisted-verified |
| cancelled-applied | Real milestone applied and saved; click actual abort while proof GET is held | cancelled / unassessed / persisted |
| rejected-apply | Real title draft, then actual human house ownership edit before ordinary apply; existing house guard rejects stale draft | failed / unassessed / draft |
| commit-log-failure | Explicit HTTP 503 injection only for run-owned commit-log POST; actual project PATCH and proof still succeed, commitId null | response-final / unassessed / persisted-verified |
| failed-proof | Real accepted save; change real remote JSON while preserving wire hash, then release actual proof GET | response-final / unassessed / persisted |
| budget-exhausted | Real read tool under maxToolCalls=1; actual stoppedReason max-tool-calls | budget-exhausted / unassessed / no-change |
| legacy-unassessed | Bare legacy title plan, real skip, prior project receipt/proof not this run's work | response-final / unassessed / no-change |
| legacy-assessed | Existing explicit canonical `acceptance` dimensions, real skip, canonical status verified | response-final / satisfied / no-change |

Awaiting-user deliberately uses the visible plan-only surface: inspection of early traces showed that persisted config backfills autonomy `balanced`, so agentMode `chat` alone does **not** enter the clarification branch. The final scenario proves the real plan-only wait structurally; it does not relabel an ordinary final answer as awaiting-user. Clarification-specific behavior remains an integration/unit responsibility.

Cancelled proof on old source retains `stoppedReason: final` but has real proof reason `cancelled` and one applied milestone. The new execution axis must represent cancellation without rewriting legacy stoppedReason compatibility. Rejected apply similarly has a real returned draft but no applied title; its live bytes retain the human edit. No apply function, tool registry, verifier, canonical acceptance evaluator or outcome getter is faked.

## Exact observation and cleanup seams

- Session observation wraps `sendUserMessage` and `proveAppliedRevision`, forwarding original callbacks/results; a WeakSet avoids duplicate recording of the same event. Ordinary apply proof occurs outside the send wrapper, so both existing public seams are observed. The probe retains the actual result object for post-apply settlement instead of freezing a premature clone.
- Composer completion subscribes to busy-to-idle disabled-attribute transitions before clicking. Activity completion observes the real `oprn:ai-activity-logs` Storage write before sending and awaits a terminal row bearing that run's instruction token. It calls the original Storage method unchanged. Rendering uses Phaser `postrender`. All waits have bounded failure deadlines; no sleeps or test polling were added.
- Remote proof gating subscribes before the turn and holds only the first real projects GET after a receipt-bearing `persistence_proof` attempted event. Live-house rejection holds the next LLM HTTP response after the real tool has executed, then uses actual `store.update` and `flush` for a small valid ownership edit.
- Only LLM transport is scripted in ordinary cases. Commit-log fault records explicitly say `injected-transport-fault`, `status:503`, `network:false`, `remoteOutage:false`; this is not a claimed Supabase outage. Project persistence remains real. Unrelated telemetry/disk-mirror routes remain blocked as in P1; activity is verified through actual local serialization, not remote telemetry delivery.
- Browser external bridge polling is disabled with `aiBridge=0`; matrix sends through the registered real `window.__oprnAiBridge.send`, not a fake bridge handler or an external MCP server.
- Each run gets a fresh UUID project ID, confirmed absent before writing. POST/PATCH title ownership accepts only the original title or exact title values authored by this run's scenario inputs, never a prefix or arbitrary shared title. Cleanup checks the positive ID/title ownership, deletes that project, then proves projects/maps/tilesets/project_commits and observed commit-owned project_changes absent.
- Every final run records all resource cleanup booleans true, `activeRoutes:0`, `reusedListener:false`, port released, cache removed, browser/server closed and `deleted-and-absence-verified`. All created fixtures from earlier attempts are also absent; the one recovery is documented below. No configured user's project was accessed.

## Preserved development attempts (not substitutes for final evidence)

All raw artifacts are retained, including failed QA scaffolding. Commands have the same form as above with the named directory and matching scenario. Individual exits below were observed directly in this session.

| Directory | Scenario / exit | Interpretation |
| --- | --- | --- |
| `p1-original` | proof-failure / 0 | Unmodified original P1 before extraction |
| `p1-extracted` | proof-failure / 0 | P1 after the narrow QA extraction |
| `required-skip-red-01` | required-skip / 1 | **Not contract RED**: obsolete hidden new-session selector timed out; fixture deleted |
| `required-skip-red-02` | required-skip / 1 | Real missing-contract RED, before final strengthening/source binding |
| `outcome-matrix-red-01` | outcome-matrix / 1 | **Not complete matrix RED**: ordinary proof events were outside the original send observer; title PATCH also invalidated old cleanup's fixed-title assumption |
| `outcome-matrix-red-02` | outcome-matrix / 1 | Nine real executions, typed-field RED, but awaiting-user fixture actually bypassed clarification; not credited for that case |
| `outcome-matrix-red-final` | outcome-matrix / 1 | Ten real cases including corrected plan-only wait, before final fixture/cleanup tidy |
| `required-skip-red-final` | required-skip / 1 | Four real executions before final fixture/cleanup tidy |
| `p1-green-final` | proof-failure / 0 | P1 after observer/ownership corrections |

`outcome-matrix-red-01/actions.json` is intentionally unchanged and records the original cleanup refusal. A separate [recovery-cleanup.json](outcome-matrix-red-01/recovery-cleanup.json) records successful recovery (exit 0): project `qa-ai-surface-15cf1ab4-e619-465f-b859-39986e590a44` was matched against the exact title authored in that run's retained LLM actions; its actual commit IDs were queried within that project; deletion plus all child-table absence checks succeeded. No credentials, unrelated delete or relaxed prefix match was used. Final harness ownership handles this natively.

## Integration wiring needs and limits

1. Publish the same `RunOutcome` object shape through `getRunOutcome()`, `getHarnessSnapshot().runOutcome`, `TurnResult.runOutcome`, `AiBridgeTurnResult.runOutcome`, `ActivityRecord.result.runOutcome`, `RunRecap.runOutcome`, and serialized `ActivityRecord.result.recap.runOutcome`. The existing activity serializer currently drops recap; adding only an input type will not pass.
2. The harness's explicit typed event contract is `{ type: "run_outcome", runOutcome }`. Terminal event delivery must reflect settled ordinary apply/proof, not an earlier draft projection. Current passive probe observes callback events crossing `sendUserMessage` and `proveAppliedRevision`. If integration chooses a separate settlement callback entry point, extend the **passive observation adapter** to that real seam; do not weaken terminal agreement or synthesize an event. This chosen future seam cannot be verified on old source.
3. Keep the actual returned result and recap settled before bridge/activity/UI publication; a projection calculated only before ordinary apply fails the persisted/draft cases. Retain both applied and pending call collections without replay. A no-write new conversation must not inherit prior receipts or prior session proof.
4. Expose one visible `[data-testid="ai-run-outcome"]` with `data-execution`, `data-goal`, `data-delivery`. Withdrawal must be a real scoped `[data-testid="ai-requirement-withdraw"][data-requirement-id]` user control wired to canonical user-only authority, retaining unsatisfied history; never expose it as an LLM tool. The final post-click portion is necessarily unexecuted on old UI.
5. The rejected-apply fixture uses the existing live house protection guard; do not repair or bypass that guard to obtain GREEN. The cancellation fixture is specifically after accepted persistence, so its delivery is persisted, not applied-only or verified. Failed proof likewise retains accepted persistence without promoting verification.
6. Stale/foreign/advisory/fabricated evidence and full requirement provenance/ask-reactivation truth tables remain the other producers' unit/integration coverage. This node does not claim image/visual quality, all six-by-three-by-five combinations, external MCP HTTP transport, remote activity delivery, or integrated P2 GREEN. Screenshots were captured, not visually adjudicated.

## Verification, review and delivery

- [qa-executions.json](qa-executions.json) inventories all 12 actual executions, their commands/exits, run-owned IDs and cleanup receipts. [qa-raw-evidence.sha256](qa-raw-evidence.sha256) pins 134 raw artifacts; `sha256sum --check` passed (exit 0), with raw output in [qa-raw-evidence-check.log](qa-raw-evidence-check.log). A credential-value scan found no configured anon key in any raw artifact. Cleanup validation confirmed every run's fixture absent, using the separate recovery receipt only for the one refused initial cleanup.
- Full harness SHA: `0d3793b45a0c24c0a651568367e04ac5f8ed61ca`.
- Seven changed `.mjs` files: language-server diagnostics reported no diagnostics; `node --check` passed for each; `git diff --check` passed. The Vite/Firefox runs execute the actual QA entry point and real app import graph. No new build configuration/dependencies were introduced. Full build/gates and product test suites remain lead-owned and were not run by this QA producer. Markdown LSP is unavailable (no `.md` server), not a passed validator; the staged whitespace check passed for all code/evidence.
- Post-write pure LOC: entrypoint 249 (warning band), browser probe 87, cleanup 12, P1 assertions 86, P2 observations 89, P2 scenario inputs 62, P2 execution 168. Before adding more entrypoint lines, extract remote transport ownership; no file exceeds 250.
- Architectural review: files own QA lifecycle, browser observation, remote cleanup, P1 proof, P2 inputs, P2 observation, or P2 execution respectively. Product parsers remain the trust boundary; scripted definitions are parsed by the real session. Scenario actions dispatch explicitly with unknown-action failure. No any/casts/non-null assertions/type suppressions, outcome fallbacks or product logging changes. Optional checks concern genuinely missing old-source APIs. Existing four-argument framework send and REST signatures are preserved, not new domain parameter bags. Cleanup re-queries are the explicitly requested deletion/absence evidence. Existing structured QA records are retained; no prose tests were added.
- Ordered delivery: baseline `e827eb5c8` -> harness `0d3793b45` -> evidence/report commit (SHA in task handoff; a commit cannot include its own final SHA). Both commits are scoped and attributed. No push or merge is authorized in this node. The integration producer can import the harness unchanged, then run these same assertions against integrated source.
