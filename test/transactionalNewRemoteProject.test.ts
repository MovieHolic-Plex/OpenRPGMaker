import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import type { SupabaseProjectConfig } from "@/project/supabaseProjectConfig";
import type { SupabaseSaveResult } from "@/project/supabaseProjectSync";

type TransactionDependencies = {
  readonly createProjectId: () => string;
  readonly reloadTarget: (config: SupabaseProjectConfig) => Promise<Project | null>;
  readonly saveTarget: (project: Project, config: SupabaseProjectConfig) => Promise<SupabaseSaveResult>;
};

type TransactionalStore = {
  loadNewRemoteProjectTransactionally(
    project: Project,
    options: { readonly title?: string },
    dependencies: TransactionDependencies,
  ): Promise<{ readonly projectId: string }>;
};

describe("transactional new remote project switch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function setup() {
    const storage = new Map<string, string>();
    const location = {
      hostname: "127.0.0.1",
      pathname: "/editor",
      search: "?project=keep-project&name=Keep",
      href: "http://127.0.0.1:9999/editor?project=keep-project&name=Keep",
      hash: "",
    };
    vi.stubGlobal("window", {
      location,
      addEventListener: vi.fn(),
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
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
        removeItem: (key: string) => void storage.delete(key),
      },
    });
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "keep-project");
    vi.resetModules();

    const { store } = await import("@/project/store");
    const { createBlankProject } = await import("@/project/defaults");
    const flush = vi.spyOn(store, "flush").mockResolvedValue({ kind: "saved" });
    storage.set("draft-sentinel", "keep-draft");
    const before = {
      project: structuredClone(store.getCurrent()),
      href: location.href,
      storage: new Map(storage),
    };
    const candidate = createBlankProject();
    candidate.meta.title = "Candidate";
    return { before, candidate, flush, location, storage, store: store as unknown as TransactionalStore };
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
    expect(location.search).toContain("project=oprn-new-target");
  });
});
