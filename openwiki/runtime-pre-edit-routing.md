# Runtime Pre-edit Routing & Cautions

Use this page when changing play mode, event execution, or save/session behavior. Pre-edit routing identifies owning modules; cautions cover the authored-project vs runtime-session split.

## Pre-edit routing


- Play scene behavior, player movement, event triggering, overlays, and scene test hooks: start in `src/player/PlayScene.ts` and adjacent `src/player/playScene*.ts` modules.
- Selected-event test play is an isolated editor path: `src/editor/panels/menu.ts` dispatches the selected event request, `src/editor/panels/testPlayModal.ts` creates a temporary `PlaySession`, and `PlayScene` runs that event via `runEvent` instead of normal auto-trigger startup.
- **Test-play boot UX:** `openTestPlayModal` opens the play window shell immediately, shows `play-loading-overlay` during `store.flush()` (save) then hands off to `renderPlayer`. While the shell/title is up, `warmBundledPlayAssets` (`src/assets/bundledAssetWarmup.ts`) prefetches project-referenced bundled chipset/charset images into the browser HTTP cache so “새 게임” is not the first time those files download. Game start (`player.ts` `startGame`) still shows staged loading (`engine` → `assets` progress via Phaser loader → `map` → ready) until `PlayScene.create` finishes — Phaser texture registration remains in scene preload. Hooks: registry/`StartPlayGameOptions` `onPlayLoadProgress` / `onPlayLoadStage` / `onPlaySceneReady`. Overlay module: `src/player/playLoadingOverlay.ts`, styles `src/styles/runtime/playLoading.css`.
- Event command / tool execution, branching, waits, pauses, stack behavior, and command / tool result handling: start in `src/player/interpreter/` and only let scene code consume interpreter results.
- Battle rules, turn flow, damage, rewards, battle events, and battle snapshots: start in `src/battle/runtime.ts` and adjacent `src/battle` modules.
- Title/load surfaces, status menu, dialogue UI, save slots, and play shell wiring: start in `src/player/player.ts`, `src/player/playerLoadPanel.ts`, `src/player/playerStatusMenu*.ts`, and `src/player/dialogue.ts`.
- Dialogue escape parsing/playback is owned by `parseDialogueText` + `createDialogueUI` in `src/player/dialogue.ts`, with zero-width controls preserved through `dialoguePagination.ts`. `\v[n]`, `\n[n]`, and `\c[n]` resolve variables/actor names/colors; `\s[n]` sets a clamped 1–20 typing delay (`n × 8ms`); `\.`/`\|` wait 250/1000ms; `\!` pauses until an advance key; `\>`/`\<` enter/leave instant typing; `\$` opens a live-session gold window; and `\^` closes after typing without another input. `\_` becomes a half-width space and `\\` remains a literal backslash. Raw escape syntax must never render in play or the editor preview. The runtime uses the `--runtime-dialogue-*` dark-glass token family: speaker names mount as compact rim tabs; normal facesets stay 48×48 chips; bust/full resources are stage-logical fixed sizes with left/right text reservation; choices, number input, gold, transparent mode, and top/center/bottom placement remain variants of the same component. Keep `dialogueBodyWidth` deductions synchronized with CSS padding, border, chip gap, and bust/full reserves.
- Authored project schema, defaults, validation, migration, references, and persistence: start in `src/project/types`, `src/project/defaults`, `src/project/io`, and `src/project/store.ts`.
- Supabase or remote/local project transport: start in `src/project/supabaseProjectSync.ts`, `src/project/supabaseProjectConfig.ts`, and keep transport separate from project model rules.


## Agent cautions


- Keep authored project data and runtime session data separate.
- Runtime-only fields should not enter persisted project JSON unless the schema explicitly supports them.
- Schema changes must include migration, validation, fixtures, and save/load verification.
