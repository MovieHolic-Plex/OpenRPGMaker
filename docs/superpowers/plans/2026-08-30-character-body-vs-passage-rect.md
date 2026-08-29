# 다중 타일 캐릭터 — 몸 사각과 통행 사각의 분리 (2차)

## Context

1차(`big-character`, PR #220)는 `EventPage.footprint` 를 **충돌 사각** 하나로 정의하고, 히트테스트를
점 비교에서 AABB 로 승격했다. `graphic.scale` 은 그와 독립인 렌더 배율로 남겼다.

그래서 사용자가 요청한 "3x3 처럼 보이는데 하단 1x3 만 히트" 는 **런타임 데이터로는 이미 표현된다**
(`footprint: {3,1}` + `scale: 3`). 빠진 것은 세 가지다.

1. **저작 경로가 없다.** `EventPage.footprint` 도 `graphic.scale` 도 쓰는 편집 UI 가 없다
   (`pageProps.ts:1105` `graphicControl` 은 스프라이트 id + 숨기기 체크박스뿐). 손으로 JSON 을
   고치거나 `scripts/qa/runtime/golem-fixture.mjs` 를 돌리는 것이 전부다.
2. **편집 맵이 다중 타일을 못 보여준다.** `editSceneEventMarkers.ts:103` 은 모든 이벤트를
   `TILE_SIZE` 한 칸 사각으로 그리고 `eventMarkerTileScale` 로 스프라이트를 그 한 칸에 **축소**한다.
   클릭 히트박스도 한 칸이라 2x2 의 비앵커 칸을 누르면 선택이 아니라 **새 이벤트가 생긴다**.
3. **사각 하나로는 "통행만 축소" 를 표현할 수 없다.** 오늘 `footprint` 는 통행 차단과 조사 발동을
   동시에 지배한다. 상체 뒤로 걸어가면서 머리를 보고 말도 걸고 칼도 맞히려면 사각이 둘이어야 한다.

이 계획은 사각을 둘로 쪼개고(몸 / 통행), 그것을 저작할 UI 를 만들고, 1차가 2차로 넘긴 백로그를
전부 흡수한다. 끝나면 작성자가 "3x3 골렘, 하단 1행만 막힘" 을 편집창에서 만들고 맵에서 눈으로
확인할 수 있다.

## 확정된 설계 결정

### D1 — 사각은 둘, 저장은 "크기 하나 + 스칼라 하나"

| 필드 | 의미 | 지배 범위 |
|---|---|---|
| `EventPage.footprint: CharacterFootprint` | **몸 사각**(타일). 의미를 뒤집는다 | 조사·접촉 발동, 전투 히트, 점유, 렌더 중앙, depth, 편집 클릭 |
| `EventPage.passRows?: number` | **신규**. 몸 사각 **하단 N행**만 통행 차단 | 통행 차단(플레이어·NPC) 전용 |

`passRows` 생략 ⇒ `footprint.height` ⇒ 통행 사각 === 몸 사각 ⇒ **기존 동작과 완전 동일**.
1차의 "1x1 항등" 과 같은 안전선이며, 이것이 모든 태스크의 회귀 게이트다.

폭을 가진 사각을 둘 저장하지 않는 이유: `body.width ≠ pass.width` 라는 교차 필드 불변식이
생기고 그 주인이 없다. **스칼라 하나는 불일치할 수 없다.**

`passRows` 가 비정규(정수 아님·범위 밖)면 **몸 높이 전체로 올린다.** 더 많이 막는 쪽이
fail-closed 이고, 그게 곧 항등 기본값이다 — 1차의 `safeAxis` 와 방향이 같다.

### D2 — 배율은 몸 크기에서 파생해 **materialize** 한다

편집창의 몸 크기 스피너가 `footprint` 와 `graphic.scale` 을 **한 패치로 같이 쓴다**.
`scale = footprint.width * TILE_SIZE / cellWidth` (**폭 맞춤**).

높이 맞춤이 아닌 이유: 폭은 점유 타일 수와 직결되고, 세로로 삐죽한 스프라이트는 정상이다
(머리는 위로 뻗어 뒤에 그려진다). 높이로 맞추면 넓은 생물이 점유하지 않는 옆 칸까지
그림을 흘려 버그로 읽힌다.

`scaleMode` 같은 새 필드는 두지 않는다 — 파생값을 저장하므로 렌더의 진실은 여전히
`graphic.scale` 하나다. "배율 직접 지정" 탈출구를 UI 에 남겨 1차가 약속한
"그림은 3배인데 발자국은 2x2" 자유를 보존한다.

### D3 — `passRows` 는 행 수이지 사각이 아니다

구조적으로 하단 고정이라 "공중에 뜬 유령의 가운데만 히트" 는 표현할 수 없다. 범위 밖이다.

### D4 — 소비자에게는 크기가 아니라 **이름 붙은 사각**을 준다

`RuntimeEventView` 가 `bodyRect` / `passRect` 를 **미리 계산해** 내보낸다. 크기 + 수정자를
넘겨서 소비자가 적용을 잊는 사고를 구조적으로 막는다. 이 저장소는 이미 발자국 이름 사고를
한 번 겪었다(`footprintCells` 두 개 → `characterFootprintCells` 로 개명).

`src/project/footprint.ts` 의 두 파생을 이름으로 갈라 둔다.
- `footprintBounds(x, y, fp)` — 몸 사각 (동작 무변경, 주석만 "몸 사각" 으로)
- `passageBounds(x, y, fp, passRows)` — 통행 사각 (신규)

### D5 — 겹침 우선순위 규칙은 **바꾸지 않고 명문화**한다

지금은 `.find` 의 배열 순서가 사실상의 규칙이다. 다중 타일 저작이 열리면 즉시 노출되지만,
규칙을 바꾸면 기존 프로젝트의 동작이 조용히 달라진다. **배열 순서를 규칙으로 문서화**하고,
같은 우선순위의 `overlapForbidden` 몸 사각이 겹치면 lint 경고를 낸다.

## Global Constraints

- **워크트리 공유.** `git add .` 금지 — 경로를 하나하나 스테이징한다.
  `git checkout -- <file>` / `git stash` / `git clean` **금지**(HEAD 리셋이라 미커밋 작업이
  사라진다. 1차에서 실제로 2파일을 날렸다). 변이 검증은 변이 전 커밋 또는 Edit 으로 되돌린다.
- **항등 게이트.** `footprint` 없고 `passRows` 없는 기존 프로젝트는 동작이 한 바이트도 안 바뀐다.
  각 태스크는 이것을 자기 테스트로 증명한다.
- `npm run typecheck:app` 오류 0. 전체 `npm run typecheck` 는 **574 오류 = 기준선**이고
  손댄 파일에서는 0 이어야 한다.
- 집중 테스트: `node scripts/run-vitest.mjs run --configLoader bundle <경로>`.
  전체 `npm test` 대신 `.superpowers/sdd/2026-08-29-multi-tile-character-footprint-phase1/gate-suites.txt`
  의 28 스위트를 게이트로 쓴다(부하 공유 워크트리라 전체 수치는 신호가 더럽다).
- 착수 첫 커밋은 1차 관례대로 `docs/superpowers/specs/` + `docs/superpowers/plans/` 에
  스펙·계획 문서를 올리는 것이다.

---

## A. 의미론 코어 (사용자 노출면 없음)

### Task 1 — 프리미티브: 통행 사각 파생

`src/project/footprint.ts`
- `passageBounds(x, y, fp, passRows)` 추가 — `footprintBounds` 의 `top` 만 `bottom - (rows-1)` 로.
- `normalizePassRows(value, height)` 추가 — 비정규 ⇒ `height`, 범위는 `[1, height]` 클램프.
- `footprintBounds` 주석을 "몸 사각" 으로.

`src/project/types/base.ts:419` `CharacterFootprint` 주석을 몸 사각으로 뒤집는다.
`src/project/types/events.ts:482` `EventPage.footprint` 주석 뒤집기 + `passRows?: number` 추가.

테스트 (`test/characterFootprint.test.ts` 에 describe 추가)
- `passRows` undefined ⇒ `passageBounds === footprintBounds` (높이 1·2·3·8 순회)
- `passRows = 1` ⇒ `top === bottom === y`
- 비정규(`0`, `-1`, `2.5`, `NaN`, `"2"`, `null`) ⇒ 전체 높이 (fail-closed)
- `passRows > height` ⇒ `height` 로 클램프

### Task 2 — `RuntimeEventView`: 두 사각을 내보내고 6개 파인더를 갈라 배선

`src/project/runtimeEventState.ts`
- `RuntimeEventView` 에 `passRows: number`, `bodyRect: FootprintRect`, `passRect: FootprintRect`.
- `runtimeEventView` 에서 `normalizePassRows(page?.passRows, footprint.height)` + 두 사각 계산.
- 모듈 private `viewRect` (line 196) **제거** 후 갈라 배선:
  - 조사·접촉: `findEventOverlappingRect`, `findRuntimeEventAt`, `findRuntimeEventAtInMap` → `bodyRect`
  - 통행: `findBlockingEventOverlappingRect`, `findBlockingRuntimeEventAt`,
    `findBlockingRuntimeEventAtInMap`, `eventBlocksPlayerAt` → `passRect`

테스트 (`test/runtimeEventFootprint.test.ts`)
- 기존 26건은 **수정 없이** 통과해야 한다(항등).
- 신규: 몸 3x3 + `passRows:1` ⇒ 하단 행만 차단, 상단 두 행은 통행 가능,
  상단 행에서 조사 발동은 **성공**(몸이 지배).
- 판별력: 프로브는 앵커 칸을 겨냥하지 않는다 — 앵커는 1x1 이어도 같은 결과라 아무것도 증명하지 않는다.

### Task 3 — 이동 판정을 통행 사각으로, 그리고 미배선 호출부 흡수

`src/project/collision.ts`
- `leadingEdgeCells` 가 `FootprintRect` 를 받도록 바꾸고 `canMoveRect(project, map, rect, dx, dy)` 신설.
- `canMoveFootprint` 는 `passRows` 를 받아 `canMoveRect(passageBounds(...))` 로 위임(대각 분해 로직 유지).
- 주석의 대각 갈림(canMove 는 true, 이쪽은 false) 설명 보존.

1차가 미룬 배선: `canNpcMove`, `tryStartMove`, 추격 경로탐색을 `canMoveFootprint` 로 전환.
주석이 경고한 대각 차이를 그 자리에서 확인한다.

테스트 `test/collisionFootprint.test.ts` — 1x1 직교 ⇒ `canMove` 1회와 동일(항등),
3x3 + `passRows:1` 이 벽 앞에서 하단 행만 검사하는지.

---

## B. 저작 — 요청의 본체

> 여기까지가 정당한 중단점이다. A+B 만으로 "3x3 몸, 하단 1행 통행" 을 만들고 플레이할 수 있다.

### Task 4 — 편집창: 몸 크기와 통행 행 입력

`src/editor/panels/eventEditor/pageProps.ts` — `renderEventPageProps` (line 620) 에
`rm2k3Fieldset("크기와 통행", …, "event-classic-footprint")` 를 "모습"(line 684) 바로 뒤에 끼운다.
`movementSpeedSelect` (line 1068) 의 패턴을 그대로 따른다 — `el()` + `updateEventPage(mapId, eventId, page.id, patch)`.

컨트롤
- 몸 폭 / 몸 높이 스피너 (1..`CHARACTER_FOOTPRINT_AXIS_MAX`=8)
- 통행 차단 행 슬라이더 (1..몸 높이) + 실시간 문구 "하단 N행만 막힙니다"
- 몸 높이를 줄이면 `passRows` 를 같이 클램프해 저장(불변식을 UI 에서 유지)
- "배율 직접 지정" 체크 — 끄면 D2 파생값을 같이 패치, 켜면 배율 입력 노출

testid: `event-page-body-width`, `event-page-body-height`, `event-page-pass-rows`,
`event-page-body-scale`, `event-page-body-scale-manual`

`src/editor/panels/eventEditor/eventGraphicPreview.ts` — 미리보기를 실제 배율로 그리고
타일 격자를 깔아 몇 칸을 덮는지 보이게 한다. 통행 행은 다른 음영.

### Task 5 — 편집 맵: 실제 크기 렌더 + 사각 오버레이 + 클릭 히트테스트

`src/editor/editSceneEventMarkers.ts`
- 스프라이트를 `page.graphic.scale` 실제 크기로 그린다. `eventMarkerTileScale` (line 73) 은
  배율 없는 1x1 폴백과 배지에만 남긴다.
- 몸 사각 외곽선 + 통행 행 음영 오버레이. `footprintBounds` / `passageBounds` /
  `characterFootprintCells` 재사용.

**클릭 히트테스트 승격** — 오늘 2x2 의 비앵커 칸을 클릭하면 선택이 아니라 새 이벤트가 생긴다.
- `worldGraphTools.ts:555` 의 private `eventAt(map, point)` 를 공용 `eventAtPoint(map, x, y)` 로
  끌어올리고 `footprintBounds` + `rectsOverlap` 로 구현(**몸** 사각 — 머리를 클릭해도 선택돼야 한다).
- 치환 대상: `EditScene.ts` 9곳, `tools/eventTools.ts` 2곳. 나머지 14개 파일의 점 비교는
  **하나씩 판별**한다 — 대부분 타일/좌표 비교라 그대로 둬야 한다
  (`houseInteriors.ts`, `mapTools.ts`, `naturalScatter.ts`, `village/*` 등).
- 겹침 경고 배지(D5 의 lint 경고와 같은 판정식 공유).

`src/player/runtimeDom.ts:172,209` — 내장 플레이어의 이벤트 마커가 앵커에 `TILE_SIZE` 한 칸
고정이고 그 마커가 `pointer-events: auto` 클릭 실행 히트박스다. 몸 사각 크기로 키운다.

### Task 6 — 로드 시점 검증 (io)

`src/project/io/shapeEventFields.ts` `validatePageShape` (line 261) 에 세 필드가 **없다** —
`footprint: {width: -5}` 가 로드 검증을 통과하고 런타임 `safeAxis` 만이 막고 있다.
`normalizeCharacterFootprint` 와 같은 경계로 검증 추가: 축 1..8, `passRows` 1..height,
`graphic.scale` 0.25..8. `validateEventGraphic` (line 159) 에 `scale` 도 같이.

`serialize` 는 `JSON.stringify` 전체 직렬화라 왕복 자체는 이미 보존된다 — 검증만 빠져 있다.

---

## C. 런타임 백로그 흡수

### Task 7 — 렌더: 움직여도 몸 중앙을 유지

`footprintSpriteX` 는 오늘 `playSceneMapRuntime.ts:346` (`renderEvents` 최초 배치) **한 곳**에만
걸려 있다. 스프라이트를 다시 놓는 6개 경로가 타일 중앙(`characterSpriteX`)으로 되돌린다.
- `playSceneAutonomous.ts` — `updateAutonomousNPCs`, `updateChaseNpc`, `updateActiveNpcMove`
- `playSceneActionCombat.ts` — `applyKnockback`, `startWindup`, `stepDash`

⚠ **같은 파일의 데미지 숫자·파티클·텔레그래프·스윙 아크는 타일 중앙이 맞다.**
일괄 치환은 오답이다 — 스프라이트 배치 6곳만 바꾼다.

앵커에 고정된 다른 시각 표면도 몸 사각 중앙으로: `playSceneCamera.ts`, `playSceneLighting.ts`,
`playSceneMapAnimations.ts`, `minimap.ts`. 팔로워 배율 적용.

### Task 8 — 전투: 몸 사각 승격 (+ 스폰이 남의 몸을 피하기)

`src/player/actionCombatTypes.ts` — `ActionEnemyState` 에 `footprint` 필드가 없다. 판정식
교체만으로 안 되고 데이터 모델 변경이 붙는다. `footprint` + `bodyRect` 추가.

`src/player/playSceneActionCombat.ts` — 앵커 전용 히트테스트 **6곳**을 몸 사각 겹침으로
(사용자 결정: 전투는 몸 전체): 접촉 피해, 플레이어 스윙 아크, 적끼리 점유, 적 스윙 아크 원점,
대시 명중·인접, 투사체 명중. 기준점은 `pos.x === x && pos.y === y` (line 823) 계열.

`occupiedCells` — 다른 이벤트를 앵커 한 칸으로만 점유 등록해서 **2x2 골렘 몸통 안에 몬스터가
솟는다.** 몸 사각 전 칸을 등록한다.

`src/player/fieldSpawns.ts` `fieldSpawnEvent` — 합성 페이지에 `footprint`/`passRows` 를 싣는다.
(오늘 안 실려서 전부 1x1 이라 위 6곳이 도달 불가였다.)

### Task 9 — 플레이어 발자국 + 워프 착지 배선

`src/project/types/database.ts:1025` `SystemRecords` 에 `playerFootprint?: CharacterFootprint`,
`playerPassRows?: number`. 세션 필드 + 세이브 화이트리스트 3곳 + 왕복 테스트.
플레이어 통행 판정은 `passRect`.

`resolveFootprintLanding` (`src/project/footprintLanding.ts`) — 오늘 **프로덕션 호출부가 0** 이다
(테스트만). transfer 경로에 배선한다. Chebyshev 링 방출 순서 자체가 계약이므로 순서를 바꾸지 않는다.

---

## D. 검증면 정리

### Task 10 — 저작 시점 lint · 스냅샷 · 테스트 하네스

`src/project/lint/projectLint.ts` — 오늘 앵커 칸의 통행성과 앵커의 4방 이웃만 본다(line 256, 279).
통행 불가 타일을 걸친 2x2 가 **무경고 통과**한다. 통행 사각 전 칸으로 확장.
중복 검사 키가 `${event.x},${event.y}` (line 305) 라 **겹친 2x2 두 개를 못 잡는다** → 사각 겹침으로.
`worldGraph/lint.ts`, `aiPreviewGenerator.ts` 도 앵커까지만 도달한다.

`src/player/runtimeDom.ts:46` `RuntimeEventSnapshot` 에 `footprint`/`passRows`/`bodyRect`/`passRect`
추가. 오늘은 필드가 없어서 `__oprnDebug` 소비자가 사각을 단정할 **수단 자체가 없고**, 그래서
`golem.scenario.mjs` 가 발자국 좌표를 주석에 손으로 적어야 했다.

테스트 하네스(사용자 노출면 없음): `sceneTestRunner.ts:511-522` `findGiftTargetEvent` 점 비교,
같은 파일의 앵커 맨해튼 거리, `walkthroughRunner.ts` 의 정적 `map.events` 점 일치,
`mapTravelReachability.ts` 전이 게이트 한 칸 색인.

`scripts/lib/runtimeQa.mjs` `evaluateExpect` — x/y 를 스칼라 **동등**으로만 비교해서 대조군의
"움직였다" 를 표현할 수 없다. 부등 비교(`xNot`/`yNot` 또는 범위)를 추가한다. **다른 시나리오가
공유하는 파일이므로 기존 동등 의미를 건드리지 않는다.**

`handleAction` 의 `lastActionTargetKey` 가 이벤트 단위에서 타일 단위로 격하돼 있다 —
우선순위 낮은 다중 타일 이벤트가 제자리 회전만으로 재발동한다. 이벤트 단위로 되돌린다.

### Task 11 — 브라우저 검증: 3x3 골렘, 하단 1행만 막힘

`scripts/qa/runtime/golem-fixture.mjs`
- 3x3 몸 + `passRows: 1` 골렘 옵션 추가.
- **자기 겹침 사전검사를 고친다** — 주석(line 60)이 이미 경고하듯 기존 이벤트를 앵커 한 칸으로만
  본다. `footprintBounds` + `rectsOverlap` 으로 올린다.

`scripts/qa/runtime/golem.scenario.mjs` — `FACES` 에 면 추가
- **상체 뒤로 통과**: 상단 두 행을 가로로 걸어 지나간다(오늘은 막혀야 하는 칸이었다)
- **하단 행은 막힘**: 비앵커 하단 칸을 겨냥
- **몸으로 조사**: 상단 행을 보고 조사 → 대사창 (통행은 열렸는데 조사는 된다 = 사각 둘의 증명)
- 각 면마다 골렘 없는 **대조군**을 같은 입력으로 — 입력이 죽어서 "안 움직였다" 가 헛통과하는 것을 배제.
  Task 10 의 부등 비교가 들어오면 이 A/B 가 사람 판독에서 자동 단정으로 바뀐다.

⚠ 이동 입력은 `key` 가 아니라 `dir`(`injectDirection`) 이어야 한다 — headless 에서 `window`
keydown 은 Phaser 키보드 매니저에 도달하지 않는다(`src/player/input.ts:357`).

---

## 검증

**태스크별**
```bash
node scripts/run-vitest.mjs run --configLoader bundle \
  test/characterFootprint.test.ts test/collisionFootprint.test.ts \
  test/runtimeEventFootprint.test.ts test/footprintLanding.test.ts
npm run typecheck:app          # 오류 0
```

**게이트** — `.superpowers/sdd/2026-08-29-multi-tile-character-footprint-phase1/gate-suites.txt`
의 28 스위트(1차 기준 318건 통과). 편집 UI 태스크가 추가하는 스위트를 목록에 얹는다.

**항등 회귀** — `footprint`/`passRows` 없는 기존 픽스처로 게이트를 돌려 1차와 같은 결과가 나오는지.
실패가 내 변경 탓인지 판정할 때는 `git worktree add --detach /tmp/base <ref>` +
`ln -s /home/main/z-project/rpg-zzu/node_modules` 로 베이스라인을 재현해 **줄번호까지** 대조한다.

**브라우저**
```bash
node scripts/qa/runtime/golem-fixture.mjs --out /tmp/golem-3x3.json --body 3,3 --pass-rows 1 --start 15,14
GOLEM_FACE=torso-pass node scripts/runtime-qa.mjs --scenario golem \
  --project /tmp/golem-3x3.json --out verify-shots/big-character-golem-3x3/torso-pass
```
면마다 골렘 런 + 대조군 런. 통과 기준: 상체 행을 실제로 지나가고, 하단 비앵커 칸에서 막히고,
상체를 보고 조사하면 대사창이 뜬다.

**편집기** — 편집창에서 몸 3x3 · 통행 1행을 입력하고 저장 → 다시 열어 값이 살아 있는지,
편집 맵에 3x3 외곽선과 하단 1행 음영이 보이는지, **비앵커 칸 클릭이 선택으로 잡히는지**
(오늘은 새 이벤트가 생긴다).

**변이 검증** — 각 태스크의 핵심 판정식을 하나씩 뒤집어 테스트가 실제로 잡는지 확인한다.
되돌릴 때 `git checkout --` 를 쓰지 말고 변이 전에 커밋하거나 Edit 으로 되돌린다.

## 범위 밖

- 공중에 뜬 대상의 "가운데만 히트"(D3) — `passRows` 는 구조적으로 하단 고정이다.
- 임의 셀 마스크. 요청한 예시가 필요로 하지 않고 직렬화·편집 비용이 몇 배다.
- 겹침 우선순위 **규칙 변경**(D5) — 명문화와 lint 경고까지만.
