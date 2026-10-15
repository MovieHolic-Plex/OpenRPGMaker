> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Architecture

- `src/main.ts` boot flow:
  - imports global CSS, reads feature flags from the URL into `body` classes, finds `#app`, then calls `bootApp(app)` from `src/app/mode.ts`.
  - after boot, it conditionally registers PWA support and can open a classic event-editor capture path for special debug params.
  - Shared tile references and the remaining catalog normally load after the shell. First-generation interview requests use `projectInterviewBootPreparation.ts` to join those same loads and apply reference refresh **before** save and immutable AI-base capture. The remaining catalog starts inside that preparation when needed, avoiding a wait on `bootApp()` returning. Ordinary editing still boots with only the default catalog; stale-base rejection is unchanged.

- **부팅 스플래시와 계측 (2026-10-15):** 편집기 첫 화면은 `index.html` 의 `#oprn-boot-loader`(`data-testid="boot-loader"`)다 —
  인라인 CSS·마크업만으로 첫 프레임에 그려지고(외부 자원·이미지 없음, 로고는 인라인 SVG), 단계 표시(4칸 이산: 앱 → 공용 자료 → 프로젝트 → 도구)·
  10초/60초 안내(지연 CSS 애니메이션이라 JS 없이 뜬다)·실패 화면(「다시 시도」 = `<a href="">`)·언어 분기(ko/en/ja/zh,
  `navigator.language` 규칙은 `src/i18n/locale.ts` 와 같다)는 `public/boot-splash.js`(외부 클래식 스크립트 — Electron `app://` CSP 가 인라인
  스크립트를 막고, 번들 로드가 실패해도 먼저 돌고 있어야 실패를 말할 수 있다)가 맡는다. 번들은 `src/app/bootLoader.ts` 의 `reportBootStage`·
  `failBootLoader`·`dismissBootLoader` 로 `window.__oprnBootSplash` 에 사실만 넘긴다(퍼센트 없음). 편집기 i18n 계층에 의존하지 않는다 —
  `data-i18n-skip` 으로 DOM 번역기를 비킨다(화면 글자 역참조 금지 계약, `openwiki/i18n.md`). 기존 `#oprn-boot-loader`·`boot-loader` testid·
  `data-leaving` 은 그대로라 e2e/캡처 스크립트의 «로더가 사라질 때까지 대기» 가 유효하다.
  계측: `src/util/bootMarks.ts` 의 `bootMark` 가 `performance.mark("oprn:boot:<이름>")` 을 새긴다(html · js-eval-start · js-ready · prepare · shared ·
  project · project-read · project-normalized · project-loaded · editor · shell-mounted · settled · failed-*). 콘솔에서 `__oprnBoot()`(요약)·
  `__oprnBoot(true)`(표). 스플래시 표시와 같은 신호다.
  첫 페인트 경로의 두 함정(실측): ① vite 가 head 에 심는 스타일시트(main.css 2.1MB)는 렌더 차단이라 `scripts/lib/deferStylesheets.mjs` 가 빌드 산출물에서
  body 끝으로 옮긴다(지연 모듈 스크립트는 차단 스타일시트가 다 올 때까지 실행되지 않으므로 FOUC 없음). ② 호스트가 head 끝에 심던 `bridge.js` 는
  modulepreload 수십 개 뒤라 HTTP/1.1 연결을 기다려 첫 화면을 늦췄다 — `electron/serve/runtime.ts` 가 `<meta charset>` 바로 뒤에 심는다.
  Electron 창은 `backgroundColor: #F7F8F8`(스플래시 바탕색)이고 `ready-to-show` 가 첫 프레임 뒤라 흰 화면이 안 보인다. 시작 화면(`start-screen.html`)도 인라인 로고 뼈대를 먼저 그린다.

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
  - Player shims under `src/player/export*Shim.ts` must stay minimal and runtime-facing. Do not import AI, LegacyDb, editor panels, or generated-asset provenance/validation JSON into the export bundle.
  - `scripts/lib/playerArtifactContract.mjs` is the base artifact API facade. Its bounded seams are `playerContractCore.mjs` (paths/digests/errors), `playerArtifactInventory.mjs` (filesystem inventory/secret scan), and `playerManifestAtomicWriter.mjs` (value-free typed atomic replacement). `playerDeploymentManifest.mjs` is the deployment writer facade over `playerDeploymentContract.mjs` and `playerViteClosure.mjs`.
  - `src/player/runtimeAssets.json` is the single runtime-public-asset inventory. Both Node build validation and browser export validate its schema, normalized ordinal ordering, and case-insensitive collision freedom.
  - `src/project/playerDeploymentManifest.ts` is the browser API facade. Parsing/digests, fetch/hash loading, paths/runtime inventory, Vite closure, errors, and types live in focused `playerDeployment*` / `playerViteDeployment.ts` modules. `src/project/webExport.ts` is the packaging facade over `webExportAssets.ts`, `webExportZip.ts`, and `webExportTypes.ts` used by the editor menu and the headless `check_export_readiness` read tool (old name `export_game` still runs, deprecated).
  - Web export is fail-closed: no `player.js` fallback is allowed, every declared artifact/runtime byte is verified before ZIP creation, and Unicode 15 default full-casefold path collisions are rejected across manifest and generated ZIP entries. Browser and Node share the `unicodeCaseFold.js` facade over `unicode15Normalize.js`; the normalizer performs pinned NFKC → full casefold → NFKC without host `normalize`/casing calls. `unicode15Data.json` contains compact tables derived from digest-pinned Unicode 15 `UnicodeData.txt`, `CaseFolding.txt`, and composition-exclusion data, and malformed envelopes/streams fail during module initialization.
  - Community installation and play routing are reserved for the archived private [OpenRPGMaker-community](https://github.com/MovieHolic-Plex/OpenRPGMaker-community) extraction. The editor exports a pinned player artifact; it does not import the community app, its database, or its deployment code.

- `src/project` data/persistence:
  - `src/project/store.ts` is the canonical project store. It loads the project, normalizes defaults, emits updates, autosaves, and flushes to local or remote persistence.
  - Store subscribers receive a `ProjectChangeDescriptor` alongside the project. Omitted descriptors fall back to `scope: "project"` for full-refresh compatibility; editor map/tile paths use narrower map/database scopes to avoid unnecessary Phaser and panel redraws.
  - Persistence can come from LegacyDb, browser overrides, or dev-showcase overrides depending on environment/config.
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
