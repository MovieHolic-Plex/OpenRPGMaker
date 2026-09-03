# AI 조수 「데크」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (이 저장소는 서브에이전트 호출 금지 — 인라인 실행). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조수 float 표면을 흰 상자 둘 + 모노 로그에서, 상태 레일·산문 대화·작업 타임라인·영수증 카드·컴포저를 담은 유리 계기판 하나(데크)로 바꾼다. 기능 손실 0, testid 계약 보존.

**Architecture:** 패널(`aside.ai-chat-panel`, 캔버스 전면 투명) 안에 `div.ai-deck` 래퍼를 두고 레일 → 기록 본문(`.ai-chat-body`) → 컴포저(`.ai-command-bar`)를 세로 flow 로 담는다. 표면 CSS 는 새 파일 둘(`18-assistant-deck.css` 셸·레일·대화·타임라인·컴포저·메뉴·알약, `19-assistant-cards.css` 영수증·승인·계획 카드·넓은 비교 뷰어)이 단일 소유하고, 13~17 다섯 레이어는 삭제한다. 상태는 `panel.dataset.aiState`(idle|run|attention|done|error) 하나로 레일 점·문장·알약이 같이 움직인다. 데이터 층(`src/ai/*`)은 건드리지 않는다.

**Tech Stack:** Vite + TypeScript DOM 패널(`@/util/dom` `el()`), CSS(tokens.css 변수만), vitest(happy-dom/fakeDom 계약 테스트), Playwright e2e(`DEV_SERVER_PORT=9861`), 캡처 스크립트 `scripts/capture-ai-assistant-current.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-03-assistant-deck-design.md` (정본 제안서 `docs/2026-09-03-ai-assistant-modern-ui-proposal.html`)

## Global Constraints

- 새 hex 리터럴 0, `!important` 0 (`node scripts/check-css-budget.mjs --json` 의 `hexByFile`/`importantByFile` 에 새 파일이 0 으로만 나타난다). 색은 `--accent --warning --success --danger --text-1/2 --bg-raised --bg-inset --border-subtle --border-default --accent-muted --accent-border --warning-muted --success-muted --danger-muted` 만.
- 유리 알파 ≥ .78(`color-mix(in srgb, var(--bg-raised) 90%, transparent)`), `saturate(1.08)` 초과 금지, 유리 위 보조 글자는 `--text-2`.
- 팝오버는 닫히면 `hidden`. 투명 전면 레이어 금지(히트테스트 P0 규칙, `test/e2e/_ai-assistant-hostile-eval.spec.ts` H).
- 보존 testid: `ai-panel ai-command-bar ai-input ai-send ai-abort ai-collapse ai-collapsed-restore ai-new-chat ai-open-conversations ai-command-menu-toggle ai-command-menu ai-context-chips ai-selection-chip ai-pending-queue ai-status ai-chat-log ai-chat-body ai-glass-log ai-command-row ai-command-row-user ai-command-row-assistant ai-tool-activity ai-tool-activity-toggle ai-tool-entry ai-change-card ai-change-shot-before ai-change-shot-after ai-change-undo ai-quick-replies ai-suggest-popover ai-next-steps ai-next-steps-hint ai-preference-toggle ai-context-meter ai-rising-sticky-zone ai-collapsed-undo`.
- 삭제 testid: `ai-log-zoom* ai-log-chrome ai-log-resize-handle`. 이동: `ai-command-temperature-*` → 설정 모달.
- 금지 클래스 부활: `.ai-chat-header .ai-director-* .ai-header-actions .ai-collapsed-restore-float .ai-collapsed-restore-rail-*`(test/aiPanelChrome.test.ts 가 null 을 요구).
- 게이트: `npm run typecheck:app` 0 에러 · 관련 vitest 파일 통과 · `npm run gates -- --only css` 새 회귀 0 · e2e 4개(`assistant-single-dock` `ai-panel-reachability` `assistant-change-preview` `_ai-assistant-hostile-eval`) 기준선 대비 새 실패 0. 모든 playwright 는 `DEV_SERVER_PORT=9861 npx playwright test <spec> --reporter=line`.
- 커밋은 태스크마다. 한국어 conventional 커밋(`feat(ai): …`, `style(ai): …`, `test(ai): …`).

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `src/editor/panels/aiToolLabels.ts` | 툴 이름 → 한국어 라벨·아이콘 키 사전(스튜디오 `TOOL_SHORT` 이관) | Create |
| `src/editor/panels/aiDeckIcons.ts` | 인라인 SVG 아이콘 빌더 `deckIcon(name)` (stroke 1.75, currentColor) | Create |
| `src/editor/panels/aiDeckRail.ts` | 상태 레일: 점·이름·맵·문장·헤어라인 + 아이콘 슬롯, `setState()` | Create |
| `src/editor/panels/aiMapChip.ts` | 툴 인자/결과에서 영역을 뽑아 46×32 맵 크롭 캔버스를 만든다 | Create |
| `src/editor/panels/aiComposer.ts` | 버튼을 만들되 레일에 내어주고, 모드 세그먼트·모델 칩·containment 옵션 | Modify |
| `src/editor/panels/aiChatPanel.ts` | 데크 래퍼 조립, 레일 마운트, 상태 모델, 로그 크롬 삭제, 제안 행, 알약 상태 | Modify |
| `src/editor/panels/aiChatResizeChrome.ts` | 기록 높이 핸들 삭제, 폭 핸들은 데크 왼쪽 | Modify |
| `src/editor/panels/aiConversationLog.ts` | 작업 그룹 헤더·행 구조·자동 접힘·맵 칩 훅 | Modify |
| `src/editor/panels/aiChatRenderers.ts` | `renderToolActivityEntry` 한국어 라벨 행 | Modify |
| `src/editor/panels/aiChangePreview.ts` | 라벨 지금/적용 후, 배지 텍스트 옵션 | Modify |
| `src/editor/panels/aiActionMenu.ts` | 아이콘 + 오른쪽 메타 슬롯 | Modify |
| `src/editor/panels/aiDirectorChrome.ts` | 알약 상태 슬롯(`-state`, `-count`) | Modify |
| `src/editor/panels/aiSettingsModal.ts` | 「대기 화면」 절 추가 | Modify |
| `src/editor/panels/aiStudioShell.ts` | `TOOL_SHORT` → `aiToolLabels`, 타일 아이콘·묶음, 모드 라벨 삭제 | Modify |
| `src/styles/database/tabs-b-assistant-panel/18-assistant-deck.css` | 데크 표면 단일 소유자 | Create |
| `src/styles/database/tabs-b-assistant-panel/19-assistant-cards.css` | 영수증·승인·계획 카드·넓은 뷰어 | Create |
| `src/styles/database/tabs-b-assistant-panel/{13,14,15,16,17}-*.css` | 삭제 | Delete |
| `src/styles/database/tabs-b-assistant-panel.css` | import 목록 갱신 | Modify |
| `src/styles/database/assistant-command-bar.css` | float 바 규칙을 직접 자식(`>`)으로 한정 | Modify |
| `test/aiToolLabels.test.ts` `test/aiDeckRail.test.ts` `test/aiDeckIcons.test.ts` `test/aiMapChip.test.ts` | 새 계약 | Create |
| `test/aiConversationLog.test.ts` `test/aiPanelChrome.test.ts` `test/aiPanelGlassResize.test.ts` `test/aiPanelModernShell.test.ts` `test/e2e/assistant-single-dock.spec.ts` | 계약 갱신 | Modify |

---

### Task 1: 툴 한국어 라벨 사전 `aiToolLabels.ts`

**Files:**
- Create: `src/editor/panels/aiToolLabels.ts`
- Modify: `src/editor/panels/aiStudioShell.ts:63-83` (TOOL_SHORT 삭제 → import)
- Test: `test/aiToolLabels.test.ts`

**Interfaces:**
- Produces: `toolLabel(name: string): string` (사전 → 없으면 `snake_case` 를 공백 분리한 원문), `toolIconKey(name: string): DeckIconName`, `TOOL_LABELS: Readonly<Record<string, { label: string; icon: DeckIconName }>>`.

- [ ] **Step 1: 실패 테스트**

```ts
// test/aiToolLabels.test.ts
import { describe, expect, it } from "vitest";
import { toolLabel, toolIconKey } from "@/editor/panels/aiToolLabels";

describe("aiToolLabels", () => {
  it("아는 툴은 사람 말로 부른다", () => {
    expect(toolLabel("place_npc")).toBe("NPC 배치");
    expect(toolLabel("find_open_area")).toBe("빈 자리 찾기");
    expect(toolLabel("get_map_info")).toBe("맵 읽기");
  });
  it("모르는 툴은 원문을 그대로 두되 밑줄만 공백으로 푼다", () => {
    expect(toolLabel("weird_new_tool")).toBe("weird new tool");
  });
  it("아이콘 키는 조회/편집 계열로 갈린다", () => {
    expect(toolIconKey("get_map_info")).toBe("search");
    expect(toolIconKey("place_npc")).toBe("user");
    expect(toolIconKey("nothing")).toBe("wrench");
  });
});
```

- [ ] **Step 2:** `npx vitest run test/aiToolLabels.test.ts` → FAIL (module not found)
- [ ] **Step 3: 구현** — 사전에는 스튜디오 `TOOL_SHORT` 20개 + 로그에서 자주 보이는 조회 툴(`get_map_info 맵 읽기`, `find_open_area 빈 자리 찾기`, `show_map_region 영역 보기`, `find_events 이벤트 찾기`, `get_event 이벤트 읽기`, `tile_query 타일 보기`, `run_lint 맵 검사`, `set_build_spec 밑그림`, `configure_shop 상점 구성`, `place_chest 상자 놓기`, `place_concept 개념 배치`, `create_transfer_pair 맵 연결`, `make_villager 주민 만들기`, `set_shop_stock 품목 정하기`). 아이콘 키는 `DeckIconName` 유니언(Task 2 와 같은 이름 집합) 으로 타입을 맞춘다.
- [ ] **Step 4:** 테스트 PASS. `aiStudioShell.ts` 의 `TOOL_SHORT`/`toolShortLabel` 을 `toolLabel` 로 교체하고 `npx vitest run test/aiStudioShell*.test.ts` (있으면) 통과.
- [ ] **Step 5:** `git commit -m "feat(ai): 툴 한국어 라벨 사전을 한 모듈로 모은다"`

### Task 2: 아이콘 빌더 `aiDeckIcons.ts`

**Files:** Create `src/editor/panels/aiDeckIcons.ts`, Test `test/aiDeckIcons.test.ts`

**Interfaces:**
- Produces: `type DeckIconName = "plus"|"clock"|"more"|"chevron-down"|"chevron-right"|"arrow-up"|"stop"|"check"|"spark"|"pin"|"selection"|"x"|"undo"|"expand"|"list"|"question"|"gear"|"export"|"book"|"compress"|"wrench"|"scroll"|"eye"|"house"|"wall"|"road"|"door"|"box"|"user"|"shop"|"flag"|"grid"|"shield"|"map"|"tree"|"link"|"search"|"memory"`; `deckIcon(name: DeckIconName, opts?: { size?: 15|18|22; class?: string }): SVGSVGElement` — `svg.ai-deck-icon[data-icon=name]`, `aria-hidden="true"`, `stroke="currentColor" fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"`, viewBox 0 0 24 24, path 데이터는 `document.createElementNS`.

- [ ] **Step 1: 실패 테스트** — `deckIcon("plus")` 가 `svg` 이고 `data-icon="plus"`, `aria-hidden`, width/height 18 기본, `size: 15` 반영, 모든 `DeckIconName` 에 path 가 1개 이상.
- [ ] **Step 2:** FAIL 확인 → **Step 3:** 구현(경로 데이터는 `docs/…/mock/deck.html` `<symbol>` 들과 동일) → **Step 4:** PASS
- [ ] **Step 5:** `git commit -m "feat(ai): 데크 아이콘 SVG 빌더"`

### Task 3: 상태 레일 `aiDeckRail.ts`

**Files:** Create `src/editor/panels/aiDeckRail.ts`, Test `test/aiDeckRail.test.ts`

**Interfaces:**
- Consumes: `deckIcon` (Task 2).
- Produces:
```ts
export type DeckState = "idle" | "run" | "attention" | "done" | "error";
export interface DeckRail {
  readonly root: HTMLElement;            // div.ai-deck-rail[data-testid=ai-deck-rail]
  readonly actions: HTMLElement;         // div.ai-deck-rail-actions — 패널이 버튼을 넣는 슬롯
  readonly statusSlot: HTMLElement;      // span.ai-deck-rail-state — 기존 `ai-status` 엘리먼트를 여기 append
  setContext(mapName: string | null): void;   // "· 시장 마을"
  setState(state: DeckState): void;           // root.dataset.aiState + 점 클래스
}
export function createDeckRail(options: { readonly name?: string }): DeckRail;
```
- 레일 DOM: `.ai-deck-rail > .ai-deck-rail-who(.ai-deck-rail-dot, .ai-deck-rail-name "조수", .ai-deck-rail-ctx) + .ai-deck-rail-state + .ai-deck-rail-spacer + .ai-deck-rail-actions`. 진행 헤어라인은 `.ai-deck-rail::before`(CSS, `[data-ai-state="run"]`).

- [ ] **Step 1: 실패 테스트** — 이름 "조수", `setContext("시장 마을")` → ctx 텍스트 "시장 마을", `setState("run")` → `root.dataset.aiState === "run"`, 점이 `.is-run`; `actions` 가 비어 있고 append 가능; 금지 클래스(`ai-chat-header`, `ai-director-name`) 없음.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS → **Step 5:** `git commit -m "feat(ai): 데크 상태 레일 컴포넌트"`

### Task 4: 컴포저 — 버튼 내어주기 · 모드 세그먼트 · 모델 칩 · containment

**Files:** Modify `src/editor/panels/aiComposer.ts`, Test `test/aiComposerInputUx.test.ts`(기존 통과 유지) + `test/aiComposerDeck.test.ts`(신규)

**Interfaces:**
- `ComposerOptions` 추가: `isInside?: (target: Node) => boolean` (바깥 클릭 판정 — 패널이 `deck.contains` 를 넘긴다), `modeChips?: { readonly initial: ComposerMode; readonly onChange: (mode: ComposerMode) => void }`, `modelLabel?: string | null`.
- `ComposerElements` 추가: `conversationsButton: HTMLButtonElement | null`, `menuToggle: HTMLButtonElement`, `modeSegment: HTMLElement | null`, `setModelLabel(label: string | null): void`, `setMode(mode: ComposerMode): void`.
- `export type ComposerMode = "do" | "ask" | "plan";` 세그먼트 DOM: `.ai-composer-mode[role=radiogroup][data-testid=ai-composer-mode] > button.ai-composer-mode-option[data-mode][aria-checked]`, 라벨 지시/질문/계획.
- 액션 행 재배치: lead = `[collapseButton(hidden 유지, 레일이 대신 노출)] modeSegment, undoAppliedButton, contextChips, queueIndicator`; trail = `statusGroup, modelChip(.ai-composer-model[data-testid=ai-composer-model]), sendButton, abortButton`. `newChatButton`·`conversationsButton`·`commandMenuToggle`·`preferenceToggle`·`contextMeterButton` 은 **만들되 행에 넣지 않고** 반환만 한다(패널이 레일 `actions` 에 넣는다). 힌트 `.ai-composer-hint` 는 삭제하고 `input.title = "Enter 보내기 · Shift+Enter 줄바꿈"`.
- 아이콘: `newChatButton` 텍스트 "+" → `deckIcon("plus")`, 🕒 → `clock`, ☰ → `more`, ⌾ → `memory`, 보내기 버튼 내용은 패널 소유(Task 5).

- [ ] **Step 1: 실패 테스트(신규 파일)** — `createComposerElements` 결과에서 `actions` 안에 `ai-new-chat`/`ai-open-conversations`/`ai-command-menu-toggle` 이 **없고** 반환값에는 있다; `modeSegment` 옵션 시 3개 옵션, 클릭 시 `onChange("ask")`·`aria-checked`; `isInside` 가 false 를 주는 바깥 pointerdown 에 메뉴가 닫히고 true 면 안 닫힌다; `.ai-composer-hint` 부재.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** `npx vitest run test/aiComposerDeck.test.ts test/aiComposerInputUx.test.ts test/aiComposerUndo.test.ts` PASS
- [ ] **Step 5:** `git commit -m "feat(ai): 컴포저가 레일 버튼을 내어주고 모드 세그먼트·모델 칩을 든다"`

### Task 5: 패널 조립 — 데크 래퍼 · 레일 · 상태 모델 · 로그 크롬 삭제 · 알약

**Files:** Modify `src/editor/panels/aiChatPanel.ts`(2233-2420, 1290-1330, 351-356, 2480-2500), `src/editor/panels/aiChatResizeChrome.ts`, `src/editor/panels/aiDirectorChrome.ts`; Test `test/aiPanelChrome.test.ts` `test/aiPanelGlassResize.test.ts` `test/aiPanelModernShell.test.ts` `test/aiDirectorChrome*.test.ts`(있으면)

**Interfaces:**
- 패널 자식: `[toolbar, deck, collapsedRestore, collapsedUndo, stickyProposalZone]`, `deck = div.ai-deck[data-testid=ai-deck] > [rail.root, body, commandBar]`. `panel.dataset.aiState`.
- `setStatus(text)` 는 기존대로 `ai-status` 텍스트를 바꾸고 `statusToneOf(text)` 를 `DeckState` 로 사상해 `rail.setState` + `panel.dataset.aiState` + `collapsedRestore.dataset.aiState` 를 함께 갱신한다. 사상: tone `idle→idle`, `running/busy→run`, `attention/pending→attention`, `done/ok→done`, `error→error`(`statusToneOf` 의 실제 반환값을 읽어 매핑 표를 쓴다).
- 알약(`aiDirectorChrome.ts`): `createDirectorRestoreButton()` 에 `span.ai-collapsed-restore-state` 와 `span.ai-collapsed-restore-count[hidden]` 추가; `export function setRestoreButtonState(button, state: DeckState, label: string, pendingCount: number)`.
- 리사이즈: `createChatResizeChrome` 에서 `logHandle`·`logResizable` 제거, 폭 핸들은 `deck` 왼쪽 가장자리(`deps.commandBar` → `deps.deck`).
- 삭제: `logChrome`/`logZoom*`/`ai-log-grip`, `--ai-float-log-height` 축, `oprn:ai-log-height` 읽기(`aiPanelLayout.ts` 의 `loadLogHeight/saveLogHeight/clampLogHeight/LOG_HEIGHT_LIMITS/DEFAULT_LOG_HEIGHT` 는 미사용이면 삭제).
- clearance: `syncCommandBarClearance` 는 `deck.getBoundingClientRect()` 기준.
- 레일 actions 에 넣는 순서: `contextMeter.button, newChatButton, conversationsButton, preferenceToggle, menuToggle, collapseButton`. `commandMenu` 는 `rail.root.append(commandMenu)` 로 레일 아래 우측 정렬.

- [ ] **Step 1: 테스트 갱신** — `aiPanelGlassResize.test.ts` 의 `logHandleOf` 블록 삭제(기록 높이 축 폐기), 대신 `ai-resize-handle` 이 `ai-deck` 안에 있음을 확인. `aiPanelChrome.test.ts` 에 「레일이 `ai-new-chat`·`ai-open-conversations`·`ai-command-menu-toggle`·`ai-collapse` 를 담고 `ai-log-zoom`/`ai-log-chrome` 은 0건」 케이스 추가. 알약 상태 테스트: `setStatus` 후 `ai-collapsed-restore[data-ai-state]`.
- [ ] **Step 2:** `npx vitest run test/aiPanelChrome.test.ts test/aiPanelGlassResize.test.ts` → 새 케이스 FAIL
- [ ] **Step 3:** 구현 → **Step 4:** 위 + `test/aiPanelModernShell.test.ts test/aiSharedSurface.test.ts test/aiMoreMenuLayout.test.ts test/aiChatPanelSettings.test.ts test/aiPanelAutoExpand.test.ts` PASS, `npm run typecheck:app` 0
- [ ] **Step 5:** `git commit -m "feat(ai): 조수 표면을 데크 하나로 — 레일·상태 모델·알약 상태, 기록 줌/높이 축 삭제"`

### Task 6: CSS — 18/19 신설, 13~17 삭제, 바 규칙 한정

**Files:** Create `18-assistant-deck.css`, `19-assistant-cards.css`; Delete `13-assistant-modern.css` `14-assistant-ux-repair.css` `15-assistant-readable.css` `16-modern-change-first.css` `17-assistant-modern-shell.css`; Modify `tabs-b-assistant-panel.css`, `assistant-command-bar.css`(`.ai-chat-panel.chat-dock-float .ai-command-bar` → `.ai-chat-panel.chat-dock-float > .ai-command-bar`), `assistant-composer.css`(`.ai-composer-hint` 규칙 삭제, `.ai-composer-popover` 위치는 `.ai-deck` 기준)

18 의 절: 토큰 → 데크 셸(폭·유리·그림자·radius 20, `.is-assistant-idle:not(.is-composer-focused)` 480) → 레일(38px, 점 5상태, `::before` 헤어라인 sweep) → 본문(`.ai-chat-body` static, `max-height: min(660px, 62vh)`, `.ai-glass-log > .ai-chat-log` 스크롤러, `pre/table` 자기 스크롤 규칙을 17 에서 이관) → 대화 행(`.ai-command-prefix{display:none}`, user 우측 말풍선, assistant 산문 14px/1.55, system 12px 메타) → 작업 타임라인(`.ai-tool-activity` 카드, `.ai-tool-activity-toggle` 헤더, `.ai-tool-activity-line` grid 46px/1fr/auto, `.ai-map-chip`) → 컴포저(row 36px, 세그먼트, 핀, 모델 칩, 보내기 34px 원, 멈추기 검정) → 팝오버(메뉴 248px 아이콘+메타, 추천 in-flow 행) → 알약(44px, 5상태) → 접힘/기록/스튜디오 예외(`.is-history-open .ai-deck{position:static;width:100%;height:100%;border-radius:0;box-shadow:none}`, `.is-studio .ai-deck{display:none}`) → 넓은 폭 미디어(`max-width:1300px` 에서 `--ai-float-bar-width: 640px`).

19 의 절: `.ai-change-card`(배지·제목·칩·pair 340px 샷·foot), `.ai-proposal-card`(같은 언어 + `--warning` 링), `.ai-autonomous-checklist`(계획 카드 언어), `.ai-change-wide*`(16 에서 이관, 값 유지).

- [ ] **Step 1:** 계약 테스트 — `test/aiQuickReplyPlacement.test.ts`(04 규칙, 변경 없음) · `test/aiMoreMenuLayout.test.ts`(command-bar.css) 가 여전히 PASS 하는지 먼저 확인. 새 테스트 `test/aiDeckCss.test.ts`: 18 파일이 존재하고 `#` hex 0건, `!important` 0건, `.ai-deck {`·`.ai-deck-rail {`·`.ai-collapsed-restore[data-ai-state="attention"]` 규칙 존재, 13~17 파일 부재, `tabs-b-assistant-panel.css` 가 18·19 를 import 하고 13~17 을 import 하지 않음.
- [ ] **Step 2:** FAIL → **Step 3:** 작성/삭제 → **Step 4:** PASS + `npm run gates -- --only css` 에서 새 파일 hex/important 0, cssFileCount 262
- [ ] **Step 5:** `git commit -m "style(ai): 데크 CSS 단일 소유(18·19) — 13~17 레이어 삭제"`

### Task 7: 실측 — 유휴/포커스/대화/접힘

- [ ] `BASE=http://127.0.0.1:9861 node scripts/capture-ai-assistant-current.mjs` → `docs/…-assets/current/` 를 `after/` 로 바꿔 저장(`OUT` 환경변수 추가) → 01/03/05/14/17 을 열어 목업과 대조. 잘림(`ai-panel-reachability`)·히트테스트(`_ai-assistant-hostile-eval` H) e2e 실행.
- [ ] 발견된 어긋남을 18 에서 고치고 `git commit -m "style(ai): 데크 실측 보정"`

### Task 8: 대화 — 작업 타임라인 행·자동 접힘·맵 칩

**Files:** Modify `aiConversationLog.ts`(262-330), `aiChatRenderers.ts`(`renderToolActivityEntry`), Create `aiMapChip.ts`; Test `test/aiConversationLog.test.ts`, `test/aiMapChip.test.ts`

**Interfaces:**
- `renderToolActivityEntry(name, result, detail?, opts?: { chip?: HTMLElement | null })` → `div.ai-tool-activity-line[data-testid=ai-tool-entry] > (.ai-act-chip, .ai-act-what > (.ai-act-label = toolLabel(name), .ai-act-sum = result.summary), .ai-act-status(check 아이콘 | ✗))`. 실패는 기존 `details.ai-tool-failure` 유지(summary 에 라벨 사용).
- `ConversationLogHost` 옵션 추가: `renderChip?: (name: string, args: Record<string, unknown> | undefined, result: ToolResult) => HTMLElement | null`.
- 그룹 헤더 텍스트: 진행 중 `작업 N단계`, 완료 후 `작업 N단계 · 라벨 → 라벨 → …`(최대 4개, 나머지 `…`) 와 `▸/▾` 대신 `deckIcon("chevron-right"|"chevron-down")`. `closeToolActivity()` 가 리스트를 `hidden=true` 로 접고 요약을 쓴다(D3). 조회 노이즈(`isReadOnlyToolNoise`) 판정은 유지.
- `aiMapChip.ts`: `export function regionFromToolCall(args, result): RegionRect | null` — `args.x/y/w/h`, `args.rect`, `args.points[0]`, `result.data.x/y`, `result.data.region` 순으로 본다; `export function renderMapChip(project, mapId, region, renderShot = renderRegionSnapshot): HTMLElement`(46×32, `div.ai-map-chip` + 비동기 canvas, 실패 시 아이콘 칩).

- [ ] **Step 1:** 테스트 — 로그 테스트: 툴 2건 후 `closeToolActivity()` → 토글 텍스트가 `작업 2단계 · 맵 읽기 → 빈 자리 찾기` 이고 리스트 `hidden`; 행이 `.ai-act-label` 에 한국어. 맵 칩 테스트: `regionFromToolCall({x:3,y:4},{ok:true,summary:""})` → `{x:3,y:4,width:1,height:1}` 등 4개 경로.
- [ ] **Step 2:** FAIL → **Step 3:** 구현(패널은 `renderChip` 을 `store.getCurrent()` 로 넘긴다) → **Step 4:** `npx vitest run test/aiConversationLog.test.ts test/aiMapChip.test.ts test/aiChatObservability.test.ts test/aiTurnGroupSquash.test.ts` PASS
- [ ] **Step 5:** `git commit -m "feat(ai): 작업 타임라인 — 한국어 라벨·맵 칩·완료 자동 접힘"`

### Task 9: 영수증·승인 카드 통일

**Files:** Modify `aiChangePreview.ts`(라벨 `이전/이후` → `지금/적용 후`, 배지 텍스트 `적용됨`, `ai-change-card` 에 `ai-card` 클래스), `aiProposalCard.ts`(승인 카드에 `ai-card is-attention` + 배지 `확인 필요`); CSS 는 Task 6 의 19.
- [ ] **Step 1:** `grep -rn "이전\|이후" test/*hange*` 로 라벨을 고정한 테스트를 찾아 함께 갱신 → FAIL → **Step 3:** 구현 → PASS(`npx vitest run test/aiChangePreview*.test.ts test/aiProposalCard*.test.ts`)
- [ ] **Step 5:** `git commit -m "feat(ai): 변경·승인 카드를 영수증 언어로 통일"`

### Task 10: ☰ 메뉴 아이콘·메타, 대기 화면 → 설정

**Files:** Modify `aiActionMenu.ts`(`ItemSpec.icon: DeckIconName`, `meta?: () => string`), `aiChatPanel.ts`(2652 composerTemperatureSection 를 메뉴에서 빼고 설정 모달에 전달), `aiSettingsModal.ts`(`settingsSection("temperature", "대기 화면", …, [section])`), `test/e2e/assistant-single-dock.spec.ts:142-165`(설정 모달을 열어 `ai-command-temperature-*` 를 고른다), `test/aiTemperatureMenu.test.ts`(변경 없음)
- [ ] **Step 1:** 메뉴 테스트(`test/aiActionMenu*.test.ts` 또는 신규): 항목마다 `svg.ai-deck-icon` 1개, 라벨 텍스트 유지(`맥락 압축 감독 지침 내보내기 전체 기록 도구 목록 설정` — `툴 브라우저`→`도구 목록`, `⚙ 설정`→`설정`; testid 불변). `aiChatPanelSettings.test.ts` 에 설정 모달 안 `ai-command-temperature-quiet-gold` 존재 케이스.
- [ ] **Step 3:** 구현 → **Step 4:** PASS + e2e `DEV_SERVER_PORT=9861 npx playwright test test/e2e/assistant-single-dock.spec.ts --reporter=line`
- [ ] **Step 5:** `git commit -m "feat(ai): ☰ 메뉴 아이콘·메타 열, 대기 화면은 설정으로"`

### Task 11: 추천 행(D5)

**Files:** Modify `aiChatPanel.ts:1669-1695`, `aiStartScreenCards.ts`(`buildAiAuthoringExamples` 옆에 `buildSuggestionRows({ examples, onPick, limit: 3 })` — `button.ai-suggest-row > (deckIcon("spark"), .ai-suggest-row-text = label 문장, .ai-suggest-row-why = kind 라벨)`), `test/aiPanelChrome.test.ts:296-320`(6칩 → 행 3개), `test/aiPanelModernShell.test.ts:76`
- 문장은 `AI_AUTHORING_EXAMPLES[i].instruction` 의 첫 절(`,`/`.` 앞)을 라벨로, 근거는 `label`(길/NPC/…). 힌트 `nextStepHint(brief)` 는 `.ai-next-steps-hint` 에 `맵 진단` 배지와 함께.
- [ ] 테스트 갱신 → FAIL → 구현 → PASS → `git commit -m "feat(ai): 추천을 단어 칩에서 실행 문장 행으로"`

### Task 12: 설정·이전 대화·자율 체크리스트 재도장

**Files:** `07-viewer-modal-settings.css`(설정 모달 3단 상자 → 헤어라인 절; `.ai-settings-section` 테두리 제거, 헤더 12px), `aiConversationHistoryModal.ts`(행에 마지막 발화 미리보기 `span.ai-history-preview`, 「열기」→「이어서 열기」 — `ai-history-open` 유지), 19 의 `.ai-autonomous-checklist` 규칙.
- [ ] `npx vitest run test/aiConversationHistoryModal*.test.ts test/aiChatPanelSettings.test.ts` PASS → `git commit -m "style(ai): 설정·이전 대화·계획 체크리스트를 데크 언어로"`

### Task 13: 스튜디오 재도장(P3)

**Files:** `aiStudioShell.ts`(도구 카드 → `.ai-studio-tool-card > (deckIcon(toolIconKey), b 라벨)`, 모드 span 삭제, 묶음 헤더 `짓기 / 사람·이야기 / 보기·검사` 는 `TOOL_LABELS[name].group`), `08-studio-mode-start-screen.css`(타일·상태줄·장면 행), `scripts/capture-ai-studio.mjs`(없으면 `screenshot-ai-assistant.mjs` 12번 컷)
- [ ] `test/aiStudioShell*.test.ts` 갱신(모드 라벨 부재·아이콘 존재) → 구현 → 캡처 → `git commit -m "style(ai): 스튜디오 도구 덱·대화 열을 데크 부품으로"`

### Task 14: 게이트·증거·문서·PR

- [ ] `npm run typecheck:app` 0 · `npm run gates` 새 실패 0(기준선 대비) · e2e 4개.
- [ ] `BASE=… node scripts/capture-ai-assistant-current.mjs`(OUT=after) + `node scripts/analyze-glass-contrast.mjs`(있으면) → `docs/2026-09-03-ai-assistant-modern-ui-assets/after/`.
- [ ] `openwiki/editor-ai-panel.md` 「패널 셸」 절 맨 위에 2026-09-03 데크 항목, `DESIGN.md` 5절 AI 컴포넌트 갱신, `.omo/css-budget-baseline.json` 은 건드리지 않는다.
- [ ] `git push -u origin feat/assistant-ui-modernize` → `gh pr create --base main` (본문: 제안서 링크, before/after 4장, 결정 D1~D6, 삭제·이동 testid, 게이트 결과).
