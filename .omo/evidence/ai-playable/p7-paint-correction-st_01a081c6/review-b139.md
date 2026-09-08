st_01a081b5 [completed] model gpt-6-astra (reasoning max, variant max)
**SOURCE NOT CLEAR** for exact head `b139e4e24144ad48c298f06e32fe7fa66892f7ac`, base `abd90de`. Both requested concerns are concrete native regressions. The candidate remains clean and unchanged.

Paths below are relative to `/home/main/z-project/rpg-zzu-p7-preserved-wall-st01a08194`.

## CR-1 [P2]: An earlier partial no-op vetoes a later complete repair

**Fault:** `src/ai/proposalCompleteness.ts:109-110,123-125,153-155`.

Once any intersecting no-op becomes a candidate, the helper's `false` overrides ordinary changed coverage through `??`. Changed operations cannot contribute to its coverage set.

**Native reproduction:**
- Baseline top row: one cell is 306; eleven are 112.
- Paint the already-correct cell with 306: `ok:true`, changed **0**, touched **1**, skipped **0**.
- Paint **all twelve explicit cells** with 306: `ok:true`, changed **11**, touched **12**, skipped **0**.
- Current row is entirely 306.
- Completeness with the full repair alone: **no warning**.
- Completeness with both operations: **unfulfilled warning**.

This is the strongest recovery case: same tile, exact full-cell coverage, successful native receipt and matching current state—not an unrelated changed rectangle.

Evidence: `/tmp/st_01a081b5-review/native-countercases-final.log:109-232`.

**Required correction:** Allow a genuinely complete, host-verified explicit-cell changed operation to satisfy this coverage path. Do **not** replace `??` with blanket `||`: the independent later-single-cell-invalidation case correctly remains unmet and must stay so.

## CR-2 [P2]: Current metadata reassigns historical coverage to the wrong layer

**Fault:** `src/ai/proposalCompleteness.ts:133,140-142,148-151`.

The helper recomputes the operation's effective layer using the **current** tileset. Native painting chose its layer at execution time (`src/editor/tools/mapTools.ts:347-360`), but its structured receipt does not retain that layer (`:397`).

**Native reproduction:**
- Establish tile 306 on both layers using native setup operations.
- With tile 306's home set to **upper**, request `layer:"lower"` over twelve explicit cells.
- Native painting routes to **upper**, returning changed **0**, touched **12**, skipped **0**.
- Before the metadata edit, completeness correctly credits upper and rejects lower.
- Run native `set_tile_rules` to make 306 lower-home. It changes **one tileset and zero cells**; both arrays remain identical.
- The same historical paint now incorrectly credits **lower** and rejects **upper**.

Thus matching numeric tile values on the current layer do not establish that the historical operation touched that layer. The working native case uses upper painting, which preserves lower; the inverse setup would clear upper through `mapHelpers.ts:50-55`.

Evidence: `/tmp/st_01a081b5-review/native-countercases-final.log:235-412`.

**Required correction:** Retain the effective layer as immutable, host-generated execution evidence and consume it here. A small structured native receipt field is a justified scope expansion; current metadata or parsed summary prose is not a substitute.

## What held

- Independently reproduced P7's **80 changed floor cells + 24 unchanged walls** with no completeness warning.
- No-op walls still contribute no meaningful change or changed regions.
- Sparse cells did not acquire bounding-box interior coverage, for either changed or unchanged painting.
- Genuine quantity/change warnings, partial-only rejection and later-invalidation rejection remained intact.
- Source consumption is consistent: automatic completion and review use `this.ctx.project`; terminal accounting uses its detached equivalent, `getProposedProject()`. Applied-plus-pending accounting remains intact (`assistantSession.ts:3127-3134,4242-4254`; `aiTurnRunner.ts:494-505`; getter at `assistantSession.ts:1250-1252`). Both regressions therefore affect the shared predicate, not merely one caller.
- Canonical `preserve` versus `targetChange` still compares original/current content independently (`assistantAcceptanceEvaluation.ts:132-140`).

## Verification and wiki

The bounded native driver completed with **7 passing checks and 3 failed checks representing these two CRs**, exit **1**:

```sh
node_modules/.bin/vite-node \
  --config /tmp/st_01a081b5-review/vite.config.mjs \
  /tmp/st_01a081b5-review/native-countercases.mts
```

Full receipts: `/tmp/st_01a081b5-review/native-countercases.json` and `native-countercases-final.log`.

I read both requested review receipts and confirmed the supervisor JSON reports **94 passed, 0 failed, 0 pending**. The supervisor supplied app-typecheck exit **0**; its log is present. Those tests omit these recovery/metadata-transition cases. The documented **12 baseline fake-DOM failures and three baseline fixture type errors remain separate**, not attributed to this fix.

`node scripts/openwiki-index.mjs --check` fails because the index is stale. The new paragraph shifts the following heading from **1168 to 1185** and the page from **1217 to 1234 lines**, while the index retains the old coordinates. Update the paragraph to describe corrected historical-layer/recovery semantics and regenerate the index with the repair.

**Recommendation:** Hold b139 for the two narrow corrections above. No repository source/test edits, broad suite, build, browser, live model, DB/network operation or game change was performed. Combined build and real UI proof remain parent-owned; this verdict grants neither game nor merge approval.
