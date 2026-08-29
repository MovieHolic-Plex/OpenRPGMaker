- Title/load surfaces, status menu, dialogue UI, save slots, and play shell wiring: start in `src/player/player.ts`, `src/player/playerLoadPanel.ts`, `src/player/playerStatusMenu*.ts`, and `src/player/dialogue.ts`. **Desktop title input contract (2026-08-24):** title options use a single roving Tab stop with stable option IDs; Arrow keys synchronize selected/focused/`aria-selected`, and Z, Enter, or Space takes the selected New/Load/Quit path. Title pointer activation is blocked and no title control crosses the play-input boundary. Touch controls do not auto-mount from device capability; only an explicit `VITE_TOUCH_CONTROLS` / `OPENRPG_PLAYER_TOUCH_CONTROLS` true override enables the mobile pad. Test Play keeps the `320×240` canvas in a centered 4:3 fit-without-crop stage. **Play surface scale mode (2026-08-25):** `calculatePlaySurfaceScale` takes an explicit `PlaySurfaceScaleMode`. `integer` (default, shipped/community player) keeps the whole-number stage; `fit` returns the unfloored contain scale and is what the editor Test Play window passes through `renderPlayer({ surfaceScaleMode: \"fit\" })` — with integer-only scaling a 1214×640 window drew the game at 640×480, i.e. 27% of the surface. Fractional scaling relies on `image-rendering: pixelated` on the play canvas; do not remove it. **Status menu contract (2026-08-24):** `src/player/playerStatusMenu.ts` is a non-modal edge dock that keeps the map visible, presents six primary entries, and reveals grouped commands progressively. `playerStatusMenuController.ts` owns the nested cancel stack and title-return confirmation; `playerStatusMenuDetailRenderer.ts` owns roving detail focus while preserving life-ledger tab/panel semantics. Keep `src/styles/runtime/statusMenuEdgeDock.css` as an overlay after the base status-menu CSS.
- Dialogue escape parsing/playback is owned by `parseDialogueText` + `createDialogueUI` in `src/player/dialogue.ts`, with zero-width controls preserved through `dialoguePagination.ts`. `\v[n]`, `\n[n]`, and `\c[n]` resolve variables/actor names/colors; `\s[n]` sets a clamped 1–20 typing delay (`n × 8ms`); `\.`/`\|` wait 250/1000ms; `\!` pauses until an advance key; `\>`/`\<` enter/leave instant typing; `\$` opens a live-session gold window; and `\^` closes after typing without another input. `\_` becomes a half-width space and `\\` remains a literal backslash. Raw escape syntax must never render in play or the editor preview. When speaker is set, createDialogueUI mounts a floating nameplate (.speaker.speaker-nameplate, testid dialogue-speaker) on the dialogue box rim so the name is visually separated from chat body text. The runtime uses the `--runtime-dialogue-*` dark-glass token family: speaker names mount as compact rim tabs; normal faces stay 48×48 chips drawn from one file per face (no sheet cropping); bust/full resources are stage-logical fixed sizes with left/right text reservation; choices, number input, gold, transparent mode, and top/center/bottom placement remain variants of the same component. Keep `dialogueBodyWidth` deductions synchronized with CSS padding, border, chip gap, and bust/full reserves.
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
- **이벤트 접촉 트리거는 양방향이다.** 충돌 발동 규칙은 `src/project/eventTouchRules.ts` 한 곳에만 둔다
  (`firesOnPlayerCollision`). 이전에는 `playSceneMovement.ts` 와 `src/testing/sceneTestRunner.ts` 가
  규칙을 각자 복사해 두고 어긋나 있었고, `eventTouch` 는 NPC 가 플레이어에게 걸어오는 쪽만 발동했다.
  이동 유형이 정지면 무버가 없으므로 그 트리거는 영원히 실행되지 않았다
  (회귀: `test/runtimeEventTouchPlayerCollision.test.ts`).
- **애니메이션 유형은 `normal`/`fixedGraphic` 만 구현돼 있다.** `step`, `fixedDirectionStep`,
  `fixedDirection`, `fourFrame` 은 저작되지만 `playSceneAutonomousSprites.ts` 가 normal 로 취급한다.
  정지 애니메이션은 무버 없는 이벤트에도 프레임 클록이 필요하므로 별도 작업이다.
- **Action combat runtime:** for real-time action combat (`system.actionCombat` + `map.actionCombat`), routing, pure rule modules in `src/battle/action/`, and scene integration in `src/player/playSceneActionCombat.ts`, see `openwiki/runtime-action-combat.md`.

## 정수리 이모트 (2026-08-29)

캐릭터 머리 위에 잠깐 뜨는 표현 아이콘. 어휘의 단일 소스는 `src/project/emotes.ts` 의
**`EMOTE_KINDS` 12종**(heart · heartBroken · smile · exclamation · question · music · sweat ·
anger · ellipsis · sleep · sparkle · idea)이고 **배열 순서 = 시트 프레임 인덱스**다.

- **에셋:** `public/assets/generated-emotes.png` (192×16, 16px 프레임 12장). 손으로 딴 그림이
  아니라 `scripts/lib/emoteSheet/render.mjs` 가 코드로 그리고 `node scripts/gen-emote-sheet.mjs`
  가 기록한다. 도형만 칠하면 `outlinePass` 가 1px 어두운 테두리를 자동으로 둘러 어떤 타일 위에서도
  읽힌다. `--check` 는 커밋된 PNG 와 바이트 비교(드리프트 게이트)이고 `test/emoteSheet.test.ts` 가
  같은 대조를 테스트로도 고정한다. **목록을 늘리거나 순서를 바꾸면 시트를 다시 생성해야 한다.**
- **로딩:** `loadBundledAssets` 가 항상 이미지로 싣고 `registerBundledFrames` → `registerEmoteFrames`
  가 16px 숫자 프레임을 등록한다(작물 시트와 같은 방식). `BUNDLED_IMAGE_ASSETS` 에는 넣지 않는다 —
  엔진 소유 에셋이라 자료 보관함·리소스 픽커에 노출할 것이 아니다.
- **표시:** `src/player/playSceneEmotes.ts`. depth `400_000` (캐릭터 200k·above 이벤트 300k 위).
  기준점은 `sprite.y - sprite.displayHeight - 4` — 타일 크기로 고정하면 24px 캐릭셋의 머리를
  파고든다(실측). 팝(140ms) → 상승 → 페이드(200ms)이고 **주인 1명당 1개**라 다시 띄우면 교체된다.
  NPC 는 걸으므로 `syncSceneEmotes` 가 매 프레임 위치를 다시 잡고(`PlayScene.update`),
  주인이 사라지면 함께 정리한다. 상승분은 y 가 아니라 별도 `lift` 값을 트윈한다 —
  y 를 직접 트윈하면 매 프레임 동기화와 서로를 덮어쓴다.
- **명령:** `showEmote { target: "player" | { eventId }, emote, durationMs? }`.
  `eventId: ""` 는 showAnimation 과 같은 규약으로 "이 명령을 실행한 이벤트"를 뜻한다.
  씬이 즉시 재개하므로 **대사·이동을 막지 않는다**(대기 옵션 없음). 병렬 이벤트 경로
  (`playSceneSchedulers.applyParallelStep`)도 지원한다. 표시 시간은 200~10,000ms 로 클램프된다.
- **자동 이모트(저작 0줄):** 선물은 반응 등급 → `giftRankEmote`(loved 하트 · liked 미소 ·
  neutral 말줄임 · disliked 화남), 대화 호감도는 `friendshipDeltaEmote`. 둘 다 NPC 관계
  (`characterId`)가 없으면 애초에 호감도가 안 오르므로 이모트도 안 뜬다.
- **QA:** 이모트는 Phaser 스프라이트라 DOM testid 로 볼 수 없다. `__oprnEmotes` 훅
  (`describeSceneEmotes`)이 target·frame·좌표·alpha 를 노출하고, 런타임 QA 하네스의
  `emoteCountAtLeast` / `emoteFrames` 기대축이 그것으로 판정한다.
  `npm run qa:runtime -- --scenario emote` → `verify-shots/runtime-qa/emote/SUMMARY.md`.
