# 조수 띠 설계 (Assistant Strip)

- 작성일: 2026-08-29
- 브랜치: `ai-chat` (베이스 `b4bc422a`)
- 상태: 감독 승인 — 형태·앵커·솎기·붕괴전략 4건 확정, 접기/내보내기 2건은 작성자 판단 후 승인

## 문제

에디터 안의 AI 조수 패널이 "빈 흰 사각형"으로 렌더된다. 사이드 도크에서 실측
530×1000px 인데 내용은 y≈250 에 두 줄, 컴포저는 y≈850 — 가운데 **약 600px 순백
공백**이다. 유리 도크에서는 픽셀아트 맵 위 `backdrop-filter` 가 초록/분홍/크림
얼룩으로 뭉개지고, 밑에 깔린 맵에 따라 색이 바뀌므로 텍스트 대비가 운에 맡겨진다.
헤더·제목·경계선이 전무해 채팅이라는 것을 판별할 수 없고, 접기 트리거가 없어
패널을 치울 수도 없다.

### 실측으로 확인한 근본 원인

**1. 600px 공백은 3단 인과다. TS 로직은 맞고 CSS 가 틀렸다.**

- `aiChatPanel.ts:479-483` 의 `hideVolatileIfIdle` 은 *의도적으로* 대화가 비었을 때
  휘발 존을 접는다("맵을 가리지 않는다"). 이 동작은 정상이다.
- 그런데 `02-chat-dock.css:275-281` 이 셸을 부모 높이로 강제한다:

  ```css
  .ai-chat-panel.chat-dock-side {
    flex: 1 1 auto;
    height: 100%;
    max-height: none;
  }
  ```

- 접힌 내용 + 강제된 높이 = 그 차이가 공백으로 남는다. **라이징(자람) 개념은 이미
  구현돼 있고, 셸이 내용을 따라가지 않는 것이 결함이다.**

**2. 상태 조합 폭발이 17층 CSS 의 산술적 원인이다.**

`.ai-chat-panel` 에 걸린 상태 클래스는 **13종**이다: `chat-dock-float`,
`chat-dock-glass`, `chat-dock-side`, `is-assistant-idle`, `is-autonomous-run`,
`is-collapsed`, `is-docked`, `is-history-open`, `is-map-first-idle`, `is-studio`,
`is-turn-attention`, `is-turn-error`, `is-turn-running`.

```
도크 3종 × 대기화면 3종 × 스튜디오 2 × 접힘 2 × 기록 2 × 턴 4 = 288칸
```

CSS 가 이 288칸을 커버하려 한 결과가 **22파일 6,137줄**이다.

| 묶음 | 파일 | 줄 |
|---|---|---|
| `tabs-b-assistant-panel/` | 17장 | 4,397 |
| 배럴 `tabs-b-assistant-panel.css` | 1장 | 35 |
| 사이드카 (command-bar 616 · proposal 490 · rising-overlay 292 · composer 274 · dock 33) | 5장 | 1,705 |
| **합** | **22장** | **6,137** |

**3. 캐스케이드 전쟁이 주석으로 자백돼 있다.**

배럴의 `@import` 주석에서 **네 개 레이어가 각자 "내가 마지막이라 이긴다"** 고 주장한다.

| 레이어 | 배럴 주석 |
|---|---|
| `13-assistant-modern` | "after composer so glass/side chrome wins" |
| `14-assistant-ux-repair` | "가장 나중에 불어 기존 도크 규칙을 이긴다" |
| `16-modern-change-first` | "마지막에 불어 09/13/14/15 를 이긴다" |
| `17-assistant-modern-shell` | "앞 레이어의 상충 기하를 이긴다" |

- `16-modern-change-first.css:5` 의 주석 *"이 파일은 tabs-b-assistant-panel.css 의
  마지막 @import 다"* 는 **이미 거짓**이다. 17이 나중에 추가되며 전제가 무효화됐는데
  주석은 고쳐지지 않았다 — "층 추가로 도피" 패턴의 물증이다.
- `09-ux-polish-density.css:231` 에는 `max-height: 420px !important` 가 있다.
  캐스케이드 전쟁의 최종 무기까지 등장했다.
- 13~17 의 파일명이 `-modern` → `-ux-repair` → `-readable` → `-change-first` →
  `-modern-shell` 이다. **연속 5회 재설계 시도, 아무것도 삭제되지 않았다.**

**4. 진입점 13개 + 온도가 영구 비표시다.**

`aiChatPanel.ts:2251` 이 툴바를 `class: "ai-chat-toolbar is-empty"` + `hidden` +
`inert` 로 만들고, `03-three-tier-ia.css:73` 은 `:not(.is-empty)` 를 요구한다. 두
조건이 영구히 상충하므로 아래 13개 + 온도에 **도달 경로가 없다**: 툴 브라우저 ·
하네스 · 스튜디오 · 전체 기록 · 도킹 전환 4종(`ai-dock-toggle` ·
`chat-dock-toggle` · `dockModeButton` · `detachButton`) · 내보내기 · 되돌리기 ·
글자 크기 · 접기 · 새 대화.

**5. "온도" 는 AI 샘플링 온도가 아니라 대기 화면 선택기다.**

`assistantTemperature.ts:3` 기준 `quiet-gold` | `ink-only` | `map-first` 3값이고,
`aiTemperatureMenu.ts:46` 의 라벨이 **"대기 화면"** 이다. 즉 유휴 상태에서 조수가
어떻게 보이는지를 고르는 기능이며, 아래 확정된 단일 유휴 설계와 정면 중복이다.
`aiChatPanel.ts:2494` 는 이 값으로 `is-map-first-idle` 클래스를 토글하므로 온도는
**레이아웃 상태 기계의 입력**이기도 하다.

**6. 죽은 변수.** `--ai-dock-width` 는 정의가 아예 없다. 3곳에서
`var(--ai-dock-width, 520px)` 로 읽으므로 언제나 폴백 520px 이다.

**7. 인코딩 파손.** 배럴 상단 주석과 `09-ux-polish-density.css:85` 의 한글 주석이
cp949/utf-8 혼선으로 깨져 있다 (`AI ?댁떆?ㅽ꽩???⑤꼸`, `蹂묓빀 異붾줎 釉붾줉`).

## 결정

조수를 **우하단에 부유하는 단일 띠(strip)** 로 재정의한다. 유휴 56px, 지시하면
필요한 만큼만 위로 자라며(최대 480px) 캔버스를 덮되 **리사이즈하지 않는다**. 도크
모드 개념과 대기 화면 선택기를 폐기하고, CSS 22파일을 전삭한 뒤 5파일로 다시 쓴다.

### 폐기한 가정

- **"유리(backdrop-filter)가 고급스럽다"** — 픽셀아트 맵 위에서는 얼룩이다. 배경 맵에
  따라 색이 변해 대비를 보장할 수 없다. 불투명 표면 + 그림자로 간다.
- **"모드를 여러 개 주면 사용자가 고른다"** — 도크 3종 × 대기화면 3종을 만든 결과가
  288칸 조합과 17층 CSS 였다. 기본값이 최악(glass)이었고, 유일하게 ☰ 가 살아있던
  모드(float)는 기본값이 아니었다.
- **"헤더를 지우면 단순해진다"** (PR #163) — 헤더 518×73px 을 지웠지만 그 안의 ☰ 를
  대체할 경로를 만들지 않아 기능 13종이 도달 불가가 됐고, 패널을 접을 수도 없게 됐다.
  표면을 줄이는 것과 진입점을 없애는 것은 다른 일이다.
- **"테스트 스위트가 안전망이다"** — 아래 섹션 6 참조. 스위트는 삭제할 것에 집중돼
  있고 남길 것은 거의 테스트되지 않았다.

## 섹션 1 — 상태 기계 (13종 → 5종)

| 남길 상태 | 역할 | 현재 규칙 수 |
|---|---|---|
| `is-risen` | 유휴 56px ↔ 자람(최대 480px). **신설** | — |
| `is-history-open` | 전체 기록 우측 520px 전면 오버레이 | 29곳 |
| `is-turn-running` | 진행 점 + `ai-rail-dot-pulse` 애니메이션 | 1곳 |
| `is-turn-error` | 오류 점 (`--danger`) | 1곳 |
| `is-turn-attention` | 주목 점 (`--success`) | 1곳 |

- `is-assistant-idle`(2곳)·`is-autonomous-run`(1곳)은 `display:none` 하나씩만 걸려
  있다. 전자는 `is-risen` 의 부재로 표현하고, 후자는 컴포넌트 클래스
  (`.ai-autonomous-*`)로 내린다. `11-autonomous-run-surface.css` 211줄의 실체는
  상태 클래스가 아니라 컴포넌트 클래스에 있으므로 상태 기계에서 빠져도 무해하다.
- 삭제하는 상태: `chat-dock-glass`(75곳) · `chat-dock-side`(76곳) ·
  `chat-dock-float`(19곳) · `is-map-first-idle`(22곳) · `is-studio`(41곳) ·
  `is-collapsed`(58곳) · `is-docked`(35곳) = **326곳**.

**살릴 계약은 35곳뿐이다.** "전면 재작성 = 회귀 범위 전역" 이라는 우려의 실체는 이
35곳 + 시각 검증이며, 그래서 전면 재작성을 택할 수 있다.

## 섹션 2 — 레이아웃 3단계

```
① 유휴 (56px, 우하단 부유)
┌──────────────────────────────┐
│ ✦ 무엇을 만들까요      ⑧ [↑] │
└──────────────────────────────┘

② 자람 (내용만큼, 최대 480px)
┌────────────────────── ⌫  ⑧ ┐
│ 나  마을에 대장간 하나       │
│ ┌ 제안 ──────────────┐      │
│ │ 대장간 · 타일 12개  │      │
│ │  [적용]  [미리보기] │      │
│ └────────────────────┘      │
├──────────────────────────────┤
│ 이어서 지시            [↑]  │
└──────────────────────────────┘

③ 기록 오버레이 (⑧ 클릭 → is-history-open, 우측 520px 전면)
```

기하 계약:

| 항목 | 값 | 이유 |
|---|---|---|
| 앵커 | `canvasArea` 기준 우하단, `inset: auto 16px 16px auto` | 우하단은 편집 밀도가 가장 낮은 구역 |
| 폭 | 640px (`min(640px, calc(100vw - 96px))`) | 제안 카드 + 두 버튼이 한 줄에 들어가는 최소폭 |
| 유휴 높이 | 56px | 입력 1줄 + 상하 패딩 |
| 최대 높이 | 480px | 1000px 뷰포트에서 캔버스 절반 이상을 남긴다 |
| 높이 규칙 | `height: auto` + `max-height: 480px` | **`height:100%` 금지** — 이것이 600px 공백의 원인이었다 |
| 표면 | 불투명 배경 + `--shadow-modal` | `backdrop-filter` 전면 금지 |
| reflow | 없음. `canvasArea` 안 `position: absolute` | 캔버스 줌/스크롤이 튀지 않는다 |

내용 계약:

- **휘발 대화는 마지막 한 턴만** — 사용자 지시 1개 + 조수 응답 1개. 그 이전은
  `is-history-open` 오버레이로만 볼 수 있다. `ai-rising-volatile-zone`(현행 `hidden`
  토글 로직 유지)이 이 자리다. 한 턴이 480px 를 넘으면 응답 본문만 내부 스크롤한다.
- **제안 카드는 띠 안 sticky 존에 둔다.** `ai-rising-sticky-zone` 의 기존 주석이
  "맵 위에서 잃지 않는 고정 영역" 이라 명시하고 있고, 띠 자체가 우하단 고정이므로
  이 의도가 그대로 성립한다.
- **되돌리기는 `ai-completion-host` 에 인라인.** 적용 직후 완료 카드에 붙는다.
- **`↑전송` 은 accent 배경 + 흰 글자.** `--text-3` 는 순백 배경에서도 4.75:1 뿐이므로
  주 액션에 쓸 수 없다.
- **첫 문구를 교체한다.** 현행 "길이 없어요. 장소를 만들어 길이 이어지게 해 보세요."
  는 빈 대화 자리에 놓인 진단 경고다. 초대 문구로 바꾼다.
- **칩 행(길 / NPC / 상점 / 상자)은 유휴 56px 에 들어가지 않는다.** 입력 포커스 시
  `is-risen` 과 함께 나타나는 첫 줄에 둔다.

## 섹션 3 — 진입점 (13개 + 온도 → 3개)

| 생존 | 위치 | 현재 테스트 참조 |
|---|---|---|
| 전체 기록 ⑧ | 띠에 상시 (배지 = 미읽음 턴 수) | `ai-chat-history` **0파일** |
| 새 대화 ⌫ | `is-risen` 상태에서만 | `ai-chat-new-session` **0파일** |
| 되돌리기 | 완료 카드 인라인 (`ai-completion-host`) | `ai-undo-last` 2파일 |
| 설정 ⚙ | **이미 상단 헤더에 있다** (`⚙ AI 설정`) — 신설 아님 | `ai-settings-toggle` 7파일 |

삭제: 툴 브라우저 · 하네스 · 스튜디오 · 도킹 전환 4종 · 글자 크기 · 대기화면(온도).
이관: 내보내기 → 기록 오버레이 안의 액션.

**작성자 판단 2건 (감독 승인):**

| 항목 | 판단 | 근거 |
|---|---|---|
| 접기 | **삭제** | 유휴가 56px 이면 접을 이유가 없다. 현행 복귀 알약은 `[14,930,132,48]` 인데 좌측 레일이 0~73px 라 이미 묻혀 `…수` 로 잘려 있다(기존 결함). 부채가 최대다 — `is-collapsed` 58곳 + `ai-collapsed-restore` **27파일** 참조 |
| 내보내기 | **기록 오버레이로 이관** (삭제 아님) | 대화 내보내기는 기록 화면의 자연스러운 액션이다. 띠에 상시 노출할 가치는 없다 |

## 섹션 4 — CSS 소유권 (22파일 → 5파일)

각 파일이 **단일 소유자**다. 같은 속성을 두 파일이 건드리면 안 된다.

| 파일 | 단일 소유 대상 |
|---|---|
| `src/styles/database/assistant/shell.css` | 띠 기하 · 앵커 · 자람 전이 · 표면 · 상태 5종 |
| `src/styles/database/assistant/composer.css` | 입력(1줄 기본 · 자동 성장) · 전송 · 칩 행 |
| `src/styles/database/assistant/rising.css` | 휘발 대화(마지막 한 턴) · sticky 존 · completion host |
| `src/styles/database/assistant/proposal.css` | 제안 카드 |
| `src/styles/database/assistant/history.css` | 기록 오버레이(`is-history-open`) + 내보내기 |

- 목표 **약 1,000줄** (6,137줄의 16%).
- 배럴은 `assistant.css` 하나로 새로 쓰고 `tabs-b.css:6` 의 import 를 갈아끼운다.
  `src/styles/index.css:40` 의 `database/dock.css` import 는 파일과 함께 제거한다.
- **"나중에 불어 이긴다" 주석을 쓰지 않는다.** 순서 의존이 필요하면 그것은 소유권
  경계가 틀렸다는 신호다.
- `--ai-dock-width` 는 정의하거나 없애되, 정의 없는 `var(..., 520px)` 을 남기지 않는다.

## 섹션 5 — 마운트 구조 변경

현행 `editor.ts:190-191`:

```ts
canvasArea.append(canvasScrollShell, mapLockBanner, canvasToolbar, authoringJourney,
                  cursorDiagnostics, chatFloatHost);
layout.append(left, leftResizer, canvasArea, chatSidePanel);
```

- **`chatFloatHost` 는 이미 `canvasArea` 안에 있다.** 우하단 부유 호스트로 그대로 쓴다.
- **`chatSidePanel` 을 `layout` 에서 제거한다.** flex 형제로 붙어 있는 이것이 reflow
  (사이드 도크가 캔버스를 밀어내는 동작)의 원인이다. 제거하면 캔버스 폭이 항상 고정된다.
- `renderAiChatPanel` 의 옵션에서 `getChatDock` · `onChatDockToggle` ·
  `onChatDockChange` · `getAssistantTemperature` · `onAssistantTemperatureChange`
  5개가 불필요해진다. 호출부(`editor.ts:191`)와 함께 정리한다.

## 파일 배치

| 경로 | 조치 |
|---|---|
| `src/styles/database/tabs-b-assistant-panel/` (17장) | **전삭** |
| `src/styles/database/tabs-b-assistant-panel.css` (배럴) | **전삭** |
| `src/styles/database/assistant-command-bar.css` (616) | **전삭** |
| `src/styles/database/assistant-composer.css` (274) | **전삭** |
| `src/styles/database/assistant-proposal.css` (490) | **전삭** |
| `src/styles/database/assistant-rising-overlay.css` (292) | **전삭** |
| `src/styles/database/dock.css` (33) | **전삭** |
| `src/styles/database/assistant/{shell,composer,rising,proposal,history}.css` | **신설** |
| `src/styles/database/assistant.css` (새 배럴) | **신설** |
| `src/styles/database/tabs-b.css:6` | import 교체 |
| `src/styles/index.css:40` | `dock.css` import 제거 |
| `src/editor/panels/aiChatPanel.ts` | 툴바 13개 · 온도 · 도크 분기 제거 |
| `src/editor/panels/aiTemperatureMenu.ts` (55) | **삭제** |
| `src/editor/assistantTemperature.ts` | **삭제** (`editorState.ts` re-export 정리 포함) |
| `src/editor/panels/aiHarnessModal.ts` (254) | **삭제** |
| `src/editor/panels/editor.ts` | `chatSidePanel` 제거 · 옵션 5개 정리 |

## 검증 전략

**이분탐색이 불가한 전면 재작성이므로 게이트는 스크린샷이 담당한다.** 테스트 스위트는
아래 이유로 안전망이 못 된다.

조수 관련 테스트 **34파일 (e2e 16)** 의 참조 분포:

| 참조 | 파일 수 | 성격 |
|---|---|---|
| `ai-collapsed-restore` | **27** | 대부분 `findByTestId(panel, ...)?.click()` — **optional chaining** 이라 요소가 사라지면 조용히 통과한다. 진짜 깨지는 건 존재·이름을 단정하는 `aiPanelChrome.test.ts:157-162` 와 박스를 측정하는 `test/e2e/_assistant-glass-shots.spec.ts:102-103`, 그리고 `assistantSkillsRemoved.test.ts:56` |
| `chat-dock-toggle` | 8 | 모드 개념 소멸 → 삭제 |
| `ai-settings-toggle` | 7 | 생존 (상단 헤더) |
| `ai-temperature` | 5 | 대기화면 소멸 → 삭제 |
| `ai-dock-toggle` | 4 | 삭제 |
| `ai-tools-browser` / `ai-studio-toggle` | 3 / 3 | 삭제 |
| `ai-rising-volatile-zone` / `ai-rising-sticky-zone` | 3 / 3 | 생존 |
| `ai-undo-last` | 2 | 생존 (완료 카드로 이동) |
| `ai-harness` / `ai-font-cycle` / `ai-export` | 1 / 1 / 1 | 앞 둘 삭제, export 는 기록으로 이관 |
| `ai-completion-host` | 1 | 생존 |
| `ai-chat-history` / `ai-chat-new-session` | **0 / 0** | 생존 기능인데 **테스트가 없다** |

**스위트가 삭제할 것에 집중돼 있고 남길 것은 거의 테스트되지 않았다.** 따라서:

1. **스크린샷 게이트 (필수).** 3단계(유휴 / 자람 / 기록) × 맵 배경 2종의 고정 샷.
   기존 `scripts/screenshot-ai-assistant.mjs` 와 `verify-shots/assistant-glass/` 관습을
   따른다. 캔버스가 WebGL 이라 JS 로 픽셀을 못 읽으므로 대비는 PNG 에서 측정한다.
2. **기하 단정 (기계).** 유휴 높이 = 56±2px, 자람 높이 ≤ 480px, **셸 안에 40px 이상
   연속 공백 밴드가 없을 것**(600px 공백의 회귀 방지 신호), 띠 박스가 좌측 레일
   (0~73px) 과 겹치지 않을 것.
3. **대비 측정.** `↑전송` 버튼 ≥ 4.5:1, 본문 ≥ 4.5:1. `backdrop-filter` 사용 0건을
   grep 으로 단정.
4. **테스트 0건 메우기.** `ai-chat-history` · `ai-chat-new-session` 에 각각 도달·동작
   테스트를 추가한다. 이 둘이 생존 목록의 유일한 무보호 항목이다.
5. **기준선 비교로 판정.** 전체 vitest 스위트는 이 저장소에서 기준선부터 대량 실패하고
   수집 개수가 실행마다 튄다. 실패 **수**로 회귀를 판정하지 말고, 기준선 워크트리와
   실패 **집합**을 비교한다.
6. **삭제 검증은 도달 불가로 한다.** 삭제한 상태(도크 3종 · 대기화면 · 스튜디오 ·
   접힘 · 도킹)는 도달 경로가 없으므로 회귀할 표면이 없다. grep 으로 잔여 참조 0건만
   확인한다.

## 열린 발견 (이 브랜치에서 고치지 않음)

1. **`aiChatPanel.ts` 2,957줄.** 형제 `ai*.ts` 26파일 합계 9,969줄. 이번 작업은 CSS
   지층과 진입점·상태 기계에 한정하고, TS 파일 분할은 별건으로 남긴다. 다만 툴바 13개와
   온도·도크 분기 제거로 자연 감소하는 부분은 이번에 걷는다.
2. **인코딩 파손 주석.** 배럴 상단과 `09-ux-polish-density.css:85`. 두 파일 모두 전삭
   대상이라 자연 소멸하지만, 같은 파손이 다른 파일에 있는지는 별도로 훑어야 한다.
3. **`test/e2e/_assistant-glass-shots.spec.ts`** 는 유리 셸 전용 스펙이다. 유리가
   폐기되므로 이 스펙 자체를 새 3단계 게이트로 대체해야 한다. 파일명 앞 `_` 관습
   (수동 실행 스펙)을 유지할지는 구현 시 판단한다.
