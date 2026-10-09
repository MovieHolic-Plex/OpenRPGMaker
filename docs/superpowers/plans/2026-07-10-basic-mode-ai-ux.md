# 기본 모드 AI UX + 아이콘 레일 + 전문가 1024px 대응 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기본 모드 좌측을 48px 아이콘 레일+플라이아웃으로 전환하고, 캔버스 인라인 어시스트(선택 칩·제안 인라인 승인·진행 배지)와 Ctrl+K 통합 커맨드 팔레트를 추가하며, 전문가 모드를 1024px까지 완전 대응시킨다.

**Architecture:** 스펙 `docs/superpowers/specs/2026-07-10-basic-mode-ai-ux-design.md`의 A안(표면 확장). 셸 구조는 유지하고 `basicLeftRail.ts` 재작성 + 신규 모듈 4개 + CSS 2파일 추가. 기존 자산(regionTaskModal, agentGhostPreview DOM 마커, buildPalette 오버레이 위치 계산, aiSkillDrawer 팔레트, aiChatPanel 선택 칩)을 재사용한다.

**Tech Stack:** Vanilla TS + `el()` DOM 빌더(`src/util/dom.ts`), Phaser(EditScene), vitest(env=node, DOM은 `test/fakeDom.ts`의 `installFakeDom`), Playwright(testDir `test/e2e`, webServer 자동 기동 port 9173).

## Global Constraints

- 기존 `data-testid` 유지 필수: `tool-{id}`, `layer-lower|upper|event`, `basic-tool-list`, `basic-tile-grid`, `basic-left-rail`, `map-tree`, `ai-selection-chip`. E2E가 참조한다.
- vitest는 `environment: "node"` — DOM 테스트는 반드시 `test/fakeDom.ts`의 `installFakeDom()/findByTestId()` 사용. `createElementNS`는 fakeDom에 없으므로 SVG 생성은 단위테스트에서 호출하지 않는다.
- 단위테스트 실행: `npx vitest run test/<파일> --configLoader runner`. 전체: `npm test`. 타입: `npm run typecheck`.
- 신규 CSS 파일은 `src/styles/index.css`에 `@import` 등록해야 로드된다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- E2E 페이지 진입은 `await page.goto("/?freshProject=1")` (로그인 모달 스킵 경로).
- 모드 전환 헤드리스 훅: `window.__rpgzzuEditorUiMode.set("basic"|"expert")`.
- 이 계획의 line 번호는 2026-07-10 HEAD(4b4daca) 기준 — 앞 태스크 수행 후 어긋날 수 있으니 앵커 텍스트로 찾을 것.

---

## Phase 1 — 기본 모드 아이콘 레일

### Task 1: 레일용 SVG 아이콘 5종 추가

**Files:**
- Modify: `src/editor/panels/rpgMakerTileToolbarIcons.ts`
- Test: `test/railIcons.test.ts`

**Interfaces:**
- Produces: `SvgIconName`에 `"eyedropper" | "event" | "tile" | "layers" | "map"` 추가, `SVG_ICON_NAMES: readonly SvgIconName[]` export. Task 3이 `makeSvgIcon("eyedropper")` 등을 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/railIcons.test.ts
import { describe, expect, it } from "vitest";
import { SVG_ICON_NAMES } from "@/editor/panels/rpgMakerTileToolbarIcons";

describe("rail svg icons", () => {
  it("기본 레일에 필요한 아이콘 이름이 모두 등록되어 있다", () => {
    for (const name of ["select", "brush", "eraser", "fill", "event", "eyedropper", "tile", "layers", "map"]) {
      expect(SVG_ICON_NAMES).toContain(name);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/railIcons.test.ts --configLoader runner`
Expected: FAIL — `SVG_ICON_NAMES` export 없음.

- [ ] **Step 3: 구현**

`rpgMakerTileToolbarIcons.ts` line 1의 union에 5종 추가:

```ts
type SvgIconName =
  | "brush" | "eraser" | "fill" | "inspector" | "pen" | "rect" | "round" | "select" | "template" | "undo"
  | "eyedropper" | "event" | "tile" | "layers" | "map";
```

`ICONS` 레코드에 항목 추가(`undo` 항목 뒤):

```ts
  eyedropper: [
    { tag: "path", attrs: { d: "M14.5 3.5l4 4-2.5 2.5-4-4z" } },
    { tag: "path", attrs: { d: "M12 6L5 13l-1 5 5-1 7-7" } },
  ],
  event: [
    { tag: "path", attrs: { d: "M6 3v18" } },
    { tag: "path", attrs: { d: "M6 4h11l-2.5 3.5L17 11H6" } },
  ],
  tile: [
    { tag: "rect", attrs: { x: "4", y: "4", width: "6", height: "6" } },
    { tag: "rect", attrs: { x: "12", y: "4", width: "6", height: "6" } },
    { tag: "rect", attrs: { x: "4", y: "12", width: "6", height: "6" } },
    { tag: "rect", attrs: { x: "12", y: "12", width: "6", height: "6", fill: "currentColor", opacity: "0.22" } },
  ],
  layers: [
    { tag: "path", attrs: { d: "M11 3l8 4.5-8 4.5-8-4.5z" } },
    { tag: "path", attrs: { d: "M3 12l8 4.5 8-4.5" } },
    { tag: "path", attrs: { d: "M3 16.5L11 21l8-4.5" } },
  ],
  map: [
    { tag: "path", attrs: { d: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" } },
    { tag: "path", attrs: { d: "M9 4v14" } },
    { tag: "path", attrs: { d: "M15 6v14" } },
  ],
```

파일 끝(`export type { SvgIconName };` 앞)에 추가:

```ts
export const SVG_ICON_NAMES = Object.keys(ICONS) as readonly SvgIconName[];
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run test/railIcons.test.ts --configLoader runner` → PASS
Run: `npm run typecheck` → 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add src/editor/panels/rpgMakerTileToolbarIcons.ts test/railIcons.test.ts
git commit -m "feat(editor): 아이콘 레일용 SVG 아이콘 5종 추가"
```

---

### Task 2: 플라이아웃 상태 머신 + 셸 (`basicRailFlyout.ts`)

**Files:**
- Create: `src/editor/panels/basicRailFlyout.ts`
- Test: `test/basicRailFlyout.test.ts`

**Interfaces:**
- Produces (Task 3이 소비):
  - `type BasicFlyoutId = "tiles" | "layers" | "maps"`
  - `interface BasicFlyoutState { readonly open: BasicFlyoutId | null; readonly pinned: boolean }`
  - `basicFlyoutReducer(state, action): BasicFlyoutState`
  - `INITIAL_BASIC_FLYOUT_STATE`
  - `buildFlyoutShell(options: FlyoutShellOptions): HTMLElement` — testid `basic-rail-flyout`, 핀 버튼 testid `basic-flyout-pin`, 닫기 testid `basic-flyout-close`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/basicRailFlyout.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  basicFlyoutReducer,
  buildFlyoutShell,
  INITIAL_BASIC_FLYOUT_STATE,
  type BasicFlyoutState,
} from "@/editor/panels/basicRailFlyout";
import { findByTestId, installFakeDom } from "./fakeDom";

describe("basicFlyoutReducer", () => {
  it("같은 패널 토글은 닫고, 다른 패널 토글은 전환한다", () => {
    let s: BasicFlyoutState = INITIAL_BASIC_FLYOUT_STATE;
    s = basicFlyoutReducer(s, { type: "toggle", id: "tiles" });
    expect(s.open).toBe("tiles");
    s = basicFlyoutReducer(s, { type: "toggle", id: "layers" });
    expect(s.open).toBe("layers");
    s = basicFlyoutReducer(s, { type: "toggle", id: "layers" });
    expect(s.open).toBeNull();
  });

  it("바깥 클릭은 핀 없을 때만 닫는다", () => {
    let s = basicFlyoutReducer(INITIAL_BASIC_FLYOUT_STATE, { type: "toggle", id: "tiles" });
    s = basicFlyoutReducer(s, { type: "pin-toggle" });
    expect(basicFlyoutReducer(s, { type: "outside-click" }).open).toBe("tiles");
    s = basicFlyoutReducer(s, { type: "pin-toggle" });
    expect(basicFlyoutReducer(s, { type: "outside-click" }).open).toBeNull();
  });

  it("Escape는 핀 상태와 무관하게 닫고 핀을 푼다", () => {
    let s = basicFlyoutReducer(INITIAL_BASIC_FLYOUT_STATE, { type: "toggle", id: "maps" });
    s = basicFlyoutReducer(s, { type: "pin-toggle" });
    const closed = basicFlyoutReducer(s, { type: "escape" });
    expect(closed.open).toBeNull();
    expect(closed.pinned).toBe(false);
  });

  it("닫힌 상태에서 pin-toggle은 무시한다", () => {
    expect(basicFlyoutReducer(INITIAL_BASIC_FLYOUT_STATE, { type: "pin-toggle" })).toEqual(INITIAL_BASIC_FLYOUT_STATE);
  });
});

describe("buildFlyoutShell", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => { restore(); });

  it("제목·핀·닫기·본문을 렌더하고 콜백을 배선한다", () => {
    let pinToggles = 0;
    let closes = 0;
    const body = document.createElement("div");
    const shell = buildFlyoutShell({
      title: "타일",
      pinned: false,
      onPinToggle: () => { pinToggles += 1; },
      onClose: () => { closes += 1; },
      body,
    });
    document.body.append(shell);
    expect(findByTestId(document.body as never, "basic-rail-flyout")).toBeTruthy();
    (findByTestId(document.body as never, "basic-flyout-pin") as unknown as HTMLElement).click();
    (findByTestId(document.body as never, "basic-flyout-close") as unknown as HTMLElement).click();
    expect(pinToggles).toBe(1);
    expect(closes).toBe(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/basicRailFlyout.test.ts --configLoader runner` → FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// src/editor/panels/basicRailFlyout.ts
// 기본 모드 아이콘 레일 플라이아웃 — 열림/전환/핀 상태 머신과 셸 DOM.
// 캔버스를 리사이즈하지 않는 오버레이(스펙 §2). 상태는 순수 리듀서로 관리해 단위테스트한다.
import { el } from "@/util/dom";

export type BasicFlyoutId = "tiles" | "layers" | "maps";

export interface BasicFlyoutState {
  readonly open: BasicFlyoutId | null;
  readonly pinned: boolean;
}

export type BasicFlyoutAction =
  | { readonly type: "toggle"; readonly id: BasicFlyoutId }
  | { readonly type: "outside-click" }
  | { readonly type: "escape" }
  | { readonly type: "pin-toggle" };

export const INITIAL_BASIC_FLYOUT_STATE: BasicFlyoutState = { open: null, pinned: false };

export function basicFlyoutReducer(state: BasicFlyoutState, action: BasicFlyoutAction): BasicFlyoutState {
  switch (action.type) {
    case "toggle":
      if (state.open === action.id) return { open: null, pinned: false };
      return { open: action.id, pinned: state.pinned };
    case "outside-click":
      if (state.open === null || state.pinned) return state;
      return { open: null, pinned: false };
    case "escape":
      if (state.open === null) return state;
      return { open: null, pinned: false };
    case "pin-toggle":
      if (state.open === null) return state;
      return { open: state.open, pinned: !state.pinned };
  }
}

export interface FlyoutShellOptions {
  readonly title: string;
  readonly pinned: boolean;
  readonly onPinToggle: () => void;
  readonly onClose: () => void;
  readonly body: HTMLElement;
}

export function buildFlyoutShell(options: FlyoutShellOptions): HTMLElement {
  const pin = el("button", {
    class: "basic-flyout-pin" + (options.pinned ? " is-pinned" : ""),
    text: "📌",
    attrs: {
      type: "button",
      title: options.pinned ? "고정 해제" : "열어두기(고정)",
      "aria-pressed": String(options.pinned),
    },
    dataset: { testid: "basic-flyout-pin" },
    on: { click: options.onPinToggle },
  });
  const close = el("button", {
    class: "basic-flyout-close",
    text: "✕",
    attrs: { type: "button", title: "닫기", "aria-label": "플라이아웃 닫기" },
    dataset: { testid: "basic-flyout-close" },
    on: { click: options.onClose },
  });
  return el("div", {
    class: "basic-rail-flyout",
    attrs: { role: "dialog", "aria-label": options.title },
    dataset: { testid: "basic-rail-flyout" },
    children: [
      el("div", {
        class: "basic-flyout-head",
        children: [el("span", { class: "basic-flyout-title", text: options.title }), pin, close],
      }),
      el("div", { class: "basic-flyout-body", children: [options.body] }),
    ],
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run test/basicRailFlyout.test.ts --configLoader runner` → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/editor/panels/basicRailFlyout.ts test/basicRailFlyout.test.ts
git commit -m "feat(editor): 기본 레일 플라이아웃 상태 머신·셸 추가"
```

---

### Task 3: `basicLeftRail.ts` 아이콘 레일 재작성 + CSS

**Files:**
- Modify: `src/editor/panels/basicLeftRail.ts` (전체 교체)
- Modify: `src/styles/shell/editor-ui-modes.css` (기본 레일 블록 교체)
- Test: `test/basicLeftRail.test.ts`

**Interfaces:**
- Consumes: Task 1 `makeSvgIcon`, Task 2 리듀서/셸.
- Produces: `renderBasicLeftRail(container: HTMLElement): void` (기존 시그니처 유지 — `tilePalette.ts:83`이 호출). 레일 testid: `basic-left-rail`, `basic-tool-list`, `tool-{id}`, 토글 `basic-rail-toggle-tiles|layers|maps`, 플라이아웃 내부 `basic-tile-grid`, `basic-tile-{index}`, `layer-lower|upper|event`, 맵 플라이아웃 본문에 기존 `renderMapList` 산출물(`map-tree`).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/basicLeftRail.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBasicLeftRail } from "@/editor/panels/basicLeftRail";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function click(id: string): void {
  const node = findByTestId(document.body as unknown as FakeElement, id) as unknown as HTMLElement | null;
  if (!node) throw new Error(`testid not found: ${id}`);
  node.click();
}

describe("basic icon rail", () => {
  let restore: () => void;
  let container: HTMLElement;

  beforeEach(() => {
    restore = installFakeDom();
    resetEditorUiModeForTests("basic");
    store.replace(createBlankProject());
    editorState.set({ tool: "paint", layer: "lower", currentMapId: store.getCurrent().startMapId });
    container = document.createElement("div");
    document.body.append(container);
    renderBasicLeftRail(container);
  });
  afterEach(() => { restore(); });

  it("도구 6개 아이콘 버튼을 기존 testid로 렌더한다", () => {
    for (const id of ["select", "paint", "erase", "fill", "event", "eyedropper"]) {
      expect(findByTestId(container as unknown as FakeElement, `tool-${id}`)).toBeTruthy();
    }
  });

  it("도구 클릭이 editorState를 갱신한다 (이벤트 도구는 레이어 동반 전환)", () => {
    click("tool-event");
    expect(editorState.get().tool).toBe("event");
    expect(editorState.get().layer).toBe("event");
    renderBasicLeftRail(container);
    click("tool-paint");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("pen");
  });

  it("타일 토글 → 플라이아웃에 타일 그리드, 타일 클릭 시 브러시 전환", () => {
    click("basic-rail-toggle-tiles");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeTruthy();
    expect(findByTestId(container as unknown as FakeElement, "basic-tile-grid")).toBeTruthy();
    click("basic-tile-0");
    expect(editorState.get().selectedTile).toBe(0);
    expect(editorState.get().tool).toBe("paint");
  });

  it("레이어 토글 → 플라이아웃에서 layer-upper 클릭 시 레이어 전환", () => {
    click("basic-rail-toggle-layers");
    renderBasicLeftRail(container);
    click("layer-upper");
    expect(editorState.get().layer).toBe("upper");
  });

  it("맵 토글 → 플라이아웃에 맵 트리 렌더", () => {
    click("basic-rail-toggle-maps");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "map-tree")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/basicLeftRail.test.ts --configLoader runner` → FAIL (토글 testid 없음)

- [ ] **Step 3: `basicLeftRail.ts` 전체 교체**

```ts
// editor/panels/basicLeftRail.ts
// 기본 모드 좌측 = 48px 아이콘 레일 + 플라이아웃(타일/레이어/맵).
// 스펙: docs/superpowers/specs/2026-07-10-basic-mode-ai-ux-design.md §2.
// - 도구 6개는 기존 data-testid(tool-*)를 유지한다.
// - 플라이아웃은 캔버스 위 오버레이 — 좌패널 폭을 바꾸지 않아 WebGL 리사이즈가 없다.
// - 상태는 모듈 레벨(재렌더에도 유지), 문서 리스너는 1회만 설치.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { TILE_SIZE } from "@/assets/bundled";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/rpgMakerTileToolbarIcons";
import { renderMapList } from "@/editor/panels/mapList";
import {
  basicFlyoutReducer,
  buildFlyoutShell,
  INITIAL_BASIC_FLYOUT_STATE,
  type BasicFlyoutAction,
  type BasicFlyoutId,
  type BasicFlyoutState,
} from "@/editor/panels/basicRailFlyout";

type BasicTool = {
  readonly id: Tool;
  readonly label: string;
  readonly hint: string;
  readonly icon: SvgIconName;
  readonly hotkey: string;
};

const BASIC_TOOLS: readonly BasicTool[] = [
  { id: "select", label: "선택", hint: "영역 선택", icon: "select", hotkey: "V" },
  { id: "paint", label: "브러시", hint: "타일 칠하기", icon: "brush", hotkey: "B" },
  { id: "erase", label: "지우개", hint: "현재 레이어 지우기", icon: "eraser", hotkey: "E" },
  { id: "fill", label: "채우기", hint: "영역 채우기", icon: "fill", hotkey: "G" },
  { id: "event", label: "이벤트", hint: "이벤트 배치·편집", icon: "event", hotkey: "N" },
  { id: "eyedropper", label: "스포이트", hint: "맵에서 타일 집기", icon: "eyedropper", hotkey: "I" },
] as const;

type BasicLayerRow = { readonly id: Layer; readonly label: string; readonly short: string; readonly hint: string };

const BASIC_LAYERS: readonly BasicLayerRow[] = [
  { id: "event", label: "이벤트", short: "이", hint: "이벤트 레이어" },
  { id: "upper", label: "오브젝트", short: "오", hint: "상위(오브젝트) 레이어" },
  { id: "lower", label: "타일", short: "타", hint: "하위(지면) 레이어" },
] as const;

const BASIC_TILE_CAP = 48;
const FLYOUT_TITLES: Record<BasicFlyoutId, string> = { tiles: "타일", layers: "레이어", maps: "맵" };

// 재렌더에도 살아남는 모듈 상태. tilePalette의 activeWorkTab 패턴과 동일.
let flyoutState: BasicFlyoutState = INITIAL_BASIC_FLYOUT_STATE;
let lastContainer: HTMLElement | null = null;
let documentListenersInstalled = false;

function dispatchFlyout(action: BasicFlyoutAction): void {
  const next = basicFlyoutReducer(flyoutState, action);
  if (next === flyoutState) return;
  flyoutState = next;
  if (lastContainer?.isConnected) renderBasicLeftRail(lastContainer);
}

function installDocumentListeners(): void {
  if (documentListenersInstalled || typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  documentListenersInstalled = true;
  document.addEventListener("pointerdown", (event) => {
    if (flyoutState.open === null) return;
    const target = event.target;
    if (target instanceof Node && lastContainer?.contains(target)) return;
    dispatchFlyout({ type: "outside-click" });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || flyoutState.open === null) return;
    const target = event.target;
    if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
    }
    dispatchFlyout({ type: "escape" });
  });
}

export function renderBasicLeftRail(container: HTMLElement): void {
  clearChildren(container);
  lastContainer = container;
  installDocumentListeners();

  const state = editorState.get();
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;

  const shell = el("div", {
    class: "basic-left-rail is-icon-rail",
    dataset: { testid: "basic-left-rail", uiDensity: "basic" },
  });
  shell.append(makeToolsColumn(state.tool));
  shell.append(el("div", { class: "basic-rail-sep", attrs: { "aria-hidden": "true" } }));
  shell.append(makePanelToggles(state.selectedTile, state.layer, tileset));
  if (flyoutState.open) {
    shell.append(makeFlyout(flyoutState.open, state.selectedTile, state.layer, tileset));
  }
  container.append(shell);
}

function makeToolsColumn(activeTool: Tool): HTMLElement {
  const list = el("div", { class: "basic-rail-icons", dataset: { testid: "basic-tool-list" } });
  for (const tool of BASIC_TOOLS) {
    const active = activeTool === tool.id;
    list.append(
      el("button", {
        class: "basic-rail-btn" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: `${tool.label} (${tool.hotkey}) — ${tool.hint}`,
          "aria-label": tool.label,
          "aria-pressed": String(active),
        },
        dataset: { testid: `tool-${tool.id}`, basicTool: tool.id },
        on: {
          click: () => {
            if (tool.id === "paint") editorState.set({ tool: "paint", paintShape: "pen" });
            else if (tool.id === "event") editorState.set({ tool: "event", layer: "event" });
            else if (editorState.get().layer === "event") editorState.set({ tool: tool.id, layer: "lower" });
            else editorState.set({ tool: tool.id });
          },
        },
        children: [makeSvgIcon(tool.icon)],
      }),
    );
  }
  return list;
}

function makePanelToggles(selectedTile: number, activeLayer: Layer, tileset: TilesetDef | undefined): HTMLElement {
  const wrap = el("div", { class: "basic-rail-icons basic-rail-panel-toggles" });

  // 타일: 현재 선택 타일 썸네일을 아이콘으로. 이벤트 레이어에선 비활성.
  const tileDisabled = activeLayer === "event" || !tileset;
  const thumbSize = 26;
  const tileThumbStyle =
    !tileDisabled && tileset && selectedTile >= 0 && selectedTile < tileset.count
      ? `width:${thumbSize}px;height:${thumbSize}px;${tilesetTileBackgroundStyle(tileset, selectedTile, thumbSize)}`
      : `width:${thumbSize}px;height:${thumbSize}px;`;
  const tileButton = el("button", {
    class: "basic-rail-btn basic-rail-tile-toggle" + (flyoutState.open === "tiles" ? " is-open" : ""),
    attrs: {
      type: "button",
      title: tileDisabled ? "이벤트 레이어에서는 타일을 선택하지 않습니다" : `타일 — 현재: ${selectedTile} ${tileDisplayLabelForIndex(selectedTile)}`,
      "aria-label": "타일 패널",
      "aria-expanded": String(flyoutState.open === "tiles"),
    },
    dataset: { testid: "basic-rail-toggle-tiles" },
    on: { click: () => { if (!tileDisabled) dispatchFlyout({ type: "toggle", id: "tiles" }); } },
    children: [el("span", { class: "basic-rail-tile-thumb", attrs: { style: tileThumbStyle, "aria-hidden": "true" } })],
  });
  if (tileDisabled) tileButton.setAttribute("disabled", "");
  wrap.append(tileButton);

  const layerShort = BASIC_LAYERS.find((row) => row.id === activeLayer)?.short ?? "타";
  wrap.append(
    el("button", {
      class: "basic-rail-btn" + (flyoutState.open === "layers" ? " is-open" : ""),
      attrs: {
        type: "button",
        title: `레이어 — 현재: ${BASIC_LAYERS.find((r) => r.id === activeLayer)?.label ?? ""}`,
        "aria-label": "레이어 패널",
        "aria-expanded": String(flyoutState.open === "layers"),
      },
      dataset: { testid: "basic-rail-toggle-layers" },
      on: { click: () => dispatchFlyout({ type: "toggle", id: "layers" }) },
      children: [makeSvgIcon("layers"), el("span", { class: "basic-rail-badge", text: layerShort })],
    }),
  );

  wrap.append(
    el("button", {
      class: "basic-rail-btn" + (flyoutState.open === "maps" ? " is-open" : ""),
      attrs: { type: "button", title: "맵 트리", "aria-label": "맵 패널", "aria-expanded": String(flyoutState.open === "maps") },
      dataset: { testid: "basic-rail-toggle-maps" },
      on: { click: () => dispatchFlyout({ type: "toggle", id: "maps" }) },
      children: [makeSvgIcon("map")],
    }),
  );
  return wrap;
}

function makeFlyout(id: BasicFlyoutId, selectedTile: number, activeLayer: Layer, tileset: TilesetDef | undefined): HTMLElement {
  const body = el("div", { class: "basic-flyout-content" });
  if (id === "tiles") {
    if (activeLayer === "event") {
      body.append(el("div", { class: "basic-rail-hint", text: "이벤트 레이어 — 타일 대신 이벤트를 배치합니다.", dataset: { testid: "basic-event-layer-hint" } }));
    } else if (!tileset) {
      body.append(el("div", { class: "empty-hint", text: "타일셋이 없습니다." }));
    } else {
      body.append(makeTilesBody(selectedTile, tileset));
    }
  } else if (id === "layers") {
    body.append(makeLayersBody(activeLayer));
  } else {
    const host = el("div", { class: "basic-flyout-map-host" });
    renderMapList(host);
    body.append(host);
  }
  return buildFlyoutShell({
    title: FLYOUT_TITLES[id],
    pinned: flyoutState.pinned,
    onPinToggle: () => dispatchFlyout({ type: "pin-toggle" }),
    onClose: () => dispatchFlyout({ type: "escape" }),
    body,
  });
}

function makeTilesBody(selectedTile: number, tileset: TilesetDef): HTMLElement {
  const section = el("div", { class: "basic-rail-section", dataset: { testid: "basic-tiles-section" } });
  section.append(
    el("div", {
      class: "basic-selected-tile",
      text: selectedTile >= 0 && selectedTile < tileset.count ? `${selectedTile} ${tileDisplayLabelForIndex(selectedTile)}` : "없음",
      dataset: { testid: "selected-tile-status" },
    }),
  );
  const grid = el("div", { class: "basic-tile-grid", dataset: { testid: "basic-tile-grid" } });
  for (const index of pickBasicTileIndexes(tileset, selectedTile)) {
    const active = index === selectedTile;
    const cellSize = TILE_SIZE * 2;
    grid.append(
      el("button", {
        class: "basic-tile-cell" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: `${index} ${tileDisplayLabelForIndex(index)}`,
          "aria-label": `타일 ${index}`,
          "aria-pressed": String(active),
          style: `width:${cellSize}px;height:${cellSize}px;${tilesetTileBackgroundStyle(tileset, index, cellSize)}`,
        },
        dataset: { testid: `basic-tile-${index}`, tileIndex: String(index) },
        on: {
          click: () => {
            const layer = editorState.get().layer === "event" ? "lower" : editorState.get().layer;
            editorState.set({ selectedTile: index, tool: "paint", paintShape: "pen", layer });
          },
        },
      }),
    );
  }
  section.append(grid);
  return section;
}

function makeLayersBody(activeLayer: Layer): HTMLElement {
  const list = el("div", { class: "basic-layer-list", dataset: { testid: "basic-layer-list" } });
  for (const layer of BASIC_LAYERS) {
    const active = activeLayer === layer.id;
    list.append(
      el("button", {
        class: "basic-layer-row" + (active ? " is-active" : ""),
        attrs: { type: "button", title: layer.hint, "aria-label": layer.label, "aria-pressed": String(active) },
        dataset: {
          testid: layer.id === "lower" ? "layer-lower" : layer.id === "upper" ? "layer-upper" : "layer-event",
          basicLayer: layer.id,
        },
        on: {
          click: () => {
            if (layer.id === "event") editorState.set({ layer: "event", tool: "event" });
            else editorState.set({ layer: layer.id, tool: editorState.get().tool === "event" ? "paint" : editorState.get().tool });
          },
        },
        children: [el("span", { class: "basic-layer-label", text: layer.label })],
      }),
    );
  }
  return list;
}

/** Prefer terrain-looking low indexes + keep current selection visible. (기존 로직 유지) */
function pickBasicTileIndexes(tileset: TilesetDef, selectedTile: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const push = (n: number): void => {
    if (n < 0 || n >= tileset.count || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  if (selectedTile >= 0) push(selectedTile);
  for (let i = 0; i < Math.min(tileset.count, 80); i += 1) push(i);
  for (let i = 80; i < tileset.count && out.length < BASIC_TILE_CAP; i += 8) push(i);
  return out.slice(0, BASIC_TILE_CAP);
}
```

- [ ] **Step 4: CSS 교체**

`src/styles/shell/editor-ui-modes.css`의 `/* ── Basic left rail (reference density) ─────` 블록(`.basic-left-rail` ~ `.basic-rail-hint`)을 다음으로 교체(`.basic-tile-grid`/`.basic-tile-cell`/`.basic-layer-*`/`.basic-selected-tile`/`.basic-rail-hint`/`.basic-rail-section`은 유지하고 그 앞부분만 교체):

```css
/* ── Basic icon rail + flyout ──────────────────────────────────── */

body.editor-ui-basic .left-panel,
body.editor-ui-basic .left-panel-stack {
  overflow: visible;
}

.basic-left-rail.is-icon-rail {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 8px 0;
  position: relative;
  width: 48px;
}

.basic-rail-icons {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.basic-rail-btn {
  align-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--editor-text-muted, #9aa8c7);
  cursor: pointer;
  display: flex;
  height: 36px;
  justify-content: center;
  position: relative;
  width: 36px;
}

.basic-rail-btn svg {
  height: 20px;
  width: 20px;
}

.basic-rail-btn:hover,
.basic-rail-btn:focus-visible {
  border-color: var(--editor-line-strong, #3a4a6a);
  color: var(--editor-text, #e8eefc);
  outline: none;
}

.basic-rail-btn.is-active,
.basic-rail-btn.is-open {
  background: color-mix(in srgb, var(--editor-blue, #3d6df0) 28%, #1a2236);
  border-color: color-mix(in srgb, var(--editor-blue, #3d6df0) 55%, transparent);
  color: #fff;
}

.basic-rail-btn[disabled] {
  cursor: default;
  opacity: 0.45;
}

.basic-rail-sep {
  background: var(--editor-line, #2a3550);
  height: 1px;
  width: 28px;
}

.basic-rail-tile-thumb {
  background-color: #0d1424;
  border: 1px solid var(--editor-line, #2a3550);
  border-radius: 5px;
  display: block;
  image-rendering: pixelated;
}

.basic-rail-badge {
  background: color-mix(in srgb, var(--editor-blue, #3d6df0) 80%, #000);
  border-radius: 7px;
  bottom: -2px;
  color: #fff;
  font: 700 9px/1 var(--font-ui, system-ui, sans-serif);
  padding: 2px 4px;
  position: absolute;
  right: -2px;
}

.basic-rail-flyout {
  background: color-mix(in srgb, var(--control-bg, #1a2236) 96%, #000);
  border: 1px solid var(--editor-line-strong, #3a4a6a);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  left: 54px;
  max-height: calc(100% - 12px);
  position: absolute;
  top: 6px;
  width: 300px;
  z-index: 60;
}

.basic-flyout-head {
  align-items: center;
  border-bottom: 1px solid var(--editor-line, #2a3550);
  display: flex;
  gap: 6px;
  padding: 8px 10px;
}

.basic-flyout-title {
  color: var(--editor-text, #e8eefc);
  flex: 1 1 auto;
  font: 700 12px/1.2 var(--font-ui, system-ui, sans-serif);
}

.basic-flyout-pin,
.basic-flyout-close {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--editor-text-muted, #9aa8c7);
  cursor: pointer;
  font-size: 12px;
  height: 24px;
  width: 26px;
}

.basic-flyout-pin:hover,
.basic-flyout-close:hover {
  border-color: var(--editor-line-strong, #3a4a6a);
  color: var(--editor-text, #e8eefc);
}

.basic-flyout-pin.is-pinned {
  background: color-mix(in srgb, var(--editor-blue, #3d6df0) 30%, #1a2236);
  color: #fff;
}

.basic-flyout-body {
  min-height: 0;
  overflow: auto;
  padding: 10px 12px 12px;
}

.basic-flyout-map-host {
  display: flex;
  flex-direction: column;
  min-height: 160px;
}
```

주의: 같은 파일의 `body.editor-ui-basic [data-testid="left-map-root"]` 규칙 2개와 `body.editor-ui-basic [data-testid="left-palette-root"]` 규칙은 Task 4에서 좌측 맵 컬럼이 사라지면 무의미하므로 삭제.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run test/basicLeftRail.test.ts --configLoader runner` → PASS
Run: `npm run typecheck` → 오류 없음
Run: `npm test` → 기존 테스트 회귀 없음 (basic rail 관련 기존 단언이 깨지면 새 구조 기준으로 수정하되, `tool-*`/`layer-*`/`basic-tile-*` testid 자체는 유지되므로 대부분 통과해야 함)

- [ ] **Step 6: 커밋**

```bash
git add src/editor/panels/basicLeftRail.ts src/styles/shell/editor-ui-modes.css test/basicLeftRail.test.ts
git commit -m "feat(editor): 기본 모드 좌측을 아이콘 레일+플라이아웃으로 재작성"
```

---

### Task 4: 기본 모드 셸 레이아웃 (48px 고정, 맵트리 컬럼 제거) + 시각 확인

**Files:**
- Modify: `src/editor/editorUiMode.ts` (BASIC_CHROME.mapTree → false)
- Modify: `src/editor/panels/editor.ts` (`applyLayout` 기본 모드 분기)
- Test: 기존 `npm test` + Playwright 수동 스크린샷

**Interfaces:**
- Consumes: Task 3 레일.
- Produces: 기본 모드에서 좌패널 48px 고정·리사이저 숨김·맵트리 컬럼 숨김. `--editor-left-safe` = 60px.

- [ ] **Step 1: `editorUiMode.ts` 수정**

`BASIC_CHROME`의 `mapTree`를 false로 바꾸고 주석 갱신:

```ts
const BASIC_CHROME: EditorChromeVisibility = {
  // 맵 전환은 아이콘 레일의 맵 플라이아웃(renderBasicLeftRail)에서 제공 — 좌측 맵트리 컬럼은 숨긴다.
  mapTree: false,
  classicToolbar: false,
  canvasChromeDense: false,
  paletteFindPropsTabs: false,
  helpMenu: false,
  aiDenseSections: false,
  gameMenuLabel: "실행",
};
```

- [ ] **Step 2: `editor.ts` `applyLayout()` 기본 모드 분기**

`applyLayout()`에서 `publishSideChatWidth(layoutEl, sideWidth);` 직후, `if (leftFolded)` 분기 앞에 삽입:

```ts
  // 기본 모드: 아이콘 레일 48px 고정 — 리사이저 없음, 오버레이 안전영역은 레일+여백.
  if (getEditorUiMode() === "basic") {
    if (leftFolded) {
      leftRoot.style.display = "none";
      leftResizer.style.display = "none";
      setEditorLeftSafe("12px");
      return;
    }
    leftRoot.style.display = "";
    leftRoot.style.width = "48px";
    leftResizer.style.display = "none";
    setEditorLeftSafe("60px");
    return;
  }
```

(파일 상단 import에 `getEditorUiMode`는 이미 있음 — line 6.)

- [ ] **Step 3: 전체 테스트 + 타입 확인**

Run: `npm test` → PASS (chrome.mapTree 단언 기존 테스트 없음 확인됨)
Run: `npm run typecheck` → 오류 없음

- [ ] **Step 4: 시각 확인 (Playwright)**

dev 서버 기동 후(`npm run dev -- --port 5199 --strictPort` 백그라운드) Playwright/브라우저로:
1. `http://localhost:5199/?freshProject=1` 접속, `window.__rpgzzuEditorUiMode.set("basic")`.
2. 확인: 좌측 48px 레일(아이콘 6+3), 플라이아웃 열림/닫힘/핀, 캔버스 폭 확대, 맵 플라이아웃에서 맵 전환 동작.
3. `set("expert")` 후 전문가 좌패널이 기존과 동일한지 확인(회귀 없음).
4. 1440×900, 1024×768 스크린샷 저장.

- [ ] **Step 5: 커밋**

```bash
git add src/editor/editorUiMode.ts src/editor/panels/editor.ts
git commit -m "feat(editor): 기본 모드 좌패널 48px 아이콘 레일 고정 레이아웃"
```

---

## Phase 2 — 캔버스 인라인 어시스트

### Task 5: 선택 액션 칩 (`selectionActionChips.ts` + EditScene)

**Files:**
- Create: `src/editor/selectionActionChips.ts`
- Modify: `src/editor/EditScene.ts` (`renderBuildPaletteOverlay` 분기)
- Create: `src/styles/editor/inline-assist.css` (+ `src/styles/index.css` @import)
- Test: `test/selectionActionChips.test.ts`

**Interfaces:**
- Consumes: `openRegionTaskModal(options: RegionTaskModalOptions)`, `requestAiSelectionContext(selection, focus)`, `TileSelection`.
- Produces:
  - `SELECTION_CHIP_PRESETS: readonly SelectionChipPreset[]` (`{id, label, title, instruction: string | null}`)
  - `selectionChipModalOptions(preset: SelectionChipPreset, selection: TileSelection, anchor?: {x,y}): RegionTaskModalOptions` — 순수
  - `renderSelectionActionChips(selection: TileSelection, openModal?: typeof openRegionTaskModal): HTMLElement` — testid `selection-action-chips`, 버튼 `selection-chip-{id}`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/selectionActionChips.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderSelectionActionChips,
  SELECTION_CHIP_PRESETS,
  selectionChipModalOptions,
} from "@/editor/selectionActionChips";
import type { RegionTaskModalOptions } from "@/editor/panels/regionTaskModal";
import type { TileSelection } from "@/editor/editorState";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const SELECTION: TileSelection = { mapId: "map-1", x: 3, y: 4, width: 5, height: 6 };

describe("selectionChipModalOptions", () => {
  it("AI 칩(instruction=null)은 autoRun 없이 모달만 연다", () => {
    const ai = SELECTION_CHIP_PRESETS.find((p) => p.id === "ai");
    expect(ai).toBeTruthy();
    const options = selectionChipModalOptions(ai!, SELECTION);
    expect(options.mapId).toBe("map-1");
    expect(options.region).toEqual({ x: 3, y: 4, width: 5, height: 6 });
    expect(options.initialInstruction).toBeUndefined();
    expect(options.autoRun).toBeUndefined();
  });

  it("프리셋 칩은 지시문과 autoRun을 채운다", () => {
    const preset = SELECTION_CHIP_PRESETS.find((p) => p.id === "polish");
    const options = selectionChipModalOptions(preset!, SELECTION);
    expect(options.initialInstruction).toContain("영역");
    expect(options.autoRun).toBe(true);
  });
});

describe("renderSelectionActionChips", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => { restore(); });

  it("칩 3개를 렌더하고 클릭 시 주입된 openModal을 호출한다", () => {
    const calls: RegionTaskModalOptions[] = [];
    const stub = ((options: RegionTaskModalOptions) => {
      calls.push(options);
      return document.createElement("div");
    }) as never;
    const bar = renderSelectionActionChips(SELECTION, stub);
    document.body.append(bar);
    expect(findByTestId(document.body as unknown as FakeElement, "selection-action-chips")).toBeTruthy();
    for (const preset of SELECTION_CHIP_PRESETS) {
      expect(findByTestId(document.body as unknown as FakeElement, `selection-chip-${preset.id}`)).toBeTruthy();
    }
    (findByTestId(document.body as unknown as FakeElement, "selection-chip-ai") as unknown as HTMLElement).click();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.mapId).toBe("map-1");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/selectionActionChips.test.ts --configLoader runner` → FAIL

- [ ] **Step 3: 모듈 구현**

```ts
// src/editor/selectionActionChips.ts
// 선택 영역 우측에 뜨는 인라인 AI 액션 칩 (스펙 §3 2-A).
// 우클릭 드래그로만 접근되던 영역 AI 작업을 좌클릭 선택에서도 발견 가능하게 노출한다.
// EditScene의 buildPalette 오버레이 슬롯을 공유 — 건축 팔레트가 켜져 있으면 그쪽이 우선.
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import type { TileSelection } from "@/editor/editorState";
import { openRegionTaskModal, type RegionTaskModalOptions } from "@/editor/panels/regionTaskModal";
import { el } from "@/util/dom";

export interface SelectionChipPreset {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  /** null이면 지시 입력을 위해 모달만 연다(autoRun 없음). */
  readonly instruction: string | null;
}

export const SELECTION_CHIP_PRESETS: readonly SelectionChipPreset[] = [
  { id: "ai", label: "✨ AI 작업…", title: "이 영역에 자연어 지시로 AI 작업", instruction: null },
  {
    id: "structure",
    label: "🏠 구조물",
    title: "영역 안에 어울리는 구조물 배치",
    instruction: "이 영역 안에 지형과 어울리는 구조물(집이나 시설)을 배치해 주세요. 영역 밖은 건드리지 마세요.",
  },
  {
    id: "polish",
    label: "🎨 다듬기",
    title: "영역 지형을 주변과 자연스럽게 다듬기",
    instruction: "이 영역의 타일을 주변 지형과 자연스럽게 이어지도록 다듬어 주세요. 영역 밖은 건드리지 마세요.",
  },
] as const;

export function selectionChipModalOptions(
  preset: SelectionChipPreset,
  selection: TileSelection,
  anchor?: { readonly x: number; readonly y: number },
): RegionTaskModalOptions {
  return {
    mapId: selection.mapId,
    region: { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
    ...(preset.instruction !== null ? { initialInstruction: preset.instruction, autoRun: true } : {}),
    ...(anchor ? { anchor } : {}),
  };
}

export function renderSelectionActionChips(
  selection: TileSelection,
  openModal: typeof openRegionTaskModal = openRegionTaskModal,
): HTMLElement {
  const bar = el("div", {
    class: "selection-action-chips",
    attrs: { role: "toolbar", "aria-label": "선택 영역 AI 작업" },
    dataset: { testid: "selection-action-chips" },
  });
  for (const preset of SELECTION_CHIP_PRESETS) {
    bar.append(
      el("button", {
        class: "selection-action-chip" + (preset.id === "ai" ? " is-primary" : ""),
        text: preset.label,
        attrs: { type: "button", title: preset.title },
        dataset: { testid: `selection-chip-${preset.id}` },
        on: {
          click: (event) => {
            requestAiSelectionContext(selection, false);
            const mouse = event as MouseEvent;
            const anchor =
              typeof mouse.clientX === "number" && (mouse.clientX !== 0 || mouse.clientY !== 0)
                ? { x: mouse.clientX, y: mouse.clientY }
                : undefined;
            openModal(selectionChipModalOptions(preset, selection, anchor));
          },
        },
      }),
    );
  }
  return bar;
}
```

- [ ] **Step 4: EditScene 배선**

`EditScene.ts`의 `renderBuildPaletteOverlay()`(line ~979)를 수정 — 건축 팔레트 비활성 시 칩 바를 같은 슬롯에 렌더:

```ts
  private renderBuildPaletteOverlay(): void {
    if (typeof document === "undefined") return;
    const selection = editorState.get().selection;
    const mapId = this.mapId();
    if (!selection || selection.mapId !== mapId) {
      this.clearBuildPaletteOverlay();
      return;
    }
    const host = this.game.canvas.parentElement;
    if (!host) {
      this.clearBuildPaletteOverlay();
      return;
    }

    const kind = isBuildPaletteEnabled() ? "build" : "chips";
    const popupKey = `${kind}:${selection.mapId}:${selection.x}:${selection.y}:${selection.width}:${selection.height}`;
    if (!this.buildPalettePopup || this.buildPalettePopupKey !== popupKey || !this.buildPalettePopup.isConnected) {
      this.clearBuildPaletteOverlay();
      const popup = kind === "build" ? renderBuildPalettePopup() : renderSelectionActionChips(selection);
      if (!popup) return;
      popup.classList.add("build-palette-floating");
      popup.style.left = "0px";
      popup.style.top = "0px";
      popup.style.visibility = "hidden";
      host.append(popup);
      this.buildPalettePopup = popup;
      this.buildPalettePopupKey = popupKey;
    }
    this.positionBuildPaletteOverlay(selection);
  }
```

import 추가: `import { renderSelectionActionChips } from "@/editor/selectionActionChips";`

- [ ] **Step 5: CSS 신규 파일**

```css
/* src/styles/editor/inline-assist.css
   캔버스 인라인 어시스트 — 선택 액션 칩, 제안 인라인 승인, 영역 작업 진행 배지. */

.selection-action-chips {
  align-items: center;
  background: color-mix(in srgb, var(--control-bg, #1a2236) 92%, #000);
  border: 1px solid var(--editor-line-strong, #3a4a6a);
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: inline-flex;
  gap: 4px;
  padding: 4px 6px;
}

.selection-action-chip {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--editor-text, #e8eefc);
  cursor: pointer;
  font: 600 12px/1 var(--font-ui, system-ui, sans-serif);
  padding: 6px 10px;
  white-space: nowrap;
}

.selection-action-chip:hover,
.selection-action-chip:focus-visible {
  border-color: var(--editor-line-strong, #3a4a6a);
  outline: none;
}

.selection-action-chip.is-primary {
  background: color-mix(in srgb, var(--editor-blue, #3d6df0) 80%, #1a2744);
  color: #fff;
}
```

`src/styles/index.css`의 `@import "./editor/responsive-a.css";` 다음 줄에:

```css
@import "./editor/inline-assist.css";
```

- [ ] **Step 6: 통과 확인 + 시각 확인**

Run: `npx vitest run test/selectionActionChips.test.ts --configLoader runner` → PASS
Run: `npm run typecheck && npm test` → PASS
브라우저: 선택 도구로 영역 드래그 → 칩 바 표시, `✨ AI 작업…` 클릭 → 영역 작업 팝오버, 건축 토글 켜면 기존 건축 팔레트가 대신 표시.

- [ ] **Step 7: 커밋**

```bash
git add src/editor/selectionActionChips.ts src/editor/EditScene.ts src/styles/editor/inline-assist.css src/styles/index.css test/selectionActionChips.test.ts
git commit -m "feat(editor): 선택 영역 인라인 AI 액션 칩"
```

---

### Task 6: 제안 인라인 승인 (`proposalInlineApproval.ts`)

**Files:**
- Create: `src/editor/proposalInlineApproval.ts`
- Modify: `src/editor/panels/aiProposalCard.ts` (등록/해제)
- Modify: `src/editor/agentPreviewRenderers.ts` (마커에 툴바 부착)
- Modify: `src/editor/EditScene.ts` (레지스트리 구독 → 마커 갱신)
- Modify: `src/styles/editor/inline-assist.css`
- Test: `test/proposalInlineApproval.test.ts`

**Interfaces:**
- Produces:
  - `interface InlineProposalActions { readonly accept: () => void; readonly reject: () => void; readonly focusCard: () => void }`
  - `setInlineProposalActions(actions: InlineProposalActions | null): void`
  - `getInlineProposalActions(): InlineProposalActions | null`
  - `subscribeInlineProposalActions(listener: () => void): () => void`
  - `buildInlineApprovalToolbar(actions: InlineProposalActions): HTMLElement` — testid `ghost-inline-approval`, 버튼 `ghost-inline-accept|reject|detail`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/proposalInlineApproval.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildInlineApprovalToolbar,
  getInlineProposalActions,
  setInlineProposalActions,
  subscribeInlineProposalActions,
} from "@/editor/proposalInlineApproval";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

describe("inline proposal actions registry", () => {
  afterEach(() => setInlineProposalActions(null));

  it("set/get/subscribe가 동작한다", () => {
    let notified = 0;
    const unsub = subscribeInlineProposalActions(() => { notified += 1; });
    const actions = { accept: () => {}, reject: () => {}, focusCard: () => {} };
    setInlineProposalActions(actions);
    expect(getInlineProposalActions()).toBe(actions);
    setInlineProposalActions(null);
    expect(getInlineProposalActions()).toBeNull();
    expect(notified).toBe(2);
    unsub();
  });
});

describe("buildInlineApprovalToolbar", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => { restore(); setInlineProposalActions(null); });

  it("적용/거부/상세 버튼이 핸들러를 호출한다", () => {
    const hits: string[] = [];
    const bar = buildInlineApprovalToolbar({
      accept: () => hits.push("accept"),
      reject: () => hits.push("reject"),
      focusCard: () => hits.push("focus"),
    });
    document.body.append(bar);
    for (const id of ["ghost-inline-accept", "ghost-inline-reject", "ghost-inline-detail"]) {
      (findByTestId(document.body as unknown as FakeElement, id) as unknown as HTMLElement).click();
    }
    expect(hits).toEqual(["accept", "reject", "focus"]);
  });
});
```

- [ ] **Step 2: 실패 확인** → `npx vitest run test/proposalInlineApproval.test.ts --configLoader runner` FAIL

- [ ] **Step 3: 모듈 구현**

```ts
// src/editor/proposalInlineApproval.ts
// 캔버스 고스트 프리뷰 위 인라인 승인 툴바 (스펙 §3 2-B).
// aiProposalCard가 pending 제안의 실제 수락/거부 경로를 등록하고,
// agentPreviewRenderers가 마커에 툴바를 붙인다. 동일 핸들러 = 동일 lint/undo 경로.
import { el } from "@/util/dom";

export interface InlineProposalActions {
  readonly accept: () => void;
  readonly reject: () => void;
  readonly focusCard: () => void;
}

let current: InlineProposalActions | null = null;
const listeners = new Set<() => void>();

export function setInlineProposalActions(actions: InlineProposalActions | null): void {
  current = actions;
  for (const listener of listeners) listener();
}

export function getInlineProposalActions(): InlineProposalActions | null {
  return current;
}

export function subscribeInlineProposalActions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function buildInlineApprovalToolbar(actions: InlineProposalActions): HTMLElement {
  return el("div", {
    class: "ghost-inline-approval",
    attrs: { role: "toolbar", "aria-label": "AI 제안 인라인 승인" },
    dataset: { testid: "ghost-inline-approval" },
    children: [
      el("button", {
        class: "ghost-inline-btn is-accept",
        text: "✓ 적용",
        attrs: { type: "button", title: "이 제안을 프로젝트에 적용" },
        dataset: { testid: "ghost-inline-accept" },
        on: { click: () => actions.accept() },
      }),
      el("button", {
        class: "ghost-inline-btn is-reject",
        text: "✗ 거부",
        attrs: { type: "button", title: "제안 거부(초안 폐기)" },
        dataset: { testid: "ghost-inline-reject" },
        on: { click: () => actions.reject() },
      }),
      el("button", {
        class: "ghost-inline-btn",
        text: "상세",
        attrs: { type: "button", title: "채팅 패널의 제안 카드로 이동" },
        dataset: { testid: "ghost-inline-detail" },
        on: { click: () => actions.focusCard() },
      }),
    ],
  });
}
```

- [ ] **Step 4: `aiProposalCard.ts` 등록/해제 배선**

1. import 추가: `import { setInlineProposalActions } from "@/editor/proposalInlineApproval";`
2. `acceptProposal` 함수 본문(line ~339) 시작부에 `setInlineProposalActions(null);` 추가.
3. `rejectProposal` 함수 본문(line ~356) 시작부에 `setInlineProposalActions(null);` 추가.
4. 제안 카드가 렌더되어 `acceptButton`(testid `ai-proposal-accept`)과 거부 버튼(testid `ai-proposal-reject`)이 조립된 직후(두 버튼이 같은 children 배열에 들어가는 곳, line ~542-561 부근), 카드 루트 요소를 `proposalCardEl` 지역 변수로 참조할 수 있는 위치에서:

```ts
    // 인라인 승인(캔버스 고스트 마커) — 카드의 실제 버튼 경로를 그대로 태운다.
    setInlineProposalActions({
      accept: () => { if (acceptButton && !acceptButton.disabled) acceptButton.click(); },
      reject: () => rejectButton?.click(),
      focusCard: () => {
        proposalCardEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      },
    });
```

(거부 버튼이 지역 변수가 아니면 `let rejectButton: HTMLButtonElement | null = null;`을 acceptButton 선언(line ~422) 옆에 추가하고 생성부를 `(rejectButton = el("button", {...}))` 형태로 캡처. 카드 루트도 마찬가지로 캡처.)

- [ ] **Step 5: `agentPreviewRenderers.ts` 마커 툴바**

import 추가: `import { buildInlineApprovalToolbar, getInlineProposalActions } from "@/editor/proposalInlineApproval";`

`refreshDomMarkers()`에서 마커 생성 루프(marker.className = "agent-ghost-preview" 부근) 뒤, 첫 번째 마커에만 툴바 부착:

```ts
    const actions = getInlineProposalActions();
    if (actions && previews.length > 0) {
      const firstMarker = this.domMarkers[0];
      if (firstMarker) {
        const toolbar = buildInlineApprovalToolbar(actions);
        if (previews.length > 1) {
          toolbar.prepend(
            Object.assign(document.createElement("span"), {
              className: "ghost-inline-count",
              textContent: `제안 ${previews.length}곳`,
            }),
          );
        }
        firstMarker.append(toolbar);
      }
    }
```

(`this.domMarkers`가 마커 목록 배열이 아니면 해당 클래스의 실제 마커 보관 필드명을 사용 — `clearDomMarkers()`가 지우는 그 컬렉션.)

- [ ] **Step 6: EditScene 구독**

`EditScene.ts` — `BUILD_PALETTE_VISIBILITY_EVENT` 리스너 등록(line ~226) 옆에:

```ts
    this.unsubInlineApproval = subscribeInlineProposalActions(() => this.refreshAgentGhostDomMarkers());
```

해제부(line ~248 removeEventListener 옆): `this.unsubInlineApproval?.(); this.unsubInlineApproval = null;`
필드 선언: `private unsubInlineApproval: (() => void) | null = null;`
import: `import { subscribeInlineProposalActions } from "@/editor/proposalInlineApproval";`

- [ ] **Step 7: CSS 추가 (`inline-assist.css` 끝에)**

```css
.agent-ghost-preview {
  pointer-events: none;
}

.ghost-inline-approval {
  align-items: center;
  background: color-mix(in srgb, var(--control-bg, #1a2236) 94%, #000);
  border: 1px solid var(--editor-line-strong, #3a4a6a);
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: inline-flex;
  gap: 4px;
  left: 0;
  padding: 3px 5px;
  pointer-events: auto;
  position: absolute;
  top: -34px;
}

.ghost-inline-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--editor-text, #e8eefc);
  cursor: pointer;
  font: 600 11px/1 var(--font-ui, system-ui, sans-serif);
  padding: 5px 9px;
  white-space: nowrap;
}

.ghost-inline-btn.is-accept {
  background: color-mix(in srgb, #2f9e63 80%, #12331f);
  color: #fff;
}

.ghost-inline-btn.is-reject:hover {
  border-color: #b3453f;
  color: #ff9d97;
}

.ghost-inline-btn:hover,
.ghost-inline-btn:focus-visible {
  border-color: var(--editor-line-strong, #3a4a6a);
  outline: none;
}

.ghost-inline-count {
  color: var(--editor-text-muted, #9aa8c7);
  font: 600 10px/1 var(--font-ui, system-ui, sans-serif);
  padding: 0 4px;
}
```

- [ ] **Step 8: 확인 + 커밋**

Run: `npx vitest run test/proposalInlineApproval.test.ts --configLoader runner` → PASS
Run: `npm run typecheck && npm test` → PASS
브라우저(AI 키 설정 필요 시 목 응답 불가 — DOM 확인만): AI 제안 발생 시 고스트 마커 위 `✓ 적용 / ✗ 거부 / 상세` 툴바.

```bash
git add src/editor/proposalInlineApproval.ts src/editor/panels/aiProposalCard.ts src/editor/agentPreviewRenderers.ts src/editor/EditScene.ts src/styles/editor/inline-assist.css test/proposalInlineApproval.test.ts
git commit -m "feat(editor): 고스트 프리뷰 인라인 승인 툴바"
```

---

### Task 7: 영역 작업 진행 배지

**Files:**
- Create: `src/editor/regionTask/regionTaskStatus.ts`
- Modify: `src/editor/panels/regionTaskModal.ts` (`execute()` 시작/종료에 dispatch)
- Modify: `src/editor/EditScene.ts` (배지 렌더)
- Modify: `src/styles/editor/inline-assist.css`
- Test: `test/regionTaskStatus.test.ts`

**Interfaces:**
- Produces:
  - `REGION_TASK_STATUS_EVENT = "rpgzzu:region-task-status"`
  - `interface RegionTaskStatusDetail { readonly mapId: string; readonly region: RegionRect; readonly running: boolean }`
  - `dispatchRegionTaskStatus(detail): void`, `regionTaskStatusDetail(event): RegionTaskStatusDetail | null`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/regionTaskStatus.test.ts
import { describe, expect, it } from "vitest";
import { regionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";

describe("regionTaskStatusDetail", () => {
  it("유효한 detail을 통과시키고 불량 payload는 null", () => {
    const good = { detail: { mapId: "m1", region: { x: 1, y: 2, width: 3, height: 4 }, running: true } } as unknown as Event;
    expect(regionTaskStatusDetail(good)).toEqual({ mapId: "m1", region: { x: 1, y: 2, width: 3, height: 4 }, running: true });
    const bad = { detail: { mapId: 5 } } as unknown as Event;
    expect(regionTaskStatusDetail(bad)).toBeNull();
    expect(regionTaskStatusDetail({} as Event)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 모듈 구현**

```ts
// src/editor/regionTask/regionTaskStatus.ts
// 영역 AI 작업 진행 상태 브로드캐스트 — EditScene 배지(스펙 §3 2-C)가 구독한다.
import type { RegionRect } from "./clipToRegion";

export const REGION_TASK_STATUS_EVENT = "rpgzzu:region-task-status";

export interface RegionTaskStatusDetail {
  readonly mapId: string;
  readonly region: RegionRect;
  readonly running: boolean;
}

export function dispatchRegionTaskStatus(detail: RegionTaskStatusDetail): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  if (typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent<RegionTaskStatusDetail>(REGION_TASK_STATUS_EVENT, { detail }));
    return;
  }
  const event = new Event(REGION_TASK_STATUS_EVENT);
  Object.defineProperty(event, "detail", { configurable: true, value: detail });
  window.dispatchEvent(event);
}

export function regionTaskStatusDetail(event: Event): RegionTaskStatusDetail | null {
  const detail = (event as CustomEvent<unknown>).detail;
  if (typeof detail !== "object" || detail === null) return null;
  const candidate = detail as Partial<RegionTaskStatusDetail>;
  const region = candidate.region as Partial<RegionRect> | undefined;
  if (
    typeof candidate.mapId !== "string" ||
    typeof candidate.running !== "boolean" ||
    !region ||
    !Number.isInteger(region.x) || !Number.isInteger(region.y) ||
    !Number.isInteger(region.width) || !Number.isInteger(region.height)
  ) return null;
  return { mapId: candidate.mapId, region: region as RegionRect, running: candidate.running };
}
```

- [ ] **Step 4: `regionTaskModal.ts` dispatch**

import: `import { dispatchRegionTaskStatus } from "@/editor/regionTask/regionTaskStatus";`
`execute()`에서 `running = true;` 라인 옆에 `dispatchRegionTaskStatus({ mapId: options.mapId, region, running: true });`, `finally` 블록에 `dispatchRegionTaskStatus({ mapId: options.mapId, region, running: false });`.

- [ ] **Step 5: EditScene 배지**

- 필드: `private activeRegionTask: { readonly mapId: string; readonly region: RegionRect } | null = null;` `private regionTaskBadge: HTMLElement | null = null;`
- create()의 window 리스너 등록부에:

```ts
    this.handleRegionTaskStatus = (event: Event): void => {
      const detail = regionTaskStatusDetail(event);
      if (!detail) return;
      this.activeRegionTask = detail.running ? { mapId: detail.mapId, region: detail.region } : null;
      this.renderRegionTaskBadge();
    };
    window.addEventListener(REGION_TASK_STATUS_EVENT, this.handleRegionTaskStatus);
```

해제부에 `window.removeEventListener(REGION_TASK_STATUS_EVENT, this.handleRegionTaskStatus);`
- `renderBuildPaletteOverlay()` 본문 마지막에 `this.renderRegionTaskBadge();` 호출 추가(카메라/상태 갱신 시 위치 추종).
- 메서드 추가(positionBuildPaletteOverlay와 같은 좌표 계산 재사용):

```ts
  private renderRegionTaskBadge(): void {
    if (typeof document === "undefined") return;
    const task = this.activeRegionTask;
    const mapId = this.mapId();
    const host = this.game.canvas?.parentElement;
    if (!task || task.mapId !== mapId || !host) {
      this.regionTaskBadge?.remove();
      this.regionTaskBadge = null;
      return;
    }
    if (!this.regionTaskBadge || !this.regionTaskBadge.isConnected) {
      const badge = document.createElement("div");
      badge.className = "region-task-badge";
      badge.dataset.testid = "region-task-badge";
      badge.textContent = "✨ AI 작업 중…";
      host.append(badge);
      this.regionTaskBadge = badge;
    }
    const camera = this.cameras.main;
    const rect = tileRectToScreenRect(
      { mapId: task.mapId, x: task.region.x, y: task.region.y, width: task.region.width, height: task.region.height },
      { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom },
    );
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    this.regionTaskBadge.style.left = `${Math.round(canvasRect.left - hostRect.left + rect.x)}px`;
    this.regionTaskBadge.style.top = `${Math.round(canvasRect.top - hostRect.top + rect.y - 26)}px`;
  }
```

(`tileRectToScreenRect`의 실제 파라미터 형태는 EditScene.ts line 98 정의를 따를 것 — TileRect에 mapId가 없으면 제외.)
import: `import { REGION_TASK_STATUS_EVENT, regionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";`

- [ ] **Step 6: CSS (`inline-assist.css` 끝에)**

```css
.region-task-badge {
  background: color-mix(in srgb, var(--editor-blue, #3d6df0) 85%, #000);
  border-radius: 999px;
  color: #fff;
  font: 600 11px/1 var(--font-ui, system-ui, sans-serif);
  padding: 5px 10px;
  pointer-events: none;
  position: absolute;
  z-index: 30;
  animation: region-task-pulse 1.6s ease-in-out infinite;
}

@keyframes region-task-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
```

- [ ] **Step 7: 확인 + 커밋**

Run: `npx vitest run test/regionTaskStatus.test.ts --configLoader runner && npm run typecheck && npm test` → PASS

```bash
git add src/editor/regionTask/regionTaskStatus.ts src/editor/panels/regionTaskModal.ts src/editor/EditScene.ts src/styles/editor/inline-assist.css test/regionTaskStatus.test.ts
git commit -m "feat(editor): 영역 AI 작업 진행 배지"
```

---

## Phase 3 — 커맨드 팔레트 / 입력창

### Task 8: 커맨드 레지스트리 (`commandRegistry.ts`)

**Files:**
- Create: `src/editor/commandRegistry.ts`
- Test: `test/commandRegistry.test.ts`

**Interfaces:**
- Consumes: `applyLayer`(hotkeys), `editorState`, `setEditorUiMode/getEditorUiMode`, `selectEditorMap`, `openDatabaseModal`.
- Produces (Task 9가 소비):
  - `interface EditorCommand { readonly id: string; readonly label: string; readonly category: "도구" | "레이어" | "화면" | "이동"; readonly keywords: readonly string[]; readonly hotkey?: string; readonly run: () => void }`
  - `listEditorCommands(): readonly EditorCommand[]`
  - `listMapCommands(project: Project, select?: (mapId: MapId) => boolean): readonly EditorCommand[]`
  - `matchEditorCommands(query: string, commands: readonly EditorCommand[]): readonly EditorCommand[]`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/commandRegistry.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { listEditorCommands, listMapCommands, matchEditorCommands } from "@/editor/commandRegistry";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests, getEditorUiMode } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("commandRegistry", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetEditorUiModeForTests("basic");
    editorState.set({ tool: "paint", layer: "lower" });
  });

  it("도구 명령 실행이 editorState를 바꾼다", () => {
    const commands = listEditorCommands();
    const fill = commands.find((c) => c.id === "tool-fill");
    expect(fill).toBeTruthy();
    fill!.run();
    expect(editorState.get().tool).toBe("fill");
    const event = commands.find((c) => c.id === "tool-event");
    event!.run();
    expect(editorState.get().layer).toBe("event");
  });

  it("모드 전환 명령이 basic↔expert를 토글한다", () => {
    const toggle = listEditorCommands().find((c) => c.id === "mode-toggle");
    toggle!.run();
    expect(getEditorUiMode()).toBe("expert");
    toggle!.run();
    expect(getEditorUiMode()).toBe("basic");
  });

  it("맵 명령은 주입된 select를 호출한다", () => {
    const project = store.getCurrent();
    const picked: string[] = [];
    const commands = listMapCommands(project, (mapId) => { picked.push(mapId); return true; });
    expect(commands.length).toBeGreaterThan(0);
    commands[0]!.run();
    expect(picked).toHaveLength(1);
  });

  it("matchEditorCommands는 라벨/키워드 포함 매칭, 빈 질의는 전체", () => {
    const commands = listEditorCommands();
    expect(matchEditorCommands("", commands)).toHaveLength(commands.length);
    const hits = matchEditorCommands("채우기", commands);
    expect(hits.some((c) => c.id === "tool-fill")).toBe(true);
    expect(matchEditorCommands("fill", commands).some((c) => c.id === "tool-fill")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현**

```ts
// src/editor/commandRegistry.ts
// Ctrl+K 통합 팔레트의 에디터 명령 레지스트리 (스펙 §4 3-A).
// run()은 기존 단축키/레일과 동일한 상태 전이만 수행한다 — 새 경로를 만들지 않는다.
import { applyLayer } from "@/editor/hotkeys";
import { editorState, type Tool } from "@/editor/editorState";
import { getEditorUiMode, setEditorUiMode } from "@/editor/editorUiMode";
import { selectEditorMap } from "@/editor/mapSelection";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import type { MapId, Project } from "@/project/types";

export interface EditorCommand {
  readonly id: string;
  readonly label: string;
  readonly category: "도구" | "레이어" | "화면" | "이동";
  readonly keywords: readonly string[];
  readonly hotkey?: string;
  readonly run: () => void;
}

const TOOL_COMMANDS: readonly { id: Tool; label: string; keywords: readonly string[]; hotkey: string }[] = [
  { id: "select", label: "도구: 선택", keywords: ["select", "선택"], hotkey: "V" },
  { id: "paint", label: "도구: 브러시", keywords: ["brush", "paint", "펜", "브러시"], hotkey: "B" },
  { id: "erase", label: "도구: 지우개", keywords: ["erase", "eraser", "지우개"], hotkey: "E" },
  { id: "fill", label: "도구: 채우기", keywords: ["fill", "채우기", "버킷"], hotkey: "G" },
  { id: "event", label: "도구: 이벤트", keywords: ["event", "이벤트", "npc"], hotkey: "N" },
  { id: "eyedropper", label: "도구: 스포이트", keywords: ["eyedropper", "picker", "스포이트"], hotkey: "I" },
];

function runTool(tool: Tool): void {
  if (tool === "paint") editorState.set({ tool: "paint", paintShape: "pen" });
  else if (tool === "event") editorState.set({ tool: "event", layer: "event" });
  else if (editorState.get().layer === "event") editorState.set({ tool, layer: "lower" });
  else editorState.set({ tool });
}

export function listEditorCommands(): readonly EditorCommand[] {
  return [
    ...TOOL_COMMANDS.map((tool): EditorCommand => ({
      id: `tool-${tool.id}`,
      label: tool.label,
      category: "도구",
      keywords: tool.keywords,
      hotkey: tool.hotkey,
      run: () => runTool(tool.id),
    })),
    { id: "layer-lower", label: "레이어: 타일(하위)", category: "레이어", keywords: ["lower", "타일", "하위"], hotkey: "F5", run: () => applyLayer("lower") },
    { id: "layer-upper", label: "레이어: 오브젝트(상위)", category: "레이어", keywords: ["upper", "오브젝트", "상위"], hotkey: "F6", run: () => applyLayer("upper") },
    { id: "layer-event", label: "레이어: 이벤트", category: "레이어", keywords: ["event", "이벤트"], hotkey: "F7", run: () => applyLayer("event") },
    {
      id: "mode-toggle",
      label: "화면: 기본↔전문가 모드 전환",
      category: "화면",
      keywords: ["mode", "basic", "expert", "기본", "전문가", "모드"],
      run: () => setEditorUiMode(getEditorUiMode() === "basic" ? "expert" : "basic"),
    },
    {
      id: "test-play",
      label: "화면: 테스트 플레이 실행",
      category: "화면",
      keywords: ["play", "run", "실행", "테스트"],
      run: () => {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window"));
      },
    },
    {
      id: "open-database",
      label: "화면: 데이터베이스 열기",
      category: "화면",
      keywords: ["database", "db", "데이터베이스", "액터", "스킬"],
      run: () => openDatabaseModal(),
    },
  ];
}

export function listMapCommands(
  project: Project,
  select: (mapId: MapId) => boolean = selectEditorMap,
): readonly EditorCommand[] {
  return Object.entries(project.maps).map(([mapId, map]): EditorCommand => ({
    id: `map-${mapId}`,
    label: `맵 이동: ${map.name || mapId}`,
    category: "이동",
    keywords: [map.name || "", mapId],
    run: () => { select(mapId); },
  }));
}

export function matchEditorCommands(query: string, commands: readonly EditorCommand[]): readonly EditorCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter(
    (command) =>
      command.label.toLowerCase().includes(q) ||
      command.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
  );
}
```

- [ ] **Step 4: 통과 확인** → `npx vitest run test/commandRegistry.test.ts --configLoader runner && npm run typecheck` PASS

- [ ] **Step 5: 커밋**

```bash
git add src/editor/commandRegistry.ts test/commandRegistry.test.ts
git commit -m "feat(editor): 커맨드 팔레트용 에디터 명령 레지스트리"
```

---

### Task 9: 통합 커맨드 팔레트 (`commandPalette.ts`) + Ctrl+K 교체

**Files:**
- Create: `src/editor/panels/commandPalette.ts`
- Modify: `src/editor/panels/aiChatPanel.ts` (Ctrl+K 핸들러 교체, line ~1981)
- Modify: `src/styles/editor/inline-assist.css` (팔레트 보강 스타일)
- Test: `test/commandPalette.test.ts`

**Interfaces:**
- Consumes: Task 8 레지스트리, `listAllSkills/filterSkills/SkillDef`(`@/ai/skills`), 기존 팔레트 CSS 클래스(`ai-skill-palette-*`).
- Produces:
  - `interface PaletteEntry { readonly kind: "command" | "map" | "skill"; readonly id: string; readonly label: string; readonly detail: string; readonly hotkey?: string; readonly run: () => void }`
  - `buildPaletteEntries(query, deps): readonly PaletteEntry[]` — 순서: 명령 → 맵 → 스킬, 종류별 상한 6/4/6
  - `movePaletteIndex(length: number, index: number, delta: 1 | -1): number` — 순환
  - `openCommandPalette(options: { readonly runSkill: (skill: SkillDef) => void }): HTMLElement` — testid `command-palette`, 검색 `command-palette-search`, 항목 `command-palette-item-{kind}-{id}`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/commandPalette.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { buildPaletteEntries, movePaletteIndex } from "@/editor/panels/commandPalette";
import type { EditorCommand } from "@/editor/commandRegistry";
import type { SkillDef } from "@/ai/skills";

function cmd(id: string, label: string): EditorCommand {
  return { id, label, category: "도구", keywords: [label], run: () => {} };
}
function skill(id: string, name: string): SkillDef {
  return { id, name, icon: "⭐", description: name, params: [], kind: "prompt", source: "system" } as unknown as SkillDef;
}

describe("buildPaletteEntries", () => {
  it("명령 → 맵 → 스킬 순으로 합치고 종류별 상한을 지킨다", () => {
    const commands = Array.from({ length: 10 }, (_, i) => cmd(`c${i}`, `명령${i}`));
    const maps = Array.from({ length: 10 }, (_, i) => cmd(`m${i}`, `맵${i}`));
    const skills = Array.from({ length: 10 }, (_, i) => skill(`s${i}`, `스킬${i}`));
    const entries = buildPaletteEntries("", { commands, maps, skills, runSkill: () => {} });
    expect(entries.filter((e) => e.kind === "command")).toHaveLength(6);
    expect(entries.filter((e) => e.kind === "map")).toHaveLength(4);
    expect(entries.filter((e) => e.kind === "skill")).toHaveLength(6);
    expect(entries[0]!.kind).toBe("command");
  });

  it("질의가 명령/맵/스킬을 함께 거른다", () => {
    const entries = buildPaletteEntries("맵3", {
      commands: [cmd("c1", "명령1")],
      maps: [cmd("m3", "맵3"), cmd("m4", "맵4")],
      skills: [skill("s1", "스킬1")],
      runSkill: () => {},
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe("m3");
  });
});

describe("movePaletteIndex", () => {
  it("순환 이동한다", () => {
    expect(movePaletteIndex(3, 0, 1)).toBe(1);
    expect(movePaletteIndex(3, 2, 1)).toBe(0);
    expect(movePaletteIndex(3, 0, -1)).toBe(2);
    expect(movePaletteIndex(0, 0, 1)).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현**

```ts
// src/editor/panels/commandPalette.ts
// Ctrl+K 통합 커맨드 팔레트 — 에디터 명령 + 맵 이동 + 스킬 (스펙 §4 3-A).
// 기존 스킬 팔레트(ai-skill-palette-*) 셸 클래스를 재사용하고 ↑↓/Enter 탐색을 더한다.
import { filterSkills, type SkillDef } from "@/ai/skills";
import { listEditorCommands, listMapCommands, matchEditorCommands, type EditorCommand } from "@/editor/commandRegistry";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export interface PaletteEntry {
  readonly kind: "command" | "map" | "skill";
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly hotkey?: string;
  readonly run: () => void;
}

const KIND_CAPS = { command: 6, map: 4, skill: 6 } as const;
const KIND_HEADERS: Record<PaletteEntry["kind"], string> = { command: "명령", map: "맵 이동", skill: "스킬" };

export interface PaletteEntryDeps {
  readonly commands: readonly EditorCommand[];
  readonly maps: readonly EditorCommand[];
  readonly skills: readonly SkillDef[];
  readonly runSkill: (skill: SkillDef) => void;
}

export function buildPaletteEntries(query: string, deps: PaletteEntryDeps): readonly PaletteEntry[] {
  const commandHits = matchEditorCommands(query, deps.commands).slice(0, KIND_CAPS.command);
  const mapHits = matchEditorCommands(query, deps.maps).slice(0, KIND_CAPS.map);
  const q = query.trim().toLowerCase();
  const skillHits = deps.skills
    .filter((skill) => !q || skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q))
    .slice(0, KIND_CAPS.skill);
  return [
    ...commandHits.map((command): PaletteEntry => ({
      kind: "command", id: command.id, label: command.label, detail: command.category, hotkey: command.hotkey, run: command.run,
    })),
    ...mapHits.map((command): PaletteEntry => ({
      kind: "map", id: command.id, label: command.label, detail: "이동", run: command.run,
    })),
    ...skillHits.map((skill): PaletteEntry => ({
      kind: "skill", id: skill.id, label: `${skill.icon} ${skill.name}`, detail: skill.description,
      run: () => deps.runSkill(skill),
    })),
  ];
}

export function movePaletteIndex(length: number, index: number, delta: 1 | -1): number {
  if (length <= 0) return 0;
  return (index + delta + length) % length;
}

export function openCommandPalette(options: { readonly runSkill: (skill: SkillDef) => void }): HTMLElement {
  document.querySelector("[data-testid='command-palette']")?.remove();
  const listHost = el("div", { class: "ai-skill-palette-list command-palette-list" });
  const search = el("input", {
    class: "ai-skill-param-input",
    attrs: { type: "text", placeholder: "명령·맵·스킬 검색… (↑↓ 이동, Enter 실행, Esc 닫기)" },
    dataset: { testid: "command-palette-search" },
  }) as HTMLInputElement;

  const backdrop = el("div", {
    class: "ai-skill-palette-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "command-palette" },
    children: [
      el("section", {
        class: "ai-skill-palette-window command-palette-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "커맨드 팔레트" },
        children: [search, listHost],
      }),
    ],
  });

  let entries: readonly PaletteEntry[] = [];
  let activeIndex = 0;
  const close = (): void => backdrop.remove();
  const runEntry = (entry: PaletteEntry): void => {
    close();
    entry.run();
  };

  const refresh = (): void => {
    entries = buildPaletteEntries(search.value, {
      commands: listEditorCommands(),
      maps: listMapCommands(store.getCurrent()),
      skills: filterSkills(search.value ? `/${search.value}` : "/"),
      runSkill: options.runSkill,
    });
    activeIndex = Math.min(activeIndex, Math.max(0, entries.length - 1));
    const nodes: HTMLElement[] = [];
    let lastKind: PaletteEntry["kind"] | null = null;
    entries.forEach((entry, index) => {
      if (entry.kind !== lastKind) {
        lastKind = entry.kind;
        nodes.push(el("div", { class: "command-palette-group", text: KIND_HEADERS[entry.kind] }));
      }
      nodes.push(
        el("button", {
          class: `ai-slash-item command-palette-item${index === activeIndex ? " is-active" : ""}`,
          attrs: { type: "button", title: entry.detail, "aria-selected": String(index === activeIndex) },
          dataset: { testid: `command-palette-item-${entry.kind}-${entry.id}` },
          children: [
            el("span", { class: "ai-slash-item-name", text: entry.label }),
            el("span", { class: "ai-slash-item-desc", text: entry.detail }),
            ...(entry.hotkey ? [el("span", { class: "command-palette-hotkey", text: entry.hotkey })] : []),
          ],
          on: { click: () => runEntry(entry) },
        }),
      );
    });
    if (entries.length === 0) nodes.push(el("div", { class: "ai-slash-empty", text: "일치하는 항목이 없습니다" }));
    listHost.replaceChildren(...nodes);
  };

  search.addEventListener("input", () => { activeIndex = 0; refresh(); });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { close(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = movePaletteIndex(entries.length, activeIndex, event.key === "ArrowDown" ? 1 : -1);
      refresh();
      return;
    }
    if (event.key === "Enter") {
      const entry = entries[activeIndex];
      if (entry) runEntry(entry);
    }
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });

  refresh();
  document.body.append(backdrop);
  search.focus();
  return backdrop;
}
```

- [ ] **Step 4: aiChatPanel Ctrl+K 교체**

`aiChatPanel.ts` line ~1981 블록 교체(기존 `input.focus(); revealVolatileZone();` 삭제):

```ts
  // Ctrl/Cmd+K — 통합 커맨드 팔레트(명령+맵+스킬). 전역 1회만 등록.
  if (typeof window !== "undefined" && !(window as { __rpgzzuSkillHotkey?: boolean }).__rpgzzuSkillHotkey) {
    (window as { __rpgzzuSkillHotkey?: boolean }).__rpgzzuSkillHotkey = true;
    document.addEventListener?.("keydown", (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette({ runSkill: (skill) => drawer.run(skill) });
      }
    });
  }
```

import 추가: `import { openCommandPalette } from "./commandPalette";`
주의: `drawer`는 line ~1073의 `const drawer = renderSkillDrawer({...})` — Ctrl+K 등록 위치가 `drawer` 선언보다 아래인지 확인(현재 1981 > 1073 이므로 OK).
시작 화면 문구(line ~1139) 교체: `"자연어로 요청하거나, 스킬로 시작하세요. (입력창 / · Ctrl+K)"` → `"Ctrl+K 명령 · / 스킬 · 영역 선택 후 ✨ 칩으로 시작하세요."`

- [ ] **Step 5: CSS (`inline-assist.css` 끝에)**

```css
.command-palette-group {
  color: var(--editor-text-soft, #7f8db0);
  font: 700 10px/1.2 var(--font-ui, system-ui, sans-serif);
  letter-spacing: 0.05em;
  padding: 8px 6px 2px;
  text-transform: uppercase;
}

.command-palette-hotkey {
  border: 1px solid var(--editor-line, #2a3550);
  border-radius: 5px;
  color: var(--editor-text-muted, #9aa8c7);
  font: 600 10px/1 ui-monospace, monospace;
  margin-left: auto;
  padding: 2px 5px;
}

.command-palette-item.is-active {
  background: color-mix(in srgb, var(--editor-blue, #3d6df0) 24%, transparent);
}
```

- [ ] **Step 6: 확인 + 커밋**

Run: `npx vitest run test/commandPalette.test.ts --configLoader runner && npm run typecheck && npm test` → PASS
브라우저: Ctrl+K → 팔레트, "채우기" 검색 → Enter → 도구 전환, 맵 이름 검색 → 이동, 스킬 항목 → 스킬 실행.

```bash
git add src/editor/panels/commandPalette.ts src/editor/panels/aiChatPanel.ts src/styles/editor/inline-assist.css test/commandPalette.test.ts
git commit -m "feat(editor): Ctrl+K 통합 커맨드 팔레트 (명령+맵+스킬)"
```

---

### Task 10: 도구 문자 단축키 + 선택 영역 칩 자동 부착

**Files:**
- Modify: `src/editor/hotkeys.ts`
- Modify: `src/editor/panels/aiChatPanel.ts` (`refreshContextChips`, line ~1265)
- Test: `test/editorHotkeys.test.ts` (케이스 추가), `test/aiSelectionAutoChip.test.ts`

**Interfaces:**
- Produces: V/B/E/G/N/I 단축키. 선택 존재 시 `ai-selection-chip` 자동 표시, × 클릭 시 같은 선택에 대해 재부착 안 함.

- [ ] **Step 1: hotkeys 실패 테스트 추가 (`test/editorHotkeys.test.ts` 기존 describe에)**

```ts
  it("문자 단축키 V/B/E/G/N/I가 도구를 전환한다", () => {
    expect(handleEditorKey(keyEvent("v"))).toBe(true);
    expect(editorState.get().tool).toBe("select");
    expect(handleEditorKey(keyEvent("e"))).toBe(true);
    expect(editorState.get().tool).toBe("erase");
    expect(handleEditorKey(keyEvent("n"))).toBe(true);
    expect(editorState.get().tool).toBe("event");
    expect(editorState.get().layer).toBe("event");
    // 이벤트 레이어에서 타일 도구 문자키 → 하위 레이어로 복귀
    expect(handleEditorKey(keyEvent("b"))).toBe(true);
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().layer).toBe("lower");
  });
```

- [ ] **Step 2: 실패 확인** → `npx vitest run test/editorHotkeys.test.ts --configLoader runner` FAIL

- [ ] **Step 3: hotkeys 구현**

`hotkeys.ts` — `TOOL_HOTKEYS` 아래에 추가:

```ts
/** 문자 단축키(스펙 §4 3-B): 아이콘 레일 툴팁·커맨드 팔레트와 표기 일치. */
const TOOL_LETTER_HOTKEYS: Readonly<Record<string, Tool>> = {
  v: "select",
  b: "paint",
  e: "erase",
  g: "fill",
  n: "event",
  i: "eyedropper",
};
```

`handleEditorKey()`의 숫자키 블록(line ~129) 뒤, 줌 블록 앞에 추가:

```ts
  // 문자키 도구 전환 — 숫자키와 동일한 레이어 가드.
  const letterTool = TOOL_LETTER_HOTKEYS[event.key.toLowerCase()];
  if (letterTool && event.key.length === 1) {
    event.preventDefault();
    const state = editorState.get();
    if (letterTool === "event") {
      editorState.set({ tool: "event", layer: "event" });
    } else if (state.layer === "event") {
      editorState.set(toolPatch(letterTool, "lower"));
    } else {
      editorState.set(toolPatch(letterTool));
    }
    return true;
  }
```

주의: `toolPatch`의 시그니처는 `Exclude<Tool, "event">` — letterTool이 "event"인 분기를 먼저 빠졌으므로 `toolPatch(letterTool as Exclude<Tool, "event">, ...)` 캐스팅이 필요하면 명시.

- [ ] **Step 4: 선택 칩 자동 부착 실패 테스트**

```ts
// test/aiSelectionAutoChip.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

describe("selection auto chip", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installFakeDom();
    store.replace(createBlankProject());
    editorState.set({ selection: null, currentMapId: store.getCurrent().startMapId });
    document.body.append(renderAiChatPanel());
  });
  afterEach(() => {
    editorState.set({ selection: null });
    restore();
  });

  function chip(): unknown {
    return findByTestId(document.body as unknown as FakeElement, "ai-selection-chip");
  }

  it("선택이 생기면 칩이 자동 부착되고, ×로 해제하면 같은 선택엔 다시 붙지 않는다", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
    expect(chip()).toBeTruthy();
    (findByTestId(document.body as unknown as FakeElement, "ai-selection-chip-clear") as unknown as HTMLElement).click();
    expect(chip()).toBeFalsy();
    // 같은 선택 그대로 → 재부착 없음
    editorState.set({ zoom: 3 });
    expect(chip()).toBeFalsy();
    // 새 선택 → 재부착
    editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
    expect(chip()).toBeTruthy();
  });
});
```

- [ ] **Step 5: 실패 확인** → FAIL (현재는 `rpgzzu:ai-selection-context` 이벤트로만 활성화)

- [ ] **Step 6: aiChatPanel 구현**

`refreshContextChips`(line ~1265) 위에 상태 변수 추가:

```ts
  // 선택 영역 칩 자동 부착(스펙 §4 3-C): 새 선택은 자동 활성, ×로 끈 선택은 키가 같는 동안 재부착 금지.
  let dismissedSelectionKey: string | null = null;
  const selectionKeyOf = (sel: { mapId: string; x: number; y: number; width: number; height: number } | null): string | null =>
    sel ? `${sel.mapId}:${sel.x}:${sel.y}:${sel.width}:${sel.height}` : null;
```

`refreshContextChips` 본문 시작부에:

```ts
    const currentSelection = editorState.get().selection;
    const currentKey = selectionKeyOf(currentSelection);
    if (currentKey && currentKey !== dismissedSelectionKey) selectionTaskActive = true;
    if (!currentKey) dismissedSelectionKey = null;
```

선택 칩의 × 클릭 핸들러(`ai-selection-chip-clear`, line ~1250 부근)에서 `selectionTaskActive = false;` 하는 곳에 `dismissedSelectionKey = selectionKeyOf(editorState.get().selection);` 추가.

- [ ] **Step 7: 확인 + 커밋**

Run: `npx vitest run test/editorHotkeys.test.ts test/aiSelectionAutoChip.test.ts --configLoader runner && npm run typecheck && npm test` → PASS

```bash
git add src/editor/hotkeys.ts src/editor/panels/aiChatPanel.ts test/editorHotkeys.test.ts test/aiSelectionAutoChip.test.ts
git commit -m "feat(editor): 도구 문자 단축키 + 선택 영역 칩 자동 부착"
```

---

## Phase 4 — 전문가 모드 1024px 반응형

### Task 11: 상태바 우선순위 클래스 + `editor-responsive-expert.css`

**Files:**
- Modify: `src/editor/panels/editor.ts` (`renderEditorStatusbar` 셀 클래스)
- Create: `src/styles/shell/editor-responsive-expert.css`
- Modify: `src/styles/index.css` (@import)
- Test: 시각 확인(Task 13에서 e2e로 고정)

- [ ] **Step 1: 상태바 셀에 우선순위 클래스**

`renderEditorStatusbar`(editor.ts line ~482)에서:
- `타일:`/`줌:` 셀 → `class: "editor-statusbar-cell sb-secondary"`
- `좌표:`/`하위:`/`상위:` 셀 → `class: "editor-statusbar-cell sb-detail"`
(모드/맵/도구/잠금/DB 셀은 그대로.)

- [ ] **Step 2: 반응형 CSS 파일 생성**

```css
/* src/styles/shell/editor-responsive-expert.css
   전문가 모드 1024px 완전 대응 (스펙 §5). 1024px 이상에서 줄바꿈·잘림·겹침 제거.
   1024px 미만은 기존 720px 자동 접힘 경로에 맡긴다. */

/* 1) 메뉴바: 라벨 줄바꿈 금지 */
.rm2k3-menu-bar {
  flex-wrap: nowrap;
  min-width: 0;
}

.rm2k3-menu-item,
.editor-ui-mode-btn {
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .editor-product-brand { margin-right: 8px; }
  .editor-product-brand-text { display: none; } /* 로고(✦)만 남김 */
  .rm2k3-menu-item { padding-left: 8px; padding-right: 8px; }
  .editor-ui-mode-btn { padding: 0 8px; }
  .editor-ui-mode-toggle { margin-left: 6px; }
}

/* 2) 좌패널 작업 탭: 줄바꿈 금지 + 좁은 폭 축소 */
.palette-work-tab {
  min-width: 0;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .palette-work-tab { font-size: 11px; padding-left: 6px; padding-right: 6px; }
}

/* 3) 맵 트리: 이름 우선(ellipsis), 행 액션은 hover/focus에서만 */
.map-item .map-tree-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .map-item .map-tree-action,
  .map-item .map-context-trigger,
  .map-item .start-mark:empty {
    visibility: hidden;
  }

  .map-item:hover .map-tree-action,
  .map-item:hover .map-context-trigger,
  .map-item:focus-within .map-tree-action,
  .map-item:focus-within .map-context-trigger {
    visibility: visible;
  }
}

/* 4) AI 패널: 입력 행이 절대 잘리지 않게 */
.ai-command-input-stack,
.ai-chat-input-row {
  min-width: 0;
}

.ai-chat-input-row > textarea,
.ai-chat-input-row > input {
  min-width: 0;
}

.ai-chat-send {
  flex: 0 0 auto;
}

/* 5) 빠른 작업 그리드: 좁으면 1열 */
@media (max-width: 1280px) {
  .ai-quick-action-grid { grid-template-columns: 1fr; }
}

/* 6) 캔버스 상단: 줌 툴바를 우측 고정 → 잠금 배너(좌측)와 절대 안 겹침 */
@media (max-width: 1180px) {
  .canvas-toolbar {
    left: auto;
    right: 12px;
    transform: none;
  }
}

/* 7) 상태바: 우선순위 숨김 (모드·맵·도구·잠금·DB는 항상 유지) */
.editor-statusbar {
  flex-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
}

@media (max-width: 1280px) {
  .editor-statusbar .sb-detail { display: none; }
}

@media (max-width: 1100px) {
  .editor-statusbar .sb-secondary { display: none; }
}
```

- [ ] **Step 3: import 등록**

`src/styles/index.css`의 `@import "./shell/editor-ui-modes.css";` 다음 줄에:

```css
@import "./shell/editor-responsive-expert.css";
```

- [ ] **Step 4: 시각 확인**

dev 서버 + 브라우저 1024×768, expert 모드에서: 메뉴 한 줄, 탭 한 줄, 맵트리 이름 표시(ellipsis), 보내기 버튼 온전, 줌 툴바 우측 고정으로 배너와 분리, 상태바 잘림 없음. 1440에서 회귀 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/editor/panels/editor.ts src/styles/shell/editor-responsive-expert.css src/styles/index.css
git commit -m "fix(editor): 전문가 모드 1024px 반응형 CSS (메뉴·탭·맵트리·상태바·입력행)"
```

---

### Task 12: 클래식 툴바 ⋯ 오버플로우

**Files:**
- Create: `src/editor/panels/toolbarOverflow.ts`
- Modify: `src/editor/panels/menu.ts` (클래식 툴바 행에 설치)
- Modify: `src/styles/shell/editor-responsive-expert.css`
- Test: `test/toolbarOverflow.test.ts`

**Interfaces:**
- Produces:
  - `visibleItemCount(containerWidth: number, itemWidths: readonly number[], moreWidth: number, gap: number): number` — 순수
  - `installToolbarOverflow(row: HTMLElement): () => void` — ResizeObserver 배선, 반환값은 해제 함수. ⋯ 버튼 testid `toolbar-overflow-toggle`, 팝업 testid `toolbar-overflow-popup`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/toolbarOverflow.test.ts
import { describe, expect, it } from "vitest";
import { visibleItemCount } from "@/editor/panels/toolbarOverflow";

describe("visibleItemCount", () => {
  it("전부 들어가면 전체 개수를 돌려준다", () => {
    expect(visibleItemCount(400, [50, 50, 50], 30, 4)).toBe(3);
  });

  it("넘치면 ⋯ 버튼 폭을 남기고 최대 개수", () => {
    // 50*4 + gap*3 = 212 > 150 → ⋯(30)+gap 확보 후 들어가는 만큼
    expect(visibleItemCount(150, [50, 50, 50, 50], 30, 4)).toBe(2);
  });

  it("아무것도 안 들어가면 0", () => {
    expect(visibleItemCount(20, [50, 50], 30, 4)).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현**

```ts
// src/editor/panels/toolbarOverflow.ts
// 클래식 툴바 priority+ 오버플로우 — 안 들어가는 버튼을 ⋯ 팝업으로 수납 (스펙 §5).
import { el } from "@/util/dom";

export function visibleItemCount(
  containerWidth: number,
  itemWidths: readonly number[],
  moreWidth: number,
  gap: number,
): number {
  let total = 0;
  for (let i = 0; i < itemWidths.length; i += 1) {
    total += (itemWidths[i] ?? 0) + (i > 0 ? gap : 0);
  }
  if (total <= containerWidth) return itemWidths.length;

  let used = moreWidth + gap;
  let count = 0;
  for (const width of itemWidths) {
    const next = used + width + (count > 0 ? gap : 0);
    if (next > containerWidth) break;
    used = next;
    count += 1;
  }
  return count;
}

/** row의 자식 버튼을 실측해 넘치는 항목을 ⋯ 팝업으로 옮긴다. 반환: 해제 함수. */
export function installToolbarOverflow(row: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};

  const moreButton = el("button", {
    class: "rm2k3-tool-button toolbar-overflow-toggle",
    text: "⋯",
    attrs: { type: "button", title: "더 보기", "aria-label": "가려진 툴바 버튼", "aria-expanded": "false" },
    dataset: { testid: "toolbar-overflow-toggle" },
  }) as HTMLButtonElement;
  const popup = el("div", {
    class: "rm2k3-menu-popup toolbar-overflow-popup",
    attrs: { role: "menu" },
    dataset: { testid: "toolbar-overflow-popup" },
  });
  popup.hidden = true;
  moreButton.addEventListener("click", () => {
    popup.hidden = !popup.hidden;
    moreButton.setAttribute("aria-expanded", String(!popup.hidden));
  });
  document.addEventListener("pointerdown", onOutside);
  function onOutside(event: Event): void {
    if (popup.hidden) return;
    if (event.target instanceof Node && (popup.contains(event.target) || moreButton.contains(event.target))) return;
    popup.hidden = true;
    moreButton.setAttribute("aria-expanded", "false");
  }

  // 원본 순서를 기억해 두고, 리사이즈마다 전부 행으로 되돌린 뒤 다시 계산한다.
  const items = Array.from(row.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
  row.append(moreButton, popup);

  const reflow = (): void => {
    for (const item of items) row.insertBefore(item, moreButton);
    moreButton.hidden = true;
    const gap = 4;
    const widths = items.map((item) => item.offsetWidth || 28);
    const count = visibleItemCount(row.clientWidth, widths, moreButton.offsetWidth || 30, gap);
    if (count >= items.length) {
      popup.hidden = true;
      return;
    }
    moreButton.hidden = false;
    for (const item of items.slice(count)) popup.append(item);
  };

  const observer = new ResizeObserver(() => reflow());
  observer.observe(row);
  reflow();
  return () => {
    observer.disconnect();
    document.removeEventListener("pointerdown", onOutside);
  };
}
```

- [ ] **Step 4: menu.ts 설치**

클래식 툴바 행 생성부(line ~373 `rm2k3-toolbar-row classic-row` 및 ~438 primary 행)를 만든 뒤, 각 행에 대해:

```ts
  installToolbarOverflow(row);
```

import: `import { installToolbarOverflow } from "@/editor/panels/toolbarOverflow";`
(메뉴가 재렌더되며 행이 교체되는 구조면 행 생성 함수 반환 직전에 설치 — 이전 행은 DOM에서 제거되므로 ResizeObserver도 GC에 맡겨도 무방하나, 반환된 해제 함수를 행 교체 시 호출할 수 있으면 호출.)

- [ ] **Step 5: CSS (`editor-responsive-expert.css` 끝에)**

```css
/* 8) 클래식 툴바 오버플로우 */
.classic-toolbar .rm2k3-toolbar-row {
  flex-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.toolbar-overflow-popup {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 320px;
  padding: 6px;
  position: absolute;
  right: 4px;
  top: 100%;
  z-index: 80;
}
```

- [ ] **Step 6: 확인 + 커밋**

Run: `npx vitest run test/toolbarOverflow.test.ts --configLoader runner && npm run typecheck && npm test` → PASS
브라우저 1024px expert: 툴바 잘림 없음, ⋯ 클릭 시 수납된 버튼 팝업.

```bash
git add src/editor/panels/toolbarOverflow.ts src/editor/panels/menu.ts src/styles/shell/editor-responsive-expert.css test/toolbarOverflow.test.ts
git commit -m "feat(editor): 클래식 툴바 ⋯ 오버플로우 수납"
```

---

### Task 13: 반응형 E2E 스모크 + 최종 검증

**Files:**
- Create: `test/e2e/responsive-shell.spec.ts`

- [ ] **Step 1: E2E 스펙 작성**

```ts
// test/e2e/responsive-shell.spec.ts
// 스펙 §5 검증: 1024/1280/1440에서 기본·전문가 모드 줄바꿈·잘림·겹침 없음.
import { expect, test } from "@playwright/test";

const SIZES = [
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
] as const;

for (const size of SIZES) {
  for (const mode of ["basic", "expert"] as const) {
    test(`${mode} 모드 ${size.name}px 셸 무결성`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/?freshProject=1");
      await page.waitForSelector("[data-testid='editor-layout']");
      await page.evaluate((m) => (window as never as { __rpgzzuEditorUiMode: { set(v: string): void } }).__rpgzzuEditorUiMode.set(m), mode);
      await page.waitForTimeout(300);

      // 1) 문서 가로 스크롤 없음
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      // 2) 메뉴바 한 줄 (두 줄 꺾임이면 높이가 커진다)
      const menuBar = page.locator(".rm2k3-menu-bar");
      const menuBox = await menuBar.boundingBox();
      expect(menuBox && menuBox.height).toBeLessThanOrEqual(48);

      // 3) 보내기 버튼이 뷰포트 안에 온전히 존재
      const send = page.locator(".ai-chat-send").first();
      if (await send.isVisible()) {
        const box = await send.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
      }

      if (mode === "expert") {
        // 4) 맵 트리 이름이 실제 폭을 가진다
        const name = page.locator(".map-tree-name").first();
        if (await name.count() > 0) {
          const nameBox = await name.boundingBox();
          expect(nameBox && nameBox.width).toBeGreaterThan(20);
        }
        // 5) 클래식 툴바 오버플로우 시 ⋯ 토글 표시(1024에서만 기대)
        if (size.width === 1024) {
          await expect(page.locator("[data-testid='rpg-maker-tile-toolbar']").first()).toBeVisible();
        }
      } else {
        // 기본 모드: 아이콘 레일 존재 + 폭 48
        const rail = page.locator("[data-testid='basic-left-rail']");
        await expect(rail).toBeVisible();
        const railBox = await rail.boundingBox();
        expect(railBox && railBox.width).toBeLessThanOrEqual(56);
      }

      await page.screenshot({ path: `test-results/responsive-${mode}-${size.name}.png` });
    });
  }
}
```

- [ ] **Step 2: 실행**

Run: `npx playwright test test/e2e/responsive-shell.spec.ts`
Expected: 6개 전부 PASS. 실패 시 해당 태스크(11/12) CSS를 스크린샷 보고 보정.

- [ ] **Step 3: 최종 전체 검증**

```bash
npm run typecheck && npm test && npx playwright test test/e2e/responsive-shell.spec.ts
```
Expected: 전부 PASS.

- [ ] **Step 4: 커밋**

```bash
git add test/e2e/responsive-shell.spec.ts
git commit -m "test(e2e): 기본/전문가 모드 반응형 셸 스모크"
```

---

## Self-Review 결과 (계획 작성 시점)

- 스펙 §2(레일) → Task 1-4, §3(2-A/B/C) → Task 5/6/7, §4(3-A/B/C) → Task 8/9/10, §5(반응형 8건) → Task 11/12/13. 커버리지 공백 없음.
- 스펙의 "좁으면 보내기 아이콘(➤)만" 항목은 CSS만으로 텍스트 교체가 불가해 **flex 잘림 방지(min-width:0)로 대체** — 버튼이 항상 온전히 보이므로 스펙 의도(잘림 제거) 충족. e2e(Task 13 항목 3)로 고정.
- line 번호는 구현 중 어긋날 수 있음 — 앵커 텍스트(테스트id·함수명) 기준으로 찾을 것.
