# palette-sidebar

Read-only audit at `d7a3f0136e`. Three findings; all **code hypothesis**, with no latency measurements.

1. **Filtered tile selection rebuilds closed popup contents.**
   - Trigger/path: choose a tile while search/category filtering is active. [tilePalette.ts:799](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tilePalette.ts:799) rejects in-place selection; the queued palette render eagerly builds assist content at [line 638](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tilePalette.ts:638) and kit shelves at [line 503](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tilePalette.ts:503).
   - Heavy work: current Beodeul bundle has **27,648 tiles and 725 section kits**. Each rebuild creates all 725 canvas icons despite the popup being closed; a newly selected tile also incurs similarity scoring/sorting, worst-case O(N log N), at [tileBrushTools.ts:124](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tileBrushTools.ts:124).
   - Safeguards: sheet virtualization/retention, similarity cache per selected tile, debounced search.
   - Narrow remedy: allow filtered custom-atlas selection updates in place; construct assist bodies and kit icons only when their popup opens.
   - Native measurement: Beodeul map → category 「地形/지형」 → select distinct tiles with 「붓 보조」「내 구조물」 closed; compare with 「전체」. Count shelf creation and similarity calls through the next rendered frame.

2. **Changing maps through the visible Maps pane rebuilds the tree twice.**
   - Trigger/path: click a different map row. [mapList.ts:1288](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapList.ts:1288) selects the map, synchronously triggering [mapSidebarSection.ts:26](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapSidebarSection.ts:26), then explicitly rebuilds again at line 1289.
   - Heavy work: each rebuild recreates every expanded row and thumbnail canvas. [mapList.ts:380](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapList.ts:380) additionally enumerates all map keys per non-folder row: O(R×M), O(M²) when fully expanded.
   - Safeguards: collapsed branches; cached link statistics, thumbnail hashes/images; paint refresh settles after 500ms.
   - Narrow remedy: give map-selection refresh one owner; compute map count once per tree render.
   - Native measurement: open 「맵」 with 200 expanded maps, warm thumbnails, alternate two different rows. Count `renderMapList` calls and row replacements per click.

3. **Visible Progress pane clones event payloads during painting.**
   - Trigger/path: paint with 「진행」 open. [leftProgressPane.ts:100](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/leftProgressPane.ts:100) schedules every notification; [authoringJourney.ts:65](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/authoringJourney.ts:65) calls `committedEvents(...).length` across all maps.
   - Heavy work: `committedEvents` deep-clones committed events at [eventDrafts.ts:51](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/eventDrafts.ts:51). Cost scales with total event/command payload per painted frame, although painting leaves event counts unchanged.
   - Safeguards: hidden-pane guard, rAF coalescing, cached reference issues; edits clear test fingerprints.
   - Narrow remedy: retain committed-event counts across cell/relief notifications and skip rebuilding unchanged progress rows.
   - Native measurement: disposable project copy with 2,000 committed events → 「진행」 → continuous tile stroke; compare 「그리기」 and count `committedEvents`/clone calls.
