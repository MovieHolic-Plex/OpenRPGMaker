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
가구 그림은 이벤트에 지정하고 아래 타일은 비운다. 정적 의자 타일에 속성을 붙이는 기능은 아니다.
물체 동작은 일반 조사 명령보다 우선한다. 기존 명령이 있으면 정적 검사가 경고한다.

## 데이터와 런타임

- `EventPage.movement.pursuit?: {scope, doorDelayMs, searchMs, onLost}`.
- `EventPage.interaction?: {kind: pushable|hiding, directions?: Dir[]}`.
- 필드는 선택적이다. 이전 데이터에 자동으로 추격/물체 기능을 켜지 않는다.
  `shapeEventFields.ts`가 새 필드의 enum과 유한한 시간 범위를 검증한다.
- `session.eventLocations`가 가구와 이동한 추격자의 실제 위치를 소유한다.
  `session.horror`가 추격 활성·수색·문 대기열·은신 및 목격자 목록을 보존한다.
  `saveSlots.ts`의 생성·파싱·복원 경로와 `isHorrorState` 검증을 모두 연결했다.
- `horrorRuntime.ts`: 밀기 충돌, 시야, 은신, 문 이동 대기. 실제 `transferTo`에서
  출발 맵의 괴물 상태를 넘기며 `updatePlayScene`에서 게임 시간으로 대기를 진행한다.
  메뉴·게임 오버에서는 진행하지 않는다. 연결 방 추격은 실제 전이의 발자취를 따른다.
- 한 칸 밀기이며 연쇄 밀기·당기기는 지원하지 않는다. 막힌 칸/다른 이벤트로 밀 수 없다.
- 추격 경로는 동적 이벤트의 점유를 고려한다. 문까지 경로가 막혔으면 전이를 예약하지 않는다.
  도착 칸이 막혀 있으면 대기한다. 맵마다 괴물을 복제하지 않고 기존 runtime event view를 사용한다.
- 복귀는 현재 방의 시작/진입 위치까지다. 원래 방까지 역으로 돌아가는 장거리 귀환은 범위 밖이다.

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
프로브는 준비/재로드된 Supabase 스냅샷을 읽기만 한다. `furniture-push-before`/`furniture-push-after`의
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
- `scripts/revise-night-monster.mts --read`: 현재 Supabase 게임 확인.
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
