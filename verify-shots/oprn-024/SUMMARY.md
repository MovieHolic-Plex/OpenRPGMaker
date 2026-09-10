# OPRN-OUT-024 — 공통 지연 툴팁 (브라우저 증거)

실행: `http://127.0.0.1:9865/?blankProject=1`, 1440x900, 편집기 표준 모드, 실제 Chromium.
결과: 9/9 PASS · 페이지 오류 0건.

먼저 열 파일: `02-delayed-shown.png`(정상 표시) → `05-viewport-edge.png`(가장자리 클램프)
→ `06-rerender-clears.png`(유령 툴팁 회귀 지점) → `RESULTS.json`(모든 단언의 실측값).

| PNG | 무엇을 증명하나 |
|---|---|
| `01-short-hover.png` | 지연(TOOLTIP_DELAY_MS)의 1/3 만 머문 호버는 툴팁을 띄우지 않는다. 그 사이에도 접근 가능한 이름은 완전하다. |
| `02-delayed-shown.png` | 지연을 넘기면 짧은 라벨(「저장」)이 대상 아래에 뜨고, `pointer-events: none` · `position: fixed` 로 클릭·레이아웃을 건드리지 않는다. |
| `03-keyboard-focus.png` | 키보드 초점만으로 같은 라벨이 즉시 뜬다(명령 팔레트 버튼). |
| `04-escape-dismiss-before.png` → `04-escape-dismiss.png` | Escape 가 툴팁만 닫는다 — click 0회, 명령 팔레트도 열리지 않는다. |
| `05-viewport-edge.png` | 톱바 맨 오른쪽 컨트롤에서 툴팁이 뷰포트 안으로 잘려 들어온다(중앙 정렬이면 화면 밖). |
| `06-rerender-clears-before.png` → `06-rerender-clears.png` | 떠 있는 툴팁이 `renderTopbar` 재렌더에서 사라지고, 새 노드에 툴팁이 다시 붙는다. |
| `07-title-restored.png` | 완전한 접근 가능한 이름은 유지되고, 네이티브 `title` 은 호버 중에만 빠졌다가 이탈 후 복원된다(e2e 계약 보존). |
| `08-assistant-panel-ai-new-chat.png`, `08-assistant-panel-ai-command-menu-toggle.png` | 조수 패널 롤아웃 컨트롤 두 개. |
| `09-tileset-editor-tileset-layer-filter-lower.png`, `09-tileset-editor-tileset-layer-auto.png` | 타일셋 편집기 규칙 탭 롤아웃 컨트롤 두 개. |

롤아웃 표면 세 곳(톱바·조수 패널·타일셋 편집기)에서 총 8개 컨트롤을 실측했다.

## 이 촬영이 드러낸 결함 두 건 (같은 변경에서 고쳤다)

1. **유령 툴팁** — 떠 있는 툴팁의 대상이 패널 리렌더로 교체되면 `pointerleave` 가
   오지 않아 툴팁이 죽은 노드 좌표에 남았다. 유닛 테스트는 *대기 중* 타이머만 덮고
   있었다. 고침: `src/editor/delayedTooltip.ts` 가 표시 중 대상의 이탈을
   `MutationObserver` 로 보고 닫는다. 회귀: `test/delayedTooltip.test.ts`
   「이미 떠 있는 툴팁도 대상이 리렌더로 떨어지면 사라진다」.
2. **모달 뒤에 그려지는 툴팁** — `z-index: 400` 하드코딩 때문에 데이터베이스 모달
   (z-index 900) 안 타일셋 편집기 컨트롤의 툴팁이 화면에 아예 보이지 않았다.
   롤아웃 14개 중 5개가 그 모달 안에 있다. 고침: 토큰 `--z-tooltip`(2650, 모달 위 ·
   토스트 아래)을 `src/styles/tokens.css` 에 추가하고 CSS 가 그것을 쓴다.
   회귀: `test/editorZLayerOrder.test.ts` 3건.

두 결함 모두 DOM 존재만 보는 단언으로는 잡히지 않는다. 그래서 이 스크립트는
`elementFromPoint` + z-index 로 **가려졌는지**까지 재고, 리렌더 장면을 초점이 아니라
호버로 띄운다(초점 경로는 리렌더가 focus 를 걷어 가며 blur 로도 닫혀 결함을 가린다).

## 페이지 오류

없음. Vite HMR 웹소켓 실패(GET 중계는 웹소켓을 프록시하지 못한다)와 `?blankProject=1` 의 의도적 자동저장 비활성 알림만 환경 소음으로 걸렀다.

## 재현

```
DEV_SERVER_PORT=9865 npm run dev:worktree
TOOLTIP_QA_URL=http://127.0.0.1:9865 node scripts/qa/delayed-tooltip.mjs
```

- **01-short-hover** — PASS
- **02-delayed-shown** — PASS
- **03-keyboard-focus** — PASS
- **04-escape-dismiss** — PASS
- **05-viewport-edge** — PASS
- **06-rerender-clears** — PASS
- **07-title-restored** — PASS
- **08-assistant-panel** — PASS
- **09-tileset-editor** — PASS
