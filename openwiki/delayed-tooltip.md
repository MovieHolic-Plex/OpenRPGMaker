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
  **이미 떠 있는 툴팁도** 대상이 리렌더로 교체되면 같이 사라진다. 초점이 아니라 호버로 띄운
  경우에는 `blur` 가 없으므로 `MutationObserver` 가 대상의 이탈을 보고 닫는다 — 브라우저
  실측(2026-09-10, `verify-shots/oprn-024/06-rerender-clears.png`)에서 이 경로가 뚫려 있었고
  툴팁이 죽은 노드 좌표에 남아 있었다. 유닛 테스트는 대기 중 타이머만 덮고 있었다.
- 위치: 아래 우선, 공간이 없으면 위로 뒤집고, 가로는 대상 중앙 정렬 후 여백 8px 안으로 자른다.
  대상 사각형을 덮지 않는다.
- 층: `--z-tooltip`(2650) — 데이터베이스 모달보다 위, 토스트(2700)보다 아래. 롤아웃 14개 중
  5개(타일셋 편집기)가 그 모달 **안**에 있어서, 예전 하드코딩 `z-index: 400` 에서는 툴팁이
  모달 뒤에 그려져 화면에 아예 보이지 않았다(같은 실측, `09-tileset-editor-*.png`).
  순서는 `test/editorZLayerOrder.test.ts` 가 고정한다.

## 문구 규칙

- `label` 은 화면에 뜨는 짧은 말 — **여섯 자 이하**를 지향한다(테스트가 강제).
- `name` 은 컨트롤의 완전한 접근 가능한 이름 — `aria-label` 로 들어가며 절대 자르지 않는다.
- 브라우저 기본 `title` 은 **지우지 않는다.** `toolbar-save`(「프로젝트 저장 (Ctrl+S)」)와
  `ai-new-chat`(「새 대화」)은 e2e 계약이다. 대신 포인터가 얹힌 동안만 속성을 떼었다가
  떠날 때 되돌려 네이티브 팝업과 겹치지 않게 한다.

## 맵 도구바·접이식 왼쪽 레일 (2026-09-18)

`editorZoomToolbar.ts`의 맵 도구바는 아이콘 중심이다. 걷기 전투·구역 그리기·배경 보기,
만들기·다듬기·검사·AI 요청, PNG 저장에 기존 지연 툴팁을 명시 설치한다.
토글은 `aria-pressed` 및 색으로 상태를 유지하며 배율 숫자는 계속 표시한다.
`aiSidebarWorkspace.ts`의 AI/맵 탭과 접기 버튼도 같은 설치기를 쓴다.
조수 레일의 `ai-wide-open` 확대 아이콘도 `크게 보기` 툴팁으로 명시 등록한다(2026-09-21).
브라우저 확인: `scripts/qa/ai-team-sidebar.mjs` (설정 열기, 토글 상태, 초점 툴팁, 접힘 폭·초안 유지).

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

`test/delayedTooltip.test.ts` — 지연, 조기 이탈, 키보드 초점, Escape, 리렌더 정리(대기 중 +
**표시 중** 둘 다), 네 변 배치, 접근 이름 보존, `title` 임시 제거·복원, 롤아웃 멱등성.
시간은 가짜 타이머로만 움직인다. 층 순서는 `test/editorZLayerOrder.test.ts`.

브라우저 증거는 `scripts/qa/delayed-tooltip.mjs` → `verify-shots/oprn-024/`(9장면). 유닛
테스트는 fakeDom + 가짜 타이머라 실제 렌더 좌표·실제 `setTimeout`·CSS 층을 밟지 않는다 —
위의 결함 두 건은 브라우저 실측에서만 드러났다. 스크립트는 단언 실패 시 exit 1 이고,
툴팁이 **가려졌는지**까지 `elementFromPoint` + z-index 로 잰다(DOM 존재만으로는 증거가 아니다).

```
DEV_SERVER_PORT=9865 npm run dev:worktree
TOOLTIP_QA_URL=http://127.0.0.1:9865 node scripts/qa/delayed-tooltip.mjs
```
