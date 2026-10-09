# 영역 지정 AI 작업 도구 (Region AI Task)

- 작성일: 2026-07-06
- 작성자: Claude (Opus 4.8) — 직접 구현 (사용자 명시 요청으로 Codex 위임 예외)
- 관련 이전 작업: Wave N~Q (scatter/구성/규칙/인스펙터 UI)

## 목적

지도 위에서 사각형 영역을 지정하고, 그 영역에 대해 자연어로 AI에게 작업을
지시한다(예: "여기 침엽수 숲으로 채워"). AI의 쓰기는 그 사각형 **밖으로 절대
새어나가지 않는다**(하드 스코프).

## 배경 — 이미 존재하는 조각

- `editorState.selection = {mapId,x,y,width,height}` : 드래그로 만드는 사각형 선택.
  toolbar `select` 도구 + `EditScene`(pointerdown→`selectTileRegion`)가 이미 생성.
- AI 패널은 이 선택을 컨텍스트 칩·footer로 이미 모델에 전달(단, 소프트 컨텍스트).
- `openMapContextMenu({items,mapId,mapName,point})` : 범용 맵 컨텍스트 메뉴 렌더러.
- `EditScene.openEventLayerMenu` : 우클릭 이미 캡처(네이티브 메뉴는 `disableContextMenu`).
- AI 커밋 경로(`aiChatPanel:412`, `clusterAiModal:293`)는 다중 툴 제안을
  `recordProjectSnapshot(label,mapId)` **1회 + `store.replace(proposed)`** 로 적용
  → 제안 1건 = undo 1개.
- `AssistantSession(project, {contextOptions})` · `sendUserMessage(msg,onEvent)` ·
  `getProposedProject()` : 기존 AI 스택 그대로 재사용.

즉 "제로부터 신규"가 아니라 **선택을 1급 하드-스코프 작업 도구로 배선**하는 일.

## 결정 사항 (확정)

- 트리거: **선택 영역 우클릭 → 컨텍스트 메뉴 "✦ 이 영역에 AI 작업…"**.
- 스코프 강도: **정확히 클립 · 0칸 번짐**(캐노피가 밖으로 나오길 원하면 상자를 크게).
- AI 스택: **기존 `AssistantSession` 재사용**(신규 AI 인프라 없음).
- 영역 주입 = **메시지 footer(가이드)** + 사후 **클립(보장)** 이중.
- undo: 영역 작업 1회 = 스냅샷 1개(기존 커밋 경로 형태 그대로).

## 아키텍처

```
우클릭(선택 안)  →  mapSelectionContextMenu.regionTaskMenuItems()
                     └→ openMapContextMenu([region item, …event items])
region item     →  openRegionTaskModal({mapId, region})
[실행]          →  runRegionTask({mapId, region, instruction, onEvent})
                     1. session = new AssistantSession(store.getCurrent(),
                          {contextOptions:{currentMapId:mapId}})
                     2. session.sendUserMessage(instruction + regionFooter, onEvent)  // 스트리밍
                     3. proposed = session.getProposedProject()
                     4. {project: clipped, clippedCells} =
                          clipMapCellsToRegion(store.getCurrent(), proposed, mapId, region)
                     5. recordProjectSnapshot("영역 작업: …", mapId)   // undo 1개
                     6. store.replace(clipped)                        // 자동저장 스케줄
                     7. return {changedCells, clippedCells, calls}
모달            →  스트리밍 로그 + 요약("N칸 변경 · M칸 영역 밖 클립")
```

### 구성요소(각 1책임)

1. **`clipMapCellsToRegion(base, proposed, mapId, region)`** — 순수 함수(코어 보장).
   - proposed를 복제, 대상 맵의 **영역 밖** 셀에 대해
     `lowerTiles[i]/upperTiles[i]` 를 base 값으로 되돌리고
     `lowerTileStacks[i]/upperTileStacks[i]` 를 base 상태로 복원(키 삭제/복구).
   - 영역 안 셀 변경은 보존. 다른 맵·타일셋·그룹·규칙 변경은 통과(배치에 필요한
     그룹/타일셋 정의는 살린다). base는 불변(순수).
   - 반환 `{project, clippedCells}` — clippedCells = 영역 밖에서 되돌린 셀 수.
2. **`runRegionTask(opts)`** — 위 오케스트레이션. 결정성/락(`canEditMap`) 확인.
3. **`regionTaskMenuItems(selection, onPick)`** — 컨텍스트 메뉴 항목(단일 "AI 작업…").
4. **`openRegionTaskModal({mapId, region})`** — 입력 textarea + 실행/취소 + 로그/요약.
5. **`EditScene`** — 우클릭 셀이 활성 선택 안이면 region 항목을 event 항목 앞에 합쳐
   `openMapContextMenu`(무손실 augment).

### regionFooter (모델 가이드)

```
[작업 영역 제약] 맵 "<name>"의 사각형 (x0,y0)~(x1,y1), 가로 W×세로 H 안에서만
작업하라. 이 영역 밖 타일은 절대 수정하지 마라. area{x,y,w,h}를 받는 툴은 정확히
{x:X, y:Y, w:W, h:H} 를 사용하라.
```

## 에러 / 경계

- 선택 없음/잠금맵(`canEditMap`=false) → region 항목 비표시 또는 disabled + toast.
- 제안이 비었거나 영역 안 변경 0 → "변경 없음" 안내(스냅샷/replace 생략).
- 영역 밖 write가 있었으면 요약에 "M칸 클립됨" 표기(투명하게 보고).
- v1 하드-클립 범위 = **타일 4구조(lower/upper Tiles·Stacks)**. 이벤트/기타 프로젝트
  변경은 footer로 가이드만(향후 이벤트 클립 확장 여지). 주 유스케이스(채우기/그리기/
  지우기)는 완전 보장.

## 테스트

- `test/regionTaskClip.test.ts` : 영역 밖 lower/upper/stacks 복원, 영역 안 보존,
  clippedCells 카운트, base 불변, 다른 맵/그룹 통과.
- `test/regionTaskMenu.test.ts` : `regionTaskMenuItems` 항목 testid/label, action이
  모달 오픈 호출.
- `test/regionTaskModal.test.ts`(fakeDom) : 영역 칩·textarea·실행 버튼 렌더, 빈 입력
  실행 차단.
- 게이트: `npm test`(기준선 1539 passed | 1 skipped 유지+추가) · `npm run build` 0.

## 비목표(v1)

- 이벤트/데이터베이스의 영역 클립(가이드만).
- N칸 번짐 옵션, 다중 영역, 영역 저장/재사용.
- 런타임 툴 인자 강제 주입(클립으로 대체).
