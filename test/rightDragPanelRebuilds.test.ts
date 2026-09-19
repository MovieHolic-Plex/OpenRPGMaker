// 우클릭 영역 드래그 중 좌측 독이 몇 번 다시 지어지는가 — 숫자로 못 박는다.
//
// 실측 배경: `updateRightRegionGesture` 는 pointermove 마다 `selectTileRegion` 을 부르고,
// `editorState.subscribe(() => refreshPanels())` 는 키 검사도 코얼레싱도 없이 통지를 받아
// `renderLeftDockPanels()` 로 `tiles`/`maps`/`assistant` 패널의 `render(host)` 를 처음부터
// 재실행했다. 게다가 `selectTileRegion` 은 **매번 새 객체 리터럴**을 만들고 `editorState.set`
// 의 무변경 판정은 참조 비교라, 같은 칸 안에서 마우스를 흔드는 프레임도 전부 통지가 됐다.
//
// 이 테스트는 두 방어선을 함께 잰다:
//   1. 값이 같으면 통지하지 않는다 (mapClipboard.selectTileRegion)
//   2. 한 틱 안의 통지 N개는 재구축 1회로 접힌다 (editor.ts scheduleFullPanelRefresh)
//
// 재구축 횟수는 목업 `renderTilePalette` 호출 수로 센다 — 좌측 독 재구축마다 정확히 한 번
// 불린다. `renderDockPanels` 를 직접 목업하면 독이 실제로 조립되지 않아 계약이 사라진다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

const EDITOR_LAYOUT_KEY = "oprn:editor-layout:v4";
const LAYOUT_VERSION_KEY = "oprn:editor-layout-version";
const LAYOUT_VERSION = "2026-07-24-maptree-300";
const WORKSPACE_KEY = "oprn:workspace:v1";
const UI_MODE_KEY = "oprn:editor-ui-mode";

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
/** 좌측 독이 처음부터 다시 조립될 때마다 1 증가. */
let paletteRenders = 0;

function fake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function installStorage(): void {
  storage = new MemoryStorage();
  storage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
  storage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth: 526, mapTreeHeight: 300, chatDock: "glass" }));
  storage.setItem(UI_MODE_KEY, "standard");
  storage.setItem(WORKSPACE_KEY, JSON.stringify({
    presetId: "map",
    docks: { left: ["tiles", "maps"], right: ["assistant"], bottom: [] },
  }));
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

/** 좌측 독 재구축 횟수만 보려는 테스트다 — Phaser·AI·모달은 흉내만 낸다. */
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
      paletteRenders += 1;
      node.textContent = "tiles";
    },
  }));
}

/** 코얼레싱은 queueMicrotask 로 접힌다 — 매크로태스크 한 번이면 확실히 배출된다. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.resetModules();
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installStorage();
  installBrowserGlobals();
  mockEditorDependencies();
  paletteRenders = 0;
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("우클릭 영역 드래그 중 좌측 독 재구축", () => {
  it("선택만 바뀌는 드래그는 좌측 독을 다시 짓지 않는다 (예전: 접혀도 1회)", async () => {
    const { renderEditor } = await import("@/editor/panels/editor");
    const { selectTileRegion } = await import("@/editor/mapClipboard");
    const main = document.createElement("main");
    renderEditor(main);
    fake(main);
    await flush();

    const mapId = Object.keys(store.getCurrent().maps)[0]!;
    paletteRenders = 0;

    // 드래그 흉내: 사각형이 8단계로 커지고, 각 단계에서 같은 칸 안을 5프레임 움직인다.
    const steps = 8;
    const framesPerStep = 5;
    for (let step = 1; step <= steps; step += 1) {
      for (let frame = 0; frame < framesPerStep; frame += 1) {
        selectTileRegion(mapId, { mapId, x: 1, y: 1, width: step + 1, height: step + 1 });
      }
    }
    // 드래그 도중에는 아직 아무것도 다시 짓지 않는다 — 통지는 마이크로태스크로 접혀 있다.
    expect(paletteRenders, "드래그 중 재구축").toBe(0);

    await flush();
    // 선택·붙여넣기 고스트는 캔버스 오버레이만 바꾼다. 좌측 독은 손대지 않는다.
    expect(paletteRenders, "드래그 종료 후 재구축").toBe(0);
  }, 120_000);

  it("같은 사각형만 다시 넣으면 재구축이 아예 일어나지 않는다", async () => {
    const { renderEditor } = await import("@/editor/panels/editor");
    const { selectTileRegion } = await import("@/editor/mapClipboard");
    const main = document.createElement("main");
    renderEditor(main);
    fake(main);
    await flush();

    const mapId = Object.keys(store.getCurrent().maps)[0]!;
    // 첫 선택은 실제 변경이므로 한 번은 짓는다. 그 뒤를 잰다.
    selectTileRegion(mapId, { mapId, x: 2, y: 2, width: 4, height: 3 });
    await flush();
    paletteRenders = 0;

    for (let i = 0; i < 30; i += 1) {
      selectTileRegion(mapId, { mapId, x: 2, y: 2, width: 4, height: 3 });
    }
    await flush();
    expect(paletteRenders, "같은 사각형 30회 재제출").toBe(0);
  }, 120_000);
});
