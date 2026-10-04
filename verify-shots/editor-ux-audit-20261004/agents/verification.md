# verification

Reviewed `d7a3f0136e`, read only. All latency assessments below are **code hypothesis**; no timings measured.

1. **(4) Confirm — history jumps; highest measurement priority.**
   Trigger: choose a multi-step undo/redo history row and confirm.
   Reachability: [tileHistoryMenu.ts:292](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/tileHistoryMenu.ts:292) → [mapEditHistory.ts:467](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:467), with redo equivalent at line 495.
   Synchronous work: initial `structuredClone(current)` includes the full project; every traversed entry then deep-clones project content through [mapEditHistory.ts:162](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:162) → [projectClone.ts:128](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/projectClone.ts:128). Map snapshots clone all unrelated maps before replacing the target map: O(K × project content).
   Safeguards: per-entry clones share tilesets/uploaded assets; history is capped at 50, trending toward 25 for large snapshots; traversal performs one final store replacement. **Repeated asset deep-copy per entry is false**, but the initial clone and reverse snapshot still copy them.
   Narrow remedy: clone with shared dictionaries once, apply snapshots directly to that isolated accumulator, and use the existing shared-dictionary snapshot helper for reverse history.
   Native measurement: in a project with many large unrelated maps, paint ten separate strokes on one map; choose the tenth undo-history row and confirm. Compare with the same strokes in a single-map project.

2. **Repeated DOM construction — (2) confirm; (3) confirm construction, reject persistent hidden rows.**
   **(2), second priority:** Items/Equipment tabs reach [database.ts:1198](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/database.ts:1198). Every bubbling detail `input`, including description, invokes [databaseInventoryCatalog.ts:122](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseInventoryCatalog.ts:122).
   Work: O(N) catalog scans followed by O(V) visible row/thumbnail reconstruction and `replaceChildren` at [databaseInventoryCatalog.ts:157](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseInventoryCatalog.ts:157). “All rows” means all **filtered visible** rows.
   Safeguards: search/detail nodes and list scroll survive; selection clicks preserve row nodes. None prevents rebuilding for description input.
   Remedy: ignore fields absent from row/search/filter projections; update the selected row for relevant changes.
   Native measurement: open Items → All, clear search, select an item, type twenty description characters; compare row child mutations with the catalog filtered to that item.
   **(3), lower priority:** event opening/body refresh → [content.ts:275](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:275) unconditionally builds storyboard cards, recursively including branches.
   Safeguard/correction: [content.ts:315](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:315) immediately clears them in list view; the cost is construction then disposal, not retained hidden DOM.
   Remedy: start with an empty storyboard host and build only when selected. Native measurement: open a long, branched event in List view; attribute allocation/CPU to `renderStoryboard`, then compare a short event.

3. **(1) Confirm with frequency qualification — relief hover; third priority.**
   Trigger: move the pointer with Height selected on a large relief map.
   Reachability: [EditScene.ts:1148](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:1148) → [editSceneHoverPreview.ts:136](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneHoverPreview.ts:136): signature scans levels/ramps **before** the hover-cache check.
   Work: O(width × height) signature on each eligible pointer event; changed hover cells additionally scan every cached elevation at [screen.ts:214](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/relief/screen.ts:214). Paint picking also reaches that scan.
   Safeguards: lift fields/slopes are cached; equal hover keys skip drawing and maximum scans; painting suppresses hover. Therefore **maximum scans on every pointer event is overstated**.
   Remedy: cache signature by immutable relief/array identity and use existing `field.maxLift` as the conservative picking bound.
   Native measurement: on an unchanged large relief map, move within one cell, then across cells; compare Height with Paint and attribute signature versus maximum-scan CPU separately.
