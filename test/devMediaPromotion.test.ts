/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Buffer } from "node:buffer";
import { createBlankProject } from "@/project/defaults";
import { createDevShowcaseProjectForLocation } from "@/editor/devShowcaseProjects";
import { loadProjectFromSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";

const targetId = "oprn-media-copy";

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://db.test");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "shared-do-not-write");
  window.history.replaceState(null, "", "/?devProject=1&sampleAdventure=1");
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function setup(bytes = 64) {
  vi.resetModules();
  const { store, setDevProjectFactory } = await import("@/project/store");
  setDevProjectFactory(createBlankProject);
  await store.load();
  store.update(draft => { draft.meta.title = "recoverable source"; });
  await store.flush();
  store.update(draft => { draft.meta.title = "unsaved source edit"; });
  const before = store.getCurrent();
  const identity = store.getProjectIdentity();
  const localKey = Object.keys(localStorage).find(key => key.startsWith("oprn:dev-project:"));
  if (!localKey) throw new Error("Missing local recovery");
  const recovery = localStorage.getItem(localKey);
  const href = location.href;
  const candidate = structuredClone(before);
  candidate.assets.uploaded["bgm-media"] = {
    id: "bgm-media", kind: "music", name: "accepted audio",
    dataUrl: "data:audio/wav;base64," + Buffer.alloc(bytes).toString("base64"), meta: {},
  };
  candidate.resourceProfiles.push({ kind: "music", name: "accepted audio", assetId: "bgm-media" });
  return { store, before, identity, localKey, recovery, href, candidate };
}

/** Real save/load code, with only the PostgREST transport replaced. */
function transport(expectedTarget = targetId, returnedIdentity = expectedTarget) {
  let row: unknown;
  const writes: string[] = [];
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (method === "POST") {
      const body = JSON.parse(String(init?.body));
      if (url.pathname.endsWith("/projects")) {
        expect(body.project_id).toBe(expectedTarget);
        row = body;
      } else {
        for (const entry of body) expect(entry.project_id).toBe(expectedTarget);
      }
      writes.push(url.pathname);
      return new Response(null, { status: 201 });
    }
    if (method === "DELETE") {
      expect(url.searchParams.get("project_id")).toBe(`eq.${expectedTarget}`);
      return new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith("/projects")) {
      expect(url.searchParams.get("project_id")).toBe(`eq.${expectedTarget}`);
      return Response.json(row ? [Object.assign({}, row, { project_id: returnedIdentity })] : []);
    }
    return Response.json([]);
  }));
  return {
    writes,
    createProjectId: () => targetId,
    saveTarget: saveProjectToSupabase,
    reloadTarget: loadProjectFromSupabase,
  };
}

describe("showcase media save-copy promotion", () => {
  it("saves and reloads the full 8 MiB asset at a new target before adopting, without flushing the local source", async () => {
    const { store, before, identity, localKey, recovery, candidate } = await setup(8 * 1024 * 1024);
    const remote = transport();
    let observedReload = false;
    await expect(store.loadNewRemoteProjectTransactionally(candidate, { source: "dev-showcase" }, {
      ...remote,
      reloadTarget: async config => {
        observedReload = true;
        expect(store.getCurrent()).toBe(before);
        expect(store.getProjectIdentity()).toEqual(identity);
        expect(localStorage.getItem(localKey)).toBe(recovery);
        return remote.reloadTarget(config);
      },
    })).resolves.toEqual({ projectId: targetId });
    expect(observedReload).toBe(true);
    expect(store.getProjectIdentity()).toEqual({ kind: "remote", id: targetId });
    expect(store.getCurrent().assets.uploaded["bgm-media"]).toEqual(candidate.assets.uploaded["bgm-media"]);
    expect(createDevShowcaseProjectForLocation()).toBeNull();
    expect(localStorage.getItem(localKey)).toBe(recovery);
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(remote.writes).toContain("/rest/v1/projects");
    await expect(store.flush()).resolves.toMatchObject({ kind: "saved" });
  });

  it("rejects matching content returned under the wrong target identity by the real proof reader", async () => {
    const { store, before, candidate } = await setup();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");
    transport("oprn-0000000000", "different-project");
    await expect(store.loadNewRemoteProjectTransactionally(candidate, { source: "dev-showcase" }))
      .rejects.toMatchObject({ stage: "reload" });
    expect(store.getCurrent()).toBe(before);
  });

  it("clears a source quota error only after the new copy is durably verified", async () => {
    const { store, candidate } = await setup();
    const setItem = localStorage.setItem.bind(localStorage);
    const write = vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key.startsWith("oprn:dev-project:")) throw new DOMException("full", "QuotaExceededError");
      setItem(key, value);
    });
    await expect(store.flush()).rejects.toMatchObject({ code: "storage-quota" });
    expect(store.getAutoSaveState().kind).toBe("error");
    write.mockRestore();
    await store.loadNewRemoteProjectTransactionally(candidate, { source: "dev-showcase" }, transport());
    expect(store.getAutoSaveState().kind).toBe("saved");
  });

  it.each(["save", "reload", "verify", "concurrent-edit", "cancel"] as const)(
    "preserves source and its recovery when promotion fails at %s", async failure => {
      const { store, before, identity, localKey, recovery, href, candidate } = await setup();
      const remote = transport();
      const controller = new AbortController();
      const operation = store.loadNewRemoteProjectTransactionally(candidate, {
        source: "dev-showcase", signal: controller.signal,
      }, {
        ...remote,
        saveTarget: async (project, config) => {
          if (failure === "save") throw new Error("transport unavailable");
          return remote.saveTarget(project, config);
        },
        reloadTarget: async config => {
          if (failure === "reload") throw new Error("reload unavailable");
          const reloaded = await remote.reloadTarget(config);
          if (failure === "verify" && reloaded) delete reloaded.assets.uploaded["bgm-media"];
          if (failure === "concurrent-edit") store.update(draft => { draft.meta.title = "newer edit"; });
          if (failure === "cancel") controller.abort();
          return reloaded;
        },
      });
      await expect(operation).rejects.toMatchObject({ stage: failure === "cancel" ? "cancelled" : failure });
      expect(store.getProjectIdentity()).toEqual(identity);
      expect(store.getCurrent().assets.uploaded["bgm-media"]).toBeUndefined();
      expect(store.getCurrent().meta.title).toBe(failure === "concurrent-edit" ? "newer edit" : before.meta.title);
      expect(localStorage.getItem(localKey)).toBe(recovery);
      expect(location.href).toBe(href);
    },
  );

  it("rolls back staged config when the final selection write hits quota", async () => {
    const { store, before, identity, localKey, recovery, href, candidate } = await setup();
    const configBefore = localStorage.getItem("oprn:supabase-project-config");
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key === "oprn:supabase-selected-project") throw new DOMException("full", "QuotaExceededError");
      setItem(key, value);
    });
    await expect(store.loadNewRemoteProjectTransactionally(candidate, { source: "dev-showcase" }, transport()))
      .rejects.toMatchObject({ stage: "commit", cause: { name: "QuotaExceededError" } });
    expect(store.getCurrent()).toBe(before);
    expect(store.getProjectIdentity()).toEqual(identity);
    expect(localStorage.getItem("oprn:supabase-project-config")).toBe(configBefore);
    expect(localStorage.getItem(localKey)).toBe(recovery);
    expect(location.href).toBe(href);
  });

  it("classifies a failed local write without replacing the previous recoverable bytes", async () => {
    vi.useFakeTimers();
    const { store, localKey, recovery } = await setup();
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key.startsWith("oprn:dev-project:")) throw new DOMException("full", "QuotaExceededError");
      setItem(key, value);
    });
    vi.clearAllTimers(); // Exclude already-scheduled activity-log and draft checkpoints.
    await expect(store.flush()).rejects.toMatchObject({ code: "storage-quota" });
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(localStorage.getItem(localKey)).toBe(recovery);
    expect(vi.getTimerCount()).toBe(0);
  });
});
