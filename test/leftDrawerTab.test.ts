import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  LEFT_DRAWER_TAB_KEY,
  activateLeftDrawerTab,
  applyLeftDrawerTab,
  loadLeftDrawerTab,
  parseLeftDrawerTab,
  rememberTileWork,
  renderLeftDrawerTabs,
  resetLeftDrawerTabForTests,
  saveLeftDrawerTab,
  syncLeftDrawerTabs,
  tabForEditorLayer,
} from "@/editor/leftDrawerTab";
import { installFakeDom, findByTestId, renderWithFakeDom } from "./fakeDom";

let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

describe("leftDrawerTab", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    installFakeLocalStorage();
    resetLeftDrawerTabForTests();
    editorState.set({ layer: "lower", tool: "paint" });
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
    resetLeftDrawerTabForTests();
  });

  it("모르는 값은 타일 탭으로 읽는다", () => {
    expect(parseLeftDrawerTab(null)).toBe("tile");
    expect(parseLeftDrawerTab("nope")).toBe("tile");
    expect(loadLeftDrawerTab()).toBe("tile");
  });

  it("저장한 탭을 다시 읽는다", () => {
    saveLeftDrawerTab("map");
    expect(storage.get(LEFT_DRAWER_TAB_KEY)).toBe("map");
    expect(loadLeftDrawerTab()).toBe("map");
  });

  it("맵 탭은 레이어가 바뀌어도 유지한다", () => {
    expect(tabForEditorLayer("event", "map")).toBe("map");
    expect(tabForEditorLayer("event", "tile")).toBe("event");
    expect(tabForEditorLayer("lower", "event")).toBe("tile");
  });

  it("이벤트 탭은 레이어를 이벤트로 바꾼다", () => {
    activateLeftDrawerTab("event");
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
    expect(loadLeftDrawerTab()).toBe("event");
  });

  it("타일 탭은 직전 타일 레이어로 돌아간다", () => {
    rememberTileWork({ ...editorState.get(), layer: "upper", tool: "fill" });
    editorState.set({ layer: "event", tool: "event" });
    activateLeftDrawerTab("tile");
    expect(editorState.get().layer).toBe("upper");
    expect(editorState.get().tool).toBe("fill");
  });

  it("탭 버튼을 그리고 클릭하면 onSelect를 부른다", () => {
    const picked: string[] = [];
    const bar = renderWithFakeDom(() =>
      renderLeftDrawerTabs({
        getActive: () => "tile",
        onSelect: (tab) => picked.push(tab),
      }),
    );
    expect(findByTestId(bar, "left-drawer-tabs")).toBeTruthy();
    expect(findByTestId(bar, "left-drawer-tab-map")?.textContent).toBe("맵");
    expect(findByTestId(bar, "left-drawer-tab-tile")?.classList.contains("is-active")).toBe(true);
    findByTestId(bar, "left-drawer-tab-event")?.click();
    expect(picked).toEqual(["event"]);
  });

  it("left 루트에 가중치 클래스를 붙이고 탭 선택을 맞춘다", () => {
    const left = document.createElement("div");
    applyLeftDrawerTab(left, "map");
    expect(left.classList.contains("is-drawer-map")).toBe(true);
    expect(left.dataset.drawerTab).toBe("map");
    const bar = renderLeftDrawerTabs({
      getActive: () => "tile",
      onSelect: () => undefined,
    });
    syncLeftDrawerTabs(bar, "map");
    const mapTab = bar.querySelector('[data-testid="left-drawer-tab-map"]');
    expect(mapTab?.classList.contains("is-active")).toBe(true);
    expect(mapTab?.getAttribute("aria-selected")).toBe("true");
  });
});
