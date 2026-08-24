/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EDITOR_WELCOME_TESTIDS, presentEditorWelcome } from "@/editor/editorWelcome";
import { materializeGenreBlankProjectSystemPreset } from "@/editor/genrePacks";
import type { Project } from "@/project/types";
import type { SupabaseProjectConfig } from "@/project/supabaseProjectConfig";
import type { SupabaseSaveResult } from "@/project/supabaseProjectSync";

type TransactionDependencies = {
  readonly createProjectId: () => string;
  readonly reloadTarget: (config: SupabaseProjectConfig) => Promise<Project | null>;
  readonly saveTarget: (project: Project, config: SupabaseProjectConfig) => Promise<SupabaseSaveResult>;
};

type TransactionalStore = {
  getProjectIdentity(): { readonly kind: "remote" | "local-session"; readonly id: string };
  loadNewRemoteProjectTransactionally(
    project: Project,
    options: { readonly title?: string },
    dependencies: TransactionDependencies,
  ): Promise<{ readonly projectId: string }>;
};

describe("transactional new remote project switch", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function setup() {
    const storage = new Map<string, string>();
    storage.set("oprn:supabase-project-config", JSON.stringify({
      anonKey: "test-anon-key",
      projectId: "keep-project",
      source: "custom",
      url: "http://dbserver:8100",
    }));
    let rejectConfigWrite = false;
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (rejectConfigWrite && key === "oprn:supabase-project-config") {
          throw new DOMException("quota exceeded", "QuotaExceededError");
        }
        storage.set(key, value);
      },
      removeItem: (key: string) => void storage.delete(key),
    };
    const location = {
      hostname: "127.0.0.1",
      protocol: "http:",
      pathname: "/editor",
      search: "?project=keep-project&name=Keep",
      href: "http://127.0.0.1:9999/editor?project=keep-project&name=Keep",
      hash: "",
    };
    vi.stubGlobal("window", {
      location,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      history: {
        state: null,
        replaceState: (_state: unknown, _title: string, url: string) => {
          const next = new URL(url, "http://127.0.0.1:9999");
          location.pathname = next.pathname;
          location.search = next.search;
          location.hash = next.hash;
          location.href = next.toString();
        },
      },
      localStorage,
    });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "keep-project");
    vi.resetModules();

    const { store } = await import("@/project/store");
    const { createBlankProject } = await import("@/project/defaults");
    const {
      getEventDraftVaultEntry,
      persistEventDraftVaultNow,
      rememberEventDraftVaultEntry,
    } = await import("@/project/eventDraftVault");
    const flush = vi.spyOn(store, "flush").mockResolvedValue({ kind: "saved" });
    const openMapId = store.getCurrent().startMapId;
    rememberEventDraftVaultEntry(openMapId, {
      id: "draft-event",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [],
      draft: { kind: "new" },
    });
    persistEventDraftVaultNow("keep-project");
    const before = {
      draft: getEventDraftVaultEntry(openMapId, "draft-event"),
      project: structuredClone(store.getCurrent()),
      href: location.href,
      storage: new Map(storage),
    };
    const candidate = createBlankProject();
    candidate.meta.title = "Candidate";
    return {
      before,
      candidate,
      failConfigWrite: () => { rejectConfigWrite = true; },
      flush,
      getDraft: () => getEventDraftVaultEntry(openMapId, "draft-event"),
      location,
      storage,
      store: store as unknown as TransactionalStore,
    };
  }

  it("BREAK: save failure leaves the open project, drafts, config, and URL untouched", async () => {
    const { before, candidate, flush, location, storage, store } = await setup();
    const dependencies: TransactionDependencies = {
      createProjectId: () => "oprn-new-target",
      saveTarget: vi.fn(async () => { throw new Error("save failed"); }),
      reloadTarget: vi.fn(async () => candidate),
    };

    await expect(store.loadNewRemoteProjectTransactionally(candidate, {}, dependencies)).rejects.toThrow("save failed");
    expect(flush).toHaveBeenCalledOnce();
    expect(dependencies.saveTarget).toHaveBeenCalledOnce();
    expect((store as unknown as { getCurrent(): Project }).getCurrent()).toEqual(before.project);
    expect(location.href).toBe(before.href);
    expect(storage).toEqual(before.storage);
    expect(dependencies.reloadTarget).not.toHaveBeenCalled();
  });

  it("BREAK: reload failure after save still leaves all local state untouched", async () => {
    const { before, candidate, flush, location, storage, store } = await setup();
    const dependencies: TransactionDependencies = {
      createProjectId: () => "oprn-new-target",
      saveTarget: vi.fn(async (project): Promise<SupabaseSaveResult> => ({ kind: "saved", project })),
      reloadTarget: vi.fn(async () => { throw new Error("reload failed"); }),
    };

    await expect(store.loadNewRemoteProjectTransactionally(candidate, {}, dependencies)).rejects.toThrow("reload failed");
    expect(flush).toHaveBeenCalledOnce();
    expect(dependencies.saveTarget).toHaveBeenCalledOnce();
    expect(dependencies.reloadTarget).toHaveBeenCalledOnce();
    expect((store as unknown as { getCurrent(): Project }).getCurrent()).toEqual(before.project);
    expect(location.href).toBe(before.href);
    expect(storage).toEqual(before.storage);
  });

  it("commits locally only after flush, explicit-target save, and matching reload", async () => {
    const { before, candidate, flush, location, store } = await setup();
    const order: string[] = [];
    flush.mockImplementation(async () => {
      order.push("flush");
      return { kind: "saved" };
    });
    const dependencies: TransactionDependencies = {
      createProjectId: () => "oprn-new-target",
      saveTarget: vi.fn(async (project, config): Promise<SupabaseSaveResult> => {
        order.push("save");
        expect(config.projectId).toBe("oprn-new-target");
        expect((store as unknown as { getCurrent(): Project }).getCurrent()).toEqual(before.project);
        expect(location.href).toBe(before.href);
        return { kind: "saved", project };
      }),
      reloadTarget: vi.fn(async (config) => {
        order.push("reload");
        expect(config.projectId).toBe("oprn-new-target");
        expect((store as unknown as { getCurrent(): Project }).getCurrent()).toEqual(before.project);
        expect(location.href).toBe(before.href);
        return structuredClone(candidate);
      }),
    };

    await expect(store.loadNewRemoteProjectTransactionally(candidate, {}, dependencies)).resolves.toEqual({
      projectId: "oprn-new-target",
    });
    expect(order).toEqual(["flush", "save", "reload"]);
    expect((store as unknown as { getCurrent(): Project }).getCurrent().meta.title).toBe("Candidate");
    expect(store.getProjectIdentity()).toEqual({ kind: "remote", id: "oprn-new-target" });
    expect(location.search).toContain("project=oprn-new-target");
  });

  // BREAK: quota failure occurred after candidate adopt/draft deletion, leaving welcome over a half-switched project.
  it("keeps project, draft, config, URL, and welcome intact when config staging hits quota", async () => {
    const {
      before,
      failConfigWrite,
      getDraft,
      location,
      storage,
      store,
    } = await setup();
    const host = document.createElement("div");
    document.body.append(host);
    let reloadedProject: Project | null = null;
    const dependencies: TransactionDependencies = {
      createProjectId: () => "oprn-new-target",
      saveTarget: vi.fn(async (project): Promise<SupabaseSaveResult> => ({ kind: "saved", project })),
      reloadTarget: vi.fn(async () => reloadedProject ? structuredClone(reloadedProject) : null),
    };
    failConfigWrite();

    const pending = presentEditorWelcome(host, {
      applySystemPreset: async (plan) => {
        const result = materializeGenreBlankProjectSystemPreset(plan);
        reloadedProject = result.project;
        await store.loadNewRemoteProjectTransactionally(result.project, { title: plan.title }, dependencies);
      },
    });
    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-starter-card-0']")?.click();
    document.querySelector<HTMLButtonElement>("[data-testid='app-modal-confirm']")?.click();
    await vi.waitFor(() => {
      expect(host.querySelector<HTMLElement>(
        `[data-testid='${EDITOR_WELCOME_TESTIDS.systemPresetError}']`,
      )?.hidden).toBe(false);
    });

    expect((store as unknown as { getCurrent(): Project }).getCurrent()).toEqual(before.project);
    expect(getDraft()).toEqual(before.draft);
    expect(storage).toEqual(before.storage);
    expect(location.href).toBe(before.href);
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeTruthy();
    expect(storage.has("oprn:editor-welcome-dismissed")).toBe(false);

    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.click();
    await expect(pending).resolves.toMatchObject({ action: "skip" });
  });
});
