# 다양한 마을 배포 근거 — 2026-09-23

- `storage-proof.json`: 별도 SQLite 정본 `44d88b94-58eb-4dee-a11a-88737da7001b`, 실제 저장 경로·revision·SHA와 재로드한 3개 map ID.
- `original-preservation.json`: 이슬여울 전체 프로젝트의 저작 전 export와 작업 후 공식 SQLite load의 SHA가 동일. 원본 변형 없음.
- `region-library.png`, `*-region.png`, `region-browser-proof.json`: 실제 공용 지역 7개 중 새 3개, 속성 토글, 크기를 확보한 미리보기, 파일 다운로드 및 AI 전체 행 배열 일치. 활성 프로젝트 변경 없음.
- `reference-panel.png`, `reference-errors.png`, `browser.json`: SQLite 재로드본으로 실제 `renderTilesetReferences` 컴포넌트 관측. 33 MD/8 이미지 용도와 5종 오류 그림 표시; 첨부 누락/페이지 오류 0. 읽기 전용 컴포넌트 하네스이며 저장 증거와 분리한다.
- `distribution-proof.json`: 새 프로젝트에 용도 포함, 기존 프로젝트 누락 용도 보충, 작성자 문서/공유 포인터/다른 칩셋 보존, 반복 적용 멱등성, 다운로드 3개 직렬화 왕복.
- `validation.json`: 정상 세 맵, 의도적인 뿌리/줄기/외곽 방향/레이어/입구 오류를 실제 좌표에서 검출. 범위는 동결 표본 비교와 엔진 타일 도달성이다.
- `visual-*.png`: 대화 비교 화면의 세 선택 상태와 폭 360px에서 가로 넘침 없음. 원본 맵 이미지는 `tiledata/forest-villages/diverse/images/`.
- `inspector-state.png`: 수정 전, 지역 속성 토글이 숨겨져 접근할 수 없던 상태.

게이트·vitest·전체 typecheck는 저장소 세션 규칙에 따라 실행하지 않았다. 이 근거는 콘텐츠 검증과 UI 관측이며 게임 전체 플레이 통과를 주장하지 않는다. 새 지역은 실내·NPC·문 전이 이벤트를 포함하지 않는 외관 사례다.

재현:
```bash
node scripts/content/verify-diverse-village-distribution.mjs existing-project-export.json
BASE=http://127.0.0.1:9816 node scripts/qa/capture-diverse-village-references.mjs canonical-reloaded-project.json
BASE=http://127.0.0.1:9816 node scripts/qa/capture-diverse-village-regions.mjs
```
