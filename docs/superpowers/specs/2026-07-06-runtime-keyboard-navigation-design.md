# 런타임 키보드 내비게이션 통일 (RM2003 마우스리스)

- 날짜: 2026-07-06
- 브랜치(예정): `feat/runtime-keyboard-nav`
- 작성: Claude (Opus) · 검토 예정: 사용자
- 관련: [[rpg-zzu-rm2003-overhaul]], `src/player/runtimeKeyboardMenu.ts`

## 1. 배경 / 문제

RPG 만들기 2003은 키보드만으로 완주하는 게임인데, 이 런타임은 몇몇 화면에서 **마우스 클릭을 강요**한다. 전면 검토(코드 + 9988 라이브) 결과:

| 런타임 화면 | 키보드 | 상태 |
|---|---|---|
| 타이틀(모험시작/이어하기/종료) | ✓ 방향키+Enter | **됨**(라이브 확인, `player.ts:190`) |
| 대사 진행 · 선택지 · 숫자 입력 | ✓ | 됨 |
| 전투(커맨드/대상) | ✓ Z확정/X대상/C취소 + window 폴백 | 됨 |
| 상태·메인 메뉴 · 이름 입력 | ✓ | 됨 |
| **상점(구입/판매/취소·아이템·수량)** | ✗ | **클릭 전용** |
| **여관(예/아니오)** | ✗ | **클릭 전용** |
| **불러오기 세이브 슬롯** | ✗ | **클릭 전용** |
| 게임오버·엔딩 "타이틀로" | ✗ | 클릭 전용(종단) |

### 근본 원인
1. 런타임이 HTML `<button on:click>` 우선으로 만들어졌고, 키보드는 고트래픽 화면에만 뒤늦게 입혀졌다. **상점·여관·불러오기가 키보드화에서 누락**.
2. **키 관례 불일치**: 메뉴는 `e`=확정/`x`=취소, 전투는 `Z`=확정/`X`=대상/`C`=취소. RM2003 표준(Z=결정, X=취소)과도 어긋남.
3. **타이틀 어포던스**: 힌트가 `Enter 선택 Esc 취소`만 있고 `↑↓` 안내가 없어 마우스로 손이 감.

### 검토 중 발견한 잠재 버그 2건
- **B1 — 불러오기 패널이 타이틀을 되살림**: `renderPlayerLoadPanel`이 `data-testid="title-screen"`(+`data-screen="load"`)를 쓴다. `player.ts handleTitleKey`의 가드가 `querySelector("[data-testid='title-screen']")` 라서, 불러오기 화면에서 방향키를 누르면 `renderTitle()`이 호출돼 불러오기 패널이 타이틀로 교체된다.
- **B2 — Escape 이중 처리**: 상점/여관 오버레이가 떠 있을 때 `player.ts onKeyDown`이 계속 동작해서 `Escape`/`x`가 상태 메뉴 토글까지 유발할 수 있다(오버레이는 현재 키를 소비하지 않음).

## 2. 목표 / 비목표

**목표**
- 상점·여관·불러오기·종단 화면을 **방향키 이동 + 확정/취소**로 조작 가능하게 한다.
- 키 관례를 **Z/Enter/Space=확정, X/Esc=취소**로 통일한다(기존 `e`는 하위호환 별칭으로 유지).
- 타이틀 힌트에 `↑↓ 이동`을 추가한다.
- B1, B2를 고친다.
- **마우스는 제거하지 않고 보조로 유지**(클릭/호버는 그대로 동작, 커서와 동기화).

**비목표**
- 전투 입력 재설계(이미 키보드 완성). 단 전투 취소를 `X`로도 받도록 별칭만 추가(선택, §7 오픈 결정).
- 게임패드/터치 재작업(터치패드는 이미 합성 키로 동작).
- 상점 UI 비주얼 변경(직전 작업에서 완료). 이번엔 **입력만**.

## 3. 핵심 설계 통찰

클릭 전용 화면의 버튼들은 **이미 click 핸들러에 모든 액션을 담고 있다**. 따라서 키보드 계층은 액션 로직을 재작성할 필요 없이 **"커서가 가리키는 버튼에 `.click()`을 합성"** 하기만 하면 된다. 이 방식이 회귀 위험이 가장 낮다(기존 마우스 경로를 그대로 재사용).

## 4. 컴포넌트 설계

### 4.1 순수 계층 — `runtimeKeyboardMenu.ts` 확장(유닛 테스트)
기존 순수 함수(`moveTitleSelection`, `reduceStatusMenuKeyboard`)에 추가:

```ts
export const CONFIRM_KEYS: ReadonlySet<string>; // {"z","Z","Enter"," ","e"}(e=레거시)
export const CANCEL_KEYS: ReadonlySet<string>;  // {"x","X","Escape"}
export function isConfirmKey(key: string): boolean;
export function isCancelKey(key: string): boolean;
export function navDirection(key: string): "up" | "down" | "left" | "right" | null;
export function moveCursorIndex(
  index: number, count: number,
  dir: "up" | "down" | "left" | "right",
  opts?: { columns?: number; wrap?: boolean }
): number; // 세로 리스트 기본(columns=1, wrap=true)
```

### 4.2 DOM 계층 — 신규 `runtimeCursorMenu.ts`(fakeDom 테스트)
전투(`battleDom.ts`)의 견고한 리스너 패턴을 재사용: `root.tabIndex=0` + `root` keydown + **window 폴백**(포커스 없어도 동작). 순수 계층으로 판정.

```ts
export type CursorMenuOptions = {
  readonly items: readonly HTMLElement[];       // 순서대로 순회할 버튼들
  readonly cancelEl?: HTMLElement | null;       // X/Esc → 이 버튼 click
  readonly initialIndex?: number;               // 기본 0
  readonly columns?: number;                    // 격자 이동(기본 1=세로)
  readonly wrap?: boolean;                       // 기본 true
  readonly onSelect?: (index: number) => void;  // 커서 이동 시(사이드 패널 갱신 등)
  readonly onHorizontal?: (dir: -1 | 1, index: number) => boolean; // 수량 등, true=소비
};
// root 에 부착. 선택 항목에 .selected + aria-current 부여, scrollIntoView.
// 확정키 → items[index].click(); 취소키 → cancelEl?.click().
// 마우스 mouseenter → 커서 동기화. 반환값은 detach 함수.
export function attachCursorMenu(root: HTMLElement, opts: CursorMenuOptions): () => void;
```

설계 원칙: `attachCursorMenu`는 **click을 합성만** 한다. 어떤 도메인 로직도 몰라도 된다.

**견고성 체크리스트(codex 리뷰 반영)**
- `.click()`은 `isTrusted=false`·포커스 미이동. 선택 버튼에 실제 포커스가 있으면 native Enter click과 **중복 발화** → 처리한 키는 항상 `preventDefault()` + `stopPropagation()`, confirm/cancel은 `event.repeat` 무시, root가 포커스 소유.
- 리스너 정리는 **`AbortController`** 하나로 root+window 동시 해제(detach 누수 차단).
- attach 시 이전 `document.activeElement` 저장 → root focus, detach 시 복구.
- 접근성: 오버레이 `role="dialog"`/`aria-modal`, 선택 항목 `aria-current`, `scrollIntoView({block:"nearest"})`.
- 항목 필터: `disabled`/`hidden`/`disconnected` 제외, 빈 목록이면 cancel만 동작.
- IME `composition` 중 키 무시, `Space` 페이지 스크롤 방지.

## 5. 화면별 배선

- **상점** (`playSceneShop.ts` `renderShop()` 말미): 렌더마다 재부착(이전 detach 호출).
  - 메뉴 뷰: items=`구입/판매/취소` 버튼, cancel=`취소`.
  - 아이템 뷰: items=`shop-*` 아이템 행, cancel=프롬프트의 `취소`(=`showMenu`). `onSelect`로 **보유(owned) 사이드 패널을 선택 아이템 기준으로 갱신**(RM2003 감각). 수량 `select` 모드면 아이템 행에서 `onHorizontal`(`←→`)로 `shop-quantity-input` 값 ±1(min/max clamp). `↑↓`=±10 전용 수량 피커는 별도 서브스텝 필요 → **후속**(현 DOM은 인라인 수량 입력이라 이번엔 ±1만).
  - **커서 복원(codex)**: 렌더 간 커서를 숫자 인덱스가 아니라 **메뉴=action id / 아이템=item id 기준**으로 복원, 없으면 clamp.
- **여관** (`playSceneCommerce.ts` `playInn`): items=`예/아니오`, cancel=`아니오`. `columns:2`(가로).
- **불러오기** (`player.ts renderLoad` 또는 패널 내부): items=`save-slot-*` + `뒤로/닫기`, cancel=`뒤로/닫기`. **B1 수정**: `handleTitleKey`가 `[data-screen]` 있으면(=불러오기) 바로 `return false`.
- **타이틀 힌트** (`titleScreen.ts renderInputHint`): 텍스트를 `↑↓ 이동   Enter 선택   Esc 취소`로. (키 동작은 기존 `handleTitleKey` 유지 + `z` 확정 별칭 추가.)
- **종단 화면** (`playSceneOverlays.ts` 게임오버/엔딩): 단일 `return-title` 버튼에 커서 메뉴 부착 → Enter/Z로 확정.

### 충돌 해결 (B2)
`player.ts onKeyDown`에 모달 가드 추가: `isCommerceOverlayActive()`(= `play-stage`/`play-viewport`에 `shop-scene` 또는 `inn-scene` 존재) 이면 조기 `return`. 커서 메뉴는 자신이 처리한 키에 `preventDefault`.

## 6. 테스트 계획

- **유닛(vitest/fakeDom)**
  - `runtimeKeyboardMenu.test.ts` 확장: `isConfirmKey`/`isCancelKey`/`navDirection`/`moveCursorIndex`(wrap·columns 경계).
  - 신규 `runtimeCursorMenu.test.ts`: fakeDom으로 버튼 3개 생성 → `attachCursorMenu` → keydown(ArrowDown/Up) 디스패치 시 `.selected` 이동, 확정키가 선택 버튼 `click` 발화, 취소키가 `cancelEl` 발화, detach 후 무반응.
- **브라우저 QA(9988, MCP)**: 상점(메뉴↔아이템, 구입/판매/취소, 수량, 사이드 갱신) · 여관(예/아니오) · 불러오기(슬롯/뒤로) · 타이틀 힌트 · 종단 화면 — **전부 마우스 없이** 완주. B1/B2 회귀 확인.
- **게이트**: `tsc --noEmit` 0 · `vite build` OK · 전체 vitest green.

## 7. 오픈 결정 (스펙 검토 때 확정)
- **전투 취소 별칭**: 전투에 `X`=취소를 추가할지(현재 `C`=취소, `X`=대상변경). 관례 통일엔 맞지만 동작 중인 전투를 건드림. **기본안: 손대지 않음**(전투는 이미 키보드 완성, 리스크 회피). 원하면 대상변경을 `←→`로 옮기고 `X`=취소로 통일하는 별도 후속.

## 8. 리스크 / 롤백
- 전역 keydown 충돌: player.ts 모달 가드 + 커서 메뉴 `preventDefault`로 격리. 문제시 커서 메뉴를 capture-phase 단독으로 격상.
- 상점 재렌더마다 재부착: detach 누수 방지(변수 하나로 관리, 렌더 전 detach).
- 롤백 단위: 파일별 커밋(순수 계층 → 헬퍼 → 화면별 배선)로 이등분 추적 용이.

## 9. 비주얼 스펙 (agy 자문 — RM2003 정통)
목업 이미지 2장(상점 / 타이틀+여관)이 레퍼런스. 커서·윈도우스킨·하이라이트 CSS 근사값:

```css
/* ▶ 선택 커서 — 흰 삼각형 + 좌우 바운스 */
.rm2k3-cursor { color:#fff; filter:drop-shadow(1px 1px 0 #061038);
  animation:rmCursorBounce 450ms infinite ease-in-out alternate; }
@keyframes rmCursorBounce { 0%{transform:translateX(0)} 100%{transform:translateX(-4px)} }

/* 청색 윈도우스킨 — 3단 그라디언트 + 다중 테두리(도트감 radius 3px) */
.rm2k3-window { background:linear-gradient(180deg,#356fd4 0%,#123c9a 45%,#071e68 100%);
  opacity:.92; border:2px solid #f5fbff; border-radius:3px;
  box-shadow:0 0 0 2px #061038, inset 1px 1px 0 #7da7ff, inset -1px -1px 0 rgba(0,0,0,.45); }

/* 선택 행 하이라이트 */
.rm2k3-row.selected { background:linear-gradient(180deg,#3a80f0 0%,#1b49b0 100%);
  box-shadow:inset 0 0 0 1px #7fc5ff, inset 0 -1px 0 rgba(3,29,85,.5); color:#fff; }
```

- **힌트 문구**: `[방향키] 이동   [Z/Enter] 결정   [X/Esc] 취소`(원작 톤). RM2003 원작은 힌트 UI가 없었으나 마우스리스 웹에선 필수.
- **상점 키 흐름(agy)**: 구입/판매/취소=`←→`, 아이템=`↑↓`, 확정=`Z/Enter`, 취소=`X/Esc`.
- 후속 참고 관례: `Shift`=대시, `PageUp/Down`=목록 페이징, 필드에서 `X/Esc`=시스템 메뉴 토글(이미 있음).
- 기존 `commerce.css`/`title.css` 비주얼은 직전 작업 결과를 유지하되, 커서/하이라이트만 위 값으로 보강한다(대개편 아님).

## 10. AI 자문 반영 로그 (2026-07-06)
- **agy**(gemini, 이미지): 목업 2장 생성 + 위 §9 CSS·상점 키 흐름. `수량 ←→=±1·↑↓=±10`은 별도 서브스텝이라 후속으로 분리.
- **codex**(gpt-5.5): 2계층+click 합성 승인. 핵심은 **keydown 소비 순서**(→ player.ts 모달 가드). B1(load 패널 title-screen testid) 실증. §4.2 견고성 체크리스트(AbortController·event.repeat·isTrusted 중복·id 기준 복원·focus 저장/복구·aria·IME·Space 스크롤) 전부 반영. 목업 `rm2003-mockup.html`(자기완결) 생성.
- **수렴**: 두 자문 모두 "openEventCommandEditDialog식 최소 변경 + 기존 click 재사용 + 모달 가드"에 동의.
