# Architecture

- `src/main.ts` boot flow:
  - imports global CSS, reads feature flags from the URL into `body` classes, finds `#app`, then calls `bootApp(app)` from `src/app/mode.ts`.
  - after boot, it conditionally registers PWA support and can open a classic event-editor capture path for special debug params.

- Phaser app split:
  - `src/app/mode.ts` owns the single active mode (`edit` or `play`), the shared Phaser game handle, and the DOM shell for topbar/main.
  - `bootApp()` loads the project store, seeds editor state from `startMapId`, renders the topbar, and enters edit mode.
  - `enterMode()` tears down the previous mode, clears the main area, and lazily imports either the editor or player renderer.
  - `startEditGame()` and `startPlayGame()` build separate Phaser games with different scenes/resolution; `destroyGame()` is the shared cleanup path.

- `src/editor` responsibilities:
  - `src/editor/panels/editor.ts` is the editor shell: layout, panel mounting, resize handling, subscriptions, and canvas host creation.
  - It starts the edit Phaser game, refreshes the palette/map/tool/status UI, and exposes editor-specific teardown/toggles.
  - Most other editor files are feature modules for actions, panels, map/tile tooling, event editing, locking, and persistence UI.

- `src/player` runtime:
  - `src/player/player.ts` is the player shell: title screen, load UI, status menu, dialogue overlay wiring, and start/stop of play sessions.
  - It creates the play surface, starts `PlayScene`, bridges UI events to scene/session actions, and handles save-slot restore.
  - `src/player/PlayScene.ts` is the actual in-game runtime: map loading, movement, events, overlays, battle entry, and test hooks.

- `src/project` data/persistence:
  - `src/project/store.ts` is the canonical project store. It loads the project, normalizes defaults, emits updates, autosaves, and flushes to local or remote persistence.
  - Store subscribers receive a `ProjectChangeDescriptor` alongside the project. Omitted descriptors fall back to `scope: "project"` for full-refresh compatibility; editor map/tile paths use narrower map/database scopes to avoid unnecessary Phaser and panel redraws.
  - Persistence can come from Supabase, browser overrides, or dev-showcase overrides depending on environment/config.
  - Local dev `?freshProject=1` means a true blank project. Example adventure routes must opt in with `sampleAdventure=1`, `defaultAdventure=1`, or the existing `defaultAdventureVisual` flag.
  - `src/project/types.ts` defines the shared project schema used by editor, player, and battle systems.

- `src/battle` boundary:
  - `src/battle/runtime.ts` is the battle state machine and should be treated as the core battle boundary.
  - It builds battlers and events from project data, advances turns, resolves commands/results, and returns battle snapshots/results.
  - Keep scene/UI code in `src/player/playSceneBattle.ts` and related player modules; keep battle rules and resolution logic inside `src/battle`.

- Source paths:
  - `src/main.ts`
  - `src/app/mode.ts`
  - `src/editor/panels/editor.ts`
  - `src/player/player.ts`
  - `src/player/PlayScene.ts`
  - `src/project/store.ts`
  - `src/project/types.ts`
  - `src/battle/runtime.ts`
