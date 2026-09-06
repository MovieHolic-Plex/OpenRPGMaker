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
