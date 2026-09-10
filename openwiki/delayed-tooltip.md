# 공통 지연 툴팁 (OPRN-OUT-024)

아이콘만 있는 컨트롤·탭에 **한 가지** 지연 툴팁 동작을 쓴다. 모듈은 두 개다.

| 파일 | 역할 |
|---|---|
| `src/editor/delayedTooltip.ts` | 동작(지연·초점·Escape·정리)과 순수 배치 계산 `computeTooltipPlacement` |
| `src/editor/delayedTooltipRollout.ts` | **명시 대상 목록** `DELAYED_TOOLTIP_ROLLOUT` + 멱등 설치기 `installDelayedTooltips(root)` |
| `src/styles/editor/delayed-tooltip.css` | 표시 스타일. `pointer-events: none` 으로 클릭을 가로채지 않는다 |

## 동작 계약

- 호버 **1.2초**(`TOOLTIP_DELAY_MS`) 뒤 표시. 그 전에 포인터가 떠나면 뜨지 않는다.
- 키보드 초점은 같은 라벨을 **즉시** 보여 준다. `Escape` 는 툴팁만 닫고 컨트롤을 실행하지 않는다.
- `pointerdown`·`blur`·문서 스크롤에서도 닫는다.
- 대상이 DOM 에서 떨어졌으면(패널 리렌더) 타이머가 끝나도 **뜨지 않는다** — 유령 툴팁 방지.
- 위치: 아래 우선, 공간이 없으면 위로 뒤집고, 가로는 대상 중앙 정렬 후 여백 8px 안으로 자른다.
  대상 사각형을 덮지 않는다.

## 문구 규칙

- `label` 은 화면에 뜨는 짧은 말 — **여섯 자 이하**를 지향한다(테스트가 강제).
- `name` 은 컨트롤의 완전한 접근 가능한 이름 — `aria-label` 로 들어가며 절대 자르지 않는다.
- 브라우저 기본 `title` 은 **지우지 않는다.** `toolbar-save`(「프로젝트 저장 (Ctrl+S)」)와
  `ai-new-chat`(「새 대화」)은 e2e 계약이다. 대신 포인터가 얹힌 동안만 속성을 떼었다가
  떠날 때 되돌려 네이티브 팝업과 겹치지 않게 한다.

## 1차 롤아웃 대상

톱바(`toolbar-save`, `workspace-command-palette-button`, `topbar-ai-studio`,
`topbar-ai-settings`, `window-fullscreen`), 조수 패널(`ai-new-chat`,
`ai-command-menu-toggle`, `ai-abort`), 타일셋 편집기(`tileset-layer-filter-*`,
`tileset-layer-auto|lower|upper`).

**전면 자동 적용은 금지다.** 글자가 이미 보이는 버튼에 붙이면 소음이고, 806곳의 `title` 을
일괄 변환하면 대화 상자 제목까지 끌려온다. 새 대상은 롤아웃 표에 줄을 더해 넣는다.

## 설치 지점

`renderTopbar`(`src/editor/panels/menu.ts`), `renderTilesetEditor`
(`src/editor/panels/tilesetSettingsDetails.ts`), `renderAiChatPanel`
(`src/editor/panels/aiChatPanel.ts`). 설치기는 멱등이라 렌더마다 불러도 중복되지 않는다.

## 테스트

`test/delayedTooltip.test.ts` — 지연, 조기 이탈, 키보드 초점, Escape, 리렌더 정리,
네 변 배치, 접근 이름 보존, `title` 임시 제거·복원, 롤아웃 멱등성. 시간은 가짜 타이머로만 움직인다.
