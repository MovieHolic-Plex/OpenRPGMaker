# Exact upstream integration (st_01a0780b)

## Identity and scope

- Candidate / first parent: `b8214e86d997d74c14a77e55fc4b0595e46800ae`.
- Exact upstream / second parent: `5d2649d0cd0baf83d3a30036955ff24ce149f689`.
- Merge base: `58105616bb4b970f8012e43fc20498bbe9c9d11a`.
- Branch: `agent/ai-playable-main-integration-0907`.
- Worktree: `/home/main/z-project/rpg-zzu-ai-playable-main-integration-0907`.
- Created with `npm run wt -- create ai-playable-main-integration-0907 --base <candidate>` and explicitly adopted with `npm run wt -- adopt ... --path ...`.
- Full merge, not selected cherry-picks: all 542 upstream changed files retained. No newer main, remote mutation, push, PR, game QA, browser, model request, or authored-project/DB operation.
- Shared main and the frozen adversarial/QA worktrees received no source edits. Exact-revision comparison sources were extracted into this worktree's ignored evidence directory; the parent's baseline tree was not modified.

## Seven content conflicts and their resolutions

1. `assistantAcceptanceLedger.ts`: keep structured repair/review diagnostics, R18 original-target admission checks and immutable request baselines/bindings; add upstream intent-owned action requirements, authentic map-bound action receipts, permanent proof retirement and required-verification blockers. The sole production repair caller reads `result.ok`, not object truthiness.
2. `assistantAcceptanceTools.ts`: retain the candidate's provider-safe field-superset schema and exact-cell/creation guidance. Preserve upstream action-combat/planner requirements. Add the missing `actionCombat` canonical example in `assistantAcceptance.ts`, so the example-derived enum and normalized schema include all eight supported kinds.
3. `assistantSession.ts`: combine upstream map-keyed specs, delayed successful expansion, wiki checkpoints, NPC reward auditing, persistent verification requirements and asynchronous action dispatch with candidate item-owned quantity/target evidence, immutable viewport permits, image delivery and combined final assessment. Select completion specs per changed map, with an optional work-item filter for inferred viewport ownership. Fold upstream NPC completion problems into final assessment rather than discarding them. Verification requirements clear on explicit context reset, not every new message.
4. `proposalCompleteness.ts`: retain the exported coverage function needed by candidate item-scoped checks and upstream map-qualified plural warnings; optional `qualifyMap` preserves existing call sites.
5. `resourceSearch.ts`: retain candidate native charset frame metadata and upstream audio raw IDs/full descriptions; do not restore obsolete music/sound imports.
6. `editor-ai-panel.md`: preserve both R8 viewport/item protections and upstream explicit terrain-before-road overlap rules.
7. `editor-ai-tools.md`: preserve both candidate native/tile contracts and upstream action-guide/audio/wiki documentation.

Cleanly merged features were not replaced. In particular, action proof, scene runner/cancellation, tool-verification identity, intent/wiki integration, application lineage and store files match exact upstream. `walkthroughRunner.ts` matches upstream: its only difference from candidate is refusal of unresolved battle-event choices, not automatic touch dispatch. Candidate `play_walkthrough` prose explicitly states that `moveTo` does not execute playerTouch/eventTouch and that transfer events require explicit interaction. Exact-cell acceptance reachability remains distinct from interaction approach cells.

## Minimal test integrations

- Action requirement repair now asserts `{ok:true, code:"repaired"}` instead of the superseded boolean return.
- Provider normalization checks eight canonical criteria, explicitly including actionCombat.
- Spatial tests set canonical map-owned specs via `rememberSpec`, replacing writes to the removed private `activeSpec` field; all R8 assertions remain.
- Upstream two-region completion fixture supplies candidate-required `mapTargets:["m1"]` for each spatial item; no completion assertion was removed.
- Final-assessment tests assert upstream's extra `required-verification` item while a check remains negative, and its removal after the ending defect is actually repaired. Original acceptance, defect, milestone and no-replay assertions remain.
- Persistence-proof tests reset the global intent cache per test. Their neighboring no-plan and planned fixtures use identical request/map keys but different injected declarations; cache contamination made proof scheduling depend on test order/TTL. Original retry/proof/no-replay assertions remain; the failed-proof case additionally asserts that its first run finishes and yields an actual failed receipt before retry. No production persistence behavior changed.
- Bun full-corpus coverage now takes current `toOpenAiTools(allTools())`, work-plan tools and acceptance tools. Captured48 remains a separate regression case and no longer shadows current definitions. Both Antigravity model paths verify 206 current declarations, action acceptance, selectors, action tool, scene reward fields, numeric enum membership/arguments and actual image bytes/acknowledgements with controlled fetch. No real provider calls.

## Verification receipts

Raw receipts and command manifests are retained at:

`output/evidence/ai-playable-main-integration-0907/`

| Check | Result | Receipt |
| --- | --- | --- |
| App typecheck | exit 0 | `typecheck.txt` |
| Full production build, including app typecheck, editor, player SDK and standalone | exit 0 | `build.txt`, `build-exit.txt` |
| LSP, six integration-edited production TS files and seven integration-edited test files | no diagnostics | Child tool transcript |
| Initial combined Vitest, 111 selected files, maxWorkers=1 | **INCOMPLETE** at 1800-second command deadline; 43 completed file results, no final JSON; no processes left | `combined-command.json`, `combined-vitest.txt`, `combined-timeout.json` |
| Remaining/new/adapted Vitest, 73 files, maxWorkers=2 | 876 pass / 6 fail, exit 1 | `remaining-and-adapted-command.json`, `remaining-and-adapted-vitest.{txt,json}` |
| Final assessment after exact blocker projection adaptation | 9 pass, exit 0 | `final-assessment-vitest.{txt,json}` |
| Full persistence-proof suite after cache isolation | 29 pass, exit 0 | `proof-final-vitest.{txt,json}` |
| Exact four-file Bun wire/image/enum command | **59 pass / 0 fail**, one complete run, exit 0 | `bun-wire-exact.txt`, `bun-wire-exact-exit.txt` |
| Exact candidate comparison: aiAssistantSession + aiRunEndProof | 76 pass / 7 fail; all 29 proof tests pass | `candidate-baseline-vitest.{txt,json}` |
| Exact upstream comparison: blueprint turn end + action prerequisites + wiki application | 13 pass / 12 fail; 12 fake-DOM unhandled errors; action/wiki suites pass | `upstream-baseline-vitest.{txt,json}` |
| Source/test/wiki diff whitespace and conflict-marker checks | pass; no unresolved index paths | Child tool transcript |

The latest per-file inventory is **not one green test run**: 113 files, 1481 passing and 22 failing test results. `latest-per-file-summary.json` records provenance for each result. All seven acceptance suites total **91 passing / zero failing**, including all 14 R18 characterizations, across the two scoped commands. Other passing combined contracts include NPC reward/session, authentic action proof and requirements, scene verification/cancellation, wiki session/routing/context, multi-map specs, dependency/retry, native pages/graphics, tile-query boundaries, image evidence/delivery, map outcomes and applied-state lineage.

Earlier failed receipts are retained, not overwritten or counted as green. The first expanded Bun fixture failed during construction because captured48 includes session-owned tools absent from the ordinary registry. It was corrected to construct the live corpus directly. A subsequent successful invocation also discovered the extracted baseline copies (129 pass across nine files); the final explicit `./test/...` command removes that ambiguity and is the authoritative 59-test receipt.

Directory-wide LSP attempted to use an unavailable Biome executable; no dependency was installed. File-level TypeScript LSP diagnostics and the actual full app typecheck/build are the evidence, not a claim of directory-wide LSP success. Build warnings (chunk sizes, circular/dynamic import notices, unresolved generated battle-reference image) remain in the raw build receipt.

## Remaining failures and limits

- **Seven aiAssistantSession failures:** exact same seven test names and assertion signatures reproduced on candidate b8214e86. Not changed by this integration. Parent's previous supervisor record also identified these seven baseline cases.
- **Twelve agentBlueprintTurnEnd failures:** exact upstream reproduces all twelve terminal-log deadlines and twelve `TypeError: list.insertBefore is not a function` unhandled rejections from the fake DOM/acceptance sticky checklist. No fake-DOM cleanup or timeout change included.
- **Three unresolved 15-second test timeouts:**
  - `actionAuthoringPrerequisites`: `updates an explicitly identified spawn on retry but appends when no id is supplied`.
  - `projectWikiApplication`: `preserves newer manual wiki edits when an older authoring proposal is applied`.
  - `aiCompletionAccounting`: `auto-completes a later spatial milestone using applied plus pending writes without reapplying the first`.
  Action/wiki pass in the exact upstream focused comparison. The completion fixture's original missing-map-target assertion failure was diagnosed and its scope was supplied; the resulting run timed out rather than finishing its assertions. These timeouts are **unassigned**, not proven baseline failures or green validations. They were not retried until green and no timeout was changed.
- All-index `git diff --cached --check` reports whitespace already present in imported `.omo/evidence/sweep4-audio-ai/required-tests.log` and `typecheck-app.log`. Both index blobs were compared equal to exact upstream. Source/test/wiki whitespace checks pass. Imported evidence was not rewritten.
- Parent-reported exact5d264 gates: app typecheck/CSS pass; surface 109 pass / 6 fail; full Vitest gate timed out without a report. This child did not independently rerun those full gates and does not call them green.
- No live P1, real-player traversal, DB persistence or browser/image visual acceptance is claimed. Parent owns final gates and game QA. This commit is the local integration deliverable, not R6/gameplay approval.
