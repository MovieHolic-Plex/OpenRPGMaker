# 조수(AI 어시스턴트) 패널 — 축소/크기조절 불가 (감독 신고)

감독 신고 원문: "'조수' .. 그러니까 에디터 내의 ai 어시스턴스가 지금 축소나 사이즈조절이 안 되니까 매우 문제임."

## 워크트리 / 실행

- 워크트리: `/home/main/.herdr/worktrees/rpg-zzu/css-problem` (브랜치 `css-problem`)
- dev 서버: `http://127.0.0.1:9823` (이미 떠 있음. `?freshProject=1` 로 부팅)
- 측정 스크립트: `RPG_ZZU_URL=http://127.0.0.1:9823 node scripts/qa/assistant-resize-collapse-qa.mjs --label <name>`
  → `output/evidence/assistant-resize-collapse/<name>-measure.json` + PNG

## 기준선 실측 (label `before`, 1440x900, freshProject)

| dock | 패널 실측 | 접기 컨트롤(화면) | 크기조절 손잡이 | 드래그 결과 |
|---|---|---|---|---|
| glass (기본) | 520x620 @318,61 | **없음** (`ai-collapse` 는 DOM 에 있으나 hidden+inert 툴바 안) | 16x16 보임 (opacity .45) | +160/+120 드래그 성공 |
| side | 478x851 @961,49 | **없음** | `display:none` | 불가 |
| float | 1133x851 @306,49 | **없음** | `display:none` | 불가 |

- glass 에서 화면에 보이는 버튼 전체: 예시 칩 4개 + `ai-send`. **메뉴(☰)도 없다** —
  `02-chat-dock.css:112` 가 `.chat-dock-glass .ai-command-menu-toggle { display:none }` 로
  숨기는데, 그 근거였던 헤더(`.ai-chat-header` + ☰ + ▾)는 커밋 `c068d604` 에서 DOM 째 삭제됐다.
- `ai-collapsed-restore` 칩도 `.is-collapsed` 에서만 보이므로, 접을 수 없으니 영원히 도달 불가.
- side 는 폭을 에디터 셸 열(`.ai-chat-side-panel`)이 들고 있고 **리사이저가 없다**.
- float 은 `inset:0` 전면 오버레이라 패널 크기 개념이 없다(바 위치만 CSS 가 잡음).

## 근본 원인 (실측 기반)

커밋 `c068d604 feat(editor): 조수를 헤더도 얼굴도 없는 유리 패널로 바꾼다` 가 헤더 밴드를
걷으면서 그 안에 있던 **접기 토글 ▾ 와 ☰ 메뉴**를 화면에서 잃었다. 커밋 메시지 자신도
"이 진입점들(더보기 9종·새 대화·도크·떼기)의 소실은 수용됨" 이라고 적었지만, 접기와 도크
전환은 감독이 매일 쓰는 기능이었다. 남은 것은 유리 도크의 16x16 코너 손잡이 하나뿐이고,
다른 두 도크에는 그것조차 없다.

## 관련 코드

- 패널 조립/상태기계: `src/editor/panels/aiChatPanel.ts` (`collapseButton` ~1858, 숨은 툴바 ~2250, `applySize`/`resizeHandle` ~2380-2440, `applyCollapsed` ~2528)
- 크기/접힘 지속: `src/editor/panels/aiPanelLayout.ts`
- 컴포저 셸: `src/editor/panels/aiComposer.ts` + `src/styles/database/assistant-composer.css`
- 도크: `src/editor/chatDock.ts`, `src/styles/database/tabs-b-assistant-panel/02-chat-dock.css`
- 손잡이 CSS: `06-canvas-guides-panel-chrome.css:139~183`, `14-assistant-ux-repair.css:97`, `17-assistant-modern-shell.css:236`
- 접힘 CSS: `03-three-tier-ia.css:110~231`, `13-assistant-modern.css:228`, `15-assistant-readable.css:61`
- 관련 위키: `openwiki/editor-ai-panel.md`, `openwiki/editor-pre-edit-routing.md`

## 게이트

- `npm run gates` (기준선이 빨간불이므로 **기준선 대비 새 실패만** 회귀로 본다)
- `npm run gates:css` (CSS 예산/그래프)
- `npm test -- <관련 스펙>`, `npx playwright test test/e2e/_ai-composer.spec.ts` 등
- 브라우저 실측 재실행 후 `after-measure.json` 이 표의 "없음/불가" 를 전부 뒤집어야 한다.
