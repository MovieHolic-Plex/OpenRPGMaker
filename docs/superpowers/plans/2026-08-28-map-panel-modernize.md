# 좌측 '맵' 패널 모던화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좌측 사이드바 `맵` 패널의 CSS 소유권을 13개 파일에서 단일 모던 레이어로 옮기고, 그 과정에서 캐스케이드 분산이 만든 겹침·빈 글리프·토큰 이탈을 구조적으로 제거한다.

**Architecture:** 신규 `src/styles/editor/map-panel.modern.css` 를 `.map-tree-panel` 스코프의 단독 소유자로 세운다. 기존 규칙들은 컨테이너 testid(`[data-testid="left-map-root"]`)나 플라이아웃 호스트(`.basic-flyout-map-host`)로 특이도를 확보하고 있어 신규 레이어(특이도 0,2,0)보다 강하다. 따라서 **"신규 레이어를 만들고 옛 규칙을 하나씩 비우는" 순서**로 진행하며, 각 소스 파일을 비울 때마다 해당 모드가 초록으로 바뀐다. expert/standard 는 Task 3 에서, beginner 는 Task 6 에서 초록이 된다.

**Tech Stack:** TypeScript + Vite, 순수 CSS(전처리기 없음, `@import` 체인), Playwright e2e, Vitest 단위 테스트.

**Spec:** `docs/superpowers/specs/2026-08-28-map-panel-modernize-design.md`

## Global Constraints

- 새 hex 색상 도입 금지. `src/styles/tokens.css` 의 토큰만 소비한다 (`src/styles/TOKENS.md` 참조).
- 모든 기존 `data-testid` 를 유지한다. 신규는 `map-tree-filter-toggle` 하나만 허용.
- 셀렉터에 `[data-testid=...]` 를 특이도 확보용으로 쓰지 않는다. 이것이 이번 작업이 제거하려는 패턴이다.
- 변종 분기는 `.is-basic-flyout` 클래스 하나로만 표현한다.
- `!important` 를 새로 추가하지 않는다.
- ARIA 속성(`role="tree"|"treeitem"|"group"`, `aria-level`, `aria-selected`, `aria-expanded`, `aria-multiselectable`)과 상호작용(키보드 트리 내비게이션, 드래그 재부모화, 박스 선택, Ctrl/Shift 다중선택, 중간클릭 테스트플레이, 더블클릭 리네임/속성, 우클릭 메뉴)은 동작이 바뀌면 안 된다.
- 영속화 키 `oprn:map-tree-collapsed` 와 `--map-tree-height` 리사이저는 건드리지 않는다.
- 작업 디렉터리는 워크트리 `/home/main/z-project/rpg-zzu/.claude/worktrees/map-modernize` 이며, 여기서만 명령을 실행한다.

**타입 검사 명령 (매 태스크 공통):**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

**단위 테스트 명령 (매 태스크 공통):**

```bash
npx vitest run test/mapList.test.ts test/basicLeftRail.test.ts test/editorLayoutPersist.test.ts
```

---

### Task 1: 회귀 그물을 먼저 친다 (실패하는 e2e)

이 태스크의 산출물은 **현재 코드에서 실패하는** e2e 스펙이다. 이후 모든 태스크가 이 스펙을 초록으로 만들어 간다.

**Files:**
- Create: `test/e2e/map-panel-modern.spec.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `test/e2e/map-panel-modern.spec.ts` — 이후 모든 태스크가 이 파일을 게이트로 실행한다. 내부 헬퍼 `bootEditor(page, mode)` 와 `readMapPanel(page)` 를 export 하지 않는다(스펙 로컬).

- [ ] **Step 1: 실패하는 e2e 스펙을 작성한다**

`test/e2e/map-panel-modern.spec.ts` 를 만든다. 전체 내용:

```ts
import { expect, test, type Page } from "@playwright/test";

type Mode = "expert" | "standard" | "beginner";

/** 초보 모드는 맵이 좌측 레일의 플라이아웃으로 뜬다. 나머지는 좌패널에 상주한다. */
const MODES: readonly Mode[] = ["expert", "standard", "beginner"];

async function bootEditor(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript((m) => {
    localStorage.setItem("oprn:editor-ui-mode", m as string);
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  }, mode);
  await page.goto("/?devProject=1&marketTown=1", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  for (const testid of ["editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
  if (mode === "beginner") {
    await page.getByTestId("basic-rail-toggle-maps").click();
  }
  await page.getByTestId("map-tree").waitFor({ state: "visible", timeout: 30_000 });
}

type PanelReading = {
  readonly rows: number;
  readonly maxBadgeOverlapPx: number;
  readonly clippedTexts: number;
};

async function readMapPanel(page: Page): Promise<PanelReading> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="map-tree-node-"]'));
    let maxBadgeOverlapPx = 0;
    let clippedTexts = 0;
    for (const row of rows) {
      const meta = row.querySelector<HTMLElement>(".map-tree-meta");
      const name = row.querySelector<HTMLElement>(".map-tree-name");
      const badge = row.querySelector<HTMLElement>(".start-mark");
      for (const text of [meta, name]) {
        if (text && text.scrollWidth > text.clientWidth + 1) clippedTexts += 1;
      }
      if (meta && badge) {
        const m = meta.getBoundingClientRect();
        const b = badge.getBoundingClientRect();
        const ox = Math.min(m.right, b.right) - Math.max(m.left, b.left);
        const oy = Math.min(m.bottom, b.bottom) - Math.max(m.top, b.top);
        if (ox > 0 && oy > 0) maxBadgeOverlapPx = Math.max(maxBadgeOverlapPx, Math.round(ox));
      }
    }
    return { rows: rows.length, maxBadgeOverlapPx, clippedTexts };
  });
}

for (const mode of MODES) {
  test.describe(`맵 패널 — ${mode}`, () => {
    test("행에서 '시작' 배지가 메타 텍스트를 덮지 않는다", async ({ page }) => {
      await bootEditor(page, mode);
      const reading = await readMapPanel(page);
      expect(reading.rows).toBeGreaterThan(0);
      expect(reading.maxBadgeOverlapPx).toBe(0);
    });

    test("이름과 메타가 자기 칸 안에서 말줄임된다", async ({ page }) => {
      await bootEditor(page, mode);
      const reading = await readMapPanel(page);
      expect(reading.clippedTexts).toBe(0);
    });

    test("기존 testid 가 모두 살아 있다", async ({ page }) => {
      await bootEditor(page, mode);
      for (const testid of ["map-tree", "map-tree-list", "map-tree-filter",
        "map-tree-facet-all", "map-tree-facet-empty", "map-tree-facet-nolink",
        "map-tree-facet-encounter"]) {
        await expect(page.getByTestId(testid)).toHaveCount(1);
      }
    });
  });
}

test.describe("맵 패널 헤더 — expert", () => {
  const HEADER_BUTTONS = ["map-add", "map-add-folder", "map-set-start", "map-toggle-all"] as const;

  test("헤더 버튼 4개가 모두 보이는 글리프를 가진다", async ({ page }) => {
    await bootEditor(page, "expert");
    for (const testid of HEADER_BUTTONS) {
      const button = page.getByTestId(testid);
      await expect(button).toBeVisible();
      // 글리프는 `.rm-tool-icon` 의 ::before/::after CSS 도형이다. 정의가 없으면 0px 다.
      const painted = await button.evaluate((el) => {
        const glyph = el.querySelector(".rm-tool-icon") ?? el;
        for (const pseudo of ["::before", "::after"]) {
          const cs = getComputedStyle(glyph, pseudo);
          if (cs.content !== "none" && parseFloat(cs.width) > 0 && parseFloat(cs.height) > 0) return true;
        }
        return false;
      });
      expect(painted, `${testid} 의 글리프가 그려지지 않았다`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 실행해서 실패를 확인한다**

Run:
```bash
npx playwright test test/e2e/map-panel-modern.spec.ts --reporter=line
```

Expected: 다음 두 항목이 **FAIL** 해야 한다.
- `맵 패널 — beginner › 행에서 '시작' 배지가 메타 텍스트를 덮지 않는다` → `Expected: 0  Received: 28`
- `맵 패널 헤더 — expert › 헤더 버튼 4개가 모두 보이는 글리프를 가진다` → `map-toggle-all 의 글리프가 그려지지 않았다`

나머지는 통과해도 된다. **위 두 개가 통과하면 스펙이 잘못 쓰인 것이니 멈추고 원인을 찾는다.**

- [ ] **Step 3: 커밋**

```bash
git add test/e2e/map-panel-modern.spec.ts
git commit -m "test(map): 맵 패널 겹침·빈 글리프를 잡는 회귀 그물을 먼저 친다"
```

---

### Task 2: 빠진 아이콘 글리프를 정의한다

`mapList.ts:634` 가 `oprn-icon-tree-open` / `oprn-icon-tree-closed` 를 요구하지만 `src/styles/` 어디에도 정의가 없어 헤더 4번째 버튼이 빈칸이다. 또 `folder` 는 리소스 매니저 전용 시트에서 빌려 쓰고 있다.

**Files:**
- Modify: `src/styles/components/icons.css`
- Test: `test/e2e/map-panel-modern.spec.ts` (Task 1 에서 작성됨, 수정 없음)

**Interfaces:**
- Consumes: Task 1 의 `map-panel-modern.spec.ts`
- Produces: CSS 클래스 `.oprn-icon-tree-open`, `.oprn-icon-tree-closed`, `.oprn-icon-map-folder` — Task 8 의 헤더 작업이 `map-folder` 를 사용한다.

- [ ] **Step 1: 기존 글리프 작성 관례를 읽는다**

Run:
```bash
sed -n '1,40p' src/styles/components/icons.css
```

`oprn-icon-map-child` / `oprn-icon-map-start` 가 `::before` / `::after` 에 `content:""` + `position:absolute` + 배경·보더로 도형을 그리는 방식을 확인한다. 새 글리프도 같은 방식으로 쓴다. 이모지·폰트 아이콘을 도입하지 않는다.

- [ ] **Step 2: 글리프 3개를 추가한다**

`src/styles/components/icons.css` 끝에 추가한다. 값은 기존 글리프와 같은 좌표계(부모 `.rm-tool-icon` 이 `position:relative`, 14×14 기준)를 쓴다.

```css
/* 맵 트리 헤더 — 전체 펼치기/접기. mapList.ts 가 요구하지만 정의가 없어 빈 버튼이었다. */
.oprn-icon-tree-open::before,
.oprn-icon-tree-closed::before {
  border-left: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  content: "";
  height: 8px;
  left: 3px;
  position: absolute;
  top: 2px;
  width: 5px;
}

/* 펼침 = 아래를 향한 갈매기, 접힘 = 오른쪽을 향한 갈매기. */
.oprn-icon-tree-open::after,
.oprn-icon-tree-closed::after {
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  content: "";
  height: 5px;
  position: absolute;
  right: 2px;
  top: 3px;
  width: 5px;
}

.oprn-icon-tree-open::after { transform: rotate(45deg); }
.oprn-icon-tree-closed::after { transform: rotate(-45deg); }

/* 맵 분류 폴더. 지금까지 리소스 매니저 전용 시트(map/resource-system.part-2.css)의
   .oprn-icon-folder 를 빌려 썼다 — 그 정의는 리소스 매니저가 계속 쓰므로 남기고,
   맵 쪽 의존만 여기로 끊는다. */
.oprn-icon-map-folder::before {
  border: 1px solid currentColor;
  border-radius: 1px;
  content: "";
  height: 8px;
  left: 1px;
  position: absolute;
  top: 4px;
  width: 12px;
}

.oprn-icon-map-folder::after {
  background: currentColor;
  content: "";
  height: 2px;
  left: 1px;
  position: absolute;
  top: 2px;
  width: 5px;
}
```

- [ ] **Step 3: 글리프 테스트가 통과하는지 확인한다**

Run:
```bash
npx playwright test test/e2e/map-panel-modern.spec.ts --reporter=line -g "헤더 버튼 4개"
```

Expected: PASS. (`map-add-folder` 는 아직 `folder` 를 쓰지만 그 정의는 존재하므로 통과한다. `map-toggle-all` 이 이 태스크로 고쳐진다.)

- [ ] **Step 4: 커밋**

```bash
git add src/styles/components/icons.css
git commit -m "fix(map): 정의가 없어 빈칸이던 트리 접기 글리프를 만든다"
```

---

### Task 3: 모던 레이어를 세우고 주 소유자 파일을 비운다

`10-map-tree.css` 의 맵 규칙을 신규 레이어로 옮기면서 S2(행 그리드 계약)와 S5(선택 행)를 적용한다. 이 태스크가 끝나면 expert/standard 모드가 초록이 된다.

**주의:** `10-map-tree.css` 는 맵 전용 파일이 **아니다**. 팔레트(`left-palette-root`)와 캔버스 셸 규칙도 들어 있다. 파일을 지우지 말고 맵 규칙만 걷어낸다.

**Files:**
- Create: `src/styles/editor/map-panel.modern.css`
- Modify: `src/styles/index.css` (65행 `@import "./editor/map-props.css";` 직후에 한 줄 추가)
- Modify: `src/styles/shell/figma-editor/10-map-tree.css` (맵 규칙 제거)
- Test: `test/e2e/map-panel-modern.spec.ts`

**Interfaces:**
- Consumes: Task 1 의 e2e 스펙
- Produces: `src/styles/editor/map-panel.modern.css` — Task 4~9 가 이 파일에 규칙을 계속 추가한다. 공개 커스텀 프로퍼티 3개: `--map-row-toggle`, `--map-row-handle`, `--map-row-thumb` (`.map-tree-panel` 에 선언, `.is-basic-flyout` 에서 재정의).

- [ ] **Step 1: 옮길 범위를 확인한다**

Run:
```bash
grep -n "left-map-root\|map-tree\|map-item\|start-mark\|map-parent-sel\|map-lock-badge" src/styles/shell/figma-editor/10-map-tree.css
```

맵 규칙은 1~260행, `@container (max-width: 220px)` 블록(262~299행) 안의 맵 부분, 그리고 345~352행 `.map-tree-marquee` 다.
팔레트/캔버스 규칙은 `@container` 안의 263~277행과 301~343행이며 **남긴다**.

- [ ] **Step 2: 모던 레이어를 만든다**

`src/styles/editor/map-panel.modern.css` 를 새로 만든다. `10-map-tree.css` 에서 옮겨온 규칙은 셀렉터 접두사를 `.left-panel-stack[data-testid="left-map-root"]` → `.map-tree-panel` 로 바꿔 쓴다. 값은 그대로 옮기되, 아래 표시된 규칙만 설계대로 바꾼다.

```css
/* ============================================================================
   맵 패널 모던 레이어 (2026-08) — `.map-tree-panel` 서브트리의 단독 소유자.

   왜 이 파일이 생겼나: 맵 패널 스타일이 13개 파일에 흩어져 있었고, 각자
   `.left-panel-stack[data-testid="left-map-root"]` 라는 컨테이너 testid 로 특이도를
   확보했다. 그 결과 패널이 두 번째 컨테이너(초보 모드 플라이아웃)에 렌더될 때
   규칙이 조용히 사라졌다 — `.map-tree-copy` 의 flex 선언이 도달하지 못해 메타
   span 이 inline 으로 남았고, overflow:hidden 이 무효가 되어 '시작' 배지를 28px
   침범했다(실측).

   그래서 스코프는 `.map-tree-panel` 이다. 이 클래스는 전문가 패널과 초보
   플라이아웃 양쪽에 모두 있다. 변종 차이는 `.is-basic-flyout` 하나로만 낸다.
   셀렉터에 `[data-testid=...]` 를 특이도 목적으로 쓰지 않는다.

   NOTE(로드 순서): index.css 에서 map-props.css 직후에 import 된다.
   ========================================================================= */

/* ── 행 치수 토큰 — 변종 차이는 전부 여기로 흡수한다 ─────────────────────── */

.map-tree-panel {
  --map-row-toggle: 14px;
  --map-row-handle: 10px;
  --map-row-thumb: 44px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
}

.map-tree-panel.is-basic-flyout {
  --map-row-toggle: 22px;
  --map-row-handle: 12px;
}

/* ── 행 그리드 계약 ────────────────────────────────────────────────────────
   `.map-tree-copy` 를 grid 로 두는 것이 핵심이다. block 이면 자식 span 이 inline
   이라 overflow:hidden 이 무효고, 이름·메타가 칸을 뚫고 나가 배지를 덮는다. */

.map-tree-panel .map-item {
  align-items: center;
  box-sizing: border-box;
  display: grid;
  gap: 4px;
  grid-template-columns:
    var(--map-row-toggle) var(--map-row-handle) var(--map-row-thumb)
    minmax(0, 1fr) auto auto;
  max-width: 100%;
  min-height: 30px;
  min-width: 0;
  padding: 0 4px;
  width: 100%;
}

.map-tree-panel .map-tree-copy {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.map-tree-panel .map-tree-name,
.map-tree-panel .map-tree-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-tree-panel .map-tree-name {
  font: 800 12px/1.2 var(--font-ui);
}

.map-tree-panel .map-tree-meta {
  color: var(--text-3);
  font: 600 10px/1.2 var(--font-ui);
}

.map-tree-panel .map-tree-meta.is-unlinked {
  color: var(--warning);
}

/* ── 선택 행 — TOKENS.md 규정대로 연한 배경 + 좌측 레일 ────────────────────
   옛 규칙은 `background: var(--accent)` 채도 100% 슬래브였고, 그 위를 읽히게
   하려고 메타 색을 color-mix(#fff 80%, #4A57D6) 로 하드코딩했다. 둘 다 없앤다. */

.map-tree-panel .map-item:hover {
  background: var(--bg-hover);
}

.map-tree-panel .map-item.active {
  background: var(--accent-muted);
  box-shadow: inset 2px 0 0 var(--accent);
  color: var(--text-1);
}

.map-tree-panel .map-item.active .map-tree-meta {
  color: var(--text-3);
}

.map-tree-panel .map-item.is-multi-selected {
  background: color-mix(in srgb, var(--accent-muted) 50%, transparent);
}

/* ── 드롭 표시 ────────────────────────────────────────────────────────────── */

.map-tree-panel .map-item.drop-before { box-shadow: inset 0 2px 0 var(--accent); }
.map-tree-panel .map-item.drop-after { box-shadow: inset 0 -2px 0 var(--accent); }

.map-tree-panel .map-item.drop-child {
  outline: 1px dashed var(--accent);
  outline-offset: -2px;
}

/* `markDropTarget` 이 붙이는 클래스. 옛 정의는 shell-density.part-2.css 에 있었다. */
.map-tree-panel .map-item.drop-target {
  background: var(--accent-muted);
  outline: 1px dotted var(--accent);
  outline-offset: -2px;
}

.map-tree-panel .map-item.dragging { opacity: 0.65; }

.map-tree-panel .map-item.map-node {
  margin-left: calc(var(--map-depth, 1) * 14px);
  width: calc(100% - var(--map-depth, 1) * 14px);
}

/* ── 시작 배지 ────────────────────────────────────────────────────────────── */

.map-tree-panel .start-mark {
  background: var(--accent-muted);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  color: var(--accent);
  font: 700 10px/1 var(--font-ui);
  padding: 3px 6px;
  white-space: nowrap;
  width: auto;
}

/* ── 토글 · 드래그 핸들 · 아이콘 ──────────────────────────────────────────── */

.map-tree-panel .map-tree-toggle {
  align-items: center;
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-2);
  cursor: pointer;
  display: inline-flex;
  height: 22px;
  justify-content: center;
  width: var(--map-row-toggle);
}

.map-tree-panel .map-tree-icon {
  color: var(--text-3);
  font-size: 14px;
  text-align: center;
  width: 18px;
}

.map-tree-panel .map-tree-drag-handle {
  align-self: center;
  background:
    radial-gradient(circle, currentColor 1px, transparent 1.4px) 1px 2px / 4px 4px repeat;
  color: var(--text-3);
  cursor: grab;
  height: 14px;
  opacity: 0.45;
  width: var(--map-row-handle);
}

.map-tree-panel .map-tree-drag-handle.is-disabled {
  cursor: default;
  opacity: 0;
  pointer-events: none;
}

.map-tree-panel .map-item:hover .map-tree-drag-handle:not(.is-disabled),
.map-tree-panel .map-item:focus-within .map-tree-drag-handle:not(.is-disabled) {
  opacity: 0.9;
}

.map-tree-panel .map-tree-drag-handle:active { cursor: grabbing; }

/* NOTE: `.map-lock-badge` / `.map-parent-sel` / `.map-tree-wide-action` 규칙은 옮기지
   않는다. `grep -rn "map-lock-badge\|map-parent-sel\|map-tree-wide-action" src/editor/`
   가 0건 — 렌더러가 만들지 않는 요소를 스타일링하던 죽은 규칙이다. */

/* ── 헤더 · 필터 · 액션 ────────────────────────────────────────────────────── */

.map-tree-panel .map-tree-header {
  align-items: center;
  display: flex;
  gap: 6px;
  margin: 0 0 6px;
  max-width: 100%;
  min-width: 0;
}

.map-tree-panel .map-tree-header h3 {
  flex: 1 1 auto;
  font: 800 13px/1.2 var(--font-ui);
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-tree-panel .map-tree-header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
  min-width: 0;
}

/* 버튼 리셋 전체를 여기 둔다. 예전에는 shell-density.part-2.css 가 appearance·flex
   정렬·transition 을 대주었는데, 그 파일을 비우는 Task 4 에서 함께 사라지면 버튼이
   깨진다. 소유자가 하나면 리셋도 소유자가 갖는다. */
.map-tree-panel .map-tree-action {
  align-items: center;
  appearance: none;
  background: var(--control-bg);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-s);
  box-shadow: none;
  color: var(--text-2);
  cursor: pointer;
  display: inline-flex;
  height: 20px;
  justify-content: center;
  padding: 0;
  transition: background var(--transition-fast), border-color var(--transition-fast);
  width: 20px;
}

.map-tree-panel .map-tree-action:hover { background: var(--control-bg-hover); }
.map-tree-panel .map-tree-action:active:not(:disabled) { background: var(--control-bg-active); }
.map-tree-panel .map-tree-action:focus-visible { outline: var(--focus-outline); }
.map-tree-panel .map-tree-action:disabled {
  cursor: default;
  filter: grayscale(0.75);
  opacity: 0.35;
}

/* 헤더 액션은 툴 레일과 같은 28px 히트 영역을 쓴다(설계 S3). 행 안의 ⋮ 는 아래에서
   더 작게 되돌린다 — 행은 밀도가 우선이다. */
.map-tree-panel .map-tree-header-actions .map-tree-action {
  height: 28px;
  width: 28px;
}

.map-tree-panel .map-item .map-tree-action {
  background: transparent;
  border-color: transparent;
  opacity: 0.55;
}

.map-tree-panel .map-item:hover .map-tree-action,
.map-tree-panel .map-item:focus-within .map-tree-action,
.map-tree-panel .map-tree-action:focus-visible {
  background: var(--bg-inset);
  border-color: var(--border-default);
  opacity: 1;
}

.map-tree-panel .map-tree-filter {
  display: block;
  margin: 0 0 8px;
  min-width: 0;
  width: 100%;
}

.map-tree-panel .map-tree-filter-label { display: none; }

.map-tree-panel .map-tree-filter-input,
.map-tree-panel .map-tree-rename {
  background: var(--bg-inset);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-s);
  color: var(--text-1);
  font: 600 12px/1.2 var(--font-ui);
  min-width: 0;
  padding: 4px 6px;
  width: 100%;
}

.map-tree-panel .map-tree-filter-facets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

/* 두 변종 모두 pill 이다. 초보 변종이 각진 사각형이던 것을 통일한다. */
.map-tree-panel .map-tree-facet {
  background: var(--control-bg);
  border: 1px solid var(--border-default);
  border-radius: 999px;
  color: var(--text-3);
  cursor: pointer;
  font: 700 10px/1 var(--font-ui);
  height: 22px;
  padding: 0 8px;
}

.map-tree-panel .map-tree-facet.is-active {
  background: var(--accent-muted);
  border-color: var(--accent-border);
  color: var(--text-1);
}

/* ── 좁은 패널(컨테이너 쿼리) ─────────────────────────────────────────────── */

@container (max-width: 220px) {
  .map-tree-panel { --map-row-toggle: 10px; --map-row-handle: 10px; }
  .map-tree-panel .map-tree-header { gap: 4px; }
  .map-tree-panel .map-tree-action-text { display: none; }
}

/* ── 박스 선택 마키 ────────────────────────────────────────────────────────
   document.body 에 붙는다(mapList.ts:1118). 패널 서브트리 밖이라 전역 규칙이다. */

.map-tree-marquee {
  background: var(--accent-muted);
  border: 1px solid var(--accent);
  pointer-events: none;
  position: fixed;
  z-index: 80;
}
```

- [ ] **Step 3: index.css 에 import 를 추가한다**

`src/styles/index.css` 의 `@import "./editor/map-props.css";` 바로 다음 줄에 넣는다.

```css
@import "./editor/map-panel.modern.css";
```

- [ ] **Step 4: `10-map-tree.css` 에서 맵 규칙을 제거한다**

파일에서 다음만 남기고 맵 관련 규칙을 전부 지운다:
- `@container (max-width: 220px)` 블록 안의 `left-palette-root` 규칙 3개 (`.oprn-tile-toolbar`, `.selected-tile-status .selected-tile-tileset`, `.palette-work-tab`)
- `left-palette-root` 의 `.tile-inspector-action-icon`, `.tile-inspector-action-label`, `.brush-control`, `.brush-control-label`, `.brush-size-btn`
- `.editor-canvas-scroll-shell` 및 `.persistence-mode-banner ~ …` 규칙

파일 선두에 주석을 남긴다:

```css
/* 맵 트리 규칙은 editor/map-panel.modern.css 로 이관됐다(2026-08). 파일 이름은
   figma-editor.css 의 @import 순서를 유지하려고 그대로 둔다 — 여기 남은 것은
   팔레트와 캔버스 셸 규칙이다. */
```

- [ ] **Step 5: 소스 파일이 더 이상 맵을 소유하지 않는지 검증한다**

Run:
```bash
grep -c "map-tree\|map-item\|start-mark\|map-parent-sel\|map-lock-badge" src/styles/shell/figma-editor/10-map-tree.css
```

Expected: `0`

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: 에러 없음.

- [ ] **Step 6: e2e 를 돌려 expert/standard 가 초록인지 확인한다**

Run:
```bash
npx playwright test test/e2e/map-panel-modern.spec.ts --reporter=line
```

Expected: `expert`, `standard` 그룹 전부 PASS. `beginner` 의 겹침 테스트는 **아직 FAIL 이어도 된다** — 플라이아웃 규칙(`.basic-flyout-map-host …`, 특이도 0,3,0)이 신규 레이어(0,2,0)를 아직 이기고 있기 때문이다. Task 6 에서 초록이 된다.

- [ ] **Step 7: 캡처 스크립트가 출력 폴더를 인자로 받게 한다**

기본값이 `baseline` 이면 커밋된 기준선을 덮어쓴다. `scripts/_map-panel-baseline.mts` 의 `OUT` 선언을 바꾼다.

```ts
const OUT = join(process.cwd(), "verify-shots", "map-modernize", process.argv[2] ?? "scratch");
```

`scratch/` 는 커밋하지 않는다. `.gitignore` 에 한 줄 추가한다.

```
verify-shots/map-modernize/scratch/
```

- [ ] **Step 8: 시각 회귀를 눈으로 확인한다**

Run:
```bash
npx tsx scripts/_map-panel-baseline.mts scratch
```

`verify-shots/map-modernize/scratch/expert-left-panel.png` 를 열어 다음을 확인한다:
- 선택 행이 채도 100% 슬래브가 아니라 연한 인디고 배경 + 좌측 2px 레일이다
- 이름·메타가 잘리지 않고, '시작' 배지와 겹치지 않는다
- 헤더 버튼 4개가 모두 글리프를 가진다

`verify-shots/map-modernize/baseline/expert-left-panel.png` 와 나란히 놓고 대조한다.

- [ ] **Step 9: 커밋**

```bash
git add src/styles/editor/map-panel.modern.css src/styles/index.css src/styles/shell/figma-editor/10-map-tree.css scripts/_map-panel-baseline.mts .gitignore
git commit -m "feat(map): 맵 패널의 단일 소유자 레이어를 세우고 행 그리드 계약을 못박는다"
```

---

### Task 4: `shell-density.part-2.css` 의 맵 규칙을 걷어낸다

**Files:**
- Modify: `src/styles/shell/shell-density.part-2.css` (24~222행 사이의 맵 규칙만 제거. `.map-context-menu` 이하는 유지)
- Test: `test/e2e/map-panel-modern.spec.ts`

**Interfaces:**
- Consumes: Task 3 의 `map-panel.modern.css` 와 그 토큰 3개
- Produces: 없음 (제거 태스크)

- [ ] **Step 1: 옮길 선언을 뽑는다**

Run:
```bash
grep -n "map-tree\|map-item\|start-mark\|map-parent-sel\|map-lock-badge" src/styles/shell/shell-density.part-2.css
```

판정 규칙은 하나다: **Task 3 의 모던 레이어가 이미 그 속성을 정하고 있으면 버린다** (모던 레이어 값이 설계 값이다). 없는 속성만 `.map-tree-panel` 스코프로 옮긴다.

이 파일을 미리 읽고 확인한 결과, **옮길 것이 남아 있지 않다.** 근거:

| 이 파일의 규칙 | 처리 | 왜 |
|---|---|---|
| `.map-item` (grid-template-columns `14px 10px 14px …`) | 버림 | 썸네일 칸을 14px 로 잡는 네 번째 경쟁 정의. Task 3 의 `--map-row-thumb: 44px` 계약이 대체 |
| `.map-item` 의 `padding-*: 1px !important` | 버림 | Global Constraints 상 새 `!important` 금지, Task 3 이 `padding: 0 4px` 로 정함 |
| `.map-item:hover`, `.map-item.active` | 버림 | Task 3 이 토큰으로 정의 |
| `.map-tree-name` | 버림 | Task 3 의 말줄임 규칙이 대체 |
| `.map-item.drop-target` | 버림 | Task 3 에 이미 넣었다 |
| `.map-tree-action` 및 hover/focus/active/disabled | 버림 | Task 3 이 리셋 전체를 가져갔다 |
| `.map-lock-badge`, `.map-parent-sel` | 버림 | 렌더러가 만들지 않는 죽은 요소 |
| `.del` | 버림 | 죽은 요소 |
| `.btn, .map-tree-wide-action` | 버림 | 죽은 요소 |

**함정:** 같은 파일의 `.map-context-menu` 이하 규칙은 **건드리지 않는다**. 컨텍스트 메뉴는 `document.body` 에 붙는 팝업이라 `.map-tree-panel` 서브트리 밖이며, 이번 이관 대상이 아니다. grep 패턴에 `map-context` 를 넣지 마라.

- [ ] **Step 2: 소스에서 맵 규칙을 지운다**

`src/styles/shell/shell-density.part-2.css` 에서 Step 1 표의 규칙 블록을 전부 삭제한다. `left-palette-root` 규칙과 `.map-context-menu` 이하는 그대로 둔다.

- [ ] **Step 3: 검증**

Run:
```bash
grep -c "map-tree\|map-item\|start-mark\|map-parent-sel\|map-lock-badge" src/styles/shell/shell-density.part-2.css
```

Expected: `0`

Run:
```bash
npx playwright test test/e2e/map-panel-modern.spec.ts --reporter=line -g "expert|standard"
```

Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/styles/shell/shell-density.part-2.css
git commit -m "refactor(map): 밀도 시트가 들고 있던 네 번째 그리드 정의를 걷어낸다"
```

---

### Task 5: 반응형 두 파일의 맵 규칙을 걷어낸다

`responsive-a.css` 와 `editor-responsive-expert.css` 는 각각 `.map-item` 의 `grid-template-columns` 를 **서로 다른 값으로** 재정의하고 있다. Task 3 의 계약과 셋이 경쟁 중이다.

**Files:**
- Modify: `src/styles/editor/responsive-a.css`
- Modify: `src/styles/shell/editor-responsive-expert.css`
- Modify: `src/styles/editor/map-panel.modern.css`
- Test: `test/e2e/map-panel-modern.spec.ts`

**Interfaces:**
- Consumes: Task 3 의 `--map-row-toggle` / `--map-row-handle` / `--map-row-thumb`
- Produces: 없음 (제거 태스크)

- [ ] **Step 1: 경쟁하는 그리드 정의 3개를 확인한다**

Run:
```bash
grep -rn "grid-template-columns" src/styles/editor/responsive-a.css src/styles/shell/editor-responsive-expert.css src/styles/editor/map-panel.modern.css
```

셋이 다른 값이라는 것을 눈으로 확인한다. 좁은 폭 대응은 **그리드 열 재정의가 아니라 토큰 재정의**로 바꾼다.

- [ ] **Step 2: 모던 레이어에 반응형 규칙을 토큰으로 다시 쓴다**

`map-panel.modern.css` 의 `@container` 블록 아래에 추가한다.

```css
/* 좁은 뷰포트: 열 구조를 바꾸지 않고 치수 토큰만 줄인다. 예전에는 네 파일이
   grid-template-columns 를 각자 다른 값으로 재정의해 서로를 덮어썼다.
   옛 규칙은 여기서 `.map-parent-sel`·`.map-lock-badge`·비-컨텍스트 액션도 숨겼는데,
   셋 다 렌더러가 만들지 않는 죽은 요소라 옮기지 않는다(행이 만드는 버튼은
   `.map-context-trigger` 하나뿐이다). */
@media (max-width: 1280px) {
  .map-tree-panel { --map-row-toggle: 10px; }
}
```

- [ ] **Step 3: 두 소스에서 맵 규칙을 지운다**

`src/styles/editor/responsive-a.css` — `map-tree` / `map-item` / `start-mark` / `map-parent-sel` / `map-lock-badge` 를 언급하는 규칙 블록 전부 삭제. `@media` 블록이 비면 블록째 삭제한다.

`src/styles/shell/editor-responsive-expert.css` — 같은 기준으로 삭제. 34~41행의 `.map-item .map-tree-name`(전역 셀렉터)도 삭제한다 — Task 3 이 `.map-tree-panel .map-tree-name` 으로 대체했다.

- [ ] **Step 4: 검증**

Run:
```bash
grep -c "map-tree\|map-item\|start-mark\|map-parent-sel\|map-lock-badge" src/styles/editor/responsive-a.css
```
Expected: `0`

Run:
```bash
grep -c "map-tree\|map-item\|start-mark\|map-parent-sel\|map-lock-badge" src/styles/shell/editor-responsive-expert.css
```
Expected: `0`

Run:
```bash
npx playwright test test/e2e/map-panel-modern.spec.ts --reporter=line -g "expert|standard"
```
Expected: PASS.

- [ ] **Step 5: 좁은 폭에서 눈으로 확인한다**

`scripts/_map-panel-baseline.mts` 의 `viewport` 를 임시로 `{ width: 1180, height: 900 }` 으로 바꿔 캡처하고, 이름이 0으로 붕괴하지 않는지 본다. 확인 후 뷰포트를 1440 으로 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/styles/editor/responsive-a.css src/styles/shell/editor-responsive-expert.css src/styles/editor/map-panel.modern.css
git commit -m "refactor(map): 경쟁하던 반응형 그리드 재정의 3개를 치수 토큰 하나로 합친다"
```

---

### Task 6: 초보 플라이아웃 규칙을 걷어낸다 — beginner 초록

`editor-ui-modes.css` 736~938행과 `map-props.css` 441~457행이 `.basic-flyout-map-host` 스코프(특이도 0,3,0)로 모던 레이어를 이기고 있다. 이걸 비우면 beginner 의 28px 겹침이 사라진다.

**Files:**
- Modify: `src/styles/shell/editor-ui-modes.css:736-938`
- Modify: `src/styles/editor/map-props.css:441-457`
- Modify: `src/styles/editor/map-panel.modern.css`
- Test: `test/e2e/map-panel-modern.spec.ts`

**Interfaces:**
- Consumes: Task 3 의 `.is-basic-flyout` 변종 토큰
- Produces: 없음 (제거 태스크)

- [ ] **Step 1: 플라이아웃 고유 규칙을 식별한다**

Run:
```bash
sed -n '736,938p' src/styles/shell/editor-ui-modes.css
```

이 중 **플라이아웃 고유**인 것만 모던 레이어의 `.is-basic-flyout` 절로 옮긴다. 고유한 것은 다음뿐이다:
- `.map-tree-header-basic`, `.map-tree-basic-meta`, `.map-tree-basic-count`, `.map-tree-basic-hint`, `.map-tree-basic-add` — 초보 전용 헤더(마크업이 다르다)
- `.map-tree-more` — 초보 전용 `⋯` 버튼
- `.map-tree-add-child-quick` — 초보 전용 `+` 버튼
- 행 높이·패딩 등 밀도 차이

나머지(`.map-tree-name`, `.map-tree-icon`, `.map-tree-drag-handle`, `.map-tree-toggle`, `.start-mark`, `.map-item.active`, `.drop-target`, `.dragging`)는 **모던 레이어가 이미 정의했으므로 옮기지 않고 버린다.**

- [ ] **Step 2: 모던 레이어에 플라이아웃 절을 추가한다**

`map-panel.modern.css` 끝에 추가한다. 값은 Step 1 에서 읽은 원본을 따르되 하드코딩 색은 토큰으로 바꾼다.

```css
/* ── 초보 플라이아웃 전용 ──────────────────────────────────────────────────
   여기 있는 것은 마크업이 실제로 다른 것뿐이다(초보 전용 헤더 · ⋯ · + 버튼).
   이름·아이콘·핸들·토글·배지·선택 상태는 위 공용 규칙이 그대로 적용된다 —
   예전에 이것들을 플라이아웃용으로 다시 쓴 탓에 값이 갈라졌다. */

.map-tree-panel.is-basic-flyout .map-item { min-height: 44px; padding: 4px 6px; }

.map-tree-panel.is-basic-flyout .map-tree-header-basic {
  align-items: flex-start;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  margin: 0 0 8px;
}

.map-tree-panel.is-basic-flyout .map-tree-basic-meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.map-tree-panel.is-basic-flyout .map-tree-basic-count {
  color: var(--text-1);
  font: 800 13px/1.2 var(--font-ui);
}

.map-tree-panel.is-basic-flyout .map-tree-basic-hint {
  color: var(--text-3);
  font: 500 11px/1.4 var(--font-ui);
}

.map-tree-panel.is-basic-flyout .map-tree-basic-add {
  background: var(--accent-muted);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-s);
  color: var(--accent);
  cursor: pointer;
  flex: 0 0 auto;
  font: 700 12px/1 var(--font-ui);
  padding: 8px 12px;
}

.map-tree-panel.is-basic-flyout .map-tree-basic-add:hover,
.map-tree-panel.is-basic-flyout .map-tree-basic-add:focus-visible {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.map-tree-panel.is-basic-flyout .map-tree-more,
.map-tree-panel.is-basic-flyout .map-tree-add-child-quick {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-s);
  color: var(--text-2);
  cursor: pointer;
  font: 700 14px/1 var(--font-ui);
  height: 28px;
  width: 28px;
}

.map-tree-panel.is-basic-flyout .map-tree-more:hover,
.map-tree-panel.is-basic-flyout .map-tree-more:focus-visible,
.map-tree-panel.is-basic-flyout .map-tree-add-child-quick:hover,
.map-tree-panel.is-basic-flyout .map-tree-add-child-quick:focus-visible {
  background: var(--bg-hover);
  border-color: var(--border-default);
}

/* 초보 행은 `+`(하위 추가) 버튼이 하나 더 붙는다 — 공용 6열에 한 칸 더. */
.map-tree-panel.is-basic-flyout .map-item-basic {
  grid-template-columns:
    var(--map-row-toggle) var(--map-row-handle) var(--map-row-thumb)
    minmax(0, 1fr) auto auto auto;
}
```

- [ ] **Step 3: 두 소스에서 맵 규칙을 지운다**

`src/styles/shell/editor-ui-modes.css` 736~938행 삭제. **114행 `.resizer-map-tree.is-ui-hidden` 은 남긴다** — 리사이저는 패널 밖이다.

`src/styles/editor/map-props.css` 441~457행 삭제.

- [ ] **Step 4: 검증**

Run:
```bash
grep -n "map-tree\|map-item" src/styles/shell/editor-ui-modes.css
```
Expected: `.resizer-map-tree.is-ui-hidden` 과 주석 한 줄만 남는다.

Run:
```bash
grep -c "map-tree\|map-item" src/styles/editor/map-props.css
```
Expected: `0`

Run:
```bash
npx playwright test test/e2e/map-panel-modern.spec.ts --reporter=line
```
Expected: **3모드 전부 PASS.** 특히 `맵 패널 — beginner › 행에서 '시작' 배지가 메타 텍스트를 덮지 않는다` 가 초록이어야 한다. Task 1 에서 28 이었던 값이 0 이 된다.

- [ ] **Step 5: 커밋**

```bash
git add src/styles/shell/editor-ui-modes.css src/styles/editor/map-props.css src/styles/editor/map-panel.modern.css
git commit -m "fix(map): 초보 플라이아웃이 잃어버렸던 행 규칙을 되찾아 28px 겹침을 없앤다"
```

---

### Task 7: 남은 소유자 4개를 정리한다

베이스 규칙, 도메인 침범, 죽은 규칙을 치운다.

**Files:**
- Modify: `src/styles/editor/core.part-2.css:152-184`
- Modify: `src/styles/database/tabs-a.part-2.css:426-437`
- Modify: `src/styles/shell/figma-editor/09-rm-chipset-grid.css:131-145`
- Modify: `src/styles/shell/figma-editor/02-menus-toolbar-tools.css:65-67`
- Test: `test/e2e/map-panel-modern.spec.ts`

**Interfaces:**
- Consumes: Task 3 의 모던 레이어
- Produces: 없음 (제거 태스크)

- [ ] **Step 1: `core.part-2.css` 의 `.map-item` 베이스를 지운다**

152~184행의 `.map-item`, `.map-item:hover`, `.map-item.active`, `.map-item .start-mark`, `.map-item .del`, `.map-item .del:hover` 를 전부 삭제한다.

`.map-item .del` 은 `mapList.ts` 가 더 이상 만들지 않는 요소를 스타일링하는 죽은 규칙이므로 어디로도 옮기지 않는다. 다음으로 확인한다:

```bash
grep -rn '"del"\|class: "del"\|\bdel\b' src/editor/panels/mapList.ts
```
Expected: 매치 없음 (죽은 규칙임이 확인된다).

- [ ] **Step 2: `tabs-a.part-2.css` 의 도메인 침범을 지운다**

426~437행의 `/* ?? Map Tree ?? */` 주석과 `.map-item`, `.map-tree-icon` 규칙을 삭제한다. 데이터베이스 시트가 맵 트리를 전역 셀렉터로 스타일링하고 있었고, 그 `flex-wrap: wrap` 이 좁은 폭에서 행을 접히게 만들었다.

- [ ] **Step 3: `09-rm-chipset-grid.css` 의 맵 규칙을 지운다**

131~145행의 `.map-item.active`(채도 100% 슬래브)와 `.map-tree-panel`(flex 컨테이너) 규칙을 삭제한다. 둘 다 Task 3 이 대체했다. 같은 파일의 `left-palette-root` 규칙은 건드리지 않는다.

- [ ] **Step 4: `02-menus-toolbar-tools.css` 의 공유 셀렉터 목록에서 맵을 뺀다**

65~67행에서 다음 세 줄만 제거한다(목록의 다른 셀렉터는 유지):

```
  .left-panel-stack[data-testid="left-map-root"] .map-tree-action,
  .left-panel-stack[data-testid="left-map-root"] .btn,
  .left-panel-stack[data-testid="left-map-root"] .map-tree-wide-action {
```

→ 앞의 셀렉터(`.tool-command-row .icon-btn`)가 목록의 마지막이 되도록 쉼표를 정리하고 `{` 를 붙인다.

188~198행의 `.editor-layout .left-panel { grid-template-rows: … var(--map-tree-height, 300px) }` 는 **패널 외부 레이아웃이므로 남긴다.**

- [ ] **Step 5: 소유권이 통합됐는지 전수 검증한다**

Run:
```bash
grep -rl "map-tree\|map-item" src/styles/
```

Expected: 정확히 다음 5개만 남는다 — 하나는 패널 내부 소유자, 넷은 패널 **바깥**의 레이아웃·리사이저다.
```
src/styles/editor/map-panel.modern.css                       ← 패널 내부 단독 소유자
src/styles/shell/figma-editor/02-menus-toolbar-tools.css     ← .left-panel 그리드 행(--map-tree-height)
src/styles/shell/figma-editor/03-layout-left-palette.css     ← .resizer-map-tree
src/styles/shell/figma-editor/07-context-menu-responsive.css ← .left-panel 그리드 행(--map-tree-height)
src/styles/shell/editor-ui-modes.css                         ← .resizer-map-tree.is-ui-hidden
```

목록이 이와 다르면 이관이 덜 끝난 것이다. 남은 파일을 열어 맵 규칙을 모던 레이어로 옮긴다.

- [ ] **Step 6: 검증**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json
npx vitest run test/mapList.test.ts test/basicLeftRail.test.ts test/editorLayoutPersist.test.ts
npx playwright test test/e2e/map-panel-modern.spec.ts test/e2e/map-tree-thumbnails.spec.ts test/e2e/oprn-editor-layout.spec.ts --reporter=line
```

Expected: 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/styles/editor/core.part-2.css src/styles/database/tabs-a.part-2.css src/styles/shell/figma-editor/09-rm-chipset-grid.css src/styles/shell/figma-editor/02-menus-toolbar-tools.css
git commit -m "refactor(map): 남은 소유자 4개를 비워 맵 패널 CSS 를 한 곳으로 모은다"
```

---

### Task 8: 헤더 툴바를 다시 짓는다

**Files:**
- Modify: `src/editor/panels/mapList.ts:119-125` (헤더 마크업), `:587-640` (`makeMapTreeHeaderActions`)
- Modify: `src/styles/editor/map-panel.modern.css`
- Test: `test/e2e/map-panel-modern.spec.ts`

**Interfaces:**
- Consumes: Task 2 의 `.oprn-icon-map-folder`, `.oprn-icon-tree-open`, `.oprn-icon-tree-closed`
- Produces: DOM 구조 `h3 > span.map-tree-title + span.map-tree-count`. Task 9 가 이 `h3` 옆에 필터 토글을 넣는다.

- [ ] **Step 1: 제목과 개수를 분리한다**

`src/editor/panels/mapList.ts` 의 `renderMapList` 안, 현재 `header.append(el("h3", { text: \`맵 ${mapCount}\` }));` 인 줄을 다음으로 바꾼다.

```ts
    header.append(el("h3", {
      children: [
        el("span", { class: "map-tree-title", text: "맵" }),
        el("span", { class: "map-tree-count", text: String(mapCount) }),
      ],
    }));
```

- [ ] **Step 2: 폴더 아이콘의 출처를 바꾼다**

같은 파일 `makeMapTreeHeaderActions` 안, `분류 추가` 액션의 `icon: "folder"` 를 `icon: "map-folder"` 로 바꾼다. 리소스 매니저 전용 시트 의존이 끊긴다.

- [ ] **Step 3: 개수 배지 스타일을 추가한다**

`src/styles/editor/map-panel.modern.css` 의 헤더 절에 추가한다.

```css
/* 개수가 라벨과 같은 크기·굵기로 경쟁하지 않게 분리한다. */
.map-tree-panel .map-tree-header h3 { align-items: center; display: flex; gap: 6px; }
.map-tree-panel .map-tree-title { color: var(--text-1); }

.map-tree-panel .map-tree-count {
  background: var(--control-bg);
  border-radius: 999px;
  color: var(--text-3);
  font: 700 10px/1 var(--font-ui);
  padding: 3px 7px;
}
```

- [ ] **Step 4: 검증**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json
npx vitest run test/mapList.test.ts
npx playwright test test/e2e/map-panel-modern.spec.ts --reporter=line
```

Expected: 전부 PASS. 특히 `헤더 버튼 4개가 모두 보이는 글리프를 가진다` 가 계속 초록이어야 한다.

`test/mapList.test.ts` 가 `맵 1` 같은 합쳐진 텍스트를 단언한다면, 단언을 `map-tree-title` / `map-tree-count` 로 나눠 고친다. 테스트를 지우지 말고 새 구조에 맞게 고친다.

- [ ] **Step 5: 커밋**

```bash
git add src/editor/panels/mapList.ts src/styles/editor/map-panel.modern.css test/mapList.test.ts
git commit -m "feat(map): 헤더 제목과 개수를 분리하고 폴더 아이콘 출처를 일원화한다"
```

---

### Task 9: 필터를 맵 개수에 따라 접는다

맵 8개 미만이면 필터 크롬을 접고 헤더에 토글만 남긴다. 질의나 패싯이 활성이면 개수와 무관하게 편다.

**Files:**
- Modify: `src/editor/panels/mapList.ts` (`makeFilterField`, `renderMapList`)
- Modify: `src/styles/editor/map-panel.modern.css`
- Test: `test/mapList.test.ts`, `test/e2e/map-panel-modern.spec.ts`

**Interfaces:**
- Consumes: Task 8 의 `h3 > .map-tree-title + .map-tree-count` 구조
- Produces: 신규 testid `map-tree-filter-toggle`. 모듈 스코프 변수 `filterExpandedByUser: boolean`.

- [ ] **Step 1: 실패하는 단위 테스트를 쓴다**

`test/mapList.test.ts` 에 추가한다. 파일 상단의 기존 import 와 프로젝트 시드 헬퍼를 그대로 쓴다.

```ts
it("맵이 8개 미만이면 필터를 접고 토글만 노출한다", () => {
  // 시드 프로젝트는 맵 1개다.
  const host = document.createElement("div");
  renderMapList(host);
  const filter = host.querySelector<HTMLElement>('[data-testid="map-tree-filter"]');
  const toggle = host.querySelector<HTMLElement>('[data-testid="map-tree-filter-toggle"]');
  expect(toggle).not.toBeNull();
  // DOM 에는 남아 있되 hidden 이어야 한다 — 기존 e2e 가 fill() 로 접근한다.
  expect(filter).not.toBeNull();
  expect(filter?.closest(".map-tree-filter")?.hasAttribute("hidden")).toBe(true);
});
```

- [ ] **Step 2: 실행해서 실패를 확인한다**

Run:
```bash
npx vitest run test/mapList.test.ts -t "필터를 접고"
```

Expected: FAIL — `expect(toggle).not.toBeNull()` 에서 `map-tree-filter-toggle` 이 없다.

- [ ] **Step 3: 구현한다**

`src/editor/panels/mapList.ts` 의 모듈 스코프 변수 선언부(`let mapFilterFacet: MapFilterFacet = "all";` 근처)에 추가한다.

```ts
/** 맵이 이 개수 이상이면 필터를 처음부터 펼친다. 행 31px × 8 = 248px 로 기본
 *  트리 높이(300px)를 채우기 시작하는 지점이다. */
const FILTER_AUTO_EXPAND_MAPS = 8;
let filterExpandedByUser = false;
```

`makeFilterField` 를 통째로 아래로 교체한다. 칩 루프와 입력의 내용은 기존과 **동일하며**, 달라진 것은 `mapCount` 인자, `expanded` 계산, 마지막의 `hidden` 부여 세 가지뿐이다.

```ts
function makeFilterField(mapCount: number): HTMLElement {
  const hasActiveFilter = mapFilterQuery.trim().length > 0 || mapFilterFacet !== "all";
  // 숨겨진 필터 때문에 "맵이 사라졌다"고 오인하지 않도록, 활성이면 개수와 무관하게 편다.
  const expanded = hasActiveFilter || filterExpandedByUser || mapCount >= FILTER_AUTO_EXPAND_MAPS;
  const chips = el("div", { class: "map-tree-filter-facets" });
  for (const [value, label] of [
    ["all", "전체"],
    ["empty", "빈 맵"],
    ["nolink", "문 없음"],
    ["encounter", "인카운터"],
  ] as const) {
    chips.append(el("button", {
      class: "map-tree-facet" + (mapFilterFacet === value ? " is-active" : ""),
      text: label,
      attrs: { type: "button", "aria-pressed": String(mapFilterFacet === value) },
      dataset: { testid: `map-tree-facet-${value}` },
      on: {
        click: () => {
          mapFilterFacet = value;
          rerenderMapList();
        },
      },
    }));
  }
  const wrap = el("div", {
    class: "map-tree-filter",
    children: [
      el("input", {
        class: "map-tree-filter-input",
        attrs: {
          type: "search",
          placeholder: "이름 또는 id",
          "aria-label": "맵 이름 필터",
        },
        value: mapFilterQuery,
        dataset: { testid: "map-tree-filter" },
        on: {
          input: (event) => {
            mapFilterQuery = (event.target as HTMLInputElement).value;
            rerenderMapList();
            const input = currentMapListContainer?.querySelector<HTMLInputElement>("[data-testid='map-tree-filter']");
            input?.focus();
            if (input) input.setSelectionRange(mapFilterQuery.length, mapFilterQuery.length);
          },
        },
      }),
      chips,
    ],
  });
  if (!expanded) wrap.setAttribute("hidden", "");
  return wrap;
}
```

헤더에 토글 버튼을 넣는다. `makeMapTreeHeaderActions` 가 반환하는 목록의 **맨 앞**에 추가한다.

```ts
      treeAction({
        action: () => {
          filterExpandedByUser = !filterExpandedByUser;
          rerenderMapList();
          currentMapListContainer
            ?.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]')
            ?.focus();
        },
        icon: "search",
        label: "맵 필터",
        testId: "map-tree-filter-toggle",
      }),
```

호출부 두 곳(`isBasic` 분기 양쪽)의 `section.append(makeFilterField());` 를 `section.append(makeFilterField(mapCount));` 로 바꾼다.

초보 변종은 헤더 마크업이 달라 `makeMapTreeHeaderActions` 를 쓰지 않는다. `map-tree-header-basic` 블록에도 같은 토글을 넣되, `map-tree-basic-add` 앞에 붙인다.

```ts
    header.append(el("button", {
      class: "map-tree-action",
      attrs: { type: "button", title: "맵 필터", "aria-label": "맵 필터" },
      dataset: { testid: "map-tree-filter-toggle" },
      children: [el("span", { class: "rm-tool-icon oprn-icon-search", attrs: { "aria-hidden": "true" } })],
      on: {
        click: () => { filterExpandedByUser = !filterExpandedByUser; rerenderMapList(); },
      },
    }));
```

- [ ] **Step 4: 단위 테스트가 통과하는지 확인한다**

Run:
```bash
npx vitest run test/mapList.test.ts
```

Expected: PASS.

- [ ] **Step 5: e2e 에 토글 왕복 테스트를 추가한다**

`test/e2e/map-panel-modern.spec.ts` 끝에 추가한다.

```ts
test.describe("맵 필터 점진적 노출", () => {
  test("맵이 적으면 접혀 있고, 토글하면 열리며, 패싯이 활성이면 강제로 열린다", async ({ page }) => {
    await bootEditor(page, "expert");
    const filterWrap = page.locator(".map-tree-filter");
    await expect(filterWrap).toBeHidden();

    await page.getByTestId("map-tree-filter-toggle").click();
    await expect(filterWrap).toBeVisible();
    await page.getByTestId("map-tree-filter").fill("시장");
    await expect(page.getByTestId("map-tree-filter")).toHaveValue("시장");

    // 질의를 지우고 패싯만 켜도 접히지 않아야 한다.
    await page.getByTestId("map-tree-filter").fill("");
    await page.getByTestId("map-tree-facet-empty").click();
    await page.getByTestId("map-tree-filter-toggle").click(); // 사용자 토글을 꺼도
    await expect(filterWrap).toBeVisible();                    // 패싯이 활성이라 열려 있다
  });
});
```

- [ ] **Step 6: 필터 CSS 를 추가한다**

`src/styles/editor/map-panel.modern.css` 에 추가한다.

```css
.map-tree-panel .map-tree-filter[hidden] { display: none; }
```

- [ ] **Step 7: 검증**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json
npx vitest run test/mapList.test.ts test/basicLeftRail.test.ts
npx playwright test test/e2e/map-panel-modern.spec.ts --reporter=line
```

Expected: 전부 PASS. `기존 testid 가 모두 살아 있다` 테스트가 `map-tree-filter` 를 `toHaveCount(1)` 로 확인하는데, `hidden` 이어도 DOM 에 있으므로 통과한다.

- [ ] **Step 8: 커밋**

```bash
git add src/editor/panels/mapList.ts src/styles/editor/map-panel.modern.css test/mapList.test.ts test/e2e/map-panel-modern.spec.ts
git commit -m "feat(map): 맵이 적을 때 필터 크롬을 접고 활성 시엔 강제로 펼친다"
```

---

### Task 10: after 캡처와 대조 보고

**Files:**
- Create: `verify-shots/map-modernize/after/*` (스크립트가 생성)

**Interfaces:**
- Consumes: Task 1~9 의 모든 변경. 캡처 스크립트의 출력 폴더 인자는 Task 3 Step 7 에서 이미 추가됐다.
- Produces: baseline/after 대조 증거

- [ ] **Step 1: after 를 캡처한다**

Run:
```bash
npx tsx scripts/_map-panel-baseline.mts after
```

Expected: `verify-shots/map-modernize/after/diag.json` 이 생기고, beginner 의 `map-flyout.png` 에서 '시작' 배지가 메타를 덮지 않는다.

- [ ] **Step 2: 계측값을 대조한다**

두 캡처 스크립트는 Playwright 러너를 타지 않으므로 dev 서버를 스스로 띄우지 않는다. `RPG_ZZU_URL` 기본값은 `http://127.0.0.1:9977` 이다. 서버를 먼저 띄운다.

```bash
npx vite --port 9977 --strictPort &
```

Run:
```bash
npx tsx scripts/_map-panel-overlap-probe.mts
```

Expected: `badgeOverlapsMetaPx: 0` (Task 1 시점의 28 에서 0).

- [ ] **Step 3: 전체 게이트를 돌린다**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json
npx vitest run test/mapList.test.ts test/basicLeftRail.test.ts test/editorLayoutPersist.test.ts
npx playwright test test/e2e/map-panel-modern.spec.ts test/e2e/map-tree-thumbnails.spec.ts test/e2e/oprn-editor-layout.spec.ts test/e2e/responsive-shell.spec.ts --reporter=line
```

Expected: 전부 PASS. 실패가 있으면 **보고하고 멈춘다** — 통계를 만들어 덮지 않는다.

- [ ] **Step 4: 최종 소유권을 재확인한다**

Run:
```bash
grep -rl "map-tree\|map-item" src/styles/
```

Expected: 5개 파일 (모던 레이어 1 + 패널 외부 레이아웃/리사이저 4).

- [ ] **Step 5: 커밋**

```bash
git add verify-shots/map-modernize/after
git commit -m "test(map): 모던화 전후 시각·계측 증거를 대조 가능하게 남긴다"
```

---

## 완료 기준

1. `grep -rl "map-tree\|map-item" src/styles/` 가 5개 파일만 반환한다.
2. `test/e2e/map-panel-modern.spec.ts` 가 3모드 전부 PASS.
3. `badgeOverlapsMetaPx` 가 28 → 0.
4. 헤더 버튼 4개 모두 글리프가 그려진다.
5. `verify-shots/map-modernize/{baseline,after}/` 대조 가능.
6. 기존 스위트(`mapList`, `basicLeftRail`, `editorLayoutPersist`, `map-tree-thumbnails`, `oprn-editor-layout`, `responsive-shell`) 회귀 없음.
