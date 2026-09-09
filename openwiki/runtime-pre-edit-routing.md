- **이벤트 명령 실동작 검토 (2026-09-05):** `docs/reviews/2026-09-05-event-runtime-audit.md`. 「철수의 기억」에서 강제 NPC 방향 전환이 `scene.running` 게이트에 막혀 30초 뒤에야 다음 명령으로 진행됐다. `updatePlayScene`은 NPC 업데이트를 호출하고 `updateAutonomousNPCs`가 대화 중 **명령 루트만** 허용한다. 배경 자율 이동과 병렬 이벤트는 기존 설정대로 정지한다. 직접 NPC updater만 호출하는 테스트로는 이 배선 결함을 잡지 못하므로 `test/runtimeMovementStability.test.ts`의 실제 프레임 디스패치 회귀를 유지한다. 저장된 M2 대화 설정의 강제 기본값 초기화도 수정했다(`test/persistedMessageSettings.test.ts`). `Wait Until`, `Pathfind Move`, 메뉴/로드 화면, 좌표 ID 조회, 저장된 M2 영화 명령의 후속 미구현·오연결도 수정했다. 실행 계약과 제한은 `openwiki/runtime-m2-flow-controls.md`의 2026-09-05 항목을 따른다. 카탈로그 배지나 최종 종료만으로 전체 명령을 검증했다고 보고하지 않는다.
- **실내 화로 불 애니메이션:** `src/editor/tilesetImage.ts`의 `supportsChipsetTileAnimation(tileset,tile)`이 기존 마을 애니메이션과 실내 불 스트립 124/154/184/214만 허용한다. 플레이어 `playSceneMapRuntime.renderTile`과 편집기 `chipsetTileRender.createRawTileObject`가 공통 조건을 쓴다. `isDefaultTilesetTexture`를 넓히면 실내에 마을 길/나무 규칙까지 적용되므로 바꾸지 않는다. `stone_hearth_unlit`의 463은 정지, `stone_hearth_lit`의 아래 가운데 124는 4fps이다. `test/interiorFireRendering.test.ts`는 양 레이어의 실제 렌더 경로를 검사한다.
- **Shipping pointer-exclusion contract (2026-08-28):** `.player-layout[data-play-input-owner="keyboard-only"]` is keyboard-only regardless of `navigator.webdriver`. The capture blocker rejects mouse, pointer, touch, wheel, context-menu, drag, selection, auxiliary, and native trusted-click channels; Phaser mouse/touch managers are disabled. The root prevents selection, dragging, canvas hit testing, browser scroll, and autoscroll. Exactly two pointer owners exist: `[data-play-input-owner="touch-controls"]`, mounted only by explicit `VITE_TOUCH_CONTROLS` / `OPENRPG_PLAYER_TOUCH_CONTROLS`, and `[data-play-input-owner="host-fullscreen"]`, mounted only when `hostFeatures` advertises fullscreen. Ownership never escapes those subtrees, and keyboard-only runtime content has no native `title` tooltips.
- **The pointer contract has two static enforcement layers, because neither can see the other's surface.** (1) `scripts/lib/playerInputCss.mjs` (`test/playerInputCss.test.ts`) walks the `src/player/player.css` `@import` closure and rejects unowned `:hover`/`:active`/`cursor:pointer` rules while preserving `:focus-visible` keyboard styling — it cannot see attributes set from JS. (2) `scripts/lib/runtimeDomTitleGuard.mjs` (`test/runtimeDomTitleGuard.test.ts`) rejects JS-set native `title` tooltips in `src/player` — CSS parsing cannot see those. Five separate tooltip leaks reached the shipping shop/battle DOM before this guard existed, so do not remove one layer on the grounds that the other passes. The guard decides DOM-versus-data by receiver name, so a data-object `.title` assignment inside `src/player` would false-positive; that is deliberate fail-closed behavior rather than running `tsc` inside the guard.
- **누락 리소스 알림은 경고이고, 무대 안의 px 는 배율만큼 곱해진다 (2026-08-30 실측).** `renderEvents` 는
  `resolveEventSpriteTexture` 가 못 푼 이벤트 스프라이트를 `DEFAULT_EASYRPG_CHARSET_ID` 로 대체해 계속 그리고,
  `scene.missingResources` 를 `RuntimeDomOverlay.syncMissingResourceError` 로 흘린다. 집합은 `clearEventSprites`
  가 매 렌더 경로(`renderTiles` / `renderEventLayer`)에서 비우므로 누적되지 않는다 — 게임은 정상 진행하고,
  이 노드는 **저작 경고**일 뿐이다.
  - **왜 애초에 뜨는가:** 로드 게이트 `collectResourceIds`(`src/project/io/resourceReferenceValidation.ts`)는
    `assets.sprites`·`assets.uploaded`·`resourceProfiles[].assetId`·**모든 타일셋 이미지 id**·EasyRPG RTP 전량
    (칩셋·얼굴·오디오 포함)·CC0 아이콘·BGM/SE 카탈로그까지 알려진 리소스로 받아들인다. 반면 렌더 시점의
    `resolveEventSpriteTexture`(`src/player/eventSpriteResources.ts`)는 `assets.sprites`, 스프라이트류
    `assets.uploaded`, **EasyRPG charset 텍스처 키**, 번들 스프라이트 역참조와 **등록된 생성 몬스터**를 푼다. 그래서 칩셋 이미지나
    아이콘 id 를 이벤트 그래픽으로 지정한 프로젝트는 **역직렬화를 통과하고 부팅도 되면서 알림만** 뜬다.
    두 집합의 폭이 다른 것이 원인이다 — 알림을 지우려면 저작을 charset 으로 바꿔야 한다.
  - **왜 "크게" 떴는가:** 노드는 `transform: scale(var(--play-scale))` 가 걸린 `.play-stage` 의 자식이다.
    1280×960 에서 `--play-scale=4` 이고, 규칙이 `editor/core.part-1.css` 에 있던 시절(13px·padding 8/12px·
    붉은 테두리) 실측 상자는 화면에서 **1232×292px, 실효 글자 52px** — 뷰포트의 39% 였다. 무대 안에 무엇을
    붙이든 px 는 배율만큼 곱해진다는 것을 잊지 말 것.
  - **지금 계약:** 규칙은 `src/styles/runtime/playSurface.css` 에 있다(플레이어·편집기 양쪽 import 폐포에
    들어 있는 유일한 런타임 시트). 모든 치수를 `calc(<px> / var(--play-scale))` 로 나눠 화면상 크기를 고정하고,
    하단 좌측 코너 칩(실측 385×16px, 실효 글자 10px, `--runtime-glass-*` 다크 글래스)으로 뜬다.
    텍스트는 `resourceDisplayName` 으로 자원 이름을 보여주되 프로필이 없으면 **원본 id** 를 그대로 남긴다 —
    `test/e2e/oprn-map-runtime.spec.ts` 와 `test/runtimeDomMissingResource.test.ts` 가 id 를 단정한다.
    회귀: `test/runtimeDomMissingResource.test.ts`, `test/playerRuntimeCss.test.ts`(빌드된 출하 CSS 에
    `.runtime-missing-resource` 가 실리고 모든 길이 선언이 역스케일되는지). 규칙이 편집기 시트에만 있던 동안 출하 플레이어에서는 스타일
    없는 static 블록이 **1280×272px 로 무대 아래(y=960) 에 깔려 `overflow: hidden` 에 잘려 사라졌다** —
    저작자에게 필요한 신호가 출하물에서 통째로 죽어 있었다.
- **생성 몬스터의 필드 외형 (2026-09-05):** `fieldSpawns.defaultFieldSpawnGraphic`이 첫 적의
  `monsterResourceId`를 넘길 때 `generated-enemy-slime-green` 같은 생성 카탈로그 ID도 그대로 그린다.
  `src/assets/generatedMonsterSprites.ts`는 `builtinGeneratedResourceIds()`의 실제 몬스터 항목만 인정한다.
  일반 URL 해석기의 이름 추측 폴백을 허용하지 않아 알 수 없는 생성 ID는 기존 누락 경고/charset 폴백을 유지한다.
  `loadBundledAssets`는 프로젝트에 참조된 생성 몬스터를 `load.image`로 먼저 읽는다(적 DB 참조만 있고
  필드 이벤트는 아직 생성되지 않은 부팅도 포함). URL은 `resolveAssetResourceUrl`을 거쳐 단일 HTML의
  인라인 자산 표를 따른다. 별도 시트 절단 없이 `__BASE` 프레임을 쓰고, `eventSpriteScale`이 원본 비율을
  유지하며 32×32 논리 px 안에 맞춘 뒤 저작 `graphic.scale`을 곱한다. 프레임/방향 변경으로 시트처럼
  잘라 그리지 않는다. 이벤트·동료·이동 루트 외형 교체에 같은 크기 규칙을 적용한다. 기존 프로젝트
  sprite/upload 정의가 같은 ID를 소유하면 그 정의가 우선한다. 회귀: `test/generatedMonsterFieldSprites.test.ts`
  (실제 PNG 치수, 필드 스폰→렌더, 사전 로딩, 내보내기/인라인, 미등록 ID 경고, 기존 소유권).
- **QA instrumentation is an explicit boot capability (2026-08-28).** `__OPENRPG_BOOT__.qaInstrumentation` → `renderPlayer({ qaInstrumentation })` → `createPlayGame` registry → `PlayScene`. When it is off (every normal exported/community player boot) the runtime installs **no** `__oprnDebug`/`__oprnInput`/`__oprnCamera`/`__oprnPlayerSprite`/`__oprnCharacterSprites`/`__oprnActionCombat`/`__oprnSetActorVitals`/`__oprnSetMediaState` globals, creates **no** `runtime-state-json` / `audio-state-json` mirrors and no `.runtime-debug-marker` hitboxes, and never builds or serializes the broad debug snapshot; `syncRuntimeState` takes a narrow visible-HUD path instead (timer, calendar, picture layer keep working). When it is on, all of that is retained unchanged. Opted in by: `scripts/lib/runtimeQaRun.mjs` (the mandated runtime QA harness depends on `__oprnDebug` for `setSeed`/`teleport`/`readState`), editor play mode (`src/app/mode.ts`), and both editor Test Play modals — those are authoring surfaces, not the shipped player, so the existing editor e2e suite keeps its state dump. Regression: `test/runtimeQaInstrumentationBoundary.test.ts`, `test/runtime/instrumentation-boundary.spec.ts`. The QA `teleport` hook must load a changed destination map **exactly once** — a merge once duplicated that branch and loaded it twice.
- **테스트 플레이 부팅 복구 경로 (2026-08-29):** `player.ts` 는 Phaser 기동 전에 `preflightProjectForPlay` 를 실행한다. 예비검사 차단·ready 타임아웃·부팅 예외의 단일 실패 출구는 `playBootRecovery.describeBootFailure` 의 설명을 받은 `playLoadingOverlay.showRecovery` 다. 고친 프로젝트는 세션 생성에 명시적으로 전달되고 `beginReadOnlyProjectSnapshot` 을 통해 `PlayScene` 에 전달된다. 내보내기 대역 `exportProjectStoreShim` 도 `currentProject` 를 복제 스냅숏으로 교체하며, 멱등 해제 시 다른 교체가 없었을 때만 이전 프로젝트를 복원한다. 안전 모드는 auto/parallel 트리거를 action 으로 낮추고 자율 이동·일정을 제거하되 action 이벤트는 유지한다.
- **엔진 조각 fetch 실패는 재시도·한 번 새로고침 (2026-09-02):** `createPlayGame` 의 `import("@/player/PlayScene")` 와 `startEditGame` 의 `EditScene` import 는 Vite 가 `assets/PlayScene-<hash>.js` 로 쪼갠다. 재빌드 뒤 옛 해시 404 또는 일시적 네트워크면 `TypeError: Failed to fetch dynamically imported module` 가 나고, 브라우저는 그 specifier 의 거부를 페이지 수명 동안 캐시한다 — 복구 「다시 시도」가 같은 `import()` 를 부르면 즉시 같은 화면이 된다. `importWithRetry`(`src/util/dynamicImport.ts`) 가 URL 에 `?t=` 를 붙여 캐시를 우회하고, 그래도 실패하면 `moduleLoadRecovery` 가 sessionStorage 가드로 페이지를 한 번만 새로고침한다(`vite:preloadError` 도 같은 손잡이). Phaser `<script>` 로드 실패도 rejected Promise 를 붙잡지 않는다(`ensurePhaser` 가 손잡이를 비우고 한 번 더 받는다). 회귀: `test/dynamicImport.test.ts`, `test/moduleLoadRecovery.test.ts`, `test/phaserRuntime.test.ts`, `test/playBootRecovery.test.ts`.
- Title/load surfaces, status menu, dialogue UI, save slots, and play shell wiring: start in `src/player/player.ts`, `src/player/playerLoadPanel.ts`, `src/player/playerStatusMenu*.ts`, and `src/player/dialogue.ts`. **Desktop title input contract (2026-08-24):** title options use a single roving Tab stop with stable option IDs; Arrow keys synchronize selected/focused/`aria-selected`, and Z, Enter, or Space takes the selected New/Load/Quit path. Title pointer activation is blocked and no title control crosses the play-input boundary. Touch controls do not auto-mount from device capability; only an explicit `VITE_TOUCH_CONTROLS` / `OPENRPG_PLAYER_TOUCH_CONTROLS` true override enables the mobile pad. Test Play keeps the `320×240` canvas in a centered 4:3 fit-without-crop stage. **Play surface scale mode (2026-08-25):** `calculatePlaySurfaceScale` takes an explicit `PlaySurfaceScaleMode`. `integer` (default, shipped/community player) keeps the whole-number stage; `fit` returns the unfloored contain scale and is what the editor Test Play window passes through `renderPlayer({ surfaceScaleMode: \"fit\" })` — with integer-only scaling a 1214×640 window drew the game at 640×480, i.e. 27% of the surface. Fractional scaling relies on `image-rendering: pixelated` on the play canvas; do not remove it. **Status menu update (2026-09-05):** See the first section of `runtime-sessions.md`: one inset workbench, visible inert preview, contextual party information, horizontal focus navigation, stable cursor DOM, and `src/player/playerStatusMenuMotion.ts` exit lifetime. The following edge-dock description is historical. **Status menu contract (2026-08-24):** `src/player/playerStatusMenu.ts` is a non-modal edge dock that keeps the map visible, presents six primary entries, and reveals grouped commands progressively. `playerStatusMenuController.ts` owns the nested cancel stack and title-return confirmation; `playerStatusMenuDetailRenderer.ts` owns roving detail focus while preserving life-ledger tab/panel semantics. Keep `src/styles/runtime/statusMenuEdgeDock.css` as an overlay after the base status-menu CSS.
- **이벤트 저장 메뉴 직접 진입 (2026-09-05):** `player.ts`의 `openSaveMenu` registry 콜백은
  `openEventMenu(layout, statusMenu.openSaveMenu)`로 메뉴 종료까지 이벤트를 기다리고 컨트롤러를 호출한다. 컨트롤러가 이전 커서·덮어쓰기 확인·그룹 복귀
  상태를 초기화하고 `mode="function"`으로 저장 슬롯을 즉시 표시·포커스한다. `reset()` 후
  `renderMenu(undefined, "save")`만 호출하면 메인 레일에서 시스템만 선택되고 상세는 `inert` 미리보기에 머문다. 저장 제한(`map.disableSave`, `m2Runtime.access.save`)은 그대로 적용한다. 취소는 덮어쓰기 확인 →
  저장 슬롯 → 메인 레일 → 닫기 순서다. `test/playerOpenSaveMenu.test.ts`는 내보내기 store 대역과 실제
  registry 콜백·DOM keydown 경로로 즉시 표시, Enter/Z 저장, 방향키 이동, 확인 취소·재진입, 저장 제한을 검증한다.

- **Blocking text/input lifetime (2026-09-08):** `DialogueTextRequest.signal` aborts text with `AbortError`. Hide, close, and surface replacement cancel pending text too; successful page completion still schedules the normal exit. Cancellation detaches keys and cancels entry/typewriter timers. Fresh text advance ignores repeat/composition/text-entry targets and consumes its accepted key. `eventInput.waitForEventKey(signal)` shares the RM2K3 key-code mapping between field and battle input waits, removes its capture listener on settlement, and consumes the accepted event. Field input waits subscribe to shutdown/destroy and verify the captured session before resuming the interpreter. Social gift/talk feedback follows the same ownership rule: cleanup must not reset input/running state or close dialogue after session replacement or scene deactivation, and an abandoned original talk must not grant friendship or open follow-up text. Public `runEvent` consumes only lifecycle `AbortError` (replaced session or inactive scene); genuine failures and active-scene aborts still reject. Contracts: `dialogueTextCancellation`, `playSceneInterpreterCutsceneSkip`, `socialDialogueCancellation` (real DialogueUI and keyboard input through `PlayScene.runEvent`).
 **Export portrait URL contract (R13):** `safeResourceImageUrl` accepts resolver-produced HTTP(S) PNG/JPEG URLs as well as existing root paths and PNG/JPEG data URLs; it rejects quoted-CSS escape characters and unsafe schemes. `inlineAssetStore` still owns deployment-base/inline resolution, so do not strip export subpaths in dialogue. `test/dialogueImageUrls.test.ts` exercises real `createDialogueUI` with editor-root, root/nested/encoded exports and inline assets. Dedicated-player image-load proof: `.omo/evidence/dialogue-face-url-r13/README.md`.
- Dialogue escape parsing/playback is owned by `parseDialogueText` + `createDialogueUI` in `src/player/dialogue.ts`, with zero-width controls preserved through `dialoguePagination.ts`. `\v[n]`, `\n[n]`, and `\c[n]` resolve variables/actor names/colors; `\s[n]` sets a clamped 1–20 typing delay (`n × 8ms`); `\.`/`\|` wait 250/1000ms; `\!` pauses until an advance key; `\>`/`\<` enter/leave instant typing; `\$` opens a live-session gold window; and `\^` closes after typing without another input. `\_` becomes a half-width space and `\\` remains a literal backslash. Raw escape syntax must never render in play or the editor preview. When speaker is set, createDialogueUI mounts a floating nameplate (.speaker.speaker-nameplate, testid dialogue-speaker) on the dialogue box rim so the name is visually separated from chat body text. The runtime uses the `--runtime-dialogue-*` dark-glass token family: speaker names mount as compact rim tabs; normal faces stay 48×48 chips drawn from one file per face (no sheet cropping); bust/full resources are stage-logical fixed sizes with left/right text reservation; choices, number input, gold, transparent mode, and top/center/bottom placement remain variants of the same component. Keep `dialogueBodyWidth` deductions synchronized with CSS padding, border, chip gap, and bust/full reserves.
- **대화창 연출 계약 (2026-08-30).** 「문장 표시」의 `emotion` 은 감정 태그가 아니라 **연출 프로파일 선택자**다.
  `src/player/dialoguePresentation.ts` 가 순수 모델(5종 표 + `reducedMotion` 주입)을 갖고, `dialogue.ts` 는
  프로파일을 상자에 `data-dialogue-emotion` / `-phase` / `-motion` / `-shake` / `-flash` / `-charReveal` 과
  `--dialogue-*-ms` 인라인 변수로 심는다. **지속시간의 진실 공급원은 TS 뿐이다** — CSS 는
  `animation-duration: var(--dialogue-enter-ms)` 로 받아 쓴다(`battleTransition.ts` 는 TS/CSS 이중 기재로
  close 가 260 vs 190 으로 어긋나 있다. 반복하지 말 것). `:root` 폴백이 없으면 var() 가 무효가 되어
  `animation-duration` 이 0s 로 떨어지고 연출이 조용히 죽는다.
  - 연출 상태는 **반드시 상자(.dialogue-box)에** 얹는다. 오버레이는 `resetOverlay()` 가 `className` 을
    통짜로 대입하는 자리라 매 대사마다 지워진다.
  - 생명주기: `cleanup()` 은 상자를 즉시 파괴하지 않고 `phase="exit"` 로 바꾼 뒤 퇴장 길이만큼 **제거를 예약**한다.
    다음 `showText` 는 예약을 취소하고, **진입 시점에 오버레이가 비어 있었을 때만** 진입 연출을 재생한다
    (`overlay.firstChild` 유무가 곧 세션 경계다). 연속 대사는 같은 tick·페인트 전에 예약을 취소하므로
    팝업이 매 줄 반복되지 않고, `wait` 가 끼면 예약이 만료돼 창이 닫히고 다음 대사가 새 세션이 된다.
  - `hide()` 는 **즉시 컷**(맵 전환처럼 창이 남으면 안 되는 자리), `close()` 는 퇴장 연출 후 비움(세션 종료).
    `isDialogueUi`(`playSceneDom.ts`)·`isDialogue`(`playerGuards.ts`) 는 `close` 를 필수로 검사한다 —
    빠진 객체를 통과시키면 이벤트 큐가 끝나는 `finally` 에서 TypeError 가 난다.
  - 상자 keyframes 는 **가로로 커지지 않는다**(`scaleY` 만 쓴다). 전폭 상자를 가로로 부풀리면 1280 뷰포트에서
    좌우 여백 16px 하한이 깨져 `test/e2e/dialogue-modern-skin.spec.ts` 가 무너지고, 대칭으로 몇 px 벌어지는
    변화는 눈에 잡히지도 않는다. `test/dialoguePresentationCss.test.ts` 가 이 제약을 잠근다.
  - **본문은 증분 렌더러가 그린다** (`src/player/dialogueTextRenderer.ts`). 예전 경로는 글자가 하나 늘 때마다
    `clearChildren` + 전량 재생성이라 **이미 떠 있던 글자의 노드까지 매 틱 교체**됐고, 그래서 글자별 CSS
    애니메이션이 프레임마다 처음으로 되감겼다 — 글자 연출을 붙일 수단이 아예 없었다.
    `mountDialoguePage(bodyEl, segments)` 는 페이지마다 새로 마운트하고 `reveal(n)`/`revealAll()` 로
    **뒤에만 덧붙인다.** 이미 붙은 노드는 절대 건드리지 않는다(회귀: `test/dialogueTextRenderer.test.ts` 의
    노드 동일성 단정 + `test/dialogue.test.ts` 의 배선 단정). 선택지·프롬프트는 타이핑이 없으니 일괄
    `renderDialogueSegments` 를 그대로 쓴다(색이 같은 글자를 한 노드로 묶는다).
    - 페이지 전체를 미리 깔고 `opacity:0` 으로 숨기지 **않는다**. 그러면 `.body.textContent` 가 항상
      페이지 전문이 되어 타이핑 회귀 테스트와 스크린 리더가 본문 전체를 먼저 읽는다. 덧붙이기 방식은
      되감김만 정확히 없애고 그 계약은 건드리지 않는다. 리플로 걱정도 없다 — 줄바꿈은 페이지네이터가
      명시 `"\n"` 으로 확정했고 글자는 줄 오른쪽으로만 늘어난다.
    - 글자 연출은 **opacity 만** 쓴다. span 은 인라인 박스이고 인라인 박스는 `transform` 을 무시한다.
      `inline-block` 으로 바꾸면 픽셀 폰트의 베이스라인·줄높이와 줄바꿈 단위가 흔들린다.
    - 글자 연출은 phase 게이트를 걸지 않는다 — 이름표·초상화와 달리 글자는 새로 붙을 때마다 재생되는 것이
      정상이다. 대신 `data-dialogue-char-reveal="1"` 이 게이트고, `reducedMotion` 이면 TS 가 아예 심지 않는다.
      건너뛰기로 한꺼번에 붙는 글자는 `dialogue-char-instant` 로 연출을 뺀다(수십 자가 동시에 밝아진다).
    - 감정별로 변하는 것은 글자 **간격**(`charDelayScale`)이고 한 글자의 페이드 길이는 고정이다 —
      그래서 `--runtime-dialogue-char-ms` 는 이름표 길이와 같은 이유로 TS 가 아니라 `:root` 가 갖는다.
      `\s[n]` 로 명시한 속도는 배율 없이 그대로 이긴다.
  - **화면 단위 연출은 스크림(`.dialogue-scrim`)이 갖는다.** 이 엘리먼트는 `.dialogue-overlay` 의
    **형제**로 `.play-stage` 에 붙는다(z-index 38 — 존 피드백 30 위, 창 39 아래). 오버레이 안에 두면
    화면을 덮을 수 없다 — `position-top`/`bottom` 에서 높이가 화면의 27% 뿐이다. 크롭 inset 은
    `runtime/playSurface.css` 의 `.play-stage > .dialogue-overlay` 목록에 같이 실어 맞춘다.
    익스포트 플레이어(`surfaceScaleMode: "integer"`)로 실측한 결과 **따라갈 크롭이 실은 없다**
    (2026-08-30): 정수 배율은 `Math.floor(containScale)` 이라 무대가 뷰포트를 넘지 못하고
    (`playSurfaceScale.ts:39`) `--play-crop-*` 이 네 변 모두 0 이며, 스크림 사각형이 `.play-stage` 와
    완전히 같다. 남는 여백은 레터박스이고 `.play-stage` 밖이라 스크림이 칠할 경로가 없다.
    목록에 든 것은 cover/crop 모드가 생길 때를 위한 대비다.
    - 평평한 전면 디밍이 아니라 **창이 있는 쪽으로 몰린 비네트**다. 28% 전면 디밍은 모든 대사에서
      맵을 통째로 탁하게 만든다. 위치 클래스(`position-top/center/bottom`)를 스크림에도 실어 방향을 맞춘다.
    - 디밍과 플래시는 각각 `::before`/`::after` 에 둔다. 스크림 자신의 `opacity` 를 애니메이션하면
      놀람의 플래시가 그 값에 눌려 흐려진다(스크림 페이드와 플래시가 동시에 시작한다).
    - 흔들림(분노)은 `[data-dialogue-shake="1"][data-dialogue-phase="shown"]` 게이트다. 진입과 같은
      `phase="enter"` 규칙에 얹으면 둘이 `transform` 을 다투고, **세션 중간의 분노 대사는 진입 없이
      `shown` 으로 뜨므로 아예 흔들리지 않는다.** 좌우 진폭은 3px 로 묶는다 — 전폭 상자의 좌우 여백
      하한이 16px 이고 `test/e2e/dialogue-modern-skin.spec.ts` 가 그 값을 잰다.
      화면 흔들기를 Phaser 카메라(`playSceneMapCommands.ts`)로 하면 DOM 대화창에는 안 먹는다.
    - `reducedMotion` 은 흔들림·글자 등장·플래시를 없애고 **스크림 디밍은 남긴다** — 움직임이 아니라
      분위기·대비 신호다. 이 셋은 phase 가 아니라 자기 dataset 으로 게이트되므로 enter/exit 안전망이
      닿지 않아 미디어쿼리 안전망을 따로 갖는다.
  - `createDialogueUI(host, schedule?)` 의 `schedule` 은 테스트용 타이머 주입 구멍이다
    (`createBattleTransition(host, schedule)` 과 같은 형태).
- **자율 이동 등록·복귀 (2026-08-27 실측 수정).** 페이지 이동(무작위/접근/추격/사용자 지정/생활)은
  `src/player/playScenePageMoveRoutes.ts` 의 `registerPageMoveRoutes` 가 등록하고
  `src/player/playSceneAutonomous.ts` 가 매 프레임 굴린다. 세 가지 함정이 있다.
  (1) 재등록 판정은 `pageMoveRouteKeys`/`pageMoveRouteEventIds` **와 무버 생존**을 함께 봐야 한다.
  키만 보면, 이동 루트 명령이나 `npcSchedules` 의 teleportNpc 가 무버를 지운 뒤 "이미 등록됨" 분기로
  들어가 NPC 가 맵 재로드까지 영구히 멈춘다(회귀: `test/runtimePageMovementAfterCommandRoute.test.ts`).
  (2) 플레이어 상대 이동(접근/도주/추격)의 위치 조회는 `eventPositions` → `session.eventLocations` →
  원본 이벤트 순이어야 한다. `map.events` 만 보고 못 찾을 때 플레이어 좌표로 대체하면 dx=dy=0 이 되어
  필드 스폰 몬스터와 `spawnEvent` 산출물이 한 칸도 움직이지 않는다(회귀: `test/runtimeSpawnedEventMovement.test.ts`).
  (3) 시간 시스템이 켜져 있고 `event.schedule` 이 있으면 페이지 이동 등록을 **건너뛴다** —
  일정이 있는 NPC 에게 이동 유형을 줘도 무시된다. 의도된 우선순위지만 저작자에게 보이지 않는다.
- **주인공 이동은 RPG Maker 식 프레임 정량화다 (2026-09-03).** `src/player/playSceneMovement.ts` 는 deltaMs 를
  60Hz 논리 틱으로 바꾸고(`takeLogicTicks`, 반올림 이월 누적기 → 어느 주사율에서도 1초 = 60틱) 틱마다 RM 의
  `Game_Player.update` 한 프레임을 돌린다: 안 걷고 있으면 그 프레임 입력(또는 강제 루트)으로 걸음을 시작, 그 다음
  이번 프레임 이동을 진행. 걸음은 `round(moveDurationMs / 틱)` 프레임(160ms → 10, 대시 1.8배 → 5)에 **정수
  프레임 카운터**(`moveElapsedFrames`)로 정확히 끝나고, 다음 걸음은 다음 틱에 시작한다. 점프·낙하도 같은 틱으로
  간다(`PlayerHopState.elapsedFrames`). 시간 보간·「남은 시간 이월」·「걸음 이어 붙이기(chain)」는 **없다** —
  이전 시간 기반 구현은 이어 붙이기가 걷는 동안 `moving` 을 한 프레임도 내리지 않아 방향키 탭 래치(peek/deferTaps)와
  겹쳐 키를 전부 뗀 뒤에도 벽까지 걷는 결함을 냈다(출하 경로 실측 y 18→7). 입력(`src/player/input.ts`)도 RM 처럼
  프레임당 한 번 `update()` 로 「지금 눌림」을 읽고, 프레임 사이에 시작·종료한 탭만 1회 엣지로 보충한다. **걷는 중 입력은
  보관하지 않는다** — 한 칸 안에서 눌렀다 뗀 키는 RM 처럼 버려지고, 칸 경계 프레임에 눌려 있는 키만 다음 걸음이 된다.
  틱이 0인 프레임(120Hz 의 절반)에서는 입력을 읽지 않아 엣지가 다음 틱 프레임으로 살아 간다. 테스트 하네스는
  `logicTickAccumulatorMs: 0` 을 줘야 하고, `updatePlayScene(scene, 0)` 은 아무 일도 하지 않는다(프레임이 없다) —
  한 프레임은 `1000/60` ms 다. 회귀: `test/runtimeMovementStability.test.ts`(정량화·RM 입력 계약),
  `test/runtimePlayerHop.test.ts`(프레임 단위 점프·낙하); 출하 경로 프로브 `scripts/qa/probe-runtime-hold-release.mjs`
  ([speed] 1초 유지 = 6칸 + 뗀 뒤 정지 5 시나리오).
- **이벤트 접촉 트리거는 양방향이다.** 충돌 발동 규칙은 `src/project/eventTouchRules.ts` 한 곳에만 둔다
  (`firesOnPlayerCollision`). 이전에는 `playSceneMovement.ts` 와 `src/testing/sceneTestRunner.ts` 가
  규칙을 각자 복사해 두고 어긋나 있었고, `eventTouch` 는 NPC 가 플레이어에게 걸어오는 쪽만 발동했다.
  이동 유형이 정지면 무버가 없으므로 그 트리거는 영원히 실행되지 않았다
  (회귀: `test/runtimeEventTouchPlayerCollision.test.ts`).
- **애니메이션 유형은 `normal`/`fixedGraphic` 만 구현돼 있다.** `step`, `fixedDirectionStep`,
  `fixedDirection`, `fourFrame` 은 저작되지만 `playSceneAutonomousSprites.ts` 가 normal 로 취급한다.
  정지 애니메이션은 무버 없는 이벤트에도 프레임 클록이 필요하므로 별도 작업이다.
- **Action combat runtime:** for real-time action combat (`system.actionCombat` + `map.actionCombat`), routing, pure rule modules in `src/battle/action/`, and scene integration in `src/player/playSceneActionCombat.ts`, see `openwiki/runtime-action-combat.md`.

## ESC skill thumbnails (2026-09-06)

`playerStatusMenuDetails.skillEntryIcon` passes the referenced battle animation's sheet geometry
to `playerStatusMenuDetailRenderer`. Skills show pattern 0, not the whole sprite sheet.
The renderer centers a cell-sized background inside the existing icon box, preserving rectangular
cell proportions and excluding neighboring rows/columns at both list and showcase sizes.
Legacy animations without sheet metadata use 96x96 cells and five columns, matching the editor.
Item/equipment images retain whole-image `contain`; missing animation resources retain their placeholder.
Regression coverage: `test/playerStatusMenuEntryIcons.test.ts`; shipping keyboard/screenshot coverage:
`scripts/qa/runtime/esc-menu.scenario.mjs` (`skills`, `next-skill`, `return-to-items`).

## Recovered head emotes (2026-09-05)

`playSceneEmotes.ts` owns transient target-keyed sprites/timers. Interpreter and parallel/common-event scheduler resume immediately after `showEmote`; gift rank and friendship changes use the same sprite path. Head anchoring follows displayHeight × originY, including hop lift. Replacement, target removal, map change and scene teardown cancel timers/tweens together. `runtimeAssets.json` includes the generated sheet for shipping exports; Phaser preload uses `withInlineAsset` for standalone HTML. `__oprnEmotes` is installed only by the existing QA instrumentation boundary.

Validation: `showEmoteCommand`, `showEmoteCommandBody`, `playSceneEmotes`, `emoteSheet` and `commandContracts/showEmote` tests. `npx tsx scripts/qa/emote-runtime.mts` generates a transient minimal engine contract fixture and runs the shipping-player harness; it does not author/persist a demo game. Read `verify-shots/runtime-qa/emote/SUMMARY.md` first.

## 메뉴 입력·불러오기 배율 (2026-09-05)

`player.ts`의 전역 키 처리기는 IME 조합을 양보하고, 결정/취소 키의 OS 반복을 소비하되 실행하지 않는다. 방향키 반복은 목록 탐색에 그대로 사용한다. 이 가드가 없으면 Z 유지가 아이템 목록→대상→소모를 한 번에 실행하고, X 유지가 닫은 메뉴를 다시 열거나 타이틀 복귀 확인까지 통과한다.

슬롯 로드처럼 하위 화면에서 메뉴가 직접 닫혔으면, 다시 열 때 `selectedCommand`를 `statusMenuRailIdForCommand`로 레일 항목에 맞추고 이전 그룹을 비운다. 그렇지 않으면 화면은 「시스템」을 선택한 채 결정 키가 숨은 「로드」를 실행해 시스템 그룹으로 돌아갈 수 없었다. 일반 취소로 레일에 복귀할 때도 같은 변환을 쓴다.

타이틀에서 여는 `renderLoad`도 `createPlaySurface`의 stage에 붙인다. layout에 직접 붙이면 논리 px를 화면 px로 그려 3배 게임에서 불러오기만 11px 글자가 된다. surface cleanup·호스트 전체화면 제어도 타이틀과 같은 수명을 갖는다. `runtime/title.css`는 불러오기 창 높이를 stage 안으로 제한하고 저장 칸 목록을 스크롤한다. 긴 오류나 자동 저장 카드가 있어도 제목·뒤로는 남고 키보드 커서가 선택 슬롯을 노출해야 한다.

## 가구 밀기 애니메이션 (2026-09-05)

- **가구 밀기는 주인공 걸음과 같은 틱의 별도 표현 상태다 (2026-09-05).**
  `furniturePushAnimation.ts`와 `playSceneMovement.tryStartFurniturePush`가 소유한다.
  조사/방향 입력 모두 몸과 가구가 같은 곡선으로 한 칸 움직인다. 가구 위치를 갱신했다고
  `refreshRuntimeEntities`를 부르면 순간이동/스프라이트 재생성이 돌아온다. 맵 리셋은 표현 상태를
  비우고 `stopCommandMovement`는 양쪽을 취소해야 한다. 자세한 계약과 연속 프레임 QA는
  `horror-authoring.md`의 「가구 밀기 애니메이션」 절을 따른다.

## Recovered head emotes (2026-09-05)

`playSceneEmotes.ts` owns transient target-keyed sprites/timers. Interpreter and parallel/common-event scheduler resume immediately after `showEmote`; gift rank and friendship changes use the same sprite path. Head anchoring follows displayHeight × originY, including hop lift. Replacement, target removal, map change and scene teardown cancel timers/tweens together. `runtimeAssets.json` includes the generated sheet for shipping exports; Phaser preload uses `withInlineAsset` for standalone HTML. `__oprnEmotes` is installed only by the existing QA instrumentation boundary.

Validation: `showEmoteCommand`, `showEmoteCommandBody`, `playSceneEmotes`, `emoteSheet` and `commandContracts/showEmote` tests. `npx tsx scripts/qa/emote-runtime.mts` generates a transient minimal engine contract fixture and runs the shipping-player harness; it does not author/persist a demo game. Read `verify-shots/runtime-qa/emote/SUMMARY.md` first.
