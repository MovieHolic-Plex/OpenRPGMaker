# Runtime M2 Flow Controls

M2 runtime commands: event processing, erase, graphic pattern, movement, checkpoint, kill, ending, scroll, camera, cutscene, lighting, weather, animation, picture, spawn/remove event, and scene test runner.

## Map-effect repair boundary (2026-09-06)

- `Set Event Location` and `Swap Event Location` commit `session.eventLocations` using current runtime views, preserve each event's facing, and keep spawned map ownership/template metadata consistent. Authored events remain unchanged. The internal `relocateEvents` step carries affected IDs to foreground/parallel hosts for movement cancellation and refresh; `sceneTestRunner` consumes the same handoff and keeps later chase movement in the authoritative location record.
- System BGM/SE and Parallax prefer present `resourceId` (including an explicit empty string), falling back to legacy `value` only when absent. System resource records remain strings; authored volume is retained as `system_bgm_volume` / `system_se_volume`. System BGM/SE remain partial, metadata-only commands: the public fields do not select a system-cue slot, and no new playback semantics or support promotion is implied.
- M2 weather honors explicit intensity, including zero, in both recorded weather and the emitted step. Omitted intensity preserves legacy embedded strength/defaults and raw recording; `transitionMs` still falls back to `durationMs`.
- Regression: `test/eventCommandMapRepairs.test.ts` covers direct/common calls, active-mover foreground/parallel dispatch, spawned cross-map location/swap, headless handoff/resume, resource presence, volume and weather. Real-player QA is separate from these deterministic runtime tests.

## Sound Layer audio controls (2026-09-06)

- Sound Layer emits optional `channel`, authored `volume` (0..100), and `fadeInMs` on the existing `playAudio` handoff. BGM/BGS/ambient loop independently; ME/SE are one-shots. Native commands without these fields keep their previous defaults.
- The engine keeps per-track gain (0..1) and fade envelope separate from user mixer volume. Same-resource requests update gain without restarting playback. Mixer changes affect loops and one-shots in their own group (ME uses BGM), including mute/unmute during a fade. Native one-shots remain immediate unless a fade is explicitly supplied.
- The unlock queue and real save-slot parser retain ambient and track controls. Resume restores looping channels only; explicit zero gain/fade survives. Malformed persisted volume/fade values are rejected at the save boundary.
- Regression: `test/eventCommandAudioRepairs.test.ts` includes `saveToSlot` -> `readSaveSlot` -> `applySaveSnapshot` -> engine resume, not only parser checks. Real audible output is verified separately in supervisor player QA.

## M2 Runtime Flow Controls


- `End Event Processing` terminates the current interpreter run, including common-event and map-event call frames.
- `Erase Event` emits a scene step that records the current event id in `session.erasedEventIds`, removes its active movement routes, and refreshes runtime surfaces.
- `setEventGraphicPattern` is a native event command / tool for runtime-only sprite frame changes. The interpreter emits a scene step; `PlayScene` stores the absolute frame in `eventGraphicPatternOverrides` and applies `sprite.setFrame(pattern)`. Overrides survive `refreshRuntimeSurfaces` / wait mid-sequence and clear on map reset. Authored event-page graphics stay unchanged so map reload/page refresh (without an override) returns to the saved graphic. **Object1 door open** uses the same character slot and walk-column 0 while changing **direction** down → right → up (`houseDoorFrameIndex` steps 0/1/2 → frames e.g. ch0: 24,12,0; ch4: 72,60,48) — not left/center/right on the down row. House door pages author `animationType: "fixedGraphic"` so action-turn/idle remapping cannot snap the door closed.
- `Wait for All Movement` waits for command-issued `moveEvent` routes and forced player routes to finish; page autonomous movement is not treated as a blocking command / tool route.
- `Stop All Movement` cancels command-issued event routes and forced player routes without mutating authored page movement.
- `checkpointSave` is the native checkpoint command / tool and is also wired to the Modern M2 `Checkpoint Save` entry. It snapshots the current runtime session through `createSaveSnapshot` into the session-only checkpoint slot.
- `killPlayer { message? }` is the instant-death trap primitive. It applies party death state and emits a `gameOver` step carrying the optional message for the overlay.
- `triggerEnding { endingId? }` resolves the project ending registry, sets `session.flags["ending:<id>"]`, optionally plays a compiled epilogue, then enters the existing ending/title-return flow.
- `Scroll Map` emits a `scrollMap` scene step. The camera stops following the player while the pan tween runs; `mode: "return"` pans back to the player and resumes follow, `mode: "lock"` leaves follow disabled at the panned position, and the default non-lock path resumes follow after the pan. `wait` controls whether the interpreter blocks for the pan.
- Modern `Camera Control` emits a `cameraControl` scene step instead of only recording `m2Runtime.camera`. It supports pan-to tile coordinates or event/player targets, follow player, follow event, fixed camera, and return-to-player follow. `durationMs` drives the camera pan tween and `wait` controls interpreter blocking. Persistent camera mode/target/offset/zoom lives on `PlaySession.camera` and is included in save snapshots.
- `cutsceneControl` is the native runtime command / tool for explicit cutscene input lock. `begin` marks session flags plus `m2Runtime.cutscene.lockPlayer`, blocking player movement/action/menu even for parallel events; `end` clears the lock. Event completion also releases the owner lock, so abandoned queues do not strand input. When `skippable` is true, play mode treats Escape twice within the skip window as a jump to the compiler-owned `cutscene_end` label, where camera/tint/picture cleanup commands run before `end`.
- `setLighting`, `addLight`, and `removeLight` are native runtime commands. `setLighting` can block on a deterministic fixed-step ambient transition, while `addLight` replaces same-id sources and `removeLight { all:true }` clears the current session source list without mutating map defaults.
- `advanceTime`, `setTime`, `sleepUntilMorning`, and `advanceCropGrowth` are native runtime commands for low-level calendar/crop control. `sleepUntilMorning` fades out, runs optional `system.timeSystem.onDayEnd` immediately before the next day starts, advances farm plots for the new morning season, sets the clock to `dayStartHour`, and fades back in. `advanceCropGrowth` mutates only farm plots and leaves the clock unchanged.
- `changeFriendship { npcKey?, delta }` and `getFriendship { npcKey?, variableId }` are native runtime commands. Empty `npcKey` resolves to the current event id, so villager pages can keep stable self-key behavior while still branching through normal variable conditions after `getFriendship`.
- `giveMonster { speciesId, level, nickname? }`, `moveMonster { instanceId, to }`, and `evolveMonster { instanceId, toSpeciesId?, successBranch?, failureBranch? }` are native runtime commands for starter gifts, party/box management, and evolution. They mutate only the live session monster collection and rely on project species records for validation/display; `evolveMonster` also records `session.flags.evolveMonsterSuccess` and runs the selected success/failure branch without pausing.
- `setWeather` is the native runtime weather command. It writes normalized weather to `m2Runtime.screen.weather`, emits a scene step for the Phaser weather layer, and may transition the visible intensity without blocking the interpreter.
- `showAnimation` is the native map-scene battle animation command. Its target can be `"player"`, `{eventId}`, or fixed `{x,y}` tile coordinates; `wait:true` blocks the interpreter until playback duration completes, while non-wait playback is fire-and-forget and is cleared on map/session reset.
- `Move Picture` supports `durationMs` and `waitForPicture`/`wait` in M2 fields. The interpreter applies the picture state through the existing runtime picture layer and, when requested, blocks until the tween duration completes. Native `showPicture` also carries optional transform fields and `waitForPicture` for compiler-generated picture beats.
- **First show with a transition time is a command-scoped fade-in (2026-08-29 fix).** `showPictureState` records transient transition intent for an executed Show/Move Picture command; `runtimeDom.syncPictureSlot` consumes that intent on every synchronization, using it both for a new-slot fade and for a mounted-slot retarget. Per-frame `syncPictureLayer` calls compare a requested target with `slot.to`, not the in-progress `displayed` value, so they do not reset `startedAt`; a genuinely changed target starts a new tween from the current displayed transform, and its full duration restarts at that moment. Authors who drive the target from a variable every frame therefore see an asymptotic easing chase rather than one fixed-duration move. A duration-bearing state without fresh command intent (including save/load, map/session remount, or erase followed by mounting restored state) applies the persisted target immediately. The intent is held outside serialized `PictureState`, so schema-v3 saves and projects need no migration. Regression: `test/pictureWeatherDom.test.ts` uses an injected clock and manual animation frames across repeated syncs, mounted retargets, remounts, and a real storage-codec in-game load.
- **The measured standalone-player stacking band is picture 26 < timer/time 29 < minimap/hand-slot/zone-feedback 30 < dialogue 39 < action HUD 40.** This is measured in headless Chromium after Vite builds the real `src/player/player.css` import closure. `.picture-layer` is owned exactly once by the unlayered rule in `src/styles/database/tabs-b-status-menu-main.css`; unlayered declarations outrank `@layer runtime`, so a duplicate in `runtime/pictures.css` would be dead code. Its positioned z-index 26 creates the stacking context containing the JS-assigned slot z-indices; `.dialogue-overlay` at 39 therefore remains above every picture slot. `test/runtimePictureStacking.test.ts` builds a test-only virtual entry that composes production `createPlaySurface`, `createDialogueUI`, `RuntimeDomOverlay`, `HandSlotChip`, `ActionHud`, `createZoneFeedbackDom`, `feedbackSuppressedByOverlay`, and `syncMinimapVisibility`, then asserts computed styles rather than source text. The nine measured DOM/media states are dialogue closed, bottom, top, center, choices-active/compact, bust-face, bottom dialogue with action HUD mounted first, bottom-left minimap with occupied hand slot, and bottom dialogue under `prefers-reduced-motion: reduce`. The shell, dialogue box and its state classes, both image and label picture slots (including `data-render`, child media elements, and the real `20 + pictureZIndex(id)` inline z-index), timer/time HUDs, hand slot, action HUD, and zone-feedback mount/removal are thus production-derived. Only minimap construction remains an exact transcription of `src/player/minimap.ts:160-186`, because `createMinimap` is async and requires a store-backed map, tileset, and image; its suppression/display behavior is still applied by production `syncMinimapVisibility` (`src/player/minimap.ts:226-236`). Sibling order is measured in both shipped directions because dialogue precedes HUDs on a normal map while action HUD can precede dialogue on action-combat maps. The display contract is state-specific: all members exist and display while dialogue is closed; with a real `data-testid="dialogue-box"`, minimap, hand slot, and action HUD compute `display:none`, while zone feedback is removed from the DOM by production suppression (`src/player/playSceneZoneFeedback.ts:184-189`); every remaining member stays present and visible. This distinction keeps visibility sabotage checks discriminating without asserting a production-false all-members-visible contract.
- Modern `Spawn Event` creates `PlaySession.spawnedEvents` entries keyed by runtime instance id. Each entry stores the template map/event reference plus the owning map and spawn tile, while `eventLocations` tracks live movement. Runtime event view materialization clones the template event under the spawned id, so rendering, collision, action/touch triggers, page resolution, self switches, and page move routes use the same pipeline as authored events. Spawned events are map-owned: leaving a map hides them, and returning to that map restores them from the session/save snapshot.
- Modern `Remove Event` deletes spawned runtime instances from `spawnedEvents`; authored events use persistent `PlaySession.removedEventIds` keyed by source map. This is separate from `Erase Event` and does not clear on normal map re-entry. Save/load preserves both spawned instances and persistent removals.
- `src/testing/sceneTestRunner.ts` is the headless scene validation harness behind the read tool `run_scene_test`. It creates a fresh `PlaySession`, drives the real interpreter, advances a deterministic 16ms clock, and models camera tween completion plus session-backed spawn/remove, field-spawn contact battles/respawn counts, follower trail, chase movement, lighting transitions/sources, weather, calendar time, NPC schedule placement/activity, friendship gifts, seasonal shop stock, farm plot interactions/growth, transient map animations, picture, audio, cutscene lock, switch, variable, event-position, map, game-over, checkpoint retry, and ending expectations without mutating the authored project. Use `gift` steps for deterministic NPC gifts, `retryCheckpoint` to restore after game over, `set` only for headless debug setup/fallbacks, `endingReached` to assert `triggerEnding`, `fieldSpawnCount` for Phase 8b hunting spawns, `followerCount`/`followerAt` for party followers, `eventAt`/`eventOnMap` for scheduled or transferred NPCs, `eventDistanceToPlayerLessThan` for chase approach checks, `lightingAmbient`/`lightAt`/`lightCount` for lighting assertions, `weatherKind`/`animationPlaying` for Phase 6b atmosphere timing, `advanceDays` plus `gameTimeAt`/`timePhase` for calendar assertions, `friendshipAtLeast`/`shopStock` for life-loop assertions, and `cropStageAt`/`inventoryCount` for farming assertions.

- Authoring: event preset wires action + .


## Storage chest authoring


- Tool place_storage_chest places an action event with openChest.
- Distinct from place_chest treasure reward preset.

## Page 3 location/vehicle compatibility (2026-07-30)
- `m2Runtime` reads canonical editor fields first: variable location uses `mapVariableId` / `xVariableId` / `yVariableId`; boarding uses `boarded`; vehicle location uses `vehicle`; event swapping uses `eventA` / `eventB`.
- Legacy aliases (`mapId`/`x`/`y` for variable ids, `enabled`, `target`, and swap `target`/`value`/`mapId`) remain read-only fallbacks for already-saved projects. New editor writes must use only canonical keys.

## 저장된 M2 명령 실행 연결 복구 (2026-09-05)

검토·재현: `docs/reviews/2026-09-05-event-runtime-audit.md`.

- `Wait Until`은 `InterpreterState.waitUntil`에 경과 시간을 보관하며 50ms 이하의 기존 wait 단계를 통해 조건을 다시 검사한다. `timeoutMs=0`은 무기한, 양수는 제한 시간이다. 재검사로 명령 예산을 소모하거나 runtime.waits를 계속 늘리지 않는다. 스위치/변수 외에 지역(`layoutPlan.regions` ID)과 현재 이동 종료도 판정한다. 전경 조건 대기 중 `runtimeConditionWait.conditionWaitScenes`가 병렬 생산자만 허용하고 플레이어 입력 잠금은 유지한다.
- `Pathfind Move`는 좌표를 즉시 쓰지 않는다. `playScenePathfinding`이 A* + 지형 통행 사각 + 현재 고체 NPC/플레이어 + 공간 배치 충돌로 경로를 계획하고 실제 보행 루트에 전달한다. `player`/`@player`, `this-event`, 이벤트 ID를 지원한다. `wait`와 속도를 적용하며 경로 도중 차단되면 `stopOnBlocked`로 나머지 방향을 버리고 `pathfindSucceeded=false`를 남긴다. 동적 재탐색은 하지 않는다. 명령 소유 루트의 교체·취소·씬 종료를 관찰한다.
- 메뉴/불러오기 명령은 `openMenuScreen`/`openLoadMenu` 단계를 사용한다. `player.ts`의 registry 콜백은 각각 상태 메뉴/불러오기 패널을 열고 `playerEventMenus.openEventMenu`로 닫힘까지 기다린다. 인게임 불러오기 패널은 `src/styles/runtime/title.css`에서 논리 플레이 영역 전체를 덮고 내부 창만 스크롤한다. 로드 시 `PlayScene.applySession`이 이전 실행 잠금을 해제하고, 이전 `runCommands`의 finally가 새 세션을 변경하지 않는다.
- 지형 조회는 `terrainTagAt`과 세션 `mapOverrides`를 사용한다. 이벤트 조회는 `runtimeEventViewsForMap`과 인터프리터에 전달한 실제 `eventPositions`를 getter로 사용하여 필드 스폰 등으로 위치 맵 객체가 교체돼도 최신 좌표를 읽는다. 반환값은 현재 맵의 1-based 저작 이벤트 순번(없으면 0); 원격 이동/동적 이벤트는 저작 슬롯 뒤에 배정하며 런타임 제거로 기존 순번을 당기지 않는다.
- 저장된 M2 동영상은 `resourceId`(legacy `value`)를 읽어 네이티브 `playMovie` 재생기와 대기/스킵 설정을 사용한다. 상태 기록만으로 실행되었다고 판정하지 않는다.
- 회귀: `test/eventRuntimeExecution.test.ts`, `test/runtimeEventMenus.test.ts`, `test/runtimeMovementStability.test.ts`, `test/playMovieRuntime.test.ts`. 출하 플레이어 QA: `npx tsx scripts/prepare-event-runtime-qa.mts` → `node scripts/qa-event-runtime.mjs`; SUMMARY를 먼저 읽고 지정 PNG만 확인한다. headless `run_scene_test`는 새 경로/메뉴 단계를 화면 검증처럼 통과시키지 않는다.

- 2026-09-05 검증 보완: `m2-002-display-text-settings`의 생략 가능한 필드는 기본값을 먼저 채워 missing-field 경고 없이 실행한다. `test/m2EventCommandCatalog.test.ts`와 `test/commandContracts/m2Command.contract.test.ts`의 기존 빈 필드 계약도 유지한다.

## 좌표 목적지 이동의 실패 계약 (OPRN-OUT-013, 2026-09-10)

`Pathfind Move` 는 이제 목적지를 「고정 정수 또는 스튜디오 변수」에서 읽고, 실패를 저작자가
고른 정책으로 처리한다. 경로 계획은 기존 A*(`playScenePathfinding` → `findChasePath`) 그대로다.

- **좌표 해석은 순수 모듈 하나가 갖는다**: `project/eventCommands/coordinateDestination.ts`.
  저장 형태·기본값은 `openwiki/editor-event-commands.md` 의 같은 날짜 항목을 따른다.
  없는 키는 전부 옛 고정 좌표로 읽히므로 마이그레이션이 없다.
- **변수 조회는 원시 조회여야 한다.** `commandCatalog` 는 `state.session.variables[id]` 를
  직접 읽는다. `getVariable` 의 `?? 0` 은 「변수 없음」과 「값 0」을 지워, 이 이슈의 원래
  결함(나쁜 데이터가 (0,0) 이라는 그럴듯한 목적지가 되는 것)을 그대로 되살린다.
  값 0 은 유효한 좌표이고 키 부재는 실패다 — 이 구분이 계약이다.
- **해석 실패는 이동 단계를 아예 내지 않는다.** 없음·비수치·비유한·소수·음수는
  `invalidInput` 으로 기록되고, `onFailure` 에 따라 `resumeNext`(기본) 또는 `{kind:"done"}` 이다.
  그래서 **대기 설정이어도 기다릴 것이 없다** — 무효한 목적지로 영원히 멈추는 경로가 없다.
- **씬 재생은 결과를 돌려준다.** `playPathfindMove` 의 반환형은 `Promise<MovementResult>` 다
  (기존 `void` 소비 호출부는 그대로 동작한다). 분류:
  `arrived`(0) · `invalidInput`(1) · `missingTarget`(2) · `outOfBounds`(3) · `blocked`(4) ·
  `unreachable`(5) · `interrupted`(6). **정수 코드는 계약이다** — 저작자가 조건 분기에서
  그 숫자를 쓰므로 순서를 바꾸거나 재사용하지 마라.
  · `outOfBounds` 는 계획 **전에** `inBounds` 로 가른다.
  · `blocked` vs `unreachable` 은 목적지 네 이웃 칸으로의 계획을 같은 planner 로 다시 세워
    가른다(두 번째 통행 규칙을 만들지 않는다). 이웃까지는 갈 수 있으면 칸 자체가 막힌 것이다.
  · `interrupted` 는 abort·씬/세션 교체와 **다른 명령의 교체**를 포함한다. 교체 판정은
    `latestPathfind` 소유권 비교다 — 위치 비교만 하면 「내 명령이 도착했다」와
    「내 명령이 쓸려나갔다」가 같은 결과가 된다.
- **결과는 명령별이다.** `resultVariableId`(코드) / `resultSwitchId`(도착 여부)에 기록한다
  (`player/movementResult.ts`). 기존 `session.flags.pathfindSucceeded` 는 **호환을 위해 유지**
  하지만 세션 전역 한 칸이라 병렬 이벤트 둘이 각자 이동 명령을 내면 나중 것이 앞 것을 덮는다.
  그 플래그로 분기하면 자기 것이 아닌 결과로 분기한다 — 그래서 명령별 기록처가 필요하다.
  스위치는 참/거짓 둘뿐이라 실패 **종류**는 변수만 구분한다.
- **`fallback: "nearest"` 는 저작자가 켜야만 동작한다.** 기존 `nearestPassableTile`
  (`playSceneMapCommands`)을 그대로 쓴다. 기본은 `none` — 맵 밖 좌표를 조용히 클램프해
  「그럴듯한 다른 곳」으로 보내지 않는다.
- **`onFailure: "stop"` 은 전경과 병렬 양쪽에서 지켜진다.** 전경은
  `playSceneInterpreter` 가 `{kind:"done"}` 을 돌리고, 병렬은 `playSceneSchedulers` 가
  큐를 지우고 cutscene 소유 잠금을 놓는다. 한쪽만 고치면 같은 저작이 실행 문맥에 따라
  다른 결말이 된다.
- **`MoveRoute.skippable` 은 재사용하지 않았다** (감사 결과). 그 옵션은 이동 루트의 **개별
  단계**가 막혔을 때 그 단계를 버리는 것이고, 이 이슈가 요구하는 것은 **목적지 전체**에 대한
  성공/실패 판정 + 분기다. 게다가 `moveEvent` 인터프리터 단계가 그 값을 아예 싣지 않는다
  (런타임 단계 타입에 필드가 없다) — 고쳐서 쓰려면 별 작업이며 의미도 이 계약을 덮지 못한다.
- **m2Runtime 상태 기록은 해석된 목적지를 남긴다.** 변수 소스면 `x`/`y` 필드가 아예
  없을 수 있고, 그걸 `fieldNumber` 로 읽으면 실행마다 `[m2] missing field: x/y` 가
  콘솔을 도배한다(출하 플레이어 QA 실측). `m2ModernRuntime` 은 `resolveDestination` 으로
  기록하며, 고정 좌표 명령의 기록은 바이트 단위로 이전과 같다.
- 회귀: `test/coordinateDestinationMove.test.ts` (38건 — 순수 해석기·인터프리터·씬 재생·
  병렬 이벤트·지속성). 기존 `runtimeMovementStability` 의 재지정/큐 사례와
  `commandContracts/m2Command`·`interpreter` 의 단계/기록 모양 계약은 그대로 초록이다.
- **출하 플레이어 QA(도착 증거):**
  `npx tsx scripts/prepare-coordinate-move-qa.mts && node scripts/qa-coordinate-move.mjs`.
  키보드만 조작하고 `__oprnDebug.readState` 는 관찰에만 쓴다. 네 단계(변수 좌표 도착 ·
  맵 밖 · 길 없음 · 없는 변수 + 중단)를 한 이벤트로 실행하고, 좌표 표본으로 **걸어갔는지**
  (순간이동이 아닌지)까지 잰다. `verify-shots/runtime-qa/coordinate-move/SUMMARY.md` 를
  **먼저** 읽어라. 그 경로는 매 실행 재생성되는 gitignore 대상이라 보존본은
  `verify-shots/oprn-013/test-play/` 에 있다. 실패를 일부러 만드는 계약이므로
  `[player] pathfind …` / `[m2] Pathfind Move …` 경고는 오류가 아니라 **증거**다 —
  하네스가 따로 모아 `report.json` 에 남기고, 진단이 실제로 났는지도 단정한다.

### 이동 중 경로 재지정 — 2026-09-05 브라우저 적대적 QA

- `Pathfind Move`를 걷는 중 재호출하면 플레이어의 이미 허용된 착지 좌표(`movingTo`)에서 다음 경로를 계산한다. 현재 걸음의 속도는 유지하고 새 속도는 `PlayerRouteState.nextMoveDurationMs`를 통해 다음 걸음부터 적용한다.
- 새 목적지가 현재 착지 칸이면 빈 경로도 현재 보행/체공 종료까지 기다린다. NPC는 기존 `activeMove`의 위치·경과 시간·지속 시간을 이어 받아 화면에서 튀지 않는다.
- 첫 걸음 전 현재 칸을 목적지로 다시 지정하면 이전 예약 루트를 취소한다. `pathfindSucceeded`는 세션의 **가장 최근 경로 명령** 결과이며, 교체된 작업의 완료 콜백이 덮어쓰지 않는다.
- 회귀: `test/runtimeMovementStability.test.ts`의 retarget/queued 사례 5개. 브라우저: `scripts/qa-event-runtime-adversarial.mjs`(테스트 전용 픽스처, 조작은 키보드만). 시각 근거: `.omo/evidence/event-runtime-adversarial/README.md`.

### 맵 위를 흐르는 구름 그림자 (2026-09-14)

**2026-09-21 최종 렌더 교체:** 아래 2026-09-14의 12개 덩어리 설명은 과거 구현이다.
`playSceneCloudShadows.ts`는 안개 노이즈와 분리된 `weather/cloudShadowTexture.ts`를 사용한다.
512px 반복 영역의 구름 수는 `amount`(0~6, 기본 3)로 정한다. 나머지는 알파 0으로 완전히 맑다.
내부는 고른 그늘, 경계의 8px만 부드럽게 처리한다. 미세 잡음·안개 질감은 없다.
8개의 256² 위상 텍스처를 한 번 생성하고, 동일 위치 두 TileSprite로 96초 주기의 아주 작은
윤곽 변화를 보간한다. 교차 보간 시 겹친 중심부 농도가 바뀌지 않도록 알파를 보정한다.
UV는 월드 좌표/타일 배율로 계산하므로 카메라 이동·줌에도 지면에 붙는다.
「맵 설정 → 구름 그림자 → 구름량」은 0~6단계 슬라이더/숫자 입력이다.
`GameMap.cloudShadows.amount`는 optional이며 생략한 옛 맵은 3으로 해석한다.
0은 레이어를 숨긴다. 같은 크기·속도·진하기에서 구름 무리 수만 증가하므로 양과 크기는 독립이다.
amount는 정수 반올림 및 0~6 clamp, 비정상 값은 3으로 정규화한다.
`setMapCloudShadows`의 patch가 필드를 보존하고 AI `set_map_properties.cloudShadows.amount`도 지원한다.
양별 캐시는 최대 6×8개의 256² 텍스처로 제한된다(0은 생성하지 않음).
편집기 브라우저 증거 `scripts/qa/cloud-amount-editor.mjs`: UI 0/1/6 → serialize/deserialize 유지,
amount 없는 옛 데이터 기본 3. `cloud-amount-editor.png` 및 JSON 영수증 참조.
비교 GIF: `WEATHER_QA_AMOUNT=1` 또는 `6`을 capture 명령에 추가한다.
`.omo/evidence/weather-quality/cloud-amount-comparison.gif`: 1 대 6, 동일 속도8·진하기0.26·크기1.
기본값은 opacity 0.26 / speed 8px/s. 기존에 명시적으로 저장된 수치는 바꾸지 않는다.
속도 0은 이동과 윤곽 변화 모두 정지한다. depth 700000과 씬 종료 시 정리는 유지한다.
실제 3D 태양광/입체 차폐 시뮬레이션이 아니라 2D 지면 투영 근사이며 광원별 분리는 없다.
`__oprnCloudShadows`의 layoutCount=2는 구름 개수가 아닌 위상 보간용 두 레이어다.
anchors는 UV 좌표이므로 예전 `cloud-shadows.probe.mjs`의 12개 월드 위상 판정은 적용하지 않는다.
증거: `WEATHER_QA_KIND=cloud node scripts/qa/runtime/weather-motion.capture.mjs` →
`.omo/evidence/weather-quality/cloud-motion-v2.gif` (10초, 125프레임, 실제 속도).


- **저작 표면은 「맵 설정」의 한 섹션이다.** `GameMap.cloudShadows?: MapCloudShadowSetting`
  (`src/project/types/project.ts`) — `enabled` + `opacity`(0.05~0.6) · `speed`(0~160 px/초) ·
  `angleDeg`(0~359) · `scale`(0.5~2.5). optional 이라 옛 맵은 필드 자체가 없고 마이그레이션이 필요 없다.
  「맵 배경」 다음 섹션(`map-props-section-clouds`, `map-cloud-shadows-enable`)에서 켜고,
  꺼 두면 필드를 지운다(미니맵과 같은 null-패치 관례). 쓰기 액션은 `setMapCloudShadows`.
  AI 툴 `set_map_properties` 도 같은 이름의 `cloudShadows`/`clearCloudShadows` 인자를 받는다.
- **계산은 순수 함수, 그리기는 레이어.** `src/player/cloudShadows.ts` 가 (설정, 경과 ms, 화면 사각, 시드)
  만으로 덩어리를 계산한다 — 위치를 어디에도 저장하지 않으므로 세이브·재현·테스트가 같은 계산을
  공유한다. `cloudShadowAnchors` 는 배치 순서가 고정된 «구름 12개의 주기 위상» 이고,
  `cloudShadowBlobs` 는 그 위상에 격자 복사본을 더해 화면과 겹치는 것만 돌려준다. 화면에 보이는
  수는 배치 수보다 적을 수 있다(화면 밖 위상). 시드는 맵 id 해시라 맵마다 다른 구름이 뜬다.
- **모양은 원이 아니라 로브 합집합이다(2026-09-14 개선).** 초판은 방사 그라디언트 한 장을 늘려 그렸고,
  실측 결과 «구름» 이 아니라 «동그란 얼룩 여러 개» 로 읽혔다(기본값 프리셋 연결성분 3~6타일 원 8개).
  지금은 `cloudShadowSilhouette(variant)` 가 몸통 로브 하나 + 위성 5~7개를 정규화 좌표로 돌려주고,
  레이어가 그걸 변주당 텍스처 한 장으로 굽는다(`CLOUD_SHADOW_SILHOUETTE_COUNT = 4`, 덩어리마다 `blob.variant`).
  로브는 `CLOUD_SHADOW_LOBE_CORE_FRACTION = 0.62` 까지 알파 1 을 유지하고 그 밖에서만 떨어진다 —
  중심부부터 끝까지 흐려지면 경계가 없어 «지나가는 그늘» 이 아니라 «화면 밝기가 숨 쉬는 것» 으로 보인다.
  틴트도 순수 검정(`0x000000`) 에서 짙은 남색 `CLOUD_SHADOW_TINT = 0x121c2e` 으로 바꿈 — 검정은 RGB 를
  같은 비율로 깎아(실측 R/G/B 감쇠 0.0835/0.0835/0.0833) 잔디가 진흙색이 된다.
- **덩어리마다 속도가 살짝 다르고 크기가 느리게 호흡한다(2026-09-14 개선).** 12개가 정확히 같은 속도로
  가면 «판 하나를 대각선으로 끌고 간다» 로 보인다. `CLOUD_SHADOW_SPEED_JITTER = 0.88~1.12` 를 배치 순서에
  고르게 깔아 **배율의 중앙값을 1 로 고정**했다 — QA 가 재는 값이 중앙값이므로 설정한 속도·방향은
  그대로 남는다(실측 26.0px/초, 오차 0.0°). 크기는 `cloudShadowBreath(phase, elapsedMs)` 가 ±9%·21초
  주기로 늘렸다 줄여주고, 위상은 덩어리마다 다르다. 둘 다 시간의 함수라 저장할 것은 여전히 없다.
- `src/player/playSceneCloudShadows.ts` 가 그 결과를 Phaser 스프라이트로 그린다. 좌표는 **월드 px**
  (scrollFactor 1)라 카메라가 움직이면 그림자도 같이 밀린다. 깊이 `CLOUD_SHADOW_DEPTH = 700_000` —
  상층 타일·캐릭터(25만)보다 위, 맵 애니메이션·날씨(80만)·시간 틴트·조명(90만)보다 아래.
  스프라이트 풀은 필요한 만큼만 자라고, 꺼져 있으면 전부 감춘다.
- **검증 축은 셋이다(출하 `player.html` 기준).** `node scripts/qa/runtime/cloud-shadows.probe.mjs`:
  (1) 배선 — `__oprnCloudShadows` 훅(`src/player/playSceneTestHooks.ts`)이 켜짐·배치 수·깊이·알파·텍스처를 보고,
  (2) 흐름 — **위상으로 짝지은** 덩어리 변위의 중앙값이 설정한 방향(±12°)·속도(±20%)와 일치,
  (3) 렌더 — 같은 시간 창을 «구름 끔» 대조 실행과 비교해 변한 픽셀 비율이 3배 이상.
  인덱스로 스프라이트를 짝지으면 풀 순서가 바뀌며 엉뚱한 변위가 나온다(실측 173px/0.68초).
  결과는 `verify-shots/runtime-qa/cloud-shadows/SUMMARY.md`(gitignore — 매 실행 재생성).
  `CLOUD_SHADOW_QA_PRESET=default` 로 돌리면 «체크만 한» 기본값(opacity 0.34·speed 26·angle 28·scale 1)
  모습을 `cloud-shadows-default/` 에 남긴다. 단위 계약은 `test/cloudShadows.test.ts`,
  편집기·지속성은 `test/cloudShadowMapProps.test.ts`, 툴 커버리지는 `test/aiEditorToolCoverage…`.
- **배경 잡음의 기준은 «구름 끔» 대조 실행뿐이다(실측).** 화면을 두 번 찍어 «정지 쌍» 을 만들려는
  시도는 성립하지 않는다 — 스크린샷 자체가 게임 루프를 멈춰 세우므로 두 컷 사이에도 구름이 흐른다
  (실측 3.6% 픽셀이 변했다). 대조군은 같은 픽스처에서 `cloudShadows` 를 지우고 같은 시간 창을 재는
  실행이고(실측 0.17%), 프로브는 훅이 없어도 그 측정을 계속한다(wall-clock 창).
- **측정된 값(2026-09-14, 출하 `player.html`).** QA 프리셋(0.4/52/200/1.5): 변위 55.4px/1.066초 =
  **52.0px/초**, 방향 오차 **0.0°**, 위상 12/12 연속, 변한 픽셀 **9.00% vs 대조 0.17%(54배)**.
  기본 프리셋(0.34/26/28/1): **26.0px/초**, 오차 0.0°, 보이는 덩어리 8~11개, **9.52% vs 0.17%**.
  깊이 700_000·알파=설정값·텍스처 로드는 두 실행 모두 통과.

### Weather sound (2026-09-21)

`playSceneWeather.syncWeatherLayer` passes displayed weather intensity and the same visual clock to
`AudioEngine.weather` (`audio/weatherAudio.ts`). Rain/storm automatically play stereo filtered noise;
storm adds one low-frequency thunder envelope at phase460ms of each2400ms lightning cycle (after the
120/290ms paired flashes). Clock jumps do not replay missed thunder. Snow/fog/cloud remain silent.
The procedural WebAudio bus needs no downloaded asset or export asset registration, does not occupy
BGM/BGS/ambient channels, follows the SE mixer, and starts only after the engine's input unlock.
Transitions track displayed intensity. Weather clearing, scene shutdown and `stopAll` dispose sources
and close the dedicated context; restored weather recreates the bus on the next sync.
Browser evidence: `WEATHER_QA_KIND=rain|storm node scripts/qa/runtime/weather-audio.capture.mjs`
uses the shipping player and records its actual destination bus, checking signal RMS, SE mute/restore
and context shutdown. Output: `.omo/evidence/weather-quality/{rain,storm}-audio.webm` and JSON.
