# Economic correctness increment

Implemented on feat/shop-equipment-comparison-20260907. No commits or canonical/DB changes.

## Changes

- `src/project/shopPrice.ts`: both database price lookups now use item-first, equipment-fallback resolution.
- `src/project/shopStock.ts`: social pricing uses the same equipment fallback. This sibling omission was found during tracing and reported before editing.
- `src/player/playSceneShopParts.ts`: moved row capacity assignment into the shared affordability update, which runs on creation and every successful transaction refresh. No transaction, keyboard, or preview redesign.
- `test/shopPrice.test.ts`: default equipment price, floor/discount and override/season priority, zero/item precedence, social pricing.
- `test/shopRuntimeUx.test.ts`: real playShop keyboard transactions exercise buy/sell budget caps, inventory caps, other rows, last-copy reselection, clamping/total, and zero-capacity rejection.
- `scripts/qa/runtime/shop-decision-report.mjs`: economy-only shipping-player QA using runRuntimeQa and existing file-backed routing; per-action states, screenshots, assertions and finally cleanup receipts.

## RED before GREEN

| Log | Result |
| --- | --- |
| price-baseline.log | Unchanged initial baseline, 2 passed; apply_patch was initially absent from PATH, so this is not RED evidence. Subsequent edits used /tmp/apply_patch. |
| price-red.log | Exit 1: 3 intended failures. Default equipment 0 vs 40, floor 7 vs 20, social equipment 0 vs 30. |
| price-green.log | Exit 0: 6 passed. |
| quantity-red.log | Exit 1: all 5 new integration cases fail on stale caps/quantity/total; 18 existing tests pass. |
| quantity-green.log | Exit 0: requested combined pricing/UX command, 29 passed. |
| economic-regressions.log | Exit 0: 55 passed across merchant gold, haggle, validation/key, feedback, friendship/shop tests. |
| economic-safety.log | Exit 0: 34 passed across P0 commerce final safety and economy followup tests. |
| browser-economy.log | Exit 0: shipping build plus full economy scenario. |
| typecheck-app.log | Optional app-wide check exceeded the tool's 120-second limit without a completion exit; unverified, not green. |

Changed-file LSP diagnostics reported no diagnostics for all five changed TS files before the shipping build, and none for the new MJS entry point. `node --check` and `git diff --check` passed.

The shipping build emitted warnings for an unresolved battle-reference-forest.png at build time, a mixed static/dynamic playSceneInterpreter import, and large chunks. None was suppressed or changed by this increment.

## Browser economy

Command: `node scripts/qa/runtime/shop-decision-report.mjs --case economy`

Fixture has equipment database base price 40, no stock override, player 100, merchant 200. Uses the built shipping `player.html` and export store shim, not the editor.

| State | Player | Merchant | Owned | Row cap | Input max/value | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Stock | 100 | 200 | 0 | 2 | 2 / 1 | 40 |
| Buy two | 20 | 280 | 2 | 0 | 1 / 1 | 40 |
| Rejected further buy | 20 | 280 | 2 | 0 | 1 / 1 | 40 |
| Sell selection | 20 | 280 | 2 | 2 | 2 / 2 | 40 |
| Sell last two | 60 | 240 | 0 | no row | empty list | 0 |

Keyboard path: Enter, ArrowRight, e, e (rejection), Escape, ArrowDown, Enter, ArrowRight, e, Escape, Escape. The existing harness faces/activates the merchant before this sequence. No pointer click bypass. Equipment assignments remain unchanged and the player returns to x14/y18.

Evidence: `../economy/runtime-results.json`, `action-ledger.json`, nine numbered PNG/JSON pairs, `boot/SUMMARY.md`, and `cleanup.json`. Zero browser errors, network failures, or capacity warnings. Screenshots were captured but image pixels were unavailable to this model; no subjective visual sign-off.

## Cleanup and limitations

Five resources registered immediately after acquisition and closed in finally: page, isolated context, Chromium, QA server (127.0.0.1:37349), and the unique `.vite-cache/shop-decision-player-CzPOna` bundle. Receipts show all closed; an independent filesystem check confirms that bundle no longer exists. Previous artifacts were not removed or edited.

This child did not expose task_send or monitor tools. Milestones were emitted in commentary; commands used bounded foreground execution with direct pipeline exit-code capture. The lead owns notebook updates, reruns and commits. No shared notebook edits or commits were made.
