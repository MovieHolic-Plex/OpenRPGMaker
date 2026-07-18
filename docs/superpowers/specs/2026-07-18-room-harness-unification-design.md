# Room Harness 일원화 설계

- 날짜: 2026-07-18
- 작성: Claude (Opus 4.8)
- 관련 브랜치: `feat/dungeon-room-harness`

## 배경

에디터에는 맵 타입을 절차적으로 시공하는 "룸 세션 파이프라인" 하네스가 있다.
실내(`villager-room-v1`)는 6개 세션 툴(start/advance/run/furnish/evaluate/list)로
멀티턴 시공을 지원하지만, 뒤이어 만든 던전(`dungeon-room-v1`)은 원샷 `run` + `list`
2개뿐이라 같은 패턴을 흉내만 낸 **형제 중복**이었다. 공유 추상화가 없어 새 하네스를
추가할 때마다 세션 오케스트레이션(세션 저장/로드, advance 루프, 맵트리 등록)을
매번 다시 짜야 한다.

## 목표

세 하네스가 **하나의 공유 엔진 + 킷 레지스트리** 위에서 돌게 한다. 킷은 인터페이스만
구현하면 start/advance/run/evaluate/list 세션 흐름을 자동 획득한다. 던전도 실내처럼
단계별(advance) 시공과 evaluate를 얻는다.

**결정(사용자 승인)**: 툴 표면은 키트별 이름을 유지한다. 즉
`start_interior_room_session` / `start_dungeon_room_session`은 그대로 두고 속만 공유
엔진을 호출한다 — 기존 테스트·어시스턴트 학습 이름 비파괴.

## 구조

```
src/editor/roomHarness/
  types.ts        RoomHarnessKit<Plan> 인터페이스 + RoomSession<Plan> 공통 상태
  interiorKit.ts  interiorRoomPipeline 래핑 킷
  dungeonKit.ts   dungeonRoomPipeline 래핑 킷
  registry.ts     ROOM_HARNESS_KITS + getRoomKit(kitId)
  engine.ts       startRoomSession / advanceRoomBuild / runRoomPipeline / evaluateRoom / listRoomDemos
```

### RoomHarnessKit 인터페이스

```ts
interface RoomHarnessKit<Plan> {
  kitId; themes; buildOrder; demoPlans;
  ensureHarness(project): boolean;
  parsePlan(args): Plan;
  mapIdOf(plan): string;  nameOf(plan): string;
  createEmptyMap(plan): GameMap;
  applyLayer(map, plan, layer): { map; ok; summary; warnings };
  runPipeline(plan): { map; log; warnings; ok };
  evaluate?(map, plan, attempt): RoomEvalReport;
  demoMatch?(demo): Plan | undefined;
  startLog?(plan): string;
}
```

### 공통 세션 상태

세션은 `project.roomHarnessSessions`(통합 bag)에 id로 저장하고 `kitId`를 기록한다.
advance/evaluate는 sessionId만 받아 `session.kitId`로 레지스트리에서 킷을 찾는다.
(기존 `project.interiorRoomSessions` bag은 이관 — 직접 읽는 테스트 없음 확인됨.)

## 던전이 새로 얻는 것

`runDungeonRoomPipeline`을 레이어로 분해:

- `DUNGEON_ROOM_BUILD_ORDER = ["plan","ceiling","wall","floor","hazard","critique"]`
- `applyDungeonRoomLayer(map, plan, layer)` — ceiling/wall/floor/hazard 각각 시공
- `evaluateDungeonRoom(map, plan, attempt)` — 천장 프레임·직선 벽(대각 부재)·바닥·
  hazard 시 다리 통행 검사, 실내 리포트 계약(ok/score/issues) 정렬
- `runDungeonRoomPipeline`은 레이어 루프로 재구현(기존 산출물 동일 보장)

## 툴 표면 (이름·파라미터·동작 불변, 속만 엔진 위임)

- 실내: `start_/advance_/run_/evaluate_/list_interior_room_*` + 실내 전용
  `furnish_interior_space` 유지
- 던전: `start_/advance_/run_/evaluate_/list_dungeon_room_*`
  (advance·evaluate·start 신규 노출)

## 비목표 / 격리

- pokemon-core WIP(워킹트리 dirty: battle/pkmn/shop 등)는 건드리지 않는다.
  일원화 커밋엔 roomHarness 신규 + 세션 래퍼 수정 + 던전 라우팅(skills/intentClarify)
  + 던전 테스트만 담는다.
- 툴 이름 통합(제네릭 `start_room_session`)은 하지 않는다(호환성 우선).

## 검증

TDD: 공유 엔진 테스트(킷 디스패치·advance 루프·evaluate·미지 킷 에러) + 던전
레이어/evaluate 테스트 추가. 기존 실내(`interiorRoomPipeline`, `villagerRoomKit`)·
던전(`dungeonRoomPipeline`) 스위트 회귀 없음 확인.
