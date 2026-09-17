# Architecture

- `src/main.ts` boot flow:
  - imports global CSS, reads feature flags from the URL into `body` classes, finds `#app`, then calls `bootApp(app)` from `src/app/mode.ts`.
  - after boot, it conditionally registers PWA support and can open a classic event-editor capture path for special debug params.

- Phaser app split:
  - `src/app/mode.ts` owns the single active mode (`edit` or `play`), the shared Phaser game handle, and the DOM shell for topbar/main.
  - `bootApp()` loads the project store, seeds editor state from `startMapId`, renders the topbar, and enters edit mode.
  - If canonical project load fails with a validation/integrity error, `src/app/mode.ts` renders a recovery screen whose primary actions load a sample or blank fallback project through `store.loadFallbackProject()`. That path keeps remote/local saved data intact and disables remote persistence until the user explicitly reconnects or exports.
  - `enterMode()` tears down the previous mode, clears the main area, and lazily imports either the editor or player renderer.
  - `startEditGame()` and `startPlayGame()` build separate Phaser games with different scenes/resolution; `destroyGame()` is the shared cleanup path.
  - Game startup is generation-guarded: each tracked starter captures `++gameGeneration` before awaiting, and a game that finishes after `destroyGame()` or a newer start destroys itself instead of being adopted. An adopted game also destroys the previously tracked one. Without this, an orphaned game's `KeyboardManager` keeps listening on `window` and a second `EditScene` answers the same `Ctrl+Z` — one press undid two history entries. `src/player/exportAppModeShim.ts` mirrors the same contract for the export player, and `EditScene.handleKeyDown` additionally ignores keys when its canvas is detached from the document.

- `src/editor` responsibilities:
  - `src/editor/panels/editor.ts` is the editor shell: layout, panel mounting, resize handling, subscriptions, and canvas host creation.
  - It starts the edit Phaser game, refreshes the palette/map/tool/status UI, and exposes editor-specific teardown/toggles.
  - Most other editor files are feature modules for actions, panels, map/tile tooling, event editing, locking, and persistence UI.

- `src/player` runtime:
  - `src/player/player.ts` is the player shell: title screen, load UI, status menu, dialogue overlay wiring, and start/stop of play sessions.
  - It creates the play surface, starts `PlayScene`, bridges UI events to scene/session actions, and handles save-slot restore.
  - `src/player/PlayScene.ts` is the actual in-game runtime: map loading, movement, events, overlays, battle entry, and test hooks.
  - `src/player/playSceneTime.ts` owns calendar ticking, day/night tint, HUD snapshot state, and sleep transitions at the scene boundary; pure date math stays in `src/project/gameTime.ts`.
  - Session-only retry checkpoints are owned by `src/player/checkpoints.ts` and are restored through `PlayScene`; they must stay outside project JSON and save-slot persistence.

- Web player export boundary:
  - `player.html` and `src/player/exportEntry.ts` are the Vite player-only entry. They fetch sibling `project.json`, set the exported project store shim, configure the export save namespace, and start the normal player shell without booting the editor.
  - `vite.player.config.ts` builds `dist/export-player` with exact aliases for editor-only boundaries such as `@/app/mode`, `@/project/store`, `@/project/io`, `@/editor/tilesetImage`, `@/editor/cutscene`, and `@/project/eventCommands/m2Catalog`.
  - Player shims under `src/player/export*Shim.ts` must stay minimal and runtime-facing. Do not import AI, Supabase, editor panels, or generated-asset provenance/validation JSON into the export bundle.
  - `scripts/lib/playerArtifactContract.mjs` is the base artifact API facade. Its bounded seams are `playerContractCore.mjs` (paths/digests/errors), `playerArtifactInventory.mjs` (filesystem inventory/secret scan), and `playerManifestAtomicWriter.mjs` (value-free typed atomic replacement). `playerDeploymentManifest.mjs` is the deployment writer facade over `playerDeploymentContract.mjs` and `playerViteClosure.mjs`.
  - `src/player/runtimeAssets.json` is the single runtime-public-asset inventory. Both Node build validation and browser export validate its schema, normalized ordinal ordering, and case-insensitive collision freedom.
  - `src/project/playerDeploymentManifest.ts` is the browser API facade. Parsing/digests, fetch/hash loading, paths/runtime inventory, Vite closure, errors, and types live in focused `playerDeployment*` / `playerViteDeployment.ts` modules. `src/project/webExport.ts` is the packaging facade over `webExportAssets.ts`, `webExportZip.ts`, and `webExportTypes.ts` used by the editor menu and the headless `check_export_readiness` read tool (old name `export_game` still runs, deprecated).
  - Web export is fail-closed: no `player.js` fallback is allowed, every declared artifact/runtime byte is verified before ZIP creation, and Unicode 15 default full-casefold path collisions are rejected across manifest and generated ZIP entries. Browser and Node share the `unicodeCaseFold.js` facade over `unicode15Normalize.js`; the normalizer performs pinned NFKC → full casefold → NFKC without host `normalize`/casing calls. `unicode15Data.json` contains compact tables derived from digest-pinned Unicode 15 `UnicodeData.txt`, `CaseFolding.txt`, and composition-exclusion data, and malformed envelopes/streams fail during module initialization.
  - Community installation is a separate fail-closed boundary under `community-site/scripts/lib/playerSync*.mjs`: lexical and physical path checks reject symlink/junction traversal inside repo/site-owned roots, the built manifest is checked against current source and runtime bytes, copies go to a same-parent temporary tree, and the exact set is rehashed before replacement. The ownership-token guard rejects live concurrent installers and removes only the same file identity/token; a dead-PID guard can be recovered. The installed target is moved to a backup, the staged target is installed, then the external lock is replaced. Rollback reconciles actual current/backup filesystem state, including a rename that completed natively before its adapter threw, and the next run restores a single interrupted backup before staging. `scripts/build-community.mjs` is the sole ordered release orchestrator. Community `prebuild` calls read-only verification and must never use `check || sync`.
  - Community play routing is a separate server boundary: `community-site/lib/playerBootConfig.ts` owns encoded URLs and the typed host contract, `community-site/lib/playRoute.ts` owns visibility/package/editor-schema checks and the 400/404/500 response matrix, and the Next route only injects DB/static/package-reader/editor-deserializer adapters. Raw slugs, URLs, parser errors, and host paths must never be interpolated into shell HTML or client-visible errors.

- `src/project` data/persistence:
  - `src/project/store.ts` is the canonical project store. It loads the project, normalizes defaults, emits updates, autosaves, and flushes to local or remote persistence.
  - Store subscribers receive a `ProjectChangeDescriptor` alongside the project. Omitted descriptors fall back to `scope: "project"` for full-refresh compatibility; editor map/tile paths use narrower map/database scopes to avoid unnecessary Phaser and panel redraws.
  - Persistence can come from Supabase, browser overrides, or dev-showcase overrides depending on environment/config.
  - Local dev `?blankProject=1` means a true blank project. `?freshProject=1` keeps its legacy meaning (sample adventure, no persisted override) because 32+ e2e specs and playtest drivers depend on it; example flags `sampleAdventure=1`/`defaultAdventure=1`/`defaultAdventureVisual` also remain.
  - `src/project/types.ts` defines the shared project schema used by editor, player, and battle systems, including authored ending definitions and optional `system.timeSystem` consumed by the player interpreter.

- `src/battle` boundary:
  - `src/battle/runtime.ts` is the battle state machine and should be treated as the core battle boundary.
  - It builds battlers and events from project data, advances turns, resolves commands/results, and returns battle snapshots/results.
  - Keep scene/UI code in `src/player/playSceneBattle.ts` and related player modules; keep battle rules and resolution logic inside `src/battle`.

- Layer dependency discipline: `app → {editor, player} → battle → project → {assets, util}`. No reverse imports.
  - `project` must not import from `editor`, `player`, or `ai`. Exception: `src/project/playerDeploymentPaths.ts` imports `runtimeAssets.json` from player (build-time data, not code).
  - `battle` must not import from `player`.
  - AI dependencies in `project` (editorIdentity, tileMetadataDb) use injectable setters wired at boot (`src/app/mode.ts`), not direct imports.
  - Event command catalog (`m2Catalog`, `runtimeSupport`) lives in `src/project/eventCommands/` — it describes what commands are, not how the editor renders them.
  - Content builders (showcase maps, village generation) live in `src/editor/content/`; `project/defaults/` re-exports them through a barrel for backward compatibility.
  - Action combat math modules live in `src/battle/action/` (moved from `src/action/`).
- **Genre packs** (`src/editor/genrePacks.ts`) are editor-only authoring metadata over the one `Project` schema and one runtime. `src/project/genrePackId.ts` is the canonical five-ID SSOT shared with later phases; welcome/card ids are mapped to blank-project system-preset recipe ids, not persistence aliases or authored-game promises. `src/project/genrePresets.ts` applies shared `system.*` fields. Welcome cards may optionally build an AI enhancement prompt; the confirmed manual path uses `store.loadNewRemoteProjectTransactionally` and does not dismiss or switch local state until flush + explicit-target save + reload verification succeed. Static `configured` checks never imply `playable`; readiness remains `unverified`/false until Phase 4 owns runner-backed evidence. Player/runtime code must not branch on genre.

- Source paths:
  - `src/main.ts`
  - `src/app/mode.ts`
  - `src/editor/panels/editor.ts`
  - `src/player/player.ts`
  - `src/player/PlayScene.ts`
  - `src/project/store.ts`
  - `src/project/types.ts`
  - `src/battle/runtime.ts`
