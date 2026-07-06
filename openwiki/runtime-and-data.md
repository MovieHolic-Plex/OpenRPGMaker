# Runtime and Data

Use this page when changing play mode, event execution, battle behavior, save/session state, project schema, persistence, or migration behavior.

## Pre-edit routing

- Play scene behavior, player movement, event triggering, overlays, and scene test hooks: start in `src/player/PlayScene.ts` and adjacent `src/player/playScene*.ts` modules.
- Event command execution, branching, waits, pauses, stack behavior, and command result handling: start in `src/player/interpreter/` and only let scene code consume interpreter results.
- Battle rules, turn flow, damage, rewards, battle events, and battle snapshots: start in `src/battle/runtime.ts` and adjacent `src/battle` modules.
- Title/load surfaces, status menu, dialogue UI, save slots, and play shell wiring: start in `src/player/player.ts`, `src/player/playerLoadPanel.ts`, `src/player/playerStatusMenu*.ts`, and `src/player/dialogue.ts`.
- Authored project schema, defaults, validation, migration, references, and persistence: start in `src/project/types`, `src/project/defaults`, `src/project/io`, and `src/project/store.ts`.
- Supabase or remote/local project transport: start in `src/project/supabaseProjectSync.ts`, `src/project/supabaseProjectConfig.ts`, and keep transport separate from project model rules.

## Agent cautions

- Keep authored project data and runtime session data separate.
- Runtime-only fields should not enter persisted project JSON unless the schema explicitly supports them.
- Schema changes must include migration, validation, fixtures, and save/load verification.
- Battle rules belong in `src/battle`; scene or DOM code should render/bridge them rather than becoming the source of truth.
- Battle DOM is intentionally presentation-only and compact: render the field, message window, command list, party status, target prompt/brackets, and result rewards without duplicating runtime predictions into extra analysis panels.

- `PlayScene` is the play-mode scene entry point. It wires map loading, player input, runtime overlays, battle entry, and scene-level helpers, but it should not own game rules.
- Play mode uses a 320x240 logical play stage scaled by the smallest integer that covers the available viewport. The viewport is the crop container (`overflow:hidden`), the scaled stage stays centered, and stage-mounted DOM overlays should respect the crop-safe CSS variables from `playSurface.ts`.
- The interpreter is the command executor for in-play events. Keep command resolution, branching, pauses, and step results in the interpreter layer; let `PlayScene` only consume those results.
- Battle runtime lives under `src/battle` and should stay self-contained. `PlayScene` can launch battles and render the battle UI, but battle state, turn flow, damage, rewards, and result resolution belong in battle runtime.
- Session state is the mutable play save for a running game. It includes switches, variables, timers, inventory, party state, positions, flags, and other runtime-only values; `src/project` data should be treated as the source project definition, not the live session.
- Session RNG is runtime state. `PlaySession.rng` stores one session seed plus derived `encounter`, `battle`, `movement`, and `misc` stream states from `src/util/rng.ts`; gameplay code should consume it through `nextSessionRandom(session, stream)` so save/load resumes the sequence. Legacy saves without `rng` are accepted and assigned a new compatible RNG state during load.
- Stream ownership: random encounters and troop picks use `encounter`; battle damage variance, hit/critical rolls, escape, state rolls, and drops use `battle`; autonomous NPC random move/turn route choices use `movement`; miscellaneous runtime commands such as weighted branch selection use `misc`.
- `PlaySession.erasedEventIds` is runtime-only Erase Event state. It filters page resolution, sprites, triggers, and collision while the current map session is active, is included in save snapshots, is preserved when applying a saved session, and is cleared on normal map load/re-entry so authored `Project` event data remains unchanged.
- Runtime actor overrides live on `PlaySession`, not on project database records. `actorCharacterResourceIds` stores Change Actor Graphic charset overrides for the lead/player sprite path, `actorParamBonuses` stores Change Parameters permanent deltas by actor/parameter, and `actorStateIds` stores Change State field states. These fields are included in save slots and are passed into battle actor construction together with `actorLevels`, `actorVitals`, `actorNames`, and `partyActorIds`.
- The `src/project` data model is the canonical authored content: maps, database records, tilesets, events, and saveable project metadata. Code that edits project content should update this model, not runtime session fields.
- `createBlankProject()` is a true blank authoring seed: one 20x15 default-chipset grass map named `빈 맵`, no events, a valid start position, and a one-actor starting party using the standard default database/system records needed to enter play mode. The built-in Star Lantern adventure is intentionally separate as `createSampleAdventureProject()` and should be requested explicitly when tests or UI flows need example content.
- `TilesetDef.transparentColor` is an optional authored-project hex color key (`#rrggbb`) set by the editor. It is persisted with the tileset, validated as an optional string, and render-time transparency should prefer it over bundled chipset default color keys.
- `TileGroupMetadata.junctions` and `TileGroupMetadata.overlays` are optional authored structural-rule arrays. They are persisted with tile groups for roof/wall boundary omissions/replacements and conditional overlay tiles; keep them backward compatible and validate referenced roles/tiles through tileset semantic checks.
- `TileGroupMetadata.rules` is an optional authored cluster-rule array. `hard` rules map to project lint errors and therefore fail the existing `commitChangeset` gate; `medium` maps to warnings and `soft` maps to info. Current rule kinds are adjacency, spacing, and count, with validation owned by `src/project/lint/clusterRuleValidators.ts`. Combined Town defaults seed conifer/dry-tree/broadleaf hard adjacency plus flower medium and bush soft examples; harness re-application only seeds defaults when a group has no `rules` property, so existing authored rules are not overwritten.
- Persistence boundary: `src/project/store.ts` manages loading, autosave, and flushing, while Supabase sync only handles project transport/storage. Keep browser/local overrides and Supabase interactions behind that boundary.
- Supabase commit history is fire-and-forget: `src/project/projectCommitLog.ts` records successful changeset/manual-save summaries to `rpg_zzu.project_commits` and `project_changes` through `src/project/supabaseProjectSync.ts`. Logging failure must only warn and must not block store saves, autosave, or editor mutation.
- Migration and serialization cautions: only `serialize`/`deserialize` and migration helpers should translate schema versions. Preserve backward compatibility, keep migrations deterministic, and avoid adding runtime-only or transient fields to persisted JSON unless the format explicitly supports them.
- When changing project shape, remember the split between authored project data and runtime session data, and update any migration, validation, and save-path code together.

## M2 Runtime Flow Controls

- `End Event Processing` terminates the current interpreter run, including common-event and map-event call frames.
- `Erase Event` emits a scene step that records the current event id in `session.erasedEventIds`, removes its active movement routes, and refreshes runtime surfaces.
- `Wait for All Movement` waits for command-issued `moveEvent` routes and forced player routes to finish; page autonomous movement is not treated as a blocking command route.
- `Stop All Movement` cancels command-issued event routes and forced player routes without mutating authored page movement.
- `Scroll Map` emits a `scrollMap` scene step. The camera stops following the player while the pan tween runs; `mode: "return"` pans back to the player and resumes follow, `mode: "lock"` leaves follow disabled at the panned position, and the default non-lock path resumes follow after the pan. `wait` controls whether the interpreter blocks for the pan.
