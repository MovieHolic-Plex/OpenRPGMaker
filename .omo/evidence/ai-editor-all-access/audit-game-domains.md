# AI Editor All-Access — Game-Domain Reachability Audit

Task: `st_01a03d44`. Scope: read-only audit of AI tool reachability for the game-authoring
domains **world, quest, battle, system, time, farming/life, monster, ending, quality, and
runtime-authored editor capabilities**.

Method: for each source-owned editor capability, record its canonical tool/facade (from
`src/editor/tools/` single registry `TOOL_REGISTRY`) or `MISSING`, the routing `ToolDomain`
(from `toolRegistry.ts` domain tagging + `assistantToolMode.ts` INTENT_KEYWORDS), and proposed
RED guard assertions (tests to add in `test/`).

## Classification Key

- `COVERED` — a canonical non-deprecated tool exists and is exposed by some active domain.
- `MISSING` — the source capability exists (editor/panel/project model) but no AI tool reaches it.
- `UI-ONLY` — the capability is authored exclusively through editor UI panels/models; no AI tool
  writes or reads it. (Treated as the stacked form of `MISSING` for AI reachability.)

Every identified capability below carries one of these classifications.

---

## 1. World 🌍 (`ToolDomain: world`)

Routing: intent strong keywords `세계관/월드/지역/관계/엔티티` → `world`. Registry tag
`withDomain(WORLD_TOOLS, "world")`; pinned `plan_world/build_world/link_maps/lint_world`.

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| World entity query | `src/editor/tools/worldTools.ts` | `query_world` | world (read) | COVERED |
| World entity upsert (add/modify) | `worldTools.ts` | `upsert_world_entities` | world (write) | COVERED |
| Link/unlink game-object ref to entity | `worldTools.ts` | `link_world_ref` | world (write) | COVERED |
| World planning/DSL | `worldGraphTools.ts` | `plan_world` | world | COVERED |
| Build world contents from plan | `worldGraphTools.ts` | `build_world` | world | COVERED |
| Link maps into world graph | `worldGraphTools.ts` | `link_maps` | world | COVERED |
| World lint | `worldGraphTools.ts` / `project/world` | `lint_world` | world | COVERED |

> Note: `plan_world/build_world/link_maps/lint_world` are in `worldGraphTools.ts` and exposed via
> the `world` domain (pinned). All world capabilities are reachable under the `world` intent.

---

## 2. Quest 📜 (`ToolDomain: quest`)

Routing: intent strong `퀘스트/quest/플래그/보상/목표/단계/튜토리얼/분기/반전/서사/story/엔딩/의뢰/미션/촌장…` → `quest`.
Registry tag `withDomain(QUEST_TOOLS, "quest")`; `STORY_TOOLS` (story flags) also tagged `quest`;
`AUTHOR_STORY_ARC_TOOLS` tagged `event` but pinned under `quest`.

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| Quest switch/variable flag registration | `questTools.ts` | `create_quest_flags` | quest (write) | COVERED |
| Declarative quest compile (giver/steps/rewards/gates) | `questTools.ts` / `project/quest/questCompiler` | `create_quest` | quest (write) | COVERED |
| Quest DAG graph definition | `questTools.ts` / `project/quest/questGraph` | `define_quest` | quest (write) | COVERED |
| Quest lint (dead-end/unreachable/orphan) | `questTools.ts` | `lint_quest` | quest (read) | COVERED |
| Walkthrough generation | `questTools.ts` | `generate_walkthrough` | quest (read) | COVERED |
| Quest verify via scene test | `questTools.ts` / `testing/sceneTestRunner` | `verify_quest` | quest (read) | COVERED |
| Story flag declare | `storyTools.ts` | `declare_story_flag` | quest (write) | COVERED |
| Story flag usage / state read | `storyTools.ts` | `find_flag_usage`, `get_story_state` | quest (read) | COVERED |
| Story arc authoring | `storyArcTools.ts` | `author_story_arc` | event+quest (pinned) | COVERED |

> Note: `author_story_arc` is the single shared facade for quests/endings narrative; it is pinned
> under both `event` and `quest`. No quest capability is MISSING.

---

## 3. Battle ⚔ (`ToolDomain: battle`)

Routing: intent strong `전투/배틀/적/몬스터/enemy/troop/트룹/시뮬/드롭/hp/상성/속성` → `battle`
(and `database` when monster keywords present). Registry tag `withDomain(BATTLE_TOOLS, "battle")`.
`battle` has **no pinned set**; WRITE_HEAVY order = 3.

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| Headless battle simulate | `battleTools.ts` / `battle/simulate` | `simulate_battle` | battle (read) | COVERED |
| Enemy stat tuning (inverse damage formula) | `battleTools.ts` | `tune_enemy` | battle (write) | COVERED |

> Note: battle read/write both reachable. No MISSING. Secondary hazard (see §7): monster-system
> authoring lives outside the `battle` domain and is fragmented.

---

## 4. System ⚙ (`ToolDomain: system`)

Routing: intent strong `린트/타이틀/시작위치/히스토리/플레이테스트/새 프로젝트/시간 시스템/품질/quality/평가…` → `system`.
Registry tags `withDomain(REFACTOR_TOOLS/HISTORY_TOOLS/QUALITY_EVALUATION_TOOLS/TIME_TOOLS/
MONSTER_SYSTEM_TOOLS/EXPORT_TOOLS/PLAY_TOOLS/AI_DOC_TOOLS, "system")`; `run_lint/list_project_commits/
evaluate_game_quality` also overridden to `system`; pinned system `reset_project/configure_time_system/
evaluate_game_quality`. `PROJECT_TOOLS` and `FIND_TOOLS` are domain-less (always exposed).

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| Project init / reset | `projectTools.ts` | `reset_project` | system (+map pinned) | COVERED |
| Project settings edit | `projectTools.ts` | `set_project_settings` | always (no domain) | COVERED |
| Global lint | `queryTools.ts` / `project/lint` | `run_lint` | system (read) | COVERED |
| Edit history | `historyTools.ts` / `mapEditHistory` | `list_edit_history` | system (read) | COVERED |
| Revert last edit | `historyTools.ts` | `revert_last_edit` | system (write) | COVERED |
| Switch/variable rename refactor | `refactorTools.ts` | `rename_switch`, `rename_variable` | system (write) | COVERED |
| Unused-resource prune | `refactorTools.ts` | `prune_unused` | system (write) | COVERED |
| Export game | `exportTools.ts` | `export_game` | system (write) | COVERED |
| Playtest walkthrough | `playTools.ts` | `play_walkthrough`, `run_scene_test` | system | COVERED |
| Commit log / discovery | `queryTools.ts`, `discoveryTools.ts` | `list_project_commits`, `find_tools` | system / always | COVERED |
| AI doc navigation | `aiDocTools.ts` | `present_doc`, `list_ai_docs` | system | COVERED |

> `set_title_screen` / `set_session_start` live in `dbTools` and route via `database`, not `system`
> — a minor routing wrinkle but still reachable. No MISSING in the system domain as authored.

---

## 5. Time ⏰ (routed via `system`)

Routing: intent strong `시간 시스템/낮/밤/아침/저녁/day night/time system` → `system`; also
pinned tool `configure_time_system` under `system`.

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| Time/calendar system config (start/end hour, per-real-second speed, days/season, forceSleep, onDayEnd) | `timeTools.ts` / `project/gameTime`, `databaseRecordModel` | `configure_time_system` | system (write) | COVERED |
| Time-system state read-back | `queryTools.ts` (generic) / `present_doc` | generic query only (no dedicated read tool) | system | COVERED (partial read) |

> Write path fully covered. Dedicated read tool for the active `system.timeSystem` config is
> absent (retrievable only via generic project docs/`get_project_summary`). Low-severity gap.

---

## 6. Farming / Life 🌾 (fragmented: `map` + `database` + UI-ONLY)

Routing: farm intent (`농사/작물/밭`) has **no dedicated intent keyword**; farm-plot tool
`create_farm_plot` is routed via `map` (pinned); crop records route via `database`.

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| Farmable-area declaration on map | `mapTools.ts` | `create_farm_plot` | map (write, pinned) | COVERED |
| Crop record CRUD (seed/harvest/stages/seasons) | `dbTools.ts` / `project/nModel` | `define_crop` | database (write) | COVERED |
| Life skills (5 types/type/maxLevel/level rewards) | `panels/databaseLifeCraftingView.ts` / `database.lifeSkills` | **MISSING** — no tool | — | **UI-ONLY** |
| Crafting recipes (materials/results/requiresUnlock) | `databaseLifeCraftingView.ts` / `project.system.recipes` | **MISSING** — no tool | — | **UI-ONLY** |
| Item upgrades (before/after/cost/materials) | `databaseLifeCraftingView.ts` | **MISSING** — no tool | — | **UI-ONLY** |
| Tool actions / tool capability grid | `databaseLifeCraftingView.ts` (toolAction rows) | **MISSING** — no tool | — | **UI-ONLY** |
| Energy system (max/initial/restorePerDay) | `databaseLifeCraftingView.ts` | **MISSING** — no tool | — | **UI-ONLY** |
| Shipping (enabled/historyLimit/allowedItemIds) | `databaseLifeCraftingView.ts` | **MISSING** — no tool | — | **UI-ONLY** |
| World unlocks | `databaseLifeCraftingView.ts` | **MISSING** — no tool | — | **UI-ONLY** |
| Bundles (required items + rewards) | `databaseLifeCraftingView.ts` | **MISSING** — no tool | — | **UI-ONLY** |
| Makers / processing facilities (input/output/durationMinutes) | `databaseLifeCraftingView.ts` | **MISSING** — no tool | — | **UI-ONLY** |
| Farm animals / barn | `database` farmAnimals tab (`db-tab-farm-animals`) | **MISSING** — no tool | — | **UI-ONLY** |
| Resident relationships (gifts/calendar/profile) | `panels/databaseCharacterView.ts` | **MISSING** — no tool | — | **UI-ONLY** |
| Daily weather | `database` dailyWeather tab (`db-tab-daily-weather`) | **MISSING** — no tool | — | **UI-ONLY** |
| Fishing / collections / museum | `database` lifeCollections tab | **MISSING** — no tool | — | **UI-ONLY** |

> This is the largest reachability gap in the audit. `databaseLifeCraftingView.ts`,
> `databaseCropView.ts`, `databaseCharacterView.ts`, and the lifeCollections/farmAnimals/
> dailyWeather tabs are derived UI surfaces authoritative for the P0 life system
> (`openwiki/editor-database.md` §39-50, §106), while the AI tool registry reaches only
> `create_farm_plot` + `define_crop`. Everything else is UI-ONLY / MISSING for AI.

---

## 7. Monster 👾 (fragmented: `system` + `database` + `map`)

Routing: monster intent `몬스터/포획/종족/사냥터/조우` — `몬스터/enemy/troop` is a `battle` strong
keyword, and `findIntentDomains` additionally enables `database` on monster words. Neither
activates `system` (where `configure_monster_system` lives) nor `map` (hunting ground).

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| Monster collect/capture + battle-party gate | `monsterSystemTools.ts` (system flags) | `configure_monster_system` | system (write) | COVERED |
| Monster species record | `dbTools.ts` | `define_monster_species` | database (write) | COVERED |
| Starter monsters | `dbTools.ts` | `give_starter_monsters` | database (write) | COVERED |
| Type chart (species/element rates) | `dbTools.ts` | `set_type_chart` | database (write) | COVERED |
| Hunting ground authoring | `mapTools.ts` | `make_hunting_ground` | map (write, pinned) | COVERED |
| Encounter table | `mapTools.ts` | `set_encounter_table` | map (write, pinned) | COVERED |

> All monster authoring capabilities have a tool, **but routing is fragmented**: a user request
> containing only `몬스터/포획/종족` activates `battle`+`database`, which exposes species/type-chart
> tools but **does not** expose `configure_monster_system` (system) or `make_hunting_ground`/
> `set_encounter_table` (map). The full monster pipeline is not simultaneously reachable from a
> single intent. Classification: each capability COVERED; the *routing composition* is a gap.

---

## 8. Ending 🎬 (routed via `event`, also `quest`)

Routing: `ENDING_TOOLS` tagged `event` (`withDomain(ENDING_TOOLS, "event")`); pinned under `event`
(`define_ending`, `list_endings`). Ending keywords (`엔딩/ending/결말`) are present in both
`quest` and `event` strong sets. `compileCutscene`/`script_cutscene` underpin epilogues.

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| Define ending (conditions/priority/epilogue) | `endingTools.ts` / `project/endings` | `define_ending` | event (write, pinned) | COVERED |
| List endings + shadow/conflict warnings | `endingTools.ts` | `list_endings` | event (read, pinned) | COVERED |
| Cutscene/epilogue authoring | `cutscene`, `eventTools.ts` | `script_cutscene`, `script_cutscene_preset` | event (write, pinned) | COVERED |

> Ending authoring fully reachable via `event` intent (pinned so it survives the 40-tool cap).
> No MISSING.

---

## 9. Quality 🧪 (routed via `system`)

Routing: intent strong `품질/quality/평가/evaluate` → `system`; `evaluate_game_quality` pinned
under `system` and overridden to `system` domain.

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| Objective quality/integrity/coverage evaluation | `qualityEvaluation.ts` / `project/lint`, `world`, `storyFlagUsage` | `evaluate_game_quality` | system (read, pinned) | COVERED |
| Per-quest verify (feeds quality walkthroughResults) | `questTools.ts` | `verify_quest` | quest (read) | COVERED |

> Note: `evaluate_game_quality` explicitly returns no subjective scores (`LIMITATIONS`) — this is a
> designed boundary, not a gap. No MISSING for objective quality.

---

## 10. Runtime-Authored Editor Capabilities 🏗 (routed via `tile`/`map`)

"Runtime-authored" = capabilities the source composes/executes at runtime to author game content
(multi-step facades, sessions, procedural generation). Registry canonical route manifest
(`CONSTRUCTION_WRITE_SUPERSEDED`) maps legacy writers → canonical facades.

| Capability | Source owner | Canonical tool/facade | Routing | Class |
| --- | --- | --- | --- | --- |
| House exterior authoring (canonical facade) | `authorHouseToolDef.ts` / `authorHouseExecution` | `author_house` | tile (write, pinned) | COVERED |
| Village authoring (canonical facade) | `authorVillageToolDef.ts` / `authorVillageScope` | `author_village` | tile+map (write, pinned) | COVERED |
| Village multi-step session | `villageSession.ts` | `start/run/advance_village_build`, `evaluate_village_layer`, `get_village_session` | tile | COVERED |
| Interior room harness | `interiorRoomSession.ts` | `start_interior_room_session`, `run_interior_room_pipeline`, `advance_interior_room_build`, `evaluate_interior_room`, `furnish_interior_space` | tile (pinned) | COVERED |
| Dungeon room harness | `dungeonRoomSession.ts` | `start/run/advance_dungeon_room_build`, `evaluate_dungeon_room`, `list_dungeon_room_themes` | tile | COVERED |
| Deterministic construction v3 primitives | `tools/v3/constructionTools.ts` | `build_wall/build_roof/fill_region/lay_path/place_door/place_window/place_props/tile_erase` | tile (write) | COVERED |
| Castle module authoring | `castleBuilder.ts` | `build_castle` | tile (write, pinned) | COVERED |
| Structure-kit stamping | `structureKitTools.ts` | `stamp_structure_kit`, `list_structure_kits` | tile (write) | COVERED |
| Map generation | `generateMapTool.ts` / `mapGenerationProfiles` | `generate_map` | map (write) | COVERED |
| Legacy house/village writers (engine compat) | `houseKitTools`/`houseLotTools`/`village*`/`mapTools.build_house` | superseded by `author_house`/`author_village` (`CONSTRUCTION_WRITE_SUPERSEDED`) | deprecated (not exposed) | COVERED (via facade) |

> All runtime-authored construction capabilities are reachable through canonical facades pinned
> under `tile` (with `author_village` also under `map`). Legacy writers are correctly marked
> `deprecated + supersededBy` and hidden from the LLM. No MISSING.

---

## Summary of Reachability Gaps

1. **Farming/life UI-ONLY block (§6)** — the P0 life system authored in
   `databaseLifeCraftingView.ts`/`databaseCropView`/`databaseCharacterView`/lifeCollections/
   farmAnimals/dailyWeather has no AI tool beyond `create_farm_plot` + `define_crop`. Skills,
   recipes, upgrades, tool actions, energy, shipping, world-unlocks, bundles, makers, farm
   animals, resident relationships, daily weather, fishing/collections/museum are all MISSING.
2. **Monster routing fragmentation (§7)** — species/type-chart reachable via `database`, gates via
   `system`, hunting/encounters via `map`; a `몬스터` request exposes only the database subset.
3. **Time read-back (§5)** — `configure_time_system` writes, but no dedicated read tool returns the
   active time-system config (generic query only). Low severity.

Strong, low-gap domains: **world, quest, battle, ending, quality, runtime-authored construction**.

---

## Proposed RED Assertions (to add under `test/`)

> RED = a guard that fails today for the target gap and passes once closed. Pure reachability
> gates formulated against `toOpenAiTools`/`getTool`/registry, not prose.

### Farming/life life-system (RED for §6)
- `R1` — For a dataset with a `database.lifeSkills` record, `getTool("upsert_life_skill") !== undefined`
  AND `toOpenAiTools({mode:"database"})` includes a life-skill write tool. (Fails today: no tool.)
- `R2` — `toOpenAiTools({mode:"database"})` includes recipe authoring
  (`upsert_recipe` or canonical `author_recipe`) when `project.system.recipes` is non-empty.
- `R3` — Crafting/life-system write tools are present in the `database` exposure when the prompt
  contains `생활/제작/요리/낚시/에너지/출하` (activation-keyword guard in `assistantToolMode`).
- `R4` — Farm-animals / resident-relationships / daily-weather collections each have a
  `getTool("upsert_<collection>")` path and appear in `get_database_records` collection list.

### Monster routing (RED for §7)
- `R5` — For a prompt containing only `몬스터`, the resolved exposure set includes
  `configure_monster_system` (system) AND `define_monster_species`/`set_type_chart` (database)
  AND `make_hunting_ground`/`set_encounter_table` (map) — i.e. the full monster pipeline is
  reachable, not just the database slice.

### Time read-back (RED for §5)
- `R6` — After `configure_time_system`, a read tool returns the active `system.timeSystem`
  (`get_project_summary` or a dedicated `get_time_system`), and a `시간 시스템` intent activates it.

### No-regression reachability pins (all COVERED domains)
- `R7` — `define_ending`/`list_endings` are always exposed when ending keywords activate `event`
  (guards the 2026-08-23 "엔딩 기능이 없다" false-report fix).
- `R8` — `evaluate_game_quality` remains exposed under `system` quality intent.
- `R9` — World facades `plan_world/build_world/link_maps/lint_world` and quest set
  `create_quest/define_quest/lint_quest/generate_walkthrough/verify_quest` remain exposed in their
  domains (round-robin cap 40 must not evict them).
- `R10` — Runtime-authored canonical facades `author_house`/`author_village`/`build_castle` and the
  interior/dungeon session leaders stay exposed under `tile` intent; legacy `build_house_kit`/
  `build_house_lots`/`plan_village` remain `deprecated + supersededBy` (never re-exposed).

---

## Verification

```
rg -n "MISSING|COVERED|UI-ONLY" .omo/evidence/ai-editor-all-access/audit-game-domains.md
```
Every capability row carries one of the three classifications; all table rows are tagged.
