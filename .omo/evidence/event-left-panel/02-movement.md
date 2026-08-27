# 02 — 움직임과 속도 (event editor rail group `slug=move`) 감사

- 워크트리: `/home/main/z-project/rpg-zzu-event-page-props` (branch `agent/event-page-props`)
- 조사 전용. `src/` 미수정. 새로 쓴 파일 2개: 이 보고서와 `test/_probe-movement.test.ts`.
- 판정 기준: **PASS** = 에디터 저장 → 런타임 소비까지 코드로 연결 확인. **ORPHAN** = 저장은 되지만 소비처 없음(또는 UI 없음). **BROKEN** = 연결은 있으나 특정 조건에서 조용히 죽음. **UNKNOWN** = 읽지 못함.
- 레일 그룹 `move` 의 실제 소유 노드: `pageProps.ts:760` 이 `[data-testid='event-classic-movement-section']` 만 claim → 그 안에 **이동 유형 / 애니메이션 유형 / 이동 속도** 3개 필드셋 (`pageProps.ts:702-705`). 즉 "움직임과 속도" 그룹은 이 3개 + 유형별 하위 UI(빈도 select, 사용자 지정 경로 버튼, 생활 이동 패널)로 구성된다.

---

## (1) 설정 항목별 판정표

| 항목 | 에디터 컨트롤 (file:line) | 저장 필드 | 런타임 소비 위치 (file:line) | 판정 | 근거 |
|---|---|---|---|---|---|
| 이동 유형 — 정지 | `pageMovement.ts:9`(옵션), `:19`(select), `:24-29`(store 반영) | `page.movement.type="fixed"` | `playScenePageMoveRoutes.ts:79-80` → `routeForPageMovement` 가 `null` → 무버 미등록 | PASS | 프로브 L1-b: `autonomousNPCs.size === 0`. 정지는 "무버 없음"으로 정확히 구현 |
| 이동 유형 — 무작위 | 같은 select (`pageMovement.ts:19`) | `type="random"` | 등록 `playScenePageMoveRoutes.ts:81-82`(4방향 moves + `strategy:"random"`), 결정 `playSceneAutonomousCommands.ts:51-53`(세션 RNG로 moves 중 택1), 실행 `playSceneAutonomous.ts:42-83` | PASS | 프로브 L1: 60 tick 후 (1,1)→다른 좌표 |
| 이동 유형 — 접근 | 같은 select | `type="approach"` | `playScenePageMoveRoutes.ts:83-84`, 명령 강제 치환 `playSceneAutonomousCommands.ts:50`(`moveTowardPlayer`), 방향 `playSceneAutonomousRouteDirection.ts:24-36` | PASS | 프로브 L4: 맵 상주 이벤트뿐 아니라 `session.spawnedEvents` 로 스폰된 이벤트도 플레이어 쪽으로 이동(x 3→6) |
| 이동 유형 — 추격 | 같은 select | `type="chase"`, `pathfind` 기본 true(`pageMovement.ts:81-83`) | 등록 `playScenePageMoveRoutes.ts:85-86`(moves 빈 배열 + `strategy:"chase"`), 전용 루프 `playSceneAutonomous.ts:25-27, 86-158`, 판단 `chaseAi.ts:30-82` | PASS | `runtimeEventPageMovement.test.ts:129-152` 가 sight/giveUp/pathfind 전달 고정. `chaseAi.ts:59` — `sightRange` 미지정이면 시야 게이트 없이 맵 전역 추격 |
| 이동 유형 — 사용자 지정 | 같은 select + 버튼 `pageMovement.ts:34-46`(`type!=="custom"` 이면 disabled), 다이얼로그 적용 `moveRouteDialog.ts:172-184` | `type="custom"`, `movement.route.{moves,repeat,skippable,wait}` | `playScenePageMoveRoutes.ts:87-90`(`strategy:"sequence"`), 명령 해석 `playSceneAutonomousCommands.ts:56-101, 105-186` | PASS(부분) | `runtimeEventPageMovement.test.ts:29-58` 가 실제 실행 고정. **단 `route.skippable` / `route.wait` 는 페이지 이동 경로에서 아무도 읽지 않음**(아래 별표 참조) |
| ↳ `route.skippable` ("이동 불가 시 건너뜀") | `moveRouteDialog.ts:57-60, 180` | `movement.route.skippable` | 소비처 없음 — `src/player` 전체에서 `MoveRoute.skippable` 참조 0건(`cutsceneControl.ts`/`playSceneMovies.ts` 의 skippable 은 별개 필드). 이동 불가 시 동작은 `playSceneAutonomous.ts:78-81`(무조건 제자리 + 다음 스텝) 고정 | ORPHAN | 타입 정의 `types/events.ts:68`; 저장·검증(`shapeEventFields.ts`)만 존재 |
| ↳ `route.wait` | UI 없음(다이얼로그는 기존 값만 보존: `moveRouteDialog.ts:181`) | `movement.route.wait` | `playSceneInterpreter.ts:371,375` 의 `moveEvent` **명령** 경로 전용. 페이지 이동은 읽지 않음 | ORPHAN | `types/events.ts:66` |
| 이동 유형 — 생활 이동 | select + 패널 `pageNpcLiving.ts:15-70`, 적용 `:32-46` | `type="living"`, `movement.living.{destinations,repeat}` | `playScenePageMoveRoutes.ts:33`(fallback), `npcLivingTravel.ts:35-77`(BFS 경로/맵 연결 `npcTransfer`) | PASS(주의) | 유형 전환 시 기본 목적지가 **(0,0)** (`pageMovement.ts:73-79`) — 그 칸이 통행 불가면 `npcLivingTravel.ts:56,72`(`path.length===0`)에서 조용히 `null` → 무버 미등록. 경고 없음 |
| 움직임 빈도 | `pageMovement.ts:20, 96-104`(1~8, 라벨 "아주 드묾"~"아주 자주"), 정지면 `disabled`(`:22-23`) | `movement.frequency` | `playScenePageMoveRoutes.ts:104,107-108` → `mover.frequencyRank`, `moveIntervalMs = npcMoveIntervalMs(f)` = `max(80, 1040-160f)` (`:71-74`); 소비 `playSceneAutonomous.ts:35-37` | PASS | 프로브 L0-b(store 반영 `frequency:8`), L1(`moveIntervalMs === npcMoveIntervalMs(8)`) |
| 이동 속도 | `pageProps.ts:704, 1014-1026`(`event-page-movement-speed-select`, **1~6만 제공**) | `movement.speed` | `playScenePageMoveRoutes.ts:103,105` → `speedRank`, `moveDurationMs = npcMoveDurationMs(s)` = `max(80, 640-80s)` (`:66-69`); 소비 `playSceneAutonomous.ts:180-183` | PASS(범위 불일치) | 프로브 L0-b(`speed:6` 저장), L1(`moveDurationMs === npcMoveDurationMs(4)`). 런타임 clamp 는 1~8(`playScenePageMoveRoutes.ts:120-123`)이고 AI 툴은 6~8을 씀(`eventTools.ts:1545`) → **7·8은 에디터에서 만들 수도, 정확히 표시할 수도 없다**(칩 라벨 default 분기 `pageProps.ts:945-958`) |
| 애니메이션 유형 | `pageAnimationType.ts:6-14`, 옵션 6종 `options.ts:163-170` | `page.animationType` | `runtimeEventState.ts:96`; 소비는 **`fixedGraphic`** 만(`playSceneAutonomousSprites.ts:19,32`) + `fixedDirection*` 은 조사 시 회전 억제에만(`playSceneMovement.ts:330,344-357`) | ORPHAN(부분) | `step`("정지 시 애니메이션"), `fixedDirectionStep`, `fourFrame` 은 프레임 계산에 전달되지 않는다 — `animationType` 문자열이 `charsetMotion` 까지 내려가지 않음. `normal` 과 동일 동작 |
| 사용자 지정 이동 경로(명령 카탈로그) | `moveRouteCommandCatalog.ts:21-…`(이동/회전/점프/속도·빈도 변경/스위치/그래픽/SE/NPC 전송) | `movement.route.moves[]` | `playSceneAutonomousCommands.ts:56-101`(이동 델타), `:105-186`(즉시 명령). `changeSpeed/changeFrequency` 는 `:158-165` 에서 `npcMoveDurationMs/IntervalMs` 재계산 | PASS | 모든 `MoveCommand` 분기가 `assertNever` 로 닫혀 있어 누락 없음 |
| `sightRange` / `giveUpRange` / `pathfind` / `moveIntervalMs` | **에디터 UI 없음** (프로브 L0-c: move 그룹 내 관련 testid 0건) | `movement.*` | 전부 소비됨: `playScenePageMoveRoutes.ts:106-111` → `chaseAi.ts:53-60,66-69` | ORPHAN(에디터 측) | AI 툴/프리셋(`eventTools.ts:1563-1569`)만 authoring 가능. GUI 저자는 추격 시야를 만들 수 없다 |
| move 레일 헤더 요약 | `pageProps.ts:765` `summary: page.movement.type` | — | — | BROKEN(표시) | 원시 enum 그대로 노출. 프로브 L0-c: `evt-rail-meta-move` 텍스트 = `"fixed"`. 같은 파일 `:926-943` 에 한글 라벨 함수(`movementTypeChipLabel`)가 이미 있는데 쓰지 않는다. 그룹은 기본 접힘(`open:false`) |

---

## (2) 핵심 — "새로 배치한 이벤트가 안 움직인다" 경로 추적

### 2.1 결론 먼저

**단위 레벨(런타임)은 정상이다.** random/approach/chase/custom/living 전부 등록·실행되며(프로브 L1/L4, 기존 `runtimeEventPageMovement.test.ts` 7건 통과) `speed`/`frequency` 도 `moveDurationMs`/`moveIntervalMs` 로 정확히 전달된다. **결함은 저작(authoring)·통합 레벨에 있다.** 근본 원인은 하나가 아니라 아래 A·B·C 가 겹친 것이고, 그중 **A 가 "배치했는데 전혀 안 움직인다" 증상의 확정 주원인**이다.

### 2.2 확정: 원인 A — 모든 배치 경로의 기본값이 `fixed` 이고, 유형 UI 는 접힌 채 영문 enum 만 보여준다

| 배치 경로 | 기본 movement | 근거 |
|---|---|---|
| 맵에서 이벤트 새로 만들기(우클릭/툴) | `type:"fixed", speed:3, frequency:3` | `EditScene.ts:950` / `eventLayerContextMenu.ts:45` → `modal.ts:50-58 openNewEventEditorModal` → `eventDraftActions.ts:19-42 createEventDraft` → `eventActions.ts:20-36 createDefaultGameEvent` → **`eventPages.ts:21-27`** |
| 페이지 추가 | 동일 `fixed` | `eventPages.ts:56-66 addEventPage` → `createDefaultEventPage` |
| 페이지 없음(레거시 이벤트) | `fixed` (또는 `event.moveRoute` 있으면 custom) | `runtimeEventState.ts:16-19 DEFAULT_PAGE_MOVEMENT`, `:180-184 legacyMovement` |
| AI 툴 `place_npc` | 인자 생략 시 `PASSIVE`(=fixed). **enum 이 `["fixed","random"]` 뿐** | `eventTools.ts:469`, `:508`, `:42-43` |
| AI 툴 `make_villager`(주민) | 항상 `PASSIVE` — movement 인자 자체가 없다 | `eventTools.ts:708`, `:731`, `:748` |
| 필드 몬스터 템플릿 | `fightMovement ?? PASSIVE`, `clearedMovement ?? PASSIVE` | `fieldMonsterTemplate.ts:92,103` |
| 문/상자/출입구/컷신 등 프리셋 | `PASSIVE` | `eventTools.ts:1337,1669,1681,1752,1816,1921,1948,2091` |
| 추격자 프리셋(`place_chaser` 계열) | **유일하게 움직임 있음** `type:"chase", speed=frequency=6` | `eventTools.ts:1563-1569` |

즉 "NPC/몬스터를 놨다"의 거의 모든 경로가 정지로 생성된다. 저자가 유형을 바꾸려면 접혀 있는 `move` 그룹을 펼쳐야 하고, 그 헤더에는 한글 라벨 대신 `fixed` 가 떠 있다(`pageProps.ts:765`, 프로브 L0-c). **배제 근거로 확인한 것**: 사용자가 유형을 바꾸면 store 에는 정상 반영된다 — 프로브 L0-b 가 `event-page-movement-type` → `random`, 속도 select → 6, 빈도 select → 8 을 각각 `store` 값으로 확인. 따라서 "바꿨는데 저장이 안 된다"는 가설은 **배제**.

### 2.3 확정: 원인 B — 이벤트 편집기를 열어둔 채 테스트 플레이하면 편집 내용이 런타임에 안 들어간다

- 새로 배치한 이벤트는 `draft:{kind:"new"}` 상태로 프로젝트에 들어간다(`eventDraftActions.ts:32`).
- 플레이 런타임은 맵 로드 시 **드래프트를 제거한 사본**을 쓴다: `playSceneMapRuntime.ts:118 scene.map = mapWithCommittedEvents(map)` → `eventDrafts.ts:41-50 committedEvents` — `new` 드래프트는 **제외**, `edit` 드래프트는 **편집 전 원본**으로 대체.
- 전체 테스트 플레이/시연도 같다: `testPlayModal.ts:73 projectWithoutEventDrafts(store.getCurrent())`.
- 반대로 편집기 안의 "이벤트 테스트"는 작업 중 본문을 주입하므로 정상: `testPlayModal.ts:117` → `eventTestSandbox.ts:24-37`.
- OK 저장 시 커밋되어 런타임에 보인다: `modal.ts:452 saveEventDraft` → `eventDraftActions.ts:69-81` → `eventDrafts.ts:106-112 commitEventDraft`. 저장 없이 닫으면 새 이벤트는 삭제된다(`modal.ts:222` → `eventDrafts.ts:117-121`).

→ "편집기를 띄워둔 상태에서 여기서 테스트/시연 실행" 을 하면 **이동 유형 변경이 반영되지 않는다**(edit 드래프트면 이전 값, new 드래프트면 이벤트 자체가 없음). 감독자 브라우저 재현 시 이 조건을 반드시 분리할 것.

### 2.4 확정: 원인 C(BROKEN) — 명령 "이동 루트 설정"이 한 번 걸리면 페이지 이동이 영구히 죽는다

경로:
1. `moveEvent` 명령이 그 이벤트에 명령 무버를 등록하고 id 를 `commandMoveRouteEventIds` 에 넣는다 — `playSceneInterpreter.ts:373-374`.
2. 루트가 끝나면 `playSceneAutonomous.ts:29-31` 이 `commandMoveRouteEventIds.delete(eventId)` 성공 시 `autonomousNPCs.delete(eventId)` — 무버 제거.
3. 그런데 `pageMoveRouteKeys` / `pageMoveRouteEventIds` 는 그대로 남아 있고, 다음 `registerPageMoveRoutes` 는 `playScenePageMoveRoutes.ts:38-46` 의 "이미 등록됨" 분기로 들어가 `if (mover) configurePageMover(...)` → `mover` 가 `undefined` 이므로 **아무 일도 없이 `continue`**. 재등록 경로(`:47-56`)에 절대 도달하지 않는다.

→ 페이지 이동이 무작위/접근/추격/사용자 지정이었던 NPC 는 명령 루트 1회 이후 **맵을 다시 로드할 때까지 영구 정지**. 프로브 L3 가 이를 재현: 명령 루트 완주 후 `pageMoveRouteEventIds.has("npc")===true` 인데 `autonomousNPCs.has("npc")===false`, 이후 200 tick 동안 좌표 불변. 같은 형태의 무버 삭제가 `npcSchedules.ts:164 teleportNpc` 에도 있다(이쪽은 2.5 게이트와 겹쳐 어차피 페이지 이동이 등록되지 않으므로 증상이 중복되지 않는다).

### 2.5 확정: 원인 D — `timeSystem` + `event.schedule` 이면 페이지 이동을 아예 등록하지 않는다

`playScenePageMoveRoutes.ts:31` — `if (resolveTimeSystem(project) && view.event.schedule?.length) continue;`

시간표가 있는 NPC 는 페이지의 이동 유형을 통째로 무시하고 스케줄 무버(`npcSchedules.ts:129-148`, 고정 `speed 4/frequency 8`)에만 맡긴다. 프로브 L2 로 확정(스케줄 부여 전 등록됨 → `timeSystem.enabled=true` + `schedule` 부여 후 미등록). 반대 방향의 조용한 죽음은 툴이 경고를 붙여 두었다(`eventTools.ts:551-563`: 시간표는 있는데 timeSystem 이 꺼진 경우). **이 반대 케이스(시간표+시간시스템 ON 이라 페이지 이동이 버려짐)에는 경고가 없다.**

### 2.6 배제된 가설 (읽어서 아니라고 확인한 것)

| 가설 | 판정 | 근거 |
|---|---|---|
| 에디터에서 유형을 바꿔도 store 에 안 들어간다 | **배제** | `pageMovement.ts:24-30` → `:106-108 replaceMovement` → `eventPages.ts:150-161 updateEventPage`. 프로브 L0-b 실측 |
| `canUpdateWaitingEvents` 게이트가 상시 막는다 | **배제** | `playSceneMovement.ts:75-76, 94-96`: `!scene.running` 이면 통과. `scene.running` 은 인터프리터 실행 구간에서만 true(`playSceneInterpreter.ts:76,81,108,120,144,160,179,194` — 항상 finally 로 복원). 매 프레임 호출은 `PlayScene.ts:284-285 update → updatePlayScene` 로 확인. 단 **이벤트/대화가 진행 중인 동안은 의도적으로 NPC 가 멈춘다**(RM2K3 관례, `messageWindowSettings.allowEventMovementDuringWait` 로 해제) |
| `registerPageMoveRoutes` 가 호출되지 않는다 | **배제** | `playSceneMapRuntime.ts:128`(맵 로드), `:444`(refreshRuntimeSurfaces), `playSceneFieldSpawns.ts:55,74,103,141,150`, `playSceneActionCombat.ts:360` |
| `pageMoveRouteKeys` 재사용 때문에 신규 이벤트가 등록되지 않는다 | **배제** | 키는 `이벤트id:페이지id`(`playScenePageMoveRoutes.ts:36`)로 신규 이벤트와 충돌 불가. 페이지가 바뀌면 `:57-64` 에서 정리. 재사용 분기는 `mover` 가 살아 있는 한 정상 동작(`runtimeEventPageMovement.test.ts:97-118` facing 보존 계약) |
| 스폰된 이벤트(필드 몬스터 등)는 approach 방향 계산이 깨진다 | **배제(반증됨)** | 이전 세션의 프로브가 주장했으나 실측 실패. `playSceneAutonomousRouteDirection.ts:59-68` 은 `scene.eventPositions` → `session.eventLocations` → 템플릿 좌표 순으로 위치를 찾으므로 스폰 이벤트도 정상. 프로브 L4 가 x 3→6 이동 확인 |
| 페이지 미해결(`resolveEventPage` undefined)이 원인 | **부분 조건** | 조건이 하나도 안 맞으면 `runtimeEventState.ts:97` 이 `legacyMovement`(= `fixed`)로 폴백한다. 즉 "페이지 조건을 잘못 걸면 정지로 보인다"는 성립하지만, 조건 없는 기본 페이지에는 해당 없음(`pageResolution.ts:17-29`) |

---

## (3) 속도·빈도 전달 경로

- 전달: `configurePageMover` (`playScenePageMoveRoutes.ts:97-112`)
  - `mover.speedRank = clamp(1..8, movement.speed)`, `mover.moveDurationMs = npcMoveDurationMs(speed)` = `max(80, 640-80·speed)` → 1:560ms … 4:320ms … 6:160ms … 8:80ms (`:66-69`)
  - `mover.frequencyRank = clamp(1..8, movement.frequency)`, `mover.moveIntervalMs = movement.moveIntervalMs ?? npcMoveIntervalMs(frequency)` = `max(80, 1040-160·freq)` → 1:880ms … 3:560ms … 8:80ms (`:71-74`, 오버라이드 clamp `:106-108`)
- 소비: 간격 `playSceneAutonomous.ts:35-37`(`timer < moveIntervalMs` 면 대기), 보간 시간 `:180-183`(`elapsedMs/moveDurationMs`), 추격은 `chaseAi.ts:44,62`
- 런타임 중 변경: 이동 경로 명령 `changeSpeed`/`changeFrequency` → `playSceneAutonomousCommands.ts:158-165` 가 같은 함수로 재계산
- **에디터 UI 존재 여부**: 이동 속도 select 는 존재하고 저장된다 — `pageProps.ts:704`(move 레일 소속), `:1014-1026`(변경 시 `updateEventPage`). 프로브 L0-b 로 `speed:6` 저장 확인. 빈도 select 도 존재(`pageMovement.ts:20,96-104`), 정지일 때만 비활성.
- **불일치 2건**: (a) 속도 select 는 1~6 만 제공하는데 런타임/AI 툴은 8까지 쓴다 → 7·8 로 저장된 이벤트를 GUI 에서 열면 select 값이 매칭되지 않고 칩 라벨도 숫자로 새어 나온다(`pageProps.ts:945-958`). (b) 요약 칩은 `유형 · 속도` 만 보여주고 **빈도는 어디에도 요약되지 않는다**(`pageProps.ts:915-924`).

---

## (4) 재현 프로브 실행 결과 (원본 출력)

작성 파일: `test/_probe-movement.test.ts` (10 케이스, L0 저작 → L5 통합).

```
$ cd /home/main/z-project/rpg-zzu-event-page-props && node scripts/run-vitest.mjs run test/_probe-movement.test.ts test/runtimeEventPageMovement.test.ts --configLoader bundle --reporter verbose

 RUN  v3.2.4 /home/main/z-project/rpg-zzu-event-page-props

 ✓ test/runtimeEventPageMovement.test.ts > runtime event page movement > registers NPC autonomous movement from page movement type, speed, and frequency 592ms
 ✓ test/runtimeEventPageMovement.test.ts > runtime event page movement > executes custom NPC move routes during play updates 296ms
 ✓ test/runtimeEventPageMovement.test.ts > runtime event page movement > waits for movement frequency again after an active NPC step finishes 264ms
 ✓ test/runtimeEventPageMovement.test.ts > runtime event page movement > preserves an NPC's action-turn facing when page routes are re-registered 146ms
 ✓ test/runtimeEventPageMovement.test.ts > runtime event page movement > does not register an autonomous mover for stationary NPC pages 191ms
 ✓ test/runtimeEventPageMovement.test.ts > runtime event page movement > registers chase movement with pathfinding options 130ms
 ✓ test/runtimeEventPageMovement.test.ts > runtime event page movement > removes stale page-owned movers when page conditions switch to a fixed page 254ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L0-a 새 이벤트의 page.movement 기본값은 fixed(정지)다 — 배치 직후 안 움직이는 것이 설계된 기본값 9ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L0-b 이동 유형/속도/빈도 컨트롤 변경은 store 에 실제로 반영된다 1838ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L0-c move 레일 요약은 번역되지 않은 원시 enum 을 노출하고, sight/giveUp/pathfind/moveIntervalMs 컨트롤은 없다 420ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L0-d chase 로 저장된 페이지도 에디터 유형 select 에 그대로 나타난다 488ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L1 런타임 단위: random 이동 유형 이벤트는 N tick 후 좌표가 바뀐다 254ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L1-b fixed 페이지는 무버를 만들지 않는다(정지 = 무버 없음) 254ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L2 등록 게이트: timeSystem 활성 + event.schedule 이 있으면 페이지 이동이 등록되지 않는다 242ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L3 명령 이동 루트가 끝난 뒤 페이지 이동(random)이 영구히 복귀하지 않는다 832ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L4 반증: 스폰된(map.events 에 없는) 이벤트도 approach 로 플레이어에게 접근한다 472ms
 ✓ test/_probe-movement.test.ts > probe: 움직임과 속도 (rail group move) > L5 통합 하네스: sceneTestRunner 는 random 무버를 전혀 시뮬레이션하지 않는다(관측 공백) 120ms

 Test Files  2 passed (2)
      Tests  17 passed (17)
   Start at  03:02:02
   Duration  72.28s (transform 62.03s, setup 0ms, collect 103.61s, tests 6.82s, environment 1.94s, prepare 785ms)
```

해석:
- **L1 통과 → 단위 레벨은 정상. 결함은 저작·통합 레벨이다.** 끊기는 지점은 (2.2) 기본값 `fixed` + 접힌 영문 요약, (2.3) 드래프트 미커밋 상태의 테스트 플레이, (2.4) 명령 루트 이후 영구 정지, (2.5) 시간표 있는 NPC 의 페이지 이동 폐기.
- **L5 는 "테스트가 이 결함을 못 잡는 이유"의 근거다.** `sceneTestRunner.ts:1772` 가 `movement.type === "chase"` 인 이벤트만 무버로 시뮬레이션한다. random/approach/custom/living 은 통합 러너에서 **좌표가 절대 변하지 않는다**. 그래서 `expect(eventAt: 원래 좌표)` 가 통과해 버리고, 회귀가 통합 레벨에서 감지되지 않는다.
- 참고: 이전 세션이 남겨 둔 프로브의 "스폰 이벤트 approach 불가" 주장은 실행해 보니 실패했다(`expected { x: 6, y: 3 } to deeply equal { x: 3, y: 3 }`). 해당 케이스는 반증으로 다시 썼다.

---

## (5) 제안 최소 수정 (실제 수정 안 함)

1. **명령 루트 후 페이지 이동 복귀** — `src/player/playScenePageMoveRoutes.ts:38-46`
   재사용 분기의 조건에 무버 생존을 포함한다: `if (keys.has(key) && eventIds.has(id) && scene.autonomousNPCs.has(id)) { … }` — 무버가 사라졌으면 아래 재등록 경로로 흘러가게 한다. (프로브 L3 가 그대로 회귀 테스트가 된다.)

2. **시간표 NPC 의 페이지 이동 폐기를 저자에게 알리기** — `src/editor/tools/eventTools.ts:551-563` 의 반대 케이스 추가
   `schedule` 이 있고 `resolveTimeSystem(project)` 가 켜져 있으면 "이 이벤트의 페이지 이동 유형은 무시되고 시간표만 실행됩니다" 경고 1줄. 런타임 게이트(`playScenePageMoveRoutes.ts:31`)는 그대로 둔다.

3. **move 레일 요약 한글화** — `src/editor/panels/eventEditor/pageProps.ts:765`
   `summary: page.movement.type` → `summary: movementTypeChipLabel(page.movement.type)` (같은 파일 `:926` 에 이미 있음). 정지가 아닐 때 빈도까지 붙이려면 `renderMovementSummaryChips`(`:915`)와 같은 문자열을 재사용.

4. **속도 select 범위 정렬** — `src/editor/panels/eventEditor/pageProps.ts:1015-1018`, `:945-958`
   루프를 `speed <= 8` 로 넓히고 라벨 7·8 을 추가(런타임 clamp 1..8, AI 프리셋 6~8과 일치).

5. **생활 이동 기본 목적지** — `src/editor/panels/eventEditor/pageMovement.ts:73-79`
   `{x:0,y:0}` 대신 이벤트 현재 좌표를 기본값으로 넣는다(`pageNpcLiving.ts:19-24` 가 이미 이벤트 좌표를 폴백으로 쓰므로 두 곳을 같은 값으로 맞추면 통행 불가 (0,0) 로 인한 무성 실패가 사라진다).

6. **통합 러너 관측력** — `src/testing/sceneTestRunner.ts:1770-1790`
   `refreshChasers` 의 필터를 `movement.type !== "fixed"` 로 넓히고 chase 외 전략은 `updateAutonomousNPCs` 와 같은 결정 함수(`nextMoveCommandForScene`)를 쓰게 한다. 이게 없으면 movement 회귀는 계속 통합 레벨에서 통과한다.

7. **(선택) ORPHAN 정리** — `route.skippable`(`moveRouteDialog.ts:57-60`)은 런타임 구현(`playSceneAutonomous.ts:78-81`)을 넣거나 UI 를 감춘다. `animationType` 의 `step`/`fixedDirectionStep`/`fourFrame` 은 `playSceneAutonomousSprites.ts:10-34` 에서 프레임 선택에 반영하거나 옵션에서 제외한다(`options.ts:163-170`).
