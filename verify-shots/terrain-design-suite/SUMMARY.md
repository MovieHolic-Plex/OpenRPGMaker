# 지형 설계 10종 실제 화면 확인 — 2026-10-03

## 즉시 확인

- `terrain-design-suite.gif`: 실제 Chromium 연속 녹화, 약 56초. 캡션과 포인터 표식만 보조 표시다.
- `editor-suite.png`: 설치된 패널과 완성한 QA 맵.
- `lake.png`: 자동 물가와 얕은 물 표시.
- `stamp.png`: 고지·경사로 90° 회전과 반전.
- `route.png`: 경사로를 통과한 경로와 폭 3칸 미만 병목.

## 관측

40×30 독립 QA 맵에서 실제 DOM 버튼·입력·캔버스 포인터·Enter로 조작했다.
초기 맵 준비와 읽기 계측만 스토어 API를 사용했다. 사용자 호스트 프로젝트는 수정하지 않았다.

| 기능 | 실제 결과 |
|---|---|
| 절벽 윤곽 | 다각형 80칸, 중앙 높이 2 |
| 길 | 경유점 연결, 자동 경사로 6칸 |
| 능선 | 선을 따라 중앙 높이 3 |
| 계곡 | 같은 위치를 높이 2로 낮춤 |
| 호수·해안 | 물가 깊이 1 진입 가능, 안쪽 깊이 3 진입 불가 |
| 재질 혼합 | 서로 다른 바닥 재질 배치, 고지 높이 2 유지 |
| 혼합 군집 | 기존 구조 키트의 여러 소품, 그룹 1개 / 그림 칸 32개 |
| 지형 도장 | 라이브러리 1개 저장, 회전된 동서 경사로 6칸 |
| 영역 잠금 | 9칸 보호, 표면 붓 후 타일·높이 보존 |
| 경로 검사 | 이동 14칸 경로, 폭 3칸 미만 병목 3칸 |
| 공통 대칭 | 좌우 대응 지형 높이가 모두 1 |
| 히스토리 | Ctrl+Z로 변경, Ctrl+Y로 맵 전체 데이터 원상 복원 |

페이지 오류 0개. 자세한 값은 `observations.json`.
영역 스크린샷 시 일시적인 잘린 compositor 프레임 13개는 연속 녹화에서 제외했다.
정상 뷰포트 1007개 프레임의 실제 시간 간격으로 GIF를 만들었다.

## 정본 저장 왕복

`scripts/capture/save-terrain-design-fixture.mjs`가 `.vite-cache/terrain-design-store/project.sqlite`에
시연 데이터를 저장하고 저장소를 닫은 뒤 다시 열었다. project id:
`8c47087e-8685-4405-bdce-94ee28270266`.
도장 1개·잠금 9칸·얕은 물 44칸·깊은 물 24칸·경사로 12칸·군집 1개가 재로드됐다.
근거: `sqlite-roundtrip.json`. JSON export 자체를 저장 증거로 쓰지 않았다.

## 범위와 제한

- 도장은 같은 칩셋에서 사용하며 최대 128×128칸이다. 소품 그림은 똑바로 유지한다.
- 자동 경사 접합은 기존 경사로의 평평한 둑·충분한 공간·장애물 보호 조건을 따른다.
- 경로 검사는 실제 지형 통행을 사용한다. 동적 이벤트/NPC/스위치는 게임에서 별도로 확인한다.
- 90° 회전 대칭은 정사각형 맵에서만 가능하다.
- AGENTS.md 실행 제한에 따라 vitest·전체 typecheck·gates는 실행하지 않았다.
  회귀 계약 소스는 `test/terrainDesignPersistence.test.ts`에 추가했다.

## 재현

```sh
npm run dev:worktree
node scripts/capture/capture-terrain-design-suite.mjs
node scripts/capture/save-terrain-design-fixture.mjs
```
