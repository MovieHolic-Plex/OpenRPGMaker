# P2 authoritative outcome UI and user scope actions

The existing deck now presents the session's authoritative execution, goal and delivery axes. The existing sticky checklist offers a scoped user-only requirement exclusion, preserving original request source and unsatisfied evidence. The real Continue control after Ask now updates both Panel mode ownership and composer presentation before sending Do/resume.

**Verified implementation:** `c8fa4e965396cb53bc2f453a02c7752b64c4a0e3` (`feat(ai): present authoritative outcomes and user scope actions`). Final scoped tests: **133/133 in six files, exit 0**. Complete build: **exit 0**. Fresh actual browser contracts: **148/148 outcome-matrix** and **107/107 required-skip**, both exit 0. Independent image-capable visual review and full gates remain lead-owned; this is not visual approval.

## Scope and authority

- Task `st_01a07853`, approved items 3/4/12. Sole writable worktree `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`, branch `agent/ai-harness-p2-20260906`.
- Entry HEAD `016818b8c`; clean tracked tree/index, no upstream configured. Read the full Phase P2 contract, `integration.md`, actual upstream code and commits, QA user-action RED, AGENTS, quickstart, INDEX, PROJECT_WIKI, focused AI panel/editor routing/observability guidance and entire DESIGN.md before source edits.
- Reused vanilla DOM `el`, deck/status styles, native summary/buttons, keyed sticky rows, current semantic/spacing/font tokens and existing composer. No framework/dependency, asset, theme, redesign, coach mark, tutorial, model tool, backend authority change or QA assertion change.
- `renderRunOutcome(RunOutcome)` maps each typed axis to concise Korean text and exposes exactly `data-testid="ai-run-outcome"`, `data-execution`, `data-goal`, `data-delivery`. `response-final` is `응답 종료`, not goal completion. Renderer tests cover all 90 legal axis combinations without asserting prose.
- The Panel reads `session.getRunOutcome()` in the runner's existing guarded terminal settlement, after actual apply/proof. New turns and conversation boundaries clear the old surface. Idle store notifications refresh the live projection, preserving receipt/assessment freshness. No status is reconstructed from scheduler completion or model text. The outcome sits outside the transcript's history folding, immediately above the composer.
- `ai-requirement-withdraw` carries the exact requirement ID. The genuine click calls `withdrawAiRequirement` -> the registered Panel host -> `session.withdrawRequirement({ acceptanceId, requirementId, reason })`. The canonical authority records `source: "user"`; no model command can invoke this host action. The explicit action records the reason that the user excluded this requirement from completion scope. Original source text and exclusion reason remain inspectable in the existing disclosure.
- Busy/withdrawn actions disable; rejected requests expose a local polite status instead of pretending success. Disclosures, focus, map navigation, compact/manual expansion and existing verified/all sticky count remain intact. Optional requirements are labelled as optional, never labelled verified solely for being optional. Withdrawal updates the real snapshot and outcome; a false evidence item stays false.
- Continue uses the existing `AiRunSurface.sendText` path. Only the explicit surface continuation token changes Panel mode and paints the composer as Do. Normal typed Ask/Plan sends are unchanged. No test-only `goalAction`, backend projection override, synthetic button or model shortcut was added.

## Fresh responsive capture packet for independent review

Every listed state has actual screenshots at **1024x768, 1280x800, 1440x900**. Filenames are `<state>-1024.png`, `<state>-1280.png`, `<state>-1440.png`; original default screenshots are also retained. The native contract driver remains unchanged. `test/aiOutcomeBrowserEvidence.mjs` wraps only real screenshot boundaries, observes geometry/computed styles and captures viewports. It does not inject DOM content, session state, outcomes, tools or transport scripts. It restores the original viewport and verifies source hashes did not change during execution.

### Outcome matrix

Directory: [ui-final-outcome-matrix](ui-final-outcome-matrix/)

- **148/148 checks; 48 PNGs; 36 viewport measurements; zero page/route errors.**
- State labels: `00-before`, `query-no-change`, `awaiting-user`, `ordinary-apply`, `cancelled-applied-before-abort`, `cancelled-applied`, `rejected-apply`, `commit-log-failure`, `failed-proof`, `budget-exhausted`, `legacy-unassessed`, `legacy-assessed`.
- Raw contracts: [actions.json](ui-final-outcome-matrix/actions.json).
- DOM measurements: [ui-dom.json](ui-final-outcome-matrix/ui-dom.json).
- UI source identity: [ui-source-identity.json](ui-final-outcome-matrix/ui-source-identity.json), [ui-source-stable.json](ui-final-outcome-matrix/ui-source-stable.json).

### Required skip and actual user actions

Directory: [ui-final-required-skip](ui-final-required-skip/)

- **107/107 checks; 44 PNGs; 33 viewport measurements; zero page/route errors.**
- State labels: `00-before`, `required-skip`, `optional-skip`, `replan-preserves-required`, `user-withdrawal`, `user-withdrawal-withdrawn`, `blocked-ask-resume`, `blocked-question-in-flight`, `blocked-question-settled`, `blocked-user-resume-in-flight`, `blocked-user-resume-settled`.
- Raw contracts: [actions.json](ui-final-required-skip/actions.json).
- DOM measurements: [ui-dom.json](ui-final-required-skip/ui-dom.json).
- UI source identity: [ui-source-identity.json](ui-final-required-skip/ui-source-identity.json), [ui-source-stable.json](ui-final-required-skip/ui-source-stable.json).
- Real click evidence: unmet requirement excludes only its own denominator; false evidence/history remains. Ask preserves blocked work. Continue actually sends `composerMode: "do"`, reactivates the same item during execution and settles **blocked/incomplete/no-change** when required work remains unmet. Getter/result/harness/bridge/activity/recap/event/UI agree.

### Measured findings, not an image verdict

- All 69 viewport observations have document width at or below viewport width.
- All 54 captured terminal outcome instances are visible, wholly in viewport, unclipped by measured ancestor overflow and without text horizontal overflow. In-flight states intentionally have no stale terminal outcome.
- At 1440px, unverified requirement actions are visible and 32px high; real in-flight Ask/resume disables them. After withdrawal the same action is visible, disabled and retains its requirement identity. Verified items' actions are hidden. At 1024px the inherited sticky compact default remains; there is no new mobile behavior or forced expansion.
- Source binding in [ui-binding.log](ui-binding.log) compares both packets' upstream 16-source hashes and UI/test/DESIGN hashes to the exact committed implementation. Capture HEAD remains honestly recorded as the pre-commit parent; byte identity, rather than a rewritten report SHA, binds the capture to the implementation commit.
- Attempting to read `ui-outcome-matrix/query-no-change.png` returned: **Current model does not support images; image omitted.** No pixel, Korean glyph, contrast, occlusion, stylistic or independent visual pass is claimed. Geometry is evidence, not substitute visual approval. The lead explicitly owns read-only image-capable review of this packet.

## Failing-first evidence and correction history

Original reports are unchanged; fresh captures use distinct directories.

1. `npm test -- test/aiOutcomePresentation.test.ts --maxWorkers 1 --minWorkers 1` -> **exit 1**, 92 failures/1 passing control. [ui-red.log](ui-red.log). Before implementation, the actual renderer export/action/busy API were absent. Action cases use real session/parser/ledger fixtures, not fabricated authority.
2. Initial five-file UI run -> **exit 1**, 126 passes/6 failures. [ui-green-attempt.log](ui-green-attempt.log). The full mocked session in `aiAutonomousRunSurface` lacked the newly consumed getter, interrupting terminal UI cleanup. Its narrowly added `getRunOutcome(): null` restores the truthful unassessed test-double contract; production checks were not weakened.
3. Initial actual `outcome-matrix` -> **exit 0**, 148/148. [ui-outcome-matrix](ui-outcome-matrix/) retains its original 12 default PNGs and is **not** responsive coverage.
4. First responsive `required-skip` -> **exit 1**, 96 passing checks and **11 failures**. [ui-required-skip](ui-required-skip/) and [command log](ui-required-skip-command.log) are preserved. Actual clicked Continue painted Do but still sent Ask: `createComposerElements.setMode` paints only and does not invoke `modeChips.onChange`. First causal failures were blocked rather than in_progress and Ask rather than Do; nine terminal axis checks followed. The Panel now explicitly sets its owned `composerMode = "do"` before painting and sending. No backend or harness change masked the failure.
5. Intermediate corrected responsive `required-skip` -> **exit 0**, 107/107. [ui-required-skip-responsive](ui-required-skip-responsive/). Final packets above add full UI source identity and stable-source verification.
6. A five-file test run with a 300-second outer tool limit timed out without a captured npm exit. [ui-green.log](ui-green.log) remains partial evidence, not GREEN. Process inspection found no surviving owned test process. No test timeout/assertion was changed. Dedicated autonomous test then passed 12/12, exit 0 ([ui-autonomous-attempt.log](ui-autonomous-attempt.log)); the final complete six-file run passed below.

## Final commands and direct exits

All commands ran in the owned P2 worktree. Raw combined output was redirected without piping away command exit status.

```sh
npm test -- test/aiOutcomePresentation.test.ts test/aiContinueUserAction.test.ts test/aiStickyChecklist.test.ts test/aiAutonomousRunSurface.test.ts test/aiWorkPlanTerminalFocus.test.ts test/aiRetryWorkPlanLifecycle.test.ts --maxWorkers 1 --minWorkers 1
npm run build
node --check test/aiOutcomeBrowserEvidence.mjs
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/ui-final-outcome-matrix xvfb-run -a node test/aiOutcomeBrowserEvidence.mjs --scenario outcome-matrix
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/ui-final-required-skip xvfb-run -a node test/aiOutcomeBrowserEvidence.mjs --scenario required-skip
```

Every command above exited **0**. Tests: 133 passed, six files, 269.25s, no failures/skips ([ui-final-green.log](ui-final-green.log)). Build includes app typecheck, editor, player/SDK and standalone ([ui-final-build.log](ui-final-build.log)). Earlier build is retained separately. The final code/test bytes were not changed after verification.

All changed TypeScript source/test files received clear LSP diagnostics. CSS diagnostics are unavailable because Biome is not installed; the explicit no-dependency scope was respected. The actual Vite build parsed CSS and real-browser computed styles/geometry were measured. JavaScript capture instrumentation passed `node --check`; no broad Lighthouse/performance/full-gate work was run. Build warnings (existing optional provider configuration, circular/mixed chunks, unresolved forest image, large bundles) remain unsuppressed. `git diff --check` and staged source whitespace validation passed.

Tests assert machine attributes, disabled/action behavior, original source retention, real canonical evidence, native keyed disclosure/focus behavior and Panel send options. They do not pin Korean prose or prompts. New async tests subscribe to terminal publication before clicks with bounded deadlines, no sleeps/polling. UI mapping combinations are unit input fixtures; real browser packets derive every outcome from the actual session/tools/store/native transports and Supabase, with only the existing labelled LLM/transport faults scripted.

## Cleanup and delivery

Every actual run reports owned browser/server/cache/port closure, page listener/timer cleanup, no reused listener, `activeRoutes: 0`, and remote deletion plus absence proof for project/maps/tilesets/observed commits/changes:

| Evidence directory | Run-owned project | Exit |
| --- | --- | --- |
| ui-outcome-matrix | `qa-ai-surface-0c5078df-fbb8-48f1-ab2d-a807525c7bdf` | 0 |
| ui-required-skip (preserved RED) | `qa-ai-surface-078df589-7f04-48b9-bcb7-09ad7da12fde` | 1 |
| ui-required-skip-responsive | `qa-ai-surface-bbfc331e-e22c-4ca9-a52f-40107e31af53` | 0 |
| ui-final-outcome-matrix | `qa-ai-surface-6722a1f8-91c8-43e6-8bf2-6b8319a7ee00` | 0 |
| ui-final-required-skip | `qa-ai-surface-4a5dcf3b-a94b-4452-8922-b25101fc96d7` | 0 |

Configured credential-value scan passed over browser evidence without printing secrets. The source/DOM binding command exited 0. No backend/P1 receipt/proof owner, approval policy, apply/undo, region behavior, acceptance/image baseline, native transport/parser or advisory policy changed. No pushes, merges, nested agents or shared-main edits occurred.

Ordered own commits: implementation `c8fa4e965396cb53bc2f453a02c7752b64c4a0e3`, followed by the evidence-only commit reported in the task handoff. The matching wiki publication is owned by the downstream docs node; DESIGN's state contract is already included. Final independent visual approval, surface-node verification, full gates and exact-head approval remain lead-owned. This node does not claim those gates, a new dedicated P1 proof-failure scenario, or mobile-editor support.
