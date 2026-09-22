# 계단 대지 개정8 근거 — 2026-09-23

- `storage-proof.json`: 정본 SQLite `44d88b94-…` revision 13 → 16(중간 저장 2회 포함) 저장, 재오픈 후 전체 일치(`save.mjs`가 저장 직전 스냅숏 동일성도 단언).
- `validation.json`: 세 맵 정상 0오류, 고장 예시 19종이 모두 정확한 좌표에서 검출. 19번째 `terrace-without-stairs` = 솔바람 서쪽 절벽 끝 숲 제거.
- `region-browser-proof.json`: 실제 앱 자료집 → 지역에서 새 3개 AI 행 조회·미리보기 크기·다운로드가 배포 파일과 일치, 활성 프로젝트 변경 없음.
- `reference-panel-proof.json`: 재오픈 정본으로 `renderTilesetReferences` 관측 — 용도 `diverse-villages-terrace-v8`, 이미지 누락 0.
- 렌더: 앱 `drawMapTileLayers` 출력과 독립 파이썬 합성기 출력이 세 맵 모두 픽셀 동일.

저작 스크립트가 단언하는 것: 계단을 모두 막으면 시작점에서 어떤 윗선 위 칸에도 닿지 않는다(세 맵).
게이트·vitest·전체 typecheck는 워크트리 세션 규칙에 따라 돌리지 않았다. 문 전이·NPC·실내는 여전히 없다.
