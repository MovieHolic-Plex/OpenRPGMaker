# storage-undo-followup

Separate Ctrl+Z follow-up at `d7a3f0136e`. Supervisor measured the lag; **attribution below remains code hypothesis**.

Shortcut: [hotkeys.ts:202](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/hotkeys.ts:202) → `undoMapEdit` → capture redo snapshot → restore snapshot → `store.replace` → synchronous subscribers → history microtask and panel rAF. Keyboard events are deduplicated.

1. **Redundant cloning before notification.**
   - [mapEditHistory.ts:306](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:306) copies the current map for redo; [mapEditHistory.ts:162](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:162) copies all nonshared project data, then copies the restored map. `replace` additionally reaches [eventDraftVault.ts:197](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/eventDraftVault.ts:197), which copies that project data even with no open drafts.
   - One-map/no-draft case: **four complete map-grid copies** before subscribers. Tilesets/uploaded entries remain shared; cleanup already skips tile-number grids.
   - Narrow remedy: map-scoped restoration and a no-drafts reconciliation fast path. Supervisor: bracket `makeCurrentSnapshotForEntry`, `applySnapshotToProject`, and `preserveEventDraftsOnProject` across the existing fixture sizes.

2. **One-cell undo forces synchronous canvas reconstruction.**
   - [mapEditHistory.ts:169](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/mapEditHistory.ts:169) supplies no `renderCells`; [store.ts:824](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/store.ts:824) consequently emits `scope:"project"`.
   - [EditScene.ts:1041](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/EditScene.ts:1041) runs texture assurance; the project descriptor forces `redraw`, reaching [editSceneRender.ts:192](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/editSceneRender.ts:192): destroy existing layer objects, clear indexes, rebuild both layers and overlays.
   - Safeguard: maps above 2,048 cells use the camera window; this is **not necessarily a 512² object rebuild**. Narrow remedy: retain changed-cell metadata in paint history and restore through incremental rendering. Supervisor: separate texture assurance, `redraw`, and object destruction/creation within the keydown task.

3. **Project scope also expands the next panel frame.**
   - [editor.ts:948](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/editor.ts:948) → reference validation at [editor.ts:995](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/editor.ts:995) → all dock panels; [mapList.ts:88](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/mapList.ts:88) clears/rebuilds the tree.
   - Safeguards: panel rAF requests coalesce; unchanged palette inputs preserve the sheet. History notification normally refreshes palette chrome, so **whole-palette rebuilding is not established**.
   - Narrow remedy: preserve map/cell scope for tile undo, retain reference results, and refresh only affected thumbnails/history controls. Supervisor: bracket `refreshPanels`, reference validation, map-list rendering, and history chrome separately; distinguish these from the synchronous keydown task.
