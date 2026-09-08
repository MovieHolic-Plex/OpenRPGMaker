// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutoSaveState } from "@/project/store";
import { nextAutoSaveState } from "./persistenceTestSignals";

type FetchControl = {
  readonly calls: readonly (RequestInfo | URL)[];
  resolveFirst: (response: Response) => void;
};

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
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

    const saving = nextAutoSaveState(store, (state) => state.kind === "saving");
    vi.advanceTimersByTime(1);
    expect(await saving).toEqual({ kind: "saving" });
    const saved = nextAutoSaveState(store, (state) => state.kind === "saved");
    fetchControl.resolveFirst(new Response(null, { status: 201 }));
    await saved;

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

    const firstError = nextAutoSaveState(store, (state) => state.kind === "error" && state.retryCount === 1);
    store.update((draft) => {
      draft.meta.title = "retry once";
    });
    vi.advanceTimersByTime(4000);
    expect(await firstError).toEqual({ kind: "error", message: "network down", retryCount: 1 });

    expect(projectSaveCalls(fetchSpy)).toHaveLength(1);

    vi.advanceTimersByTime(19_999);
    expect(projectSaveCalls(fetchSpy)).toHaveLength(1);
    const secondError = nextAutoSaveState(store, (state) => state.kind === "error" && state.retryCount === 2);
    vi.advanceTimersByTime(1);
    expect(await secondError).toEqual({ kind: "error", message: "network down", retryCount: 2 });
    expect(projectSaveCalls(fetchSpy)).toHaveLength(2);
    vi.advanceTimersByTime(39_999);
    expect(projectSaveCalls(fetchSpy)).toHaveLength(2);
    const thirdError = nextAutoSaveState(store, (state) => state.kind === "error" && state.retryCount === 3);
    vi.advanceTimersByTime(1);
    expect(await thirdError).toEqual({ kind: "error", message: "network down", retryCount: 3 });
    expect(projectSaveCalls(fetchSpy)).toHaveLength(3);
    expect(states.map((state) => state.kind)).toEqual([
      "pending", "saving", "error", "saving", "error", "saving", "error",
    ]);
  });

  it("keeps autosave state out of the map-focused editor statusbar", async () => {
    vi.useFakeTimers();
    const fetchControl = installControlledFetch();
    const renderTilePalette = vi.fn((node: HTMLElement) => {
      node.textContent = "tiles";
    });
    mockEditorDependencies(renderTilePalette);
    const { store } = await importStoreForAutosave();
    const { renderEditor, teardownEditor } = await import("@/editor/panels/editor");
    const main = document.createElement("main");
    document.body.append(main);
    renderEditor(main);
    try {
      expect(main.querySelector('[data-testid="edit-canvas"]')).not.toBeNull();
      expect(renderTilePalette).toHaveBeenCalled();
      renderTilePalette.mockClear();
      const saving = nextAutoSaveState(store, (state) => state.kind === "saving");
      const flushPromise = store.flush();
      await saving;

      expect(main.querySelector('[data-testid="db-autosave-state"]')).toBeNull();
      expect(renderTilePalette).not.toHaveBeenCalled();

      fetchControl.resolveFirst(new Response(null, { status: 201 }));
      await flushPromise;

      expect(store.getAutoSaveState().kind).toBe("saved");
      expect(main.querySelector('[data-testid="db-autosave-state"]')).toBeNull();
      expect(renderTilePalette).not.toHaveBeenCalled();
    } finally {
      teardownEditor();
    }
  });
});

async function importStoreForAutosave(): Promise<typeof import("@/project/store")> {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-house-template-gallery");
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.doMock("@/assets/supabaseResourceCache", () => ({
    cacheSupabaseRootResources: vi.fn(async () => ({ cached: [], skipped: [] })),
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
    if (!String(input).includes("/rest/v1/")) return new Response("{}", { status: 200 });
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

function mockEditorDependencies(renderTilePalette: (node: HTMLElement) => void): void {
  // Opening the database is not part of the canvas/save subscription contract.
  vi.doMock("@/editor/panels/databaseModal", () => ({ openDatabaseModal: vi.fn() }));
  vi.doMock("@/assets/editorAssetWarmup", () => ({ scheduleEditorAssetWarmup: vi.fn() }));
  vi.doMock("@/editor/panels/aiConnectionStatus", () => ({ refreshAiConnectionStatus: vi.fn(async () => undefined) }));
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
    mapEditLockLastActivityText: () => "방금 활동",
    subscribeMapEditLocks: vi.fn(() => () => undefined),
    takeoverMapLock: vi.fn(async () => undefined),
  }));
  vi.doMock("@/editor/panels/aiChatPanel", () => ({
    renderAiChatPanel: () => document.createElement("div"),
    teardownAiChatPanel: vi.fn(),
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
