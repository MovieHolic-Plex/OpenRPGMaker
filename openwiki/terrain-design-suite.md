# 지형 설계 10종 (2026-10-03)

「높이」 진입 → 캔버스 아래 **지형 설계**. 떠 있는 패널의 도구·옵션을 고르고
캔버스에 외곽/경유점을 찍은 뒤 **적용 / Enter**로 확정한다. 패널을 닫아도 Enter를 쓸 수 있다.
Esc/오른쪽 버튼은 미완성 점을 취소한다. 패널 머리줄은 드래그해 옮긴다.

## 도구 계약

| 도구 | 입력과 결과 |
|---|---|
| 절벽 윤곽 | 다각형 / 사각형 / 폭 있는 선. 각 칸의 현재 높이에 입력한 변화량을 더한다. 음수는 내리기. |
| 길 | 경유점 선, 폭. 모퉁이는 직교 연결되고 바닥 autotile을 성형한다. 지형 따라가기는 곧은 절벽의 평지 공간에 경사로를 연결하고, 평탄화는 첫 점 높이로 맞춘다. |
| 능선 / 계곡 | 경유점 선과 폭, 높이 변화량. 중심부터 가장자리로 변화량이 줄어든다. |
| 호수·해안 | 다각형 / 사각형, 수위·최대 깊이·걸을 수 있는 물가 폭. 보호된 물체·통로를 제외한 영역의 경계에서 안쪽으로 깊이를 계산한다. |
| 재질 혼합 | 클릭 영역, 풀·흙·돌 비중, 시드. 해당 칩셋의 재질만 사용하고 높이는 유지한다. |
| 혼합 군집 | 클릭 영역, 나무·바위·덤불 비중, 밀도, 시드. 칩셋의 기존 구조 키트를 섞고 원의 가장자리 밀도를 줄인다. 전체 군집은 기존 선택/이동/삭제로 다룬다. |
| 지형 도장 | 두 모서리로 최대 128×128칸을 저장. 같은 칩셋의 다른 맵에 회전/반전해 놓는다. 1~4층·그림자·높이·경사로·수심·벽면 장식·완전한 군집을 포함한다. |
| 영역 잠금 | 다각형 / 사각형 잠그기·해제. 잠긴 칸은 보라색 표시. 공통 타일 편집 경로가 원래 타일·높이·통로·그림자·수심을 보존한다. |
| 경로 검사 | 출발점 → 목적지. 실제 `canMove` 4방향 탐색. 파랑 경로, 노랑 지정 폭 미만 병목, 빨강 끊긴 앞 칸, 출발/목적지 표시. |

고지 1·2·3단 프리셋은 없다. 기존 높이 엔진의 저장 범위는 유지한다.
길의 자동 경사 연결은 기존 `planReliefRamp`의 같은 높이 벽·아래 평지·물체 보호 조건을 따른다.
실제 게임의 이벤트/NPC/스위치 상태는 경로 검사에 포함하지 않는다.

## 대칭과 도장

대칭은 없음·좌우·상하·좌우/상하·180°·90° 회전. 90° 회전 대칭은 정사각형 맵에서만 선택한다.
높이·표면·강·경사로/지형지물과 설계 도구가 같은 좌표 변환을 사용한다.
도장은 별도로 0/90/180/270°와 좌우 반전을 제공한다. 경사로 방향과 그림자 비트도 회전한다.
소품의 연결된 그림 조각은 똑바로 유지하며 중심/위치만 변환한다. 여백이 부족하거나 서로
겹치면 적용 전에 거부한다. 군집 일부만 잘라 저장하는 것도 거부한다.

## 소유와 저장

- UI: `editor/panels/terrainDesignPanel.ts`, `editorState.ts`, `styles/editor/terrain-design.css`.
- 점 수집/확정/히스토리: `terrainDesignActions.ts`, `TilePaintEngine.applyRelief`, `reliefToolbar.ts`.
- 순수 계획: `terrainDesignGeometry.ts`, `terrainDesignPlans.ts`, `terrainStamps.ts`.
- 표시: `terrainDesignOverlay.ts`, `editSceneHoverPreview.ts`, `EditScene.viewChromeKey`.
- `map.terrainDesign?`: `lockedCells?`(정렬된 칸 번호), `waterDepth?`(맵 면적 배열; 0 땅, 1 얕은 물, 2~14 깊은 물).
- 수위는 실제 `relief.levels`에 저장한다. 물 재질 위 1 깊이는 바닥 통행을 열고, 상층 물체는 계속 통행을 결정한다.
  깊은 물은 막히며 코드 9 다리의 통행은 널판 타일을 따른다.
- `project.terrainStamps?`: id·이름·칩셋·크기와 모든 칸 데이터, 선택 장식/군집. 저장 라이브러리는 맵과 별개다.
- 정규화: `project/terrainDesign.ts`, `io/shape.ts`. 빈 선택 필드는 삭제한다.
- 복제/크기 변경: `mapLayers.ts`의 clone/remap/crop이 잠금·수심을 함께 옮긴다.
- 잠금 초크포인트: `store.updateMapTiles` → `terrainLocks.restoreLockedTerrainCells`.
  Undo 및 명시적 전체 맵 교체/크기 변경은 일반 `updateMap` 계약을 따른다.
- 게임 통행: `collision.cellPassOrNull`. 성분 캐시 지문에 수심·높이·경사로를 포함한다.

## 확인

`scripts/capture/capture-terrain-design-suite.mjs`는 독립 메모리 QA 맵에서 실제
버튼·포인터·키보드로 모든 도구를 조작하고 화면/연속 GIF/스토어 관측값을 기록한다.
사용자 호스트의 맵은 별도의 읽기 확인 대상이다. 기록: `verify-shots/terrain-design-suite/`.
이어 `node scripts/capture/save-terrain-design-fixture.mjs`가 같은 시연 데이터를
`.vite-cache/terrain-design-store/project.sqlite`에 저장하고 저장소를 닫은 뒤 다시 열어
도장·잠금·수심·경사로·군집을 확인한다. 사용자 프로젝트에는 시연 콘텐츠를 쓰지 않는다.
AGENTS.md에 따라 vitest·전체 typecheck·gates는 사용자가 지시한 경우에만 실행한다.
