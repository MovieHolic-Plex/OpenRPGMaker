# Editor Workflows

Use this page when changing editor-facing behavior. Before editing, identify which workflow owns the request and inspect the files listed under that workflow.

## Pre-edit routing

- Map canvas, tile placement, brush behavior, selection, copy/paste, undo, and map dimensions: start in `src/editor/EditScene.ts`, `src/editor/tileActions.ts`, and nearby `src/editor/tile*`, `src/editor/map*`, or `src/editor/structure*` modules.
- Tile palette, chipset rendering, stamps, picking, and autotile/semantic previews: start in `src/editor/panels/tilePalette.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/tilePaletteStamp.ts`, and `src/assets`.
- Event authoring, event pages, event commands, move routes, transfer/player actions, and command dialogs: start in `src/editor/panels/eventEditor/`, `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, and `src/editor/eventCommands/`.
- Shared nested event command path traversal: start in `src/editor/eventCommandPaths.ts`. It owns command path lookup for persisted event pages and staged root command branch arrays, including optional branch creation and loop body traversal.
- Database tabs, record views, battle database records, utility records, references, common-event command editing, and record mutation: start in `src/editor/panels/database*.ts`, `src/editor/databaseActions.ts`, `src/editor/databaseRecordMutators.ts`, `src/editor/databaseReferences.ts`, and `src/editor/databaseCommandReferences.ts`.
- Resource manager, imported graphics, tileset metadata, generated assets, and transparency behavior: start in `src/editor/panels/resourceManager.ts`, `src/editor/tileset*`, and `src/assets`.
- Save, import, export, autosave, remote/local project loading, and persistence status: start in `src/editor/saveActions.ts` and `src/project/store.ts`.
- Team workflow visualization, mock editor login, topbar identity, commit-history panel, and map-lock badges: start in `src/editor/teamWorkflowUi.ts`, `src/editor/panels/menu.ts`, `src/editor/panels/mapList.ts`, `src/project/editorIdentity.ts`, and `src/project/supabaseProjectSync.ts`. Login remains mock-only until Phase 8 auth switchover; do not add Supabase Auth calls here.

## Agent cautions

- Editor code should mutate authored project data, not live play-session state.
- If an editor change affects saved JSON, update `openwiki/runtime-and-data.md` guidance and verify migration/serialization paths.
- For UI changes, drive the actual editor surface and keep screenshot or Playwright evidence.

## Event Authoring

- `src/editor` is the main area to inspect for editor behavior. Start with `src/editor/EditScene.ts`, `src/editor/actions.ts`, `src/editor/editorState.ts`, and the feature modules under `src/editor/panels/`.
- Map editing lives in `src/editor/map*`, `src/editor/tile*`, `src/editor/tileset*`, and `src/editor/structure*` files. Look at `src/editor/tileActions.ts`, `src/editor/tilePaletteStamp.ts`, `src/editor/tilePicking.ts`, `src/editor/mapEditHistory.ts`, `src/editor/mapShiftActions.ts`, and `src/editor/mapClipboard.ts` for common flows.
- Store mutations can carry a `ProjectChangeDescriptor` from `src/project/store.ts`. High-frequency tile edits should use `scope: "map"` with concrete `{ x, y, layer }` cells so `EditScene` can update only those tile objects; broad map shape/metadata edits should use map scope without cells; database edits should use `scope: "database"` so the map canvas does not redraw.
- High-frequency edits that only mutate one existing `GameMap` should use `store.updateMap(mapId, mapMutator, { cells })` instead of `store.update`. `updateMap` clones only the target map, shallow-copies the project root and `maps`, shares database/assets/tilesets references, emits map scope, and skips full-project normalize passes. Keep tileset/passability/database/project-tree edits on `store.update`.
- Undo history is budgeted around per-map snapshots: high-frequency edits that only touch one existing map should record `{ kind: "map" }` snapshots through `mapEditHistory`.
- Keep full-project snapshots for global edits such as database/system changes, map add/delete/tree changes, resize, imports, or any mutation whose boundary is ambiguous.
- Tile palette work usually touches `src/editor/tilePaletteStamp.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/runtimeTileMetadata.ts`, and `src/editor/tilesetActions.ts`.
- Event editing flows are split across `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, `src/editor/eventDeletion.ts`, `src/editor/eventCommandFactory.ts`, and `src/editor/eventCommands/`.
- `src/editor/eventCommandPaths.ts` is the shared owner for nested command paths. Use it for choices cancel branches, fork then/else branches, loop bodies, shop transaction branches, and branch creation when a mutation path needs to create a missing optional branch.
- Destructive event deletion is routed through `requestEditorEventDeletion` so modal Delete-key and visible delete controls require explicit confirmation before `deleteEditorEvent` mutates project data.
- AI event tools compile `graphic` input through `src/editor/tools/eventCompile.ts`; direct `{textureKey, characterIndex}` charset graphics must be canonicalized to bundled EasyRPG texture keys before commit-time resource validation.
- `place_npc` SimplePage compilation is intentionally tolerant for common in-editor AI malformed shapes: `conditions` may be omitted, null, an array, or a single condition object; `commands` may be omitted, null, an array, or a single command object; and obvious command-kind aliases such as `command: "text"` or `kind: { command: "text" }` are normalized. Every normalization must emit a tool warning, while unrecoverable shapes should fail with a short `field / expected type / actual type / minimal example` ToolError instead of a raw TypeError.

## Database Editor

- Database workflows live in `src/editor/databaseActions.ts`, `src/editor/databaseRecordMutators.ts`, `src/editor/databaseReferences.ts`, and `src/editor/databaseCopy.ts`.
- `src/editor/panels/databaseModal.ts` owns the Database modal shell. Modal close attempts are guarded by `src/editor/panels/editorModalDirtyState.ts`: clean Cancel closes directly, while dirty Cancel/Escape/backdrop/X show Save / Discard / Keep Editing. Discard restores the modal-open project snapshot; Apply/Save persist and reset the dirty baseline.
- `src/editor/panels/databaseCommonEventViews.ts` owns the Common Events tab view. Common-event command editing uses `src/editor/panels/databaseCommandListAdapter.ts` with shared `renderCommandList`, `openEventCommandPicker`, and `openEventCommandEditDialog`; do not restore the old text-only inline command editor for Common Events.
- Troop battle event command editing also uses shared database command-list rendering. Keep battle-event command rows on the same command editor path unless the task names a narrower troop-only control.
- Event command runtime parity badges are driven by `src/editor/eventCommands/runtimeSupport.ts`. Command picker buttons and command-list rows share the badge renderer in `src/editor/panels/eventEditor/commandRuntimeBadge.ts`; keep `runtime-full | runtime-partial | editor-only` as the public support grades and update the support table when interpreter coverage changes.
- Enemy action switch picker controls should open the existing switch/variable picker when switches exist, and should be disabled with a clear title/ARIA reason when no switches exist.
- `src/editor/databaseCommandReferences.ts` scans command-bearing database references, including common events and troop battle event pages. Keep `src/editor/databaseReferences.ts` as the message facade for delete blocking.

## Other Editor Workflows

- Resource manager behavior usually connects through asset and tileset tooling in `src/editor/tilesetImage.ts`, `src/editor/tilesetActions.ts`, and the related editor panels under `src/editor/panels/`.
- Tile metadata tools live in `src/editor/tools/tileMetadataTools.ts`; `set_group_junction` and `set_group_overlay` add or update optional tile-group structural rules, while `upsert_tile_group` can persist those arrays with the rest of the group metadata. Cluster rule authoring lives in `src/editor/tools/clusterRuleTools.ts`: `set_cluster_rule` adds or updates tile-group `rules`, and `upsert_tile_group` can persist the same rules array.
- Tileset transparent-color editing lives in `src/editor/panels/tilesetSettingsDetails.ts` and stores a user override on `TilesetDef.transparentColor`; render paths resolve it in `src/assets/chipsetTransparency.ts` before falling back to chipset defaults.
- Save/import/export flows are centered in `src/editor/saveActions.ts` and the store/persistence layer in `src/project/store.ts`; check adjacent editor actions if a UI button needs to trigger them.
- AI/tool changesets accepted through `src/editor/tools/applyChangesetToStore.ts` or the AI chat panel record one Supabase commit row plus one project change row with editor identity. Manual edits are batched at successful autosave/flush time and deduped by the last recorded serialized project.
- Accepted AI changesets also run `src/editor/agentFocus.ts`: the editor selects the map with the largest visible map/event change and emits a transient `.agent-focus-highlight` overlay for changed cells or bounds. Keep this on AI acceptance paths only; manual paint/updateMap flows should not request the highlight.
- W5 team workflow UI shows current editor identity in the topbar, can reopen the mock login modal, and reads recent `project_commits` through `listProjectCommitsFromSupabase`. The mock login only updates the local editor owner label and last-login-method localStorage marker; real Auth/RLS session handling belongs to the Phase 8 switchover.
- For quick navigation, grep within `src/editor` first, then follow the feature-specific file groups above: map, event, database, resource, tile palette, save/import/export.

## Validation Expectations

- Wiki-only edits should pass `npm run openwiki:verify`.
- Event and database UI repairs should have focused Playwright evidence. Task 10 added separate event and database stabilization specs under `test/e2e/`: the event spec covers event delete confirmation and shop branch persistence, and the database spec covers Database dirty discard, command-reference delete blocking, Common Event nested command editing, troop battle-event page switching, and enemy action switch picker behavior.
- For future editor workflow changes, run the smallest focused Vitest or Playwright path that proves the touched surface, then record the exact command and pass/fail excerpt under task evidence.
- For event-command parity changes, include focused tests for the support table, command-list/picker badge metadata, `projectLint` warning output, and write-tool `ToolResult.issues` propagation.
