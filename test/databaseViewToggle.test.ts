import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const VIEW_MODE_STORAGE_KEY = "oprn:database.viewMode";

// DatabaseCollection 키 전체 = 아이콘 보유 컬렉션 9종. monsterSpecies는 DatabaseCollection이
// 아니며 별도 렌더 경로라 갤러리 기본값 대상에서 제외된다.
const RECORD_COLLECTIONS: readonly DatabaseCollection[] = [
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "enemies",
  "troops",
  "states",
  "battleAnimations",
];

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;
let storage: Storage;

beforeEach(() => {
  // 매 테스트마다 모듈 그래프를 비운다 — 세션 모듈이 localStorage를 import 시점에 읽으므로
  // "localStorage 재읽기"를 진짜 재import로 검증할 수 있다.
  vi.resetModules();
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  storage = createFakeLocalStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      localStorage: storage,
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  });
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousWindow);
  Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  vi.resetModules();
});

describe("database per-collection view mode session", () => {
  it("defaults: every tab to list without stored state (gallery is opt-in)", async () => {
    const session = await import("@/editor/panels/databaseRecordViewSession");

    for (const collection of RECORD_COLLECTIONS) {
      expect(session.viewModeForCollection(collection)).toBe("list");
    }

    // 비레코드 탭(스위치/용어/요소 등)은 뷰 모드 상태를 갖지 않는다 — 접근자는 list.
    for (const tab of ["switches", "terms", "elements", "terrain", "system"]) {
      expect(session.viewModeForCollection(tab as DatabaseCollection)).toBe("list");
    }

    // 기본 상태만으로는 localStorage에 아무것도 기록되지 않는다.
    expect(storage.getItem(VIEW_MODE_STORAGE_KEY)).toBeNull();
  });

  it("clicking db-view-toggle-gallery on items flips state to gallery and persists across re-render and localStorage re-read", async () => {
    const { renderRecordTab, resetDatabaseRecordViewSession } = await import("@/editor/panels/databaseRecordViews");
    resetDatabaseRecordViewSession();
    const session = await import("@/editor/panels/databaseRecordViewSession");

    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderRecordTab(host, "items", rerender);
    };
    rerender();

    const galleryToggle = findByTestId(host, "db-view-toggle-gallery");
    if (!galleryToggle) throw new Error("missing gallery view toggle");
    galleryToggle.click();

    // 클릭은 컬렉션별 세션 상태를 바꾸고 localStorage JSON 맵에 지속한다.
    expect(session.viewModeForCollection("items")).toBe("gallery");
    expect(session.viewModeForCollection("skills")).toBe("list");
    const stored = storage.getItem(VIEW_MODE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ items: "gallery", actors: "list" });

    // 기존 rerender 경로로 다시 그려도 gallery 모드가 유지된다.
    expect(findByTestId(host, "db-view-toggle-gallery")?.attrs["aria-pressed"]).toBe("true");
    expect(findByTestId(host, "db-view-toggle-list")?.attrs["aria-pressed"]).toBe("false");

    // 완전히 새 renderRecordTab 호스트에서도 유지된다(탭 전환 후 복귀 시나리오).
    const freshHost = document.createElement("div") as unknown as FakeElement;
    renderRecordTab(freshHost, "items", () => undefined);
    expect(findByTestId(freshHost, "db-view-toggle-gallery")?.attrs["aria-pressed"]).toBe("true");
    expect(findByTestId(freshHost, "db-view-toggle-list")?.attrs["aria-pressed"]).toBe("false");

    // localStorage 재읽기: 모듈을 새로 import하면 저장된 상태를 복원한다.
    vi.resetModules();
    const freshSession = await import("@/editor/panels/databaseRecordViewSession");
    expect(freshSession.viewModeForCollection("items")).toBe("gallery");
    expect(freshSession.viewModeForCollection("skills")).toBe("list");
  });

  it("toggle buttons exist with correct aria-pressed and active class", async () => {
    const { renderRecordTab } = await import("@/editor/panels/databaseRecordViews");
    const host = renderRecordHost(renderRecordTab, "skills");

    const gallery = findByTestId(host, "db-view-toggle-gallery");
    const list = findByTestId(host, "db-view-toggle-list");
    if (!gallery || !list) throw new Error("missing view toggle buttons");

    // 기본 list: list 버튼이 pressed + active, gallery 버튼은 비활성.
    expect(list.attrs["aria-pressed"]).toBe("true");
    expect(gallery.attrs["aria-pressed"]).toBe("false");
    expect(list.className).toContain("db-view-toggle");
    expect(list.className).toContain("active");
    expect(gallery.className).toContain("db-view-toggle");
    expect(gallery.className).not.toContain("active");

    // list 버튼 클릭은 모드를 바꾸지 않는다(이미 list).
    list.click();
    expect(list.attrs["aria-pressed"]).toBe("true");
  });

  it("elements/terrain/utility tabs never render the view toggle", async () => {
    const { renderSwitchesTab } = await import("@/editor/panels/databaseUtilityViews");
    const { renderElementsTab } = await import("@/editor/panels/databaseUtilityRecordViews");

    const switchesHost = document.createElement("div") as unknown as FakeElement;
    renderSwitchesTab(switchesHost, () => undefined);
    expect(switchesHost.querySelectorAll(".db-view-toggle")).toHaveLength(0);
    expect(findByTestId(switchesHost, "db-view-toggle-gallery")).toBeNull();

    const elementsHost = document.createElement("div") as unknown as FakeElement;
    renderElementsTab(elementsHost);
    expect(elementsHost.querySelectorAll(".db-view-toggle")).toHaveLength(0);
    expect(findByTestId(elementsHost, "db-view-toggle-list")).toBeNull();
  });
});

function renderRecordHost(
  renderRecordTab: (host: HTMLElement, collection: DatabaseCollection, rerender: () => void) => void,
  collection: DatabaseCollection
): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  renderRecordTab(host, collection, () => undefined);
  if (host instanceof FakeElement) return host;
  throw new Error("Expected fake database host");
}

function createFakeLocalStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage;
}

function restoreBrowserGlobal(name: "window", value: typeof globalThis.window | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
