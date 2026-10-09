# 게임 메뉴 디자인 카드 선택

드롭다운을 실제 게임 화면·이름·설명이 있는 12개 버튼으로 교체했다.
선택한 카드는 강조 테두리와 “✓ 선택됨”으로 표시하며, 위쪽에 현재 디자인을 표시한다.
기본 디자인은 기존처럼 선택값을 제거한다. 이미 선택된 카드 재클릭은 저장하지 않는다.
반응형 그리드와 기본 버튼의 키보드 조작을 사용한다.

브라우저 확인 명령:
`OPRN_QA_EDITOR_URL=http://127.0.0.1:9827 OPRN_MENU_QA_OUT=verify-shots/menu-cards node scripts/qa/menu-design-editor.mjs`

근거는 `verify-shots/menu-cards/EDITOR.md`와 PNG에 남긴다.
전체 게이트·vitest·typecheck는 세션 규칙에 따라 실행하지 않는다.
