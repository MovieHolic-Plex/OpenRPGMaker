# P2 pure RunOutcome projection

Implemented the phase-fixed pure projection. **437/437 focused tests pass**, app typecheck exits **0**, both TypeScript files have no LSP diagnostics, and the public function executes directly under Node. These are normalized-fact unit/API proofs, **not session, persistence-authority, editor or remote integration proof**.

## Scope and source identity

- Task: `st_01a07786`; approved items 3/4/12; outcome-model producer only.
- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-outcome-20260906`.
- Branch: `agent/ai-harness-p2-outcome-20260906`; no upstream configured (lookup exit 128).
- Starting HEAD: `e827eb5c8371ff87ea29231a124806f687c3aba2`; tree: `90e4dcaae23e36c148a79cacc2981cd26da00e32`.
- Starting worktree/index were clean. No existing RunOutcome implementation or callers were found in `src`/`test`.
- Read the complete lead `phase-p2.md`, the main P2 producer's `baseline.md`, root `AGENTS.md`, OpenWiki quickstart/index/project map, focused AI workflow/acceptance and editor-observability guidance, canonical `AcceptanceStatus`, local test runner and manifest, and TypeScript skill references before source edits.
- Product changes: only `src/ai/runOutcome.ts` and `test/aiRunOutcome.test.ts`. Other deliverables are this report and the five raw logs linked below, under this P2 evidence directory.
- One scoped commit contains implementation, direct tests and evidence. Its final SHA is supplied in the task handoff; it cannot be embedded in its own commit body. No history rewrite, merge or push was performed.

Source SHA-256 after GREEN and diagnostics:

```text
b5c44e295d3de495a728a33c9f122babe81ee47b61f31dc848234348ef35fa7f  src/ai/runOutcome.ts
d6b542d1d0d2240c2fbe914586219ad77f7e153cdff86eb6926284aebb84903a  test/aiRunOutcome.test.ts
```

## Public API and owner contract

`src/ai/runOutcome.ts` exports `RunOutcome`, `RunOutcomeFacts` and `deriveRunOutcome(facts): RunOutcome`. The input has exactly five readonly normalized facts:

| Fact | Values / authority |
| --- | --- |
| `execution` | `response-final`, `awaiting-user`, `blocked`, `cancelled`, `budget-exhausted`, `failed`; explicit owner decision, passed through unchanged |
| `acceptance` | Canonical `AcceptanceStatus` or `null`; only a type-only import from existing acceptance |
| `hasPendingDraft` | Boolean for pending unapplied work of this run |
| `hasApplied` | Boolean for actually applied work of this run |
| `persistence` | `none`, `accepted`, `verified-current`; supplied from this run/version's real P1 receipt/proof |

Output has readonly `execution`, `goal`, `delivery`. Every returned object is `Object.freeze`d; its fields are primitives. Caller inputs are neither rewritten nor frozen. Lookup tables are frozen and exhaustively checked using `satisfies Readonly<Record<...>>`; adding a canonical status or persistence variant requires an explicit mapping.

Goal truth table:

| Canonical assessment | Goal |
| --- | --- |
| `null` | `unassessed` |
| `verified` | `satisfied` |
| `pending`, `working`, `verifying`, `blocked` | `incomplete` |

Delivery truth table, evaluated in this order:

| Pending draft | Applied work | Persistence | Delivery |
| --- | --- | --- | --- |
| true | either | any of the three typed values | `draft` |
| false | false | any of the three typed values | `no-change` |
| false | true | `verified-current` | `persisted-verified` |
| false | true | `accepted` | `persisted` |
| false | true | `none` | `applied` |

`response-final` does not imply satisfaction. Cancellation does not undo applied delivery. Accepted save without a current passing proof remains `persisted`, not `persisted-verified`. A pending draft takes display precedence even after verified applied milestones; it does not erase those milestones. No applied work means `no-change` even if a caller also supplies a persistence fact.

**Integration obligations remain explicit:** retain both applied and pending call collections, normalize facts at real execution/apply boundaries, and use live run/version-owned receipt/proof freshness. This module receives no collections, session, store, project, model text, stoppedReason, commit metadata, mutable evidence or evaluator. It cannot prove caller honesty or currentness. Its single import is type-only; its only module values are frozen constant maps. It has no runtime imports, retained run state, network/storage access, or authority-building logic. The repeated-invocation regression proves earlier delivery/assessment does not leak into a later query at this pure boundary.

## RED -> GREEN and exact commands

All commands below ran in the isolated worktree above using the existing npm/Vitest install. No package/config/dependency changes were made. Shell redirection preserved combined stdout/stderr; `$?` was captured directly, never through a pipeline.

| Execution | Raw command | Result | Raw evidence |
| --- | --- | --- | --- |
| Missing public API RED | `npm test -- test/aiRunOutcome.test.ts` | Exit **1**; module absent, one failed suite and no collected tests; API absence only, not behavior proof | [outcome-model-red.log](outcome-model-red.log) |
| Behavior RED | `npm test -- test/aiRunOutcome.test.ts -t 'preserves accepted persistence'` | Exit **1**; one expected assertion failure, 436 filtered tests; real output `no-change/unassessed` versus required `persisted/incomplete` | [outcome-model-behavior-red.log](outcome-model-behavior-red.log) |
| Final GREEN | `npm test -- test/aiRunOutcome.test.ts` | Exit **0**; **437 passed**, no failures or skipped tests; 324ms test execution, 2.59s total | [outcome-model-green.log](outcome-model-green.log) |
| App typecheck, initial attempt | `npm run typecheck:app` | Tool execution timed out at **120s**; no compiler diagnostic or process exit was captured; **not a pass** | [outcome-model-typecheck.log](outcome-model-typecheck.log) |
| App typecheck, completed attempt | `npm run typecheck:app` | Exit **0**, no diagnostics; rerun with 600s tool execution limit after timeout inspection | [outcome-model-typecheck-complete.log](outcome-model-typecheck-complete.log) |

The behavior RED used the final public types with this deliberately minimal initial function body, before adding the mappings and delivery precedence:

```ts
return Object.freeze({ execution: facts.execution, goal: "unassessed", delivery: "no-change" });
```

It is not a missing import, boot failure or authority mock. The full test file was written before either skeleton or implementation; the filtered RED was only to isolate the named behavior. The final run executes every case unchanged. All 432 combinations (6 executions x 6 assessments x 12 delivery inputs) are covered independently from the implementation tables, plus five public-API, accepted-save, immutability and repeated-invocation cases. No prose assertions, mocked sessions, sleeps, polling or asynchronous resources are used.

### Actual public entry-point execution

Command (exit **0**, Node `v24.11.1`, native TypeScript stripping; no Vitest/Vite loader):

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { deriveRunOutcome } from './src/ai/runOutcome.ts';
const facts = Object.freeze({ execution: 'cancelled', acceptance: 'verified', hasPendingDraft: true, hasApplied: true, persistence: 'verified-current' });
const outcome = deriveRunOutcome(facts);
assert.deepEqual(outcome, { execution: 'cancelled', goal: 'satisfied', delivery: 'draft' });
assert.equal(Object.isFrozen(outcome), true);
console.log(JSON.stringify({ outcome, immutable: Object.isFrozen(outcome) }));
JS
```

Raw stdout:

```json
{"outcome":{"execution":"cancelled","goal":"satisfied","delivery":"draft"},"immutable":true}
```

LSP `severity: all` on each changed TypeScript file returned **No diagnostics found**. This includes the test's public type assertions; Vitest alone is not credited as a TypeScript checker. Markdown LSP was unavailable (no `.md` server configured), not passed. `git diff --staged --check -- src/ai/runOutcome.ts test/aiRunOutcome.test.ts output/evidence/ai-harness/p2/outcome-model.md` exited **0**. The full `git diff --staged --check` exited **2** only for raw log whitespace: RED source-code frames retain trailing spaces (`red.log:21`, `behavior-red.log:470`), and all five raw logs retain their final blank line. Raw evidence was not sanitized to hide these warnings.

## Architectural review, limitations and cleanup

- Single responsibility: module = outcome projection; test = projection contract. Measured using the skill's nonblank/noncomment `awk` command: module **35** lines, test **91** lines. Both below the warning band.
- Boundary purity: typed normalized facts only; parsing, requirement evaluation, withdrawal/optionality and evidence currentness remain with canonical owners.
- Variants: exhaustive typed maps, not open-ended variant conditionals. The null branch distinguishes absent assessment; boolean branches implement fixed draft/applied precedence.
- Escape hatches: no `any`, casts, non-null assertions or suppressions; only `as const` plus `satisfies`.
- Defensive layers/helpers: none; no speculative validation, error handling or one-off helpers. One function takes one five-field domain fact object, not positional argument packaging for unrelated operations.
- Tests: own API RED and behavior RED precede implementation; final GREEN covers the complete normalized truth table. Results/inputs are immutable as required; no previous-call authority is retained.
- Naming/verification/logging: positive fact names, no production setter/delete/re-query pattern, no logging or error boundary introduced. Mutation-rejection assertions are test-only checks of the immutability contract.
- No integration/E2E, full build or supervisor full gate was run here. The lead owns actual session/UI/bridge/activity/recap settlement, P1 receipt/proof integration, collection preservation, broader gates and exact-head approval. These unit tests do not replace those proofs.
- No session/store/UI edits or runtime imports; no acceptance/image/advisory evaluator changes, no auto-apply/undo or region approval changes. Wiki edits are deferred to the phase's documentation node because this producer's file scope is fixed.
- No authored content, DB writes, servers, browsers, listeners, timers, routes or extra worktrees were created. Test and completed typecheck processes returned; the timed-out typecheck attempt had no surviving matching process in the isolated worktree at inspection. Existing shared dependency resources were not removed. Raw logs are retained unchanged, including final blank lines.
