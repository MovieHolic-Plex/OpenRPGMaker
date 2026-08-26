# Audit: Database Panels/Mutators, Project Settings, Save/Export/Import, Resource Mgmt — AI Read/Write Capability Gaps

- Date: 2026-08-26
- Repo: `rpg-zzu-ai-all-editor-access` @ a9ce6d26
- Scope: `src/editor/database*.ts`, `src/editor/panels/database*.ts`, `src/editor/saveActions.ts`, resource manager files, project/db tools, AI routing/tests/openwiki.
- Verdict classification per row: `COVERED` (an AI tool/facade reaches the mutation), `MISSING` (no AI read/write path; UI-only or absent), `UI-ONLY` (mutable solely through browser panels).
- Safety class legend: `review-required` = the write path forces proposal-review approval; `proposal-gated` = proceeds only after user approval in the proposal UI; `lint-gated` = blocked by the project-integrity/lint commit gate. Destructive rows name their approval boundary explicitly.

## 1. Classification completeness

Every DB record collection reachable from the project schema (`actors/classes/skills/items/equipment/enemies/troops/states/battleAnimations`) plus the utility/flag/project-settings surfaces has been audited for both **read** and **write**. No collection left unclassified.

---

## 2. DB record mutations — concrete rows

Mutator owner sources:
- `src/editor/databaseActions.ts` — `addDatabaseRecord`, `updateDatabaseRecord`, `duplicateDatabaseRecord`, `deleteDatabaseRecord`, `bulkRenameSwitches/bulkRenameVariables`, `installGeneratedBattleEffectPack`.
- `src/editor/databaseRecordMutators.ts` — `updateClassRecord/updateSkillRecord/updateItemRecord/updateEquipmentRecord/updateEnemyRecord/updateTroopRecord`.
- AI facade: `src/editor/tools/dbTools.ts` (`DB_TOOLS`), `queryTools.ts` (`get_database_records`), `refactorTools.ts` (`rename_switch/rename_variable/prune_unused`), `projectTools.ts` (`set_project_settings`/`reset_project`).
- Write path: tools apply to a structural draft, then `commitChangeset` (project-integrity/lint) in `toolRunner.ts`; all DB edits are classified `review-required` by `proposalSafety.ts` (they are not in `LOW_RISK_SPATIAL_TOOLS` → forced proposal approval).

| # | Mutation | Owner source (UI/panel) | AI tool / facade | Safety class | Notes |
|---|----------|--------------------------|------------------|--------------|-------|
| DB-1 | Add record (any of 9 collections) | `addDatabaseRecord` (`databaseActions.ts:83`) | `upsert_*` merge (insert-if-missing) | review-required | Add achieved through upsert-side by id; no separate `add_*` tool. |
| DB-2 | Update actor | actorRecord panels → `updateDatabaseRecord("actors")` | `upsert_actor` | review-required | `get_database_records` returns `{id,name}` only — AI cannot read full actor fields (see R-1). |
| DB-3 | Update class (+learned skills/promotions) | `databaseClassRecordView` → `updateDatabaseRecord("classes")` | `upsert_class`, `define_promotion` | review-required | — |
| DB-4 | Update skill | `databaseSkillRecordView` → `updateDatabaseRecord("skills")` | `upsert_skill` | review-required | — |
| DB-5 | Update item | `databaseItemRecordView` → `updateDatabaseRecord("items")` | `upsert_item` | review-required | — |
| DB-6 | Update equipment | `databaseEquipmentRecordView` → `updateDatabaseRecord("equipment")` | `upsert_equipment` | review-required | — |
| DB-7 | Update enemy (+tune) | `databaseEnemyRecordView` → `updateDatabaseRecord("enemies")` | `upsert_enemy`, `tune_enemy`, `make_action_enemy` | review-required | — |
| DB-8 | Update troop | `databaseTroopRecordView` → `updateDatabaseRecord("troops")` | `upsert_troop` | review-required | — |
| DB-9 | Update state (incl. runtimeEffects) | `databaseStateRecordView` → `updateDatabaseRecord("states")` | `upsert_state` | review-required | `runtimeEffects` knob merge reachable; `set_type_chart` covers type chart. |
| DB-10 | **Update/create battle animation** | `databaseAnimationRecordView` → `updateDatabaseRecord("battleAnimations")` | **MISSING** (no `upsert_battle_animation` in `DB_TOOLS`) | UI-ONLY (write) | delete/duplicate covered via generic tools; create & field update are UI-only. See R-2. |
| DB-11 | Update element/terrain/battleCommand utility records | `databaseUtilityViews` → `upsert_database_utility`-style store updates | `upsert_database_utility` | review-required | — |
| DB-12 | Duplicate record (any collection) | `duplicateDatabaseRecord` (`databaseActions.ts:348`) | `duplicate_database_record` | review-required | — |
| DB-13 | **Delete record (destructive)** | `deleteDatabaseRecord` (`databaseActions.ts:385`) | `delete_database_record` | review-required + lint-gated | **Approval boundary:** (1) `databaseReferenceMessage` refuses delete while references remain; (2) `projectLint` commit gate blocks dangling refs; (3) all DB writes force proposal review-approval before commit. |
| DB-14 | Bulk rename switches (range, adds slots) | `databaseUtilityViews.ts:232` → `bulkRenameSwitches` | `rename_switch` (single, id/name→id) | MISMATCH/partial | Range bulk rename + automatic numbered-slot creation (`ensureNumberedSlotCount`) is UI-only. AI `rename_switch` renames an existing switch only — cannot create/count-numbered switches. See R-3. |
| DB-15 | Bulk rename variables (range, adds slots) | `databaseUtilityViews` → `bulkRenameVariables` | `rename_variable` (single) | MISMATCH/partial | Same as DB-14 for variables. |
| DB-16 | Install generated battle-effect pack (non-destructive upgrade) | `databaseActions.ts:132` `installGeneratedBattleEffectPack` | **MISSING** (no AI tool) | UI-ONLY / read status via none | Adds/upgrades generated animations + bindings; only reachable from battle/DB UI. See R-5. |

---

## 3. Read capability gaps (DB)

| # | Read goal | Available AI read | Verdict |
|---|-----------|-------------------|---------|
| R-1 | Full record field values before editing | `get_database_records` returns only `{id,name}` lists (`queryTools.ts:511`) | **MISSING** — AI cannot see an enemy's exact `stats/rewards/actions`, an item's `stateEffects`, etc. Must rely on schema examples. Largest read gap. |
| R-2 | Battle animation full read | No collection enum entry exposes animation fields beyond `{id,name}` | MISSING (tied to DB-10 write gap) |
| R-3 | Switch/variable numbered slot inventory | `get_database_records` returns `{id,name}` for switches/variables | Partial — reads ids but no create/slot tool (DB-14/15 write gap) |
| R-4 | System/project settings read | `get_project_summary` (core, `queryTools`) | COVERED |

---

## 4. Project settings

| # | Setting mutation | Owner source | AI tool / facade | Safety class | Notes |
|---|------------------|--------------|------------------|--------------|-------|
| P-1 | Title/author/terms/playResolution/system resources/battle defaults/start party | `databaseSystemView.ts` → `store.update` | `set_project_settings` | review-required | COVERED for the listed subset. |
| P-2 | Title screen (title/menu/visibility/sounds/display) | `databaseSystemView.ts` → `store.update` | `set_title_screen` | review-required | COVERED. |
| P-3 | Type chart | `databaseSystemView.ts` → `databaseRecordModel` | `set_type_chart` | review-required | COVERED. |
| P-4 | **Time system config** (day start/end hour, daysPerSeason, minutesPerRealSecond) | `databaseSystemView.ts` (time system block) | **MISSING** — `set_project_settings` has no time-system fields | UI-ONLY | See R-6. |
| P-5 | Battle skins / UI style beyond one enum | `databaseSystemView.ts` (BATTLE_UI_STYLE_OPTIONS / BATTLE_SKINS) | `set_project_settings.battle.uiStyle` (single string) | partial | Skins registry surfacing in UI richer than tool surface. |
| P-6 | Session start (gold/inventory/party) | session panels → `store.update` | `set_session_start` | review-required | COVERED. |
| P-7 | Reset/blank project | project picker / new-project UI | `reset_project` | review-required + warning | **Approval boundary:** warning text plus proposal review; explicit user-new-project intent required by docstring. |

---

## 5. Save / load / export / import

Owner source: `src/editor/saveActions.ts` (`saveProjectNow`, `reloadProjectFromDbNow`), `src/editor/tools/exportTools.ts`, picker panels (`projectPickerCover.ts`, `dbConnectionProjectPicker.ts`), `menu.ts`.

| # | Operation | Owner source | AI tool / facade | Safety class | Verdict |
|---|-----------|--------------|------------------|--------------|---------|
| S-1 | Save to remote | `saveProjectNow` (`saveActions.ts:6`) via UI save button / menu | **MISSING** — no `save_project`/`flush` AI tool | UI-ONLY | AI tool writes land in the local store via `commitChangeset`; remote persist requires a user UI save. |
| S-2 | Reload from remote (incl. conflict handling) | `reloadProjectFromDbNow` (`saveActions.ts:50`) | **MISSING** | UI-ONLY | Guarded by unsaved-changes check; no AI equivalent. |
| S-3 | Export verification (web bundle summary) | — | `export_game` (mode: read) | — | COVERED (read-only checkpoint). |
| S-4 | Export **deliverable** (ZIP download) | UI download path (`prepareWebExport` → download) | No AI tool triggers download | UI-ONLY | read tool validates; producing the artifact is UI-only. |
| S-5 | Import project | picker panels (`projectPickerCover`, `dbConnectionProjectPicker`) | **MISSING** — no `import_project` tool | UI-ONLY | See R-7. |
| S-6 | Commit-history read | — | `list_project_commits` (queryTools) | read | COVERED. |

---

## 6. Resource management

Owner source: `src/editor/panels/resourceManager.ts` (`importImageResource`, `importAudioResource`, `addTilesetFromUpload`, `applyTilesetToCurrentMap`, `deleteUploadedAsset`), `resourceManagerViews.ts`, `resourceManagerUtils.ts`. AI read: `list_resources` (`queryTools.ts:335`, semantic search, mode read). `set_project_settings.resources` can assign existing resource ids to system slots.

| # | Mutation | Owner source | AI tool / facade | Verdict |
|---|----------|--------------|------------------|---------|
| RM-1 | Import image resource (PNG/JPEG, dims validation) | `importImageResource` (`resourceManager.ts`) — `FileReader` + `store.update` | **MISSING** | UI-ONLY |
| RM-2 | Import audio resource (WAV/MP3/OGG) | `importAudioResource` (`resourceManager.ts`) | **MISSING** | UI-ONLY |
| RM-3 | Add tileset from uploaded asset | `addTilesetFromUpload` / `ensureTilesetFromUpload` | **MISSING** | UI-ONLY |
| RM-4 | Apply tileset to current map | `applyTilesetToCurrentMap` → `setMapTileset` | `tile` tooling can reference existing tilesets; no resource-creation tool | partial |
| RM-5 | **Delete uploaded asset (destructive)** | `deleteUploadedAsset` (`resourceManager.ts`) — blocked by `uploadedResourceDeleteBlocker` when referenced | **MISSING** | UI-ONLY — **Approval boundary (UI):** reference blocker (`resourceReferenceMessage` + tileset/map usage check) before delete; no AI path. |
| RM-6 | Resource search/assign | — | `list_resources` (read) + `set_project_settings.resources` (assign existing id) | COVERED for read/assign of existing |

---

## 7. Proposed RED assertions (to be added as read-only tests / guardrails)

These assert capability presence so regressions close the gaps; red until the listed facade exists.

- **RED-A1 (full-record DB read):** assert `TOOL_REGISTRY` exposes a DB read tool that returns full record fields (e.g. an `upsert_*` round-trip against existing fields must not depend on model-invented values). Currently red — only `{id,name}` reads exist (R-1).
- **RED-A2 (battle animation write):** assert a write tool reaches `database.battleAnimations` create/update (DB-10). Currently red.
- **RED-A3 (resource write facade):** assert an AI write facade reaches `importImageResource/importAudioResource/deleteUploadedAsset` (or a documented equivalent) (RM-1/2/5). Currently red.
- **RED-A4 (switch/variable numbered slot create):** assert an AI tool can create/count-numbered switch & variable slots equivalent to `bulkRename*` (DB-14/15). Currently red.
- **RED-A5 (save/reload AI tool):** assert an AI tool triggers `saveProjectNow` / remote reload (S-1/S-2). Currently red.
- **RED-A6 (time-system settings):** assert `set_project_settings` (or a sibling) accepts time-system config fields (P-4). Currently red.
- **RED-A7 (project import tool):** assert an AI tool performs project import equivalent to picker panels (S-5). Currently red.

---

## 8. Summary of gap classes

- **COVERED:** record update/create via `upsert_*` for actors/skills/items/equipment/classes/enemies/troops/states/commonEvents; elements/terrains/battleCommands; monster species; crops; type chart; title screen; session start; reset project; delete/duplicate (with lint + review-required gates); switch/variable rename.
- **MISSING (write):** battle animation create/update (DB-10); generated battle-effect pack install (DB-16); resource import/delete/tileset-add (RM-1..5); save-to-remote & reload (S-1/S-2); export ZIP delivery (S-4); project import (S-5); time-system settings (P-4).
- **MISSING (read):** full record field read ahead of partial update (R-1); battle-animation detail read (R-2).
- **Partial:** switch/variable range bulk rename + numbered-slot creation (DB-14/15); battle skin set breadth (P-5).
- **Destructive approval boundaries named:** `delete_database_record` (DB-13) = reference gate + projectLint gate + proposal review; `deleteUploadedAsset` (RM-5) = reference blocker gate (UI); `reset_project` (P-7) = explicit-intent warning + proposal review.
