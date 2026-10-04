# 슈퍼하네싱 통합 입구 — 2026-10-04

- 실제 URL: http://mdc-server:18312/harness
- 네 탭: 기물·파생 / 공간·개념 / 재료 주문서 / 공용 재료.
- 기물 자동 제안에서 금고를 검색한 뒤 공간·주문서를 왕복해도 검색값 보존.
- 기존 공간 실행기에서 실제 개념 카드 90개와 Markdown 「그림 주문서」 로드.
- 조회 당시 기존 공간 실행기는 paused=true. 브라우저 작업 중 POST 요청 0, pageerror 0.
- 공용 재료 759개 검색·자료 다운로드 확인.
- 실제 게시 revision: `9478673f5896a1a0922d17e47ab748298c65178066249c3b4dbd162ee4d2760e`.
- API 다운로드 ZIP: 105파일, 5,923,469바이트. 모든 파일 SHA-256과 원래 library.json의 revision 해시 일치.
- 공간 서버 연결 실패는 브라우저에서 상태 응답만 대체해 표시 확인(실제 서비스는 중단하지 않음).

즉시 확인: `props-and-proposals.png`, `spaces.png`, `orders.png`, `shared-materials.png`, `offline.png`.
기계 기록: `browser-proof.json`. 문법 확인: Python AST, JS `node --check`; gates/vitest/typecheck는 실행하지 않음.

이는 통합 화면·공용 자료 전달 근거다. 기존 공간 실행기의 survey 자동 수신/설치가 완료됐다는 근거는 아니다.
다른 세션이 작업하는 공간 워크트리·서비스·DB에는 쓰지 않았다.
