# 마을 300종 · 사용자 선택 공용 게시 · 조수 도구 연결

2026-10-05, 실제 운영 화면 `http://mdc-server:18315/harness#props`.

- 원본 975종에 명세 300종 추가: 현대90 / 중세90 / 시간여행풍60 / 증기마도풍60.
- 라이브 `/api/harness/objects`에서도 300개·각 분류 수 확인: `browser.json`.
- h748–h1047: 300판·brief300·후보600. 제작 완료 수가 아닌 주문 수다. `production.json` 참조.
- 초기 API429 실패는 배치 전용 bounded supervisor로 재큐. 기존 제작 자식32개 전부 보존.
  신규 동시 시작 상한8; 기존 진행 작업이 자연 종료할 때까지 running은 8보다 클 수 있다. `retry.json`.
- 공용 publication.state=done, revision `1ada5b3858f53b409eea4d3539d2be2e1cae0525b7d7b10608f0d70be8d723bf`.
- 선택811행 중 묶음3개는 분할 자식으로 반영. 나머지808개 전부 실제 SQLite payload 안 kit id 확인.
  함께 쓰기 변형5개 포함 사용자 선택 태그813개, 팩 전체945개. 사용자 선택 외 기본 포함 수를 혼동하지 않는다.
- 정지 선택798개를 실제 공유 DB atlas와 팔레트 정규화 후 픽셀 대조: 798/798 일치.
  기존 애니메이션10개는 이 정지 픽셀 수에서 제외. 선택은 하나도 대신 만들지 않았다.
- 신규/기존 프로젝트에 같은 공용 팩 설치 → 실제 project.sqlite/assets 저장 → 닫기 → 재열기.
- 실제 조수 도구 list_spatial_designs 첫40개 모두 사용자 선택 태그.
  의무실 침대·목욕통·팔선탁 검색→stamp_object로 atlas_biome_interior 맵에 graft→SQLite 저장/재열기 후
  타일 배열·graft 완전 일치. project id/경로/배치 수는 `storage-proof.json`.
- 이것은 실제 도구 연결·영속성 확인이다. LLM 대화에서 모델이 매번 올바른 기물을 선택한다는 보장은 아니다.
- 하네스 실행/게시 파일은 실제 서비스 코드 폴더로 배포: `deployment.json`.
  조수의 검색 우선순위/시스템 지침은 이 PR의 앱 코드 변경이며, 실행 중인 다른 에디터 체크아웃을 덮지 않았다.
  새 앱 코드를 적용하고 기존 프로젝트를 다시 열어 최신 공용 자료를 읽는다.

## 즉시 확인

- `new-catalog.png`: 라이브 화면에서 새 기물 「무인 택배 보관함」 조회.
- `harness.png`: 라이브 통합 화면의 공용 반영 완료 표시.

브라우저는 모든 비 GET/HEAD를 차단하여 읽기만 했다. 전체 gates/vitest/typecheck는 AGENTS 규칙에 따라 실행하지 않았다.
Python AST, 변경 JS 구문, 변경 TS 파싱, git diff 공백 확인을 수행했다.
제작기 자체의 후보/굽기/26개 예제 맵 검사는 공용 게시의 기존 실행 경로다.
