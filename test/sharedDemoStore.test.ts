/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHARED_DEMO_PROJECT_ID, shouldOpenSharedDemoAtBoot } from "@/project/sharedDemoProject";

/**
 * 공용 데모(첫 방문) 저장 계약:
 * - 데모 행은 어떤 경로로 열리든 읽기 전용 — 쓰기 권한·자동저장·flush 가 전부 닫힌다.
 * - 「편집용 사본」 트랜잭션만 새 id 로 나가고, 그 과정에서도 데모 행에는 POST 가 가지 않는다.
 */

const DEMO_TITLE = "큰 강호 장터 마을";
const DEMO_MAP_ID = "map_large_river_market_village";

/** 실제 직렬화 경로를 탄 데모 행 — 손으로 만든 wire 는 deserialize 검증을 못 지나간다. */
async function demoWireProject() {
  const { createBlankProject } = await import("@/project/defaults");
  const { serialize } = await import("@/project/io");
  const project = createBlankProject();
  const mapId = Object.keys(project.maps)[0]!;
  const map = project.maps[mapId]!;
  project.maps = {
    [DEMO_MAP_ID]: { ...map, id: DEMO_MAP_ID, name: DEMO_TITLE, events: [] },
  };
  project.mapTree = { mapId: DEMO_MAP_ID, children: [] };
  project.startMapId = DEMO_MAP_ID;
  project.meta = { ...project.meta, title: DEMO_TITLE };
  return JSON.parse(serialize(project)) as unknown;
}

type StubbedRows = Map<string, { current_json: unknown; current_sha256: string | null }>;

function useRemoteRows(initial: StubbedRows) {
  const rows = new Map(initial);
  const posts: string[] = [];
  vi.stubGlobal("fetch", (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const projectIdParam = url.searchParams.get("project_id") ?? "";
    const projectId = projectIdParam.startsWith("eq.") ? projectIdParam.slice(3) : projectIdParam;
    if (init?.method === "POST" || init?.method === "DELETE") {
      if (url.pathname.endsWith("/projects")) posts.push(projectId || "(insert)");
      return new Response(null, { status: init.method === "DELETE" ? 204 : 201 });
    }
    if (url.pathname.endsWith("/projects")) {
      const row = projectId ? rows.get(projectId) : undefined;
      return Response.json(row ? [{ project_id: projectId, ...row }] : []);
    }
    // maps/tilesets/project_commits 등 보조 테이블은 빈 목록.
    return Response.json([]);
  }) satisfies typeof fetch);
  return { rows, posts };
}

function useBrowser(options: { search?: string; selectedProjectId?: string } = {}) {
  const storage = new Map<string, string>();
  if (options.selectedProjectId) {
    storage.set("oprn:supabase-selected-project", options.selectedProjectId);
  }
  const location = {
    hostname: "127.0.0.1",
    protocol: "http:",
    pathname: "/editor",
    search: options.search ?? "",
    href: `http://127.0.0.1:9999/editor${options.search ?? ""}`,
    hash: "",
  };
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
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
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "env-default-project");
  return { storage, location };
}

async function importFreshStore() {
  vi.resetModules();
  return (await import("@/project/store")).store;
}

describe("shared demo project — read-only contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("loadSharedDemo opens the demo row read-only: no authority, no autosave, flush disabled", async () => {
    const { storage, location } = useBrowser();
    const remote = useRemoteRows(new Map([
      [SHARED_DEMO_PROJECT_ID, { current_json: await demoWireProject(), current_sha256: "demo-sha" }],
    ]));
    const store = await importFreshStore();

    const project = await store.loadSharedDemo();
    expect(project?.meta?.title).toBe(DEMO_TITLE);
    expect(store.isLoaded()).toBe(true);
    expect(store.isSharedDemoSession()).toBe(true);
    expect(store.isRemotePersistenceEnabled()).toBe(false);
    expect(store.getDbPersistenceStatus()).toEqual({ kind: "disabled", reason: "shared-demo" });
    expect(store.getProjectIdentity()).toEqual({ kind: "remote", id: SHARED_DEMO_PROJECT_ID });

    // 방문자 편집은 메모리에만 머문다 — 어떤 원격 쓰기도 일어나지 않는다.
    store.update((draft) => { draft.meta = { ...draft.meta, title: "방문자가 바꾼 제목" }; });
    const flushed = await store.flush();
    expect(flushed.kind).toBe("disabled");
    expect(remote.posts.filter((id) => id === SHARED_DEMO_PROJECT_ID)).toEqual([]);
    // URL/선택 저장도 데모로 오염되지 않는다 — 재방문 시 다시 첫 방문 게이트가 탄다.
    expect(location.search).not.toContain(SHARED_DEMO_PROJECT_ID);
    expect(storage.get("oprn:supabase-selected-project") ?? "").not.toBe(SHARED_DEMO_PROJECT_ID);
  });

  it("returns null when the demo row is missing so boot can fall back", async () => {
    useBrowser();
    useRemoteRows(new Map());
    const store = await importFreshStore();
    expect(await store.loadSharedDemo()).toBeNull();
    expect(store.isLoaded()).toBe(false);
  });

  it("store.load() on ?project=<demo> deep link also opens read-only", async () => {
    useBrowser({ search: `?project=${SHARED_DEMO_PROJECT_ID}` });
    const remote = useRemoteRows(new Map([
      [SHARED_DEMO_PROJECT_ID, { current_json: await demoWireProject(), current_sha256: "demo-sha" }],
    ]));
    const store = await importFreshStore();

    await store.load();
    expect(store.isSharedDemoSession()).toBe(true);
    expect(store.getDbPersistenceStatus()).toEqual({ kind: "disabled", reason: "shared-demo" });
    store.updateMap("map_large_river_market_village", (map) => { map.lowerTiles[0] = 7; });
    expect((await store.flush()).kind).toBe("disabled");
    expect(remote.posts.filter((id) => id === SHARED_DEMO_PROJECT_ID)).toEqual([]);
  });

  it("fork: transactional copy skips the demo flush, saves a new id, verifies, then commits", async () => {
    const { storage, location } = useBrowser();
    const remote = useRemoteRows(new Map([
      [SHARED_DEMO_PROJECT_ID, { current_json: await demoWireProject(), current_sha256: "demo-sha" }],
    ]));
    const store = await importFreshStore();
    await store.loadSharedDemo();

    // 방문자가 데모를 만져둔 상태도 사본에 그대로 담긴다.
    store.update((draft) => { draft.meta = { ...draft.meta, title: "내 마을" }; });

    const writes: string[] = [];
    const savedRows = new Map<string, unknown>();
    const result = await store.loadNewRemoteProjectTransactionally(store.getCurrent(), {}, {
      createProjectId: () => "oprn-fork0001",
      saveTarget: async (candidate, config) => {
        writes.push(config.projectId);
        savedRows.set(config.projectId, JSON.parse(JSON.stringify(candidate)));
        return { kind: "saved", project: candidate, sha256: "fork-sha" };
      },
      reloadTarget: async (config) => {
        const row = savedRows.get(config.projectId);
        return row ? (JSON.parse(JSON.stringify(row)) as never) : null;
      },
    });

    expect(result.projectId).toBe("oprn-fork0001");
    // 데모 행에는 어떤 쓰기도 가지 않았다.
    expect(writes).toEqual(["oprn-fork0001"]);
    expect(remote.posts.filter((id) => id === SHARED_DEMO_PROJECT_ID)).toEqual([]);
    // 전환 완료: 원격 저장이 다시 켜지고 선택 작업이 내 사본을 가리킨다.
    expect(store.isSharedDemoSession()).toBe(false);
    expect(store.isRemotePersistenceEnabled()).toBe(true);
    expect(store.getProjectIdentity()).toEqual({ kind: "remote", id: "oprn-fork0001" });
    expect(storage.get("oprn:supabase-selected-project")).toBe("oprn-fork0001");
    expect(location.search ?? "").toContain("oprn-fork0001");
    expect(store.getCurrent().meta.title).toBe("내 마을");
  });

  it("rejects any transition that would target the shared demo row itself", async () => {
    useBrowser();
    useRemoteRows(new Map([
      [SHARED_DEMO_PROJECT_ID, { current_json: await demoWireProject(), current_sha256: "demo-sha" }],
    ]));
    const store = await importFreshStore();
    await store.loadSharedDemo();

    await expect(
      store.loadNewRemoteProjectTransactionally(store.getCurrent(), { projectId: SHARED_DEMO_PROJECT_ID }),
    ).rejects.toMatchObject({ name: "NewRemoteProjectTransactionError", stage: "configuration" });

    const { createBlankProject } = await import("@/project/defaults");
    await expect(
      store.loadNewRemoteProject(createBlankProject(), { projectId: SHARED_DEMO_PROJECT_ID }),
    ).rejects.toThrow();
  });

  it("a normal (non-demo) session still flushes its source before switching", async () => {
    useBrowser({ search: "?project=env-default-project" });
    useRemoteRows(new Map([
      ["env-default-project", { current_json: await demoWireProject(), current_sha256: "sha" }],
    ]));
    const store = await importFreshStore();
    await store.load();
    expect(store.isSharedDemoSession()).toBe(false);
    expect(store.isRemotePersistenceEnabled()).toBe(true);
  });
});

describe("shouldOpenSharedDemoAtBoot gate", () => {
  it("opens the demo only on a true first visit", () => {
    const base = {
      deepLinkedProject: false,
      automation: false,
      devShowcase: false,
      dbConfigured: true,
      storedSelection: false,
    };
    expect(shouldOpenSharedDemoAtBoot(base)).toBe(true);
    expect(shouldOpenSharedDemoAtBoot({ ...base, deepLinkedProject: true })).toBe(false);
    expect(shouldOpenSharedDemoAtBoot({ ...base, automation: true })).toBe(false);
    expect(shouldOpenSharedDemoAtBoot({ ...base, devShowcase: true })).toBe(false);
    expect(shouldOpenSharedDemoAtBoot({ ...base, dbConfigured: false })).toBe(false);
    expect(shouldOpenSharedDemoAtBoot({ ...base, storedSelection: true })).toBe(false);
  });
});
