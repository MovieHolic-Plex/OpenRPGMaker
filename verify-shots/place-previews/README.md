# 장소 미리보기 복구 — 2026-09-22

`node scripts/qa/place-preview-recovery.mjs http://127.0.0.1:9847`

- Chromium 1600×1000, 저장 없는 blankProject fixture.
- 공용 장소 62장 전부 스크롤해 이미지 decode(naturalWidth > 0)와 표시 높이 확인.
- 같은 외형 도안 카드를 두 화면에 표시해 양쪽 캔버스 로드 완료 확인.
- 기존 화면 교체 후 캐시 노드 재사용 및 추가 컴파일 없음 확인.
- 집 외형 도안의 스테이지 래스터 1장 로드 완료 확인.
- 공용 카탈로그 로딩 중 두 요청의 완료 콜백 모두 실행.
- 아틀라스 error 이벤트 주입 후 같은 URL에 새 Image 요청 확인.
- 브라우저 pageerror 0. fixture IndexedDB의 AI 대화 기록 0.

`proof.json`은 자동 수집 결과, `all-places-scrolled.png`는 목록 끝까지 스크롤한 화면이다.
현재 워크트리에 project.sqlite가 없으므로 기존 프로젝트별 콘텐츠 문제는 이 확인의 대상이 아니다.
정본 콘텐츠를 변경하지 않았다. 저장소 지침에 따라 vitest/전체 typecheck/gates는 실행하지 않았다.
