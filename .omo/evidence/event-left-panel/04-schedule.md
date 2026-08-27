# 04 — 좌측 패널 "NPC와 일정"(rail group slug=npc) 감사

조사 범위: 이벤트 편집기 좌측 레일 그룹 `npc`("NPC와 일정")에 들어가는 컨트롤 전부 + 과제가 지정한 생활 이동(movement.type="living") 관련 컨트롤.
워크트리: `/home/main/z-project/rpg-zzu-event-page-props` (커밋 `bea987ef` 기준). src/ 는 수정하지 않았다. 새로 쓴 파일은 이 보고서와 `test/_probe-schedule.test.ts` 프로브뿐이다.

## 0. 그룹 구성 사실 확인

- 그룹 정의: `src/editor/panels/eventEditor/content.ts:271-275` — `appendEventRailGroup(pageSettings, { slug: "npc", title: "NPC와 일정", ... }, [socialExtras, scheduleEditor])`.
  - `socialExtras` = `renderEventCharacterSocialExtras` (`src/editor/panels/eventEditor/pageProps.ts:431`) — **event.characterId 가 없으면 null 을 반환**(pageProps.ts:432-433)하므로 NPC 연결 전에는 그룹에 일정 편집기만 남는다.
  - `scheduleEditor` = `renderEventScheduleEditor` (`src/editor/panels/eventEditor/eventScheduleEditor.ts:10`) — 항상 렌더된다.
  - 그룹 요약 텍스트는 `characters[characterId].displayName` (content.ts:267-269).
- **생활 이동(living) UI 는 이 그룹이 아니다**: `renderPageLivingMovement` 는 movement 섹션 안에서 렌더되고(`src/editor/panels/eventEditor/pageMovement.ts:63-65`), 레일 claim 규칙상 slug=`move`("움직임과 속도") 그룹으로 들어간다(`pageProps.ts:762-767`, `event-classic-movement-section` claim). 과제 지시대로 함께 감사했다.
- "NPC 역할" 이라는 필드는 존재하지 않는다. 그룹 안의 정체성 관련 컨트롤은 연결 키(characterId) / 표시 이름(displayName) / 대화 보너스(talkFriendship) 세 개뿐이다(pageProps.ts:437-483, 521-585). 이벤트 "이름"은 이 그룹이 아니라 상단 스트립의 `renderEventNameControl`(content.ts:229)이다.

## 1. 항목별 판정표

### 1-A. NPC 관계 설정 (socialExtras)

| 항목 | 에디터 컨트롤(file:line) | 저장 필드 | 런타임 소비(file:line) | 판정 | 근거 |
|---|---|---|---|---|---|
| 연결 키(NPC 관계) | pageProps.ts:445-462 (`event-character-id-input`) / 상단 picker pageProps.ts:369-429 | `event.characterId` | `src/project/friendship.ts:148-153` (`isTalkFriendshipEnabled`), `resolveSocialKey` 경유 `friendship.ts:168-183` | PASS | characterId 없으면 사교 기능 전부 off(friendship.ts:149) |
| 표시 이름 | pageProps.ts:473-514 (`event-character-display-name-input`) → `store.update` 로 `project.characters[id].displayName` | `project.characters[characterId].displayName` | `src/project/friendship.ts:279-286` (상태 메뉴 호감도 목록), `src/player/playerStatusMenuDetails.ts:441`, `src/player/lifeCalendarHud.ts:48,55` | PASS(부분) | 대화창 화자 이름에는 쓰이지 않는다 — `rg "characters?.["` 결과 소비처는 위 3곳뿐 |
| 대화 보너스 | pageProps.ts:433-442 (`event-talk-friendship-checkbox`) | `event.talkFriendship = true \| undefined` | `src/player/playSceneInterpreter.ts:101` → `src/project/friendship.ts:167-183` | BROKEN(시간 시스템 off 시) | 하루 판정이 `giftDayKey(session.gameTime)`(friendship.ts:176)이고 `gameTime` 이 없으면 `"no-time"` 고정(`src/project/session.ts:651-653`) → 시간 시스템이 꺼진 프로젝트에서는 "하루 첫 대화" 보너스가 **세션 내 단 한 번**만 지급되고 영구히 재설정되지 않는다 |
| 연결 해제 | pageProps.ts:566-579 | `characterId`/`talkFriendship` 제거 | 위와 동일(제거 시 off) | PASS | updateEvent 로 즉시 반영 |

### 1-B. 시간대별 일정(schedule) 행

| 항목 | 에디터 컨트롤(file:line) | 저장 필드 | 런타임 소비(file:line) | 판정 | 근거 |
|---|---|---|---|---|---|
| 일정 추가/삭제 | eventScheduleEditor.ts:33-44 (`event-schedule-add`), :189-200 (`event-schedule-delete-N`) | `event.schedule[]` | `src/player/npcSchedules.ts:293-301` (`scheduledEvents`: `event.schedule?.length` 인 이벤트만 수집) | PASS | test/editorNpcSchedule.test.ts:51-70 |
| 조건: 시간대(timePhase) | eventScheduleEditor.ts:66-70 (`event-schedule-time-phase-N`) | `when.timePhase` | `src/project/npcSchedule.ts:60` (`timePhaseFor(time) !== when.timePhase`), 경계는 `src/project/gameTime.ts:127-133` | PASS | test/npcSchedule.test.ts:19-34 |
| 조건: 정확 시각(hourRange) | eventScheduleEditor.ts:71-75 (`event-schedule-hour-enabled/start/end-N`) | `when.hourRange:[s,e]` | `npcSchedule.ts:63` → `hourInRange` `npcSchedule.ts:67-73` (야간 랩어라운드 지원, `s===e` 는 항상 false) | PASS | 편집기는 0..47/0..48 로 클램프(eventScheduleEditor.ts:71-72), 런타임 hour 최대는 dayEndHour(gameTime.ts:113-118) |
| 조건: 계절(season) | eventScheduleEditor.ts:76-80 (`event-schedule-season-N`) | `when.season` | `npcSchedule.ts:61` | PASS | test/npcSchedule.test.ts:23 |
| 조건: 날짜 범위(dayRange) | eventScheduleEditor.ts:81-85 (`event-schedule-day-enabled/start/end-N`) | `when.dayRange:[s,e]` | `npcSchedule.ts:62` → `numberInInclusiveRange` `npcSchedule.ts:75-79` | PASS | 편집기 1..99 클램프, 실제 계절 길이는 `daysPerSeason`(gameTime.ts:78-82) — 계절 길이보다 큰 값은 영원히 매칭 안 되지만 경고 없음(경미) |
| 조건: 요일 | 없음 | 없음 | 없음 | N/A(의도적 부재) | `src/project/types/events.ts:446-447` 주석: "GameTime에는 요일 개념이 없으므로 요일 조건은 도입하지 않고 dayRange로 대체한다" |
| 조건: 날씨 | 없음 | 없음 | 없음 | N/A(미지원) | `NpcScheduleWhen` 필드는 timePhase/hourRange/season/dayRange 4개뿐(types/events.ts:433-438) |
| 조건: 스위치/변수 | 없음 | 없음 | 없음 | N/A(미지원) | 같은 근거. 일정 행에는 스위치 게이트가 없다(생활 이동 목적지에만 `switchId` 존재) |
| 목적지 맵 | eventScheduleEditor.ts:86-100 (`event-schedule-map-N`) | `at.mapId` | `npcSchedule.ts:49`, `src/player/npcSchedules.ts:73-74`(맵 없으면 무시), 크로스맵 처리 npcSchedules.ts:88-90 | PASS | test/npcSchedule.test.ts:57-70 |
| 목적지 X/Y | eventScheduleEditor.ts:101-102 (`event-schedule-x/y-N`) | `at.x/at.y` | `npcSchedule.ts:50-51` → `normalizeTarget` npcSchedules.ts:191-202 (막힌 칸이면 최근접 통행 가능 칸) | PASS | test/npcSchedule.test.ts:40-56 |
| 목적지 방향(facing) | eventScheduleEditor.ts:103-107 (`event-schedule-facing-N`) | `entry.facing` | `npcSchedule.ts:52` → `setNpcFacingAtTarget` npcSchedules.ts:170-181 (도착 후 적용) | PASS | test/npcSchedule.test.ts:49-53 (`direction: "up"`) |
| 활동(activity) | eventScheduleEditor.ts:108-113 (`event-schedule-activity-N`) | `entry.activity` | `npcSchedules.ts:183-190` → `session.npcActivities`; 조건 평가 `src/project/session.ts:753-754` (`kind: "npcActivity"`) | PASS | test/npcSchedule.test.ts:55, :129-145 (run_scene_test) |
| 행 순서/가림 경고 | eventScheduleEditor.ts:166-172 (`event-schedule-shadow-warning-N`) | — (UI 전용) | 첫 매칭 행 우선 `npcSchedule.ts:24-27` | PASS | 경고 문구가 런타임 "첫 매칭 승리" 규칙과 일치 |
| 일정 목적지 참조 검증 | `src/editor/eventDraftValidator.ts:266-290` | — | `src/project/io/references.ts` / `projectLint` | PASS | test/npcScheduleReferenceIntegrity.test.ts:22-52 |

### 1-C. 생활 이동(movement.type = "living")

| 항목 | 에디터 컨트롤(file:line) | 저장 필드 | 런타임 소비(file:line) | 판정 | 근거 |
|---|---|---|---|---|---|
| 목적지 맵 | pageNpcLiving.ts:24 (`event-page-living-target-map`) → :30-48 | `living.destinations[0].mapId` | `src/player/npcLivingTravel.ts:45,55` (동일 맵 / 크로스맵 분기), 존재 검사 :86 | PASS | test/runtimeNpcLivingTravel.test.ts:19-59 |
| 목적지 X/Y | pageNpcLiving.ts:25-26 | `destinations[0].x/y` | `npcLivingTravel.ts:46-52` (`clampPoint` + BFS `pathTo` :128-152) | PASS | 같은 테스트 |
| 목적지 방향 | pageNpcLiving.ts:27 (`event-page-living-target-direction`) | `destinations[0].direction` | **없음** — 저장/스키마 검증만(`src/project/io/shapeEventFields.ts:300-301`). 런타임은 destinations 에서 mapId/x/y/switchId 만 읽는다(npcLivingTravel.ts:45-52, :86-87) | ORPHAN | 프로브 `living destination direction is not applied on same-map arrival`: 생성된 moves 에 목적지 방향이 전혀 반영되지 않음. 크로스맵 전송 방향도 `connection.to.direction`(npcLivingTravel.ts:70,78)에서 오고, 편집기는 그 값을 `"down"` 하드코딩으로 만든다(pageNpcLiving.ts:94-95) |
| 반복 | pageNpcLiving.ts:28 (`event-page-living-repeat`) | `living.repeat` | `npcLivingTravel.ts:49` → `advanceDestination` :97-104 | ORPHAN(실질) | `repeat` 은 목적지 인덱스를 다음으로 넘기는 데만 쓰인다. 편집기는 항상 목적지를 **1개**로 덮어쓰므로(pageNpcLiving.ts:36-42, 기본 생성도 1개 pageMovement.ts:76-79) `destinationCount=1` → `(0+1)%1=0`, 반복 on/off 결과가 동일하다. 프로브 `repeat only changes anything with 2+ destinations` 로 확인(단일=index 0 유지, 2개=index 1 전진) |
| 목적지 스위치 게이트 | **없음** | `destinations[].switchId` | `npcLivingTravel.ts:87` (`switches[switchId] !== true` 면 그 목적지 건너뜀), 참조 검증 `src/project/io/commandReferenceValidation.ts:43-44` | 역-ORPHAN(런타임 전용) | 프로브 `destination switchId gates the destination`: switch off = 무버 미등록, on = sequence 무버 등록. 편집기 UI 에는 이 필드를 쓸 수단이 없다 |
| 목적지 2개 이상(순회) | **없음** | `destinations[]` | `npcLivingTravel.ts:80-95` 인덱스 순회 + `session.npcTravelStates` | ORPHAN(런타임 전용) | 편집기는 배열을 항상 길이 1로 재작성(pageNpcLiving.ts:36-42) → 순회/반복 로직에 도달 불가 |
| 맵 연결 추가/갱신 | pageNpcLiving.ts:85-104 (`event-page-map-link-add`) | `project.mapConnections[]` | `npcLivingTravel.ts:55-79` BFS | PASS | test/runtimeNpcLivingTravel.test.ts:19-59 |
| 연결: 엔피시 허용 | pageNpcLiving.ts:83 (`event-page-map-link-npc-enabled`) | `connection.npcEnabled` | `npcLivingTravel.ts:110` (`filter(c => c.npcEnabled)`) | PASS | test/runtimeNpcLivingTravel.test.ts:61-87 (npcEnabled:false → 이동/텔레포트 없음) |
| 연결: 플레이어 허용 | pageNpcLiving.ts:84 | `connection.playerEnabled` | 이 파일 밖(NPC 경로에는 영향 없음) | UNKNOWN | 본 감사에서 플레이어 통행 소비처를 읽지 않았다 |
| 연결 출발/도착 좌표 | pageNpcLiving.ts:79-82 | `connection.from/to.{x,y}` | `npcLivingTravel.ts:58-79` (from 까지 걸어가서 `npcTransfer` 로 to 로 이동) | PASS | 같은 테스트 |
| 연결 방향 | **없음(하드코딩)** | `from/to.direction = "down"` (pageNpcLiving.ts:94-95) | `npcLivingTravel.ts:70,78` (`connection.to.direction` 을 전송 명령에 실어 보냄) | BROKEN(경미) | 런타임은 방향을 소비하는데 편집기는 항상 "down" 을 쓴다 → 문 통과 후 방향을 저작할 수 없다 |
| 연결 요약 표시 | pageNpcLiving.ts:135-150 | — | — | PASS(UI 전용) | npcEnabled 여부까지 문자열로 표시 |

## 2. 시간 시스템(resolveTimeSystem) 과 페이지 이동의 상호작용 — 결론

### 2-1. 시간 시스템이 꺼져 있을 때 (project.system.timeSystem 없음 또는 enabled:false)

- `resolveTimeSystem` 이 `undefined` 를 반환하고(`src/project/gameTime.ts:67-70`), `updateNpcSchedules` 는 **첫 두 줄에서 즉시 return** 한다(`src/player/npcSchedules.ts:31-32`).
- 결과: `session.gameTime` 조차 만들어지지 않고, `npcActivities` / `npcScheduleStates` / `eventLocations` 가 일정 때문에 변하지 않는다. **일정 행은 전부 사문**이다(조건 평가도, 목적지 이동도 없음).
- 동시에 `playScenePageMoveRoutes.ts:31` 의 가드 `resolveTimeSystem(project) && view.event.schedule?.length` 는 왼쪽이 falsy 이므로 통과한다 → 페이지 이동(무작위/접근/추적/사용자 지정/생활)이 정상 등록된다.
- 프로브 확인: `time system OFF: schedule is inert and page movement (random) still registers` — `gameTime` undefined, `npcActivities` 비어 있음, 무버 strategy = `random`.

### 2-2. 시간 시스템이 켜져 있을 때 — `playScenePageMoveRoutes.ts:31` 의 정확한 효과

```ts
if (resolveTimeSystem(project) && view.event.schedule?.length) continue;
```

- 이 `continue` 는 **해당 이벤트의 페이지 이동 등록 전체를 건너뛴다**. `routeForPageMovement`(playScenePageMoveRoutes.ts:83-104)도, `routeForLivingMovement` 도 호출되지 않고, 이벤트 id 가 `activePageRouteEventIds` 에 들어가지 않으므로 루프 뒷정리(playScenePageMoveRoutes.ts:65-67 `removePageRouteForEvent`)에서 기존 페이지 무버까지 제거된다.
- 즉 **일정이 한 행이라도 있는 NPC 는 페이지의 "이동 유형" 설정이 완전히 무시된다.** 무작위·접근·추적·사용자 지정 경로·생활 이동 모두 해당된다.
  - 프로브: `time system ON + schedule: page movement registration is skipped entirely` — `autonomousNPCs.has("npc") === false`, `pageMoveRouteEventIds.size === 0` (movement.type="random" 인데도).
  - 프로브: `time system ON + schedule: living movement is skipped too` — 동일하게 무버 없음.
- 그 NPC 의 유일한 움직임 소스는 `updateNpcSchedules`(PlayScene.ts:232 초기 1회, PlayScene.ts:287 매 프레임)이다. 여기서 등록되는 무버는 페이지 설정을 무시한 고정값이다: `configureScheduleMover`(npcSchedules.ts:143-150) → strategy `sequence`, speedRank 4, frequencyRank 8, interval 80ms.
  - 프로브: `schedule mover ignores page movement speed/frequency` — 페이지 speed=1/frequency=1 인데 무버는 speedRank 4 / frequencyRank 8 / interval 80.
- **"이동 유형을 무작위로 줘도 안 움직이는" 사례가 정확히 여기서 발생한다.** 두 가지 경로로 완전 정지한다.
  1. 현재 시각에 매칭되는 일정 행이 없을 때: `npcScheduleTargetForEvent` 가 `matched:false` 인 **원점 복귀 타깃**을 반환한다(`src/project/npcSchedule.ts:37-45`, key = `origin:<mapId>:<x>,<y>`). NPC 가 이미 원점에 있으면 경로가 0 이므로 무버가 생기지 않고, 페이지 이동은 위 `continue` 로 막혀 있으므로 NPC 는 영구히 제자리에 붙는다.
     - 프로브: `time system ON + non-matching schedule row: NPC is pinned to its origin and random movement never registers` — `pageMoveRouteEventIds.size === 0`, 무버 없음, `npcScheduleStates.npc.routeKey === "origin:map_start:1,1"`.
  2. 매칭되는 행이 있고 목적지에 이미 도착한 뒤: `applyNpcScheduleTarget` 이 facing 만 맞추고 반환하므로(npcSchedules.ts:88-95) 그 이후에도 배회하지 않는다. 조건이 바뀔 때까지 정지 상태가 유지된다.
- 반대로 시간 시스템이 켜져 있고 일정이 **비어 있으면** 가드의 오른쪽이 falsy → 페이지 이동은 정상 동작한다. 즉 이 버그의 트리거는 "시간 시스템 ON + 일정 행 ≥ 1" 조합이며, 편집기에서 "+ 일정 추가" 를 한 번 눌러 조건 없는 빈 행을 만든 뒤 목적지를 원점 그대로 두면 그 NPC 는 완전히 얼어붙는다(빈 행은 항상 매칭되어 원점=목적지 경로 0). 편집기에는 이 상호작용을 알리는 문구가 없다 — 일정 편집기 도움말은 "시간대별 이동 일정을 추가할 수 있습니다"뿐이다(eventScheduleEditor.ts:28-30).

## 3. 일정 행 조건의 kind 별 런타임 평가

| 조건 kind | 편집기 | 스키마 | 런타임 평가 | 판정 |
|---|---|---|---|---|
| timePhase | O (eventScheduleEditor.ts:66-70) | `NpcScheduleWhen.timePhase` (types/events.ts:434) | `npcSchedule.ts:60` + `gameTime.ts:127-133` | PASS |
| hourRange | O (eventScheduleEditor.ts:71-75) | types/events.ts:435 | `npcSchedule.ts:63,67-73` | PASS (start===end 는 항상 false — 편집기 경고 없음) |
| season | O (eventScheduleEditor.ts:76-80) | types/events.ts:436 | `npcSchedule.ts:61` | PASS |
| dayRange | O (eventScheduleEditor.ts:81-85) | types/events.ts:437 | `npcSchedule.ts:62,75-79` | PASS (daysPerSeason 초과 값 검증 없음) |
| 요일 | X | X | X | 미지원(의도적, types/events.ts:447 주석) |
| 날씨 | X | X | X | 미지원 |
| 스위치/변수/호감도 | X | X | X | 미지원 (페이지 조건과 달리 일정 행에는 없음) |

부수 사실: 조건이 하나도 없는 행(`when: {}`)은 `npcScheduleWhenMatches` 가 무조건 true 를 반환하므로(npcSchedule.ts:58-64) 항상 첫 매칭이 되어 뒤 행을 가린다. 편집기가 경고를 띄운다(eventScheduleEditor.ts:166-172) — 경고와 런타임 동작이 일치한다.

## 4. 생활 이동의 런타임 소비 정리

- 목적지 맵/좌표: **소비됨** (`npcLivingTravel.ts:45-52`, 크로스맵은 :55-79). BFS 는 `canMove` 기반이라 통행 불가 목적지면 경로 길이 0 → 조용히 아무것도 안 한다(`:50-51`). 편집기는 목적지 통행 가능성을 검증하지 않는다.
- 반복(`living.repeat`): 코드 경로는 존재하나(`:49`, `:97-104`) 편집기가 목적지를 1개로 고정하므로 관측 가능한 효과가 없다.
- 맵 연결(`mapConnections`) + `npcEnabled`: **소비됨** (`:110`). npcEnabled=false 면 경로 자체가 없어 NPC 가 안전하게 원래 맵에 머문다(test/runtimeNpcLivingTravel.test.ts:61-87).
- 목적지 `direction`: 소비처 없음(3-1 표 참조). 연결의 `direction` 은 소비되지만 편집기가 "down" 으로 고정.
- 진행 상태는 `session.npcTravelStates` 에 저장되고 세이브/로드로 보존된다(test/runtimeNpcLivingTravel.test.ts:89-107).
- **단, 같은 이벤트에 일정 행이 있고 시간 시스템이 켜져 있으면 생활 이동은 위 2-2 가드로 전부 무효화된다.**

## 5. 제안 최소 수정 (실제 수정은 하지 않았다)

1. `src/player/playScenePageMoveRoutes.ts:31` — 일정이 "현재 매칭 중"일 때만 페이지 이동을 양보하도록 좁힌다. 예: `const scheduleTarget = resolveTimeSystem(project) ? npcScheduleTargetForEvent(scene.map.id, view.event, scene.session.gameTime) : null;` 후 `if (scheduleTarget?.matched) continue;` — 매칭 행이 없는 시간대에는 무작위/추적 이동이 살아난다.
2. `src/editor/panels/eventEditor/eventScheduleEditor.ts:28-30` — 도움말에 상호작용을 명시한다: 시간 시스템이 꺼져 있으면 일정이 무시되고, 켜져 있으면 이 이벤트의 "이동 유형" 설정이 무시된다는 두 문장을 추가(가능하면 `resolveTimeSystem(store.getCurrent())` 로 분기).
3. `src/editor/panels/eventEditor/pageNpcLiving.ts:36-42` — 목적지 배열을 덮어쓰지 말고 기존 배열의 0번만 교체(`destinations: [next, ...(page.movement.living?.destinations.slice(1) ?? [])]`). 최소한 툴/AI 가 만든 다중 목적지를 편집기가 지우지 않게 되고, `repeat` 이 실제 의미를 갖는다.
4. `src/editor/panels/eventEditor/pageNpcLiving.ts:27` 또는 `src/player/npcLivingTravel.ts:46-52` — 둘 중 하나로 정합을 맞춘다: (a) 같은 맵 도착 시 `destination.direction` 을 facing 으로 적용하는 3줄을 런타임에 추가, 또는 (b) 소비되지 않는 "방향" 셀렉트를 제거.
5. `src/editor/panels/eventEditor/pageNpcLiving.ts:94-95` — 하드코딩된 `direction: "down"` 대신 연결 방향 셀렉트 값을 쓰거나, 최소한 목적지 방향(`targetDirection.value`)을 `to.direction` 에 전달한다.
6. `src/project/friendship.ts:176` — 시간 시스템이 없을 때 `giftDayKey` 가 `"no-time"` 로 고정되어 대화 보너스가 세션당 1회로 굳는 문제. 시간 없는 프로젝트에서는 맵 이동/세이브 단위 등 별도 카운터를 쓰거나, 편집기 체크박스에 "시간 시스템 필요" 힌트를 붙인다.
7. `src/editor/eventDraftValidator.ts:266-290` — 일정 행 검증에 두 가지 경고 추가: `hourRange[0] === hourRange[1]`(영원히 매칭 안 됨), `dayRange` 가 `daysPerSeason` 초과.

## 6. 검증 출력

지정된 VERIFY 명령:

```
$ cd /home/main/z-project/rpg-zzu-event-page-props && node scripts/run-vitest.mjs run test/npcSchedule.test.ts test/runtimeNpcLivingTravel.test.ts --configLoader bundle

 RUN  v3.2.4 /home/main/z-project/rpg-zzu-event-page-props

 ✓ test/runtimeNpcLivingTravel.test.ts (4 tests) 1257ms
   ✓ runtime NPC living map travel > routes an NPC through map connections to a living destination on another map  600ms
   ✓ runtime NPC living map travel > keeps living NPCs safe when no NPC-enabled map connection exists  434ms
 ✓ test/npcSchedule.test.ts (8 tests) 1810ms
   ✓ NPC schedule runtime > keeps a schedule route paused during dialogue-like waits and resumes afterward  430ms
   ✓ NPC schedule run_scene_test integration > moves villagers between work and home and branches dialogue by npcActivity  301ms

 Test Files  2 passed (2)
      Tests  12 passed (12)
   Start at  03:28:37
   Duration  31.32s (transform 17.30s, setup 0ms, collect 50.23s, tests 3.07s, environment 1ms, prepare 1.94s)
(exit=0)
```

조사용 프로브(`test/_probe-schedule.test.ts`, 이 노드가 2개 케이스를 추가):

```
$ node scripts/run-vitest.mjs run test/_probe-schedule.test.ts --configLoader bundle

 ✓ test/_probe-schedule.test.ts (8 tests) 2805ms
   ✓ probe: schedule vs page movement registration > time system OFF: schedule is inert and page movement (random) still registers  753ms
   ✓ probe: schedule vs page movement registration > time system ON + schedule: page movement registration is skipped entirely  307ms
   ✓ probe: schedule vs page movement registration > time system ON + schedule: living movement is skipped too  324ms
   ✓ probe: living movement fields > destination switchId gates the destination (runtime-only field)  369ms
   ✓ probe: living movement fields > repeat only changes anything with 2+ destinations  412ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
(exit=0)
```

프로브 8케이스 전체 목록(리포터가 빠른 케이스는 생략 출력): 위 5개 + `time system ON + non-matching schedule row: NPC is pinned to its origin and random movement never registers`, `schedule mover ignores page movement speed/frequency`, `living destination direction is not applied on same-map arrival`.

## 7. UNKNOWN (읽지 않아 확정 못 한 것)

- `connection.playerEnabled` 의 플레이어 통행 소비처(본 감사 범위 밖 파일).
- 브라우저에서 레일 그룹 `npc` 가 실제로 열리고 두 노드가 보이는지 — DOM 렌더는 `appendEventRailGroup`(pageProps.ts:741-751) 코드로만 확인했고 dev 서버 재현은 하지 않았다.
- `sceneTestRunner` 의 일정 시뮬레이션(`src/testing/sceneTestRunner.ts:1041-1070`)이 실제 `updateNpcSchedules` 와 완전히 동일한지 — 별도 구현이라 차이 여부는 확인하지 않았다.
