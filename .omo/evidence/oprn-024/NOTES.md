# OPRN-OUT-024 — 공통 지연 툴팁 (증거)

워크트리 `/home/main/z-project/rpg-zzu-oprn024` · 브랜치 `agent/oprn024`.

| 수용 기준 | 상태 | 근거 |
|---|---|---|
| 문서화된 공유 지연 툴팁 컴포넌트/동작 제공 | 충족 | `src/editor/delayedTooltip.ts` + `openwiki/delayed-tooltip.md` |
| 무차별 적용이 아니라 명시 롤아웃 목록 | 충족 | `DELAYED_TOOLTIP_ROLLOUT` 14개 항목, 설치기는 목록의 testid 만 조회 |
| 1~2초 지연 후 표시, 정의된 조건에서 사라짐 | 충족 | `TOOLTIP_DELAY_MS=1200`; 테스트 "호버 직후에는 뜨지 않고 지연이 지나야 뜬다", "지연이 끝나기 전에 포인터가 떠나면 뜨지 않는다" |
| 키보드 초점으로 같은 라벨, Escape 로 컨트롤 실행 없이 닫힘 | 충족 | 테스트 "키보드 초점은 같은 라벨을 즉시 보여 준다", "Escape 는 툴팁만 닫고 컨트롤을 실행하지 않는다"(click 카운트 0) |
| 대상을 덮지 않고 네 변 안에 머무름 | 충족 | 순수 함수 `computeTooltipPlacement` + 6건의 배치 테스트(아래/위 뒤집기/좌/우/상/좁은 화면) |
| 클릭 가로채기·레이아웃 밀림·리렌더 후 잔존 없음 | 충족 | CSS `pointer-events: none`, `position: fixed`(문서 흐름 밖), 테스트 "패널이 다시 렌더돼 대상이 떨어지면 툴팁이 유령으로 남지 않는다" |
| 한국어 시각 라벨 6자 이하 지향, 뜻은 안 자름 | 충족 | 테스트가 롤아웃 전 항목의 label ≤ 6자와 name ≥ label 을 강제 |
| 모든 대상이 완전한 접근 가능한 이름 유지 | 충족 | `accessibleName` → `aria-label`; 테스트 "완전한 접근 가능한 이름은 짧은 시각 라벨과 별개로 남는다" |
| 지연·조기 이탈·키보드 초점·Escape·리렌더 정리·뷰포트 가장자리 테스트 | 충족 | `test/delayedTooltip.test.ts` 16건 |

기존 계약 보존: `title` 을 지우지 않고 호버 중에만 임시 제거·복원한다
(테스트 "title 은 평소에 살아 있고 호버 동안만 떼어 둔다"). 이로써
`test/e2e/oprn-editor-fidelity-shell.spec.ts`(toolbar-save)와
`test/e2e/ai-new-chat-docks.spec.ts`(ai-new-chat)의 title 단언이 깨지지 않는다.

## 실행한 검증

```
npm run typecheck:app                                                    → exit 0
npx vitest run test/delayedTooltip.test.ts --maxWorkers=2                → 16 passed
npx vitest run test/delayedTooltip.test.ts test/uxcEditorShell.test.ts \
  test/basicLeftRail.test.ts test/tilesetSectionTabs.test.ts --maxWorkers=2 → 58 passed
```

## 브라우저 증거 (2026-09-10, 워크트리 `/home/main/z-project/rpg-zzu-uievidence` · 브랜치 `agent/uievidence`)

`scripts/qa/delayed-tooltip.mjs` → `verify-shots/oprn-024/` · **9/9 PASS · 페이지 오류 0건**.
실제 Chromium, `http://127.0.0.1:9865/?blankProject=1`, 1440x900, 편집기 표준 모드.
단언 실패 시 exit 1. 고정 sleep 없음 — 툴팁 등장·소멸을 DOM 조건(`waitForFunction`)으로 기다린다.

| 장면 | 무엇을 실측했나 | PNG |
|---|---|---|
| 01 short-hover | 지연(`TOOLTIP_DELAY_MS`)의 1/3 호버는 아무것도 띄우지 않는다 | `01-short-hover.png` |
| 02 delayed-shown | 지연을 넘기면 짧은 라벨 「저장」 표시, `pointer-events: none` · `position: fixed`, 대상을 덮지 않음 | `02-delayed-shown.png` |
| 03 keyboard-focus | 명령 팔레트 버튼에 키보드 초점 → 같은 라벨 즉시 표시, 접근 이름 유지 | `03-keyboard-focus.png` |
| 04 escape-dismiss | Escape 가 툴팁만 닫는다 — click 0회, 명령 팔레트 미개방 | `04-escape-dismiss-before.png`, `04-escape-dismiss.png` |
| 05 viewport-edge | 톱바 맨 오른쪽 `window-fullscreen` 에서 툴팁이 뷰포트 안으로 클램프 | `05-viewport-edge.png` |
| 06 rerender-clears | 떠 있는 툴팁이 `renderTopbar` 재렌더에서 사라지고 새 노드에 재설치 | `06-rerender-clears-before.png`, `06-rerender-clears.png` |
| 07 title-restored | 접근 이름 완전 유지 + 네이티브 `title` 은 호버 중에만 제거, 이탈 후 복원 | `07-title-restored.png` |
| 08 assistant-panel | `ai-new-chat`, `ai-command-menu-toggle` 라벨·접근 이름·가시성 | `08-assistant-panel-*.png` |
| 09 tileset-editor | `tileset-layer-filter-lower`, `tileset-layer-auto` 라벨·접근 이름·가시성 | `09-tileset-editor-*.png` |

롤아웃 세 표면(톱바·조수 패널·타일셋 편집기)에서 컨트롤 8개를 실측했다.
환경 소음 필터: Vite HMR 웹소켓 실패(GET 중계가 웹소켓을 프록시하지 못한다)와
`?blankProject=1` 의 의도적 자동저장 비활성 알림만 걸렀다. 그 밖의 오류는 실패로 센다.

## 촬영이 드러낸 결함 두 건 (같은 변경에서 수정 + 회귀 테스트)

1. **유령 툴팁** — 떠 있는 툴팁의 대상이 패널 리렌더로 교체되면 `pointerleave` 가 오지 않아
   툴팁이 죽은 노드 좌표에 남았다. 유닛 테스트는 *대기 중* 타이머 경로만 덮고 있었다.
   고침: `src/editor/delayedTooltip.ts` 의 `watchTargetDetachment`(MutationObserver).
   회귀: `test/delayedTooltip.test.ts` 「이미 떠 있는 툴팁도 대상이 리렌더로 떨어지면 사라진다」.
2. **모달 뒤에 그려지는 툴팁** — 하드코딩 `z-index: 400` 탓에 데이터베이스 모달(z-index 900)
   안 타일셋 편집기 컨트롤의 툴팁이 화면에 아예 보이지 않았다. 롤아웃 14개 중 5개가 그 모달 안이다.
   고침: 토큰 `--z-tooltip: 2650`(모달 위·토스트 아래) 신설, CSS 가 토큰을 쓴다.
   회귀: `test/editorZLayerOrder.test.ts` 3건. 스크립트도 `elementFromPoint` + z-index 로
   **가림 여부**를 재도록 했다 — DOM 존재만 보는 단언은 이 결함을 통과시킨다.

## 실행한 검증 (브라우저 증거 단계)

```
npm run typecheck:app                                                       → exit 0
npx vitest run test/delayedTooltip.test.ts test/editorZLayerOrder.test.ts \
  test/tileLayerPolicy.test.ts test/tileLayerPolicyEditorSurface.test.ts \
  test/tileLayerPolicyClusterRegression.test.ts test/tilesetSectionTabs.test.ts → 64 passed
TOOLTIP_QA_URL=http://127.0.0.1:9865 node scripts/qa/delayed-tooltip.mjs      → 9/9 PASS, exit 0
```

음성 대조(고친 코드를 되돌려 스크립트가 정말 잡는지 확인): `delayedTooltip.ts` 를 HEAD 로
되돌리면 06 만 FAIL + exit 1, `z-index: 400` 으로 되돌리면 09 가
「tooltip is hidden behind {"selector":"database-modal","zIndex":900}」로 FAIL + exit 1.
