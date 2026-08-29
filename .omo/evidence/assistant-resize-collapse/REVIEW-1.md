# REVIEW-1 — 조수 패널 축소·크기조절 복구 요청

## Bottom line

현재 구현은 접힘 상태기계와 도크별 크기 저장 기반을 갖고 있지만, 접기 버튼을 `hidden + inert` 테스트 훅 안으로 옮겨 사용자가 누를 수 없고, 리사이즈를 glass 전용으로 막아 side/float에는 실사용 affordance가 없다. 헤더 밴드를 되살리지 말고, 기존 접기 버튼을 컴포저의 고정 액션 행으로 옮기며, 기존 단일 리사이즈 핸들을 도크별 실제 크기 소유자에 연결하라.

예상 작업량: **Medium**. DOM 이동과 상태기계 재사용은 작지만 side 셸 폭과 float 컴포저 폭을 각각 올바른 소유자에서 저장·복원하고 브라우저 실측까지 해야 한다.

## 1. Root cause

기준선 JSON과 PNG의 관찰은 대체로 맞다. 다만 `02-chat-dock.css:112`의 glass 메뉴 숨김만이 접기 불능의 원인은 아니다. 실제 공통 원인은 다음과 같다.

1. `src/editor/panels/aiChatPanel.ts:1858-1863`은 정상적인 `<button data-testid="ai-collapse">`와 `aria-expanded`를 만든다. `:2528-2579`에도 `applyCollapsed`, `toggleCollapsed`, `restoreCollapsed`, `savePanelCollapsed`가 온전히 남아 있다.
2. 그러나 `src/editor/panels/aiChatPanel.ts:2250-2261`이 그 버튼을 `.ai-chat-toolbar.is-empty` 안에 넣고 컨테이너에 `hidden` 속성과 `inert = true`를 동시에 적용한다. 따라서 glass/side/float 모두 DOM에는 버튼이 있어도 화면·탭 순서·히트테스트에서 사라진다.
3. `src/styles/database/assistant-command-bar.css:276-277`의 `.ai-chat-toolbar.is-empty, .ai-chat-toolbar[hidden]`, `src/styles/database/tabs-b-assistant-panel/02-chat-dock.css:111-117`, `03-three-tier-ia.css:117-119`도 이 컨테이너/자식을 숨긴다. CSS 한 줄만 해제해서 해결할 수 없다.
4. `src/styles/database/tabs-b-assistant-panel/02-chat-dock.css:112`는 glass의 `.ai-command-menu-toggle`도 숨긴다. 헤더가 삭제된 뒤 glass/side에는 메뉴도 접기도 없는 상태가 됐다. float에는 `ai-command-menu-toggle`이 보이지만 `src/editor/panels/aiActionMenu.ts:71-115`의 메뉴 항목에 접기 액션은 없다.
5. restore 경로는 이미 유효하다. `src/editor/panels/aiDirectorChrome.ts:17-30`의 `ai-collapsed-restore`와 `03-three-tier-ia.css:122-140`의 `.is-collapsed` 표시 규칙이 존재하지만, 먼저 접을 수 없어서 정상 UI로는 도달할 수 없다.
6. resize는 의도적으로 glass만 허용돼 있다. `src/editor/panels/aiChatPanel.ts:2358-2394`의 `resizableDock()`은 glass만 반환하고, `:2396-2434`의 단일 핸들은 glass 크기만 `saveDockPanelSize("glass", ...)`에 저장한다. `06-canvas-guides-panel-chrome.css:180-183`은 non-glass 핸들을 `display:none`한다.
7. side의 실폭 소유자는 패널이 아니라 `src/styles/database/tabs-b-assistant-panel/02-chat-dock.css:13-25`의 `.ai-chat-side-panel`/`--ai-chat-side-width`다. `src/editor/panels/editor.ts:126-131`, `:217-224`, `:583-587`이 매번 자동 1/3 폭을 다시 발행하므로 패널 인라인 width만 바꾸는 수정은 작동하지 않는다.
8. float 패널은 `02-chat-dock.css:53-60`에서 `inset:0`인 투명 호스트다. 패널 rect 자체를 resize하는 것은 무의미하지만, 사용자가 보는 실제 surface인 `assistant-command-bar.css:68-74` 및 `10-dock-mode-rich-doc.css:72-75`의 최대 640px 컴포저 캡슐은 폭 조절 대상으로 삼을 수 있다. 높이는 textarea 행수 계약 때문에 조절하지 않는다.

## 2. Required end state by dock

### glass

- **Collapse:** 컴포저 고정 액션 행의 맨 왼쪽에 기존 `ai-collapse` 버튼이 항상 보인다. 누르면 기존 `toggleCollapsed()`가 `.is-collapsed`를 적용하고 `oprn:ai-panel-collapsed`에 저장한다.
- **Restore:** 접힌 카드 대신 현재 `ai-collapsed-restore` 조수 칩이 좌하단에 나타난다. 클릭하면 기존 `restoreCollapsed()`가 펼치고 저장값을 `0`으로 바꾼다.
- **Resize:** 현재 우하단 16×16 코너 핸들을 유지한다. 드래그는 폭·높이를 함께 바꾸고 `oprn:ai-panel-size:glass`에 저장한다. 키보드 화살표로도 폭·높이를 바꿀 수 있어야 한다.

### side

- **Collapse:** glass와 같은 `ai-collapse` 버튼이 컴포저 고정 액션 행 왼쪽에 보인다. 누르면 기존 상태기계로 side 열 전체가 현재 CSS 계약대로 48px 복원 레일이 된다.
- **Restore:** 48px 레일의 기존 `ai-collapsed-restore`를 클릭하면 직전 사용자 폭으로 펼친다.
- **Resize:** 패널 왼쪽 경계에 세로형 `ai-resize-handle`을 보인다. 왼쪽으로 끌면 넓어지고 오른쪽으로 끌면 좁아진다. 높이는 셸 100%를 유지한다. 폭은 캔버스 최소폭 예산과 `SIDE_CHAT_WIDTH.min/max` 안에서 clamp하고 `oprn:ai-panel-size:side`에 저장한다. 접힌 48px 레일에서는 핸들을 숨긴다.

### float

- **Collapse:** 컴포저 고정 액션 행 왼쪽에 기존 `ai-collapse`가 보인다. 누르면 현재 `.chat-dock-float.is-collapsed` 규칙대로 전면 투명 패널/바가 사라지고 우하단 restore 칩만 남는다.
- **Restore:** 기존 우하단 `ai-collapsed-restore`를 클릭하면 float 컴포저를 복원한다.
- **Resize:** `inset:0` 패널 자체가 아니라 사용자에게 보이는 컴포저 캡슐의 **폭만** 조절한다. 캡슐 왼쪽 경계에 세로형 `ai-resize-handle`을 두고 왼쪽으로 끌면 넓어지며 오른쪽으로 끌면 좁아진다. `oprn:ai-panel-size:float`에 저장하고 viewport 안으로 clamp한다. 높이 resize는 제공하지 않는다. 이는 `bar height = f(textarea rows) only` 계약을 지키기 위한 의도된 제한이다.

## 3. Concrete implementation instructions

### `src/editor/panels/aiComposer.ts`

1. `ComposerOptions`에 기존 collapse button을 받는 필드(예: `collapseButton: HTMLButtonElement`)를 추가한다.
2. `createComposerElements()`의 `.ai-composer-actions-lead` 자식 맨 앞에 이 버튼을 넣고, 그 다음에 기존 `ai-command-menu-toggle`, context chips, queue를 둔다.
3. 새 행·레일·팝오버를 만들지 않는다. 버튼은 기존 28px 액션 행 안에 있어야 하며 행 높이를 바꾸면 안 된다.

### `src/editor/panels/aiChatPanel.ts`

1. `:2254-2258`의 숨은 toolbar 자식 목록에서 **`collapseButton`만 제거**한다. 나머지 숨은 훅과 위임 클릭 동작은 보존한다.
2. `:2264` 부근의 `createComposerElements({...})` 호출에 같은 `collapseButton` 노드를 전달한다. 새 상태나 두 번째 접기 버튼을 만들지 않는다.
3. `applyCollapsed()`/`toggleCollapsed()`/`restoreCollapsed()` 및 `savePanelCollapsed()` 호출은 그대로 재사용한다.
4. 기존 단일 `resizeHandle`/`data-testid="ai-resize-handle"`을 유지하되 dock에 따라 마운트 위치와 축을 바꾼다.
   - glass: 지금처럼 panel 직접 자식, 우하단 corner, width+height.
   - side: panel 직접 자식, 왼쪽 세로 edge, width-only.
   - float: `commandBar` 직접 자식, 캡슐 왼쪽 세로 edge, width-only. absolute 자식으로 두어 바 레이아웃 높이에 참여시키지 않는다.
5. `remountComposerTail()`이 핸들을 무조건 panel 끝으로 되돌리지 않게 핸들 마운트를 별도 함수로 단일화하고, `refreshDockLabels()`에서 현재 dock에 맞게 재마운트한다.
6. glass는 기존 `loadDockPanelSize("glass")`/`saveDockPanelSize("glass", size)`를 유지한다. side와 float도 각각 `loadDockPanelSize("side"|"float")`와 `saveDockPanelSize(...)`를 사용한다. 새 localStorage key를 만들지 않는다.
7. float 적용 시 command bar 폭 변수(예: `--ai-float-bar-width`)만 갱신한다. panel의 `inset:0`/width/height는 건드리지 않는다.
8. 핸들의 pointerdown 분기:
   - glass: `startWidth + dx`, `startHeight + dy`.
   - side/float 왼쪽 edge: `startWidth - dx`, 높이 불변.
   - pointerup에서 해당 dock key에 저장한다.
9. 핸들 keydown은 ArrowLeft/ArrowRight로 width를 조절하고 glass에서만 ArrowUp/ArrowDown으로 height를 조절한다. Shift는 기존 editor resizer 관례처럼 큰 step을 사용한다. 조절 때마다 `aria-valuenow`를 동기화한다.

### `src/editor/panels/editor.ts` + `src/editor/panels/aiPanelLayout.ts`

1. side preferred width의 소유자를 editor layout에 둔다. 초기값은 `loadDockPanelSize("side")?.width`; 값이 없을 때만 현재 `computeSideChatWidth()`의 1/3 기본값을 쓴다.
2. boot(`editor.ts:126-131`), `ResizeObserver`(`:217-224`), `applyLayout`(`:583-587`)이 서로 다른 값을 발행하지 않도록 `aiPanelLayout.ts`에 하나의 resolver를 둔다. 입력은 usable width, canvas reserved budget, optional persisted width이고 결과는 `SIDE_CHAT_WIDTH.min/max` 및 canvas 예산으로 clamp된 폭이다.
3. `renderAiChatPanel` option으로 side width preview/commit callback을 전달한다. drag 중에는 preferred width를 갱신하고 `applyLayout()`+`scheduleFitCanvas()`를 호출하며, pointerup에는 `saveDockPanelSize("side", { width, height: panelHeight })`로 commit한다.
4. 사용되지 않는 레거시 `oprn:ai-dock-width`(`aiPanelLayout.ts:98-115`)로 새 구현을 연결하지 않는다. 요구된 정본은 도크별 `oprn:ai-panel-size:side`다.

### CSS

1. `src/styles/database/tabs-b-assistant-panel/06-canvas-guides-panel-chrome.css`의 `.ai-chat-panel:not(.chat-dock-glass) > .ai-chat-resize-handle` 숨김 규칙을 삭제/좁혀 side와 float width handle을 허용한다. `.is-studio`, `.is-docked`, `.is-collapsed`에서 숨기는 안전 규칙은 유지한다.
2. 같은 파일의 base handle과 `.is-corner-end`를 재사용하고 side/float용 edge modifier를 추가한다. edge hit target은 최소 10px이며 눈에 보이는 grip이 있어야 한다.
3. `src/styles/database/assistant-command-bar.css:68-74`와 `10-dock-mode-rich-doc.css:72-75`의 float 640px 상수를 CSS 변수 fallback으로 합친다: 기본은 640px, 저장값이 있으면 viewport 한도 내 저장 폭을 사용한다.
4. `src/styles/database/tabs-b-assistant-panel/02-chat-dock.css`에서 float panel은 계속 `pointer-events:none`; resize handle 자신만 `pointer-events:auto`로 복원한다. full-width 투명 hit layer를 만들지 않는다.
5. `src/styles/database/assistant-composer.css`의 기존 `.ai-composer-menu-btn`/28px 액션 chrome을 collapse button에도 재사용한다. 헤더 스타일이나 새 시각 언어를 추가하지 않는다.
6. 새 CSS 파일을 만들지 말고, 새 hex/rgba, `!important`, 전역 `:root`를 추가하지 않는다.

## 4. Accessibility and testid contract

- `ai-collapse`는 실제 `<button type="button">`이며 모든 dock에서 보이고 Tab으로 도달 가능해야 한다.
- expanded 상태: `aria-label="AI 패널 접기"`, `aria-expanded="true"`; collapsed 전환 시 기존 로직대로 펼치기 라벨/`false`를 유지한다.
- `ai-collapsed-restore`도 실제 button으로 유지하고 `aria-label`은 현재 계약인 `조수`를 보존한다. collapsed 상태에서 `aria-expanded="false"`, 복원 후 `true`로 동기화한다.
- resize handle은 `tabindex="0"`, `role="separator"`, width-only dock에서는 `aria-orientation="vertical"`, 명확한 dock별 `aria-label`과 `aria-valuemin/max/now`를 가진다. mouse/pointer뿐 아니라 위 화살표 계약으로 실제 resize가 되어야 한다.
- 유지할 testid: `ai-collapse`, `ai-collapsed-restore`, `ai-resize-handle`, `ai-command-bar`, `ai-composer-actions`, `ai-chat-toolbar`.
- `ai-resize-handle`은 DOM에 하나만 존재해야 한다. dock 변경 시 같은 노드를 옮겨 duplicate testid를 만들지 않는다.

## 5. Exact verification required

1. Unit tests를 갱신/추가한다.
   - `test/aiPanelChrome.test.ts`: `ai-collapse`가 hidden toolbar 밖의 composer actions에 있고, 세 dock에서 aria-expanded/label, collapse, restore, persistence가 왕복함.
   - `test/aiPanelGlassResize.test.ts`: glass width+height, side width-only, float command-bar width-only의 pointer/keyboard 조절과 `oprn:ai-panel-size:<dock>` 저장·복원.
   - `test/aiPanelResizeAndToolBrowser.test.ts`: persisted side width 우선, 무저장 1/3 fallback, canvas 예산 clamp.
2. E2E를 갱신/추가한다.
   - `test/e2e/chat-dock-switch.spec.ts`: 숨은 훅의 `.evaluate(click)`를 사용자-visible `ai-collapse.click()`로 바꾸고 glass/side/float 각각 collapse→restore를 검증한다.
   - `test/e2e/_ai-composer.spec.ts`: collapse button 추가 전후 단일행 bar 높이가 동일하고, float resize 후에도 textarea 행 외 요인으로 높이가 변하지 않으며, 빈 캔버스 hit-test를 삼키지 않음을 검증한다.
3. 실행:
   - `npm test -- test/aiPanelChrome.test.ts test/aiPanelGlassResize.test.ts test/aiPanelResizeAndToolBrowser.test.ts`
   - `npx playwright test test/e2e/chat-dock-switch.spec.ts test/e2e/_ai-composer.spec.ts --project=chromium`
   - `npm run gates`
   - `npm run gates:css`
4. `scripts/qa/assistant-resize-collapse-qa.mjs`는 dock별 실제 resize target을 측정하도록 갱신한다: glass/side는 `ai-panel`, float은 `ai-command-bar`. 보고서에는 target testid와 rect, drag 전후 width/height를 기록한다.
5. 실행: `RPG_ZZU_URL=http://127.0.0.1:9823 node scripts/qa/assistant-resize-collapse-qa.mjs --label after`.
6. 산출물 `output/evidence/assistant-resize-collapse/after-measure.json`과 after PNG를 제출한다. 세 dock 모두 `collapse.possible: true`; glass/side/float 모두 resize grow/shrink `worked: true`여야 한다. glass는 W/H, side와 float은 W만 변하고 float H는 불변이어야 한다. 즉 BRIEF 표의 모든 `없음`/`불가` 셀이 보이는 affordance와 성공 실측으로 뒤집혀야 한다.

## 6. Hard constraints / risks and mitigations

- **숨은 toolbar 훅 보존:** `aiChatPanel.ts:2244-2249`는 “여기 담긴 9개 중 8개는 테스트가 직접 참조”하고 메뉴가 숨은 버튼의 `click()`을 위임한다고 명시한다. `ai-collapse`만 실제 composer로 이동하고 `ai-tools-browser`, `ai-studio-toggle`, `ai-dock-toggle`, `chat-dock-toggle`, `ai-export`, `ai-undo-last`, `ai-harness`, `ai-font-cycle` 및 위임 동작을 삭제/개명하지 않는다.
- **컴포저 높이 불변식:** `aiComposer.ts:9`의 정확한 규칙은 **“바 높이 = f(textarea 줄 수)뿐.”** collapse와 resize affordance는 고정 28px 액션 행/absolute handle 안에 두고 flow 높이를 늘리지 않는다.
- **맵 클릭 보호:** `aiComposer.ts:13-14`는 **“투명한 전면 레이어는 두지 않는다 — 보이지 않는 레이어가 맵 클릭을 삼킨 P0 사고”**를 기록한다. float resizer는 좁고 가시적인 handle 자신만 포인터를 받아야 한다. panel/full-width overlay의 pointer-events를 auto로 바꾸지 않는다.
- **헤더 복원 금지:** 삭제된 `.ai-chat-header`/얼굴 명패를 되살리지 않는다. 본 요청은 컴포저 액션 행과 기존 restore chip만 사용한다.
- **상태·키 재사용:** collapse는 `oprn:ai-panel-collapsed`; sizes는 `oprn:ai-panel-size:glass|side|float`. 새 collapse state machine, 별도 side key, 레이아웃 캐시 버전 bump를 만들지 않는다.
- **OpenWiki 의무:** `AGENTS.md:124`의 “If you change architecture, editor workflows, runtime data shape, persistence, or test strategy, update the matching `openwiki/*.md` page in the same change.”를 따른다. `openwiki/editor-ai-panel.md`와 `openwiki/editor-pre-edit-routing.md`의 숨은 collapse/header 설명, dock별 resize/restore/persistence와 테스트 경로를 실제 구현에 맞게 같은 변경에서 갱신한다.
- **CSS gate:** 현재 CSS 파일 수/위반 수가 ratchet 대상이다. 새 파일, 새 `!important`, 새 색 리터럴로 `npm run gates:css` 기준선을 악화시키지 않는다.

VERDICT: CHANGES REQUESTED
