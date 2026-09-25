# 연결 구조부터 만드는 던전 생성기

2026-09-14. 사용자에게 승인받은 수작업 던전의 원칙을 에디터 도구에 연결한다. 특정 네 맵 좌표를 기본 템플릿으로 내장하지 않는다.

## 진입과 호환성

- `run_dungeon_room_pipeline`, `start_dungeon_room_session`: 새 요청은 기본 48×40, `layout: connected`. 18×18 미만은 기존 single-room. 기존 저장 플랜에서 layout 생략과 `demo`는 종전 단일 방 규칙을 유지한다.
- `generate_map(theme: cave)`: entrance/pois가 생략되고 기존 dungeon 칩셋을 선택했거나 tilesetId를 생략하면 18×18 이상에서 같은 연결 생성기를 호출한다. `dungeonDesign`으로 character/seed/graph를 전달한다. 좌표 entrance/pois 지정, 명시 border wall, 다른 칩셋은 기존 계약을 유지한다. 지원하지 않는 조합의 dungeonDesign은 무시하지 않고 거절한다.
- 기존 id는 기존 교체 가드를 따른다. 이미 던전 지형 그룹이 시드된 칩셋은 ensureDungeonRoomHarness에서 메타데이터 팩을 재적용하지 않는다. 기존 코드가 통행·priority를 초기값으로 되돌리던 문제를 막는다. 새 도구는 공유 타일셋의 사용자 통행 규칙을 고쳐 결과를 강제로 통과시키지 않는다. 실제 통행 메타데이터가 맞지 않으면 평가가 실패한다.
- `evaluate_dungeon_room(mapId)`는 원샷 생성/재로드 후 `roomHarnessPlan`으로 평가한다. 기존 sessionId도 지원한다.
- 집 내부는 기존 `place_concept` / `interiorPlan` / interior kit 경로를 유지한다. 연결 설계라는 원칙은 유사하지만 동굴 마스크·절벽 로직을 집 안에 적용하지 않는다. 공유 roomHarness engine의 실내 동작은 바꾸지 않았다.

## 소유 모듈

- `src/editor/dungeonGeneration/topology.ts`: 칩셋과 독립적인 방 역할·중심·크기·연결·중간 경유점. 그래프 검증, seed 결정성, 방 간 거리 기반 연결 트리와 추가 우회 링크, 동굴 윤곽과 가변 폭 통로 마스크.
- `terrain.ts`: 바닥/천장 재질, 최단 통행 경로, 원시 칩셋 복합 절벽과 평평한 양끝 연결, 판자 통행로, 기존 canonical ice ridge. 복합 절벽이 방을 단절하면 평평한 다른 팔에 통행로를 추가하고, 그래도 연결되지 않으면 해당 지형은 적용하지 않는다. 작은 방에 큰 절벽을 강제로 넣지 않는다.
- `rail.ts`: 방향·직진 길이를 상태로 한 A* 탐색, 최소 3칸 직진과 회전 비용. 입구와 작업장 하나를 잇는 운반선이다. 검증된 native 코너/직선만 사용하고 미확인 분기 조각은 만들지 않는다.
- `connected.ts`: ceiling→wall→floor→hazard의 기존 단계 계약에 위 기능을 연결한다. room-role·벽 거리·군락 간격으로 완성 소품 조립을 배치하고, 실제 연결 경로와 모든 판자 통행로의 앞뒤 착지를 장식 전에 예약한다. 평가에서 방 도달성·프로젝트 실제 충돌·벽 지지·멀티타일 소품·절벽 조각·철로 지지를 검사한다. 검사 통과는 미관 합격을 뜻하지 않는다.
- `dungeonDesignSchema.ts`: 모델에 공개할 설계 인자. raw 타일 번호가 아닌 역할·공간을 받는다.

## 설계 입력

`character`: cavern / mine / crystal / crypt. `theme`: stone / lava / ice.
lava(crypt 제외, `lava.ts`)는 문서 `tiledata/rpg-dungeons/dungeon-lava-cave.md`의 칸을 쓴다: 적암 바닥 301·벽 133/163, 가장 큰 방을 가로지르는 불의 강 하나(다리 자리만 곧게 3줄, 판자 다리 upper 141)와 방마다 불규칙한 용암 웅덩이(오토타일 몸통 304, 통행 불가), 갈색 바위·화로·바닥 불길. 수정 방·여신상 없음, `landmark: altar`는 제단 마법진(3×3). stone·ice·crypt 결과는 그대로다.
`path`: straight / cave / winding. 조수가 세계관과 이번 요청으로 정한다. 생략하면 crypt만 곧은 방이고 그 외는 동굴 실루엣이다. straight는 직사각형 방과 좁은 곧은 길, cave는 방 경계가 녹는 공동, winding은 방은 직사각형으로 남기고 길만 꺾는다.

`linkMapId`가 있고 그 맵이 프로젝트에 있으면 던전 입구와 양방향 전이를 놓는다. `landmark`(altar/tower/gate/sound)는 입구에서 가장 먼 방 옆의 열린 칸에 표지를 찍는다. `pressure`의 patrol은 `troopId`가 실제 트룹일 때만 순찰 스폰을 두고, tide와 rising은 입구 옆에서 배회하는 사건으로 둔다.

`graph.rooms`: id, role(entrance/chamber/crystal/worksite/shrine/storage/collapse), x/y 중심, width/height.
`graph.connections`: from/to 방 id, width(6–16), 선택 via 좌표 배열. 모든 방은 연결되어야 한다. 최대 32개 방과 64개 연결.

사용자가 지정한 graph는 보존한다. 생략하면 seed로 생성한 실제 graph를 플랜에 저장한다. 같은 설계·seed는 동일 타일 결과를 낸다. 자연 방에만 완만한 공간 잡음을 사용하고 crypt의 인공 방은 직선을 유지한다. 시드 생성은 레벨 디자인의 출발점이며 역할/연결을 직접 저작할 수 있다. 방 크기는 걸어 다닐 크기(대략 9–18칸)로 두고, 맵이 커지면 방을 늘린다. 가로 160·세로 110을 넘으면 최대 6×5, 방 수는 32를 넘기지 않는다. 한가운데 방을 맵 크기에 비례해 키우지 않는다.

## 검증 및 증거

- `test/connectedDungeonGeneration.test.ts`: 세 테마×여러 시드의 실통행, 사용자 타일 규칙 보존, 명시 graph·복합 절벽, 같은 seed 결정성/다른 seed 다양성, 단계별/원샷 동일 결과, serialize/load 후 재평가, 잘못된 연결 거절, 벽 손상 검출, 실제 도구 라우팅.
- 기존 `dungeonRoomPipeline`, `roomHarnessEngine`, `roomHarnessOverwriteGuard`, `generateMap*`, `interiorRoomPipeline`, `interiorRoomPipelineParity`, `interiorSeedFallback` 회귀를 함께 검사한다.
- 전체 그림과 실보행 데모는 `output/evidence/connected-dungeon-editor/`. 실제 runTool로 신규 4개 map을 생성하며 기존 17개 맵을 보존한다. 원격 정본 프로젝트는 `rpg-zzu-ashen-vault-20260913`; 원격 저장 후 재로드 receipt로 증명한다. runtime QA는 `verify-shots/runtime-qa/connected-dungeon-editor/SUMMARY.md`부터 읽는다.
