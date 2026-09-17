# Editor Pre-edit Routing & Cautions

> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

Read this before editing editor-facing behavior. Identifies which workflow owns a request and lists agent cautions.

## 맵 전환과 물 타일 애니메이션 공유 (2026-09-18)

`chipsetTileRender`의 애니메이션 타일·호수 쿼터는 `sharedTileAnimation`을 통해
**씬·애니메이션 키마다 숨겨진 Sprite 하나**를 공유한다. 각 타일은 Image이고,
`animationupdate` 때 프레임만 따라간다. 알파·틴트·컨테이너·컬링은 타일별로 유지한다.
마지막 Image가 파괴되면 공유 Sprite도 파괴한다. 새 타일은 현재 공유 프레임부터 시작한다.

9/16의 재생성 비용 설명은 불완전했다. 실제 CPU 프로파일에서 물 맵 전환의 주범은
`AnimationState.destroy → AnimationManager.off → EventEmitter.removeListener`였다.
타일마다 Sprite를 만들면 각 Sprite가 같은 전역 `remove` 이벤트에 구독하므로,
수만 개를 개별 해제할 때 리스너 배열을 매번 훑고 복사한다. **타일별 Sprite로 되돌리지 마라.**
NPC·캐릭터 Sprite와 런타임 렌더 경로는 이 변경의 대상이 아니다.

96×96 물 맵 왕복의 동기 선택 처리: 10.01~13.92초 → 0.32~0.46초.
브라우저에서 1,000개 Image의 두 프레임 재생, 공유 리스너 1개, 전량 파괴 후 0개를 확인했다.
실측 범위·근거: `reports/2026-09-18-map-switch-performance.md`.
회귀 계약: `test/sharedTileAnimation.test.ts` (이 세션에서는 저장소 규칙에 따라 실행하지 않음).

## 편집기 재렌더 비용 — 줌은 카메라 경로다 (2026-09-16)

`EditScene` 의 전체 재렌더(`redraw`)는 타일 GameObject 를 전부 파괴하고 다시 만든다.
Phaser 3.90 에서 이 재생성은 **O(N²)** 다: `Container.add` 가 자식을 이전 display list 에서
떼는데(`removeFromDisplayList` → `DisplayList.remove` → `ArrayUtils.Remove` 의 `indexOf`),
`Container.remove`/`removeAll(true)` 의 destroy 경로도 같은 `indexOf` 를 탄다.

- **`renderStateKey` 에 `zoom` 을 다시 넣지 마라.** 타일 오브젝트의 모양·좌표는 줌에
  의존하지 않는다. 줌 변경은 `redrawWhenViewStateChanges` → `applyCameraZoomOnly`
  (`applyCameraView(preserveLookAt=true)` + 내비 기하 + 배경 레이아웃 + 뷰포트 게시)가
  처리하고, 화면 밖 타일 컬링은 다음 `update()` 가 `worldView` 변화를 보고 스스로 다시 계산한다.
  실측(48×48 / 96×96):  1단계가 723~862ms / 11.4~17.5초 → 41~100ms / 67~110ms.
- 비용이 의심되면 먼저 재라: `test/e2e/_large-map-perf.spec.ts` (진단 스펙, 맵 크기별
  줌·페인트·정지 프레임). 수치와 원인은 `reports/2026-09-16-editor-zoom-rebuild-perf.md`.
- 남은 비용(미해결): 페인트 증분 렌더의 `tileLayer.sort("depth")` 가 자식 전체를 매 스토어
  변경마다 정렬한다. lower/upper 컨테이너 분리, `scene.make`+`addAt` 으로 재부모화 회피가
  후보 수정이다.
- `src/project/io/references.ts` 의 참조 검증은 **이슈 수집 계약**이다 — 검증기가 던진
  예외도 `check()` 가 이슈 문자열로 남긴다. 새 검증기를 추가할 때도 이 계약을 깨지 마라
  (비정규 프로젝트에서 예외가 새면 에디터 부팅이 통째로 죽는다. 실측 2026-09-16).

## Exterior door backing

AI house and village authoring places lower-layer tile 359 at `(x, y-1)` and
`(x, y)` before creating the exterior door event at `(x, y)`. The shared
`stampHouseDoorBackground` clears upper tiles and tile stacks in those two cells;
neighboring walls and the approach/return cell `(x, y+1)` remain separate.
Village door restoration must retain the captured 359/359 pair. Interior exits
and explicitly event-free decorative tile doors keep their existing behavior.
Regression coverage: `test/exteriorDoorBackground.test.ts`.

## Tile brush reliability (2026-09-06)

- `TilePaintEngine.brushStrokePoints` is shared with hover rendering and produces
  exactly N by N cells. Even sizes retain the negative-side anchor: 2 uses
  offsets -1..0 and 4 uses -2..1. Erase and upper-layer empty brushes show the
  same clipped footprint without a tile preview.
- Freehand paint and erase interpolate between pointer samples. Fill, collision,
  event and stamp gestures remain discrete; one undo restores a whole stroke.
- Multi-cell source stamps set `preservePattern` to bypass terrain shaping and
  tree-pair repair, and disable hard cluster expansion. `autoConnect: false`
  alone is insufficient: ordinary autotile brushes still shape in Manual.
  Single-cell stamps keep ordinary terrain/tree brush behavior.
- `mapEditHistory.recordMapEditIfChanged` retains the immutable before-map and
  records history only after an actual synchronous change. Brush strokes use it
  until their first mutation, then bypass comparison. No-op paint/fill/erase,
  rejected stamps and no-op rectangle/ellipse edits preserve redo.
- Toolbar picking and short right-click share the visible-tile policy on lower,
  and current-layer policy on upper, including EMPTY. Explicit `pickTileAt`
  remains layer-specific. Sampling and structure-kit selection reset shape to
  pen; B/1 clears an active stamp like the normal Paint button.
- **Cluster assistance is a second, independent toggle (2026-09-10, OPRN-OUT-017).**
  `autoConnectMode` owns terrain autotile shaping; `clusterAssistMode` (default **on**) owns
  hard-cluster companion placement. Do not route a new "manual" label through `autoConnect`
  alone — that is exactly what made trunks 290-292 look unpaintable. Freehand paint uses
  `freehandPaintOptions`; rejection flows to `clusterAssistRecovery.ts`, which offers a
  one-undo `exactPlacement` write. `exactPlacement` still refuses protected cells and foreign
  upper objects and skips tree-pair repair. Stamps, AI tools and structure kits are untouched.
  Cluster expansion accepts the alternatives (`bAlt`/`aAlt`) the validator accepts: it never
  overwrites or rejects a companion cell that already holds a legal alternative, so dry-tree
  stacks and tables longer than their closed form are paintable by hand.
  Details, the protected-cell cache trap and the `bAlt` parity verdict:
  `openwiki/editor-validation.md`.
- Regression seams: `test/editScenePaintHistory.test.ts`,
  `test/tileBrushState.test.ts`, `test/structureKitBrushConditions.test.ts`,
  `test/clusterAssistRecovery.test.ts`, `test/clusterAssistUi.test.ts`.
  Real browser proof is `scripts/qa/sidebar-brush.mjs`; its fixture is local-only
  and requires disabled remote persistence.

## Combo Brush (2026-09-10, OPRN-OUT-022)

**붓이 «몇 칸을 덮는가» 를 둘이 아니라 하나로 대답하게 한 라운드다.** 물음이 둘로 갈리면
미리보기와 결과가 어긋난다 — 예전에는 호버와 페인트가 각자 `x < map.width` 를 세었다.

### 용어 (코드와 UI 가 같은 말을 쓴다)

| 말 | 뜻 | 어디서 정해지나 |
|---|---|---|
| **Combo Brush (조합 붓)** | 서로 **다른** 칸 2개 이상이 모인 합성 붓. 원본 배열이 정보다. | `isComboBrush(stamp)` = `cells.length > 1` |
| **브러시 크기** | 같은 타일 하나를 N×N 으로 되풀이하는 것. 배열 정보가 없다. | `EDITOR_BRUSH_SIZES`, `brushStrokePoints` |
| **발자국(footprint)** | 원점에 대고 풀어난 칸 목록. 맵 밖 칸도 `inBounds:false` 로 남는다. | `comboBrushPlacement` |

이 둘을 UI 에서 반드시 다르게 보여야 한다. 그 문구의 **유일한 집은 `comboBrushBadge`** 이고,
사이드바 상태칩은 `data-brush-kind` 로 `combo` / `stamp` / `repeat` 를 노출한다. 문구를 두 번째
장소에서 지어내지 마라.

### 소유 경계

- `src/editor/comboBrush.ts` — 순수 모델(store·DOM 없음). 발자국 해석, 경계 판정, 레이어 요약, 배지 문구.
  호버 미리보기(`editSceneHoverPreview`)와 페인트(`TilePaintEngine.applyPaletteStamp`)가 **둘 다** 이걸 태야 한다.
  새 경계 계산을 또 쓰지 마라.
- `src/editor/comboBrushCatalog.ts` — **큐레이션 조합 메타데이터의 정보이자 유일한 집.**
  목록을 다른 파일에 복사하지 말고, 사용하는 쪽은 `curatedComboBrushesForTileset` 를 불러 끔어다 쓴다.
- `src/editor/panels/comboBrushShelf.ts` — 지형 도구 표면의 「조합」 선반. 목록을 **만들지 않고** 그릴 뿐이다.
- `src/editor/panels/tilePaletteCustomGesture.ts` — 팔레트 사각 드래그 제스처 하나. 두 팔레트의 차이는
  «좌표를 무엇으로 읽는가» 뿐이라 `PaletteStampFactory` 하나로 갈라 넣는다:
  커스텀 아틀라스 = 원본 시트 좌표, 기본 팔레트 = **화면 표시 순서**(6열 리플로우, 오토타일 대표 칸 앞).

### 근거 규칙 — 번호 인접으로 추론하지 않는다

타일 번호가 이어져 있다는 사실은 «나무 한 그루» 나 «집 한 채» 의 근거가 아니다 — 칩셋 열이 행을 넘어가면
이웃 번호는 전혀 다른 그림이다. 모든 셀은 `CHIPSET_TILE_GROUPS` 의 실측 멤버십을 `sourceGroups` 로
**인용해서** 짜고, 그 인용을 `test/comboBrushCatalog.test.ts` 가 기계적으로 검사한다:

1. 모든 셀 타일이 그 조합이 인용한 가방 안에 있는가.
2. 선언한 레이어가 `defaultPaintLayerForTile` 의 실제 판정과 같은가.
   (실제 사고: 성 지붕 면을 upper 로 적었다가 이 검사에 걸려 lower 로 바로잡았다.)
3. `dx`/`dy` 가 선언한 `width`×`height` 를 구멍 없이 정확히 채우는가.

### 검토 책임

새 조합은 **타일 콘텐츠 검토 담당(감독)의 승인**을 받고 들어온다. 코드 안의 같은 말은
`COMBO_BRUSH_REVIEW_OWNER` 이고, 그 상수는 이 문서를 가리킨다. 제출할 때 같이 낸다:

- 무엇이 **완결**되는가 (조각을 따로 찍으면 무엇이 망가지는가) — `note` 에 한 줄.
- 셀 타일의 출시(`sourceGroups`)와 그 근거가 된 실측/사용자 확정 기록.
- 계약 테스트 통과 결과. «AI 가 제안했다» 는 근거가 아니다.

목록은 기본 칩셋(combined_town) 전용이다. 다른 칩셋에서는 타일 번호의 뜻이 달라 그대로 쓰면
엉뚱한 그림이 찍히므로 `curatedComboBrushesForTileset` 가 빈 목록을 돌려준다.

### 경계와 진단

- 발자국이 **통째로** 맵 밖 → 거부. 한 칸도 쓰지 않으므로 패턴이 반쪽만 남지 않는다.
- 일부만 잘림 → 허용 + 경고. 경계에 붙여 찍는 것은 정상 저작이고, 맵 안 칸은 전부 원본 배열대로 들어간다.
  호버 미리보기는 잘리는 칸을 **붉게** 표시한다 — 누르기 전에 보여야 한다.
- 구조 킷의 `kit.ai.placement` hard 조건은 여전히 `checkKitStampConditions` 가 본다. 두 검사는 서로를
  확장하지 않는다(OPRN-OUT-017 과 같은 경계).
- 한 번 배치 = 되돌리기 한 단위. `paintTilesBulk` 한 번 + `recordMapEditIfChanged` 규약 그대로다.
- 붓은 해제하거나 다른 붓을 고를 때까지 **살아 있다** — 반복 배치의 전제다.

### 회귀 이음줌

`test/comboBrushCatalog.test.ts`(목록 계약), `test/comboBrushPlacement.test.ts`(실제 페인트 경로 —
배열 보존·레이어 라우팅·경계·되돌리기·진단·호환), `test/comboBrushPaletteUi.test.ts`(제스처·선반·배지).
실브라우저 증거는 `scripts/qa/combo-brush.mjs` → `verify-shots/oprn-022/`. 그 픽스처는 지역 전용이고
원격 지속성이 꺼져 있어야 한다(sidebar-brush QA 와 같은 규약).

**2026-09-07 project wiki:** read [project-wiki.md](project-wiki.md) before changing
world-document AI integration. The former blanket exclusion is superseded by
awaited editor-owned wiki checkpoints, sourced relevant retrieval and combat
authoring. Generic world CRUD and blanket lint/digests remain excluded.

## Pre-edit routing

### 명명 로케이션 레이어 (2026-09-10)

맵에 **이름 붙은 구역**을 그리는 층이다. 캔버스 툴바의 `map-location-layer-toggle` 「로케이션」이
켜고 끄며, 꺼져 있으면 오버레이가 `pointer-events: none` 이라 타일 편집을 한 픽셀도 막지 않는다.

- 소유 파일: 순수 규칙 `src/project/mapNamedLocations.ts`, 드나듦(enter/leave) 판정
  `src/project/locationTransitions.ts`, 참조·복구 `src/project/mapLocationReferences.ts`,
  편집기 상태·store 편집 `src/editor/mapLocationLayerState.ts`, DOM 오버레이·인스펙터
  `src/editor/mapLocationLayer.ts`, 라벨 문장 `src/editor/mapLocationLabels.ts`,
  **쓰는 지점의 빈 상태 행동** `src/editor/locationDrawCta.ts`,
  조수 툴 `src/editor/tools/mapLocationTools.ts`, 스타일 `src/styles/editor/map-location-layer.css`.
  켜진 동안의 도구 양보는 `src/editor/locationDrawMode.ts`.

- **켜진 동안은 구역 그리기 도구다 (2026-09-11, 같은 날 보강).** 브러시 `is-active` 를 끄고
  토글은 「구역 그리기」로 바뀐다. **도구 전이는 감시자 하나가 잡는다** —
  `installLocationDrawModeGuard()` 가 켠 순간의 도구를 기억하고, 다른 도구로 넘어가면 끈다.
  팔레트 칸·사이드바 레이어·구조 킷·건축 팔레트가 각자 끄지 않는다: 그렇게 한 줄씩 붙이던
  1차 구현은 팔레트와 `leftLayerSwitcher` 를 빠뜨려 「타일을 골랐는데 클릭이 구역을 만드는」
  상태를 남겼다. `editorState.set({ tool })` 를 직접 쓰는 진입점이 열 곳 남짓이라 목록으로는
  다음 진입점이 조용히 빠진다. **팬은 기준선을 바꾸지 않는다** — 지도를 보려고 밀었다가
  돌아온 사람에게서 그리기를 빼앗으면 안 된다. 도구 state 는 그대로 두므로 끄면 직전 브러시가
  바로 돌아온다.
- **같은 칸 클릭은 구역을 만들지 않는다**(`isLocationDrawClick`). 1칸짜리(문·단상)는
  **Shift+클릭**이 명시 통로다 — 없으면 8×6으로 그린 뒤 인스펙터 숫자를 1로 줄여야 했다.
- 0개일 때 맵 위 `map-location-empty-ghost` 「여기를 드래그」가 다음 행동을 그린다.
  **고스트도 카메라 계약을 따른다** — `repositionMapLocationLayer()` 가 상자·설계 고스트와
  함께 이것도 옮긴다. 빠뜨리면 팬 한 번에 점선 상자가 맵 밖으로 나간다(같은 날 실측).
- 인스펙터 참조 0건은 쓰는 법을 말하고, N건은 사이트 버튼으로 이벤트 편집기·맵 설정 인카운터·
  자료집(공통 이벤트·부대)을 연다. **참조 수와 목록은 현재 맵만 센다** — 로케이션 ID 는 맵마다
  다시 쓰이므로(`loc1`) 프로젝트 전량을 세면 「참조 3건」 옆에 버튼 하나만 서는 거짓말이 된다.
  같은 이유로 `repairMapLocationReferences(project, id, plan, mapId)` 의 네 번째 인자가
  편집기 복구 경로에 필수다 — 없으면 다른 맵의 **다른 장소**를 함께 고친다.
- **도구 켜짐은 localStorage 에 남는다.** 새로고침·다음 방문에 그대로 켜진 채 열리므로
  감시자는 설치 시점의 도구를 기준선으로 잡고 시작한다(첫 상태 변화에 곧바로 꺼지지 않는다).
- **그리는 동안 패널을 다시 짓지 마라.** `subscribeLocationLayer` 는 선택·드래그 미리보기까지
  받으므로, 그 안에서 `scheduleFullPanelRefresh()` 를 부르면 pointermove 마다 좌측 팔레트·맵
  트리가 재조립된다. `editor.ts` 는 마지막으로 반영한 `enabled` 와 다를 때만 툴바·패널을 다시
  짓는다(2026-09-11 실측).
- **`layoutPlan.regions` 를 사람이 편집하는 층으로 쓰지 마라.** `setMapLayoutPlan` 이 통째로
  갈아치우므로 사람 편집이 재시공에서 사라진다. 관계·승격 계약은
  `openwiki/runtime-project-schema.md` 의 「명명 로케이션 레이어」 절이 소유한다.
- **오버레이 기하는 카메라를 통해 변환한다.** 오버레이는 `.phaser-container` 전체를 덮고 그 안의
  캔버스는 스크롤·중앙정렬·`worldView` 만큼 어긋나 있다. `x * TILE * zoom` 만 쓰면 상자가 맵과
  어긋난다(실측: 드래그 미리보기가 커서에서 500px 떨어졌다). `regionClientRect` 등록소의
  `resolveRegionClientRect`(타일→화면)와 `resolveClientPointTile`(화면→타일)를 쓰고, 둘 다
  `EditScene.create` 가 꽂는다. 등록 전(부팅 중)에는 null 이므로 제스처를 시작하지 않는다 —
  브라우저 QA 는 `__oprnEditWorldToClient` 를 기다린 뒤 시작해야 한다.
- **캔버스·카메라 제스처는 오버레이가 아니라 캔버스의 것이다 (2026-09-11).** 오버레이는 포인터의
  **표적**이라 그 아래 캔버스는 `pointerdown` 을 아예 받지 못한다. 그래서 켜 둔 동안 「화면 밀기」
  도구·스페이스 팬·가운데 버튼·우클릭 영역 제스처(AI 영역 채우기)·선택 도구 맵 밖 드래그·붙여넣기
  미리보기 클릭이 동작하지 않고 오버레이의 «빈 곳 그리기» 로 흘러들어 구역을 만들거나 옮겼다.
  순수 판정기 `src/editor/canvasPointerOwnership.ts` 의 `resolveCanvasGestureOwner` 와
  `src/editor/canvasPointerBridge.ts` 의 `claimCanvasPointer` 가 제스처 소유권을 중재한다.
  여기에는 두 가지 실측 트랩이 있다: (1) `pointerdown` 을 `preventDefault()` 하면 브라우저가
  그 포인터의 호환 마우스 이벤트(mousedown/mousemove/mouseup)를 통째로 삼켜 Phaser 가 드래그를
  잇지 못한다 — 그래서 `"region"` 제스처는 `preventDefault` 하지 않는다; (2) 영역 제스처 동안
  오버레이는 `.is-yielding`(`pointer-events: none`)으로 물러나 캔버스가 드래그 추종을 이어받고,
  `mouseup`(capture)·`pointercancel`·`blur` 및 동기 복원에 따른 mouseup 유실을 막기 위해
  한 매크로태스크 지연된 `pointerup` 에서 복원한다. 휠은 캔버스로 그대로 전달한다.
- **상자는 카메라를 따라간다 — 다시 그리지 않고 좌표만 다시 쓴다.** 손 팬·휠·스크롤바·프로그램
  팬이 모두 `EditScene.afterCameraMoved` 를 지나고, 거기서 `repositionMapLocationLayer()` 가
  상자·설계 고스트의 `left/top/width/height` 만 갱신한다. 인스펙터는 그대로 둔다 — 팬 중에 이름을
  입력하고 있을 수 있다. 이 호출이 없으면 상자는 화면에 남고 타일만 미끄러진다.
- **Escape/Delete 는 모달이 열려 있으면 물러난다**(`hasOpenModalLayer`). 이 층은 캔버스 위의 비모달
  표면이라 위쪽 창의 취소 키를 훔치면 안 된다. 오버레이는 `document.body` 가 아니라
  `.phaser-container` 자식이므로 `modalEscapeLayerGate` 대상이 아니다.
- 모든 편집은 `store.update(..., { scope:"map", mapId, label:"로케이션 …" })` + 저작 단위
  `recordProjectSnapshot` 을 지난다(editor-observability 라벨 계약).
- **구역에 드나들 때 이벤트를 돌리는 트리거**(`{ kind:"locationTransition" … }`, 2026-09-10)는
  이 층 위에 얹혀 있다. 저작 표면은 이벤트 편집기의 「시작 방식」이고 소유 파일은
  `src/editor/locationTriggerAuthoring.ts` 다 — 계약은 `openwiki/editor-event-authoring.md`
  의 「구역 드나듦 트리거」 절과 `openwiki/runtime-project-schema.md` 의 같은 이름 절.
  **삭제된 구역의 진단·복구는 조건과 같은 통로를 쓴다**(끊긴 참조 패널·`map-location-missing-ref`).
- 브라우저 QA: `npm run dev:worktree` 뒤
  `MAP_LOCATION_QA_URL=http://127.0.0.1:<포트> node scripts/qa/map-location-layer.mjs`
  → `verify-shots/oprn-020/SUMMARY.md`. 우클릭 영역 선택·붙여넣기 확정·선택 도구 맵 밖 팬·제스처 중 레이어 끄기 등 실측 엣지 단계를 포함한 16개 단계가 실 브라우저 이벤트 경로로 검증된다.
- **어포던스 감사 + A 적용(2026-09-11):** 이 층의 효용이 «쓰는 지점» 에서 안 읽힌다는 실측과 후보 수정
  (A/B/D 적용, C 미적용)은 `openwiki/location-layer-affordance-audit.md` 가 소유한다. 빈 상태의 행동은
  `src/editor/locationDrawCta.ts` 하나가 내고 조건 폼·트리거·인카운터가 그걸 부른다 — 새 표면이
  생기면 여기에 줄을 더하지 말고 이 모듈을 불러라. 라벨·문구를 갈아치우기 전에 그 문서를 읽어라:
  문구 고정 테스트(`test/locationTransitionAuthoring.test.ts`)와 용어 정본이 걸려 있다.

### 로케이션 역할과 겹침 클릭 (2026-09-12)

로케이션이 **맵 시스템의 저작 표면**이 된다. `safeZones`(추격자 안전지대)와 `farmableArea`
(경작지)는 런타임에서 오래 동작했지만 사람이 그릴 표면이 없었다 — 조수 툴과 코드가 좌표를
찍어 넣고 검사기는 개수만 보여 줬다. 이제 구역에 역할을 주면 그 사각형이 그 배열로 투영된다.

- 소유 파일: 순수 규칙 `src/project/locationRoles.ts`, 스키마 `GameMap.locationRoleProjection`,
  검증 `shapeEventFields.validateLocationRoleProjection`, 상태 `setLocationRole`,
  인스펙터 역할 선택기(`map-location-role-<role>`), 스타일 `map-location-layer.css`.
- **정본은 로케이션 한 방향이다.** `safeZones`/`farmableArea` 는 투영이고, 기록에 없는 항목은
  손 저작·조수 툴의 것이라 **절대 지우지 않는다**. 추격자 툴(`make_chase_scene`)과 경작 툴이
  이미 그 배열을 직접 쓰므로 그 툴들을 로케이션 생성으로 바꾸지 마라.
- **투영 기록은 맵에 둔다(`locationRoleProjection`).** 로케이션 쪽(`origin`)에 두면 구역을
  지웠을 때 표시도 함께 사라져 옛 사각형을 식별할 수 없고, `safeZones` 에 **유령이 남는다**
  (2026-09-12 브라우저 QA 가 실측으로 잡았다). 기록은 로케이션 ID → 마지막 투영 사각형이다.
- **재투영은 `editMap` 한 곳에서 부른다.** 구역 만들기·옮기기·크기·삭제·역할 토글이 모두
  그 함수를 지난다. 이동 경로에만 붙이면 삭제가 유령을 남기고, 삭제에만 붙이면 이동이 남는다.
  이동 뒤 재투영을 빠뜨려 QA 가 «옛 자리에 그대로» 를 잡은 것이 이 조항의 근거다.
- 역할은 **하나만** 갖는다(`tags` 의 전용 낱말). 둘을 겹치면 어느 배열의 정본인지 흐려진다.

#### 로케이션과 이벤트가 같은 칸에서 만날 때 (클릭 소유권)

순수 판정기는 `src/editor/locationPointerPriority.ts` 하나다. 같은 판정을 오버레이의
`pointerdown` 과 캔버스의 더블클릭 경로가 함께 쓰므로 if 를 복사하지 마라.

- **한 번 클릭은 구역의 것이다.** 그 칸에 NPC 가 서 있어도 마찬가지다 — 면을 칠하려는 사람이
  이벤트 하나 때문에 막히면 그리기 도구 자체가 못 쓰게 된다.
- **Alt+클릭 또는 더블클릭은 그 칸의 이벤트를 연다.** 도구를 끄고 레이어를 옮기고 다시 찾는
  3단계를 한 번의 클릭으로 줄인다. 오버레이는 `openEventFromCanvas` 로 손을 떼고 캔버스에 넘긴다.
- **클릭 수는 시각 기반이다.** `pointerdown` 의 `detail` 은 이 저장소 실측(2026-08-11)에서
  **항상 0** 이다. `locationClickCount` 가 500ms 같은-타일 규칙을 쓰고, 그 상수는 `EditScene`
  의 `EVENT_LAYER_DOUBLE_CLICK_MS` 와 같은 값이어야 한다(같은 손놀림에 같은 답).
- 이벤트 판정은 캔버스가 한다(`eventIdAt` → `eventIdCoveringClientPoint`). 편집 중 초안
  (`editorWorkingEvents`) 을 아는 쪽이 씬이라, 오버레이가 store 를 직접 읽으면 «보이는데
  안 잡히는» 칸이 생긴다.
- 브라우저 QA: `LOCATION_ROLES_QA_URL=http://127.0.0.1:<포트> node scripts/qa/location-roles.mjs`
  → `verify-shots/loc-roles/`. 회귀: `test/locationRoles.test.ts`, `test/locationPointerPriority.test.ts`.

### 설계 영역 이관 도구 (LOC-ADOPT, 2026-09-10)

### 로케이션 앵커 — 좌표 대신 이름으로 가리키기 (2026-09-12)

인카운터(`conditions.locationId`)가 이미 하던 일을 필드 스폰과 퀘스트로 넓힌다. 소유 파일은
순수 해석기 `src/project/locationAnchors.ts` 하나이고, 소비자는 각자 그걸 부른다.

- **추가 필드다. 좌표를 지우지 마라.** `FieldSpawnDef.locationId`,
  `PickupSpec`/`DropSpec`/`BlockerSpec`/`reach`/`QuestGate` 의 `locationId` 는 전부 optional 이고
  `x`/`y`(스폰은 `area`)가 그대로 남는다. 이유 셋: 옛 저장본이 그대로 돌고(마이그레이션 없음),
  구역이 지워지면 lint 가 끊김을 올리는 동안 옛 좌표로 계속 동작하며, 로케이션이 하나도 없는
  맵에서는 좌표가 유일한 길이다.
- **둘 다 있으면 `locationId` 가 이긴다** — 인카운터와 같은 규칙이다.
- **앵커는 구역의 중심 칸이다**(`locationCenter`). 목적지·블로커·게이트가 좌표 한 점을 요구하기
  때문이다. 통행 조정(`resolveEventPlacement`)이 한 칸 옮길 수 있고 그건 경고로 보고된다 —
  QA 단언도 «정확한 중심» 이 아니라 «구역 안» 을 계약으로 잡는다.
- **해석기는 맵을 명시로 받는다.** 로케이션 ID 는 맵 안에서만 유일하고(`loc1`), 퀘스트 목적지는
  다른 맵의 구역을 가리킬 수 있다. 맵을 안 좁히면 다른 장소를 집는다(참조 수 집계에서 같은
  함정을 이미 실측했다 — `countLocationReferences` 의 `mapId` 인자).
- **필드 스폰은 `normalizeFieldSpawn(project, map, spawn)` 에서 푼다.** 런타임 진입이 두 곳
  (`createFieldSpawnRuntime`, `addFieldSpawnEntry`)이라 정규화 한 곳에서 풀어야 갈라지지 않는다.
  저작 툴은 `parseFieldSpawn` 에서 이름을 같은 맵 로케이션으로 해석하고, 못 찾으면 오류다 —
  오타를 조용히 좌표로 되돌리면 «구역을 옮겼는데 스폰이 안 따라오는» 상태를 디버깅하게 된다.
- **퀘스트는 `placeQuestEvent` 한 곳에서 푼다.** 대화 NPC·전투 블로커·도달 지점·수집물·드롭·
  게이트가 모두 그 함수를 지난다. 호출부마다 붙이면 다음 단계 종류가 조용히 빠진다.
- 툴 스키마는 `questToolSchemas.ts` 의 `position` 하나를 넓혀 reach·pickup·drop·blocker·gate·기버
  NPC 가 한꺼번에 앵커를 받는다.
- 회귀: `test/locationAnchors.test.ts`(9건). 브라우저 QA:
  `LOCATION_ANCHOR_QA_URL=http://127.0.0.1:<포트> node scripts/qa/location-quest-anchor.mjs`
  → `verify-shots/loc-anchor/`.

빌더 `layoutPlan.regions` 를 명명 로케이션으로 **일괄** 옮기는 창. OPRN-OUT-020 이 미뤄 뒀던
항목이고, 자동 승격은 여전히 없다 — 사람이 보고 고르는 수단이 생겼을 뿐이다.

- 소유 파일: 순수 규칙 `src/project/mapLocationAdoption.ts`, 상태 `src/editor/mapLocationAdoptionState.ts`,
  창 `src/editor/panels/mapLocationAdoptionPanel.ts`, 조수 툴 `src/editor/tools/mapLocationTools.ts`
  (`survey_layout_adoption` → `adopt_layout_regions`). 계약 원본은
  `openwiki/runtime-project-schema.md` 의 「명명 로케이션 레이어」 절.
- **여기에 「전부 승격」 버튼을 다시 만들지 마라.** 로케이션 레이어 인스펙터에 있던 «이 맵 전부
  한 방에» 버튼은 무엇이 생기는지 보여 주지 않아 되돌리기 전에는 검토가 불가능했다. 그 자리에는
  이 맵의 조사 한 줄(`map-location-adopt-survey`)과 창을 여는 버튼만 남겼다
  (testid `map-location-adopt-regions` 는 유지 — 진입점의 자리는 같다).
- **기본 역할을 넓히려면 근거를 코드에서 가져와라.** `DEFAULT_ADOPTION_ROLES` 는 `plaza`/`market`
  이고, `house` 를 넣으면 한 마을에 사용자-가시 이름 20~40개가 한꺼번에 생긴다
  (`houseProtection.ts:53`, `villageEvaluate.ts:704` 가 그 낱말을 시공 사실로 읽는다).
- **되돌림 함정(실측):** 무변경 실행에서도 `recordProjectSnapshot` 을 부르면 두 번째로 누른
  사용자의 Ctrl+Z 가 **빈 스냅샷**으로 가서 승격이 남는다. `runAdoption` 은 복제본으로 먼저
  예행하고 no-op 이면 스냅샷을 밀지 않는다. 비슷한 «확인용 재실행» 이 있는 행위는 같은 걸 하라.
- 창은 `document.body` 에 붙으므로 반드시 `registerModal`/`unregisterModal` 을 짝지어 쓴다
  (`test/modalEscapeLayerGate.test.ts` 가 강제한다).
- 브라우저 QA: `DEV_SERVER_PORT=<포트> npm run dev:worktree` 뒤
  `ADOPTION_QA_URL=http://127.0.0.1:<포트> node scripts/qa/map-location-adoption.mjs`
  → `verify-shots/loc-adopt/SUMMARY.md`. **포트를 명시로 넘겨라** — dev 스크립트가
  node_modules 정션을 통해 본 저장소의 `.env.local` 을 읽을 수 있다.

### Standard / Expert focus modes (2026-09-07; supersedes sidebar density notes below)

- Standard `mapTree=false` means a focused, always-mounted tile/event task host,
  not an empty maps-only layout. `resolveLeftDockPanels` pins that host without
  overwriting stored Expert docks. Standard does not offer ineffective dock
  toggles. Expert retains its tree auto/manual height, splitter and collapse.
- `sidebarMapHeader` renders current map and map settings above common layers.
  Standard opens `renderMapList(..., {variant: "switcher"})`: the existing
  two-column map explorer, with search always available and no dock-collapse
  coupling. Expert reveals its existing tree; if its map dock was disabled it
  uses the same explorer. No duplicate map IDs/selection implementation.
- Paint/erase/fill/select and undo stay primary. Expert adds direct eyedropper.
  `tileToolOptions` supplies labelled Tools, clipboard, pan/collision and the
  Standard shape select; Expert has the same shape select beside brush options.
  Shape choices call the existing `selectTileTool`, preserving reset behavior.
- Beginner keeps its existing brush buttons and rail behavior. Standard/Expert
  use a unique `brush-size-select` only for freehand paint/erase (no active stamp
  or shape paint). Size is retained when hidden. Event owns its surface with no
  duplicate event tool or tile search/brush controls. Layers remain in the same
  position before and after a layer/mode change.
- `tile-category-select` beside search replaces category chips; it uses the same
  filter state/calculation. Reset clears both filters and focuses search. Native
  atlas geometry, tile selection, stamp gestures and sheet scroll are unchanged.
- `tileToolbarMenus` owns one labelled inspection/history menu and issue badge.
  Expert pin checkboxes store command IDs per mode under
  `oprn:sidebar-inspection-pins:<mode>`; pinned commands leave the menu action
  list and become direct labelled buttons. Ctrl+K `sidebar-inspection-*` commands
  open that same state. Storage failure retains session pins and logs a warning.
- `sidebarSurface` owns bounded nonmodal map/tools/brush-assist/structure-kit
  overlays: outside dismissal, Escape including search, opener focus, viewport
  anchoring and mutually exclusive surface opening. Mode changes dismiss them.
  Assist/kit expansion never consumes sheet height. Connection state remains
  visible; selected-tile reveal/properties and tileset-to-map-settings route stay
  compact below the sheet. No automatic onboarding or project persistence edits.
- CSS remains in `left-sidebar.modern.css`; measurements use the actual
  `.chipset-sheet` viewport, not its ancestors. Acceptance: Standard >=70% of
  sidebar height at 1440x900 and Expert >=40% (raised from 60% after the
  2026-10 compact pass merged the map/layer context row); 1024x768/1280x800/1440x900
  have no clipped chrome or toolbar horizontal scroll and >=520px canvas. Parent owns
  whole gates/build and independent visual/ultrabrain acceptance. Evidence and
  reproducible driver: `output/evidence/sidebar-focus`, `scripts/qa/sidebar-focus.mjs`.
- Regression seams: `sidebarFocusModes.test.ts` (real DOM/state, shape/size,
  search, pin storage, command access, focus), retained `sidebarModeWorkflow`,
  `sidebarBrushUi`, map/dock, toolbar and keyboard suites. Presentation assertions
  follow moved controls without removing actual state/reset/undo coverage.
- R1 ownership repairs: the actual `mapContextMenu` registers with `modalStack`
  and uses `--z-popover-high`, so body-mounted child actions retain the explorer
  and Escape returns to the originating row. Its old deferred row-focus job is
  removed: it stole focus from keyboard menu navigation. Surface mode cleanup
  calls real teardown, even if editor rendering subscribed first; dock remount
  closes ownership and editor teardown detaches surface listeners.
- `revealMapInDock` owns collapse markup, ancestor expansion/filter reset and
  current-row focus. Inspection command dispatch first activates a missing Tiles
  host through workspace state, then `openSidebarInspection` opens/focuses the same pinned/unpinned
  surface. Tests: `sidebarFocusR1.test.ts` plus real-browser
  `scripts/qa/sidebar-focus-r1.mjs` (Beginner/Standard-first Ctrl+K, actual context
  menus, persisted collapse, and all three inspections from maps-only reload).
- Rename settles Enter/Escape before removing its focused input: the resulting
  blur cannot commit a cancelled draft or repeat a completed edit.

### Automatic usage guides disabled (2026-09-06)

- Editor rendering and post-welcome boot paths no longer automatically invoke
  beginner coach marks or the standard-mode usage card. Do not restore these
  calls when changing mode/boot orchestration.
- First-visit mode selection, project selection/creation and ordinary Help stay
  available. No storage flag is prefilled to pretend that the user saw a guide.
- `test/e2e/no-auto-guides.spec.ts` checks fresh beginner/standard sessions,
  usable paint/erase controls, mode switching and untouched guide-seen keys.

### Sidebar mode workflow (2026-09-06; supersedes older 72px/tile-flyout notes below)

- Only Maps remains a nonmodal flyout (`basic-rail-toggle-maps`). Pin, outside dismissal, Escape and opener-focus restoration remain. Its width is clamped against the new panel width. `paletteRail` still pins the tiles dock host; no persistence migration or workspace key changes are required.
- Beginner rail bottom inline map field (2026-09-18): `basic-map-field` shows up to 5 tree-ordered maps + `+ 새 맵` + `맵 전체 보기` below the tile sheet — no toggle needed. Row click = `selectEditorMap`, add = `openMapCreateDialog`, more = maps flyout. The tile sheet scrolls inside the rail section (`overflow:hidden` on `.basic-rail-section`, `max-height:100%` on the sheet) so the field stays visible. Tab stops unchanged (field uses a native listbox, not the roving-button groups). Regression: `test/basicLeftRail.test.ts` inline-field cases. Evidence: `verify-shots/sidebar-map-field/beginner-left-panel-map-field.png`.
- CSS `--basic-rail-width` owns the 288px geometry; `editor.ts` has the matching pre-layout fallback and still derives `--editor-left-safe` from measured width. The supported 1024px viewport trades 216px of the former narrow rail's canvas for persistent materials; browser acceptance must retain at least the existing 520px canvas minimum, not claim increased canvas area.
- Standard retains daily tools plus labeled More. Expert's `advancedSidebarControls` flag adds direct labeled inspector/rule-audit/history dropdowns via existing `tileToolbarMenus.ts` renderers. Expert More retains copy/paste but never duplicates those three actions or their IDs. Direct dropdowns use the existing viewport anchoring and return Escape focus to their own trigger. Mode changes dismiss open menus.
- `makeTileBrushControls` owns always-visible, unique `brush-size-1..4` controls and active tool/shape/stamp/layer status in every mode. Sizes no longer live in More. The size group adds one roving tab stop; beginner Paint uses the shared stamp-reset action.
- The shared palette preserves source column geometry. Default autotile selection projects the picked variant to its displayed representative for filtering, pressed state and roving focus without changing the paint tile. Custom atlas dragging resolves a source-coordinate stamp once on pointer release through `installCustomPaletteGesture`; pointer cancel, scroll, blur, outside release and detached sheets cannot commit.
- Beginner search reports true match count, explains its retained out-of-filter selection, and restores search focus after reset. `basic-tile-search-feedback`, `basic-tile-search-reset` and `custom-palette-grid` are the browser QA hooks.
- Beginner undo calls `undoMapEdit` and refreshes on `MAP_EDIT_HISTORY_EVENT`; there is no separate history stack. Tool/layer/panel/brush groups and the tile grid each retain one roving tab stop. Brush and history contracts are described above.
- New/modified chrome uses existing tokens and SVG icons. Touched selected-tile/tileset-name, auto-connect and map-menu targets have a 24px minimum; new labeled utility controls use 32px. Standard/expert sheet and map-height allocation remain owned by the existing layout.
- The wrapping toolbar uses `flex: 1 1 0` for its daily-tool group so More stays beside it rather than consuming another row. `fitMapTreeHeight` derives a minimum from measured map chrome plus up to 108px of list content; the preferred tile-sheet reserve cannot starve a multi-map list when expert controls add height. The adversarial E2E preserves this minimum and subscribes to resize/layout events before changing the viewport.
- Regression seam: `test/sidebarModeWorkflow.test.ts` exercises actual DOM renderers, editor state, custom atlas cells, map flyout focus, history-backed undo and expert menu uniqueness. History tests subscribe before mutation with a bounded event deadline, not sleeps/polling. Existing atlas/selection/grid-roving and dock-width suites remain regression gates. Evidence is under `output/evidence/mode-ux`; full build/gates/browser acceptance are lead-owned.
- Separate known issue: the baseline audit's 1024px topbar save-error overflow is not addressed by this sidebar increment.


- **조수 답변의 이름 → 내부 이동 링킬 (2026-08-30):** 답변 문장 속 맵·NPC 이름을 눌렀을 때 생기는 모든 일은 네 파일이 나눠 갖는다: 색인·탐색 `src/editor/aiAnswerLinks.ts`(순수), DOM 치환 `src/editor/panels/aiAnswerLinkRender.ts`, 이동 `src/editor/editorReferenceNavigation.ts`, 조수가 직접 화면을 여는 툴 `src/editor/tools/viewFocusTools.ts`(`focus_editor_view`). 상세·함정은 `openwiki/editor-ai-panel.md` 첨 항목 — 링킬을 마크다운 링킬 문법이나 `renderMarkdown` 자식으로 재구현하려면 반드시 그 항목을 먼저 읽었음을 전제로 한다(정책이 내부 ID 노출을 금지하고, 문법 기반은 지나간 대화에 링킬을 걸지 못한다).


- **편집 계측·감사 로그·오류 트랩 (2026-08-29):** 상세는 `openwiki/editor-observability.md`. 요약: 상태를 바꾸는 store 메서드 5개(`update`/`updateMap`/`replace`/`clearAll`/`restoreEventDraftFromVault`)가 전부 `markLocalMutation` 을 지나므로 mutation 호출부 전량(2026-08-29 실측 277)이 자동 계측된다. **새 편집 기능은 `store.update(mutator, { scope, label, … })` 에 라벨을 넣어라** — 안 넣으면 `__oprnUnlabeledEditCount()` 에 잡히고 로그에 `(라벨 없음: …)` 로 남는다. AI·툴·시스템 경로는 `origin` 을 명시한다(생략 시 `"human"` 으로 오귀속). `fields` 는 호출자가 **이미 계산해 둔** diff 만 넘긴다 — 초크포인트에서 diff 를 계산하면 페인트 스트로크마다 전 맵 비교가 돌아 병목이 된다(선례: `eventDraftActions.saveEventDraft` + `eventDiffLabel.ts`). 되돌리기 스택(`mapEditHistory`: before 스냅샷·dedup·50건·휘발·폐기 가능)과 감사 로그(`editActivityLog`: after 포함·전량·500건·영속·불변)는 요구가 정반대라 분리돼 있으니 겸업시키지 말고, 모달 드래프트 편집에 `recordProjectSnapshot` 을 넣지 마라(스냅샷 1건은 적용 시점에만). 조사 수단: 콘솔 `__oprnEditActivityText()` / `__oprnLogs({minLevel:"warn"})` / `__oprnErrors({excludeResource:true})`, 디스크 `npm run edit:log` + `output/edit-activity/edits.jsonl`. AI 턴은 별 채널(`npm run ai:log`, `output/ai-activity/`).
- **Editor UI mode (초보/표준/전문가):** `src/editor/editorUiMode.ts` owns `beginner` | `standard` | `expert` (parse/storage default **standard**; real first visit with no stored key pins **beginner** via `applyFirstVisitEditorUiMode`), `localStorage` key `oprn:editor-ui-mode`, matching body classes, and the full `EditorChromeVisibility` contract: `mapTree`, `toolStrip`(전문가 인라인 도구 버튼; 2026-09-03 까지 `classicToolbar`), `canvasChromeDense`, `helpMenu`, `gameMenuLabel`, `paletteRail`, `leftPanelMaxWidthPx`, `layerTermStyle`, `prominentTestPlay`, `coachMarks`, `standardWelcome`, `statusbarDensity`, `databaseNav`, `eventBeginnerChrome`, and `jargonStyle`. Legacy `basic` storage values load as `beginner`. Topbar brand is **AI RPG MAKER** (`EDITOR_PRODUCT_BRAND`) with the three-button `editor-ui-mode-toggle`; inactive buttons stay visible at every desktop width. **Beginner** uses persistent-label 72px direct-action rail/flyouts, plain terminology, guided event chrome, and the Database `common` subset. **Standard** exposes the full palette/map tree, dense canvas controls behind `editor-canvas-toolbar-expand`, grouped Database navigation, and plain terminology. **Expert** adds the classic toolbar, dense canvas controls, technical terminology, and all Database navigation; visible toolbar controls work, while unsupported `.classic-toolbar-stub` controls remain hidden. `uiDensity` DOM values are `beginner`|`expert`|`play`|`shared`. E2E contract: a real first visit with no stored mode is beginner; automation URLs `blankProject` / `freshProject` / `devProject` remain standard unless a spec stores a mode. Project state, history, camera, and AI session are shared across transitions. The edit header additionally exposes **AI 설정** (`topbar-ai-settings`) without replacing any established menus, workspace controls, test controls, or classic toolbar. Shell apply: `src/editor/panels/editor.ts` (`applyEditorUiModeLayout`) and `src/editor/panels/menu.ts`; styles: `src/styles/shell/editor-ui-modes.css`.
- **Bottom statusbar retired (2026-08-25):** `renderEditor` does not mount `.editor-statusbar` at all. This removes every former bottom-row field/action, including layer/map/tile/tool/zoom/cursor details, online-save, layout-blueprint, and AI-connection controls; the canvas reserves `0px` at the bottom. Map-lock conflicts remain visible through the canvas-top `.map-lock-banner`, and zoom remains available through the canvas toolbar. Do not interpret this as permission to remove the top menubar, workspace controls, test actions, classic toolbar, or build-palette AI action.
- **Authoring journey chip (2026-08-25):** the persistent 5-column bottom strip is gone. `authoringJourneyStrip.ts` mounts a 32px checklist icon at the canvas bottom-left (`authoring-journey-toggle`); the stage list opens as a popover. Map/Event/Data/Test actions stay on the topbar launcher. Do not restore the full-width 60px canvas reservation.
- **캐릭터 그림(charset) 프레임 크롭 기하 (2026-08-28):** charset 프레임 크롭은 `applyCharsetFrameCrop()` (`src/assets/charsetFrameCrop.ts`) 만 쓴다. 직접 `width/height/background-size/background-position` 을 쓰면 안 된다. 이유(실측): 전역 리셋이 `* { box-sizing: border-box }` (`src/styles/editor/core.part-1.css:50`) 라서 인라인 크기를 그대로 두면 테두리만큼 **패딩 박스**(=배경 배치 영역)가 줄어 프레임 오른쪽·아래가 잘리고, 배경 배치 영역은 `padding-box` 인데 그리는 범위 기본값은 `border-box` 라서 **테두리 아래로 이웃 프레임 픽셀**이 드러난다. NPC 그래픽 피커 슬롯은 `border: 2px solid transparent` (`event-editor.part-4.css`) 라 100% 노출됐다 — 실측 `.npc-character-cell` 패딩 박스 44x60(48x64 기대), 슬롯 상단에서 위 행 프레임 하단 픽셀 73개 검출. Monster3(몬스터 3)처럼 셀 경계에 불투명 픽셀이 닿는 시트에서만 눈에 보인다(Actor/People 은 0건). 헬퍼가 `content-box` + `background-clip: padding-box` 를 못박고 계약은 `test/e2e/charset-frame-crop-alignment.spec.ts` 가 지킨다. Phaser 프레임 등록(`registerCharsetTextureFrames`, 정수 rect)과 런타임 렌더는 무죄이므로 그쪽을 건드리지 말 것.
- **AI panel collapsed restore:** `ai-collapsed-restore` is a compact button (`aria-label`/`title` = `조수`) with a status dot and a persistent `조수` name. Glass/float use the existing compact chip; side keeps the same name as a horizontal 12px label inside the 48px rail so the rail is never visually blank. No `AI` wordmark, emoji, vertical writing-mode hangul, face graphic, or `.ai-collapsed-restore-rail-label`. Docked/side collapsed width is 48px. The expanded panel has no header band. The log is RM `@>` command rows (`ai-command-row`); idle glass/side Quiet Gold shows ≤2 `@>` hints (`ai-idle-hint-*`), not a visual gallery. Tools live in ⋯ (`ai-more-menu` / command menu), including A/B/C temperature. Non-destructive proposals no longer wait for approval at all: `resolveProposalApplyMode` (`src/ai/approvalPolicy.ts`) applies them immediately and the log keeps the `ai-auto-applied-card` before/after card, with recovery through that card's 되돌리기 or the sidebar `oprn-tool-undo`. Pending proposals — destructive / material-agreement turns, or auto-apply turned off (`autoApprove:false` + `agentMode:"chat"`) — mount the decision card inline in the dock for glass/side/float (no auto-open immersive modal). Canvas-first review can still use `ai-proposal-reopen` on side. Float keeps the card on `ai-proposal-pin-host` above the composer and does not remount the overlay pill. Tile selections show `selection-minibar` on the canvas (꾸미기/길/비우기) without hiding `left-palette-root` / `left-map-root`.
- **Left sidebar always visible (2026-08-26, 2026-08-30 갱신):** 불변식은 "tiles + maps 를 항상 마운트한다" 가 **아니다** — `.left-panel` 은 절대 `display:none` 이 되지 않고 **항상 패널을 최소 1개** 담는다. `applyLayout` must not set `.left-panel { display:none }` for empty-dock or `innerWidth < 720` (`leftCollapsed` 는 저장만 되고 아무도 읽지 않는 죽은 상태였으므로 레이아웃 페이로드에서 뺐다). 실제 목록은 `src/editor/workspace/leftDockPanels.ts` 의 `resolveLeftDockPanels()` 가 정한다: `docks.left` 를 존중하고, 결과가 비면 `preferredLeftDockPanels()` 로 되돌리며, 초보 모드(`chrome.paletteRail`)는 아이콘 레일 호스트인 `tiles` 를 고정한다. 초보의 `maps` 도크 호스트는 저장 구성에 남을 수 있지만 `BEGINNER_CHROME.mapTree=false` 라 렌더되지 않는다. 초보의 `basic-rail-toggle-tiles/-maps` 는 도크 멤버십 토글이 아니라 타일·맵 **플라이아웃 여닫기**다. 따라서 초보에는 `workspace-panel-*` 도크 토글을 메뉴와 Ctrl+K 어느 쪽에도 제공하지 않는다(`isLeftDockPanelOffered`); 예전 고정 타일 행의 「끌 수 없습니다」 설명도 함께 없앴다 — 닫을 수 있다는 컨트롤 자체가 shipped DOM 에 없으므로 별도 설명이 의도적으로 없다. 도크 이동 칩은 `dockZoneHasHost(zone)` 인 zone 만 제시한다. Beginner still uses the **72px** icon rail; that is visible, not hidden. 폭의 원천은 CSS `--basic-rail-width: 72px` 하나이고 `--editor-left-safe` 는 실제 렌더 폭에서 파생한다 — inline `width: 48px` 은 `min-width … !important` 에 지므로 48px 로 되돌리지 마라(14px 한국어 라벨 2줄이 잘린다).
- **좌측 사이드바 모던 레이어 · 맵 도크 자동 높이 (2026-09-03):** 표준·전문가 좌패널(타일·맵 도크)의 겉모습은 `src/styles/editor/left-sidebar.modern.css` 가 **마지막 발언자**다(index.css 에서 map-panel.modern.css 바로 뒤). 옛 `figma-editor/10-map-tree.css` 는 이 파일 §8 로 흡수·삭제됐고 캔버스 셸 규칙만 `11-canvas-toolbar-uxc.css` 로 갔다. 규칙: 토큰만, hex·`!important` 0(래칫), 이기려는 옛 선택자 앞에 `.editor-layout` 을 붙여 명시도로 이긴다. 타일 그리드는 6열 계약을 유지하되 칸 크기를 `--chipset-cell: min(56px, calc((100cqi - 16px) / 6))` 로 **폭에서 계산**한다 — 32px 고정이 시트 오른쪽 ~60px 을 비우던 결함. 도구막대는 가로 스크롤 대신 **줄바꿈**(`flex: 0 0 auto` 필수 — 옛 `min-height:30px` 가 flex 최소 높이를 대체해 둘째 줄이 레이어 전환 위로 겹쳤다), 맵 모드 그룹은 `margin-left:auto` 로 오른쪽. 분류 칩도 줄바꿈(숨은 스크롤이 「장식」 칩을 삼켰다). **맵 도크 높이**는 `editor.ts` 의 `mapTreeAuto`(기본 true, `oprn:editor-layout:v4` 에 저장)가 내용에 맞춘다: `measureMapTreeContentHeight` = 호스트 패딩 + 헤더 + 필터 + **목록 자식 행 합**(목록은 `flex:1` 스크롤 컨테이너라 scrollHeight 가 상자를 되받는다 — 그걸 읽으면 절대 줄지 않는다), clamp(150, min(240, 좌패널 32%, `paletteSheetReserveCap` = 좌패널 − 리사이저 − 팔레트 크롬(호스트 − 시트) − 280)) — 마지막 항이 맵 16개에서 시트를 280px 지킨다(없으면 197px 로 눌려 `palette-tiles-come-first` 260px 하한이 깨졌다). 리사이저 드래그/키보드 → 수동(`mapTreeHeight`), 리사이저 더블클릭 → 자동. 옛 저장본(플래그 없음)은 높이가 300 이면 자동, 아니면 수동으로 읽는다. 맵 패널 내용 변화는 호스트 `MutationObserver` 가 잡아 다시 잰다. **섹션 접기**는 `src/editor/workspace/mapPanelSection.ts`(localStorage `oprn:map-panel-collapsed`)가 상태를 들고, 헤더 제목 버튼 `map-tree-section-toggle`(h3 안의 button, `aria-expanded`)이 바꾸며, editor.ts 구독자가 `--map-tree-height` 를 헤더 한 줄로 줄이고 호스트에 `.is-collapsed`·리사이저에 `.is-disabled` 를 단다. 헤더 액션은 `map-add` 만 `is-primary has-text`(「새 맵」, 맨 오른쪽) — 나머지는 아이콘 고스트 28px. `.map-tree-list` 가 이제 실제 스크롤 컨테이너다(예전엔 호스트 overflow:hidden 뿐이라 맵이 늘면 잘렸다). 계약: `test/mapPanelSection.test.ts`, `test/mapList.test.ts`(토글·주 동작), `test/editorLayoutPersist.test.ts`(자동/수동/옛 저장본). **2026-10 컴팩트 패스:** `.palette-work-pane.is-paint` 는 CSS grid 로 맵 이름+레이어를 한 「문맥 행」에 합친다(DOM 순서는 `editorMenuSidebarIa` 계약이라 그대로). 맵 헤더의 「맵 설정」 단추(세 번째 중복 집 — 선택 칩의 타일셋 이름·맵 목록 행이 같은 `openMapPropertiesDialog` 를 연다), 세 단추가 같았던 레이어 `layers` 글리프, 초보 안내 문구(`basic-paint-guide`)를 뺐다. 컨트롤 리듬은 22~26px.

- **타일 팔레트 개수 정합 (2026-09-14):** 좌패널 필터 바의 수와 분류 셀렉트의 수는 **팔레트가 실제로 그리는 칸**을 세야 한다. 예전에는 `filterTileIndexes(tileset)`(=타일셋 인덱스 일치 수)를 셌고, 팔레트(`makeGridPalette`)는 그 위에 오토타일 대표 축약·변형 숨김·레이어 가시성(`tileVisibleOnLayer`)까지 통과시킨 뒤에 그렸다 — 그래서 표기가 화면과 갈라졌다. 실측(합본 마을 195칸, 표준 모드 300px): 바닥 「울타리」가 「11개 일치」인데 시트는 1칸(11개 중 10개가 오토타일 변형으로 축약), 바닥 「지형」이 「126개 일치」인데 42칸, **덧그림 「지형」·「물」이 「126개 일치」·「48개 일치」인데 0칸**이었다.
  - 단일 출처는 `src/editor/panels/tilePaletteGrid.ts` 의 `gridPaletteVisibleCount(input)` = `gridPaletteDisplayOrder(input).length` 다. 필터 바가 팔레트와 **같은 함수**를 써야 두 답이 갈라지지 않는다. 입력 타입은 그리기 전용 콜백을 뺀 `PaletteFilterView`(layer·tileset·selectedTile·visibleTiles)라 필터 UI 가 콜백 없이 같은 계산을 부를 수 있다.
  - **팔레트 종류에 따라 답이 다르다.** 기본 리플로우 팔레트는 안 맞는 칸을 안 그리므로 그리는 수 = `gridPaletteVisibleCount` 다. 커스텀 아틀라스는 칸의 위치가 정보라 **하나도 숨기지 않고** 안 맞는 것만 흐리게 하므로(`makeCustomPalette`) 화면의 칸은 언제나 전량이고, 셀 수 있는 것은 「맞는 칸」의 수다. `tilePalette.ts` 의 `paletteMatchCount()` 가 이 분기를 한 곳에서 진다 — 둘을 한 함수로 뭉치면 커스텀 아틀라스에서 0이라고 거짓말한다.
  - 표기 문구도 바뀌었다: 「N개 일치」 → **「N칸 표시」**(무엇을 세는지 말한다). 분류 셀렉트 옵션은 「지형 (42)」처럼 **실제로 보일 칸 수**를 이름 옆에 붙인다(`categoryVisibleTileSet` 은 검색어를 섞지 않는다 — 분류 옆 수는 분류의 크기이지 현재 검색의 크기가 아니다). 덧그림에서는 「지형 (0)」이므로 고르기 전에 빈 시트인 걸 알 수 있다.
  - 0칸일 때 빈 상자 문구는 **무엇을 풀면 되는지** 말한다(`makePaletteEmptyHint` → `makeGridPalette` 의 `emptyHint`). 덧그림 레이어의 「지형」·「물」은 하위 레이어 전용 판정(`tileMatchesCategory`: `layer === "lower"` 이고 usage 가 terrain/path/edge/detail)이라 검색어를 지워도 안 풀린다 — 그래서 「바닥 레이어로 바꾸거나 분류를 「전체」로 되돌리세요」라고 짚는다. 문구를 아는 쪽은 레이어를 아는 호출부이므로 그리드가 아니라 팔레트가 넘긴다.
  - 계약: `test/sidebarFocusModes.test.ts` — 「reports the count of cells it actually draws, on both layers」(두 레이어 × 다섯 분류에서 표기 수 == 실제 `.chipset-tile` 수) · 「explains why a bottom-layer-only category is empty on the upper layer」. 증거: `verify-shots/palette-count-fidelity/`(before/after 4쌍 + README).
- **톱바 「▤ 보기」 · 팔레트 칩 진입점 (2026-09-03):** 편집 모드(초보/표준/전문가)·밀도·패널 도크 토글의 집은 톱바 `workspace-panels-button` 메뉴 하나인데, 글리프 「▤」만 있던 동안 사용자가 "진입점이 없다"고 했다. 이제 글리프 + 글자 「보기」(uiCopy `viewMenu`)다 — aria-label/title 은 「패널(화면) 배치와 밀도」 그대로. 팔레트 선택 칩(`selected-tile-status`)의 글자 둘은 **버튼**이다: 타일 이름(`selected-tile-reveal`) → 시트를 그 타일로 스크롤(`revealPaletteTileFromMap`), 타일셋 이름(`palette-tileset-name`) → `openMapPropertiesDialog(mapId, name, { focus: "tileset" })` 로 「맵 설정」을 열고 커스텀 셀렉트 트리거(`data-custom-select-for="map-props-tileset-select"`)에 초점 + `.is-attention` 링 1.6초. 맵의 타일셋을 바꾸는 집은 그 창 하나다 — 칩에 두 번째 선택기를 만들지 말 것. `src/editor/panels/mapPropertiesDialog.ts` 가 맵 트리(더블클릭·⋯)와 팔레트가 공유하는 유일한 오프너다.

- **초보 레일 키보드 모델 (2026-08-29):** `basic-left-rail` 의 세 그룹(`basic-tool-list` = `role="toolbar"`, `basic-layer-list` · `basic-panel-toggles` = `role="group"`)은 각각 `data-roving="true"` 라서 **그룹당 탭 스톱 1개**, 레일 전체 **3개**다(이전 11개). 그룹 내부 이동은 `applyRovingTabindex`(`src/editor/panels/sidebarFocus.ts`)가 위임 처리하는 방향키·Home·End 다. 상호배타 선택(도구·레이어)은 **`aria-current="true"`** 로만 표시하고 비활성 버튼에는 속성을 달지 않는다 — `aria-pressed` 로 "고치지" 마라: 스크린리더가 독립 토글 여러 개로 읽어 초보 모드가 표준 모드보다 나빠진다. 플라이아웃은 포커스를 가두지 않는 비모달이므로 `role="dialog"` 대신 라벨 있는 `role="group"` 이고, 닫으면 `data-focus-fallback-anchor` 가 가리키는 자기 토글로 포커스가 돌아간다(예전엔 `<body>` 로 추락했다). 계약 테스트: `test/basicLeftRail.test.ts`, `test/sidebarKeyboardNav.test.ts`.
- **Left sidebar vs top menu — one canonical home per action (2026-08-26):** the left docked column owns per-second canvas work; the top region owns per-session project/system work. No action appears in both. **Sidebar-owned** (must never be added back to the menubar, the classic toolbar or the trailing cluster): drawing tools (`tool-*`, `oprn-tool-rect`, `oprn-tool-round`), undo (`oprn-tool-undo`), the layer switcher (`layer-lower` / `layer-upper` / `layer-event`), the tile palette (search, category chips, number toggle, brush assist, auto-connect, `selected-tile-props-open`) and the map tree (`map-add`, `map-add-folder`, `map-set-start`, `map-toggle-all`, `map-tree-filter`, `map-tree-facet-*`, row `⋯` menus). **Top-owned:** project lifecycle, the modal editors (database / resources / world / audio / search), AI settings, help, play + battle test, commit history, identity, window controls, and the `▤` workspace menu (standard/expert panel docks, assistant dock, density, edit mode). The Ctrl+K palette searches everything and is exempt, but still filters out dock controls unsupported by the current chrome. Contract test: `test/editorMenuSidebarIa.test.ts`. Audit harnesses: `scripts/probe-editor-surface.mjs` (structure) and `scripts/audit-editor-menu-surface.mjs` (clicks every control in all three modes and reports dead / invisible / duplicate).
- **Menubar shape (2026-08-26):** `프로젝트` / `도구` / `게임` / `도움말`. There is **no 맵 menu** — `새 맵`, `현재 맵을 시작 맵으로` and `현재 맵 삭제` all duplicated the sidebar map tree. `프로젝트` keeps lifecycle plus a `menu-project-samples` submenu holding the nine demo loaders (they used to sit inline, making a 14-row menu) and both exports (`menu-project-export` = project file, `menu-project-export-web` = web game). `도구` is modal editors only — `menu-tools-database` / `-resources` / `-world` / `-audio` / `-search` / `-ai-settings`; undo/redo and the three layer entries were removed because the sidebar owns them. `게임` is `menu-game-play` + `menu-game-battle-test`; `menu-game-test-window` was removed because it called the same `openTestPlayWindow()` as `menu-game-play`. The standard-only `⋯` (`standard-more-tools`) menu is **gone**: it only toggled `hidden` without adding `.open`, so `.oprn-menu-popup{display:none}` kept it permanently invisible, and all four of its entries duplicated `도구`. Edit-mode switching moved to the `▤` menu (`workspace-ui-mode-beginner` / `-standard` / `-expert`), which also makes it reachable from beginner mode for the first time.
- **Left sidebar layer switcher:** `src/editor/panels/leftLayerSwitcher.ts` (`left-layer-switcher`) renders 바닥 / 덧그림 / 이벤트 directly under the tool row in standard/expert, on both the paint pane and the event pane. Beginner keeps the equivalent buttons in `basic-left-rail`. Both surfaces share the layer→tool rule: the event layer turns on the event tool, and returning to a tile layer turns the event tool back into 칠하기. `renderTilePalette` re-renders through `editorState.subscribe(() => refreshPanels())` in `editor.ts`, so the buttons need no explicit rerender callback. Labels come from `uiCopy` (`layerLower` / `layerUpper` / `layerEvent`) — do not retype them.
- **`uiCopy` label collision fixed:** `resources.plain` is `소재` (was `자료`, which collided with `databaseShort.plain` and rendered two identically-labelled menu items). `소재` also matches the classic toolbar's existing `toolbar-resource-manager` label.
- **AI 패널 접기·크기 조절 (2026-08-31 갱신):** 헤더 밴드는 없고 접기는 컴포저 고정 액션 행의 `ai-collapse` 가 소유한다. `oprn:ai-panel-collapsed` 상태기계와 `ai-collapsed-restore` 를 그대로 쓴다. 도크 축(glass/side/float)은 2026-08-31 에 삭제됐다 — 조수는 입력줄 캡슐 하나이고, `ai-resize-handle` 은 항상 `ai-command-bar` 왼쪽 edge에서 **폭만** 바꾼다(입력줄 높이는 textarea 행수가 정한다). 입력줄 위 기록 카드는 그 폭을 상속하고, 상단 `ai-log-resize-handle` 로 높이만, 카드 크롬 `− 100% +` 와 Ctrl/⌘+휠로 글자 크기를 조절한다. 폭은 `oprn:ai-panel-size`, 기록 높이는 `oprn:ai-log-height`. 구 `oprn:ai-panel-size:float` 만 이전용으로 읽는다. 구 side preferred 폭 소유권(`editor.ts`)과 `aiPanelLayout.resolveSideChatWidth` 의 viewport/canvas clamp 는 side 호스트와 함께 사라졌다. 관련 소스: `aiChatPanel.ts`, `aiComposer.ts`, `aiPanelLayout.ts`, `aiChatResizeChrome.ts`; QA: `scripts/qa/assistant-resize-collapse-qa.mjs`(캡슐 1회 측정). 자세한 계약은 `openwiki/editor-ai-panel.md` 의 「조수는 입력줄 캡슐 하나다」·「입력줄 위 기록 카드는 같은 폭이고」 항목.
- **AI chat chrome (TUI-compact):** header title + 竊??????묎린. **Assistant skills removed (2026-08-27):** no slash skill list, skill drawer, or skill palette section — the composer is free text + send, and a leading `/` is ordinary text. Game skills (battle/life/`database.skills`) are unrelated. **Start:** empty hint. **Bottom bar:** compact mono input; idle status hidden; side hides bottom ????
- **AI panel layout/default (2026-08-31 갱신):** 레이아웃 저장에는 도크 필드가 없다 — 도크 축(glass/side/float)과 `toggleChatDock()` 순환은 삭제됐고 조수는 항상 입력줄 캡슐이다(`panel.dataset.chatDock` 은 `"float"` 고정 노출). 빈 저장소에서 `assistantTemperature` 기본값은 **quiet-gold** 이고 `loadEditorLayout()` 은 저장된 값을 존중한다; 온도를 강제하려고 레이아웃 캐시 버전을 올리지 마라. 온도 선택기는 ⋯ 안에 있다. Independently, `loadPanelCollapsed()` returns false with no collapse preference and honors stored `"1"`; only a turn that began collapsed re-collapses after `AUTO_COLLAPSE_AFTER_AI_MS` unless review/error. Owners: `assistantTemperature.ts`, `editor.ts`, `editorState.ts`, `aiPanelLayout.ts`.
- **Ctrl+K integrated palette:** `commandRegistry.ts` + `panels/commandPalette.ts` cover tool selection, layers, the shared Map/Event/Data/Test authoring tasks (`authoringTasks.ts`), layout presets, density, World, Resources, current-map PNG, build-palette toggle, map/tile/event drawers, mode cycle plus explicit Beginner/Standard/Expert selection, AI float/side dock toggle, Help, and current-project map navigation (the AI skills section was removed with the assistant-skill feature). Topbar, workspace launcher, palette, and authoring journey must call the same `runAuthoringTask` boundary. `authoringTestGate.ts` is the authoritative fail-closed Test boundary used by every public `testPlayModal.ts` entry and the legacy database `quickBattleModal.ts`; selected-event, troop, context-menu, and basic-record callers must pass it before creating UI/session/runtime state. `panels/editor.ts` only consumes the blocked event to refresh the exact issue list/Data recovery route. Layout presets are dock geometry only and must preserve `EditorUiMode`/density. The global handler is in `aiChatPanel.ts`; event-command insertion has its own Ctrl+K route in `eventEditor/modal.ts`.
- **Topbar team controls:** `src/editor/teamWorkflowUi.ts` + `menu.ts` place **AI 설정**, history, and identity (guest) as right-end controls inside `.editor-topbar-trailing` (before window controls). Test Play and **Quick battle test** remain in edit mode; expert also keeps classic `toolbar-battle-test`, and the Game menu keeps `menu-game-battle-test`. Random battle dispatches `oprn:test-play-window` with `{ kind: "random-battle" }`; fixed-troop tests use `{ kind: "troop-battle", troopId }`. History and identity popovers dismiss on outside pointerdown and close each other. The windowed test-play shell keeps only its title and close control at widths up to 480px so redundant controls cannot cover the play surface.
- Map canvas, tile placement, brush behavior, selection, copy/paste, undo, and map dimensions: start in `src/editor/EditScene.ts`, `src/editor/tileActions.ts`, and nearby `src/editor/tile*`, `src/editor/map*`, or `src/editor/structure*` modules.
- **Paint hover flash:** while `isPainting` or a shape drag is active, map hover preview is suppressed (`shouldShowPaintHoverPreview` in `editSceneHoverPreview.ts` + `EditScene.suppressPaintHoverPreview`). Prevents raw palette tiles (e.g. dirt body) from flashing over autotile-shaped map cells after a stroke. Hover restores on pointerup.
- **Lower must not mutate upper (data + draw):** pure lower-terrain paint/fill never writes `upperTiles` and skips tree-pair repair. Incremental map redraw also co-renders upper cells for every dirty lower cell (`uniqueRenderableTileCells`) and sorts `tileLayer` by depth so re-added lower tiles cannot cover props for a frame. Tests: `test/layerRouting.m1.test.ts`, `test/editSceneRender.test.ts`.
- **빈 하위 칸 체커는 신호다 — 지우지 말고, AI 가 그걸 기본 바닥으로 남기지 못하게 막는다 (2026-08-27):** `editSceneRender.ts` 의 `createEmptyTile` 이 `lowerTiles[i] < 0` 인 칸에 짙은 체커(0x15171c/0x1a1d23)를 깐다. 이 체커는 "여기 바닥이 없다"를 눈에 보이게 하는 **의도된 신호이며 사용자가 유지를 요구했다** — 크림 캔버스로 바꾸면 문제가 안 보여서 더 나쁘다. 실제 결함은 조수가 그 상태를 만들어 놓는 것이었다: `tile_erase` 만 하위를 `TILE.EMPTY` 로 남겨 `clear_region`(기본 잔디)·`planMarketErase`·`resize_map`·`applyMapShift` 와 어긋났다. 2026-09-07: `tile_erase(kind:"all")` 는 `baseGroundTile(map, rect, tileset)`으로 현재 타일셋의 역할·레이어·통행 규칙에 맞는 관측 지면만 복원한다(rect 밖 우선 → 안쪽, 동률은 행 순서). 벽·지붕·소품·수역·통행 불가 타일은 후보가 아니며, 후보가 없으면 `erase-ground-unresolved`로 양 레이어 변경 전에 실패한다(잔디 폴백 없음). 사용자 확정 역할·레이어·통행 규칙은 보존한다. `data.groundTile`은 복원 타일이며 upper-only는 바닥 선택 없이 null을 보고한다. upper 발판 제거의 시작/transfer 목적지 보호와 완료된 집 소유권 보호는 그대로다. 상세 계약: `openwiki/editor-ai-tools.md`, 회귀: `test/tileEraseGround.test.ts`. 진짜 구멍(하늘 맵·허공)은 `clear_region` 의 `fill="empty"` 로만 만든다. 계약 테스트: `test/constructionToolsV3.test.ts` (tile_erase 3케이스), `test/editSceneRender.test.ts`. 별개 사안: **플레이** 캔버스는 `createPlayGame.ts` 의 `#000` 이라 빈 lower·lower 에 놓인 투명 칩은 여전히 순수 검정으로 보인다(잔디 받침 합성은 기본 칩셋 나무 밑동에만 걸린다).
- **덧그림 공백 스포이트 (2026-08-31):** 덧그림 레이어에서 우클릭/집기가 빈 칸이면 `TILE.EMPTY`(-1)를 집는다. 이후 칠하기는 그 레이어 지우개(`eraseVisibleTilesBulk`)로 동작하고, 바닥은 건드리지 않는다. 바닥 레이어의 보이는 타일 집기(상위 있으면 상위, 없으면 하위)는 그대로다. 소유: `tilePicking.layerTilePickAt` → `TilePaintEngine.pickVisibleTileAt` / `pickTileAt`. `tileLayerHome(EMPTY)` 는 `"both"` 라서 `effectiveLayer` 가 요청 레이어를 유지한다 — `priority[-1] → lower` 폴백이면 공백 붓이 바닥을 비운다. **지우개 지면 복원:** 하위 슬롯을 스프라이트가 차지한 채(`isSpriteOccupyingLower`: 나무 밑동 + 상위 홈 소품) `EMPTY` 로 비우면 체커/플레이 `#000` 이 드러난다. 지형(잔디·물) 지우기는 구멍을 남기고, 스프라이트 지우기는 주변 지면(`groundTileNear`, 없으면 잔디)으로 되돌린다. 덧그림을 지웠을 때 그 칸 하위가 비어 있고 주변에 지면이 있으면 구멍도 메운다. 계약: `test/tilePicking.test.ts`, `test/upperLayerBlankPick.test.ts`, `test/layerRouting.m1.test.ts`, `test/tileActions.m1.test.ts`.
- **Right-button map UX (2026-07-21 개선):** short **right-click** = eyedropper (`TilePaintEngine.pickTileAtPointer`); 우클릭 시작 시점에는 더 이상 1×1 미리보기 선택을 만들지 않음 — 기존 선택 유지; **right-drag** across 2+ tiles creates a selection and shows a hint toast (`W×H 영역 선택 — 복사·붙여넣기·✨ AI 작업 가능`) — AI 모달이 더 이상 자동으로 열리지 않음 (선택 칩에서 접근). 드래그 중 실시간 선택 박스는 `updateRightRegionGesture` → `selectTileRegion`. 우클릭 단일 클릭 후 1×1 잔여 박스 제거(`finishRightRegionGesture`). 기존 다중 선택 안을 우클릭 탭 → AI 팝오버(`openRegionAiPopover`)는 유지. Left-drag with the select tool selects normally. Legacy menu "?????곸뿭??AI ?묒뾽?? remains available via prior selection + context paths where wired. **Popover viewport:** `positionRegionTaskPopover(panel, anchor, avoid?)` clamps left/top and sets `maxHeight` to the viewport; after logs/before-after grow it re-clamps via `schedulePopoverReposition` (CSS: `.region-task-popover` overflow-y auto). **`avoid` 은 대상 영역의 클라이언트 사각형이다** — `EditScene.regionClientRect` 가 `tileRectToScreenRect` + 캔버스 `getBoundingClientRect` 로 계산해 넘기고, 순수 함수 `placePopoverBesideRect` 가 오른쪽→앜쪽→아래→위 순으로 겹치지 않는 자리를 고른다(어느 방향도 안 되면 null → 기존 anchor 클램프). 이유(실재): 우클릭 드래그를 놓은 자리는 곷 대상 영역 안이라 anchor 만 쓰면 팝오버가 **자기가 바꾸는 곳과 캔버스 고스트 미리보기·인라인 ✓적용 툴바를 덮는다**. **Region tool calling (boxes):** "박스/?섎Т?곸옄" ??`place_props` + `harness-combined-town-wood-box` (not `small-props` bag, not `place_chest`). "蹂대Ъ?곸옄/?곸옄瑜??? only ??`place_chest`. Guide lines live in `buildRegionTaskMessage` + tool descriptions.
- **영역 작업 검토 화면은 결정 우선 배치다 (2026-08-28):** `regionTaskModal` 의 `compareHost` 순서는 **미리보기(`region-task-compare`) → 변경 목록 → 방별 제어 → 게이트(`region-task-gates`: 차단·NPC 일정 결정) → 결정 버튼 줄(`region-task-compare-actions`) → 진단 접이식(`region-task-diagnostics`)** 다. 진단 안에 기존 `region-task-checkpoint-timeline` / `region-task-review-metrics` / `region-task-review-issues` 가 그대로 들어가며(testid 계약 유지), summary 는 한 줄 통합 판정(`region-task-verdict`)이고 **차단·오류가 있으면 자동으로 펼친다**. 이유(실재): 진단 셋이 미리보기보다 **위**에 있어서 380px 팝오버에서 「적용」이 스크롤 아래로 밀려 있었다 — 우클릭 드래그의 목적이 적용인데 그것이 화면에서 가장 멀었다. 결정 버튼 줄은 `position: sticky; bottom: calc(var(--space-4) * -1)` 로 스크롤포트 바닥에 full-bleed 고정된다 — sticky 자습 자적는 원래 있었지만 **그 줄이 마지막 자식이면 sticky 는 아무 일도 하지 않는다** — 진단을 뒤로 보낸 뒤부터 실질 동작한다.
 - **영역 작업 검토 단계는 wide 결정 레이아웃이다 (2026-09-04):** 중앙 모달은 data-stage=review 일 때만 960px 와이드(`region-task.css:1147`), 팝오버 경로 최종 폭은 stage-aware JS 인라인이 정한다(검토 960·지시/생성 380, `regionTaskModal.ts:2441`). 미리보기는 480px 로 찍고(`regionTaskModal.ts:691`) CSS max-width 로 내려가며, 변경 목록·이슈는 체크리스트 카드(`is-checklist`), 결정 버튼 줄 뒤에 단축키 힌트 행(`region-task-kbd-hints`: Left/Right 이전/이후·Enter 적용·R 다시, `regionTaskModal.ts:2164`)이 붙는다. JS 는 data-stage 만 바꾸고 wide 진입도 CSS 가 판단한다(파일 원칙) — 별도 클래스 토글 금지. 단일 A/B 토글·sticky 액션·진단 접힘 계약은 그대로다.
- **영역 작업 단축키는 단계별이다 (2026-08-28):** `compose` 에서 Enter/R = 실행, `running` 에서는 무시, `review` 에서 **Enter = 적용**, **R = 다시 만들기**. 검토 진입 시 `region-task-apply` 가 포커스를 받아 버튼 자심 생태로도 Enter 가 확정이 된다(모달 안 버튼/summary 가 포커스일 때 document 핸들러는 무조건 물러난다). 장진/버리기/다시 만들기는 버튼과 단축키가 `doApply`/`doRetry`/`doDiscard` 한 짝을 공유하고 `pending.settled` 를 직접 가드한다. 이유(실재): 이전에는 단계와 무관하게 Enter·R 이 `execute()` 여서, 결과를 보고 Enter 를 누를면 확정이 아니라 **방금 만든 제안을 버리고 AI 를 한 번 더 호출**했다 — 결정 화면에 확정 키가 아예 없었다. 계약: `test/regionTaskApplyFlow.test.ts`.
- **영역 작업 헤더는 2행이다:** `region-task-title-row`(제목 + 닫기) + `region-task-meta-row`(단계 세그먼트 + 좌표 칩 + 통계 칩). 카테고리 칩 줄(`region-task-categories`)은 `flex-wrap: nowrap` + 가로 스크롤 한 줄이다 — 줄바꿈으로 2~3행을 잡아대던 자리를 지운다.
- **영역 작업 박스 고도화 A/E/F + 타일셋 필터링 (2026-07-20):** `regionTaskModal` 의 결과 검토/상호작용 고도화. **A 부분 적용** — pending 시 chunk tree(레이어+4-연결성 구역 덩어리). `groupRegionChanges`/`withChunkLabels`(`regionTask/regionChangeGroups.ts`)가 base↔clipped diff 청크 묶음. `[선택 N칸 적용]` → `composePartialProject`(`regionTask/partialApplyCompose.ts`)가 선택 청크만 병합 → `applyPartialProject(merged)`. **E 컨텍스트 인식 동적 추천** — `suggestRegionCommandsByContext`(`regionTask/regionContextSuggestions.ts`)가 영역 주변 1타일 두르레이트 분석. 물≥3→부두/다리, 길≥2→가로수/상가, 숲≥3→사냥터/캠프파이어, 건물≥2→울타리/정원. **타일셋 기반 필터링** — 코퍼스/동적 명령에 `tilesets: TilesetCategory[]` 태그("outdoor"|"dungeon"|"interior"). `categorizeTileset(tilesetId)` 판정, `commandFitsTileset` 로 부적합 명령 제거(던전에서 꽃밭/오두막/호수 제외). 알 수 없는 타일셋은 outdoor 폴백. **F 시각/접근성** — (1) 헤더 통계 칩. (2) 키보드 단축키(textarea 비포커스시): Enter/R. (3) 슬래시 자동완성(코퍼스+동적+최근 5개 localStorage). 테스트: `regionChangeGroups`, `partialApplyCompose`, `regionContextSuggestions`(던전/실내 필터링 케이스 포함), `regionTileStats`, `recentInstructions`, `regionTaskModalEnhancements`. 스펙: `docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md`. **모던 UI 계약 (2026-08-26)** — `src/editor/panels/regionTaskModal.ts` 중심의 영역 작업 모달 계약. 모든 아이콘과 라벨은 이모지 없이 `src/editor/panels/tileToolbarIcons.ts` 의 `makeSvgIcon` 과 타입 지정된 `SvgIconName` 만 사용한다. `src/styles/editor/region-task.css` 는 hex 리터럴을 일체 포함하지 않으며 스크림, 그림자, 표면 색상을 `src/styles/tokens.css` 의 디자인 토큰(`var(--token)`)으로 가져온다. 프리뷰는 단일 캔버스 영역과 A/B 토글 구조(`data-testid="region-task-preview"`, 토글 버튼 `region-task-preview-ab-before`/`region-task-preview-ab-after`, 기본 뷰 `"after"`)로 동작하고 팝오버 `max-width` 는 380px 이다. 검토 하위 블록들은 단일 테두리 카드(`.region-task-review-card`)로 통합되며 하단 액션 행(`.region-task-compare-actions`)은 sticky 로 고정된다. 청크 트리 기반 부분 적용(`groupRegionChanges` in `src/editor/regionTask/regionChangeGroups.ts`, `composePartialProject` in `src/editor/regionTask/partialApplyCompose.ts`), 영역 주변 1타일 컨텍스트 동적 추천(`suggestRegionCommandsByContext` in `src/editor/regionTask/regionContextSuggestions.ts`), 타일셋 기반 필터링(`TilesetCategory`) 계약을 포함한다. 계약 테스트: `test/regionTaskIcons.test.ts`, `test/regionTaskCssTokens.test.ts`, `test/e2e/region-task-monochrome.spec.ts`.
- **영역 작업 부분 적용 승인 지문 정합 (2026-09-07):** `composePartialProject` 는 base 복제본 위에 선택 청크의 authored 타일 셀만 덮어쓰지만, 승인 지문(`projectApprovalFingerprint`)은 프로젝트 전체를 비교한다. 세션 작업본은 시작 전 결정론적 하네스 파생 데이터(`ensureRegionPlacementHarness` → `ensureBuildPaletteTileGroups`, 멱등)를 품고 있어 합성 후보가 그대로는 지문이 어긋나 정당한 부분 적용이 거부됐다. 합성 후보의 대상 맵 타일셋에 같은 준비를 적용해 파생 데이터만 정합시킨다 — authored 셀 선택 범위·다른 authored 필드는 그대로이므로, 타일셋을 손댄 후보나 선택 밖 미검수 후보는 여전히 거부된다. 회귀 테스트: `test/regionTaskHouseProtection.test.ts` 의 부분 합성 승인 정합 2건(타일셋 변조 거부·미검수 분기 후보 거부).
- Tile palette, chipset rendering, stamps, picking, and autotile/semantic previews: start in `src/editor/panels/tilePalette.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/tilePaletteStamp.ts`, and `src/assets`. The left palette uses three work tabs (**移좏븯湲?* / **찾기** / **?띿꽦**): paint holds tools + RM2003-style 6-column grid (`makeRm2kPalette` / `RM2K_PALETTE_COLUMNS=6`), find holds search/category quick picker, props holds mapping inspector/terrain. Tab preference is `oprn:palette-work-tab`. **Expert paint palette:** always **exactly 6 columns** (`.chipset-grid.rm2k-palette-grid` with `repeat(6, minmax(0,1fr)) !important`); no Manual/Auto paint-title toggle, no **?ш쾶** popout on the paint title row. Palette sheet grows with remaining height; short viewports cap map-tree height so the sheet keeps space. Styles: `figma-editor.css`, `editor-ui-modes.css`, `rm2k3.part-1.css`.
- **Custom atlas palette geometry (2026-08-10):** `makeCustomPalette` is not an RM2003 six-column list. It renders every source cell in the atlas's exact `tilesPerRow` grid on both lower and upper editor layers, with horizontal scrolling when the authored sheet is wider than the rail. This preserves multi-cell facade/prop relationships; selecting a classified tile still switches to its authored layer through `selectPaletteTile`. Do not filter cells by active layer or cap/reflow custom columns—the resulting row shifts destroy the source artist's visual grammar.
- **고급 ????듯빀 (2026-07-17):**  is mapped to native  (). Optional  /  live on ; legacy m2 rows rewrite on project normalize (). Portrait continues via . Form: 문장 ?쒖떆 ??고급 ?듭뀡. 
- **좌표 목적지 이동 (OPRN-OUT-013, 2026-09-10):** `Pathfind Move` 의 X·Y 는 축마다
  「숫자 또는 스튜디오 변수」다. 저장 형태·기본값·실패 정책의 정본은
  `src/project/eventCommands/coordinateDestination.ts` **하나**이고, 저작 폼은
  `eventEditor/commandBodyM2Coordinate.ts`, 런타임은 `player/playScenePathfinding.ts` 다.
  대상 픽커는 `createMoveRouteTargetPicker` + `project/eventTargetCatalog`,
  좌표·결과 변수는 표준 `databasePicker` 를 **재사용한다** — 두 번째 좌표·이동·변수 엔진을
  만들지 마라. 없는 키는 전부 옛 고정 좌표로 읽히므로 마이그레이션이 없다.
  두 함정: `.actor-m2-field { display: grid }` 가 `[hidden]` 을 이겨 죽은 입력이 남고,
  이동 대상 픽커 CSS 는 `.move-route-editor` 스코프라 다른 폼에서 날것으로 나온다.
  상세는 `openwiki/editor-event-commands.md` · `openwiki/runtime-m2-flow-controls.md`.
- Event authoring, event pages, event commands, move routes, transfer/player actions, and command dialogs: start in `src/editor/panels/eventEditor/`, `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, and `src/editor/eventCommands/`.
- **검토 알림 종 (2026-08-28):** 이벤트 편집기의 검증 결과는 `src/editor/panels/eventEditor/validationBell.ts` 가 소유하며, 타이틀바 `.header-actions` 안 종 + 개수 배지(`event-draft-validation` / `-summary` / `-count` / `-tally` / `-issue-<n>`)로 뜬다. 종은 `renderModalHeader` 에서 **한 번** 세우고 `refresh()` 가 `refreshEventValidationBell` 로 내용만 갱신하므로 열어둔 팝오버가 재렌더에 닫히지 않는다. `renderEventEditorDynamic` 은 검증 chrome 을 더 이상 만들지 않는다 — 편집면 아래쪽에 다시 붙이지 말 것. 이전 구현은 존재하지 않는 래퍼 `.event-editor-command-header` 아래에만 스타일이 선언돼 있어 **CSS 가 하나도 적용되지 않은 기본 `<details>`** 로 출하됐다. 현재 스타일 소유자는 `src/styles/editor/event-editor.balanced.css` 말미 한 블록이며, 심각도 톤은 `data-severity`(error·warning → `--danger`, info → `--accent`) 로만 결정한다. 헤더 안 `<details>` 를 늘릴 때는 `modalDrag.ts` 의 무시 선택자에 `summary` 가 들어 있어야 한다(pointer capture 가 click 을 삼킨다).
- Shared nested event command path traversal: start in `src/editor/eventCommandPaths.ts`. It owns command path lookup for persisted event pages and staged root command branch arrays, including optional branch creation and loop body traversal.
- Database tabs, record views, battle database records, utility records, references, common-event command editing, and record mutation: start in `src/editor/panels/database*.ts`, `src/editor/databaseActions.ts`, `src/editor/databaseRecordMutators.ts`, `src/editor/databaseReferences.ts`, and `src/editor/databaseCommandReferences.ts`.
- Worldview authoring lives in the Database `세계관` group (2026-09-03): `이 세계` (`worldCanon`, `project.worldCanon`, `databaseWorldCanonView.ts`) is the singleton bible; `설정집` (`worldCodex`) embeds the existing entity wiki (`renderWorldPanel({ embedded: true })`, `project.world`). Toolbar/menu/hotkey `openWorldPanel()` jumps to `openDatabaseModal("worldCanon")` — do not reopen a second world modal. Village info still redirects through `openWorldPanel()`. AI wiring stays excluded (`test/worldAiExclusion.test.ts`).
- **Worldview AI wiring is deliberately excluded (2026-08-28).** `src/editor/tools/worldTools.ts` is gone and `set_world_relations` was dropped from `authoringMiscTools.ts`, so no tool can read or write `project.world`. `contextBuilder` no longer injects a worldview digest, `proposalCompleteness` no longer warns about unrecorded worldview, and `lintWorld` is no longer merged into `run_lint`/`evaluate_game_quality`. Reason: the ontology-first premise never bound the authoring flow, so it only cost per-turn tokens, tool-exposure slots, and warning noise. The data model (`src/project/world/`), the shape-guard migration, and the user-facing panel stay live — the panel calls `lintWorld` itself for its own badges. Contract: `test/worldAiExclusion.test.ts`. To restore, delete that test and re-register the tools (git history holds `worldTools.ts`).
- Declarative multi-map world graph tools are registered from `src/editor/tools/worldGraphTools.ts` under the world domain. `plan_world` records `project.worldGraph` without creating maps, `build_world` creates role-default blank maps and links transfer edges, `link_maps` upserts stable transfer event pairs, and `lint_world` reports graph/edge boundary issues. Multi-map authoring order is `plan_world` ??`build_world` ??per-map content tools such as `build_village`/`make_villager`.
- Resource manager, imported graphics, tileset metadata, generated assets, and transparency behavior: start in `src/editor/panels/resourceManager.ts`, `src/editor/tileset*`, and `src/assets`.
- **미분류 큐:** DB 타일셋의 라벨·설명 없는 타일은 `tilesetMetadataEditor` 사이드바 `tileset-unlabeled-queue` + 칩셋 미리보기 **미분류** 필터 (`tilesetChipsetPreview`). 빈 `tileMeta` 를 순회 수집. 헬퍼: `listUnlabeledTileIds` / `isUnlabeledTile` in `tilesetMetadataControls.ts`.
- Save, import, export, autosave, remote/local project loading, and persistence status: start in `src/editor/saveActions.ts` and `src/project/store.ts`. **Paint must stay local-first:** autosave/map-patch merge must not replace live map bodies after save. If tiles appear then disappear a moment later, check `store.persistCurrent` is not applying `result.project` onto `this.current` (see `openwiki/runtime-project-schema.md` local-first paint note). After a successful save that still has newer local paint, the store immediately catch-up-saves the live generation. Manual reload is labelled **저장본 다시 불러오기** (`menu-project-reload-db`, `toolbar-reload-db`) and calls `reloadProjectFromDbNow` → `store.reloadFromRemote()`. Unsaved changes require confirmation and `force:true`. Web-player export additionally uses `src/project/webExport.ts`, `src/editor/panels/menu.ts`, and `src/editor/tools/exportTools.ts`.
- **Save performance:** compact wire `serialize` (pretty only for `.oprn` via `serializePretty`); dirty-skip flush; map-patch drops double full-snapshot reload after map rows; hybrid maps SoT ??load overlays `maps.map_json` onto `current_json`, conflict merge still uses `current_json`.
- First-boot online-save gate (`DbConnectionRequiredError`) renders `db-required-panel` in `src/app/mode.ts` and opens `openDbConnectionSettings({ required:true, autoLoadProjects:true })`. The UI is a zero-configuration, beginner-facing **작업 열기** card picker: it auto-loads saved works, offers **새 작업 만들기** and **새로고침**, opens the selected work immediately, and cannot be dismissed while required. It never renders `DB`, `Supabase`, URL, Anon key, Project ID, or `.env` controls—not even under an advanced disclosure. `dbConnectionAdvancedSettings.ts` and its CSS were removed. Deployment owns URL/key through Vite env; the browser remembers only `oprn:supabase-selected-project`. Missing deployment config is shown as a friendly retry state, never as a credential prompt. A successful `reconnectRemotePersistence()` must set `store.isLoaded()` before its refresh callback so cold boot can call `finishEditorBoot`. CSS: card/list internals live in `shell/figma-editor/06-db-config-project-picker.css` (layer shell), but the `.db-config-backdrop/-window/-body` chrome overrides live in `database/light-theme.css` — since the 2026-09-11 surface-layer split, shell < database means anything in layer(shell) loses to the base `.database-modal-*` chrome; overrides of that chrome must sit in layer(database) with a scoped selector. Also `sidebar.css` forces every `.database-modal-body` to row-flex, so `.db-config-body` pins `display:block` at (0,4,0) or the card grid collapses to one ~445px column.
- **첫 방문 프로젝트 발급 + 새 프로젝트 (2026-08-24 초보자 UX):** `src/app/mode.ts` 부팅이 `hasDeepLinkedProject()`를 **store.load() 전에** 캡처한다 — load가 URL에 `?project=`를 스스로 써 넣어 환영 화면이 영원히 억제되던 버그가 있었다. 진짜 첫 방문(딥링크 없음 + `hasStoredSupabaseProjectSelection()` 거짓 + 비자동화)은 배포 기본(공유) 프로젝트 행을 편집 대상으로 열지 않고 `loadNewRemoteProject(createBlankProject())`로 새 project id를 발급받는다(실패 시 load 폴백). 부팅 중 발급은 즉시 원격 쓰기를 기다리지 않고 autosave 재시도 경로에 맡기지만, 사용자가 작업 선택기에서 **새 작업 만들기**를 누른 경우에는 `loadNewRemoteProject` 뒤 `store.flush()`가 실제 원격 저장 성공을 반환해야만 모달을 닫는다. `loadNewRemoteProject`와 작업 전환은 URL/key를 localStorage에 복사하지 않고 선택 project id만 저장한다; 기존 `oprn:supabase-project-config`는 배포 env가 없는 개발/레거시 호환 경로로만 읽는다. After `enterMode(edit)`, cold boot may overlay the canvas-scoped director briefing (`presentEditorWelcome`: 어떤 게임을 만들까요? + 만들기 + three featured posters (monster-collect / story-cutscene / adventure-jrpg) with stable `data-pack-id` + collapsed horror/farm/partner posters in 「이런 세계도 있어요」 + 빈 맵으로 시작) instead of the retired full-screen cinematic welcome; start auto-sends on the current map and skip then starts coach marks. 메뉴 **새 프로젝트**는 `clearAll()`(같은 원격 id 재사용 → 공유 행 클로버)이 아니라 `showPromptInput` 이름 입력 → `loadNewRemoteProject` 경로다. `projectUpsertPayload`는 `updated_at`을 직접 윖다(DB에 on-update 트리거 없음 — 안 보내면 작업 목록 시각이 영원히 멈춘다). `openDbConnectionSettings`는 기본 autoLoad(옵트아웃 `autoLoadProjects:false`), 목록 조회는 15s 타임아웃 후 오류+새로고침. AI 패널: 턴이 미답 질문(퀴리플라이 칩 `.ai-quick-reply-chip`)으로 끝나면 자동 접기·휘발 페이드 금지, 칩은 마지막 `.ai-chat-bubble.ai-chat-assistant` 바로 아래 부착하고 말풍선의 `[선택지]` 줄은 `stripQuickReplyLine`으로 제거. float 커맨드바는 오른쪽 캐프슐(최대 640px, 상태바 위 34px)로 상태바 포인터를 막지 않는다. 부팅 기본 도구는 `paint`+`lower`(editorState.ts), 초보 레일에서 브러시 선택 시 타일 플라이아웃 자동 오픈, 이벤트 도구 더블클릭이 맵 밖이면 안내 토스트. 줄 메뉴(1x/2x/4x)는 스테퍼의 배율 버튼(is-menu-open)으로만 열린다. 브리지 폴링은 연속 실패 시 지수 백오프(최대 60s).
- **첫 방문 공용 데모 (2026-09-14, 위 2026-08-24 발급 경로의 후속):** 진짜 첫 방문은 빈 프로젝트 발급 + 「어떤 게임을 만들까요」 브리핑 대신 **읽기 전용 공용 데모 행** `rpg-zzu-first-visit-demo`(「큰 강호 장터 마을」 100×100, NPC 53, 이벤트 58, `src/editor/content/largeRiverMarketVillageBuild.ts` 산출물)을 바로 연다. 게이트는 `shouldOpenSharedDemoAtBoot`(`src/project/sharedDemoProject.ts`): `?project=` 딥링크 없음 + 저장된 작업 선택 없음 + Supabase env 있음 + 비자동화 + dev showcase 아님. `mode.ts` 가 부트에 `store.loadSharedDemo()` 를 호출하고, 행이 없거나 읽기 실패면 기존 `loadNewRemoteProject(createBlankProject())` 발급으로 폴백한다. 데모 세션은 `remotePersistenceDisabledReason === "shared-demo"` 라 웰컴 브리핑이 억제되고(`?forceWelcome=1` 리허설만 `isForcedWelcomeRehearsal()` 로 예외) 대신 안내 토스트(`presentSharedDemoIntro`) + 상시 배너(`shared-demo-banner`) + DB 칩 「공용 예제」 가 뜬다. 편집은 `forkSharedDemoToEditableCopy` → `loadNewRemoteProjectTransactionally`(데모 세션은 소스 flush 를 건너뛴다)로 새 project id 에만 가능하다. 상세 저장 계약은 `runtime-project-schema.md` 의 「공용 첫 방문 데모」 절. 데모 내용 갱신은 `scripts/publish-first-visit-demo.mts --apply` 만이 담당한다(저장·재로드 검증 포함, 증거 `output/evidence/first-visit-demo/`).
- Team workflow visualization, mock editor login, topbar identity/history **icon** buttons (trailing cluster), commit-history panel (outside-click dismiss), and map-lock badges: start in `src/editor/teamWorkflowUi.ts`, `src/editor/panels/menu.ts`, `src/editor/panels/mapList.ts`, `src/editor/panels/editor.ts`, `src/project/editorIdentity.ts`, and `src/project/supabaseProjectSync.ts`. Locked maps use the canvas-top badge with last activity plus a guarded edit-rights takeover action; there is no duplicate statusbar state. Login remains mock-only until Phase 8 auth switchover; do not add Supabase Auth calls here.

- **맵 URL 동기화 + 뒤로가기 (2026-07-24):** `src/editor/mapUrlSync.ts` owns `?map=<mapId>` URL parameter sync. 맵 전환 시 `pushState`로 히스토리 기록, `popstate`으로 뒤로가기/앞으로가기 시 맵 복원. 부팅 시 `restoreMapFromUrl()` → `installMapUrlSync()` in `src/app/mode.ts`. `projectUrl.ts`의 `?project=` 파라미터와 공존.
- **RM2003 맵 속성 탭 (2026-07-24):** `src/editor/panels/mapProps.ts` rewritten as tabbed dialog (일반/배경/BGM/전투/제한/인카운터/필드스폰). New `GameMap` fields: `background?: MapBackground`, `bgm?: MapBgmSetting`, `battleBackground?: string`, `disableSave?`, `disableTeleport?`, `disableEscape?`. Actions: `setMapBackground`, `setMapBgm`, `setMapBattleBackground`, `setMapFlags` in `src/editor/actions.ts`. Types: `MapBackground`, `MapBgmSetting` in `src/project/types/project.ts`. CSS: `src/styles/editor/map-props.css`.
- **맵 배경 탭 미리보기 (2026-09-14):** 「맵 배경」 탭에서 고른 그림을 `map-bg-preview` 로 보여준다
  (`mapProps.renderBackgroundTab`, `.map-bg-preview` 는 `src/styles/editor/map-props.css`).
  캔버스가 배경을 그리지 않기 때문이다 — 빈 칸 체커(2026-08-27 의도된 신호)를 약화시키지 않고는
  캔버스에 배경을 보일 수 없어서 그쪽은 건드리지 않았다. 플레이 렌더 계약·QA 는
  `openwiki/runtime-pre-edit-routing.md` 의 「맵 배경(패럴랙스) 렌더」 절이 정본이다.
- **필드 스폰 진영 덮어쓰기 (2026-08-29):** `필드 스폰` 탭(`map-props-tab-spawns`)은 JSON 배열 하나였다. 이제 스폰마다 진영 셀렉트(`map-spawn-faction-<index>`)를 세우고, 나머지 필드(영역·트룹·그래픽 등)는 접힌 `<details>` 안의 기존 `map-field-spawns-input` JSON 해치에 그대로 남긴다 — 같은 적 레코드를 한쪽에선 산적, 다른 쪽에선 경비대로 배치하는 것이 스폰 진영의 존재 이유이므로 그 한 필드만 구조화 컨트롤로 올렸다. 스폰이 없는 맵은 `map-spawn-empty` 안내만 낸다. 첫 옵션(빈 값)은 “진영 없음”이 아니라 **상속(스폰에 저장값 없음)** 이고, 고르면 `factionId` 키를 지워 저작 데이터를 희소하게 유지한다 — 런타임은 몬스터 레코드의 진영으로, 그것도 없으면 예약 `enemy` 로 떨어진다(`openwiki/runtime-action-combat.md`). 힌트 `map-spawn-inherit-hint` 와 행별 결과문 `map-spawn-faction-effective-<index>` 가 그 결과를 문장으로 적는다. 삭제된 진영을 가리키는 저장값은 렌더가 조용히 고치지 않는다: `disabled` 옵션으로 선택된 채 남고 결과문이 경고 톤(`.map-spawn-row-warning`)으로 “런타임에서는 적(enemy)으로 싸운다”를 적으며, 다른 진영을 고르는 명시적 행동만 복구다. 행 제목은 스폰 id + 트룹 이름(없으면 `<troopId> (없는 트룹)`) + 영역 크기/좌표다. 셀렉트와 JSON 해치 모두 `setMapFieldSpawns` 로 커밋한 뒤 패널을 다시 그려 결과문이 저장값과 어긋나지 않게 한다. 커버리지: `test/mapPropsSpawnFaction.test.ts`.
- **맵 트리 UX (2026-08-20):** `moveMapInTree` keeps the moved node's subtree (`extractTreeNode` + `insertTreeNode` in `src/project/mapTree.ts`). Drag uses a module drag source (not MIME `getData` on `dragover`) and row thirds: before / child / after. Header is add + start + expand + placeholder-only name filter (`찾기`, testid `map-tree-filter`). Rows keep name + ⋯ menu; no `:::` drag suffix. Start-map chip is a high-contrast badge (idle dark / active cream). Mouse contract: left-click selects, double-click opens 맵 설정, F2 / 메뉴 이름 바꾸기 renames, right-click / ⋯ opens the Korean menu, drag is handle-only (`map-drag-*`, drop thirds before / child / after). The row itself is not `draggable`. Context menu is Korean only (`맵 설정`, `하위 맵 추가`, `복제`, `삭제`); Copy is a sibling duplicate. Collapse set persists in `oprn:map-tree-collapsed`. Recursive delete is one `store.update` (`deleteMapsInOrder`). `+` / 하위 맵은 `map-create-dialog` (이름·크기·칩셋·상위, 프리셋 빈/부모상속/실내). `duplicateMap`은 `cloneGameMap`으로 BGM·인카운터·플래그까지 복사한다. 행 메타 `W×H · N이벤트 · 문N`, 필터 칩 빈 맵/문 없음/인카운터, 메뉴 `부모와 왕복 이동 넣기`. 트리 계층 ≠ 플레이어 이동. Ctrl/Shift 다중 선택, 리스트 빈 칸 박스 선택, 중간클릭/메뉴 「여기서 테스트 플레이」, 핸들 묶음 이동. `kind:"folder"` 분류 노드(`folder_*`)는 `maps`에 없고 `repairMapTreeOrphans`가 지우지 않는다. 실내 생성은 lower를 나무 바닥 72로 채운다.
- **맵 행 썸네일 + 실제 계층 들여쓰기 (2026-08-27):** 맵 행은 이름만 내걸지 않고 `src/editor/panels/mapThumbnail.ts` 가 그린 40×30 썸네일 캔버스(`map-thumb-<mapId>`, `data-thumb-state=pending|map|fallback`)를 단다. 렌더는 `drawMapTileLayers` + `loadTilesetImage` 경로를 그대로 쓴다. 축소는 중간 캔버스(긴 변 ≤512px)에 한 번 그린 뒤 진행한다 — 타일을 곧바로 2px 로 그리면 소스 사각형이 서브픽셀이 되어 격자가 뭉개진다. 캐시 키는 맵 내용 시그니처(w/h/tileSize/lowerTiles/upperTiles + tilesetId)라서 타일을 고치면 자동으로 다시 렌더된다. 분류 폴더만 글리프를 유지하며, 하위 맵을 가진 맵도 자기 썸네일을 보여준다. 행 그리드 3번째 칸은 세 변형(`figma-editor/10-map-tree.css`, `shell/editor-ui-modes.css`, `shell/editor-responsive-expert.css`)에서 모두 **44px** 다 — 하나만 바꾸면 썸네일이 찌그러진다. 들여쓰기는 `--map-depth` 를 실제로 사용한다(`map-props.css`, depth×14px + 왼쪽 계층선): 이전에는 이 변수를 행에 심어놓고도 읽는 CSS 가 없어 평평한 16px 하나로 모든 깊이가 같은 자리에 그려졌고, 초보 플라이아웃에는 들여쓰기 규칙 자체가 없어 자식이 형제처럼 보였다. 계약은 `test/e2e/map-tree-thumbnails.spec.ts` 가 잡는다(모든 행 썸네일, 내용이 다른 맵은 다른 그림, `role=group` 기준 실제 부모-자식, 초보 플라이아웃 동일 보장).
- **서브맵 빠른 추가 (2026-07-24):** Beginner flyout rows still show a hover `+` (`.map-tree-add-child-quick`). Standard/expert use the context menu "하위 맵 추가".
- **맵 삭제 — 하위 맵 처리 (2026-07-24):** `confirmAndDeleteMap` now explains child map behavior explicitly (children promoted to parent level). New `confirmAndDeleteMapRecursive` in `src/editor/mapDeleteConfirm.ts` deletes a map and all descendants (leaf-first, one undo step). Context menu item "하위 포함 삭제" (`map-menu-delete-recursive-*`).

- **맵 삭제 되돌리기 — 문구와 이력이 어긋나 있었다 (2026-09-14 고침):** 확인창은 `삭제 후 Ctrl+Z로 되돌릴 수 있습니다`(`mapDeleteConfirm.ts:31`)와 `한 번의 실행 취소로 이 묶음 삭제를 되돌릴 수 있습니다`(`:39`)를 인쇄했지만, `deleteMap` / `deleteMapsInOrder`(`actions.ts`)는 `recordProjectSnapshot` 없이 `store.update` 만 호출했다 — 삭제된 맵과 그 이벤트는 복구되지 않았고, Ctrl+Z 는 **무관한 이전 편집**을 되돌렸다. 두 경로 모두 삭제 직전 스냅샷 1건을 남긴다(묶음 삭제도 1건 — 위 "one undo step" 문구가 이제 참이다). 삭제될 맵이 없으면(`maps.length <= 1`) 스냅샷을 아예 밀지 않는다 — 무변경 실행이 되돌리기 칸을 먹던 함정(아래 「되돌림 함정(실측)」과 같은 규칙)을 피하기 위해서다. 계약: `test/mapDeleteUndo.test.ts`.

## Agent cautions


- **그림 워밍업 소유자 (2026-08-28):** 편집기 다이얼로그가 쓰는 그림 카탈로그 프리로드는 `src/assets/editorAssetWarmup.ts` 만 한다. `scheduleEditorAssetWarmup()` 은 `renderEditor` 끝에서 한 번 불리고 `requestIdleCallback` 로 미뤄지며(없으면 800ms 폴백), tier 순서는 `picker`(캐릭셋 21 + 낱장 얼굴 80 + 칩셋 13) → `library`(CC0 아이콘 234) 다. 이벤트 편집기 모달은 `warmEditorPickerAssets()` 로 `picker` tier 를 앞당긴다. 실제 요청은 공용 큐 `src/assets/imageWarmQueue.ts` 가 URL 단위 in-flight 공유 + 전체 동시 요청 상한 6(배경 호출 몫 4 / 요구 호출 몫 6)으로 낸다 — dev 서버가 HTTP/1.1 이라 상한 없이 수백 장을 걸면 사용자가 지금 보는 그림이 큐 뒤로 밀린다. 새 피커를 만들 때 `new Image()` 나 `<link rel=prefetch>` 를 손으로 뿌리지 말고 tier 목록에 경로를 추가하라. 몬스터/전투 스킨 아트(40MB+)와 업로드 `dataUrl` 은 의도적으로 제외다. `navigator.connection.saveData` 또는 2G 에서는 배경 워밍을 아예 걸지 않는다. 계약: `test/editorAssetWarmup.test.ts`.
- Editor code should mutate authored project data, not live play-session state.
- **raw `console.*` 를 새로 심지 말 것 (2026-08-29):** `createLogger(ns)` (`src/util/logger.ts`) 를 쓴다. raw 콘솔은 링버퍼에 남지 않아 사후 조사에서 존재하지 않는 것과 같다(감사 당시 `src/` 의 로그 103건이 전부 raw 콘솔이었다). 알려진 관측 공백 목록(되돌리기 스냅샷 없는 파일 21개, `resetMapEditHistory()` 프로덕션 호출 0건, AI 영역 작업의 라벨·origin 누락, `mapEditLocks` 거부 미기록 등)은 `openwiki/editor-observability.md` 하단 표에 있다 — 그 근처를 손대면 이어서 정리하라.
- If an editor change affects saved JSON, update `openwiki/runtime-project-schema.md` guidance and verify migration/serialization paths.
- For UI changes, drive the actual editor surface and keep screenshot or Playwright evidence.


## 헤더 용어 정본과 중복 감사 (2026-08-30)

에디터 헤더(메뉴바 · 톱바 트레일링 클러스터 · 클래식 툴바)의 사용자 가시 문구는 **`src/editor/uiCopy.ts`
한 곳**에서만 나온다. `menu.ts` 의 `headerLabel(key)` 가 현재 모드의 `jargonStyle` 로 그 표를 읽는
유일한 통로다. 한국어를 새로 하드코딩하지 말고 키를 추가하라.

규칙: **title 과 aria-label 은 언제나 정본**(긴 키), label 은 정본 또는 `*Short` 축약형.
설명 문구는 정본 뒤에 `—` 로 잇는다(`랜덤 전투 테스트 — 적 그룹을 뽑아 즉시 전투`) — 정본 자리에
설명문을 쓰면 같은 동작이 또 다른 이름을 얻는다.

| 개념 | uiCopy 키 | plain | technical |
|---|---|---|---|
| DB 편집기 | `database` / `databaseShort` | 자료집 / 자료집 | 데이터베이스 / DB |
| 보관함 | `resourceLibrary` (+ `resources`) | 소재 보관함 (+ 소재) | 리소스 보관함 (+ 리소스) |
| 세계관 | `world` | 세계관 | 세계관 |
| 음악·효과음 | `audio` / `audioShort` | 음악·효과음 / 음악 | 동일 |
| 맵·이벤트 찾기 | `mapEventSearch` / `mapEventSearchShort` | 맵·이벤트 찾기 / 찾기 | 동일 |
| 테스트 실행 | `testPlay` / `testPlayShort` | 테스트 실행 / 테스트 | 동일 |
| 랜덤 전투 테스트 | `battleTest` / `battleTestShort` | 랜덤 전투 테스트 / 전투 | 동일 |
| 레이어 | `layerLower` / `layerUpper` / `layerEvent` | 바닥 / 덧그림 / 이벤트 | 동일 |

**코드에 남으면 안 되는 폐기 문자열:** `자료 보관함`, `시연 실행`(및 `전체 프로젝트 시연 실행`,
`현재 프로젝트 시연 실행`), `음악/효과음`, `맵/이벤트 찾기`, 레이어 의미의 `하위`/`상위`,
`databaseShort` 의 `자료` 단독형, 이 검색 표면 명칭으로서의 `검색`.
계약 테스트 `test/editorHeaderTerminology.test.ts` 가 expert 모드 `renderTopbar` 를 실제로 렌더해
톱바 DOM 전체의 텍스트·title·aria-label(도구·게임 팝업 포함)에서 이들을 잡는다.

`layerShortLabel` / `toolShortLabel` 의 정본은 **`src/editor/panels/aiAgentBrief.ts`** 다.
`menu.ts` 는 2026-08-30 까지 자기 사본을 들고 `"하위"`/`"상위"` 를 반환했고, 그 값이 visually-hidden
`layer-selector` 스팬으로 스크린리더에 읽혔다 — 사본을 만들지 말고 import 하라.

### 톱바 영역 진입점 감사표 (`renderTopbar` 실측)

| 동작 | 진입점 전부(testid) | 판정 | 근거 |
|---|---|---|---|
| 테스트 실행 | `menu-game-play`, `mode-play`(=`topbar-test-play`), `authoring-task-test`, play 모드 클래식 `mode-play` | 의도됨 | 세 표면이 모두 `openTestPlayWindow()` 한 경계를 지난다. 톱바 버튼은 가장 잦은 동작의 단축 경로이고 e2e 다수가 `mode-play` 를 계약으로 쓴다 |
| 랜덤 전투 테스트 | `menu-game-battle-test`, `topbar-battle-test`(⚔), `toolbar-battle-test` | 의도됨 | `test/randomBattleTestToolbar.test.ts`, `test/menuWorldSurface.test.ts`, `test/e2e/editor-map-focused-shell.spec.ts` 가 ⚔ 버튼을 명시적으로 고정한다 |
| AI 설정 | `menu-tools-ai-settings`, `topbar-ai-settings` | 의도됨 | `test/menuWorldSurface.test.ts` 「헤더의 AI 설정 버튼이 설정 모달을 연다」 + `editor-map-focused-shell.spec.ts` 가 계약으로 고정 |
| DB 편집기 | `menu-tools-database`, `toolbar-database`, `authoring-task-data` | 의도됨(legacy) | 클래식 툴바는 전문가 전용 legacy 표면(`is-legacy-surface`)이고 RM 관례다. DB e2e 다수가 `toolbar-database` 를 쓴다 |
| 보관함 | `menu-tools-resources`, `toolbar-resource-manager` | 의도됨(legacy) | 위와 같음(`supabase-root-cache.spec.ts`, `oprn-sample-game.spec.ts`) |
| 세계관 | `menu-tools-world`, `toolbar-world` | 의도됨(legacy) | 위와 같음 |
| 음악·효과음 | `menu-tools-audio`, `toolbar-sound-test` | 의도됨(legacy) | 메뉴 항목은 초보·표준에서 유일한 도달 경로(2026-08-26), 툴바는 `play-audio-editor-proof.spec.ts` 계약 |
| 맵·이벤트 찾기 | `menu-tools-search`, `toolbar-search` | 의도됨(legacy) | 위와 같음 |
| 새 프로젝트 | `menu-project-new`, `toolbar-new` | 의도됨(legacy) | RM 관례의 툴바 첫 칸 |
| 저장 | `menu-project-save`, `toolbar-save` | 의도됨(legacy) | Ctrl+S 와 같은 `saveProjectNow()` |
| 저장본 다시 불러오기 | `menu-project-reload-db`, `toolbar-reload-db` | 의도됨(legacy) | 같은 `reloadProjectFromDbNow()` |
| 열기 | `menu-project-load`, `toolbar-load` | 의도됨(legacy) | 같은 `openDbConnectionSettings` |
| 가져오기 | `menu-project-import`, `toolbar-import` | 의도됨(legacy) | 같은 `doImport()` |
| 도움말 | `menu-help-shortcuts`, `toolbar-help` | 의도됨(legacy) | 같은 `openHelpModal()`. `menu-help` 자체는 expert 전용(`chrome.helpMenu`) |
| 맵 복사 | `toolbar-map-copy` | 단독 | 메뉴바에 없음 |
| 선택 이벤트 테스트 | `toolbar-event-test` | 단독 | 선택 이벤트가 없으면 disabled + 안내 title |
| 저장 상태·재시도 | `topbar-save-status`(→ `db-autosave-retry`) | 단독 | 하단 상태바 폐지 후 유일한 호스트 |
| 커밋 히스토리 / 신원 | `commit-history-toggle`, `topbar-identity` | 단독 | 트레일링 아이콘 클러스터 |
| 명령 실행 · 맵 이동 (Ctrl+K 팔레트) | `workspace-command-palette-button` | 단독(예외) | Ctrl+K 팔레트는 전 표면을 훑으므로 사이드바/헤더 IA 계약의 예외다. `commandPalette.ts` 의 `KIND_HEADERS` 는 `command`(명령) · `map`(맵 이동) 둘뿐 — title 은 `명령 팔레트 — 명령 실행 · 맵 이동 (Ctrl+K)`(정본 이름 + `—` 설명)이고 aria-label 도 같은 이름 `명령 팔레트` 를 쓴다 |
| **이름 충돌 (해소)**: 찾기 표면 | `workspace-command-palette-button` ↔ `menu-tools-search` / `toolbar-search` | 중복 이름 → 해소 | 구 팔레트 title `명령·맵·스킬 찾기 (Ctrl+K)` 가 (1) 2026-08-27 에 삭제된 조수 스킬을 광고하고 (2) 도구 메뉴의 `맵·이벤트 찾기` 와 함께 한 헤더에 `찾기` 표면을 둘 만들어 둘 다 "맵을 찾는다" 고 말했다. 역할이 다르므로 이름도 다르게 둔다 — **팔레트 = 명령 실행기 + 맵 이동, `맵·이벤트 찾기` = 프로젝트 데이터(맵·이벤트) 찾기**. 진입점은 둘 다 유지한다. 회귀 단정: `test/editorHeaderTerminology.test.ts` 「헤더에 찾기 표면은 하나다」 |
| 밀도·편집 모드·조수 위치 | `workspace-panels-button` → `workspace-panels-menu` | 단독 | 편집 모드 전환의 집(2026-08-26) |
| 패널 도크 멤버십(타일·맵) | 표준·전문가: `workspace-panel-toggle-tiles` / `-maps`(▤), 초보: 제공하지 않음 | 모드별 실제 capability | 초보의 타일 도크는 레일 호스트라 고정이고 맵 도크는 `mapTree=false` 로 렌더되지 않으므로 메뉴와 Ctrl+K 모두 도크 토글을 내놓지 않는다 |
| 초보 타일·맵 빠른 화면 | `basic-rail-toggle-tiles` / `-maps`(좌측 레일) | 단독 | 도크 멤버십을 바꾸지 않고 각각의 transient flyout만 여닫는다 |
| 작업 프리셋(맵·이벤트·데이터) | `authoring-task-map` / `-event` / `-data` | 단독 | ▤ 의 구 `workspace-layout-*` 3줄을 지웠다 — 아래 참조 |
| 창 컨트롤 | `window-toolbar-collapse`, `window-fullscreen` | 단독 | — |
| 레이어·도구 현재 상태 | `layer-selector` (visually-hidden) | 표시 전용 | 전환은 좌측 사이드바가 소유한다. 문구는 `aiAgentBrief.layerShortLabel` 정본 |


### 사이드바 ↔ 톱바 소유권 (2026-08-30 중복 정리)

위 감사표는 **톱바 내부**만 봤다. 실측하니 겹치는 축이 하나 더 있었다 — 좌측 사이드바와 톱바가
같은 명령을 둘씩 내놓는 자리. 규칙은 **한 명령의 집은 하나이고, 두 번째 표면은 첫 번째가 그
모드에서 렌더되지 않을 때만 둔다** 다.

| 겹쳤던 것 | 지금 소유자 | 지운 것과 이유 |
|---|---|---|
| 패널 도크 멤버십 `타일` · `맵` | 표준·전문가 = ▤ 패널 메뉴와 Ctrl+K, 초보 = 제공하지 않음 | 초보의 `tiles` 는 아이콘 레일 호스트라 고정이고 `maps` 도크는 `BEGINNER_CHROME.mapTree=false` 로 화면에 렌더되지 않는다. `isLeftDockPanelOffered` 가 두 판단을 메뉴/명령 레지스트리에 공유한다. 초보의 `basic-rail-toggle-tiles/-maps` 는 같은 명령이 아니라 transient flyout을 여닫는 별도 화면이며 `docks.left` 를 바꾸지 않는다. 그래서 ▤의 「패널」 그룹은 초보에서 숨기고 Ctrl+K의 `workspace-panel-tiles/-maps`도 등록하지 않는다. 예전 `aria-disabled` 타일 행의 「끌 수 없습니다」 설명은 닫기 컨트롤과 함께 의도적으로 사라졌다. |
| 작업 프리셋 `맵 중심` · `이벤트 중심` · `데이터 중심` | 저작 작업 칩 `authoring-task-map` / `-event` / `-data` | ▤ 의 「레이아웃」 3줄이 칩과 같은 `setWorkspacePreset` 을 부르면서 칩이 하는 실제 일(레이어 전환·DB 모달)은 하지 않았다. 줄은 지웠다. 칩의 활성 표시는 작업 완료가 아니라 **현재 레이아웃 프리셋**임을 title/aria-label로 명시하고, 상호배타 관례대로 활성 칩에만 `aria-current="true"`를 둔다. `authoring-task-test`는 일회성 실행이라 상태를 갖지 않는다. Ctrl+K `workspace-preset-*`는 이름대로 배치만 바꾼다. |

지우지 **않은** 것과 이유:

- `authoring-task-test` ↔ `mode-play`(▶ 테스트) ↔ `menu-game-play` — 위 감사표가 의도된
  단축 경로로 판정했고 e2e 다수가 `mode-play` 를 계약으로 쓴다.
- 메뉴바 ↔ 클래식 툴바(전문가 전용 `is-legacy-surface`) — 같은 판정. RM 관례다.
- 칩 `맵`·`이벤트` ↔ 좌측 레일의 레이어 버튼 — 칩은 `selectSidebarLayer` 를 불러 **사이드바가
  소유한 컨트롤을 움직인다**. 두 번째 컨트롤이 아니라 그 컨트롤의 원격 스위치이고,
  `test/authoringTasks.test.ts` 가 그 동작(레이어+도구가 실제로 바뀐다)을 계약으로 고정한다.

회귀 단정: `test/leftDockPanels.test.ts` 「초보 모드에서는 레일 플라이아웃만 제공하고 렌더되지 않는 도크 토글은 어디에도 내놓지 않는다」 · 「표준 모드에서는 이 메뉴가 패널 토글의 유일한 집이다」, `test/authoringTasks.test.ts`
「패널 메뉴에 작업 프리셋을 두 번째 이름으로 다시 내놓지 않는다」 · 「현재 레이아웃 프리셋만
aria-current로 말하고 일회성 테스트에는 상태를 붙이지 않는다」. 실측 증거는
`scripts/capture-chrome-dedupe-evidence.mts` (모드별 새 browser context, before/after `surface.json` + PNG).

**이 감사에서 지운 것은 진입점이 아니라 용어를 중복 정의한 코드다.** 메뉴바 ↔ 클래식 툴바 중복은
전문가 전용 legacy 표면이라 유지하고, `topbar-ai-settings` · `topbar-battle-test` 는 기존 테스트가
계약으로 고정한 의도된 단축 경로다.

### 스튜디오 바 — 톱바 한 줄 (2026-09-03, 표준·전문가 대격변)

위 「사이드바 ↔ 톱바 소유권」 절이 *유지*로 판정했던 셋을 이번에 걷었다. 실측(1440×900): 톱바 한 줄에
같은 무게의 글자 버튼 18개, 전문가는 그 아래 67px 클래식 툴바 행 15개 중 14개가 메뉴 복제, 테스트 실행의
집이 넷(작업 칩·▶ 버튼·게임 메뉴·클래식 툴바), 「보기」 메뉴의 밀도(안내/보통/촘촘)와 편집 모드(초보/표준/전문가)가
같은 축을 두 번. 규칙은 그대로다 — **한 동작의 집은 하나, 자리는 빈도로.**

| 표면 | 지금 | 근거 |
|---|---|---|
| 톱바 | `.oprn-menu-bar.studio-bar` 48px 한 줄, 3열 그리드(파일·자료 \| 명령 팔레트 \| 실행·화면·세션). 소유 시트 `src/styles/shell/studio-bar.modern.css`(마지막 발언자, hex 0·!important 0) | 전문가 캔버스가 67px 되찾음(topbar 116→49) |
| 프로젝트 메뉴 | 얼굴이 **프로젝트 이름**(`menu-project`, `projectMenuLabel()`, 없으면 「제목 없는 프로젝트」). 항목에서 「저장」 삭제 | 톱바가 어느 프로젝트인지 말하는 유일한 자리. 저장은 버튼이 집 |
| 저장 | `toolbar-save` 아이콘 버튼 + 자동 저장 점(`data-autosave-kind`, 초록/호박/빨강). title 은 정확히 「프로젝트 저장 (Ctrl+S)」(e2e 계약). 구독은 저장 상태 칩의 하나에 얹음(`paintSaveDot`) | 평상시 저장 상태가 보이지 않던 결함. 점은 폭 고정이라 옆 버튼이 안 움직인다 |
| 자료집·소재 | `toolbar-database`·`toolbar-resource-manager` 버튼 — **표준·전문가 모두**(e2e 46개가 이 testid 를 DB 진입점으로 씀). 초보는 버튼 없이 도구 메뉴가 담음 | 표준에서 도구 메뉴 두 번 클릭이 유일한 길이었다 |
| 도구 자리 | 표준 = 「도구 ▾」 메뉴(세계관·음악·찾기), 전문가(`chrome.toolStrip`) = 같은 셋을 인라인 아이콘 버튼(`toolbar-world`/`-sound-test`/`-search`), 도구 메뉴 없음 | 같은 모드에 두 표면을 두지 않는다. 플래그 이름 `classicToolbar`→`toolStrip` |
| 명령 팔레트 | 가운데 `명령 · 맵 이동  Ctrl K`(VS Code 명령 센터 꼴). <1280 아이콘만 | 전체 검색이라 한 집 규칙의 예외 |
| 실행 | `[▶ 테스트 \| ⚔]` 한 그룹(`studio-run-group`). 게임 메뉴 삭제 | 게임 메뉴 두 항목이 모두 이 버튼들의 복제 |
| 보기 ▾ | 패널 토글(체크) + 편집 모드 라디오 3줄(힌트 포함). **밀도 그룹 삭제**, aria-label 「보기 — 패널과 편집 모드」/(초보)「보기 — 편집 모드」 | `setWorkspaceDensity` 는 `setEditorUiMode` 의 두 번째 이름이었다 |
| 세션 묶음 | ? 도움말(`menu-help` 아이콘 메뉴) · 기록 · 신원 · ⚙ AI 설정(아이콘, testid 유지) · ⤢ 전체화면. 「툴바 접기(─)」 삭제 | 접을 두 번째 행이 없다 |
| 작업 칩 4개 | 삭제. `runAuthoringTask` 는 Ctrl+K 「작업: …」 용으로 남고 **도크 프리셋 결합을 풀었다**(`setWorkspacePreset` 삭제) | 「데이터 중심」이 모달 뒤에서 좌측 도크를 비워 모달을 닫으면 팔레트가 사라진 채 남는 함정 |
| 선택 이벤트 테스트 | 이벤트 편집기 「테스트」 + 이벤트 우클릭 「이 이벤트 테스트」(`event-layer-test-event`) | 클래식 툴바 `toolbar-event-test` 의 집 이전 |
| 캔버스 툴바 | 구조·testid 그대로, 32px 컨트롤 유리 pill 로 재도색(같은 시트 §10) | — |

Ctrl+K: `workspace-density-*`·`workspace-preset-*` 명령 삭제, `editor-ui-mode-*`(옛 밀도 낱말은 keywords)·`open-audio`·`open-map-event-search`·`save-project` 추가.

회귀 단정: `test/studioBarActions.test.ts`(집 하나·중복 testid 0·모드별 도구 자리·저장 점·프로젝트 이름), `test/editorMenuSidebarIa.test.ts`(게임 메뉴 부재·전문가 인라인·초보 도구 메뉴), `test/editorHeaderTerminology.test.ts`(모드별 집에서 정본 이름), `test/authoringTasks.test.ts`(프리셋 결합 해제), `test/commandRegistry.test.ts`. e2e 는 `toolbar-database`·`mode-play` 계약을 유지하고 삭제 표면을 쓰던 스펙 18개를 새 집으로 고쳤다. 보고서 `docs/2026-09-03-studio-bar.md`.
