import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutoSaveState } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FetchControl = {
  readonly calls: readonly (RequestInfo | URL)[];
  resolveFirst: (response: Response) => void;
};

type ListenerMap = Map<string, EventListener[]>;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe("autosave status", () => {
  it("notifies pending, saving, and saved around the 4 second autosave debounce", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T10:02:00.000Z"));
    const fetchControl = installControlledFetch();
    const { store } = await importStoreForAutosave();
    const states: AutoSaveState[] = [];
    store.subscribeAutoSave((state) => states.push(state));

    store.update((draft) => {
      draft.meta.title = "autosave pending";
    });

    expect(store.getAutoSaveState()).toEqual({ kind: "pending" });
    vi.advanceTimersByTime(3999);
    expect(store.getAutoSaveState()).toEqual({ kind: "pending" });

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(store.getAutoSaveState()).toEqual({ kind: "saving" });
    fetchControl.resolveFirst(new Response(null, { status: 201 }));
    await vi.waitFor(() => {
      expect(store.getAutoSaveState().kind).toBe("saved");
    });

    expect(store.getAutoSaveState().kind).toBe("saved");
    expect(states.map((state) => state.kind)).toEqual(["pending", "saving", "saved"]);
    expect(fetchControl.calls.length).toBeGreaterThan(0);
  }, 15_000);

  it("retries with exponential backoff after an autosave error without another update", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchSpy = vi.fn<typeof fetch>(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { store } = await importStoreForAutosave();
    const states: AutoSaveState[] = [];
    store.subscribeAutoSave((state) => states.push(state));

    store.update((draft) => {
      draft.meta.title = "retry once";
    });
    vi.advanceTimersByTime(4000);
    await vi.waitFor(() => {
      expect(store.getAutoSaveState()).toEqual({ kind: "error", message: "network down", retryCount: 1 });
    });

    expect(projectSaveCalls(fetchSpy)).toHaveLength(1);

    vi.advanceTimersByTime(19_999);
    expect(projectSaveCalls(fetchSpy)).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await vi.waitFor(() => {
      expect(projectSaveCalls(fetchSpy)).toHaveLength(2);
    });

    await vi.waitFor(() => {
      expect(store.getAutoSaveState()).toEqual({ kind: "error", message: "network down", retryCount: 2 });
    });
    vi.advanceTimersByTime(39_999);
    expect(projectSaveCalls(fetchSpy)).toHaveLength(2);
    vi.advanceTimersByTime(1);
    await vi.waitFor(() => {
      expect(projectSaveCalls(fetchSpy)).toHaveLength(3);
      expect(store.getAutoSaveState()).toEqual({ kind: "error", message: "network down", retryCount: 3 });
    });
    expect(states.map((state) => state.kind)).toEqual([
      "pending", "saving", "error", "saving", "error", "saving", "error",
    ]);
  });

  it("rerenders only the editor statusbar when autosave state changes outside a project update", async () => {
    const restoreDom = installFakeDom();
    const windowListeners = installBrowserGlobals();
    const fetchControl = installControlledFetch();
    const renderTilePalette = vi.fn((node: HTMLElement) => {
      node.textContent = "tiles";
    });
    mockEditorDependencies(renderTilePalette);
    const { store } = await importStoreForAutosave();
    const { renderEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");
    renderEditor(main);
    renderTilePalette.mockClear();

    const flushPromise = store.flush();
    await Promise.resolve();

    expect(statusText(main)).toContain("저장 중");
    expect(renderTilePalette).not.toHaveBeenCalled();

    fetchControl.resolveFirst(new Response(null, { status: 201 }));
    await flushPromise;

    expect(statusText(main)).toContain("저장됨");
    expect(renderTilePalette).not.toHaveBeenCalled();
    windowListeners.clear();
    restoreDom();
  });
});

async function importStoreForAutosave(): Promise<typeof import("@/project/store")> {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-house-template-gallery");
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.doMock("@/assets/supabaseResourceCache", () => ({
    cacheSupabaseRootResources: vi.fn(async () => undefined),
  }));
  const [{ createBlankProject }, storeModule] = await Promise.all([
    import("@/project/defaults"),
    import("@/project/store"),
  ]);
  storeModule.store.replace(createBlankProject());
  storeModule.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
  return storeModule;
}

function installControlledFetch(): FetchControl {
  const calls: (RequestInfo | URL)[] = [];
  let resolveFirst: ((response: Response) => void) | null = null;
  const firstResponse = new Promise<Response>((resolve) => {
    resolveFirst = resolve;
  });
  vi.stubGlobal("fetch", (async (input) => {
    calls.push(input);
    if (calls.length === 1) return await firstResponse;
    return new Response(null, { status: 201 });
  }) satisfies typeof fetch);
  return {
    calls,
    resolveFirst: (response) => resolveFirst?.(response),
  };
}

function projectSaveCalls(fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>): unknown[] {
  return fetchSpy.mock.calls.filter(([input, init]) =>
    String(input).includes("/rest/v1/projects?") && init?.method === "POST"
  );
}

function installBrowserGlobals(): ListenerMap {
  const listeners: ListenerMap = new Map();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (listener === null) return;
        const callable = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
        listeners.set(type, [...(listeners.get(type) ?? []), callable]);
      },
      confirm: vi.fn(() => true),
      dispatchEvent: (event: Event) => {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return !event.defaultPrevented;
      },
      innerWidth: 1200,
      localStorage: null,
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (listener === null) return;
        const callable = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
        listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== callable));
      },
    },
  });
  return listeners;
}

function mockEditorDependencies(renderTilePalette: (node: HTMLElement) => void): void {
  vi.doMock("@/app/mode", () => ({
    destroyGame: vi.fn(),
    getGame: vi.fn(() => null),
    startEditGame: vi.fn(async () => ({ scale: { resize: vi.fn() } })),
  }));
  vi.doMock("@/editor/editorToolHook", () => ({ installEditorToolHook: vi.fn() }));
  vi.doMock("@/editor/mapEditLocks", () => ({
    ensureCurrentMapLock: vi.fn(),
    getMapEditLockStatus: () => ({ kind: "idle" }),
    isMapEditLockTakeoverImmediate: () => false,
    mapEditLockLastActivityText: () => "방금 활동",
    subscribeMapEditLocks: vi.fn(() => () => undefined),
    takeoverMapLock: vi.fn(async () => undefined),
  }));
  vi.doMock("@/editor/panels/aiChatPanel", () => ({
    renderAiChatPanel: () => document.createElement("div"),
  }));
  vi.doMock("@/editor/panels/editorZoomToolbar", () => ({
    renderCanvasToolbar: (node: HTMLElement) => {
      node.textContent = "zoom";
    },
  }));
  vi.doMock("@/editor/panels/mapList", () => ({
    renderMapList: (node: HTMLElement) => {
      node.textContent = "maps";
    },
  }));
  vi.doMock("@/editor/panels/testPlayModal", () => ({
    closeTestPlayModal: vi.fn(),
    openTestPlayModal: vi.fn(),
  }));
  vi.doMock("@/editor/panels/tilePalette", () => ({ renderTilePalette }));
}

function statusText(root: HTMLElement): string {
  const state = findByTestId(fakeElement(root), "db-autosave-state");
  if (!state) throw new Error("db-autosave-state missing");
  return state.textContent;
}

function fakeElement(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}
