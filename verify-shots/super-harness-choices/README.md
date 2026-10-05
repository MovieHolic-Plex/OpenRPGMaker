# 지하 감옥 부품 선택 UI

2026-10-05 실제 http://mdc-server:18315/spaces?concept=underground-prison 확인.

- ‘내 선택 필요’ 1건은 공동묘지가 아닌 지하 감옥이었다. 선택할 그룹은 계단, 철문, 나무문 총 3종.
- 계단 A/B 원본 확대와 배치 예시를 동시에 표시했다. 문 예시의 닫힘/열림은 양쪽 함께 전환했다.
- 나무문 A의 선택 버튼 비활성화 및 B만 선택 가능 안내 확인.
- 수정 요청 버튼은 부품명이 들어간 기존 교정 초안으로 이동한다. 제출하지 않았다.
- 선택 저장은 브라우저 route에서 POST만 가로채 기존 API 형식으로 응답했다. stairs A의 fingerprint 요청과
  성공 후 다음 미선택 철문 그룹 이동을 확인했다. 실제 API 쓰기 요청은 보내지 않았다.
- 실제 GET 재조회 선택 수는 0/3 그대로였다. 자동 선택하지 않았다.
- 1365×1050, 390×844 확인. 모바일 가로 넘침 없음. pageerror 0.
- JS syntax 및 diff whitespace 확인. gates/vitest/typecheck 실행 안 함.

스크린샷: stairs-desktop.png, wood-desktop.png, stairs-mobile.png.
