# REVIEW-3 — 조수 패널 축소·크기조절 최종 검토

## Bottom line

**APPROVED.** REVIEW-2의 네 항목은 현재 diff와 실브라우저 동작에서 모두 해결됐다. round-2 수정으로 기존 확인 완료 항목이 퇴행한 흔적도 없고, 새 blocking defect도 찾지 못했다.

## 항목별 확인

1. **Side collapsed rail restore affordance — 해결됨**
   - `15-assistant-readable.css`가 side collapsed restore를 48px 버튼으로 유지하면서 `.ai-collapsed-restore-name`을 다시 `display:block`, 12px로 표시한다.
   - `zoom3-side-rail-top.png`에서 48px rail 상단의 `조수`가 실제로 읽힌다. 이전 blank rail은 해소됐다.

2. **Preferred side width와 viewport clamp 분리 — 해결됨**
   - `editor.ts`에서 `preferredSideChatWidth` 쓰기는 초기 storage load와 `onSideWidthCommit`에만 있다. `applyLayout`, `ResizeObserver`, window resize는 `resolveSideChatWidth(..., previewSideChatWidth ?? preferredSideChatWidth)`의 적용값만 publish하며 resolved/clamped 값을 preferred에 되쓰지 않는다.
   - 단위 테스트와 browser E2E 모두 wide → narrow clamp → wide 복귀를 원래 preferred 폭의 exact equality로 확인한다.

3. **Side seam 실제 hit target — 해결됨**
   - `.is-edge-start`는 host 내부 `left:0; width:12px`이고 float의 pointer-events 계약도 유지된다.
   - round-3에서 seam probe를 재실행했다: host left 960, handle x=961..972, 연속 실제 handle hit 폭 **12px**, PASS(요구 ≥10px).

4. **E2E 정직성/coverage — 해결됨**
   - 두 spec에 `waitForTimeout`이 남아 있지 않다. 상태 전환은 locator assertion 또는 bounded `expect.poll`로 동기화한다.
   - float resize는 drag 전 width/height를 저장하고, drag 후 **실제 width 증가를 먼저 poll**한 뒤 post-drag height를 pre-drag height와 비교한다. 항등식이 아니다.
   - single-row height는 `focused/typed/slash/menu` 모두 `idle`과 exact `toBe`로 비교하며 2px tolerance가 없다.
   - heavy tests에 명시적 timeout이 있고, side collapsed storage `"1"` 확인 → reload → side dock/is-collapsed/restore visible 검증이 복구됐다.
   - temperature test는 map-first 선택 후 side에서 `.is-map-first-idle` 적용, quiet-gold 선택 후 제거를 각각 검증한다. 메뉴 숨김만 보는 테스트가 아니다.
   - collapse test는 세 dock 모두 visible 실제 버튼으로 접고 restore 후 input usability까지 확인한다.

## 기존 확인 완료 항목 회귀 여부

회귀 없음.

- 실제 composer의 collapse/restore와 ARIA/storage 왕복은 유지된다.
- hidden/inert toolbar 훅은 유지되고 collapse만 실제 action row로 이동했다.
- dock별 surface/축은 glass W+H, side W-only, float command-bar W-only로 유지된다.
- separator role/tabindex/orientation/min/max/now와 keyboard resize가 유지된다.
- float host/panel의 `pointer-events:none` 및 handle만 `pointer-events:auto` 계약이 유지된다.
- 기존 storage key만 사용하며 새 key/layout version bump가 없다.
- 48px side rail과 expanded geometry, OpenWiki 설명도 현재 구조와 일치한다.
- 제공된 QA 결과는 glass ±160/±120, side 약 ±160 W-only, float ±160 W-only/H=142를 확인한다.

## 2px autosize 결론

이전의 idle 142px → typed 144px 변화는 단순 측정 artifact가 아니라 당시 `syncInputHeight`의 `scrollHeight + 2` 구현이 만든 실제 drift였다. 현재 구현은 computed `min-height`와 `scrollHeight`의 최댓값을 사용하고 임의 +2px를 제거했다. 제공된 반복 E2E와 round-3 targeted rerun 모두 `idle=focused=typed=slash=menu=142`였으므로 drift는 실제로 제거됐다.

## 검증

- `npm test -- test/aiPanelResizeAndToolBrowser.test.ts test/aiPanelGlassResize.test.ts test/aiPanelChrome.test.ts` — **36 passed**.
- `DEV_SERVER_PORT=9823 E2E_RETRIES=0 npx playwright test test/e2e/_ai-composer.spec.ts --project=chromium --grep "H\\)"` — **1 passed**; idle/focused/typed/slash/menu 모두 142px, resize width 증가 및 height 불변 assertion 통과.
- `RPG_ZZU_URL=http://127.0.0.1:9823 node scripts/qa/assistant-side-seam-hittest.mjs` — **12px continuous hit width, PASS**.
- 제공된 round-2 증거도 확인: typecheck exit 0, targeted unit 36 passed, CSS gate pass, 두 차례 E2E 각각 9 passed, dock별 QA pass.
- 지시대로 full `npm run gates`는 실행하지 않았다.

## Action plan

1. 추가 수정 없이 현재 구현을 승인한다.

## Risks and mitigations

Blocking risk 없음. 느린 browser boot는 각 heavy spec의 bounded timeout과 상태 기반 synchronization으로 완화됐고, 동일 9-test suite가 retries 없이 두 차례 통과했다.

VERDICT: APPROVED
