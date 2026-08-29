# 몸 사각과 통행 사각의 분리 설계 (발자국 2차)

- 작성일: 2026-08-30
- 브랜치: `big-character` (1차 PR #220 위에 이어 붙인다)
- 선행 스펙: `docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md`
- 상태: 설계 승인됨 (감독자가 히트 범위·저작 모델·작업 범위 3건을 선택)

## 문제

1차는 `EventPage.footprint` 를 **충돌 사각 하나**로 정의했다. 그 하나가 통행 차단과
조사 발동을 동시에 지배한다 (`runtimeEventState.ts` 의 `viewRect` 를 6개 파인더가 공유).

감독자 요청: **"3x3 캐릭터라면 하단 1x3 에서만 히트되게 하고 싶다."**

먼저 짚어둘 사실 — 요청한 예시는 **1차 데이터 모델로 이미 표현된다.** `footprint: {3,1}` +
`graphic.scale: 3` 이 곧 "그림은 3칸, 충돌은 하단 한 줄" 이고, 두 필드의 독립은 타입 주석에
이미 못박혀 있다 (`types/events.ts:419`). 그러므로 이 스펙이 여는 것은 표현력 자체가 아니라
다음 셋이다.

1. **저작 경로가 없다.** `footprint`·`scale` 을 쓰는 편집 UI 가 0개다
   (`pageProps.ts:1105` `graphicControl` 은 스프라이트 id + 숨기기뿐). 손으로 JSON 을 고치거나
   `scripts/qa/runtime/golem-fixture.mjs` 를 돌리는 것이 전부다.
2. **편집 맵이 다중 타일을 못 보여준다.** `editSceneEventMarkers.ts:103` 은 모든 이벤트를
   `TILE_SIZE` 한 칸으로 그리고 `eventMarkerTileScale` (line 73) 로 스프라이트를 그 칸에
   **축소**한다. 클릭 히트박스도 한 칸이라 2x2 의 비앵커 칸을 누르면 선택이 아니라
   **새 이벤트가 생긴다.**
3. **사각 하나로는 "통행만 축소" 를 표현할 수 없다.** 상체 뒤로 걸어가면서 머리를 보고
   말도 걸고 칼도 맞히려면 지배 범위가 다른 사각이 둘이어야 한다.

## 결정

| 축 | 결정 | 근거 |
|---|---|---|
| 히트 범위 | **통행만 축소.** 조사·전투·점유는 몸 전체 | 감독자 선택 |
| 저장 형태 | **몸 크기(타일) + 통행 행 수(스칼라)** | 감독자 선택. 사각 둘을 저장하면 교차 필드 불변식이 생긴다 |
| 배율 | 몸 크기에서 **파생해 materialize** | 감독자 선택. 작성자가 산수를 하지 않는다 |
| 겹침 우선순위 | 규칙은 **바꾸지 않고 명문화** + lint 경고 | 규칙 변경은 기존 프로젝트 동작을 조용히 바꾼다 |
| 범위 | 1차가 넘긴 2차 백로그 **전부** | 감독자 선택 |

### 폐기한 대안

- **몸 사각과 통행 사각을 각각 `{width,height}` 로 저장** — `body.width ≠ pass.width` 라는
  불변식이 생기고 그 주인이 없다. 스칼라 하나는 불일치할 수 없다.
- **`hitFootprint` 를 새로 두고 `footprint` 를 통행으로 유지** — 폭이 두 곳에 중복된다.
  위와 같은 이유로 폐기.
- **임의 셀 마스크** — 요청 예시가 필요로 하지 않고 직렬화·편집 비용이 몇 배다.
- **배율 모드 필드(`scaleMode`)** — 파생값을 저장하면 렌더의 진실이 `graphic.scale` 하나로
  유지된다. 모드 필드를 두면 진실이 둘이 된다.

---

## §1. 좌표 규약 — 통행 사각은 몸 사각의 하단 부분사각

몸 사각은 1차의 `footprintBounds` 그대로다(발밑 앵커).

```
몸:   left = x − ⌊(width−1)/2⌋   right = left + width − 1
      top  = y − (height−1)      bottom = y

통행: left·right·bottom 동일,  top = bottom − (passRows − 1)
```

`src/project/footprint.ts` 에 추가한다.

```ts
/** 통행 차단 사각 — 몸 사각의 하단 passRows 행. */
export function passageBounds(x, y, fp, passRows): FootprintRect

/** 비정규 ⇒ height(전체). 범위는 [1, height] 클램프. */
export function normalizePassRows(value: unknown, height: number): number
```

### 항등성 — 이 설계의 안전줄

`passRows` 생략 ⇒ `normalizePassRows` 가 `height` 를 돌려주고 ⇒
`passageBounds === footprintBounds`. 즉 **기존 데이터의 동작이 한 바이트도 안 바뀐다.**
1차의 "1x1 항등" 과 같은 성격이고, 모든 태스크의 회귀 게이트다.

### fail-closed 방향

`passRows` 가 정수 아님·0 이하·NaN·문자열이면 **전체 높이로 올린다.** 더 많이 막는 쪽이
안전하고, 그것이 곧 항등 기본값이다. 1차 `safeAxis` 가 폭 0 을 1 로 올려 fail-open 을
막은 것과 방향이 같다.

## §2. 데이터 모델

`EventPage.footprint` 의 **의미를 뒤집는다.** 필드명은 유지한다 — 마이그레이션 0,
픽스처 무수정, 기존 테스트의 의미 보존.

| 필드 | 의미 | 지배 범위 |
|---|---|---|
| `footprint?: CharacterFootprint` | 몸 사각(타일) | 조사·접촉 발동, 전투 히트, 점유, 렌더 중앙, depth, 편집 클릭 |
| `passRows?: number` (신규) | 몸 사각 하단 N행 | 통행 차단 전용 |

"발자국" 이 몸이 덮는 칸을 뜻하는 것은 충돌만 뜻하는 것보다 오히려 자연스럽다.
줄어든 쪽은 사각으로 저장하지 않고 **파생**하며, 이름을 갈라 grep 사고를 막는다
(1차에 `footprintCells` 두 개가 충돌해 `characterFootprintCells` 로 개명한 전례).

플레이어: `SystemRecords.playerFootprint?` + `playerPassRows?`.

## §3. 런타임 계약 — 소비자에게 크기가 아니라 이름 붙은 사각을 준다

`RuntimeEventView` 가 두 사각을 **미리 계산해** 내보낸다. 크기 + 수정자를 넘기면 소비자가
수정자 적용을 잊을 수 있고, 그 실수는 조용히 통행을 열어 버린다.

```ts
readonly passRows: number;
readonly bodyRect: FootprintRect;
readonly passRect: FootprintRect;
```

모듈 private `viewRect` (`runtimeEventState.ts:196`) 를 제거하고 6개 파인더를 갈라 배선한다.

| 파인더 | 사각 |
|---|---|
| `findEventOverlappingRect` · `findRuntimeEventAt` · `findRuntimeEventAtInMap` | `bodyRect` |
| `findBlockingEventOverlappingRect` · `findBlockingRuntimeEventAt` · `findBlockingRuntimeEventAtInMap` · `eventBlocksPlayerAt` | `passRect` |

이동 판정(`collision.ts`)은 `passRect` 의 선행 모서리만 검사한다. 1차 주석이 경고한
대각 갈림(`canMove` 는 true, `canMoveFootprint` 는 false)은 그대로 유지한다.

전투(`playSceneActionCombat.ts` 6곳)와 점유(`occupiedCells`)는 `bodyRect`.

### 겹침 우선순위

`.find` 의 배열 순서가 규칙이다. **이 스펙은 규칙을 바꾸지 않고 문서화한다.** 대신 같은
우선순위의 `overlapForbidden` 몸 사각이 겹치면 `projectLint` 가 경고한다. 오늘 중복 검사
키가 `${event.x},${event.y}` (`projectLint.ts:305`) 라 겹친 2x2 두 개를 못 잡는다.

## §4. 렌더링 — 배율은 몸 크기에서 파생

```
scale = footprint.width × TILE_SIZE ÷ cellWidth      (폭 맞춤)
```

**폭 맞춤인 이유:** 폭은 점유 타일 수와 직결된다. 세로로 삐죽한 스프라이트는 정상이다
(머리는 위로 뻗어 뒤에 그려진다). 높이로 맞추면 넓은 생물이 점유하지 않는 옆 칸까지 그림을
흘려 버그로 읽힌다.

편집창이 몸 크기와 `graphic.scale` 을 **한 패치로 같이 쓴다.** "배율 직접 지정" 탈출구를
남겨 1차가 약속한 "그림은 3배인데 발자국은 2x2" 자유를 보존한다.

`footprintSpriteX` 는 오늘 `playSceneMapRuntime.ts:346` **한 곳**에만 걸려 있다. 스프라이트를
다시 놓는 6개 경로가 타일 중앙으로 되돌린다(`playSceneAutonomous.ts` 3곳,
`playSceneActionCombat.ts` 3곳). ⚠ **같은 파일의 데미지 숫자·파티클·텔레그래프·스윙 아크는
타일 중앙이 맞다.** 일괄 치환은 오답이다.

## §5. 에디터

- **편집창**: 몸 폭·높이 스피너(1..8), 통행 행 슬라이더(1..몸 높이), 배율 직접 지정 체크.
  몸 높이를 줄이면 `passRows` 를 같이 클램프해 저장한다(불변식을 UI 가 유지).
- **편집 맵**: 스프라이트를 실제 배율로, 몸 사각 외곽선 + 통행 행 음영.
  `eventMarkerTileScale` 은 1x1 폴백과 배지에만 남긴다.
- **클릭 히트테스트**: `worldGraphTools.ts:555` 의 private `eventAt` 을 공용
  `eventAtPoint(map, x, y)` 로 끌어올리고 `footprintBounds` + `rectsOverlap` 로 구현.
  **몸** 사각이다 — 머리를 클릭해도 선택돼야 한다. `EditScene.ts` 9곳,
  `tools/eventTools.ts` 2곳이 대상이고, 나머지 파일의 점 비교는 대부분 타일 좌표 비교라
  **하나씩 판별**한다.
- **내장 플레이어**: `runtimeDom.ts:172,209` 의 마커가 앵커 한 칸 고정이고 그 마커가
  `pointer-events: auto` 클릭 실행 히트박스다. 몸 사각 크기로 키운다.

## §6. 저장 호환

`serialize` 는 `JSON.stringify` 전체 직렬화라 왕복은 이미 보존된다. **검증이 빠져 있다** —
`validatePageShape` (`io/shapeEventFields.ts:261`) 에 `footprint`·`passRows` 가 없고
`validateEventGraphic` (line 159) 에 `scale` 이 없다. `footprint: {width: -5}` 가 로드 검증을
통과하고 런타임 `safeAxis` 만이 막고 있다.

`normalizeCharacterFootprint` 와 같은 경계로 검증을 추가한다: 축 1..8,
`passRows` 1..height, `scale` 0.25..8. 스키마 버전은 올리지 않는다(추가 optional 필드).

## §7. 테스트

- **항등**: `passRows` 없는 기존 26건(`runtimeEventFootprint.test.ts`)이 **수정 없이** 통과.
- **판별력**: 프로브는 앵커 칸을 겨냥하지 않는다 — 앵커는 1x1 이어도 같은 결과라 발자국에
  대해 아무것도 증명하지 않는다.
- **fail-closed**: 비정규 `passRows` 6종이 전체 높이로 굳는지.
- **브라우저**: 3x3 몸 + `passRows:1` 골렘. 상체 행을 실제로 지나가고, 하단 비앵커 칸에서
  막히고, 상체를 보고 조사하면 대사창이 뜬다. 면마다 골렘 없는 **대조군**을 같은 입력으로
  돌려 "안 움직였다" 헛통과를 배제한다.
  ⚠ 이동 입력은 `key` 가 아니라 `dir`(`injectDirection`) — headless 에서 `window` keydown 은
  Phaser 키보드 매니저에 도달하지 않는다(`src/player/input.ts:357`).

## §8. 단계 분할

| 묶음 | 내용 | 사용자 노출 |
|---|---|---|
| A | 프리미티브 · `RuntimeEventView` 두 사각 · 이동 판정 | 없음 |
| B | 편집창 · 편집 맵 · io 검증 | **요청의 본체.** 여기까지가 정당한 중단점 |
| C | 렌더 재배치 6곳 · 전투 승격 · 플레이어 발자국 | 있음 |
| D | lint · 스냅샷 · 하네스 · 브라우저 검증 | 저작 시점 조언 |

## 범위 밖

- 공중에 뜬 대상의 "가운데만 히트" — `passRows` 는 구조적으로 하단 고정이다.
- 임의 셀 마스크.
- 겹침 우선순위 **규칙 변경** — 명문화와 lint 경고까지만.
- 캐릭터셋 24x32 하드 고정 해제(1차 스펙의 후속 과제로 남아 있다).
