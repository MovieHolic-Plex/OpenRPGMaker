# 검수 응답 복구 확인

2026-10-05 실제 공동묘지 688 / 교실 690 응답으로 확인.

- type→category 변환 후 둘 다 FAIL 유지, checks 원문 동일, 수정 지시 각각 4개 보존.
- keep 누락은 ReviewFormatError, 잘못된 입력 fingerprint는 보완 대상으로 통과시키지 않고 거부.
- 보완 응답이 기존 FAIL을 PASS로 바꾸면 거부.
- 현재 도면을 다시 확인한 native handler로 실제 두 개념 복구. art/queued, art_revision=0 유지.
- 기존 응답은 SQLite jobs.result 및 art-layout-response-errors/replayed-job-688.json, replayed-job-690.json에 보존.
- 페이지에서 공동묘지 ‘도면 반려 — 배치 명세부터 수정’ 및 하수도 점유 대기 확인. 막힘·폐기 별도 탭 확인.
- 서비스 재시작 전후 하수도 작업 691 alive=true, 전체 paused=true 유지. 기물 pool 실행/대기 0 확인 후 재시작.
- pageerror 0, Python AST, JS syntax, diff whitespace 확인. gates/vitest/typecheck 미실행.
- 실제 사례는 별칭 정규화로 해결되어 유료 형식 보완 모델을 새로 실행하지 않았다. 2회 보완 상한/판정 보존 분기는 코드로 확인했다.

cemetery.png / tabs.png는 실제 서비스 화면이다. 복구는 완료했으며 그림 제작·전체 공간 완성 선언이 아니다.
