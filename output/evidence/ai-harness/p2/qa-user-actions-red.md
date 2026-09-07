# P2 follow-up: actual user resume after Ask

The `required-skip` scenario now includes `blocked-ask-resume`. It drives the real composer and targets the existing `ai-continue-run` button after a question, leaving Ask selected. No direct session resume call, special injected turn options, fabricated event/outcome, model withdrawal tool, or synthetic replacement button is used.

## Observed old-source failures

Final evidence: [user-action-required-skip/actions.json](user-action-required-skip/actions.json), exit **1**. The underlying source remains the original P2 baseline (`src` subtree `7cffd2bbcc3208e91510aec30a50a703a783b255`); execution HEAD was prior delivery `0d623b5dd224ef28564c8d98cfcdcb54c55a1589`. Each raw report hashes the exact new harness bytes and source files. All 48 final source-hash comparisons passed after execution.

1. The real planner declares canonical unmet `eventCount` acceptance, then four real `resize_map` calls fail the existing minimum-size validation. The project fixture itself stays valid and unchanged. The real repeated-tool-failure guard blocks `blocked-resume-work`. Canonical acceptance also becomes blocked, with ID `blocked-resume-event`, exact map binding and `passed:false`.
2. The user clicks `ai-composer-mode-ask`, fills the composer and clicks the real send button. Actual observed `sendUserMessage` options have `composerMode: "ask"`; the probe only records these production arguments and never changes them.
3. Before triggering the question, the harness arms the first tools HTTP request after the real intent decision. While that request is held, it captures the session WorkPlan, canonical acceptance, Phase-defined outcome hooks, original result, bridge and actual UI. It repeats the observation after real `get_project_summary` and terminal activity publication.
4. Old source changes the work item to **in_progress** and canonical acceptance to **working**, both during and after Ask. The retained false evidence and map binding remain observable. Four state-preservation assertions fail; these are actual behavior failures, not merely missing APIs.
5. After the question settles, the test asks for the existing visible `ai-continue-run` button. Its immediate count assertion fails:

```text
blocked-resume: existing user continue control is available after ask
0 !== 1
```

The recorded state assertion is:

```text
blocked-question: state stays blocked during ask
actual: in_progress
expected: blocked
```

Authority comparisons assert only machine fields: ledger/item IDs, statuses, map binding and evidence passed flags. Complete raw snapshots are retained, but no natural-language reason/prompt wording is pinned.

## Executable post-integration user-action contract

Once the real continue control is available, the existing code path performs `button.click()` without manually switching Ask back to Do. It holds the next actual tools request after intent and asserts:

- The same originally blocked item is now `in_progress`.
- The production user-resume handler supplied a Do turn, rather than carrying stale Ask mode through the click.
- The original canonical obligation remains present and unverified; resume is authorization to work, not satisfaction.
- The terminal project still has zero events; the harness never fabricates the required result.

The resume click and these post-click assertions are **not yet executed on old source**, because the actual control is absent. The harness does not skip around that failure or call the session directly to obtain a false GREEN. Integration owns the source/UI wiring and unchanged-assertion GREEN.

The explicit legacy `acceptance` field is intentional for this lifecycle fixture: it makes real canonical obligations observable before P2 exists. The four preceding scenarios still exercise new `requirements` declarations, required/default/optional behavior, replans and withdrawal. There is no parallel ledger and no test-authored blocked state.

## Existing control wiring that integration must address

At this inspected source:

- `src/editor/panels/aiTurnRunner.ts:391-404` renders `ai-continue-run` only for budget-exhaustion status and calls the panel's `sendText("계속")` from its click handler.
- `src/editor/panels/aiChatPanel.ts:1510-1523` passes the currently selected composer mode into the real session.
- `src/ai/assistantSession.ts:1625-1642` reactivates blocked work before it declares the new intent; the Ask trace proves the resulting mutation.

Use that existing user control and normal panel path, but make it available for blocked work and ensure an explicit click after Ask reaches real resume authorization/reactivation. Merely adding a direct session API test with special options does not satisfy this contract.

Withdrawal is unchanged: the earlier `user-withdrawal` case only clicks `[data-testid="ai-requirement-withdraw"][data-requirement-id="required-events"]`. Its real old-source count is zero, so it also remains RED. No model tool or direct session call can stand in for that action. Phase-defined `ai-run-outcome` attributes remain unchanged.

## Final sequential commands

Working directory: `/home/main/z-project/rpg-zzu-ai-harness-p2-qa-20260906`. Each directory retains command text, direct shell exit, raw log, source hashes, screenshots and cleanup evidence.

```sh
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/user-action-proof-failure xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario proof-failure
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/user-action-required-skip xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario required-skip
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/user-action-outcome-matrix xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario outcome-matrix
```

| Scenario | Exit | Result | Run-owned project |
| --- | --- | --- | --- |
| proof-failure | 0 | P1 GREEN | `qa-ai-surface-82ca02da-50af-4c09-9f9c-0fb4efaca853` |
| required-skip | 1 | Five initial cases plus real Ask continuation; 87 checks, 69 violations, two missing actual user controls | `qa-ai-surface-5c2b400a-62de-4a2d-adbc-f25a5fb6d57c` |
| outcome-matrix | 1 | Same ten real cases; 148 checks, 110 missing typed-field violations, zero case execution failures | `qa-ai-surface-8c86c8b5-0dd7-4a93-82d6-d8438e956f16` |

All three final runs have zero page/route errors, zero active routes, closed browser/server/cache/port resources, and run-owned project/child-table deletion plus absence proof. The two preliminary runs also cleaned up completely:

- `blocked-ask-resume-red-01`, required-skip, exit 1: fixture-development failure, **not the Ask regression proof**. Three failed tool invocations did not reach the actual four-failure guard. Preserved raw evidence; corrected the fixture to the inspected source's threshold without altering assertions about blocking, questions or user resume.
- `blocked-ask-resume-red-02`, required-skip, exit 1: genuine Ask mutation and missing-control RED. Final code narrows authority comparisons to machine fields instead of whole snapshots; it does not weaken the required state/identity/evidence preservation.

## Verification and scope

- [qa-user-action-evidence.sha256](qa-user-action-evidence.sha256) binds 69 raw artifacts across these five executions. `sha256sum --check` exited 0; output is in [qa-user-action-evidence-check.log](qa-user-action-evidence-check.log). An exact configured-credential scan found no anon key in these artifacts.

- Changes are confined to QA helpers and P2 evidence in this worktree; `git diff --exit-code HEAD -- src test package.json` passed. No dependencies, full gates, product changes, other-worktree edits, pushes or merges.
- `node --check` passed for all affected JavaScript; `git diff --check` passed. Initial LSP diagnostics were clear on all six touched files. Fresh LSP requests for the final scenario/helper changes timed out after 3000ms; they are not claimed as a fresh passed check. Actual Vite/Firefox executions validated the imported scripts.
- Pure LOC: entrypoint 249 (existing warning band), browser 88, observations 89, scenario inputs 69, P2 executor 177, user-resume helper 59. No file exceeds 250. Before adding entrypoint lines, extract transport ownership.
- Architectural review: the new helper owns user lifecycle assertions only; real parsers, tools, canonical ledger and UI handlers own behavior. Transport gates are bounded and armed before actions. No sleeps/polling, type escapes, fabricated outcomes, natural-language assertion pins, or new product logging. Existing scoped withdrawal and P1 assertions remain intact. Receipt/absence rechecks are explicitly requested QA evidence, not new production defenses.
- Previous ordered commits remain `0d3793b45` then `0d623b5dd`. This follow-up's scoped commit SHA is supplied in the task handoff. Raw prior evidence remains unchanged; this addendum supplements, rather than relabels, the original report.
