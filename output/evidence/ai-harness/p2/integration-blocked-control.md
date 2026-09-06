# Integration follow-up: real blocked-work Continue availability

The integration-owned runner now exposes the existing `ai-continue-run` control for blocked work, not only budget stops. It keeps the same control available after Ask by moving its row out of the real conversation renderer's collapsed prior-turn group. The actual browser now sees and clicks that control after Ask. Panel Ask-to-Do click wiring remains UI-lane work, and the real browser assertions faithfully expose that remaining failure rather than labeling it a successful resume.

## Settled producer handoff and scope

Read the complete updated `phase-p2.md`, including **Settled producer handoff**, and `qa-user-actions-red.md`. The phase records the lead's independent requirements verification at `d6a38018c` (171/171: 124 requirement cases plus 47 P1 proof cases), pure-model verification at `7f42772c` (437 cases and API probe), and QA terminal source/cleanup verification through `8f82a11b9`. These are supervisor results, not reruns claimed by this node. All imported commits and previous evidence remain preserved.

This increment starts at `bd836d57ae238405f9388dd346a35ca8371df242` on `agent/ai-harness-p2-20260906`, in the same sole writable P2 worktree. Product change: only `src/editor/panels/aiTurnRunner.ts`. Tests: new `test/aiBlockedContinue.test.ts` and a two-line strengthening of the imported `scripts/qa/ai-harness-p2-resume.mjs` terminal assertion. No panel user-action handler, CSS, acceptance authority, session outcome projection, receipt/proof owner, dependency or config was changed.

## Runner behavior

- The budget branch and terminal blocked-work branch share the existing Continue renderer. No synthetic replacement control or separate continuation implementation was introduced.
- Terminal availability uses actual typed execution, blocked WorkPlan items, or an already-retained continuation for an incomplete goal. It does not interpret model claims or recalculate requirement satisfaction.
- Availability is applied after the existing owner-turn publication guard. A retired owner cannot add a control to its replacement surface.
- The real `appendConversationBubble` renderer folds earlier rows when a new user message starts. Simply deduplicating by finding the existing button left it inaccessible inside `.ai-turn-group.is-collapsed`. The renderer now reuses and moves that existing row to the current log, removing its prior-turn marker. It does not unfold historical conversation groups, duplicate buttons or automatically send anything.
- The existing click still delegates `sendText("계속")`; the UI lane must supply the actual composer transition before that dispatch. Session Ask protection must not be weakened to compensate.

## Tests and own RED

The new runner tests use real `AssistantSession`, native WorkPlan/tools/acceptance, the production runner and the real conversation renderer on the existing fake DOM. The activity sink is isolated from external storage, but records still pass through the real activity builder. Presentation callbacks are inert; no control, blocked outcome or canonical ledger is synthesized. No `goalAction` shortcut is used.

Contracts:

1. Required unmet work returns a real blocked result without budget exhaustion; production mounts the existing Continue button and its genuine click forwards `계속`.
2. A real subsequent user row folds history; after Ask the **same** button is unique and no longer under the collapsed group. No automatic continuation is dispatched.
3. Retired owner completion cannot add a button.
4. Four actual invalid `resize_map` calls block real work. Ask remains a question. The ordinary continuation token in Do authorizes reactivation through the normal session entry point, and unfinished work then publishes **blocked / incomplete / no-change** through current getter, harness, final event and actual runner activity/recap serialization. This is backend dispatch coverage, not a substitute for the real UI click scenario below.

Executed commands (direct captured process exits, no pipe exit substituted):

```sh
npm test -- test/aiBlockedContinue.test.ts --maxWorkers 1 --minWorkers 1
```

- Initial RED: **exit 1, two failures/two passes**. Control absent for blocked work and after Ask. [integration-blocked-control-red.log](integration-blocked-control-red.log).
- After initial availability implementation, the first nine-file command passed 524 tests. [integration-blocked-control-green.log](integration-blocked-control-green.log). The browser then exposed collapsed-history invisibility; this was not considered done.
- Real conversation-renderer history RED: **exit 1, one failure/three passes**. The found button remained under a collapsed ancestor. [integration-blocked-history-red.log](integration-blocked-history-red.log). The large raw object assertion is retained unchanged.

Final command:

```sh
npm test -- test/aiBlockedContinue.test.ts test/aiRunOutcome.test.ts test/aiRequiredOutcomes.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts test/aiAssistantBridge.test.ts test/aiTurnAppliedAccounting.test.ts test/aiActivityLog.test.ts test/runRecap.test.ts --maxWorkers 1 --minWorkers 1
```

**Exit 0: 524/524 tests, nine files, no skipped/failed cases, 145.72s.** Raw: [integration-blocked-control-final-green.log](integration-blocked-control-final-green.log).

```sh
npm run build
node --check scripts/qa/ai-harness-p2-resume.mjs
```

Both **exit 0**. Build includes app typecheck, editor, player/SDK and standalone bundles. Raw: [integration-blocked-control-build.log](integration-blocked-control-build.log). Existing build warnings remain visible and unchanged. Fresh diagnostics on the runner, test and modified QA helper returned no diagnostics; source/test/helper whitespace check passed.

## Actual user surface and remaining UI-lane RED

Ran the imported real-surface entry point twice, retaining both artifacts:

```sh
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/integration-blocked-control-surface xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario required-skip
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/integration-blocked-control-final-surface xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario required-skip
```

Both overall exits are **1**, not full-scenario GREEN.

- Initial surface attempt: control count passed but actual visibility failed (`false !== true`) after Ask. This led to the real-history regression and row rehoming fix above. No CSS workaround or test relaxation.
- Final surface attempt: count and visibility passed, and the scenario performed the **actual `button.click()`** on `ai-continue-run`, without selecting Do in the test or injecting session options. Raw action `real-user-resume-click` records `previousComposerMode: "ask"`.
- The actual observed click dispatch still has `{ instruction: "계속", composerMode: "ask", autonomous: true }`. The item remains `blocked` rather than becoming `in_progress`. This is the precise remaining Panel user-action defect, not a session authority defect.
- The resulting response is consistently `response-final / incomplete / no-change`, because it was still an Ask request. It must not be relabeled as resumed work by backend inference.
- The added two-line terminal contract calls the existing shared `observations.agreement` with **blocked / incomplete / no-change** after `blocked-user-resume-settled`. That independently checks current getter, harness, returned result, bridge harness, activity, returned recap, activity recap, final typed event and visible UI. It now fails on the stale Ask execution axis, as intended, instead of checking only that zero events remain.

Final run: **104 contract checks, 87 pass and 17 fail**. Failures are seven absent UI outcome hooks, two missing resume authorization effects (Ask persists and item not reactivated), and eight terminal execution-axis mismatches caused by that still-Ask dispatch. The separate user-withdrawal case also remains unable to finish because its real control is missing. No backend or UI assertion was suppressed. [integration-blocked-control-binding.log](integration-blocked-control-binding.log) verifies all 16 final source/harness hashes, inventories exact failures/click options and records cleanup; configured key-value scan passed.

### UI handoff: one actual user boundary

Availability is now integration-complete; do not replace the renderer or add a second Continue control. At the real control's user click, wire the existing composer `setMode("do")` path (which updates the panel's mode owner) **before** sending `계속`. The normal session continuation-token path then authorizes resume. The lane may expose the needed panel action through its existing surface adapter, but must not synthesize a test control, inject `goalAction` in the QA probe, manually switch the test to Do or relax Ask protection in the session.

After that UI change, rerun the same strengthened `required-skip` scenario. Required final contract for the resumed unfinished run is **blocked / incomplete / no-change** across all current projections, not the preceding question's `response-final` outcome. The same original work item must reactivate during execution and the same unmet requirement must survive. The expected value is already executable in both backend tests and real-surface QA.

## Cleanup and architectural review

- Initial owned project: `qa-ai-surface-e30f702e-114c-477d-a329-224629c7601c`; final: `qa-ai-surface-6f2b3702-d2dc-4ed9-a039-fc7ccc993cb9`. Both were absent before creation, ownership-checked, deleted and proven absent with their child tables/observed commits.
- Both runs closed browser/server/cache/listeners/timers, released port 37025, retained `activeRoutes:0` and reused no listener. Screenshots were captured; image decoding was unavailable in this agent, so no visual-adjudication claim is made. Actual Playwright count/visibility/click observations are the surface evidence.
- One responsibility: runner-owned continuation availability. `offerContinuation` has two actual callers (budget and terminal settlement) and no parameters. It reuses UI nodes rather than introducing authority or hypothetical abstraction.
- Typed result/WorkPlan data is already trusted; no parser or permission framework was added. No new casts, any annotations, non-null assertions, suppressions, sleeps/polling or prose tests. No product logging change. Move/remove operations are not followed by redundant product verification.
- Measured pure LOC: existing runner 708, new test 105, QA helper 61. The runner remains inherited oversized debt under the fixed no-redesign scope; no unrelated split or line-packing workaround. New files stay below 200.
- This change follows `bd836d57a` in the ordered integration chain. Its attributed commit SHA is provided in the final task handoff. No push, merge, full gate, nested agent or other-worktree edit occurred.
