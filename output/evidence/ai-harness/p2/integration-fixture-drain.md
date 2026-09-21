# Integration follow-up: owned fixture I/O drainage and user-resume handoff

The fixture cleanup review was correct. `ProjectStore.persistCurrent()` calls `recordManualProjectCommitAfterSave()` before returning its receipt, but that call launches `recordProjectCommitToLegacyDb()` without awaiting its completion. That writer awaits hashing, both commit table requests, and error response-body handling. Cancellation at the receipt can return from proof while this real writer is still running. Freezing autosave timers does not complete it.

This follow-up changes only five test/fixture files plus integration evidence. No production, UI, authority, transport implementation or QA scenario source changed. Worktree/branch remain `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`, `agent/ai-harness-p2-20260906`, based on `761ed517b188729130e26dad57196aa4218b19ab`.

## Fix and faithful regression

- `applyFixture()` installs a call-through `vi.spyOn(sync, "recordProjectCommitToLegacyDb")` before actions. It neither substitutes the writer nor manufactures its result.
- `drainOutcomeFixtures()` takes the actual returned writer promises, waits for all their settlements with a real Node-timer 10-second failure deadline, and reports rejected writers via `AggregateError`. Its deadline is always cleared. It does not poll or wait for hypothetical transport traffic.
- All three fixture consumers now await drainage in async `afterEach` **before** disabling persistence, resetting history/cache, restoring mocks, globals or environment. Restoration remains in `finally` so a drain failure is visible without hiding cleanup.
- A dedicated regression performs a real manual edit/save, cancels proof at its accepted receipt, and holds the real optional-table error response body in a native `TransformStream`. A call-through observation signals the actual `Response.text()` invocation. Cleanup starts while that body is pending; the stream is then released and the test asserts that the real writer has finished when drainage returns. The writer returns `not-configured` after parsing the genuine `PGRST205` body; no proof or commit authority is faked.
- A separate regression saves and flushes a deduplicated revision. Drainage succeeds without requiring another commit/changes-row event. Observing the writer promise handles both an actual new write and no new write.

RED exposed the old immediate-cleanup behavior through an initially no-op drain entry point (`return Promise.resolve()`); the real background writer and native response body were already in use. The regression observed `completedAtDrain === false`, not a missing import or transport boot failure. The final implementation changes only that drainage seam and its consumers.

## Exact commands and results

All commands ran in the main P2 worktree. Output and actual npm/process exits were captured directly, not from a pipe.

```sh
npm test -- test/runOutcomeApplyFixture.test.ts --maxWorkers 1 --minWorkers 1
```

Exit **1**: one faithful completion-order assertion failure, one deduplication pass. Raw: [integration-drain-red.log](integration-drain-red.log).

```sh
npm test -- test/runOutcomeApplyFixture.test.ts test/aiRunOutcomeApply.test.ts test/aiRunOutcomeOwnership.test.ts test/aiRunOutcomeLifecycle.test.ts test/storePersistenceProof.test.ts --maxWorkers 1 --minWorkers 1
```

Exit **0**: **35/35 tests, five files**, no failures or skipped cases; 134.59s. Includes all existing fixture consumers and 18 established P1 store proof cases. Raw: [integration-drain-green.log](integration-drain-green.log).

```sh
npm run build
```

Exit **0**, including app typecheck, editor, player/SDK and standalone bundles. Raw: [integration-drain-build.log](integration-drain-build.log). Existing optional-provider, circular/mixed-import, forest-image and chunk-size warnings remain unsuppressed.

Fresh LSP diagnostics on all five changed TypeScript files returned no diagnostics. Source/test whitespace check exited 0. The earlier 586-test/backend matrix verification remains historical evidence for the unchanged product implementation; the final test-fixture tree is additionally verified by this 35-test run and new build. No competing full gate was run.

## Consumed real Ask -> user resume scenario

Read the imported `scripts/qa/ai-harness-p2-resume.mjs` and traced its call from `ai-harness-p2.mjs`, the real continue control, composer mode owner and session dispatch. Executed the unchanged real-surface scenario:

```sh
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/integration-resume-probe xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario required-skip
```

Overall exit **1**, preserved without weakening any assertion. Raw evidence: [integration-resume-probe/actions.json](integration-resume-probe/actions.json), [command.log](integration-resume-probe/command.log), [exit-code.txt](integration-resume-probe/exit-code.txt).

Observed **87 contract checks: 81 pass, six fail only for missing visible outcome hooks**. Two real user-action cases cannot finish because their required controls are absent:

```text
user-withdrawal: genuine user withdrawal control exists
0 !== 1

blocked-resume: existing user continue control is available after ask
0 !== 1
```

The blocked-resume preconditions and question were actually executed: four real failed `resize_map` calls leave `blocked-resume-work` blocked with `blocked-resume-event` unmet. The real Ask composer reaches the session as `composerMode: "ask"`. Exact transport gating captures the first tools request after intent; during and after Ask, the same blocked work item and canonical obligations remain intact. The settled question agrees across backend result/harness/bridge/activity/recap/event as `response-final / incomplete / no-change`. The script does **not** switch to Do itself. No user resume click occurred because the control was absent, so resumed execution is explicitly **not** claimed GREEN.

### Required UI-lane adjustment

The UI lane owns the visible control and its click handler; this follow-up leaves production UI untouched.

1. Keep a visible, unique `[data-testid="ai-continue-run"]` available for blocked work after Ask, not only after an execution-budget status. Current `aiTurnRunner.ts` creates it solely in the `예산 소진` / `agent_run_budget_exhausted` status branch.
2. At that genuine user click, change the actual composer to **Do before dispatching** `계속`. The current handler is `void deps.surface.sendText("계속")`; `aiChatPanel.sendText()` forwards its retained `composerMode` unchanged, so Ask would suppress reactivation even if the control were visible. Use the existing composer `setMode("do")` path (which updates the mode owner) through the lane's UI wiring, rather than weakening the session's question protection. The session already recognizes the genuine continuation token in Do as explicit resume authorization. No model output or synthetic continuation may flip this boundary.
3. Preserve the imported scenario's actual button click and its assertions: same item becomes `in_progress`, actual session options say `composerMode: "do"`, original obligation remains unmet, and no missing content is invented. Do not make the scenario manually select Do or inject session options to bypass the handler.

The existing user-only withdrawal control remains another UI-lane requirement, already documented in `integration.md`. Neither action is an LLM tool.

## Cleanup, scope and review

- Real remote fixture `qa-ai-surface-7e2c02af-7b39-4dcc-ac41-dbb9c1764ce0` was absent before creation, positively ownership-checked, deleted and proven absent with child tables and its one observed commit. The report records browser/server/cache closure, released port, closed listeners/timers, `activeRoutes: 0`, and no reused listener.
- Tests use bounded exact promise/transport signals, not sleeps or polling. Assertions are machine state and observable completion; no prose pins, `any` annotations, casts, non-null assertions, suppressions or dependencies were added.
- Single responsibilities: fixture owns the wire-level test environment and its async lifetime; regression file owns that lifetime contract; consumer edits only place the drain before existing cleanup. The parser, store and writer remain real boundary owners.
- New helper parameters are at most one; no hypothetical abstraction or parameter bag. Drain failures are propagated, not swallowed. No product logger or error boundary was altered. Positive naming and existing cleanup contracts are retained.
- Pure LOC: fixture 73, dedicated regression 65, apply suite 86, ownership suite 57, lifecycle suite 85. All below 200. No broad refactor was needed.
- `git diff --exit-code -- src scripts/qa` exited 0. Production source remains the verified implementation from `f4ae6118e`; the inherited scripts remain producer-exact. New commit attribution and scoped delivery follow the prior sequence; the final follow-up SHA is in the task handoff.
