# database

Read-only audit at `d7a3f0136e`. Three current findings; all **code hypothesis**, with no timing measurements.

1. **Item description typing rebuilds the entire catalog.**
   Trigger/path: [databaseInventoryCatalog.ts:122](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseInventoryCatalog.ts:122) attaches `renderRows` to every detail-form `input`; [line 157](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseInventoryCatalog.ts:157) replaces every matching row and thumbnail.
   Cost: synchronous O(N) filtering and O(V) DOM construction per character; description edits rebuild rows whose labels did not change. Search also invokes this immediately at line 191.
   Safeguards: search/detail DOM and scroll survive; record updates already use collection-scoped cloning and coalesced undo. This catalog bypasses generic record-list virtualization.
   Narrow remedy: update only the renamed row; exclude unrelated form inputs from list rebuilding, and use the existing virtualizer for catalog rows.
   Native measurement: 자료집 → 파티 → 아이템·장비, clear filters in a disposable project with 1,000 items; type 20 characters into `db-field-item-description`, then `db-catalog-search`. Capture input tasks and row creation/removal counts.

2. **Typing still synchronously rescans references despite the modal editing guard.**
   Trigger/path: [databaseModal.ts:389](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseModal.ts:389) paints connections before checking editing focus. [databaseConnectionsPanel.ts:63](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseConnectionsPanel.ts:63) invalidates its cache whenever the Project object changes.
   Cost: [databaseRecordConnections.ts:157](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/databaseRecordConnections.ts:157) invokes [databaseCommandReferences.ts:23](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/databaseCommandReferences.ts:23), traversing common events, map events/pages/drafts and troop commands; worst case O(total command/condition content), plus database relationship scans, per character.
   Safeguards: unchanged-project paints skip; displayed uses are capped at 40 **after** scanning; body refresh has focus/rAF guards.
   Narrow remedy: reuse “uses” for name/description-only patches while updating local checks; invalidate reference results when reference-bearing fields change.
   Native measurement: 자료집 → 파티 → 스킬; type in one skill’s name with the connection pane present. Compare otherwise identical disposable projects containing small versus 10,000 unrelated event commands; inspect `commandsReferenceLocations` calls per character.

3. **Life collection search rebuilds every hidden inspector and its dropdown options.**
   Trigger/path: [databaseLifeCollectionsView.ts:101](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:101) requests a full tab redraw; [line 121](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:121) constructs inspectors for all records.
   Cost: each fish inspector builds the entire item dropdown at [line 351](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:351); [line 797](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/databaseLifeCollectionsView.ts:797) creates every option. Fish alone contribute O(F×I) option nodes—even with zero search matches. Selecting another record also redraws everything.
   Safeguards: search debounce is 90 ms; inactive inspectors receive `hidden`; unchanged tab revisits are cached. These do not prevent construction during redraw.
   Narrow remedy: build only the selected inspector; make search update the list independently.
   Native measurement: 자료집 → 생활 → 낚시·채집·박물관 with 100 fish and 1,000 items; search for a nonexistent name, then clear and select another fish. Inspect option construction counts: the code implies 100,000 fish-dropdown options per redraw, not a measured duration.
