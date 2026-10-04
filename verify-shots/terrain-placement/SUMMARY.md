# 지형 설치 도구 — 실제 편집기 확인

2026-10-03 · `scripts/capture/capture-terrain-placement.mjs` · 격리된 40×30 메모리 fixture, Beodeul City 칩셋.
사용자 정본 맵을 저작하지 않았다. `observations.json`에 실제 도구/스토어 관측값을 남겼다.

## 즉시 확인

- `editor-tools.png`: 높이/표면/강/군집 선택, 기존 높이 붓, 다리·경사로·군집이 놓인 화면.
- `editor-reachability.png`: 실제 타일·높이 통행 규칙으로 도달 가능한 땅과 막힌 물/소품 표시.
- `cluster-placed.png` / `cluster-deleted.png`: 군집 전체 배치와 삭제 후 바닥 복원.
- `editor-map.png`: 실제 캔버스와 아래 도구막대.

## 관측

- 네 방향 × 폭 2/4/6칸, 총 12개 경사로 계획이 실제 `canMove` 기반 탐색으로 고지에 연결된다.
- UI에서 폭 6 경사로 18칸, 두 둑 클릭 다리 10칸이 기록된다.
- 표면 붓을 고지에 칠해도 기존 높이 배열이 동일하다.
- 밀도 15/35/70 군집은 27/75/108개 타일을 배치한다. 길·물·통로·물체를 피하며 이동·삭제 후 원래 상층이 복원된다.
- UI 군집 이동·삭제, Ctrl+Z → Ctrl+Y → Ctrl+Z 후 그룹 수 0→1→0→1.
- 같은 키 이벤트 중복 소비를 막은 뒤 히스토리 깊이 22→21→22→21. 이전 관측에서는 한 키가 세 단계(22→19)를 소비했다.
- 화면 캡처 중 JavaScript 오류 0건.

## SQLite 저장·재로드

내보낸 최소 QA fixture를 `.vite-cache/terrain-placement-store`의 실제 SQLite 저장소 API로 저장한 뒤 닫고 다시 열었다.
project id `ed8b658e-3e4b-464b-95d4-389d8c0f1175`, revision 3.
군집 1개와 0단 물 위 다리 코드 9의 10칸이 재로드된다. 세부 근거: `sqlite-roundtrip.json`.
이 폴더는 독립 QA 대상이며 사용자 호스트 프로젝트와 별개다.

## 범위

통행 미리보기는 시작 맵의 지형·타일 기준이다. 동적 이벤트/NPC/스위치는 게임 실행에서 달라질 수 있다.
변경 모듈은 구문 변환으로 확인했다. AGENTS.md 실행 제한에 따라 vitest·전체 typecheck·gates는 실행하지 않았다.
회귀 계약 소스: `test/terrainPlacement.test.ts`, `test/historyHotkeyFeedback.test.ts`.
