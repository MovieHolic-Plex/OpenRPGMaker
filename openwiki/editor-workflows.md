# Editor Workflows

Use this page when changing editor-facing behavior. Before editing, identify which workflow owns the request and inspect the files listed under that workflow.

## Pre-edit routing

- Map canvas, tile placement, brush behavior, selection, copy/paste, undo, and map dimensions: start in `src/editor/EditScene.ts`, `src/editor/tileActions.ts`, and nearby `src/editor/tile*`, `src/editor/map*`, or `src/editor/structure*` modules.
- Tile palette, chipset rendering, stamps, picking, and autotile/semantic previews: start in `src/editor/panels/tilePalette.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/tilePaletteStamp.ts`, and `src/assets`.
- Event authoring, event pages, event commands, move routes, transfer/player actions, and command dialogs: start in `src/editor/panels/eventEditor/`, `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, and `src/editor/eventCommands/`.
- Database tabs, record views, battle database records, utility records, references, and record mutation: start in `src/editor/panels/database*.ts`, `src/editor/databaseReferences.ts`, and related database action/mutator modules.
- Resource manager, imported graphics, tileset metadata, generated assets, and transparency behavior: start in `src/editor/panels/resourceManager.ts`, `src/editor/tileset*`, and `src/assets`.
- Save, import, export, autosave, remote/local project loading, and persistence status: start in `src/editor/saveActions.ts` and `src/project/store.ts`.

## Agent cautions

- Editor code should mutate authored project data, not live play-session state.
- If an editor change affects saved JSON, update `openwiki/runtime-and-data.md` guidance and verify migration/serialization paths.
- For UI changes, drive the actual editor surface and keep screenshot or Playwright evidence.

- `src/editor` is the main area to inspect for editor behavior. Start with `src/editor/EditScene.ts`, `src/editor/actions.ts`, `src/editor/editorState.ts`, and the feature modules under `src/editor/panels/`.
- Map editing lives in `src/editor/map*`, `src/editor/tile*`, `src/editor/tileset*`, and `src/editor/structure*` files. Look at `src/editor/tileActions.ts`, `src/editor/tilePaletteStamp.ts`, `src/editor/tilePicking.ts`, `src/editor/mapEditHistory.ts`, `src/editor/mapShiftActions.ts`, and `src/editor/mapClipboard.ts` for common flows.
- Tile palette work usually touches `src/editor/tilePaletteStamp.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/runtimeTileMetadata.ts`, and `src/editor/tilesetActions.ts`.
- Event editing flows are split across `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, `src/editor/eventDeletion.ts`, `src/editor/eventCommandFactory.ts`, and `src/editor/eventCommands/`.
- Database workflows live in `src/editor/databaseActions.ts`, `src/editor/databaseRecordMutators.ts`, `src/editor/databaseReferences.ts`, and `src/editor/databaseCopy.ts`.
- Resource manager behavior usually connects through asset and tileset tooling in `src/editor/tilesetImage.ts`, `src/editor/tilesetActions.ts`, and the related editor panels under `src/editor/panels/`.
- Save/import/export flows are centered in `src/editor/saveActions.ts` and the store/persistence layer in `src/project/store.ts`; check adjacent editor actions if a UI button needs to trigger them.
- For quick navigation, grep within `src/editor` first, then follow the feature-specific file groups above: map, event, database, resource, tile palette, save/import/export.
