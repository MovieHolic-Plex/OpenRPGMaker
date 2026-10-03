# 이벤트 명령 드래그 브라우저 관측 (2026-10-02)

개발 서버 `npm run dev:worktree`의 실제 `renderCommandList`를 Chromium에 불러온 격리 컴포넌트 관측이다. 사용자 프로젝트를 열거나 저장하지 않았고 저장 브리지에 연결하지 않았다. 전체 편집기 스타일 대신 관측용 최소 스타일을 사용했다.

- 외부 draggable 텍스트 `[0]`를 실제 포인터 드래그해 목록에 놓음: 이전/현재 콜백 모두 0회.
- 같은 목록 DOM을 이전 actions → 현재 actions로 다시 렌더한 뒤 첫 명령 핸들을 빈 목록 영역으로 실제 드래그: 이전 actions 0회, 현재 actions 1회 (`[0]`, 목록 끝 위치).
- `observations.json`이 관측값이고 `drag-observation.png`가 결과 화면이다.
- 관측은 콜백 소유권까지다. 콜백은 기록만 하므로 명령 저장·되돌리기·전체 모달·정본 재로드 성공을 증명하지 않는다. 레거시 페이지 붙여넣기는 정적 검토와 회귀 소스만 있으며 실행하지 않았다.
- 재현: 개발 서버를 먼저 띄우고 `EVENT_REVIEW_ORIGIN=http://127.0.0.1:<port> node verify-shots/event-drag-audit/observe.cjs`. 테스트 러너나 스위트를 호출하지 않는다.

정적 `git diff --check` 통과. 단위 테스트/타입 검사/전체 gates는 이번 세션에서 실행하지 않았다.
