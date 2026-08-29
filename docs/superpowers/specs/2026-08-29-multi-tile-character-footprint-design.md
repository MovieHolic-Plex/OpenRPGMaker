# 다중 타일 캐릭터 발자국(footprint) 설계

- 작성일: 2026-08-29
- 브랜치: `big-character` (베이스 `04651554`)
- 상태: 설계 승인됨 (감독자가 §1–§6 승인 후 진행 지시)

## 문제

맵에 놓을 수 있는 모든 캐릭터·오브젝트가 **1칸 고정**이다. 2x2 석상, 3x3 골렘,
걸어다니는 드래곤을 놓을 방법이 없다.

원인은 세 층에 흩어져 있다.

1. **좌표 모델** — `GameEvent { x, y }` 는 점 하나다 (`src/project/types/events.ts:486`).
2. **충돌 판정** — `view.x === x && view.y === y` 점 비교가 4곳에 중복돼 있다.
   `runtimeEventState.ts:210,223,235` + `playSceneAutonomousMapActions.ts:73`.
3. **그림 규격** — 캐릭터셋이 24x32 로 하드 고정이다 (`resourceSlicing.ts:42`).
   업로드해도 `resourceManager.ts:183` 이 `getResourceProfileSpec("charset")` 값으로
   프레임 크기를 덮어써서 비표준 시트를 받을 수 없다.

### 이미 있는 것 — 재사용하지 않기로 한 이유

프로젝트에는 이미 다중 타일 발자국 시스템이 있다: `SpatialFootprint { width, height }`
+ `footprintCells()` + `orientedFootprint()` + `canOccupySpatialFootprint()`
(`spatialPlacements.ts`, `spatialOccupancy.ts`). 맵·타 배치물과 전부 대조하고 회전까지 한다.

그러나 **농장 건물·집 장식 전용이고 세션 런타임 소유**라 이벤트가 쓸 수 없다.
그리고 결정적으로 **앵커 규약이 다르다** — `footprintCells(x, y, ...)` 는 (x,y) 를
좌상단으로 보고 우·하로 전개한다. 이 스펙은 발밑 앵커를 쓴다(아래 §좌표 규약).

**같은 타입을 공유하면 앵커 혼동 버그가 확정이므로, 타입과 셀 전개 함수를 별도로 만든다.**
`spatialPlacements.ts` / `spatialOccupancy.ts` 는 이 작업에서 수정하지 않는다.

### 시각 크기와 충돌 발자국은 이미 분리돼 있다

24x32 스프라이트가 16x16 타일 위에 `setOrigin(0.5, 1)`(하단 중앙)로 그려진다
(`characterDepth.ts:55`). 즉 **지금도 세로 2칸·가로 1.5칸을 시각적으로 차지하며
충돌만 1칸**이다. 이 분리는 RM2K3 관례이고 이 설계는 그것을 유지한다.

## 결정

| 축 | 결정 | 근거 |
|---|---|---|
| 앵커 | **발밑 칸** — (x,y) 가 발자국 하단 행, 짝수 폭은 왼쪽 치우침 | 감독자 선택. 1x1 에서 기존 좌표와 완전 일치 → 마이그레이션 0 |
| 배율 | **수동** — 발자국과 독립된 `scale` 값 | 감독자 선택. "그림은 3배인데 발자국은 2x2" 같은 연출 허용 |
| 범위 | 맵 이벤트 + 필드 스폰 + 플레이어. 팔로워는 배율만 | 감독자 선택("전부") + 팔로워 예외는 아래 근거 |
| 이동 | 발자국 전체가 통과 가능해야 이동. 미끄러짐 없음 | 유일하게 예측 가능한 규칙 |
| 워프 | **발자국 검사함** — 안 맞으면 나선 탐색으로 밀어냄 | 감독자 선택 |
| 그림 공급 | 기존 번들 캐릭터셋(Monster1/2/3, Object1/2)을 확대 | 감독자 선택("골렘·드래곤 확대해서 테스트") |
| 회전 | **없음** — 캐릭터는 방향만 바뀌고 발자국은 고정 | 건물과 다르다. 3x3 이 좌우 볼 때 발자국이 돌면 끼임 발생 |

### 팔로워를 발자국에서 제외하는 근거

감독자는 "플레이어도 포함 전부"를 선택했으나, 팔로워는 **충돌 판정 주체가 아니다**.
`followerPositions()` (`playSceneFollowers.ts:11`) 는 플레이어 발자취를 재생할 뿐
통행 판정을 하지 않는다. 발자국을 주면 좁은 길에서 영구히 끼는 버그가 확정된다.

따라서 팔로워는 **시각 배율만 적용하고 충돌 발자국은 적용하지 않는다.**
커진 팔로워가 보이지만 벽을 통과하는 것은 의도된 동작이다.

### 폐기한 대안

- **`SpatialFootprint` 직접 재사용** — 앵커가 좌상단이라 발밑 규약과 충돌. 위 참조.
- **배율에서 발자국 자동 유도** — 24x32 는 이미 1.5x2 타일이라 유도식이 지저분하고,
  감독자가 수동 지정을 선택했다.
- **워프 발자국 미검사** — 초안에서 RM 관례를 들어 제안했으나 감독자가 검사를 선택.
  단 1x1 에서는 기존 강제 착지 동작을 보존한다(아래 §워프 착지).
- **발자국을 `GameEvent` 루트에 배치** — 알→드래곤 같은 페이지 전환 변신 연출을 막는다.
  `EventPage` 에 둔다.

---

## §1. 좌표 규약

### 새 프리미티브 — 타입은 `types/base.ts`, 함수는 `src/project/footprint.ts`

**타입 두 개(`CharacterFootprint`, `FootprintRect`)는 `types/base.ts` 에 둔다.**
`EventPage.footprint` 가 이 타입을 참조하는데, 타입을 `footprint.ts` 에 두면
`types/events.ts` → `footprint.ts` → `types` 순환이 생긴다. `PassFlag` 가
`types/base.ts` 에 있고 함수가 `collision.ts` 에 있는 기존 선례와 같은 배치다.

순수 함수는 `src/project/footprint.ts` (신규):

```ts
export interface CharacterFootprint {   // ← types/base.ts
  readonly width: number;
  readonly height: number;
}

export const UNIT_FOOTPRINT: CharacterFootprint = { width: 1, height: 1 };

export interface FootprintRect {
  readonly left: number;
  readonly right: number;   // 포함(inclusive)
  readonly top: number;
  readonly bottom: number;  // 포함(inclusive)
}

export function footprintBounds(x: number, y: number, fp: CharacterFootprint): FootprintRect {
  const left = x - Math.floor((fp.width - 1) / 2);
  return {
    left,
    right: left + fp.width - 1,
    top: y - (fp.height - 1),
    bottom: y,
  };
}

export function footprintContains(x, y, fp, px, py): boolean;
export function rectsOverlap(a: FootprintRect, b: FootprintRect): boolean;  // AABB, O(1)
export function pointRect(x: number, y: number): FootprintRect;             // 1x1 사각
export function normalizeCharacterFootprint(value: unknown): CharacterFootprint;  // 직렬화 방어
```

`normalizeFootprint` 라는 이름은 쓰지 않는다 — `spatialPlacements.ts:199` 에 모듈 사설
동명 함수가 있다. 실제 충돌은 아니지만(export 되지 않음) 앵커 규약이 다른 두 함수가
같은 이름을 갖는 것은 §문제 에서 경계한 혼동을 그대로 부른다.

`rectsOverlap` 은 AABB 4비교다. 3x3 대 3x3 도 81셀 비교가 아니라 4비교로 끝난다.

### 항등성 — 이 설계의 안전줄

| 폭×높이 | `footprintBounds(x, y, ·)` | 스프라이트 중앙 X |
|---|---|---|
| 1x1 | `{left:x, right:x, top:y, bottom:y}` | `(x + 0.5)·16` — **기존과 동일** |
| 2x2 | `{left:x, right:x+1, top:y-1, bottom:y}` | `(x + 1)·16` (두 칸 경계) |
| 3x3 | `{left:x-1, right:x+1, top:y-2, bottom:y}` | `(x + 0.5)·16` — **기존과 동일** |

`footprint` 를 생략하면 `UNIT_FOOTPRINT` 이고, 그때 모든 함수가 기존 값과 일치한다.
**기존 프로젝트·세이브 마이그레이션이 0이고, 단계 1~4 는 동작을 1비트도 바꾸지 않는다.**

`characterFootprint.test.ts` 의 1x1 항등성 테스트가 이 성질을 고정한다.

### 상한

```ts
export const CHARACTER_FOOTPRINT_AXIS_MAX = 8;
```

기존 `SPATIAL_FOOTPRINT_AXIS_MAX = 16` / `TILE_MAX = 128` 보다 보수적이다.
그 크기의 "캐릭터"가 걸어다니면 경로탐색이 사실상 항상 실패하기 때문이다.
건물은 안 움직이므로 상한이 다른 것이 옳다.

**면적 상한(`TILE_MAX`)은 두지 않는다.** `spatialPlacements` 는 축 16에 면적 128이라
면적 상한이 실제로 구속하지만, 축 8이면 최대 면적이 8×8 = 64로 이미 축 상한에서
파생된다. 별도 상수를 두면 절대 발동하지 않는 죽은 검사가 된다.

---

## §2. 데이터 모델

| 주체 | 필드 | 파일 |
|---|---|---|
| 이벤트 페이지 | `EventPage.footprint?: CharacterFootprint` | `types/events.ts:467` |
| 이벤트 그래픽 | `EventPageGraphic.scale?: number` | `types/events.ts:413` |
| 런타임 뷰 | `RuntimeEventView.footprint` / `.scale` | `runtimeEventState.ts:30` |
| 플레이어 기본값 | `playerFootprint?` / `playerScale?` | `SystemRecords`, `types/database.ts:1025` (`project.system`, `types/project.ts:393`) |
| 플레이어 세션 | `PlaySession.playerFootprint?` / `.playerScale?` | `session.ts` |
| 필드 스폰 | `FieldSpawnDef.footprint?` | `types/project.ts:170` |
| 팔로워 | `scale` 만 (발자국 없음) | `followers.ts` |

`runtimeEventView()` (`runtimeEventState.ts:75`) 가 페이지에서 해석해 노출한다:

```ts
footprint: normalizeFootprint(page?.footprint),   // 없으면 UNIT_FOOTPRINT
scale: page?.graphic.scale ?? 1,
```

필드 스폰은 `fieldSpawns.ts:329` 가 이미 `overlapForbidden: true` 인 이벤트를 생성하므로,
거기에 `footprint` 를 실어 보내면 이벤트 경로를 그대로 탄다. **추가 배관이 거의 없다.**

---

## §3. 런타임 계약 — 점 질의를 사각 질의로 승격

### 이벤트 히트테스트

현재 **5개** 지점이 점 비교를 한다. `runtimeEventState.ts` 안에 4개, 별도 파일에 1개다.

| 지점 | 위치 | 형태 | 처리 |
|---|---|---|---|
| `findRuntimeEventAt` | `runtimeEventState.ts:197` | 이벤트 배열 + 트리거 | 자체 `.find` 수정 |
| `findRuntimeEventAtInMap` | `runtimeEventState.ts:210` | 맵 + 트리거 | 사각 질의로 래퍼화 |
| `findBlockingRuntimeEventAt` | `runtimeEventState.ts:223` | 이벤트 배열 + 차단 | 자체 `.find` 수정 |
| `findBlockingRuntimeEventAtInMap` | `runtimeEventState.ts:235` | 맵 + 차단 | 사각 질의로 래퍼화 |
| `isCharacterBlockedTile` | `playSceneAutonomousMapActions.ts:73` | 사설 `.some()` 루프 | **직접 수정** |

배열 형태 2개(`findRuntimeEventAt`, `findBlockingRuntimeEventAt`)는 `map` 을 받지 않아
`runtimeEventViewsForMap` 을 못 쓴다. 사각 질의 원본에 위임할 수 없으므로 자기
`.find` 조건만 `rectsOverlap` 으로 바꾼다. `eventBlocksPlayerAt`(238)은 자체 비교가
없고 `findBlockingRuntimeEventAt` 에 위임하므로 수정 대상이 아니다.

점 질의로는 부족하다. 위 함수들은 "**점** (x,y) 가 이벤트 안인가"를 답하는데,
플레이어가 커지면 질문이 "**내 사각**이 이벤트 사각과 겹치는가"로 바뀐다.

**해법 — 사각 질의를 원본으로 두고 점 질의를 얇은 래퍼로 남긴다:**

```ts
// 새 원본
export function findEventOverlappingRect(
  project, map, session, positions,
  rect: FootprintRect,
  triggerKind?,
): RuntimeEventView | undefined;

// 기존 시그니처 유지 — 호출부 무수정
export function findRuntimeEventAtInMap(project, map, session, positions, x, y, triggerKind) {
  return findEventOverlappingRect(project, map, session, positions, pointRect(x, y), triggerKind);
}
```

이렇게 하면 **기존 호출부 30여 곳을 건드리지 않는다.** 플레이어가 커진 경로만
사각을 직접 넘긴다.

### 지형 통과 — 선행 모서리만 검사

```ts
// src/project/collision.ts 에 추가
export function canMoveFootprint(
  project, map,
  fromX: number, fromY: number, fp: CharacterFootprint,
  toX: number, toY: number,
): boolean;
```

3x3 이 오른쪽으로 한 칸 가면 **새로 밟는 오른쪽 열 3칸**만 보면 된다 — 9칸 전부가 아니다.
각 선행 셀에 기존 `canMove` 를 그대로 호출한다.

| 이동 | 선행 모서리 |
|---|---|
| 오른쪽 | `right` 열 각 행 → 해당 셀에서 우측 1칸 `canMove` |
| 왼쪽 | `left` 열 각 행 |
| 아래 | `bottom` 행 각 열 |
| 위 | `top` 행 각 열 |

대각 이동은 기존 관례(`playSceneAutonomousMapActions.ts:41-53`, `playSceneMovement.ts:142-153`)
대로 H·V 로 분해해 둘 중 하나가 열리면 허용한다.

**1x1 이면 정확히 `canMove` 1회 호출** → 기존 동작 동일이 구조적으로 보장된다.

### 경로탐색

`chaseAi.findChasePath` (`chaseAi.ts:110`) 의 `canMove` (138행) 와 인접 후보 필터
(176, 186행) 를 `canMoveFootprint` 로 교체한다.

BFS 노드는 여전히 발밑 좌표 1개이므로 **상태공간이 커지지 않는다.**

### 워프 착지

```ts
// src/project/footprint.ts
export function resolveFootprintLanding(
  project, map,
  session: PlaySessionLike, positions: RuntimeEventPositions,
  x: number, y: number, fp: CharacterFootprint,
  maxRadius = 8,
): { x: number; y: number };
```

`session` / `positions` 를 받는 이유: 아래 표의 "차단 이벤트 미겹침" 조건을 판정하려면
`findEventOverlappingRect` 을 호출해야 하고, 그 함수가 둘을 요구하기 때문이다.
지형만 보는 축약 버전을 따로 두지 않는다 — 벽은 피했는데 NPC 위에 착지하면
같은 버그를 다른 이름으로 만드는 것이다.

| 상황 | 동작 | 근거 |
|---|---|---|
| `fp` 가 1x1 | **검사 없이 그대로 착지** | 기존 transfer 는 통행불가 칸에도 강제 착지한다. 컷신 배치 등 의도적 사용이 있어 검사를 걸면 기존 게임이 깨진다 |
| `fp` > 1x1, 자리 있음 | 지정 좌표 그대로 | — |
| `fp` > 1x1, 자리 없음 | 체비쇼프 거리 순 나선 탐색 → 첫 유효 칸 | 발자국 전체 통행 + 차단 이벤트 미겹침 |
| 반경 8 안에 없음 | **지정 좌표에 그냥 착지** | 게임을 죽이지 않는다 |

### 겹친 채 시작하는 경우

3x3 보스를 벽 옆에 놓으면 발자국이 벽을 파고든다.

- **편집 시점**: 경고 배지. 배치는 허용한다(저자 의도일 수 있다).
- **런타임 진입**: 겹친 채 시작해도 게임을 죽이지 않고, **이동만 막는다.**

---

## §4. 렌더링

`characterDepth.ts` 에 함수 **1개**만 추가한다:

```ts
export function footprintSpriteX(x: number, fp: CharacterFootprint): number {
  return (footprintBounds(x, 0, fp).left + fp.width / 2) * TILE_SIZE;
}
```

Y축은 새 함수가 필요 없다. 발자국 하단은 언제나 `y` 이므로 기존
`characterSpriteY(y) = y * TILE_SIZE + TILE_SIZE` 가 그대로 맞는다.
(초안에 있던 `footprintSpriteY` 는 `characterSpriteY` 와 완전히 같은 함수라 폐기했다.)

호출부: `playSceneMapRuntime.ts:344` 의 `scene.add.sprite(...)` + `marker.setScale(scale)`.

`setScale` 호출을 위해 `RenderedEventSprite` 인터페이스(`playSceneMapRuntime.ts:60`)에
`setScale(value: number): void` 를 추가해야 하고, 그러면 이 인터페이스를 구현하는
`test/runtimeEventState.test.ts` 의 `MockSprite` 도 같이 고쳐야 한다.

이미 `setOrigin(0.5, 1)` 이라 배율을 걸면 **위·양옆으로 자란다** — 원하는 동작 그대로다.

**깊이 정렬은 변경 없음.** `characterDepth(priority, sprite.y)` 의 `sprite.y` 가
발자국 하단이므로 y-sort 가 자동으로 맞는다.

배율 3배(96px = 6타일 높이) 스프라이트가 위쪽 나무(`MAP_UPPER_LAYER_DEPTH = 250_000`)
뒤로 가려지는 것은 RM2K3 동작과 같으므로 정상이다.

---

## §5. 에디터

| 위치 | 변경 |
|---|---|
| `pageProps.ts:639` (겹침 금지 체크박스 옆) | **크기 W × H** 스피너 + **배율** 스피너 |
| `eventGraphicPreview.ts` | 미리보기에 배율 반영 — 실제 크기가 보이게 |
| `EditScene` 이벤트 마커 | 1칸 → 발자국 사각으로 확장, 선택 시 외곽선 |
| `eventMarkerUx.ts` 툴팁 | `2x2 · 배율 2` 요약 한 줄 |
| 배치 검증 | 벽·타 이벤트 겹침 시 경고 배지 (차단 아님) |

---

## §6. 저장 호환 — 확정된 작업 3곳

`parseSessionRecord` (`saveSlots.ts:757`) 는 **명시적 필드 화이트리스트**다.
등록하지 않은 세션 필드는 로드 시 **조용히 사라진다.** 그리고 이를 자동으로 잡아줄
범용 왕복 테스트가 없다(`saveActions.test.ts`, `playerSaveSlotLoadGuard.test.ts` 는
필드별 테스트다).

따라서 `playerFootprint` / `playerScale` 추가 시 다음 3곳을 함께 고쳐야 한다.

1. `saveSlots.ts` 의 `SavedSessionShape` 인터페이스(~132–166행)에 필드 선언
2. `saveSlotValidation.ts` 에 `isCharacterFootprint` 가드 추가
3. `parseSessionRecord` (~833행 인근)에 파싱 라인 추가

그리고 **왕복 테스트를 명시적으로 추가한다** — 이걸 빼면 필드 누락이 조용히 통과한다.

기존 세이브(필드 없음)는 optional 이므로 그대로 로드된다.

---

## §7. 테스트

| 파일 | 무엇을 고정하나 |
|---|---|
| `characterFootprint.test.ts` | **1x1 항등성 게이트** — 모든 함수가 1x1 에서 기존 값과 일치. 짝수 폭 왼쪽 치우침. AABB 겹침. 상한 클램프 |
| `collisionFootprint.test.ts` | `canMoveFootprint`(1x1) == `canMove` 전수 일치 / 3x3 이 2칸 통로 통과 실패 / 선행 모서리만 검사하는지 |
| `runtimeEventFootprint.test.ts` | 2x2 NPC — 4칸 어디서 말 걸어도 발동, 4칸 전부 막힘 |
| `footprintLanding.test.ts` | 1x1 워프는 검사 없이 원좌표 / 2x2 는 나선 탐색 / 반경 초과는 원좌표 폴백 |
| `playerFootprintSave.test.ts` | `playerFootprint` 세이브 왕복 보존 (§6 누락 방지) |
| e2e 1개 | Monster1 골렘 2x2·배율 2 배치 → 통과 불가 + 대화 성립 |

---

## §8. 단계 분할

| # | 내용 | 동작 변화 | 검증 |
|---|---|---|---|
| 1 | `footprint.ts` 프리미티브 + 항등 테스트 | **없음** (신규 파일) | vitest |
| 2 | `canMoveFootprint` + `resolveFootprintLanding` | **없음** (추가만) | vitest |
| 3 | 사각 질의 승격, 기존 4함수를 래퍼로 | **없음** | 기존 테스트 전부 초록 |
| 4 | 이벤트 데이터 모델 + `RuntimeEventView` | **없음** (생략=1x1) | vitest |
| 5 | 렌더 — 배율·발자국 중앙 | **여기부터 보임** | `npm run qa:runtime` |
| 6 | 에디터 UI | 저작 가능 | e2e |
| 7 | 플레이어 발자국 + 워프 착지 + 세이브 + 필드 스폰 | **위험 최고** | e2e + 수동 |
| 8 | NPC 자율이동·추격 발자국 | 중간 | vitest + 헤드리스 |

단계 1~4 는 기존 동작을 바꾸지 않는 순수 확장이라 언제든 머지 가능하다.
**단계 5 완료 시점에 "골렘이 2x2 로 서 있고 못 지나간다"를 눈으로 확인할 수 있다** —
감독자가 요청한 테스트가 여기서 성립한다.

---

## 후속 과제 (이 스펙 범위 밖)

- **그림 품질.** 24x32 를 3배 확대하면 72x96 nearest-neighbor 라 뭉개진다.
  테스트로는 충분하지만 출하 품질이 아니다. 실제 큰 캐릭터 시트를 받으려면
  `$` 접두 규약(시트 전체 = 캐릭터 1명, 프레임 = 폭/3 × 높이/4) 또는
  업로드 시 프레임 크기 지정이 필요하다. `resourceManager.ts:183` 의 강제 덮어쓰기가
  그 관문이다.
- **플레이어 발자국 변경 명령.** `system.playerFootprint` 기본값과 세션 필드만 넣고,
  이벤트 명령(`setPlayerFootprint`)은 실사용 요구가 생길 때 추가한다.
- **발자국 회전.** 캐릭터는 회전하지 않기로 했다. 회전이 필요한 사물(가로 3칸 마차가
  세로로 도는 등)이 나오면 별도 설계가 필요하다.
