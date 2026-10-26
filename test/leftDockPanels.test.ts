// 좌측 도크 구성 계약 — `▤` 패널 메뉴와 Ctrl+K 명령이 실제로 DOM 을 바꾸는지.
//
// 실측 배경(.omo/plans/sidebar-ux.md §1-1 B-1/B-2, §1-3 W-1/W-2):
//  · `leftDockPanels()` 가 `docks.left` 를 읽고 나서 멤버십을 버렸다
//    (`return ["tiles", "maps", ...extras];`) — 토글은 저장값과 `aria-checked` 만 뒤집었다.
//  · 그래서 「이벤트 중심」·「데이터 중심」 프리셋도 약속한 좌측 구성을 지키지 못했다.
//  · 동시에 `.left-panel` 이 비지 않는다는 2026-08-26 불변식은 지켜야 한다 —
//    구성이 비면 레지스트리 선호 기본값으로 되돌린다.
//  · 초보/표준/전문가 편집 모드는 2026-09-27 에 없앴다 — 초보 레일 계약도 함께 사라졌다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const EDITOR_LAYOUT_KEY = "oprn:editor-layout:v4";
const LAYOUT_VERSION_KEY = "oprn:editor-layout-version";
const LAYOUT_VERSION = "2026-07-24-maptree-300";
const WORKSPACE_KEY = "oprn:workspace:v1";

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
  storage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth: 526, mapTreeHeight: 300 }));
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
}

function installBrowserGlobals(): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      confirm: vi.fn(() => true),
      innerWidth: 1440,
      // 조수 상태 띠(aiStatusBar)의 1초 시계 — 이 테스트는 시계를 보지 않으니 멈춘 타이머로 둔다.
      setInterval: vi.fn(() => 0),
      clearInterval: vi.fn(),
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
    // 패널 등록부(panelRegistry)는 이제 refreshTilePalette 로 타일 패널을 짓는다(입력이 같으면 다시 안 짓는 머리말).
    refreshTilePalette: (node: HTMLElement) => {
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
  it("mounts the task host without changing a saved maps-only layout", async () => {
    setWorkspaceDocks(['maps']);
    const root = await mountEditor();
    expect(findByTestId(root, 'left-palette-root')).not.toBeNull();
    expect(findByTestId(root, 'left-map-root')).not.toBeNull();
    expect(JSON.parse(storage.getItem(WORKSPACE_KEY) ?? '{}').docks.left).toEqual(['maps']);
  }, 120_000);
  it("맵 패널을 닫으면 맵 호스트가 좌측 도크에서 사라진다", async () => {
    setWorkspaceDocks(["tiles"]);

    const root = await mountEditor();

    expect(findByTestId(root, "left-palette-root")).not.toBeNull();
    expect(findByTestId(root, "left-map-root")).toBeNull();
  }, 120_000);

  it("좌측 도크가 비어도 호스트가 최소 하나는 남는다 (.left-panel 은 비지 않는다)", async () => {
    setWorkspaceDocks([]);

    const root = await mountEditor();

    expect(dockHosts(root).length).toBeGreaterThanOrEqual(1);
    expect(root.querySelector(".left-panel")?.style.display).not.toBe("none");
  }, 120_000);

});

describe("패널 메뉴는 왼쪽 활동 막대를 그대로 비춘다", () => {
  // 감사 02-leftdock-02·03·09: 예전 절은 도크 멤버십(타일·맵)을 토글해서 체크를 꺼도 화면이 그대로였고,
  // 접힌 도크도 「열림」으로 보였다. 이제 체크 = 막대에서 지금 펼쳐진 패널, 누르면 막대 단추를 누른다.
  function mountActivityBar(pressed: string | null): { readonly clicks: string[] } {
    const clicks: string[] = [];
    const bar = document.createElement("nav");
    bar.dataset.testid = "left-activity-bar";
    for (const [id, label] of [["tools", "그리기"], ["maps", "맵"]] as const) {
      const button = document.createElement("button");
      button.className = "left-activity-item";
      button.dataset.testid = `sidebar-${id}`;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(pressed === id));
      button.addEventListener("click", () => clicks.push(id));
      bar.append(button);
    }
    const inspect = document.createElement("button");
    inspect.className = "left-activity-item";
    inspect.dataset.testid = "sidebar-inspect";
    inspect.setAttribute("aria-label", "검사");
    bar.append(inspect);
    document.body.append(bar);
    return { clicks };
  }

  async function openPanelsMenu(): Promise<FakeElement> {
    const { renderWorkspaceBar } = await import("@/editor/panels/workspaceBar");
    for (const node of renderWorkspaceBar()) document.body.append(node);
    const bodyRoot = fake(document.body as unknown as HTMLElement);
    findByTestId(bodyRoot, "workspace-panels-button")?.click();
    return bodyRoot;
  }

  it("펼쳐진 패널만 체크하고, 항목을 누르면 막대 단추를 누른다", async () => {
    const { clicks } = mountActivityBar("tools");

    const bodyRoot = await openPanelsMenu();

    expect(findByTestId(bodyRoot, "workspace-panels-button")?.getAttribute("aria-label")).toBe("보기 — 패널과 언어");
    expect(findByTestId(bodyRoot, "workspace-panels-button")?.textContent).toContain("보기");
    expect(findByTestId(bodyRoot, "workspace-panel-toggle-tools")?.getAttribute("aria-checked")).toBe("true");
    expect(findByTestId(bodyRoot, "workspace-panel-toggle-maps")?.getAttribute("aria-checked")).toBe("false");
    // 「검사」는 패널이 아니라 명령이다.
    expect(findByTestId(bodyRoot, "workspace-panel-toggle-inspect")).toBeNull();
    findByTestId(bodyRoot, "workspace-panel-toggle-maps")?.click();
    expect(clicks).toEqual(["maps"]);
  }, 120_000);

  it("도크가 접혀 있으면 어느 패널도 체크하지 않는다", async () => {
    mountActivityBar(null);

    const bodyRoot = await openPanelsMenu();

    expect(findByTestId(bodyRoot, "workspace-panel-toggle-tools")?.getAttribute("aria-checked")).toBe("false");
    expect(findByTestId(bodyRoot, "workspace-panel-toggle-maps")?.getAttribute("aria-checked")).toBe("false");
  }, 120_000);
});
