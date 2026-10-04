# Independent review of measurement interpretation

The first two reviews preceded the later Progress/Tab/Ctrl+A capture; the supervisor README contains final measured status.

## palette-maps

Reviewed baseline `2cd0368b93`; audited production areas unchanged. Wall times include **250ms settling, automation and frame waits**; they are not CPU latency. Long tasks cover the observation window without function attribution.

1. **Highest priority — MEASURED Life collections: lost typing and excessive hidden DOM.** Native `abc` typing produced `a`, focus `BODY`, even with 10 fish. At 100 fish × 1,000 items, zero-match searches retained **100,000 options and 99 hidden inspectors**; median wall time was 2,233ms. [Measurements](/home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/editor-ux-audit-round2-20261004/life/measurements.json).
   Source confirms search requests rerender at [databaseLifeCollectionsView.ts:101](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:101), eagerly constructs every inspector at [line 122](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:122), and every dropdown option at [line 797](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:797). Preserve the search node; mount only the selected inspector. `fill()` trials establish search behavior, not successful continuous typing.

2. **Next — MEASURED map tree duplication.** `treeReplacements=4` means **four childList records: two clear/append pairs**, consistent with selection plus explicit rerender at [mapList.ts:1288](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapList.ts:1288) and its synchronous subscriber at [mapSidebarSection.ts:26](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapSidebarSection.ts:26).
   Wall medians: 395/555/2,540ms for 10/100/300 maps; these do not isolate duplication’s contribution. Use one refresh owner and compute map count once.

3. **Then — MEASURED offscreen charset work.** Over two seconds: **320 visible / 1,216 offscreen drawImage calls**; after closing: **zero**. [Extras measurements](/home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/editor-ux-audit-round2-20261004/extras/measurements.json).
   [resourceManagerViews.ts:510](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:510) checks connection, then advances every preview at line 520. Suspend offscreen animation. Counts use vertical viewport intersection; instrumentation adds geometry reads, so CPU savings remain unmeasured.

Filtered palette rebuilding and collapsed Progress cloning remain **CODE-ONLY**, below these measured findings.

## database

Reviewed [Life measurements](/home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/editor-ux-audit-round2-20261004/life/measurements.json), [extras](/home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/editor-ux-audit-round2-20261004/extras/measurements.json), and capture script against baseline `2cd0368b93`.
**Validity:** wall times include automation, 250ms settling and two frames; they are not CPU latency. Long tasks are page-wide observations under uncontrolled host load, without function-level attribution.

1. **Highest priority — MEASURED: Life search amplification and lost typing.**
   Zero-match search retains **100,000 options and 99 hidden fish panels** at 100×1,000; repeated runs contain substantial long tasks. Construction is explained by [databaseLifeCollectionsView.ts:122](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:122) and [item dropdown:351](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:351).
   Separately, native `abc` at 180ms intervals produces `a`, focus `BODY`: the new focus defect is measured; [database.ts:1015](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/database.ts:1015) explicitly blurs.
   Remedy: retain search/caret and the selected inspector; update results independently.

2. **MEASURED + source-confirmed: map switching rebuilds the tree twice.**
   Every switch records **four childList records = two clear/append pairs**, not four renders. [mapList.ts:1288](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapList.ts:1288) triggers [subscriber:26](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapSidebarSection.ts:26), then explicitly rerenders.
   Remedy: one refresh owner; hoist per-row map enumeration at [mapList.ts:380](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapList.ts:380). Aggregate timings do not isolate either cost.

3. **MEASURED: offscreen charset animation persists while open.**
   Over two seconds: **320 visible / 1,216 offscreen draws**; zero after close in the post-settling observation. [resourceManagerViews.ts:520](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:520) advances every connected card.
   Remedy: pause outside the list viewport. Instrumented draw counts support wasted work, not CPU savings or a post-close leak.

Connections rescanning remains **CODE-ONLY**; these artifacts do not measure it.

## events-storage

**Confirmed: native Ctrl+A lag and a quadratic selection path.**

- Ctrl+A calls `selectAllAuthoredCommands` at [commandListContextMenu.ts:150](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandListContextMenu.ts:150), which enumerates authored paths and notifies selection at [commandInspector.ts:78](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandInspector.ts:78).
- [commandInspector.ts:86](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandInspector.ts:86) searches selected paths separately for every row, stringifying each candidate: **500,500 comparisons for 1,000 distinct selected rows**.
- Correction to my earlier report: toolbar notification also reruns the full search filter via [content.ts:411](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:411) → [content.ts:786](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:786), adding O(N) work.
- [Native measurements](/home/main/.codex/worktrees/e85c/rpg-zzu/verify-shots/editor-ux-audit-round2-20261004/selection/measurements.json) confirm 1,000 selected paths/rows, zero tree replacements, and maximum tasks **646/500/542ms**. Those task durations exclude the artificial wall-time wait; exact stack attribution remains **CODE-ONLY**.
- Narrow remedy: pre-encoded path Set for membership; skip search reapplication when only selection changes.
- Tab’s zero long tasks lowers its measured priority; it does not eliminate sub-50ms scanning. Progress cloning is separate from this Ctrl+A path.

Read-only check completed; no tests, browser or edits.
