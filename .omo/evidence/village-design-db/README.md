# DB 마을 설계서 검증 — 2026-09-05

## 확인 경로

편집기 → DB → 맵 → 마을 → 마을 설계서 → 추가.
기존 프리셋은 상세 화면의 「마을 설계서로 전환」을 누른다.

- 기본 설계서를 선택하면 AI의 `author_village`가 생략한 설계서 ID와 집 수를 채운다.
- 집 외형, 길과 배치, 물과 숲, 실내 연결, 주민 수는 고정/AI 자유를 선택한다.
- 집 수는 고정/범위/AI 자유를 선택한다.
- 고정값과 충돌하면 시공 전에 오류와 차이를 반환한다.
- 같은 설계서·시드·맵 크기로 미리보기와 시공한 타일이 같은지 테스트한다.
- 실제 맵에는 당시 설계서/개정/시드/확정 설정을 기록한다.

## 브라우저 증거

`desktop.png`: 실제 시공기로 집 4채를 만든 미리보기.
`nature-1024.png`: 1024px에서 자연 설정을 편집하는 화면.
`browser-results.json`: 브라우저 오류 0, 1280px/1024px 가로 넘침 0, 강/빽빽한 숲 선택 유지.

재현: 워크트리에서 `npm run dev:worktree -- --port <고유 포트>`를 실행한 뒤
`VILLAGE_QA_URL=http://127.0.0.1:<포트> node .omo/evidence/village-design-db/browser-qa.mjs`.
스크린샷은 `output/evidence/village-design/`에 저장한다.

`blankProject=1`은 이 UI 검증용 최소 임시 프로젝트에만 사용했다.
사용자 게임/맵 콘텐츠를 새로 저작하거나 Supabase에 저장한 작업이 아니다.
프로젝트 JSON 저장·재로드 계약은 `test/villageDesign.test.ts`에서 검증한다.

## 구현 범위

시설별 프로그램·주민 역할 편성은 기존 개념 꾸러미/캐스트 라이터를 사용한다.
구형 레이어 세션은 설계서가 활성화된 경우 `author_village`를 안내하고 변이 전에 중단한다.
상세 계약은 `openwiki/village-design.md`.
