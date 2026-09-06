# R8 follow-up: item-local quantity completeness

Base: c1c5f805add2b58cea9abfe8b5a798b86c610f30 (not amended).
Worktree: /home/main/z-project/rpg-zzu-ai-spatial-obligations-0906.

## Confirmed parent finding

Reproduced with real `place_npc` draft tool results and the session's
`noteSuccessfulTools -> autoCompleteGate` advancement path. The first item adds two
NPCs and completes. The next item requests three new NPCs, adds one, and wrongly
completes because ordinary completeness sees earlier placements. This reproduces
both with already-applied milestones and with still-pending earlier proposals,
and both with and without an active spatial BuildSpec.

Red command:

```sh
npm test -- test/assistantSpatialObligations.test.ts -t 'does not count prior NPCs' \
  --maxWorkers=2 --minWorkers=1
```

`output/r8-quantity-red.log`: four failures, each receiving `["done", "done"]`
instead of `["done", "in_progress"]`. No provider or completion gate is mocked.
Only the external milestone apply/persistence boundary is replaced.

## Focused correction

- Record current-item proposals at the existing proposal-upsert boundary, before
  cross-item pending-event folding. Clear that ledger with other item evidence,
  not on a continuation within the same item.
- Automatic completion applies ordinary quantity/diff checks to item-owned calls,
  independently of the presence of a BuildSpec.
- Retained pending/applied calls feed only spatial coverage. Reuse the existing
  pure `buildSpecCompletenessWarnings` function (now exported), instead of feeding
  the complete historical ledger through ordinary request completeness.
- Existing fulfilled-pond/NPC, exact dialogue, bounded viewport, overwrite
  protection, and continuation assertions remain. Private-seam fixtures now
  register current writes through the real proposal-upsert boundary.
- The new regression additionally supplies the later item's remaining two NPCs
  and checks successful advancement without recreating the first group.

## Verification

```sh
npm test -- test/assistantSpatialObligations.test.ts test/proposalCompleteness.test.ts \
  test/viewRelativeLocation.test.ts test/aiSpecGate.test.ts \
  test/assistantAcceptanceRequestBaseline.test.ts --maxWorkers=2 --minWorkers=1
npm run typecheck:app
git diff --check
```

Green: **129 tests passed, five files, exit 0** (`output/r8-quantity-green.log`).
App typecheck exit 0 (`output/r8-quantity-typecheck.log`). LSP diagnostics for
all three changed TS files returned no diagnostics. Diffcheck passed.
No new failing validation remains in this follow-up. The separately documented
pre-existing hardening-test failure from the original R8 report was not rerun here.

R9 target-result accounting/outcomeGate and R12 final-artifact reporting are
untouched. Additional session overlap: `resetWorkItemEvidence`, `upsertProposal`,
and `autoCompleteGate`. Keep the parent's existing target-result reset alongside
the new item-proposal reset when integrating.

No server, browser, live content, remote DB, environment-file, port, push, or merge
operations. Parent retains build/broad-gates/browser/live-AI/ultrabrain ownership.

## Integrated R9 fixture correction

Parent worktree: `/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906`, branch
`agent/ai-playable-reviewed-followup-0906`, starting head
`6b2af9330298d76e8b6daf5c0b7bb49bb5698340`.

Before editing the fixture, the four quantity cases all failed at the first-item
transition: expected `later`, received `first`. The integrated R9 gate requires
mapTargets and recorded per-target outcomes. The fixture supplied neither.

The test-only correction declares `mapTargets:[project.startMapId]` for both
items, passes each real `runTool(place_npc)` result through `recordToolResult`
before proposal registration, and advances using the actual successful-tool set.
All quantity/advancement assertions and all four applied/pending, spec/no-spec
cases remain unchanged. No production checks or parent run-state were changed.

Red command (4 failed):

```sh
npm test -- test/assistantSpatialObligations.test.ts -t 'does not count prior NPCs' \
  --maxWorkers=2 --minWorkers=1
```

Combined green commands:

```sh
npm test -- test/assistantSpatialObligations.test.ts test/proposalCompleteness.test.ts \
  test/viewRelativeLocation.test.ts test/workPlanMapOutcomes.test.ts \
  test/workItemOutcomeTargetMap.test.ts test/assistantAcceptanceDiagnostics.test.ts \
  test/assistantAcceptanceProvider.test.ts test/assistantAcceptanceSession.test.ts \
  test/assistantAcceptanceRequestBaseline.test.ts test/assistantImageEvidence.test.ts \
  test/assistantImageTransport.test.ts --maxWorkers=2 --minWorkers=1
bun test test/ohMyPiImageTransport.bun.test.ts
npm run typecheck:app
git diff --check
```

Results: **161 Vitest tests passed / 11 files**, **15 Bun tests passed / 1 file**
(single Bun run), app typecheck exit 0, changed-test LSP diagnostics clean,
diffcheck exit 0. Logs: `/tmp/r8-fixture-integration-MhB98T/{red.log,green.log,bun-image.log,typecheck.log}`.
Build, broad gates, browser, live AI, and ultrabrain review remain parent-owned.
