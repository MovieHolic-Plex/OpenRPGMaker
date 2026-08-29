# REVIEW-2 — 조수 패널 축소·크기조절 재수정 요청

## Bottom line

핵심 구현은 상당 부분 맞다. 세 dock의 실제 접기 버튼, dock별 resize 축, 키보드/ARIA, 기존 storage key 재사용, reload 복원, float 투명 호스트의 pointer-events 안전성, 숨은 toolbar 훅/메뉴 위임은 직접 확인했다. 그러나 side 접힘 rail이 실제 화면에서 **아무 표식 없는 빈 48px 띠**이고, side preferred width가 일시적인 viewport clamp에 의해 메모리에서 소실되며, 12px이라고 선언한 side handle은 overflow clipping 때문에 실제로 6px만 클릭된다. 또한 크게 고친 E2E가 필수 assertion을 약화·삭제했고 한 spec은 기본 실행에서 확정적으로 timeout 난다.

따라서 승인할 수 없다. 아래 네 항목만 고치면 된다. 예상 작업량: **Short**.

## 1. Side collapsed rail에 눈에 보이는 restore affordance를 남겨라

**파일:** `src/styles/database/tabs-b-assistant-panel/15-assistant-readable.css`

`after-side-collapsed.png`를 직접 확대해 확인했다. 오른쪽 48px rail은 배경과 세로 border만 있고, 위쪽 restore button도 빈 흰 사각형이다. `after-glass-collapsed.png`와 `after-float-collapsed.png`의 `조수` chip과 달리 사용자가 “여기를 눌러 조수를 연다”는 사실을 알 수 없다.

원인은 명확하다.

- 공통 restore는 `.ai-collapsed-restore-name`의 `조수`를 유일한 상시 시각 내용으로 쓴다.
- `15-assistant-readable.css:73-75`가 side collapsed에서 그 이름을 `display:none`한다.
- `.ai-collapsed-restore-dot`은 평소 `display:none`이고 running/attention/error일 때만 나타나므로 idle rail에는 남는 glyph가 없다.
- 버튼 자체는 48×48이고 클릭/ARIA는 작동하므로 자동 QA는 green이지만 시각 affordance는 blank다.

증거: `output/evidence/assistant-resize-collapse/review2-side-collapsed-rail-zoom.png` 및 supervisor crop `zoom-side-collapsed-rail.png`.

48px rail 안에 항상 보이는 조수 glyph/icon 또는 읽을 수 있는 세로/축약 label을 남겨라. rail 48px 계약, expanded side, glass/float restore chip은 유지해야 한다.

## 2. Canvas clamp를 preferred side width에 다시 쓰지 마라

**파일:** `src/editor/panels/editor.ts`, 관련 테스트 `test/aiPanelResizeAndToolBrowser.test.ts` 또는 browser spec

`editor.ts:604-613`은 `resolveSideChatWidth(..., preferredSideChatWidth)`가 반환한 **현재 viewport용 clamped 폭**을 다시 `preferredSideChatWidth`에 대입한다. 이 때문에 저장 preferred width와 현재 적용 width가 다시 하나로 합쳐졌다.

직접 측정:

- side drag 후 저장값: `oprn:ai-panel-size:side={"width":612,"height":851}`
- 1440px viewport 실제 panel: 610px(border 포함 차이)
- viewport를 900px로 줄이면 canvas budget에 따라 318px로 clamp — 여기까지 정상
- 다시 1440px로 넓혀도 panel은 **318px에 고정**
- localStorage에는 여전히 612px가 남아 있고 reload하면 610px로 복원

즉 persisted width는 살아 있지만 현재 세션의 preferred owner가 transient clamp에 덮여, “persisted/preferred width wins, canvas budget은 현재 적용값만 clamp” 계약을 깨뜨린다. `preferredSideChatWidth`는 user commit/load 때만 변경하고 `applyLayout`/ResizeObserver는 resolved 적용값만 publish하라. `wide → narrow → wide`가 원래 preferred 폭으로 돌아오는 회귀 테스트를 추가하라.

## 3. Side resize handle의 실제 hit target을 최소 10px로 만들어라

**파일:** `src/styles/database/tabs-b-assistant-panel/06-canvas-guides-panel-chrome.css`, 필요 시 `02-chat-dock.css`

`06-canvas-guides-panel-chrome.css:178-187`은 12px hit target을 선언하지만 `left:-6px`로 절반을 side host 밖에 둔다. `.ai-chat-side-panel`은 `overflow:hidden`이라 바깥 절반이 잘린다.

실브라우저 `elementFromPoint` scan:

- handle rect: x=955..967, width=12
- side host left: x=960
- 실제 handle hit: x=961..966, **6px뿐**
- x=955..959는 visible rect 안이라고 보고돼도 실제 target은 `edit-canvas`
- 동일 edge handle의 float은 12px 전부 hit됨

따라서 seam의 canvas 쪽 절반을 잡으면 resize가 아니라 map을 건드린다. handle을 host 안쪽에 두거나 clipping되지 않는 owner에 mount해서 실제 연속 hit width가 최소 10px이 되게 하라. 투명 full-width layer를 추가하거나 float panel의 `pointer-events:none`을 풀어서는 안 된다.

## 4. E2E rewrite의 fake-green/coverage loss를 복구하라

**파일:** `test/e2e/_ai-composer.spec.ts`, `test/e2e/chat-dock-switch.spec.ts`

삭제된 assertion을 대조한 결과, 두 종류는 정당했다.

- `_ai-composer`: `ai-slash-list`/active slash item assertion 삭제는 assistant slash-skill surface가 실제 source에서 삭제됐고 leading `/`가 ordinary text이므로 정당하다.
- 두 spec의 `.ai-chat-header`, `ai-more-menu-toggle`, `ai-more-dock` 사용자 경로 삭제는 header band가 실제 DOM에서 삭제됐으므로 정당하다. 숨은 `chat-dock-toggle`은 test-only dock setup에만 쓰고 있다.

하지만 다음 손실/결함은 중요하다.

1. `_ai-composer.spec.ts:139-149`의 float resize 높이 검증은 drag **후** `heightBeforeResize`를 읽고 곧바로 같은 값을 poll하므로 항등식이다. width가 실제로 변했다는 assertion도 없다. menu를 닫고, drag 전에 width/height를 읽고, drag 후 width 변화가 먼저 관찰될 때까지 exact state signal을 기다린 뒤 height가 pre-drag 값과 같은지 검증하라.
2. 같은 spec `:135-137`은 원래 exact single-row equality를 `<=2`로 완화했다. 실측은 rows=1인 채 textarea가 idle 68px → typed 70px, bar가 142px → 144px로 변한다. 따라서 현재 주석의 “바 높이 = f(textarea 줄 수)뿐”은 실제로 false다. autosize를 같은 one-row geometry로 고쳐 exact assertion을 복구하거나, 이 2px가 기존 별도 결함임을 명시하고 최소한 이번 collapse/float-resize 전후 exact 비교를 비항등식으로 지켜라. 단순 tolerance로 계약 위반을 숨기지 마라.
3. `chat-dock-switch.spec.ts:180`은 shared `openEditor()`에 `freshProject=1`을 추가했지만 이 test만 30초 기본 timeout을 유지한다. 올바른 server(`DEV_SERVER_PORT=9823`)에서 30초 실행은 확정 실패했고 `--timeout=120000`에서는 43.7초에 통과했다. 주변 heavy boot test처럼 명시적 timeout을 주어 단일 실행을 green으로 만들어라.
4. collapsed test는 예전의 `oprn:ai-panel-collapsed=1 → reload → is-collapsed/restore` persistence assertion을 삭제하고 같은 페이지의 click round-trip만 검사한다. reload restore는 독립 probe에서 동작했지만 요구사항에 대한 회귀 보호가 없어졌다. 최소 한 dock에서 reload persistence assertion을 복구하라.
5. temperature test는 `ai-temperature-map-first` 클릭 후 `.is-map-first-idle` 적용/해제 assertion을 삭제하고 menu hidden만 검사한다. UI 선택지가 실제 state에 반영되는지를 더 이상 검증하지 않는다. float에서 선택 후 glass/side로 바꿔 적용 class를 확인하는 등 삭제된 의미를 보존하라. 이는 새 기능 요구가 아니라 implementer가 건드린 기존 spec의 assertion 보존이다.

또한 side collapsed browser assertion `restoreBox.width <= 48`은 blank button도 통과한다. 시각 copy 자체를 prose test로 고정할 필요는 없지만, 새 screenshot/QA에서는 rail에 실제 visible glyph/label이 있음을 다시 확인하라.

## 확인 완료 — 다시 바꿀 필요 없는 부분

- `ai-collapse`는 hidden/inert toolbar 밖 composer lead action에 있고 세 dock 모두 visible/clickable이다. collapse/restore의 `aria-expanded`, label, `oprn:ai-panel-collapsed` 왕복이 맞다.
- hidden toolbar에는 기존 hooks가 남아 있고, `ai-collapse`만 빠졌다. 실브라우저에서 command menu의 `전체 기록` delegated click이 hidden history hook을 통해 `is-history-open is-docked`를 적용했다.
- 단일 `ai-resize-handle`만 존재한다. glass W+H, side shell W-only, float command-bar W-only가 grow/shrink하며 float bar 높이는 실측 142→142였다.
- separator role/tabindex/orientation/min/max/now가 있고 arrows가 실제 resize/저장한다.
- float host/panel은 계속 `pointer-events:none`; handle만 auto다. canvas center/upper-left/handle 왼쪽의 hit target은 실제 `canvas`, handle은 좁은 자체 rect에서만 hit했다.
- storage inventory에 새 panel key나 layout version bump가 없다. 사용 key는 `oprn:ai-panel-collapsed`, `oprn:ai-panel-size:{glass,side,float}`이고 reload 복원은 동작한다.
- `15-assistant-readable.css`의 48px pin은 expanded side/glass geometry를 바꾸지 않았다. 결함은 collapsed rail의 내용 삭제뿐이다.
- OpenWiki 두 페이지는 실제 구조와 맞게 갱신됐다.

## 검증 결과

- `RPG_ZZU_URL=http://127.0.0.1:9823 node scripts/qa/assistant-resize-collapse-qa.mjs --label review2` — 세 dock collapse 가능, glass +160×120/-160×-120, side +158×0/-162×0, float +160×0/-160×0.
- `npm test -- test/aiPanelChrome.test.ts test/aiPanelGlassResize.test.ts test/aiPanelResizeAndToolBrowser.test.ts` — **36 passed**.
- `npx tsc --noEmit -p tsconfig.app.json` — 통과.
- `npm run gates:css` — budget/graph 통과, baseline 증감 0.
- `DEV_SERVER_PORT=9823 npx playwright test test/e2e/chat-dock-switch.spec.ts test/e2e/_ai-composer.spec.ts --project=chromium` — **8 passed, 1 failed**; `idle-screen picker` 30초 timeout. 같은 test를 `--timeout=120000`으로 실행하면 43.7초에 통과.
- `_ai-composer.spec.ts`는 별도 실행에서 5 passed도 확인했으나, H test가 한 full-file 실행에서 실패하고 재실행에서 통과해 deterministic하지 않았다. 위 항등식 resize assertion과 안정화 없는 drag 검증을 고쳐야 한다.
- full `npm run gates`는 지시대로 재실행하지 않았다. `gates-baseline.log`/`gates-after.log` 모두 기존 전역 vitest baseline이 red이고 실패 목록이 실행마다 바뀌므로, 본 변경 판단은 targeted test/typecheck/CSS/E2E에 근거했다.

VERDICT: CHANGES REQUESTED
