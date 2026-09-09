# Phase 1 implementation evidence

Worktree: `/home/main/z-project/rpg-zzu-house-protection-p1`
Base: `32ef1bcd66476d09486a8a09893da02184d2ebd5`
Task: `st_01a072b5` (omo)

## Delivered invariant

Every write is checked against current accepted house metadata/cells and newly
completed snapshots after global tree repair, before commit, including dry-run.
Standalone/lots and legacy houses register durable geometry before postprocess;
standalone seals also survive later work within their transaction. Village
registration remains at pipeline end (Phase 2 early sealing is not implemented).
Old village house regions survive subsequent successful builds with unique IDs.

Protection covers both bases, sparse stacks, emptiness, clipped bbox/ridge, human
placement rectangles, and only metadata-evidenced existing roof-deck attachments.
It rejects structural metadata loss, map deletion/cropping/tileset-ID changes and
new overlaps even with identical tiles. Selection and all generic destructive
BuildSpec permissions stay valid for non-house content but cannot bypass houses.
Human direct-edit paths, schema and UI are unchanged.

## RED -> behavioral GREEN

- `red-command.txt` and `red.txt`: exact pre-production command and raw output.
  **Exit 1: 54 failed, 45 passed (99)**. Missing protection allowed erasure, stack
  changes, metadata removal, global repair spillover and identical-tile overlap;
  standalone/lots registration was absent and village layout dropped old houses.
- The initial RED also exposed an existing module-size failure (228 > 220) and
  a new door fixture using ambiguous material `문`. The latter was corrected to
  the actual group label `문/입구`; no production material behavior was changed.
  Roof-deck tests were tightened after supervisor guidance to require existing
  shape/tag evidence, and a negative raw-adjacent-ladder case was added.
- `focused-final.txt`: exact final bounded command and complete output.
  **Exit 1: 154 passed, 1 failed (155)**. All Phase 1 behavioral cases pass,
  including all 16 session permission combinations and all four incremental
  primitives. The only failure is the untouched size assertion in
  `test/houseKitDomainSeam.test.ts`:
  `keeps one exhaustive public kit list and a safe HouseKit module size`:
  **233 > 220** (the domain grew five measured lines over the RED 228).
  This is not claimed as a fully green command; no test was skipped, disabled,
  or loosened. The supervisor requested bounded handoff rather than a support
  module extraction outside the listed production scope.
- `typecheck-final.txt`: `npm run typecheck:app`, **exit 0**.
- Diagnostics: all changed TypeScript production and test files were checked via
  `lsp_diagnostics`, final results empty. A new fixture Trigger shape diagnostic
  was corrected to `{ kind: "action" }` before final tests/typecheck.
- Source/test/wiki `git diff --check`: **exit 0**. After staging the raw RED
  log, the full cached check reports trailing spaces emitted by Vitest; the raw
  evidence is preserved unchanged. `npm run openwiki:index -- --check`: **exit 0**.
  The index was rendered with the repository's `collect`/`render` implementation
  in memory and applied through `apply_patch`, per supervisor edit constraints.

## Supervisor rerun

The exact bounded command is the first line of `focused-final.txt`. Primary files:

- `test/houseProtection.test.ts` (23 passed)
- `test/toolHouseProtection.test.ts` (12 passed)
- `test/assistantMapPreservationGuard.test.ts` (21 passed, 16 new combinations)
- `test/constructionToolsV3.test.ts` (26 passed, 4 new primitive equivalence cases)
- `test/houseKitDomainSeam.test.ts` (9 passed, inherited size gate still fails)
- `test/villageBuilderSeam.test.ts` (9 passed)

Other bounded final files: `aiSpecGateHardening`, `houseKitDecor`, `villageWrites`,
`villageWingGeometry` (all passed).

## Wider exploratory run and limits

Command (exit 1, 104 passed / 7 failed):

```
npm test -- test/constructionToolsV3.test.ts test/toolHouseProtection.test.ts test/authorHouseFacade.test.ts test/houseLotTools.test.ts test/houseKitDecor.test.ts test/villageWrites.test.ts test/villageWingGeometry.test.ts test/aiSpecGateHardening.test.ts
```

One failure reflected the intentional new replay code `house-overlap` rather
than `construction-zero-change`; its direct contract assertion was updated in
`test/support/authorHouseFacadeFailureCases.ts`. The final complete facade rerun
(`npm test -- test/authorHouseFacade.test.ts`, `facade-final.txt`) confirms the
changed replay case passes: **8 passed / 4 baseline-matched failures, exit 1**.
Six unrelated failures in the exploratory run were left unchanged:

- `authorHouseFacade`: two construction-outcome equality cases add parsed
  `mapPropertiesChanged: 0`; invalid-wing case accepts normalized input;
  yard-shortfall expects `yard-placement-shortfall`, receives `placement-zero`.
- `houseLotTools`: flowers resolve missing; sign yard returns `placement-zero`.

The supervisor supplied the immutable baseline report before handoff. All six
failures above and the 228 > 220 size failure match its `fullName` and
`failureMessages`; the exact selected baseline records are preserved in
`baseline-related.json`. No unrelated fixes made.
The initial `npm run build` attempt hit the execution tool's **300-second timeout**
without a captured command exit/output; it is unverified, not a passed build.
After supervisor direction, no full gates/build retry was attempted. Full gates,
build, immutable baseline comparison and actual-editor browser E2E belong to the
supervisor/dependent browser node. No Phase 2 proactive skip/detour was added.

## Files

Production: `houseProtection.ts`, `toolRunner.ts`, `houseKitDomain.ts`,
`mapTools.ts`, `village/houses.ts`, `village/builder.ts`, and guidance only in
`assistantSession.ts` / `buildSpec.ts`. Tests: the six primary files above,
`test/fixtures/completedHouse.ts`, and the facade replay assertion. Documentation:
`openwiki/editor-ai-tools.md` and generated `openwiki/INDEX.md`.
`contract.md` is preserved unchanged. No push, PR, merge, or destructive git.
