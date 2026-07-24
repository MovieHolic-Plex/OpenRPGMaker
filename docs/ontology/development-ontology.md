# RPG ZZU Development Ontology

> **Status:** 시점 스냅샷 (Updated: 2026-07-08). 갱신되지 않는 기록이다.

- Ontology schema: 1
- Project schema: 3
- Updated: 2026-07-08

## Capabilities

### MapEditing

Tile placement, layers, map tree operations, start position, and editor canvas behavior.

- Entities: `GameMap`, `MapTreeNode`, `TilesetDef`, `GameEvent`
- Types: `src/project/types/project.ts`, `src/project/types/base.ts`
- UI: `src/editor/EditScene.ts`, `src/editor/panels/tilePalette.ts`, `src/editor/panels/mapList.ts`
- Runtime: `src/project/collision.ts`, `src/player/playSceneMapRuntime.ts`, `src/player/playSceneMovement.ts`
- Storage: `src/project/io/guards.ts`, `src/project/io/shape.ts`, `src/project/io/references.ts`
- Tests: `test/mapEditCommands.test.ts`, `test/e2e/rm2k3-map-editor.spec.ts`, `test/e2e/rm2k3-map-runtime.spec.ts`

### EventAuthoring

Event pages, conditions, graphics, command editing, and command picker workflows.

- Entities: `GameEvent`, `EventPage`, `Command`, `CommonEvent`, `SwitchDef`, `VariableDef`
- Types: `src/project/types/events.ts`, `src/project/types/project.ts`
- UI: `src/editor/panels/eventEditor/commandPicker.ts`, `src/editor/panels/eventEditor/commandBody.ts`, `src/editor/panels/eventEditor/commandSummary.ts`, `src/editor/panels/eventEditor/pageProps.ts`
- Runtime: `src/player/interpreter.ts`, `src/player/interpreter/commandCatalog.ts`, `src/player/playSceneInterpreter.ts`
- Storage: `src/project/io/shapeCommandFields.ts`, `src/project/io/commandReferenceValidation.ts`
- Tests: `test/interpreter.test.ts`, `test/eventPages.test.ts`, `test/e2e/rm2k3-event-commands.spec.ts`

### TilesetSemantics

Tile metadata, tile groups, cluster rules, terrain tags, passability, palette presets, autotile groups, house kits, and AI tile meaning.

- Entities: `TilesetDef`, `Tile`, `TileAiMetadata`, `TileGroupMetadata`, `HouseKit`
- Types: `src/project/types/base.ts`
- UI: `src/editor/panels/tilesetMetadataEditor.ts`, `src/editor/panels/tilesetAiQuestionEditor.ts`, `src/editor/panels/tilesetAutotileEditor.ts`
- Runtime: `src/project/tilesetPassage.ts`, `src/project/aiPreviewGenerator.ts`, `src/project/aiPreviewContracts.ts`
- Storage: `src/project/io/guards.ts`, `src/project/io/shapeResourceFields.ts`, `src/project/tileMetadataDb.ts`
- Tests: `test/tileMetadataDb.test.ts`, `test/aiPreviewContracts.test.ts`, `test/houseKit.test.ts`, `test/e2e/rm2k3-tileset-readability.spec.ts`

### DatabaseRecords

Actors, classes, skills, items, equipment, enemies, troops, states, and animation records.

- Entities: `ActorRecord`, `SkillRecord`, `ItemRecord`, `EquipmentRecord`, `EnemyRecord`, `TroopRecord`, `StateRecord`, `BattleAnimationRecord`
- Types: `src/project/types/database.ts`
- UI: `src/editor/panels/database.ts`, `src/editor/panels/databaseRecordViews.ts`, `src/editor/panels/databaseControls.ts`, `src/editor/panels/databaseStateRecordView.ts`, `src/editor/panels/databaseTroopRecordView.ts`, `src/project/ontology/databaseStateOntology.ts`, `src/styles.databaseStates.css`, `src/styles.databaseTroops.css`
- Runtime: `src/battle/runtime.ts`, `src/player/interpreter.ts`, `src/player/playSceneBattle.ts`
- Storage: `src/project/io/shapeDatabaseFields.ts`, `src/project/io/references.ts`
- Tests: `test/defaultDatabase.test.ts`, `test/battleRuntimeDb.test.ts`, `test/e2e/rm2k3-database.spec.ts`, `test/e2e/rm2k3-database-states.spec.ts`

### BattleRuntime

Battle turns, battlers, rewards, troop events, animations, and battle UI behavior.

- Entities: `EnemyRecord`, `TroopRecord`, `SkillRecord`, `ItemRecord`, `BattleAnimationRecord`
- Types: `src/battle/types.ts`, `src/project/types/database.ts`
- UI: `src/player/battleDom.ts`, `src/player/battleFieldDom.ts`, `src/editor/panels/databaseTroopRecordView.ts`, `src/editor/panels/databaseTroopBattleEventPanel.ts`, `src/styles.databaseTroops.css`
- Runtime: `src/battle/runtime.ts`, `src/battle/battleEvents.ts`, `src/battle/battleRewards.ts`
- Storage: `src/project/io/shapeDatabaseFields.ts`
- Tests: `test/battleRuntime.test.ts`, `test/battleRuntimeDb.test.ts`, `test/e2e/rm2k3-battle.spec.ts`

### ResourcePipeline

Supabase-root resource payloads, local cache/bootstrap files, resource profiles, picker UI, and Phaser loading.

- Entities: `AssetRef`, `UploadedAsset`, `ResourceProfile`
- Types: `src/project/types/base.ts`
- UI: `src/editor/panels/resourceManager.ts`, `src/editor/panels/resourceModal.ts`, `src/editor/panels/eventEditor/npcGraphicPicker.ts`
- Runtime: `src/assets/bundled.ts`, `src/assets/generatedAssetResourceResolver.ts`, `src/assets/supabaseResourceCache.ts`, `src/player/resourceDisplay.ts`
- Storage: `src/project/io/resourceReferenceValidation.ts`, `src/project/io/shapeResourceFields.ts`
- Tests: `test/generatedAssetResourceResolver.test.ts`, `test/supabaseResourceCache.test.ts`, `test/e2e/rm2k3-resource-manager.spec.ts`

### ProjectPersistence

Serialization, package export, migration, shape guards, reference validation, and Supabase current_json sync.

- Entities: `Project`, `ProjectSession`, `SaveSlot`, `GameMap`, `Command`, `ResourceProfile`
- Types: `src/project/types/project.ts`, `src/project/types/events.ts`, `src/project/types/base.ts`
- UI: `src/editor/saveActions.ts`, `src/editor/panels/menu.ts`
- Runtime: `src/project/session.ts`, `src/project/package.ts`
- Storage: `src/project/io.ts`, `src/project/io/guards.ts`, `src/project/io/references.ts`, `src/project/io/migration.ts`, `src/project/supabaseProjectSync.ts`
- Tests: `test/io.test.ts`, `test/storePersistence.test.ts`, `test/supabaseProjectSync.test.ts`

## Entities

- `Project`: The root RPG ZZU project document.
- `GameMap`: A tile map with lower/upper layers and events.
- `MapTreeNode`: The hierarchical map tree entry.
- `TilesetDef`: Runtime and semantic definition for a tileset.
- `Tile`: A single indexed tile inside a tileset.
- `TileAiMetadata`: AI-readable meaning and runtime hints for one tile.
- `TileGroupMetadata`: A semantic group of tiles with placement grammar.
- `HouseKit`: Built-in house structure grammar consumed by `build_house_kit`, `build_village`, and showcase defaults.
- `GameEvent`: A map event with pages and commands.
- `EventPage`: Conditional event page state and command list.
- `Command`: A discriminated command executed by the interpreter.
- `CommonEvent`: Reusable command list triggered by event commands or switches.
- `SwitchDef`: Named boolean project switch.
- `VariableDef`: Named numeric project variable.
- `ResourceProfile`: Renderable/audio profile for a Supabase-root, bundled, or bootstrap asset.
- `AssetRef`: Reference to bundled or uploaded asset storage.
- `UploadedAsset`: Supabase current_json.assets.uploaded payload and metadata; local generated files are cache/bootstrap copies.
- `ActorRecord`: Database actor record.
- `SkillRecord`: Database skill record and effect.
- `ItemRecord`: Database item record.
- `EquipmentRecord`: Database equipment record.
- `EnemyRecord`: Database enemy record and action pattern.
- `TroopRecord`: Database troop record and battle events.
- `StateRecord`: Database state record.
- `BattleAnimationRecord`: Database animation record used by battle actions.
- `ProjectSession`: Runtime save/session state.
- `SaveSlot`: Persisted player save state.

## Relations

- `project-contains-map`: Project contains GameMap
- `project-contains-tileset`: Project contains TilesetDef
- `project-contains-database`: Project contains DatabaseRecords
- `map-uses-tileset`: GameMap uses TilesetDef
- `map-contains-event`: GameMap contains GameEvent
- `event-has-page`: GameEvent has EventPage
- `page-contains-command`: EventPage contains Command
- `command-references-map`: Command references GameMap
- `command-references-resource`: Command references ResourceProfile
- `command-reads-switch`: Command reads SwitchDef
- `command-writes-switch`: Command writes SwitchDef
- `command-reads-variable`: Command reads VariableDef
- `command-writes-variable`: Command writes VariableDef
- `item-invokes-skill`: ItemRecord invokes SkillRecord
- `skill-toggles-switch`: SkillRecord toggles SwitchDef
- `enemy-uses-skill`: EnemyRecord uses SkillRecord
- `troop-contains-enemy`: TroopRecord contains EnemyRecord
- `tileset-contains-tile-ai-metadata`: TilesetDef contains TileAiMetadata
- `tileset-contains-tile-group`: TilesetDef contains TileGroupMetadata
- `tile-group-groups-tile`: TileGroupMetadata groups Tile
- `resource-profile-describes-asset`: ResourceProfile describes AssetRef

## Contracts

- `map-uses-existing-tileset` (error): Every GameMap.tilesetId points to an existing TilesetDef.id.
- `map-tile-array-size` (error): GameMap lower and upper tile arrays match width * height.
- `supabase-project-root` (error): Canonical project data, including maps, mapTree, database records, start position, and session defaults, lives in Supabase current_json; local project files are fixtures, recovery snapshots, imports, or caches.
- `tileset-runtime-array-size` (error): Tileset passability, priority, and terrain arrays match TilesetDef.count.
- `tile-group-ids-in-range` (error): TileGroupMetadata.tileIds stay inside the owning TilesetDef count.
- `command-references-existing-map` (error): Transfer-style commands point to existing GameMap ids.
- `command-references-existing-record` (error): Commands reference existing switches, variables, actors, items, skills, troops, and common events.
- `database-record-references-exist` (error): Database record ids such as skillId, enemyIds, and animationId point to existing records.
- `resource-reference-exists` (error): Resource ids used by commands, records, or UI point to a Supabase-root uploaded payload, bundled bootstrap asset, or generated bootstrap asset.
- `supabase-resource-root` (error): Persistent resource bytes must be restorable from Supabase current_json.assets.uploaded; local public files are cache or bootstrap copies and must not be the only source for promoted generated resources.
- `bundled-resource-not-user-deletable` (warning): Bundled resources are not treated as user-deletable assets.

## Classification Evaluation

- Accuracy: 1
- Macro sensitivity: 1
- Macro precision: 1

- `MapEditing`: sensitivity 1, precision 1
- `EventAuthoring`: sensitivity 1, precision 1
- `TilesetSemantics`: sensitivity 1, precision 1
- `DatabaseRecords`: sensitivity 1, precision 1
- `BattleRuntime`: sensitivity 1, precision 1
- `ResourcePipeline`: sensitivity 1, precision 1
- `ProjectPersistence`: sensitivity 1, precision 1
