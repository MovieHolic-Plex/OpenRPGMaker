/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EDITOR_WELCOME_TESTIDS, presentEditorWelcome } from "@/editor/editorWelcome";
import { createNewProjectSeed, GENRE_PACK_IDS, materializeGenreBlankProjectSystemPreset } from "@/editor/genrePacks";
import { loadProjectFromSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";
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

/** JSONB preserves values and array order, not JavaScript object insertion order. */
function jsonbValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonbValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, jsonbValue(entry)]));
  }
  return value;
}

function useJsonbTransport() {
  let projectRows: unknown = [];
  let mapRows: unknown = [];
  vi.stubGlobal("fetch", (async (input, init) => {
    const url = new URL(String(input));
    expect(url.searchParams.get("project_id") ?? "eq.oprn-new-target").toBe("eq.oprn-new-target");
    if (init?.method === "POST") {
      const body: unknown = jsonbValue(JSON.parse(String(init.body)));
      if (url.pathname.endsWith("/projects")) projectRows = [body];
      else if (url.pathname.endsWith("/maps")) mapRows = body;
      else expect(url.pathname).toBe("/rest/v1/tilesets");
      return new Response(null, { status: 201 });
    }
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/projects")) return Response.json(projectRows);
    if (url.pathname.endsWith("/maps")) return Response.json(mapRows);
    expect(["/rest/v1/project_commits", "/rest/v1/tilesets"]).toContain(url.pathname);
    return Response.json([]);
  }) satisfies typeof fetch);
  return {
    createProjectId: () => "oprn-new-target",
    saveTarget: saveProjectToSupabase,
    reloadTarget: loadProjectFromSupabase,
  } satisfies TransactionDependencies;
}

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

  it.each([null, ...GENRE_PACK_IDS])("creates %s through real save/load with JSONB key ordering and load normalization", async (packId) => {
    const { location, store } = await setup();
    const candidate = createNewProjectSeed(packId);
    const dependencies = useJsonbTransport();

    await expect(store.loadNewRemoteProjectTransactionally(candidate, {}, dependencies)).resolves.toEqual({
      projectId: "oprn-new-target",
    });
    expect(store.getProjectIdentity()).toEqual({ kind: "remote", id: "oprn-new-target" });
    expect(location.search).toContain("project=oprn-new-target");
  });

  it.each([undefined, "The Sword's Promise"])("saves the requested default title without replacing custom title %s", async (customTitle) => {
    const { candidate, store } = await setup();
    if (customTitle) {
      if (!candidate.system.titleScreen) throw new Error("Expected starter title settings");
      candidate.system.titleScreen.title = customTitle;
    }
    const original = structuredClone(candidate);
    let remote: Project | null = null;
    const dependencies: TransactionDependencies = {
      createProjectId: () => "oprn-new-target",
      saveTarget: async (project) => {
        remote = structuredClone(project);
        return { kind: "saved", project };
      },
      reloadTarget: async () => remote,
    };

    await store.loadNewRemoteProjectTransactionally(candidate, { title: "Sword arena" }, dependencies);

    expect(remote).toMatchObject({
      meta: { title: "Sword arena" },
      system: { titleScreen: { title: customTitle ?? "Sword arena" } },
    });
    expect(candidate).toEqual(original);
  });

  it.each(["title", "tile", "array-order"] as const)("rejects an actual %s mismatch after a JSONB roundtrip without changing local state", async (difference) => {
    const { before, candidate, getDraft, location, storage, store } = await setup();
    const transport = useJsonbTransport();
    const dependencies: TransactionDependencies = {
      ...transport,
      reloadTarget: async (config) => {
        const loaded = await transport.reloadTarget(config);
        if (!loaded) throw new Error("Expected the saved project");
        if (difference === "title") loaded.meta.title = "Changed remotely";
        if (difference === "tile") loaded.maps[loaded.startMapId].lowerTiles[0] = -1;
        if (difference === "array-order") loaded.database.items.reverse();
        return loaded;
      },
    };

    await expect(store.loadNewRemoteProjectTransactionally(candidate, {}, dependencies)).rejects.toMatchObject({ stage: "verify" });
    expect((store as unknown as { getCurrent(): Project }).getCurrent()).toEqual(before.project);
    expect(getDraft()).toEqual(before.draft);
    expect(location.href).toBe(before.href);
    expect(storage).toEqual(before.storage);
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
    const errorShown = new Promise<void>((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (host.querySelector<HTMLElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.systemPresetError}']`)?.hidden === false) {
          observer.disconnect();
          clearTimeout(timeout);
          resolve();
        }
      });
      const timeout = setTimeout(() => {
        observer.disconnect();
        reject(new Error("Welcome did not display the failed transaction"));
      }, 5000);
      observer.observe(host, { attributes: true, subtree: true, attributeFilter: ["hidden"] });
    });
    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-starter-card-0']")?.click();
    document.querySelector<HTMLButtonElement>("[data-testid='app-modal-confirm']")?.click();
    await errorShown;

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
