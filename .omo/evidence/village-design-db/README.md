# DB 마을 설계서 검증 — 2026-09-05

## 격리 워크트리

- 작업 경로: `/home/main/z-project/rpg-zzu-village-design-db`
- 브랜치: `agent/village-design-db`
- 베이스: `7167ae65`와 동일한 파일 트리의 스냅샷 `797c2e82`. 메인의 미커밋 변경이 섞이지 않았음을 `git diff 7167ae65 797c2e82 --stat`로 확인했다.
- 실행: 이 경로에서 `npm run dev:worktree` → `http://localhost:40261/`.
- 자동 배정된 9841은 메인의 다른 서버가 이미 사용하고 있어, 이 워크트리의 gitignored `.env.local`에서 `DEV_SERVER_PORT=40261`로 보정했다. 다른 서버나 메인 파일은 변경하지 않았다.

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

## 게이트 결과

`npm run gates`: typecheck 0 errors, CSS budget/graph 통과. 전체 vitest 12,716 통과 / 169 실패(91 파일), surface 실패로 exit 1. 기록된 기준선 대비 추가 실패도 남아 있어 전체 회귀 없음으로 판정하지 않는다. 마을 관련 7개 파일 152개 테스트는 모두 통과했다. `gates.log`와 `test-results.json` 참조.

기본 설정(집 6채, 실내 연결 켜짐)의 브라우저 미리보기도 성공했다: `default-preview-results.json`.

마지막 ID 검증·문구 보완 뒤 8개 파일 156개 assertion은 통과했으나 Vitest `onTaskUpdate` RPC timeout 두 건으로 해당 실행은 exit 1이었다(`focused.log`). 이를 정상 종료로 취급하지 않고 변경한 3개 파일을 worker 1개로 다시 확인한다. 마지막 타입 검사 exit 0(`typecheck.log`).

단일 worker 재검증도 3개 파일 / 52개 assertion 통과 후 `onTaskUpdate` RPC timeout 1건으로 exit 1이었다(`focused-retry.log`). 따라서 최종 집중 실행을 깨끗한 통과로 보고하지 않는다. 타입·CSS·브라우저 검증은 통과했으며 전체 게이트와 테스트 실행기 오류는 남아 있다.

## 워크트리 분리 확인 뒤 재검증

같은 8개 파일을 JSON reporter로 재검증: 155 통과 / 1 실패, exit 1. 실패한 기존 배치 테스트 `스케치가 이긴 집 배치는 격자 열에 서지 않는다`는 코드 변경 없이 단독 실행에서 통과(exit 0, 1 통과 / 32 선택 제외). 일괄 실행을 전체 통과로 바꾸어 기록하지 않는다. `isolated-validation.json`, `isolated-single-retry.log` 참조. 이 단계의 수정은 워크트리 포트 보정과 검증 문서뿐이며 메인에는 적용하지 않았다.
