# 시스템 게임 메뉴 섹션 분리

- 시스템 → 게임 메뉴에서 12종 디자인 선택·설명·미리보기를 제공한다.
- 화면은 해상도 설정만 담당한다. 개요의 게임 메뉴 카드에 현재 디자인을 표시하고 전용 섹션으로 연결한다.
- 기존 menuUiStyle 저장 계약은 유지한다.

## 브라우저 확인

`OPRN_QA_EDITOR_URL=http://127.0.0.1:9827 OPRN_MENU_QA_OUT=verify-shots/menu-section node scripts/qa/menu-design-editor.mjs classic-vx` 성공.

12개 선택지, VX 선택·정규화·이미지 로드, 기본값 복원, 개요 카드 진입 및 최신 디자인 표시,
1440×1000 / 1024×768에서 설정 영역 가로 넘침 없음과 화면 섹션 분리를 확인했다.
직접 확인한 캡처: `verify-shots/menu-section/menu-section-1024.png`.
전체 게이트·vitest·typecheck는 세션 규칙에 따라 실행하지 않았다.
