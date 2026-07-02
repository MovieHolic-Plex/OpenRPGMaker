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

- `PlayScene` is the play-mode scene entry point. It wires map loading, player input, runtime overlays, battle entry, and scene-level helpers, but it should not own game rules.
- The interpreter is the command executor for in-play events. Keep command resolution, branching, pauses, and step results in the interpreter layer; let `PlayScene` only consume those results.
- Battle runtime lives under `src/battle` and should stay self-contained. `PlayScene` can launch battles and render the battle UI, but battle state, turn flow, damage, rewards, and result resolution belong in battle runtime.
- Session state is the mutable play save for a running game. It includes switches, variables, timers, inventory, party state, positions, flags, and other runtime-only values; `src/project` data should be treated as the source project definition, not the live session.
- The `src/project` data model is the canonical authored content: maps, database records, tilesets, events, and saveable project metadata. Code that edits project content should update this model, not runtime session fields.
- Persistence boundary: `src/project/store.ts` manages loading, autosave, and flushing, while Supabase sync only handles project transport/storage. Keep browser/local overrides and Supabase interactions behind that boundary.
- Migration and serialization cautions: only `serialize`/`deserialize` and migration helpers should translate schema versions. Preserve backward compatibility, keep migrations deterministic, and avoid adding runtime-only or transient fields to persisted JSON unless the format explicitly supports them.
- When changing project shape, remember the split between authored project data and runtime session data, and update any migration, validation, and save-path code together.
