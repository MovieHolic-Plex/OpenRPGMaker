# 조수 중심 팀 모드

실제 개발 편집기 + Pi companion + 연결된 모델의 팀 실행. 전송 mock·가짜 이벤트·시간 조작 없음.
관찰용 메모리 fixture 맵 2개를 조회한다. 게임 콘텐츠 제작·SQLite 저장 검증이 아니다.

- PASS Live provider connected
- PASS Pending members expose assignment reason
- PASS Follow-up is blocked during team execution
- PASS Live team completed
- PASS Observation fixture unchanged
- PASS Real child workers received tool receipts
- PASS Cards show action, scope, result and clock
- PASS Recent receipts stay visible in brief mode
- PASS Draft survived live updates
- PASS Draft survives member switching
- PASS Escape restores card focus
- PASS Wide view retains agent cards
- PASS Layout fits 1280px
- PASS Layout fits 1024px
- PASS Studio shows shared agent observation
- PASS No browser exceptions
- PASS MP4 encoded

원시 근거: live-events.json, report.json. 녹화: ai-team-agent-centered.mp4.
전체 gates/Vitest/typecheck는 AGENTS의 세션 실행 제한에 따라 돌리지 않았다.

## team 직접 실행 확인 (2026-10-05)

- 입력: 슬래시 없이 `team <지시>`. 일반 Pi 실행 설정의 새 브라우저에서 실제 전송했다.
- 네트워크 요청: mode=team, HTTP 200. 두 작업 조수와 검수 조수가 완료했다.
- 기존 화면 확인 17항목 PASS, 브라우저 예외 0, 관찰용 fixture 변경 없음.
- 최종 스튜디오 배치까지 이번 실제 실행에서 촬영했다. 별도 기록 재생 구간 없음.
- 요약 MP4: team-direct-demo.mp4. 대기 구간만 생략했으며 편집 구간은 video-edit.json에 기록했다.
- 전체 테스트·게이트는 실행하지 않았다.
