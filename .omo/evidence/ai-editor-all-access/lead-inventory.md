# Lead inventory — AI editor capability parity (independent of DAG)

Captured: 2026-08-26T17:55:00+09:00
Worktree: C:/Users/USER/Downloads/rpg-zzu-ai-all-editor-access
HEAD: a9ce6d26 snapshot: agent worktree base for ai-all-editor-access

## Already covered (do not re-implement)
- find_tools outside 40-cap (assistantSession.ts ~1965, discoveryTools.ts)
- set_map_properties name/tileset/encounters/BGM/background/battleBackground/flags/minimap
- resize_map, manage_map_tree (create/rename/move/dissolve folder)
- duplicate_map, remove_map, create_map
- set_project_settings, reset_project
- DB upserts: item/enemy/troop/actor/skill/equipment/class/state/common_event
- duplicate_database_record, delete_database_record, upsert_database_utility
- set_tile_metadata / set_tile_rules / upsert_tile_group
- list_resources (read only)
- event facades: upsert_event, place_npc, make_villager, set_shop_stock, create_transfer_pair, etc.

## High-probability authored-data GAPS (need DAG confirmation)
1. Resource manager writes — only list_resources exists. Editor can import/delete graphics. No upsert_resource / delete_resource / set_resource_meta.
2. Structure kit authoring — registerStructureKit production callers are 0 (memory 2026-08-26). list+stamp only; user cannot create kits via AI.
3. Battle animations — duplicate/delete collections include battleAnimations; no upsert_battle_animation.
4. Database characters (social/NPC character records) — likely no upsert_character.
5. Map fieldSpawns as map-properties — set_map_properties omits fieldSpawns; make_hunting_ground / make_action_enemy add some but cannot replace the map-props field-spawn table.
6. Tileset settings transparentColor (tilesetSettingsDetails.ts) — no set_tileset_settings facade found.
7. Event-command AI assist (eventEditor/aiAssist.ts → runEventCommandAssist) is a SPECIALIZED isolated LLM pipeline, not the shared tool registry.
8. Tileset AI workspace is a specialized vision pipeline, not shared tools.

## Embedded AI surfaces (preliminary)
- SHARED-TOOLS: aiChatPanel, databaseModal AI bar, clusterAiModal, MCP bridge
- SPECIALIZED-WITH-HANDOFF: canvas workbench / region task / build palette (same registry via runRegionTask, planner skipped)
- ISOLATED-GAP candidates: eventEditor aiAssist, tileset AI workspace

## Test file
test/aiEditorCapabilityParity.test.ts does NOT exist yet. RED must be written after verify-audits.

## Constraints to preserve
- MAX_EXPOSED_TOOLS = 40
- find_tools + discovered-tool escalation
- approval/destructive gates
- provider-safe schemas (no oneOf)
