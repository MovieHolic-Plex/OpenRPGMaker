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

## Agent cautions

- Editor code should mutate authored project data, not live play-session state.
- If an editor change affects saved JSON, update `openwiki/runtime-and-data.md` guidance and verify migration/serialization paths.
- For UI changes, drive the actual editor surface and keep screenshot or Playwright evidence.

## Event Authoring

- `src/editor` is the main area to inspect for editor behavior. Start with `src/editor/EditScene.ts`, `src/editor/actions.ts`, `src/editor/editorState.ts`, and the feature modules under `src/editor/panels/`.
- Map editing lives in `src/editor/map*`, `src/editor/tile*`, `src/editor/tileset*`, and `src/editor/structure*` files. Look at `src/editor/tileActions.ts`, `src/editor/tilePaletteStamp.ts`, `src/editor/tilePicking.ts`, `src/editor/mapEditHistory.ts`, `src/editor/mapShiftActions.ts`, and `src/editor/mapClipboard.ts` for common flows.
- Tile palette work usually touches `src/editor/tilePaletteStamp.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/runtimeTileMetadata.ts`, and `src/editor/tilesetActions.ts`.
- Event editing flows are split across `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, `src/editor/eventDeletion.ts`, `src/editor/eventCommandFactory.ts`, and `src/editor/eventCommands/`.
- `src/editor/eventCommandPaths.ts` is the shared owner for nested command paths. Use it for choices cancel branches, fork then/else branches, loop bodies, shop transaction branches, and branch creation when a mutation path needs to create a missing optional branch.
- Event-page command toolbar history/clipboard behavior is split from rendering: `src/editor/panels/eventEditor/commandToolbarHistory.ts` owns page-command undo/redo plus toolbar copy/cut, and `src/editor/panels/eventEditor/commandClipboard.ts` is shared with the command context menu.
- Event page overlap, movement route skippable, and route Help controls persist through `src/editor/panels/eventEditor/pageProps.ts`, `src/editor/panels/eventEditor/pageMovement.ts`, and the `moveRouteDialog*` modules.
- Destructive event deletion is routed through `requestEditorEventDeletion` so modal Delete-key and visible delete controls require explicit confirmation before `deleteEditorEvent` mutates project data.

## Database Editor

- Database workflows live in `src/editor/databaseActions.ts`, `src/editor/databaseRecordMutators.ts`, `src/editor/databaseReferences.ts`, and `src/editor/databaseCopy.ts`.
- `src/editor/panels/databaseModal.ts` owns the Database modal shell. Modal close attempts are guarded by `src/editor/panels/editorModalDirtyState.ts`: clean Cancel closes directly, while dirty Cancel/Escape/backdrop/X show Save / Discard / Keep Editing. Discard restores the modal-open project snapshot; Apply/Save persist and reset the dirty baseline.
- `src/editor/panels/databaseCommonEventViews.ts` owns the Common Events tab view. Common-event command editing uses `src/editor/panels/databaseCommandListAdapter.ts` with shared `renderCommandList`, `openEventCommandPicker`, and `openEventCommandEditDialog`; do not restore the old text-only inline command editor for Common Events.
- Troop battle event command editing also uses shared database command-list rendering. Keep battle-event command rows on the same command editor path unless the task names a narrower troop-only control.
- Enemy action switch picker controls should open the existing switch/variable picker when switches exist, and should be disabled with a clear title/ARIA reason when no switches exist.
- `src/editor/databaseCommandReferences.ts` scans command-bearing database references, including common events and troop battle event pages. Keep `src/editor/databaseReferences.ts` as the message facade for delete blocking.

## Other Editor Workflows

- Resource manager behavior usually connects through asset and tileset tooling in `src/editor/tilesetImage.ts`, `src/editor/tilesetActions.ts`, and the related editor panels under `src/editor/panels/`.
- Tile palette drag stamps should follow the visible palette grid order, not the source chipset coordinates, because curated palettes can reorder tiles and CSS can set the displayed column count.
- Combined Town window tiles 85 and 87 are upper-layer transparent overlays. Painting them should preserve the lower wall/floor tile underneath so alpha pixels reveal that lower tile.
- Map area copy/paste treats the selected rectangle as a two-layer map block: copy stores both lower and upper tile arrays, and paste writes both layers at the destination regardless of the currently active layer.
- Save/import/export flows are centered in `src/editor/saveActions.ts` and the store/persistence layer in `src/project/store.ts`; check adjacent editor actions if a UI button needs to trigger them.
- The editor status bar DB label is a live health indicator, not just a saved-settings indicator: `src/editor/panels/dbConnectionSettings.ts` pings through `src/project/supabaseProjectSync.ts` and should distinguish checking, healthy, missing project, disconnected, not configured, and disabled states.
- For quick navigation, grep within `src/editor` first, then follow the feature-specific file groups above: map, event, database, resource, tile palette, save/import/export.

## Validation Expectations

- Wiki-only edits should pass `npm run openwiki:verify`.
- Event and database UI repairs should have focused Playwright evidence. Task 10 added separate event and database stabilization specs under `test/e2e/`: the event spec covers event delete confirmation and shop branch persistence, and the database spec covers Database dirty discard, command-reference delete blocking, Common Event nested command editing, troop battle-event page switching, and enemy action switch picker behavior.
- For future editor workflow changes, run the smallest focused Vitest or Playwright path that proves the touched surface, then record the exact command and pass/fail excerpt under task evidence.
