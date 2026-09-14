import { beforeEach, describe, expect, it, vi } from "vitest";
import { reloadProjectFromDbNow, saveProjectNow } from "@/editor/saveActions";

type MockFlushResult =
  | { readonly kind: "conflict"; readonly conflicts: readonly { readonly mapId: string; readonly name: string }[] }
  | { readonly kind: "disabled" }
  | { readonly kind: "not-configured" }
  | { readonly kind: "not-loaded" }
  | { readonly kind: "saved" }
  | { readonly kind: "saved-local" };

const mocks = vi.hoisted(() => ({
  flush: vi.fn<() => Promise<MockFlushResult>>(),
  toast: vi.fn<typeof import("@/util/toast").toast>(),
  dismissToastsByKey: vi.fn<typeof import("@/util/toast").dismissToastsByKey>(),
  isLoaded: vi.fn(() => true),
  hasUnsavedChanges: vi.fn(() => true),
  getAutoSaveState: vi.fn(() => ({ kind: "idle" as const })),
  getPersistenceRecovery: vi.fn(() => ({ kind: "ready" as const })),
  reloadFromRemote: vi.fn(),
  getCurrent: vi.fn(),
  isSharedDemoSession: vi.fn(() => false),
  supabaseProjectConfig: vi.fn(),
  editorGet: vi.fn(() => ({ currentMapId: "start" })),
  editorSet: vi.fn(),
  focusProjectStartMap: vi.fn(),
}));

vi.mock("@/project/store", () => ({
  store: {
    flush: mocks.flush,
    isLoaded: mocks.isLoaded,
    hasUnsavedChanges: mocks.hasUnsavedChanges,
    getAutoSaveState: mocks.getAutoSaveState,
    getPersistenceRecovery: mocks.getPersistenceRecovery,
    reloadFromRemote: mocks.reloadFromRemote,
    getCurrent: mocks.getCurrent,
    isSharedDemoSession: mocks.isSharedDemoSession,
  },
}));

vi.mock("@/util/toast", () => ({
  toast: mocks.toast,
  dismissToastsByKey: mocks.dismissToastsByKey,
}));

vi.mock("@/project/supabaseProjectConfig", () => ({
  supabaseProjectConfig: mocks.supabaseProjectConfig,
}));

vi.mock("@/editor/editorState", () => ({
  editorState: {
    get: mocks.editorGet,
    set: mocks.editorSet,
  },
}));

vi.mock("@/editor/mapSelection", () => ({
  focusProjectStartMap: mocks.focusProjectStartMap,
}));

describe("saveProjectNow", () => {
  beforeEach(() => {
    mocks.flush.mockReset();
    mocks.toast.mockReset();
    mocks.dismissToastsByKey.mockReset();
    mocks.isLoaded.mockReset();
    mocks.hasUnsavedChanges.mockReset();
    mocks.getAutoSaveState.mockReset();
    mocks.getPersistenceRecovery.mockReset();
    mocks.reloadFromRemote.mockReset();
    mocks.getCurrent.mockReset();
    mocks.supabaseProjectConfig.mockReset();
    mocks.isLoaded.mockReturnValue(true);
    mocks.hasUnsavedChanges.mockReturnValue(true);
    mocks.getAutoSaveState.mockReturnValue({ kind: "idle" });
    mocks.getPersistenceRecovery.mockReturnValue({ kind: "ready" });
    mocks.supabaseProjectConfig.mockReturnValue({
      projectId: "recovery-fixture",
      url: "http://127.0.0.1:9",
      anonKey: "local-anon",
    });
  });

  it("shows a saving toast immediately and a completion toast after flush resolves", async () => {
    const pendingSave = deferred<MockFlushResult>();
    mocks.flush.mockReturnValueOnce(pendingSave.promise);

    const savePromise = saveProjectNow();

    expect(mocks.toast).toHaveBeenNthCalledWith(1, "저장 중...", "info");

    pendingSave.resolve({ kind: "saved" });
    await expect(savePromise).resolves.toBe(true);
    expect(mocks.toast).toHaveBeenNthCalledWith(2, "저장 완료", "ok");
  });
});

describe("reloadProjectFromDbNow", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.dismissToastsByKey.mockReset();
    mocks.isLoaded.mockReset();
    mocks.hasUnsavedChanges.mockReset();
    mocks.reloadFromRemote.mockReset();
    mocks.getCurrent.mockReset();
    mocks.supabaseProjectConfig.mockReset();
    mocks.editorGet.mockReset();
    mocks.editorSet.mockReset();
    mocks.focusProjectStartMap.mockReset();
    mocks.isLoaded.mockReturnValue(true);
    mocks.hasUnsavedChanges.mockReturnValue(true);
    mocks.editorGet.mockReturnValue({ currentMapId: "start" });
    mocks.getCurrent.mockReturnValue({ maps: { start: {} } });
    mocks.supabaseProjectConfig.mockReturnValue({
      projectId: "recovery-fixture",
      url: "http://127.0.0.1:9",
      anonKey: "local-anon",
    });
  });

  it("rejects a changed target and does not reload", async () => {
    mocks.supabaseProjectConfig.mockReturnValue({
      projectId: "other-fixture",
      url: "http://127.0.0.1:9",
      anonKey: "local-anon",
    });
    const result = await reloadProjectFromDbNow({ force: true, expectedProjectId: "recovery-fixture" });
    expect(result).toBe(false);
    expect(mocks.reloadFromRemote).not.toHaveBeenCalled();
    expect(mocks.hasUnsavedChanges()).toBe(true);
    expect(mocks.dismissToastsByKey).not.toHaveBeenCalled();
  });

  it("reloads the captured target and dismisses recovery-owned toasts", async () => {
    const started = deferred<{ readonly force?: boolean }>();
    mocks.reloadFromRemote.mockImplementation((options: { readonly force?: boolean }) => {
      started.resolve(options);
      return Promise.resolve({ kind: "reloaded", title: "accepted remote", projectId: "recovery-fixture" });
    });
    const resultPromise = reloadProjectFromDbNow({ force: true, expectedProjectId: "recovery-fixture" });
    const options = await started.promise;
    expect(options.force).toBe(true);
    await expect(resultPromise).resolves.toBe(true);
    expect(mocks.dismissToastsByKey).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolveValue: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  if (!resolveValue) throw new Error("deferred promise resolver was not initialized");
  return { promise, resolve: resolveValue };
}
