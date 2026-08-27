# AI Editor Reachability Audit — Map / Tile / Tileset / Resource / Canvas

Scope: `src/editor` map·tile·tileset·resource·canvas mutation files, `src/editor/tools`, `src/ai/toolRegistry` exposure, `openwiki/editor-ai-tools.md`, and `test/aiEditorFullToolCoverage.test.ts`.
Method: for each concrete editor-supported mutation, find the owning `file:function`, then search the active AI tool registry (`toolRegistry.ts` `activeTools()`) for a matching facade, and note whether `find_tools` / domain selection can surface it.

Classification is exactly one per row:
- **COVERED** — a matching active AI tool/facade exists and is reachable via `find_tools` and/or the relevant domain selector.
- **MISSING** — the editor mutation has no AI tool; `find_tools` returns none. Each MISSING row cites its source and a proposed RED (testable expected tool contract).
- **UI-ONLY** — the mutation requires binary/file input or is a pure view toggle that the AI assistant cannot and should not drive.

Domain reference: `CORE_TOOL_NAMES` (`create_map`, `resize_map`, `get_project_summary`, `list_resources`, `tile_query`, `get_database_records`) are always exposed; `tile`/`map`/`database`/`system` domain unions plus `MAX_EXPOSED_TOOLS=40` trim govern exposure; `find_tools` (`discoveryTools.ts:41`) searches the full **active** (non-deprecated) registry and is attachable outside the 40-tool window.

## MAP mutations

| Editor mutation | Owning source:function | AI tool / facade | Reachability (find_tools / domain) | Class |
| --- | --- | --- | --- | --- |
| Paint tiles (brush/rect/line/cells) | `src/editor/tileActions.ts` `paintTile`/`paintTilesBulk` | `paint_tiles` (mapTools.ts:230, modes rect/line/fill/cells + cluster/autotile reshape) | findable; `map` domain | COVERED |
| Erase tiles (visible/stack-safe) | `src/editor/tileActions.ts` `eraseTilesBulk`/`eraseVisibleTilesBulk` | `tile_erase` (v3/constructionTools.ts) | findable; `tile` domain | COVERED |
| Flood fill lower terrain | `src/editor/tileActions.ts` `fillTile` (lower) | `paint_tiles` mode=fill; `fill_region` | findable; `tile`/`map` domains | COVERED |
| Flood fill **upper layer** | `src/editor/tileActions.ts` `fillTile` (effectiveLayer → upper) | **MISSING** — `paint_tiles` fill is lower-only (mapTools.ts:264,282), `fill_region` is ground/surface only | no tool → none | MISSING |
| Round/ellipse paint shape | `src/editor/tileShapeTools.ts` `tileCellsForPaintShape("round")` | **MISSING** — `paint_tiles` modes are rect/line/fill/cells; no ellipse | no tool → none | MISSING |
| Select tile region | `src/editor/mapClipboard.ts` `selectTileRegion`; `src/editor/mapSelection.ts` | `show_map_region`/`get_map_region`/`highlight_map_region` (read) | findable; `map` domain | COVERED |
| Copy region (both layers + stacks) | `src/editor/mapClipboard.ts` `copySelection` | **MISSING** | no tool → none | MISSING |
| Paste/unshift region (both layers) | `src/editor/mapClipboard.ts` `pasteClipboard`/`confirmPastePreview` | **MISSING** | no tool → none | MISSING |
| Clear/delete region | `src/editor/mapClipboard.ts` `clearSelectionRegion`; `mapDeleteConfirm.ts` | `clear_region` (mapTools.ts:744) | findable; `map` domain | COVERED |
| Shift map contents (+events +startPos) | `src/editor/mapShiftActions.ts` `shiftMapContent` | **MISSING** | no tool → none | MISSING |
| Resize map | `mapTools.ts` `resize_map` (resize.ts runtime path) | `resize_map` (mapTools.ts:1451) | findable / `core`+`map` | COVERED |
| Create map | `actions.ts`/`mapTools.ts` | `create_map` (mapTools.ts:81) | findable / `core` | COVERED |
| Delete map (impact-aware) | `src/editor/mapDeleteConfirm.ts` `confirmAndDeleteMaps`; `actions.ts` `deleteMap` | `remove_map` (mapTools.ts:1506) | findable; `map` domain | COVERED |
| Duplicate map | `actions.ts`/`mapTools.ts` | `duplicate_map` (mapTools.ts:129) | findable; `map` domain | COVERED |
| Map tree manage (reorder/folders) | `src/editor/mapTreeDrop.ts` `mapTreeDropRelation`; `actions.ts` | `manage_map_tree` (mapTools.ts:168) | findable; `map` domain | COVERED |
| Set map properties (name/tileset/bgm/encounter/flags/minimap) | `actions.ts` `setMapTileset` + properties editor | `set_map_properties` (mapTools.ts:1227, incl. tilesetId) | findable; `map` domain | COVERED |
| Set start position | `actions.ts` | `set_start_position` (mapTools.ts:868) | findable; `map` domain | COVERED |
| Mirror region | `mapTools.ts`/region | `mirror_region` (mapTools.ts:792) | findable / pinned `map` | COVERED |
| Undo | `src/editor/mapEditHistory.ts` `undoMapEdit` | `revert_last_edit` (historyTools.ts:27) | findable; `system` domain | COVERED |
| Redo | `src/editor/mapEditHistory.ts` `redoMapEdit` | **MISSING** — `revert_last_edit` only moves back; no redo facade | no tool → none | MISSING |

## TILE mutations

| Editor mutation | Owning source:function | AI tool / facade | Reachability | Class |
| --- | --- | --- | --- | --- |
| Toggle collision at map cell | `src/editor/tileActions.ts` `toggleCollision` | `set_tile_passability` (mapTools.ts:895); `set_tile_rules` passable — tile-index facade of the same target state | findable; `tile`/`map` domains | COVERED |
| Set per-direction passability flag | `src/editor/tilesetActions.ts` `setTilePassageFlag`/`setTilePassageBulk` | `set_tile_passability`; `set_tile_rules` passable | findable; `tile` domain | COVERED |
| Set terrain tag | `src/editor/tilesetActions.ts` `setTerrainTag` | `set_tile_rules` terrainTag | findable; `tile` domain | COVERED |
| Set tile home layer (auto/lower/upper) | `src/editor/tileLayerClassification.ts`; `tilesetActions` | `set_tile_rules` layer (confirmedByUser) | findable; `tile` domain | COVERED |
| Tile metadata label/desc/role/tags | `src/editor/runtimeTileMetadata.ts`; `tilesetActions` | `set_tile_metadata` (tileMetadataTools.ts:277) | findable; `tile` domain | COVERED |
| Tile group upsert (junctions/overlays/rules) | `src/editor/tileMetadataTools` region + harness | `upsert_tile_group`, `set_group_junction`, `set_group_overlay` | findable; `tile` domain | COVERED |
| Tile group delete | `tilesetActions`/metadata | `delete_tile_group` (tileMetadataTools.ts:569) | findable; `tile` domain | COVERED |
| Palette preset save | `src/editor/tilePaletteStamp.ts`, palette preset store | `upsert_palette_preset` | findable; `tile` domain | COVERED |
| Tile picking (eyedropper) | `src/editor/tilePicking.ts` `visibleTilePickAt` | `get_tile_info`/`tile_query`/`query_tiles` (read) | findable; `tile` domain | COVERED |

## TILESET mutations

| Editor mutation | Owning source:function | AI tool / facade | Reachability | Class |
| --- | --- | --- | --- | --- |
| Tile graft (transplant chip into tileset, extend count) | `src/editor/tilesetActions.ts` `addTileGraft` | **MISSING** | no tool → none | MISSING |
| Tile graft remove (shrink count) | `src/editor/tilesetActions.ts` `removeTileGraft` | **MISSING** | no tool → none | MISSING |
| Autotile group add/remove | `src/editor/tilesetActions.ts` `addAutotileGroup`/`removeAutotileGroup` | **MISSING** — AI can resolve existing autotile members via `paint_tiles`/`fill_region`, but cannot define a new autotile group | no tool → none | MISSING |
| Autotile group edit (members/connect/neighborhood) | `src/editor/tilesetActions.ts` `updateAutotileGroup` | **MISSING** | no tool → none | MISSING |
| Autotile variant bitmap (16-neighborhood) | `src/editor/tilesetActions.ts` `setAutotileVariant`/`fillAutotileVariantMap` | **MISSING** | no tool → none | MISSING |
| Autotile template wizard / animated water | `src/editor/tilesetActions.ts` `addAutotileGroupFromTemplate` | **MISSING** | no tool → none | MISSING |

## RESOURCE mutations

| Editor mutation | Owning source:function | AI tool / facade | Reachability | Class |
| --- | --- | --- | --- | --- |
| Import/upload image resource | `src/editor/panels/resourceManager.ts` `importImageResource` | — (requires File/binary input) | none — no AI upload path | UI-ONLY |
| Import/upload audio resource | `src/editor/panels/resourceManager.ts` `importAudioResource` | — (requires File/binary input) | none — no AI upload path | UI-ONLY |
| Register uploaded asset as new tileset | `src/editor/panels/resourceManager.ts` `ensureTilesetFromUpload`/`addTilesetFromUpload` | — depends on a prior binary upload | none — no AI upload path | UI-ONLY |
| Apply tileset to current map | `src/editor/panels/resourceManager.ts` `applyTilesetToCurrentMap`; `actions.ts` `setMapTileset` | `set_map_properties` tilesetId | findable; `map` domain | COVERED |
| Delete uploaded resource | `src/editor/panels/resourceManager.ts` `deleteUploadedAsset` | **MISSING** | no tool → none | MISSING |
| List resources | `queryTools.ts` | `list_resources` (queryTools.ts:335) | findable / `core` | COVERED |
| Database record update (item/skill/class/etc.) | `src/editor/databaseRecordMutators.ts` `update*Record` | `upsert_item`/`upsert_skill`/`upsert_class`/`upsert_enemy`/`upsert_equipment`/`upsert_troop`/`upsert_actor`/`upsert_state`/`upsert_database_utility` | findable; `database` domain | COVERED |
| Database record duplicate | `src/editor/databaseCopy.ts` `duplicateInto` | `duplicate_database_record` (dbTools.ts) | findable; `database` domain | COVERED |
| Database record delete | `databaseActions.ts` | `delete_database_record` (dbTools.ts) | findable; `database` domain | COVERED |
| Prune unused resources/records | `refactorTools.ts` | `prune_unused` (refactorTools.ts:409) | findable; `system` domain | COVERED |

## CANVAS mutations

| Editor mutation | Owning source:function | AI tool / facade | Reachability | Class |
| --- | --- | --- | --- | --- |
| Canvas brush paint/erase | `src/editor/EditScene.ts` + `TilePaintEngine.ts` → `tileActions` | `paint_tiles`/`tile_erase` | findable; `tile`/`map` domains | COVERED |
| Show/hide tile grid & tile overlay | `EditScene` render toggle | `show_tile_grid`/`show_tiles` are deprecated (LEGACY_TILE_KNOWLEDGE_SUPERSEDED → `tile_query`); display-only toggles | deprecated → not LLM-exposed; UI view control | UI-ONLY |
| Highlight map region | `layoutBboxOverlay.ts` | `highlight_map_region` (read) | findable; `map` domain | COVERED |
| Canvas inspection/lint | `canvasInspectionPanel.ts` / `projectLint` | `run_lint` (system) | findable; `system` domain | COVERED |

## Proposed RED assertions (one per real gap)

For each MISSING row, the expected contract is a new write-facing editor-facade tool that must pass a deterministic test mirroring the existing editor mutation semantics.

1. **Region copy/paste** — `RED(aiTool)` : `runTool(ctx,"copy_region",{mapId,x,y,w,h})` then `runTool(ctx,"paste_region",{mapId,x,y})` must reproduce both `lowerTiles` and `upperTiles` (and tile stacks) at the target rect, matching `mapClipboard.copySelection`/`pasteClipboard` semantics; `find_tools("paste",{domain:"map"})` must return the tool. Today `find_tools` returns none for `copy`/`paste`/`clipboard`.
2. **Shift map contents** — `RED(aiTool)` : `runTool(ctx,"shift_map",{mapId,dx,dy})` must move `lowerTiles`/`upperTiles` by `(dx,dy)`, fill the vacated band with `TILE.GRASS` (lower) / `TILE.EMPTY` (upper), and shift every event `x/y` and `project.startPos` when start map, per `mapShiftActions.shiftMapContent`. `find_tools("shift map",{domain:"map"})` returns none today.
3. **Round/ellipse paint shape** — `RED(aiTool)` : `paint_tiles.mode` should accept `"round"` and paint `tileCellsForPaintShape("round",from,to)` cells from `tileShapeTools.ts`, asserting the ellipse-bounded cell set on a 8×8 map. Currently `modes` enum is `rect|line|fill|cells` with no ellipse.
4. **Upper-layer flood fill** — `RED(aiTool)` : a fill path that accepts an upper-layer chip and flood-fills only contiguous upper cells sharing the target tile, equivalent to `tileActions.fillTile` with `targetLayer==="upper"` (no lower rewrite). `paint_tiles` fill today hard-errors for upper-home tiles and lower-only.
5. **Tile graft add/remove** — `RED(aiTool)` : `runTool(ctx,"set_tile_graft",{tilesetId,targetTile,sourceChipset,sourceTile})` must upsert the graft and grow `count`/`passability`/`priority`/`terrain` to row-aligned coverage; `...remove` restores count, both per `tilesetActions.addTileGraft`/`removeTileGraft`. `find_tools("graft",{domain:"tile"})` returns none today.
6. **Autotile group authoring** — `RED(aiTool)` : a `set_autotile_group` facade (create/edit members/neighborhood + set/fill variant bitmap + delete + template-wizard) asserting the same store shape as `addAutotileGroup`/`updateAutotileGroup`/`setAutotileVariant`/`fillAutotileVariantMap`/`removeAutotileGroup`/`addAutotileGroupFromTemplate` (variantMap exactly equals `buildEdgeCornerVariantMap` for the 9-piece fill). `find_tools("autotile group",{domain:"tile"})` returns none today.
7. **Delete uploaded resource** — `RED(aiTool)` : `runTool(ctx,"delete_resource",{assetId})` must remove the asset from `project.assets.uploaded` and its `resourceProfiles` row, and reject (not crash) when `uploadedResourceDeleteBlocker` reports an in-use reference. `find_tools("delete resource",{domain:"system"})` returns none today.
8. **Redo** — `RED(aiTool)` : a redo facade symmetric to `revert_last_edit` that re-applies `mapEditHistory.redoMapEdit` (forward re-apply, no-op when `redoStack` empty), because only the undo direction is currently exposed to the assistant.

Note on partial coverage flagged above: `clear_region` intentionally preserves event entities (events are surfaced via `find_events`/`get_event`), and `paint_tiles`/`fill_region` implement the same protected-start/transfer-cell skip and autotile reshaping as `tileActions`, so those are considered COVERED semantics, not gaps. `show_tile_grid`/`show_tiles` are deprecated (superseded by `tile_query`) and are view toggles — deliberately UI-ONLY.
