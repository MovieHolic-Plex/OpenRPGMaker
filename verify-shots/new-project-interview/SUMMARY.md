# 새 프로젝트 인터뷰 — 브라우저 화면 근거

2026-09-22. `node scripts/capture-project-interview.mjs`로 실제 UI 모듈과 CSS를 Vite에서
불러온 격리 Chromium 페이지를 캡처했다. 저장 콜백은 관찰용 대체 함수이며 실제 SQLite
프로젝트 저장·AI 호출·게임 생성은 하지 않았다.

- 즉시 확인: `01-monster-horror.png` — 새 프로젝트 메뉴의 수집 + 공포 분기.
- 즉시 확인: `02-summary.png` — 답변 5개와 수정 가능한 최종 기획, 별도 시작 버튼.
- 즉시 확인: `03-gallery-1024.png` — 미술관 + 동료 불신 분기. 1024×768에서 가로 넘침 없음.
- `browser.json` — 메뉴 반환값에 원문·확정 요약 포함. 웰컴 인터뷰 확정 전/취소 후 저장
  콜백 각각 0회, 확정 후 1회. AI 미연결 결과 `autoSend: false`. pageerror 0건.

검증의 한계: 실제 모델의 답변 추출 정확도, 전체 앱 부팅→SQLite 재로드→게임 생성 경로,
런타임 플레이는 이 캡처의 검증 대상이 아니다. 관련 단위 테스트는 추가/수정했으며 이번
세션의 AGENTS 테스트 실행 제한에 따라 Vitest·전체 게이트·전체 typecheck는 실행하지 않았다.
