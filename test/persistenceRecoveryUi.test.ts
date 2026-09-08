/** @vitest-environment happy-dom */
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import { saveProjectNow } from "@/editor/saveActions";
import { renderOnlineSaveStatus } from "@/editor/panels/dbConnectionStatus";
import { closePersistenceRecovery } from "@/editor/persistenceRecoveryUi";
import { createBlankProject } from "@/project/defaults";
import { SpatialPersistenceError } from "@/project/spatial/persistence";
import { ProjectRoutingError } from "@/project/spatial/saveRouting";
import { store, type AutoSaveState, type ProjectPersistenceRecovery } from "@/project/store";
import type { Project } from "@/project/types";

const mocks = vi.hoisted(() => ({
  toast: vi.fn<typeof import("@/util/toast").toast>(),
  downloadBlob: vi.fn<(blob: Blob, fileName: string) => void>(),
  liveProjectId: { current: "recovery-fixture" },
}));

vi.mock("@/util/toast", () => ({ toast: mocks.toast, dismissToastsByKey: vi.fn() }));
vi.mock("@/editor/editorState", () => ({ editorState: { get: () => ({ currentMapId: null }) } }));
vi.mock("@/editor/mapSelection", () => ({ focusProjectStartMap: vi.fn() }));
vi.mock("@/project/supabaseProjectConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/project/supabaseProjectConfig")>();
  return {
    ...actual,
    supabaseProjectConfig: () => ({
      projectId: mocks.liveProjectId.current,
      url: "http://127.0.0.1:9",
      anonKey: "local-anon",
    }),
  };
});
vi.mock("@/util/downloadBlob", () => ({ downloadBlob: mocks.downloadBlob }));
vi.mock("@/project/package", () => ({
  createProjectPackage: () => new Blob(["draft"]),
  projectPackageFileName: (project: { readonly meta: { readonly title?: string } }) =>
    `${String(project.meta.title ?? "project").replace(/\s+/g, "-")}.oprn`,
}));

let autoSaveState: AutoSaveState = { kind: "error", message: "충돌" };
let recovery: ProjectPersistenceRecovery = {
  kind: "blocked",
  error: new SpatialPersistenceError("conflict", "stale token", 409),
  actions: ["reload", "export-copy"],
};
let dirty = true;
const projectId = { current: "recovery-fixture" };

function dirtyDraft(): Project {
  const base = createBlankProject();
  return { ...base, meta: { ...base.meta, title: "dirty local draft" } };
}

beforeEach(() => {
  document.body.replaceChildren();
  mocks.toast.mockReset();
  mocks.downloadBlob.mockReset();
  autoSaveState = { kind: "error", message: "충돌" };
  recovery = {
    kind: "blocked",
    error: new SpatialPersistenceError("conflict", "stale token", 409),
    actions: ["reload", "export-copy"],
  };
  dirty = true;
  projectId.current = "recovery-fixture";
  mocks.liveProjectId.current = "recovery-fixture";
  vi.spyOn(store, "getAutoSaveState").mockImplementation(() => autoSaveState);
  vi.spyOn(store, "getPersistenceRecovery").mockImplementation(() => recovery);
  vi.spyOn(store, "hasUnsavedChanges").mockImplementation(() => dirty);
  vi.spyOn(store, "isLoaded").mockReturnValue(true);
  vi.spyOn(store, "getCurrent").mockReturnValue(dirtyDraft());
  vi.spyOn(store, "flush").mockRejectedValue(new SpatialPersistenceError("conflict", "stale token", 409));
  vi.spyOn(store, "reloadFromRemote").mockResolvedValue({
    kind: "reloaded",
    title: "accepted remote",
    projectId: "recovery-fixture",
  });
  vi.spyOn(store, "subscribe").mockImplementation(() => () => undefined);
  vi.spyOn(store, "getDbPersistenceStatus").mockImplementation(() => ({
    kind: "ready" as const,
    projectId: projectId.current,
    source: "env" as const,
    url: "http://127.0.0.1:9",
  }));
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:9");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "local-anon");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", projectId.current);
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
});

afterEach(() => {
  closePersistenceRecovery();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function findByTestId(root: ParentNode, testid: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function chip(recoveryState: ProjectPersistenceRecovery = recovery): HTMLElement {
  recovery = recoveryState;
  return renderOnlineSaveStatus(
    { kind: "ready", projectId: projectId.current, source: "env", url: "http://127.0.0.1:9" },
    () => undefined,
    () => undefined,
  );
}

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolveValue: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  if (!resolveValue) throw new Error("deferred promise resolver was not initialized");
  return { promise, resolve: resolveValue };
}

describe("canonical persistence recovery controls", () => {
  it("replaces silent retry with reload and export-copy when the store is blocked", () => {
    const surface = chip();
    expect(findByTestId(surface, "db-autosave-retry")).toBeNull();
    expect(findByTestId(surface, "persistence-recovery-open")).not.toBeNull();
    expect(findByTestId(surface, "db-autosave-state")?.dataset.recoveryCode).toBe("conflict");
  });

  it("keeps the ordinary retry button for unblocked transport errors", () => {
    autoSaveState = { kind: "error", message: "network down", retryCount: 1 };
    const surface = chip({ kind: "ready" });
    expect(findByTestId(surface, "db-autosave-retry")).not.toBeNull();
    expect(findByTestId(surface, "persistence-recovery-open")).toBeNull();
    expect(findByTestId(surface, "db-autosave-state")?.dataset.autosaveKind).toBe("error");
  });

  it("shows migration-required without offering an upsert retry", () => {
    recovery = {
      kind: "blocked",
      error: new SpatialPersistenceError("migration-required", "missing RPC", 404),
      actions: ["reload", "export-copy"],
    };
    autoSaveState = { kind: "error", message: "missing RPC" };
    const surface = chip();
    expect(findByTestId(surface, "db-autosave-state")?.dataset.recoveryCode).toBe("migration-required");
    expect(findByTestId(surface, "db-autosave-retry")).toBeNull();
  });

  it("keeps AutoSaveState visible beside a separate mirror warning", () => {
    autoSaveState = { kind: "saving" };
    const surface = chip({ kind: "ready", mirror: { status: "warning", error: new Error("projection") } });
    expect(findByTestId(surface, "db-autosave-state")?.dataset.autosaveKind).toBe("saving");
    expect(findByTestId(surface, "persistence-mirror-warning")?.dataset.mirrorStatus).toBe("warning");
    expect(findByTestId(surface, "db-autosave-retry")).toBeNull();
    expect(findByTestId(surface, "persistence-recovery-open")).toBeNull();
  });

  it("still marks an accepted root save with a mirror warning when idle/saved", () => {
    autoSaveState = { kind: "saved", at: 1 };
    const surface = chip({ kind: "ready", mirror: { status: "warning", error: new Error("projection") } });
    expect(findByTestId(surface, "persistence-mirror-warning")?.dataset.mirrorStatus).toBe("warning");
    expect(findByTestId(surface, "db-autosave-state")?.dataset.autosaveKind).toBe("saved");
  });

  it("opens recovery on canonical save conflict and cancel keeps the dirty draft", async () => {
    await saveProjectNow();
    const modal = findByTestId(document.body, "persistence-recovery-modal");
    assert(modal !== null);
    expect(findByTestId(modal, "persistence-recovery-code")?.textContent).toBe("conflict");
    expect(store.flush).toHaveBeenCalledTimes(1);
    findByTestId(modal, "persistence-recovery-cancel")?.click();
    expect(findByTestId(document.body, "persistence-recovery-modal")).toBeNull();
    expect(store.reloadFromRemote).not.toHaveBeenCalled();
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
  });

  it("export-copy keeps the local draft and the active project identity", async () => {
    await saveProjectNow();
    findByTestId(document.body, "persistence-recovery-export")?.click();
    expect(mocks.downloadBlob).toHaveBeenCalledTimes(1);
    expect(String(mocks.downloadBlob.mock.calls[0]?.[1])).toContain("dirty-local-draft");
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.reloadFromRemote).not.toHaveBeenCalled();
    expect(projectId.current).toBe("recovery-fixture");
    expect(findByTestId(document.body, "persistence-recovery-modal")).not.toBeNull();
  });

  it("reloads only after an explicit recovery action and binds the captured project id", async () => {
    // Given: observe both the remote request and completed reload before clicking.
    const started = deferred<Parameters<typeof store.reloadFromRemote>[0]>();
    const completed = deferred<void>();
    vi.mocked(store.reloadFromRemote).mockImplementation((options) => {
      started.resolve(options);
      return Promise.resolve({ kind: "reloaded", title: "accepted remote", projectId: "recovery-fixture" });
    });
    await saveProjectNow();
    mocks.toast.mockImplementation((_message, options) => {
      if (options === "ok") completed.resolve();
    });
    expect(store.reloadFromRemote).not.toHaveBeenCalled();
    // When: the user explicitly requests recovery.
    findByTestId(document.body, "persistence-recovery-reload")?.click();
    const options = await started.promise;
    await completed.promise;
    // Then: the force contract is preserved and reload has finished before teardown.
    expect(options?.force).toBe(true);
    expect(store.flush).toHaveBeenCalledTimes(1);
  });

  it("rejects reload when the live target changed across the async boundary", async () => {
    const toasted = deferred<void>();
    await saveProjectNow();
    mocks.toast.mockImplementation(() => {
      toasted.resolve();
    });
    mocks.liveProjectId.current = "other-fixture";
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "other-fixture");
    findByTestId(document.body, "persistence-recovery-reload")?.click();
    await toasted.promise;
    expect(store.reloadFromRemote).not.toHaveBeenCalled();
    expect(store.hasUnsavedChanges()).toBe(true);
  });

  it("closes an open recovery surface when the project identity changes", async () => {
    await saveProjectNow();
    expect(findByTestId(document.body, "persistence-recovery-modal")).not.toBeNull();
    projectId.current = "other-project";
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "other-project");
    const listener = vi.mocked(store.subscribe).mock.calls[0]?.[0];
    listener?.(store.getCurrent(), { scope: "project", origin: "system", projectSwitch: true });
    expect(findByTestId(document.body, "persistence-recovery-modal")).toBeNull();
    expect(store.reloadFromRemote).not.toHaveBeenCalled();
  });

  it("does not treat activation-stale as a silent retry", async () => {
    const error = new ProjectRoutingError("activation-stale", "Local edits must be saved or copied before activation.");
    vi.mocked(store.flush).mockRejectedValue(error);
    recovery = { kind: "blocked", error, actions: ["reload", "export-copy"] };
    await saveProjectNow();
    const modal = findByTestId(document.body, "persistence-recovery-modal");
    assert(modal !== null);
    expect(findByTestId(modal, "persistence-recovery-code")?.textContent).toBe("activation-stale");
    expect(findByTestId(document.body, "db-autosave-retry")).toBeNull();
  });
});
