// 좌측 도크 구성 계약 — `▤` 패널 메뉴와 Ctrl+K 명령이 실제로 DOM 을 바꾸는지.
//
// 실측 배경(.omo/plans/sidebar-ux.md §1-1 B-1/B-2, §1-3 W-1/W-2):
//  · `leftDockPanels()` 가 `docks.left` 를 읽고 나서 멤버십을 버렸다
//    (`return ["tiles", "maps", ...extras];`) — 토글은 저장값과 `aria-checked` 만 뒤집었다.
//  · 그래서 「이벤트 중심」·「데이터 중심」 프리셋도 약속한 좌측 구성을 지키지 못했다.
//  · 동시에 `.left-panel` 이 비지 않는다는 2026-08-26 불변식은 지켜야 한다 —
//    구성이 비면 레지스트리 선호 기본값으로 되돌리고, 초보 모드는 레일 호스트인
//    `tiles` 를 고정한다(끄면 사이드바가 빈다).
//  · 폭: 초보 레일의 실제 렌더 폭은 72px 이고 `--editor-left-safe` 는 거기서 파생해야 한다
//    (하드코딩 60px 이면 어시스턴트 오버레이의 12px 여백이 0 이 된다).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const EDITOR_LAYOUT_KEY = "oprn:editor-layout:v4";
const LAYOUT_VERSION_KEY = "oprn:editor-layout-version";
const LAYOUT_VERSION = "2026-07-24-maptree-300";
const WORKSPACE_KEY = "oprn:workspace:v1";
const UI_MODE_KEY = "oprn:editor-ui-mode";
/** editor-ui-modes.css `--basic-rail-width` 와 같은 값 — 실측 렌더 폭이다. */
const RAIL_WIDTH_PX = 72;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let restoreDom: (() => void) | null = null;
let storage: MemoryStorage;

function fake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function installStorage(): void {
  storage = new MemoryStorage();
  storage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
  storage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth: 526, mapTreeHeight: 300, chatDock: "glass" }));
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
}

function installBrowserGlobals(): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      confirm: vi.fn(() => true),
      innerWidth: 1440,
      innerHeight: 900,
      localStorage: storage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      getComputedStyle: () => ({ getPropertyValue: () => "" }),
    },
  });
  Object.defineProperty(document, "addEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "removeEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
}

/** 좌측 도크 조립만 보려는 테스트다 — Phaser·AI·모달은 흉내만 낸다. */
function mockEditorDependencies(): void {
  vi.doMock("@/app/mode", () => ({
    destroyGame: vi.fn(),
    getGame: vi.fn(() => null),
    startEditGame: vi.fn(async () => ({ scale: { resize: vi.fn() } })),
  }));
  vi.doMock("@/editor/editorToolHook", () => ({
    installEditorToolHook: vi.fn(),
    cleanupProjectE2EBridge: vi.fn(),
  }));
  vi.doMock("@/editor/mapEditLocks", () => ({
    ensureCurrentMapLock: vi.fn(),
    getMapEditLockStatus: () => ({ kind: "idle" }),
    isMapEditLockTakeoverImmediate: () => false,
    lockOwnerPhrase: (ownerLabel: string) => ownerLabel,
    mapEditLockLastActivityText: () => "",
    subscribeMapEditLocks: vi.fn(() => () => undefined),
    takeoverMapLock: vi.fn(async () => {}),
  }));
  vi.doMock("@/editor/panels/aiChatPanel", () => ({
    renderAiChatPanel: () => {
      const panel = document.createElement("aside");
      panel.dataset.testid = "ai-panel";
      return panel;
    },
    teardownAiChatPanel: vi.fn(),
  }));
  vi.doMock("@/editor/panels/editorZoomToolbar", () => ({
    renderCanvasToolbar: (node: HTMLElement) => {
      node.textContent = "zoom";
    },
  }));
  vi.doMock("@/editor/panels/testPlayModal", () => ({
    closeTestPlayModal: vi.fn(),
    openRandomTroopBattleTestModal: vi.fn(),
    openSelectedEventTestModal: vi.fn(),
    openTestPlayModal: vi.fn(),
    openTroopBattleTestModal: vi.fn(),
  }));
  vi.doMock("@/editor/panels/mapList", () => ({
    renderMapList: (node: HTMLElement) => {
      node.textContent = "maps";
    },
  }));
  vi.doMock("@/editor/panels/tilePalette", () => ({
    renderTilePalette: (node: HTMLElement) => {
      node.textContent = "tiles";
    },
  }));
}

function setWorkspaceDocks(left: readonly string[]): void {
  storage.setItem(WORKSPACE_KEY, JSON.stringify({
    presetId: "map",
    docks: { left, right: ["assistant"], bottom: [] },
  }));
}

async function mountEditor(): Promise<FakeElement> {
  const { renderEditor } = await import("@/editor/panels/editor");
  const main = document.createElement("main");
  renderEditor(main);
  return fake(main);
}

function dockHosts(root: FakeElement): FakeElement[] {
  return root.querySelectorAll(".left-panel-stack");
}

beforeEach(() => {
  vi.resetModules();
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installStorage();
  installBrowserGlobals();
  mockEditorDependencies();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("좌측 도크 구성은 워크스페이스 레이아웃을 따른다", () => {
  it("맵 패널을 닫으면 맵 호스트가 좌측 도크에서 사라진다", async () => {
    storage.setItem(UI_MODE_KEY, "standard");
    setWorkspaceDocks(["tiles"]);

    const root = await mountEditor();

    expect(findByTestId(root, "left-palette-root")).not.toBeNull();
    expect(findByTestId(root, "left-map-root")).toBeNull();
  }, 120_000);

  it("좌측 도크가 비어도 호스트가 최소 하나는 남는다 (.left-panel 은 비지 않는다)", async () => {
    storage.setItem(UI_MODE_KEY, "standard");
    setWorkspaceDocks([]);

    const root = await mountEditor();

    expect(dockHosts(root).length).toBeGreaterThanOrEqual(1);
    expect(root.querySelector(".left-panel")?.style.display).not.toBe("none");
  }, 120_000);

  it("초보 모드는 레이아웃이 타일을 숨기라 해도 타일 호스트를 고정한다", async () => {
    storage.setItem(UI_MODE_KEY, "beginner");
    setWorkspaceDocks(["maps"]);

    const root = await mountEditor();

    expect(findByTestId(root, "left-palette-root")).not.toBeNull();
  }, 120_000);

  it("초보 레일의 --editor-left-safe 는 실제 레일 폭에서 파생한다", async () => {
    storage.setItem(UI_MODE_KEY, "beginner");
    setWorkspaceDocks(["tiles"]);

    const root = await mountEditor();

    const leftPanel = root.querySelector(".left-panel");
    expect(leftPanel?.style["width"]).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--editor-left-safe")).toBe(`${RAIL_WIDTH_PX}px`);
  }, 120_000);
});

describe("패널 메뉴는 실제로 되는 선택지만 제시한다", () => {
  it("호스트가 없는 zone 으로 옮기는 칩을 만들지 않는다", async () => {
    storage.setItem(UI_MODE_KEY, "standard");
    setWorkspaceDocks(["tiles", "maps"]);
    const { renderWorkspaceBar } = await import("@/editor/panels/workspaceBar");

    for (const node of renderWorkspaceBar()) document.body.append(node);

    const bodyRoot = fake(document.body as unknown as HTMLElement);
    expect(findByTestId(bodyRoot, "workspace-panel-dock-tiles-right")).toBeNull();
  }, 120_000);

  it("오른쪽 도크 호스트가 있으면 그 zone 칩을 제시한다", async () => {
    storage.setItem(UI_MODE_KEY, "standard");
    setWorkspaceDocks(["tiles", "maps"]);
    const rightHost = document.createElement("div");
    rightHost.dataset.dockZone = "right";
    document.body.append(rightHost);
    const { renderWorkspaceBar } = await import("@/editor/panels/workspaceBar");

    for (const node of renderWorkspaceBar()) document.body.append(node);

    const bodyRoot = fake(document.body as unknown as HTMLElement);
    expect(findByTestId(bodyRoot, "workspace-panel-dock-tiles-right")).not.toBeNull();
  }, 120_000);

  it("초보 모드의 타일 행은 끌 수 없는 고정 행이고 이유를 말한다", async () => {
    storage.setItem(UI_MODE_KEY, "beginner");
    setWorkspaceDocks(["tiles", "maps"]);
    const { renderWorkspaceBar } = await import("@/editor/panels/workspaceBar");

    for (const node of renderWorkspaceBar()) document.body.append(node);

    const bodyRoot = fake(document.body as unknown as HTMLElement);
    const tilesToggle = findByTestId(bodyRoot, "workspace-panel-toggle-tiles");
    const mapsToggle = findByTestId(bodyRoot, "workspace-panel-toggle-maps");
    // 고정은 aria-disabled 로 알리고, `disabled` 속성은 걸지 않는다 — disabled 버튼은
    // 포커스를 못 받아서 이유가 적힌 title 에 키보드로 닿지 못하기 때문이다.
    expect(tilesToggle?.getAttribute("aria-disabled")).toBe("true");
    expect(tilesToggle?.disabled).toBe(false);
    expect(tilesToggle?.getAttribute("title") ?? "").toContain("끌 수 없습니다");
    // 그리고 진짜로 안 눈다: 클릭해도 지속된 레이아웃의 tiles 멤버쉽이 그대로여야 한다.
    tilesToggle?.click();
    expect(JSON.parse(storage.getItem(WORKSPACE_KEY) ?? "{}").docks.left).toContain("tiles");
    expect(mapsToggle?.getAttribute("aria-disabled")).toBeNull();
    expect(mapsToggle?.disabled).toBe(false);
  }, 120_000);
});
