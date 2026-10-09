> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# 공포 게임 제작 — 추격·가구·은신

2026-09-05 밤의 괴물 체험 QA에서 발견한 결함을 공용 제작 기능으로 반영했다.
게임별 이벤트를 복제하지 않고, 편집기가 저작하는 페이지 속성과 런타임 세션을 연결한다.

## 저작 표면

이벤트 편집기 → **움직임과 속도**:

- 이동 유형 **추격**: 현재 맵 / 문으로 연결된 방, 문 통과 대기(초), 놓친 뒤 수색(초),
  수색 종료 후 대기 / 이 방의 진입 위치로 복귀.
- 물체 상호작용 **밀 수 있는 가구**: 허용 방향, 정지·조사·같은 층·겹침 금지를 함께 설정.
- **은신처**: 조사 키로 들어가고 나오기. 이동은 멈추고 캐릭터를 숨긴다.
  들어가는 모습을 본 괴물은 계속 추격하므로 벽·가구 뒤에서 먼저 시야를 끊어야 한다.

`pageHorror.ts`는 기존 `updateEventPage` 경로를 사용하므로 초안·취소·적용·편집 감사 로그를 공유한다.
AI도 `make_chase_scene.pursuit`와 `configure_object_behavior`로 같은 페이지 필드를 저작한다.
학교 호러 프리셋 지시(`HORROR_CHASE_AUTHORING_GUIDE`)는 방을 `place_concept`로, 은신을 옷장과 같은 칸의 `hidingSpots`로, 숫자 암호를 `compile_puzzle` `password`(inputNumber)로 만든다. 추격 스위치를 꺼서 숨는 척을 하거나 선택지 보기에 암호 숫자를 적지 않는다.
가구 그림은 이벤트에 지정하고 아래 타일은 비운다. 정적 의자 타일에 속성을 붙이는 기능은 아니다.
물체 동작은 일반 조사 명령보다 우선한다. 기존 명령이 있으면 정적 검사가 경고한다.

## 데이터와 런타임

- `EventPage.movement.pursuit?: {scope, doorDelayMs, searchMs, onLost, tracking?}`.
- `EventPage.interaction?: {kind: pushable|hiding, directions?: Dir[]}`.
- 필드는 선택적이다. 이전 데이터에 자동으로 추격/물체 기능을 켜지 않는다.
  `shapeEventFields.ts`가 새 필드의 enum과 유한한 시간 범위를 검증한다.
- `session.eventLocations`가 가구와 이동한 추격자의 실제 위치를 소유한다.
  `session.horror`가 추격 활성·수색·문 대기열·은신 및 목격자 목록을 보존한다.
  `saveSlots.ts`의 생성·파싱·복원 경로와 `isHorrorState` 검증을 모두 연결했다.
- `horrorRuntime.ts`: 밀기 충돌, 시야, 은신 및 추적 대상. 문 대기열은 `pursuitDoors.ts`, 공통 통행·수색은 `pursuitNavigation.ts`. 실제 `transferTo`에서
  출발 맵의 괴물 상태를 넘기며 `updatePlayScene`에서 게임 시간으로 대기를 진행한다.
  메뉴·게임 오버에서는 진행하지 않는다. 연결 방 추격은 실제 전이의 발자취를 따른다.
- 한 칸 밀기이며 연쇄 밀기·당기기는 지원하지 않는다. 막힌 칸/다른 이벤트로 밀 수 없다.
- 추격 경로는 동적 이벤트의 점유를 고려한다. 문까지 경로가 막혔으면 전이를 예약하지 않는다.
  도착 칸이 막혀 있으면 대기한다. 맵마다 괴물을 복제하지 않고 기존 runtime event view를 사용한다.
- 복귀는 현재 방의 시작/진입 위치까지다. 원래 방까지 역으로 돌아가는 장거리 귀환은 범위 밖이다.

## 연결 방 추격 연속성 (2026-09-06)

- `tracking` 생략/`lastSeen`은 마지막 목격 위치로 간 뒤 맨해튼 반경 2의 도달 가능한 칸을
  결정적 순서로 수색한다. `persistent`는 한 번 발견한 플레이어의 현재 위치를 시야가 끊겨도
  추적하지만 은신·안전 구역은 이 정책을 중단한다. 미목격 은신은 새 표적이 아니며,
  목격한 은신 진입의 기존 포획 규칙은 유지한다. 추격 속성 없는 구버전 chase는 바꾸지 않는다.
  편집기의 「놓친 뒤 추적」에서 마지막 목격 수색/현재 위치 추적을 선택한다.
- 수색 제한 시간은 이동 보간 중에도 허용된 업데이트마다 한 번 증가한다. `searchTarget`과
  `searchCursor`(0~11)는 `session.horror.pursuits`에 선택적으로 저장한다. 대상·수색 단계가
  바뀌면 임시 경로 캐시를 버리고, 수색 종료 후 기존 wait/현재 방 진입점 return을 따른다.
  손상된 선택 수색 필드는 세이브를 거부하며 추격 상태만 조용히 지우지 않는다.
- 수색 유예가 남아 있으면 문 추적을 예약할 수 있다. 각 이동 칸은 보행 시간과 저작 간격을
  모두 포함하고 첫 구간은 남은 idle 간격 또는 진행 중 보간 시간을 반영한다. 연속 전이도
  같은 footprint/passRows·동적 이벤트·공간 배치 충돌을 검사한다. 대기열 상한은 64다.
- 한 프레임의 남은 시간은 이미 예약된 다음 구간에만 이월한다. 막힌 도착점에서는 기다리되
  그 프레임의 남은 시간을 버려 문이 열린 뒤 누적 시간으로 여러 방을 순간 통과하지 않는다.
- `project/runtimeMap.ts`가 로드된 맵 적용과 미로드 목적지 조회의 타일 오버라이드를 공유한다.
  로드된 맵은 `applyRuntimeMapOverrides`로 객체와 타일 배열의 동일성을 유지하여 제자리 갱신한다.
  시간표·통행 성분 소비자가 보관한 참조를 끊으면 문 개폐를 보지 못한다. 미로드 조회만 복사본을 만든다.
  저작 배열은 변경하지 않으며, 미로드 맵에는 현재 맵의 `eventPositions`를 넘기지 않는다.
  실제 `transferTo`는 목적지 런타임 타일과 플레이어 통행 사각으로 최종 착지점을 먼저 구하고
  그 좌표를 추격 대기열과 플레이어 양쪽에 사용한다.
- 계약 테스트: `npcPursuitRegression.test.ts`, `npcPursuitBoundaries.test.ts`,
  `horrorObjectRuntime.test.ts`, `playerFootprint.test.ts`의 실제 transfer 착지 회귀.
  출하 플레이어 브라우저 승인은 별도이며 단위 테스트 통과로 대체하지 않는다.

## NPC 발견 이벤트와 공통 전투 소유권 (2026-09-06)

- `movement.sight?: {range, lineOfSight, facing}`와 `EventPage.detectionEncounter?`는 선택 필드다.
  발견 이벤트는 `{sight, emote: EmoteKind|null, emoteMs, approachSpeed}`를 가진다.
  거리(0~999), 대기(ms, 0~60000), 접근 속도(1~8)는 정수이며 JSON 경계에서 검증한다.
  `forward`는 현재 런타임 방향의 같은 행/열 직선이다. 원뿔 시야가 아니다.
  LOS는 모서리에 닿는 타일, 이벤트 통행 사각, 공간 배치를 포함한다(`npcPerception.ts`).
- 새로 추격을 선택하면 거리 8/LOS/모든 방향과 맵 범위/1200ms/4000ms/대기를 명시한다.
  기존 chase를 열거나 빈도만 바꿔도 현대 정책을 자동 추가하지 않는다. 정책 없는 페이지는
  기존 동작과 명시적 활성화 버튼을 보여 준다. `normalizeEventPage`는 저작 sight를 보존한다.
- 「움직임과 속도 → 플레이어 발견」은 정지 페이지에도 제공한다. 활성화 기본값은
  거리 6/LOS/정면 직선/느낌표/600ms/속도 4다. 대기 입력은 ms, 문 대기는 기존 초 단위다.
  `pageNpcBehavior.ts`/`pageHorror.ts`는 기존 label/input/select와 `updateEventPage`만 사용하여
  드래프트 적용·취소와 감사 로그를 공유한다. 전투를 자동 생성하지 않고 페이지 명령을 실행한다.
  자동·병렬 트리거 또는 밀기/은신 상호작용과 발견 이벤트를 함께 저작할 수는 없다.
  JSON 경계가 이 조합을 거부하고 편집기는 새 활성화를 막는다. 이미 켠 뒤 트리거를 바꿨으면
  발견 설정을 해제하여 충돌을 해결할 수 있다.
- `updatePlayScene`은 입력·자율 이동 전에 `npcDetectionEncounter.ts`를 호출한다. 처음 감지한
  활성 이벤트 하나가 즉시 foreground/input을 잡고, 표시→실제 경로 이동→인접 확인→명령 순서로
  진행한다. 멀리서 전투하거나 순간이동하지 않는다. 길이 막히면 실행/완료 기록 없이 해제하고,
  시야를 벗어났다 다시 들어와야 재시도한다. 은신 중인 플레이어를 새로 감지하지 않는다.
  기존 컷신 입력 잠금과 해당 NPC의 명령 이동 루트 소유권이 있으면 새 발견 실행을 시작하지 않는다.
- 정상 종료한 이벤트/페이지는 선택적 `session.detectionEncounterCompletions[eventId][pageId]=true`
  영수증으로 기록한다. 생성·JSON 파싱·복원을 모두 거치며 다른 값의 영수증은 거부한다.
  이 이름이 저장 계약의 정본이다(`detectionEncounters`가 아님). 임의 문자열 ID를 허용하며
  constructor/prototype/__proto__ 같은 키도 own-property와 정확한 true 판정으로 읽고 쓴다.
  저장 중 접근/전투는 완료가 아니므로 재개 시 다시 감지할 수 있다. 임시 소유 토큰은 저장하지 않는다.
  발견 설정이 있는 페이지를 조사/접촉으로 먼저 실행해도 같은 완료 영수증을 남긴다.
  수동 전투 후 자동 감지로 같은 전투를 다시 거는 일을 막으며, 명시적인 수동 재조사는 기존처럼 허용한다.
- `foregroundControl.ts`의 토큰이 늦은 finally가 다른 실행자의 입력을 해제하지 못하게 한다.
  페이지 비활성화, 세션/맵 교체, shutdown은 접근을 취소한다. 이동은 기존 pathfinding/tween을
  사용하고 일반 action/contact, 생활 이동, 진영 추격의 기본 소유 경로는 유지한다.
  단, 인접 확인 후 명령 실행이 시작되면 원래 목록이 소유권을 유지한다. 저작 셀프 스위치로
  페이지가 바뀌거나 transfer로 이동해도 남은 명령을 실행하고 원래 이벤트/페이지의 완료를 기록한다.
  발견 목록만 continueAfterTransfer를 사용하며 기존 인터프리터 호출자의 전이 종료 기본값은 유지한다.
  전이 명령은 시작 전에 목적지를 한정해 승인하고, 완료 시 소유 맵 객체를 확정한 뒤 승인을 해제한다.
  외부 맵 교체는 같은 ID의 새 객체여도 진행 중 명령과 그 소유 대화를 취소한다.
  늦은 비동기 해제는 토큰·세션·맵도 같을 때만 입력을 복구한다.
  shutdown과 세션 교체는 진행 중 명령의 결과를 무효화한다.
- `commandBattle.ts`는 일반 인터프리터와 병렬 스케줄러의 실제 전투 경로를 공유한다.
  병렬 프로세스는 foreground가 비면 `scene.playBattle`을 호출하고 승패를 기다린 후 같은
  인터프리터를 재개한다. 변수 troop, 결과 분기, 셀프 스위치, 패배 허용 정책을 전달하며
  overlay-only 실행이나 프로세스 재시작을 하지 않는다. `branchOnResult:true`가 분기를 활성화한다.
  페이지가 없는 레거시 이벤트는 `legacy` 식별자와 루트 조건을 일관되게 판정한다.
  페이지가 있지만 조건에 맞는 페이지가 없는 이벤트는 레거시로 되돌려 실행하지 않는다.
- 실제 `playSceneBattle`도 소유 세션/맵/페이지/프로세스와 shutdown을 확인한다. 전환 중 취소하면
  전투 UI와 전환을 정리하고 낡은 결과로 새 세션에 보상·오디오·포획 상태를 쓰지 않는다.
- 회귀: `npcTrainerEncounter`, `npcBehaviorAuthoring`, `npcScheduledBattle`, `npcEncounterBoundaries`,
  `npcBattleLifecycle`, `npcEncounterOwnershipBoundaries`. 늦은 해제 검증은 전체 체인의 마지막
  lease.release 호출 뒤를 관찰하며 임의 마이크로태스크 횟수에 의존하지 않는다. 프레임·인터프리터·경로·저장 경계는 실제 모듈이며 브라우저 승인은 별도다.
- 브라우저 재현: `node scripts/qa/npc-behavior.mjs --scenario pursuit|trainer|editor`.
  각 이름을 하나씩 지정하며 결과는 `output/evidence/npc-behavior/<이름>/SUMMARY.md`부터 읽는다.
  게임은 출하 별칭을 쓰는 `player.html`, 편집기는 별도 서버의 실제 모달을 사용한다.
  이 스크립트는 최소 엔진 픽스처만 사용하고 원격 프로젝트에 저장하지 않는다.
  `ERR_NETWORK_CHANGED`가 반복되는 호스트의 `--relay`는 실제 로컬 Vite 응답을
  Playwright HTTP 요청으로 전달한다. `NPC_QA_ROOT`로 검증할 워크트리를 명시할 수 있다.
  고정 sleep 없이 DOM/렌더 신호를 먼저 구독하며, 보고서에 입력·상태·스크린샷·trace와
  컨텍스트/서버/포트 정리 증거를 함께 남긴다. 음악은 맵의 정식 `bgm.mode="none"`으로 끄고,
  편집기에서는 개발용 AI 브리지·디스크 미러만 비활성화한다. 게임 동작과 요청 오류는 대역 처리하지 않는다.

## 가구 밀기 애니메이션 (2026-09-05 후속 체험 수정)

`playSceneMovement.tryStartFurniturePush`가 방향키와 조사 키의 공통 진입점이다.
플레이어가 들어갈 칸과 가구의 목적지를 모두 검사한 뒤 두 물체를 같은 한 칸 이동으로 시작한다.
대각 밀기는 거부하며, 이동 중 누른 조사 키를 다음 밀기로 예약하지 않는다.
`furniturePushAnimation.ts`는 장면별 WeakMap에 표현 상태만 보관한다. 기본 보행에서는
19 논리 틱(약 317ms): 처음 2틱은 힘주기 대기, 나머지는 두 물체가 같은 smoothstep 곡선으로
가속·감속한다. 느린 이동 설정은 `max(320ms, moveDurationMs × 2)`를 60Hz 틱으로 양자화한다.
대시는 밀기를 가속하지 않는다. 플레이어는 느린 걷기 패턴을 사용하고 가구의 그림·방향은 유지한다.

밀기마다 전체 이벤트를 재생성하지 않는다. 기존 스프라이트의 위치와 깊이만 갱신한다.
다른 이벤트 때문에 재렌더가 일어나도 `renderEvents`는 진행 중인 가구의 보간 위치를 사용한다.
가구의 도착 칸은 기존 `session.eventLocations` 계약대로 시작 시 예약하고, 출발 발자국도
이동 종료까지 NPC 충돌에서 예약한다. 메뉴는 두 물체를 함께 멈춘다. 이동 명령 취소는 가구도
출발점으로 되돌리고, 맵 로드/세이브 복원은 표현 상태를 버린다. 이동 도중 저장하면 기존 보행과
동일하게 플레이어는 출발 칸, 가구는 예약된 도착 칸으로 복원한다. 소수 좌표는 저장하지 않는다.

검증은 `runtimeMovementStability.test.ts`의 4방향·두 입력·중간 좌표·주사율·메뉴·재렌더·취소·맵 리셋·
저장 계약과 `scripts/qa/runtime/furniture-push.probe.mjs`의 출하 플레이어 연속 프레임을 사용한다.
프로브는 준비/재로드된 LegacyDb 스냅샷을 읽기만 한다. `furniture-push-before`/`furniture-push-after`의
`SUMMARY.md`를 먼저 읽고 `motion-sheet.png`에서 중간 프레임과 접촉 간격을 확인한다.
이전 `night-monster-upgrade` 프로브의 이동 전후 두 장만으로는 애니메이션 품질을 검증할 수 없다.

## 실내 제작과 검증

기존 `rooms`, `innerDoors`, 공간별 테마를 먼저 쓰도록 실내 도구 설명을 보강했다.
`evaluate_interior_room` 결과에 `reviewScope=structure-and-walkability`, `visualReview=required`,
시각 체크리스트를 반환한다. 실행·통행 점수를 시각 품질 합격으로 사용하지 않는다.

`lintHorrorAuthoring`은 기존 `projectLint`와 에디터 검증 패널을 통해 다음을 **경고**한다:
물체 그림 누락/바닥 충돌/설정 불일치/일반 명령 가림, 영속 이벤트 ID 중복,
서로 다른 조사물의 같은 그림, 실내 바닥 한가운데 출입구, 큰 실내의 단일 방 설계.
의도적 배치를 금지하거나 미적 품질을 자동 확정하는 규칙은 아니다.

## 검증 경로

- `test/horrorObjectRuntime.test.ts`: 프로젝트 왕복, 세이브 저장·읽기·복원, 밀기 충돌과 방향,
  목격/미목격 은신, 문 대기·연속 전이·소거 및 구버전 호환.
- `scripts/capture-horror-authoring.mjs`: 실제 에디터에서 추격 설정 변경·저장·재열기,
  가구 방향 선택, 은신 옵션, 1440/1024 화면 확인. QA UI 세션은 원격 저장을 하지 않는다.
- `scripts/qa/runtime/night-monster-upgrade.probe.mjs`: 전용 `player.html`에서 실제 이동과
  상호작용, 문 통과→은신→추격자 진입→수색 종료. 복도는 달리기 입력, 지하실은 기존
  `playerRoute`의 일반 보행(충돌·시간 진행 유지)으로 재현한다. `SUMMARY.md`를 먼저 읽고 PNG를 연다.
- `scripts/revise-night-monster.mts --read`: 현재 LegacyDb 게임 확인.
  인자 없음은 현재 게임의 개정본 준비, `--save`는 저장과 재로드 비교까지 실행한다.
  제작 중 원격 값이 바뀌면 저장을 중단한다. 기존 DB·스킨·에셋은 보존한다.


## 전체 게이트 후속 수정 (2026-09-05)

전체 실행에서 새 도구의 활동 문구 등록 누락과 malformed `page.commands` 순회 예외를 찾았다.
`aiActivityNarration.ts`의 이벤트 패밀리에 `configure_object_behavior`를 등록한다.
실내 경고 검사는 명령 배열이 아닌 값을 빈 명령 목록으로 다루며, 기존 `command-shape` 경고를
보존한다. 오류 데이터를 검증하는 과정 자체가 예외로 중단되면 안 된다.
`eventEditorShellSurface.baseline.json`은 브라우저로 검토한 물체 상호작용 컨트롤의 추가만 반영했다.
검증: `aiActivityNarration.test.ts`, `projectLint.test.ts`, `eventEditorShellSurface.baseline.test.ts`와
기존 공포 런타임/세이브 계약. 통합된 main 위에서도 관련 80개와 앱 타입 검사가 통과했다.

- 가구 밀기 QA (`furniture-push.probe.mjs`)는 부하가 큰 호스트에서 실제 종료 좌표까지 최대 10초 기다린다. 중간 프레임 수·16px 접촉 간격·정확한 종료 좌표·가구 프레임 고정 assertion은 유지한다. 기준선 촬영은 기존 900ms다.
