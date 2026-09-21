# 마을 설계서 — 결정권 일치와 생성 기록

워크트리: `/home/main/z-project/rpg-zzu-village-design-db`, 브랜치: `agent/village-design-db`.
이 단계는 에디터/시공 계약 코드와 테스트만 변경했다. 사용자 게임 콘텐츠나 main은 수정하지 않았다.

## 변경

- AI 생성 도구가 길 재질·폭·굽이, 집 재료, 마당, 광장 종류/위치, 테두리 나무를 받는다. `villageStyle.ts`의 허용 목록을 도구 스키마와 파서가 공유하고 실제 시공까지 전달한다.
- 고정한 값의 충돌은 시공 전에 차단하며 자유 항목도 타입·범위를 검사한다. `edgeTrees`는 UI와 동일하게 자연 결정권을 따른다.
- 시공기의 집 재료 허용 목록이 DB에서 선택 가능한 목조 홀을 포함하도록 집 킷 카탈로그를 사용한다.
- DB → 맵 → 마을 → 마을 설계서 → 생성 기록에서 맵 그림, 당시 설계서·개정·시드·집 수, 확정 설정을 표시한다. 원본 설계서 변경/삭제 후에도 사본은 남는다. 그림은 현재 맵, 설정은 시공 당시 값이다.
- 생성 기록은 조회만 하며 미리보기를 실적으로 넣지 않는다. 기록 탭을 열 때만 맵 썸네일을 요청한다.

## 집중 검증

`test/villageDesign.test.ts` 16개 + `test/villageBuildHistory.test.ts` 2개 통과, exit 0 (`focused.log`).
타입 검사 오류 0, exit 0 (`typecheck.log`). 도구 문서는 레지스트리로 재생성했다 (`catalog-update.log`).

## 브라우저 재현

이 워크트리에서 `npm run dev:worktree`로 40261 포트를 열고 `node .omo/evidence/village-design-followup/browser-qa.mjs`를 실행한다.
스크린샷은 `output/evidence/village-design-followup/`에 저장된다.
Chromium은 호스트 인터페이스 변경으로 `ERR_NETWORK_CHANGED`가 나 모듈 적재에 실패했다. 저장소의 기존 `test/e2e/database-sidebar-rail-modern.spec.ts`와 동일하게 Firefox로 검증한다.
QA는 `blankProject=1`의 임시 테스트 프로젝트에서 최소 fixture로 생성 기록 화면을 확인한다. 원격 게임 콘텐츠 저작이 아니며 LegacyDb에 쓰지 않는다.

실제 Firefox 편집기 검증 exit 0: 브라우저 오류 0, 1280px/1024px 가로 넘침 0. 시공 개정 3의 기록을 유지한 채 현재 설계서를 개정 4로 바꾸면 변경 상태를 표시했다. `browser-results.json`, `history-1586.png`, `history-1024.png`.

DB를 연 뒤 생성 기록을 추가하는 회귀 테스트를 포함한 설계서 UI 3개 테스트도 통과(exit 0, `live-history.log`).

최신 프로젝트 조회 보완 뒤 최종 타입 검사도 오류 0 / exit 0 (`typecheck-final.log`), CSS budget/graph도 exit 0 (`css.log`). 핵심 계약 18개와 설계서 UI 3개, 합계 21개 테스트 및 실제 브라우저 검증을 통과했다.

기록 단위는 맵별 마지막 시공 출처 한 건이다. 같은 맵을 다시 시공하면 새 설계서·개정·시드로 갱신된다. 마지막 설계서를 삭제한 경우에도 마을 설계서 분류에서 보존된 맵 기록을 바로 조회할 수 있다.

마지막 설계서 삭제 후 기록 노출도 집중 UI 테스트 3개와 타입 검사 exit 0으로 확인했다 (`orphan-history.log`, `orphan-typecheck.log`). 실제 Firefox 삭제 경로는 `browser-results.json`의 `afterDelete`와 `history-deleted-1024.png`에 남겼다.

## 전체 게이트 최종 결과

`npm run gates`를 감독자가 직접 실행하고 실제 종료 코드 1을 확인했다. 타입 검사 오류 0, CSS exit 0. 전체 테스트는 12,708 통과 / 183 실패 / 실패 파일 92개이며 surface도 실패했다 (`gates.log`, `gate-results.json`). 저장된 기준선 대비 실패 파일 17개가 있어 전체 회귀 없음으로 판정하지 않는다.

마을 관련 6개 파일의 112개 테스트는 이 전체 실행에서 모두 통과했다. 전체 실행은 마지막 기록 탭 최신 store 조회/마지막 설계서 삭제 보완 전에 시작했으므로, 그 보완은 별도 집중 UI 테스트 3개·최종 타입 검사·Firefox로 검증했다.

직전 전체 게이트보다 추가 실패한 DB 동작/DB 개요 두 파일/선택 영역의 총 4개 파일은 코드 변경 없이 worker 2개로 다시 실행해 44개 모두 통과하고 exit 0을 확인했다 (`gate-retry.log`). 이 재실행 결과로 원래 전체 게이트의 실패 기록을 덮어쓰지 않는다.
