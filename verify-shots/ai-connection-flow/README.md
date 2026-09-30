# AI 연결 흐름 브라우저 확인 — 2026-10-01

Chromium, 1280×900 및 1024×768. `npm run dev:worktree`의 9860 포트에서 확인했다.
OAuth 응답과 팝업은 모의 응답으로 격리했고 `/v1/*`는 차단했다. 실제 계정 로그인·모델 호출·자격 저장은 하지 않았다.

- `google-first-connection.png`: Google 첫 연결에 API 키·환경 변수 질문이 없다.
- `chatgpt-ready.png`: 계정 선택이 모든 기본 작업 모델과 이미지에 반영되고 헤더·톱바가 함께 갱신된다. 계속 버튼으로 닫을 수 있다.
- `mixed-account-required.png`: 직접 지정한 Google Vision을 보존하고 필요한 추가 계정을 표시한다. 계속 버튼은 잠기며 일괄 맞춤 후 열린다.
- `remote-login.png`, `resumed-login-1024.png`: 기존 인가 URL을 복원한다. 재열기에 로그인 요청을 추가하지 않고 자동 팝업을 띄우지 않는다.
- `login-denied.png`: 승인 거부를 다음 3초 폴링에 표시하고 대기 블록을 걷는다.
- `continue-button.png`: 활성/비활성 계속 버튼은 실제 CSS 진입점 두 장(index/database)을 불러온 격리 DOM에서 추가 확인했다. 활성 배경은 `rgb(74, 87, 214)`, 글자는 흰색이다. 재현은 `continue-style.mjs`다.
- `service-unavailable.png`: 연결 확인·앱 재열기·관리자 연락 안내를 표시한다.
- 명시적 취소에 `POST /auth/login-cancel` 요청 1건을 확인했다.
- 환경 변수 탐색은 ChatGPT의 고급 링크를 누른 뒤에만 동의를 묻는다.

`observations.json`에는 요청 목록·읽은 설정·화면 글자·브라우저 오류 목록(0건)을 남겼다.
재현 스크립트: `AI_CONNECTION_REVIEW_ORIGIN=http://127.0.0.1:9860 node verify-shots/ai-connection-flow/manual-browser.mjs`.

AGENTS.md의 세션 실행 제한에 따라 로컬 테스트·게이트·타입체크는 실행하지 않았다.
작성한 회귀 스펙과 실제 OAuth 토큰 교환은 이 화면 확인의 통과 근거로 포함하지 않는다.
