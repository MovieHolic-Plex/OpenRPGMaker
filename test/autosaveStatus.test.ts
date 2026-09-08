// allow: SIZE_OK - the scoped repair keeps the original three cases and their local lifecycle fixture together; no new fixture module is authorized.
import { clearTimeout, setTimeout } from "node:timers";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutoSaveState } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FetchControl = {
  readonly calls: readonly { readonly url: string; readonly method: string }[];
  readonly requested: Promise<void>;
  resolveProject: (response: Response) => void;
};

type ListenerMap = Map<string, EventListener[]>;
const releaseResponses: (() => void)[] = [];
const settleWork: (() => Promise<void>)[] = [];
const detach: (() => void)[] = [];

afterEach(cleanupFixture);

async function cleanupFixture(): Promise<void> {
  for (const release of releaseResponses.splice(0)) release();
  for (const settle of settleWork.splice(0)) await bounded(settle());
  for (const dispose of detach.splice(0).reverse()) dispose();
  if (vi.isFakeTimers()) vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
}

describe("autosave status", () => {
  it("holds the projects POST response when telemetry and a projects GET arrive first", async () => {
    // Given: traffic that must not acquire the save response.
    const control = installControlledFetch();
    const telemetry = fetch("/__oprn/edit-activity", { method: "POST" });
    const probe = fetch("http://dbserver:8100/rest/v1/projects?on_conflict=project_id");
    const project = fetch("http://dbserver:8100/rest/v1/projects?on_conflict=project_id", { method: "POST" });
    // When: the controlled response is released.
    control.resolveProject(new Response(null, { status: 202 }));
    const responses = await Promise.all([telemetry, probe, project]);
    // Then: only the actual save receives it; other traffic remains visible.
    expect(responses.map((response) => response.status)).toEqual([201, 201, 202]);
    expect(control.calls).toHaveLength(3);
  });
  it("retains transport until native manual history finishes during teardown", async () => {
    // Given: a real save whose history transport remains in flight after saved.
    vi.useFakeTimers();
    const control = installControlledFetch();
    const transport = fetch;
    const arrived = deferred<void>();
    const release = deferred<void>();
    const handler: typeof fetch = async (input, init) => {
      if (String(input).endsWith("/rest/v1/project_commits") && init?.method === "POST") {
        arrived.resolve();
        await release.promise;
      }
      return transport(input, init);
    };
    vi.stubGlobal("fetch", handler);
    const sync = await import("@/project/supabaseProjectSync");
    const history = vi.spyOn(sync, "recordProjectCommitToSupabase");
    const { store } = await importStoreForAutosave();
    const saving = store.flush();
    await bounded(control.requested);
    control.resolveProject(new Response(null, { status: 201 }));
    await bounded(saving);
    await bounded(arrived.promise);
    const operation = history.mock.results[0];
    if (operation?.type !== "return") throw new Error("Expected real history completion");
    const lifecycle: string[] = [];
    const completed = operation.value.then(() => { lifecycle.push("history"); });
    const restoreMocks = vi.restoreAllMocks.bind(vi);
    vi.spyOn(vi, "restoreAllMocks").mockImplementation(() => {
      lifecycle.push("restore");
      return restoreMocks();
    });
    // When: cleanup starts before the captured history operation can finish.
    const cleaning = cleanupFixture();
    try {
      // Then: history still owns the transport, including its subsequent change POST.
      expect(globalThis.fetch).toBe(handler);
    } finally {
      // Keep the RED control from leaking a real network call after old cleanup.
      vi.stubGlobal("fetch", handler);
      release.resolve();
      await bounded(completed);
      await cleaning;
    }
    expect(lifecycle).toEqual(["history", "restore"]);
    expect(control.calls).toContainEqual({ url: "http://dbserver:8100/rest/v1/project_changes", method: "POST" });
  });

  it("notifies pending, saving, and saved around the 4 second autosave debounce", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T10:02:00.000Z"));
    const fetchControl = installControlledFetch();
    const { store } = await importStoreForAutosave();
    const states: AutoSaveState[] = [];
    detach.push(store.subscribeAutoSave((state) => states.push(state)));
    const completion = nextCompletion(store);

    store.update((draft) => {
      draft.meta.title = "autosave pending";
    });

    expect(store.getAutoSaveState()).toEqual({ kind: "pending" });
    vi.advanceTimersByTime(3999);
    expect(store.getAutoSaveState()).toEqual({ kind: "pending" });

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(store.getAutoSaveState()).toEqual({ kind: "saving" });
    await bounded(fetchControl.requested);
    const saved = bounded(completion);
    fetchControl.resolveProject(new Response(null, { status: 201 }));
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
    detach.push(store.subscribeAutoSave((state) => states.push(state)));
    const firstError = nextCompletion(store);

    store.update((draft) => {
      draft.meta.title = "retry once";
    });
    vi.advanceTimersByTime(4000);
    await bounded(firstError);
    expect(store.getAutoSaveState()).toEqual({ kind: "error", message: "network down", retryCount: 1 });

    expect(projectSaveCalls(fetchSpy)).toHaveLength(1);

    vi.advanceTimersByTime(19_999);
    expect(projectSaveCalls(fetchSpy)).toHaveLength(1);
    const secondError = nextCompletion(store);
    vi.advanceTimersByTime(1);
    await bounded(secondError);
    expect(projectSaveCalls(fetchSpy)).toHaveLength(2);
    expect(store.getAutoSaveState()).toEqual({ kind: "error", message: "network down", retryCount: 2 });
    vi.advanceTimersByTime(39_999);
    expect(projectSaveCalls(fetchSpy)).toHaveLength(2);
    const thirdError = nextCompletion(store);
    vi.advanceTimersByTime(1);
    await bounded(thirdError);
    expect(projectSaveCalls(fetchSpy)).toHaveLength(3);
    expect(store.getAutoSaveState()).toEqual({ kind: "error", message: "network down", retryCount: 3 });
    expect(states.map((state) => state.kind)).toEqual([
      "pending", "saving", "error", "saving", "error", "saving", "error",
    ]);
  });

  it("keeps autosave state out of the map-focused editor statusbar", async () => {
    vi.useFakeTimers();
    detach.push(installFakeDom());
    const windowListeners = installBrowserGlobals();
    detach.push(() => windowListeners.clear());
    const fetchControl = installControlledFetch();
    const renderTilePalette = vi.fn((node: HTMLElement) => {
      node.textContent = "tiles";
    });
    mockEditorDependencies(renderTilePalette);
    const { store } = await importStoreForAutosave();
    const { renderEditor, teardownEditor } = await import("@/editor/panels/editor");
    detach.push(teardownEditor);
    const main = document.createElement("main");
    renderEditor(main);
    renderTilePalette.mockClear();

    const flushPromise = store.flush();
    await Promise.resolve();

    expect(findByTestId(fakeElement(main), "db-autosave-state")).toBeNull();
    expect(renderTilePalette).not.toHaveBeenCalled();

    await bounded(fetchControl.requested);
    const completion = bounded(flushPromise);
    fetchControl.resolveProject(new Response(null, { status: 201 }));
    await completion;

    expect(findByTestId(fakeElement(main), "db-autosave-state")).toBeNull();
    expect(renderTilePalette).not.toHaveBeenCalled();
  });
});

async function importStoreForAutosave(): Promise<typeof import("@/project/store")> {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-house-template-gallery");
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.doMock("@/assets/supabaseResourceCache", () => ({
    cacheSupabaseRootResources: vi.fn(async () => undefined),
  }));
  const sync = await import("@/project/supabaseProjectSync");
  const history = vi.spyOn(sync, "recordProjectCommitToSupabase");
  const activity = await import("@/editor/editActivityLog");
  const [{ createBlankProject }, storeModule] = await Promise.all([
    import("@/project/defaults"),
    import("@/project/store"),
  ]);
  settleWork.push(async () => {
    // The store's actual operation, not flush(): flush could initiate another save.
    const [save] = await Promise.allSettled([storeModule.store["persistInFlight"]]);
    switch (save.status) {
      case "fulfilled": break;
      case "rejected": expect(save.reason).toMatchObject({ message: "network down" }); break;
      default: { const exhaustive: never = save; throw new Error(String(exhaustive)); }
    }
    await Promise.all(history.mock.results.map((result) => {
      if (result.type !== "return") throw new Error("History writer did not return its completion");
      return result.value;
    }));
    await activity.flushEditActivityMirror();
    activity._resetEditActivityForTest();
  });
  storeModule.store.replace(createBlankProject());
  storeModule.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
  return storeModule;
}

function installControlledFetch(): FetchControl {
  const calls: { readonly url: string; readonly method: string }[] = [];
  const response = deferred<Response>();
  const requested = deferred<void>();
  releaseResponses.push(() => response.resolve(new Response(null, { status: 201 })));
  vi.stubGlobal("fetch", (async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    calls.push({ url, method });
    if (url === "http://dbserver:8100/rest/v1/projects?on_conflict=project_id" && method === "POST") {
      requested.resolve();
      return await response.promise;
    }
    return new Response(null, { status: 201 });
  }) satisfies typeof fetch);
  return {
    calls, requested: requested.promise,
    resolveProject: response.resolve,
  };
}

function nextCompletion(store: typeof import("@/project/store").store): Promise<AutoSaveState> {
  const completion = deferred<AutoSaveState>();
  const unsubscribe = store.subscribeAutoSave((state) => {
    switch (state.kind) {
      case "saved": case "error": unsubscribe(); completion.resolve(state); break;
      case "idle": case "pending": case "saving": break;
      default: { const exhaustive: never = state; throw new Error(String(exhaustive)); }
    }
  });
  detach.push(unsubscribe);
  return completion.promise;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("Deferred not initialized"); };
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Autosave fixture completion deadline")), 1000);
    })]);
  } finally { clearTimeout(timer); }
}

function projectSaveCalls(fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>): unknown[] {
  return fetchSpy.mock.calls.filter(([input, init]) =>
    String(input).includes("/rest/v1/projects?") && init?.method === "POST"
  );
}

function installBrowserGlobals(): ListenerMap {
  const listeners: ListenerMap = new Map();
  const storage = new Map<string, string>();
  vi.stubGlobal("window", {
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
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (listener === null) return;
      const callable = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
      listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== callable));
    },
  });
  return listeners;
}

function mockEditorDependencies(renderTilePalette: (node: HTMLElement) => void): void {
  // This map-focused fixture never opens the database; retain the real editor/dock subscriptions.
  vi.doMock("@/editor/panels/databaseModal", () => ({ openDatabaseModal: vi.fn() }));
  vi.doMock("@/app/mode", () => ({
    destroyGame: vi.fn(),
    getGame: vi.fn(() => null),
    startEditGame: vi.fn(async () => ({ scale: { resize: vi.fn() } })),
  }));
  vi.doMock("@/editor/editorToolHook", () => ({ installEditorToolHook: vi.fn(), cleanupProjectE2EBridge: vi.fn() }));
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

function fakeElement(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}
