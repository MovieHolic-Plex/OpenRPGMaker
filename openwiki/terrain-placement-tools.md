# 지형 설치 도구 (2026-10-03)

높이 막대의 `높이 / 표면 / 강 / 군집 선택`에서 고른다. 기존 높이 올리기·내리기·상한·정밀 붓은 유지한다.
고지 1·2·3단 프리셋은 추가하지 않았다. 높이 엔진의 기존 저장 범위도 그대로다.
팀 호스트의 `.oprn-team-session-bar`가 있으면 아래 막대를 64px 위에 두어 상태 배지와 겹치지 않는다.
표면/강/군집 모드의 한 줄 막대에서도 높이로 돌아가는 버튼을 실제 포인터로 누를 수 있어야 한다.

## 소유 경로

- UI: `editor/panels/reliefToolbar.ts`, `editorState.ts`, `styles/editor/relief-toolbar.css`.
- 포인터/스트로크 되돌리기: `TilePaintEngine.applyRelief`. 표면·강은 표본 사이를 보간한다.
- 접합 계획: `reliefRampPlan.ts`, `reliefDoodads.ts`, `terrainDoodadPlan.ts`.
- 군집 계획·복원: `terrainClusters.ts`; 저장 모양·정규화·칸 이동: `project/doodadGroups.ts`.
- 표면·강: `terrainMaterials.ts`, `terrainBrush.ts`. 기존 칩셋 의미 이름과 autotile 정의를 사용하며 타일 번호를 추측하지 않는다.
- 통행: `project/terrainReachability.ts`, `editSceneRender.ts`. 실제 `collision.canMove`와 네 층 통행/높이 규칙을 함께 사용한다.

## 동작

경사로·계단은 가까운 북·남·동·서 절벽을 찾고 폭 2/4/6칸으로 놓는다. 길이 = 높이 차 + 1.
아래 땅이 같은 높이여야 하며 물체/기존 다른 통로를 덮지 않는다. 같은 접합부의 통로를 새 폭이 온전히 포함할 때 교체한다.
네 방향 모두 `ramps` 1~8 계약을 쓰며 높이 값 자체는 바꾸지 않는다. 고스트와 클릭은 같은 계획을 쓴다.

다리는 가로/세로를 고르고 첫 둑 → 같은 줄 반대 둑을 클릭한다. 폭 2칸, 같은 높이의 통행 가능한 둑을 잇는다.
낮은 틈 또는 물을 통과할 수 있지만 물체/다른 통로는 덮지 않는다. Esc/오른쪽 버튼으로 시작점을 취소한다.
0단 물 위 다리도 저장되도록 `normalizeRelief`/`remapExtraLayers`는 전부 0단이어도 코드 9가 있으면 relief를 보존한다.

나무·바위 탭의 `군집 배치`, 밀도 성김/보통/빽빽, S~XL 반지름을 사용한다. 배치는 좌표 해시로 결정적이다.
전체 키트가 같은 높이에 들어오며 길·물·통로·물체·이벤트를 피한다. 군집 선택 → 옮기기 → 새 자리 클릭, 또는 군집 지우기.
밑의 3층 값을 기록하며 삭제/이동 시 아직 자기 타일인 칸만 복원한다. 다른 붓으로 바뀐 군집의 이동은 거부한다.
전체 동작은 기존 맵 스냅숏 undo/redo를 사용한다.
`hotkeys.handleHistoryHotkey`는 같은 KeyboardEvent를 WeakSet으로 한 번만 소비한다.
화면 QA에서 리스너가 중복되어 Ctrl+Z 한 번이 군집 삭제·이동·배치 세 단계를 지우던 것을 막는다.

표면 붓은 풀/흙·모래/돌 재질, 폭 1/3/5/7칸이다. 높이·통로·상층을 유지하고 1·2층 바닥을 바꾼다.
경계는 칩셋의 기존 autotile을 사용한다. 해당 재질이 없는 칩셋은 선택지를 비활성화한다.
강 붓은 물/물가 autotile을 놓고 첫 칸 높이의 평평한 강바닥을 만든다. 기존 물과 접합하며 통로·물체·이벤트를 보호한다.
물이 없는 칩셋은 강 단추가 비활성화된다. 새 그림을 생성하거나 다른 칩셋으로 바꾸지 않는다.

통행 미리보기는 시작 맵에서 시작 지점 기준 도달 가능한 칸(초록)과 불가능한 칸(빨강)을 표시한다.
네 방향 통행, 나무/소품 타일, 경사로의 옆 진입 금지를 반영한다. 동적 이벤트/NPC/스위치 상태는 실행 시 달라질 수 있다.
맵 객체·타일셋·시작 좌표가 같으면 BFS 결과를 재사용하며 단일 Graphics의 같은 행 구간으로 그린다.

## 저장·크기 변경

`GameMap.doodadGroups?`는 편집기 묶음만 저장한다. 런타임은 실제 타일을 그대로 읽는다.
각 묶음: `id`, `label`, `kitId`, `cells[{index,tile,before}]`(3층). 옛 맵은 필드가 없다.
`shape.ts` 정규화가 형식·범위·중복을 정리한다. `cloneExtraLayers`는 복원 정보를 깊게 복사하고
`remapExtraLayers`/`cropExtraLayers`는 칸과 함께 묶음을 옮기거나 잘라낸다. 잘린 묶음은 남은 칸만 묶여 있다.
기존 맵 타일 붓으로 내용을 바꾼 경우 삭제는 새 타일을 보존하고 이동은 거부한다.
SQLite/내보내기 직렬화는 맵의 선택 필드로 저장한다. 수동 버전 변경은 없다.

## 확인

`scripts/capture/capture-terrain-placement.mjs`는 실제 편집기 메모리 fixture에서 배치·표면·강·군집·undo/redo와 화면을 기록한다.
이 fixture는 사용자의 정본 맵을 저작하지 않는다. 기록: `verify-shots/terrain-placement/SUMMARY.md`.
회귀 계약은 `test/terrainPlacement.test.ts`; AGENTS 실행 제한에 따라 로컬 vitest·전체 타입 검사·게이트는 돌리지 않는다.

실제 연속 동작 GIF는 `scripts/capture/capture-terrain-gif.mjs`로 만든다(Playwright Chromium + ffmpeg).
고지만 준비한 독립 메모리 fixture에서 경사로·표면·강 드래그·다리·군집·이동·삭제·Ctrl+Z·통행을
실제 포인터/키보드로 조작하고 CDP 화면 프레임을 기록한다. 출력과 관측값은
`verify-shots/terrain-operation-gif/`에 있다. 사용자 호스트 맵에는 쓰지 않는다.
