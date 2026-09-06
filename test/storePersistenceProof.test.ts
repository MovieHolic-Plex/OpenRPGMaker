import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";

const projectId = "p1-proof-fixture";

type Row = { project_id: string; current_json: Project; current_sha256: string };

function deferred<T>() {
  return Promise.withResolvers<T>();
}

async function fixture() {
  let row: Row | undefined;
  let readResponse: (() => Promise<Response>) | undefined;
  let mapReadResponse: (() => Promise<Response>) | undefined;
  let committed = deferred<void>();
  const calls: { url: URL; method: string }[] = [];
  const fetchSpy = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.pathname === "/rest/v1/projects") {
      if (method === "POST" || method === "PATCH") {
        row = JSON.parse(String(init?.body));
        return Response.json(method === "PATCH" ? [row] : []);
      }
      if (readResponse) return readResponse();
      return Response.json(row ? [row] : []);
    }
    if (url.pathname === "/rest/v1/maps" && method === "GET" && mapReadResponse) return mapReadResponse();
    if (url.pathname === "/rest/v1/project_changes") committed.resolve();
    if (url.pathname === "/rest/v1/maps" || url.pathname === "/rest/v1/tilesets"
      || url.pathname === "/rest/v1/project_commits" || url.pathname === "/rest/v1/project_changes") {
      return Response.json([]);
    }
    throw new Error(`Unexpected transport: ${method} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchSpy);
  const { store } = await import("@/project/store");
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  store.update((draft) => { draft.meta.title = "accepted-fixture"; });
  const flush = async () => {
    committed = deferred<void>(); // Subscribe to the exact background commit before saving.
    const saved = await store.flush();
    if (saved.kind !== "saved" || !saved.receipt) throw new Error("No accepted-save receipt");
    await committed.promise;
    return saved.receipt;
  };
  // This is the actual public API; no substituted verifier or reload-result adapter.
  const receipt = await flush();
  return {
    store, receipt, calls, fetchSpy, flush,
    row: () => {
      if (!row) throw new Error("No submitted project row");
      return row;
    },
    setRead: (response: () => Promise<Response>) => { readResponse = response; },
    setMapRead: (response: () => Promise<Response>) => { mapReadResponse = response; },
  };
}

describe("accepted revision persistence proof", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers(); // Prevent unrelated autosave timers; never advance time to synchronize I/O.
    vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", projectId);
    vi.stubEnv("VITE_SUPABASE_URL", "http://p1-transport.invalid");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("verifies the accepted content through actual save/read transport and reuses its clean-flush receipt", async () => {
    const f = await fixture();
    expect(f.receipt).toMatchObject({ projectId, mutationGeneration: 1 });
    expect(Object.isFrozen(f.receipt)).toBe(true);
    expect(f.receipt.contentIdentity).toMatch(/^[a-f0-9]{64}$/);
    const live = f.store.getCurrent();
    const changes = vi.fn();
    const unsubscribe = f.store.subscribe(changes);
    try {
      const proof = await f.store.verifyPersistedRevision(f.receipt);
      expect(proof).toMatchObject({ kind: "verified", receipt: f.receipt, isCurrent: true });
      expect(f.store.getCurrent()).toBe(live);
      expect(changes).not.toHaveBeenCalled();
      const clean = await f.store.flush();
      if (clean.kind !== "saved") throw new Error("Clean flush was not saved");
      expect(clean.receipt).toBe(f.receipt);
      expect(f.calls.filter((call) => call.method === "GET" && call.url.pathname === "/rest/v1/projects")).toHaveLength(1);
      expect(f.calls.at(-1)?.method).toBe("GET");
    } finally { unsubscribe(); }
  }, 60_000);

  it("compares normalized values rather than JSONB object-key order", async () => {
    const f = await fixture();
    const reorder = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reorder);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)]));
    };
    f.setRead(async () => Response.json([reorder(f.row())]));
    expect(await f.store.verifyPersistedRevision(f.receipt)).toMatchObject({ kind: "verified", isCurrent: true });
  });

  it("uses the ordinary normalized remote load and map-overlay contract", async () => {
    const f = await fixture();
    const { loadProjectFromSupabase, loadProjectForPersistenceProof } = await import("@/project/supabaseProjectSync");
    const currentJson = f.row().current_json;
    const startMap = currentJson.maps[currentJson.startMapId];
    if (!startMap) throw new Error("Fixture start map is missing");
    const overlay = { ...structuredClone(startMap), name: "map-table-overlay" };
    f.setMapRead(async () => Response.json([{ map_id: overlay.id, map_json: overlay }]));
    const config = { projectId, url: "http://p1-transport.invalid", anonKey: "test-anon-key" };
    const [ordinary, proofRead] = await Promise.all([
      loadProjectFromSupabase(config),
      loadProjectForPersistenceProof(config),
    ]);
    expect(proofRead?.project).toEqual(ordinary);
    expect(proofRead?.project.maps[overlay.id]?.name).toBe(overlay.name);
    expect(currentJson.maps[overlay.id]?.name).not.toBe(overlay.name);
    // The projects row still matches the receipt: only the map-table overlay differs.
    expect(await f.store.verifyPersistedRevision(f.receipt)).toMatchObject({ kind: "mismatch", reason: "content" });
  });

  it("does not verify a matching projects row when the ordinary map read fails", async () => {
    const f = await fixture();
    f.setMapRead(async () => new Response("unavailable", { status: 503 }));
    expect((await f.store.verifyPersistedRevision(f.receipt)).kind).toBe("failed");
  });

  it("binds the receipt to the accepted merged project, not the unmerged live store", async () => {
    const f = await fixture();
    const remote = f.row().current_json;
    const startMap = remote.maps[remote.startMapId];
    if (!startMap) throw new Error("Fixture start map is missing");
    const map = structuredClone(startMap);
    map.id = "remote-added-map";
    remote.maps[map.id] = map;
    remote.mapTree.children.push({ mapId: map.id, children: [] });
    f.store.update((draft) => { draft.meta.title = "second-local-save"; });
    const receipt = await f.flush();
    expect(f.store.getCurrent().maps[map.id]).toBeUndefined();
    expect(f.row().current_json.maps[map.id]?.id).toBe(map.id);
    expect(receipt.revisionId).not.toBe(f.receipt.revisionId);
    expect(receipt.contentIdentity).not.toBe(f.receipt.contentIdentity);
    expect(await f.store.verifyPersistedRevision(receipt)).toMatchObject({ kind: "verified", isCurrent: true });
    const unmerged = structuredClone(f.row());
    delete unmerged.current_json.maps[map.id];
    unmerged.current_json.mapTree.children = [];
    f.setRead(async () => Response.json([unmerged]));
    expect(await f.store.verifyPersistedRevision(receipt)).toMatchObject({ kind: "mismatch", reason: "content" });
  });

  it("keeps open event drafts local and out of accepted content identity", async () => {
    const f = await fixture();
    const { createEventDraft } = await import("@/editor/eventDraftActions");
    const mapId = f.store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 2, 2);
    // Another authored edit ensures the save also records a new manual commit.
    f.store.update((draft) => { draft.meta.title = "with-local-draft"; });
    const receipt = await f.flush();
    expect(f.row().current_json.maps[mapId]?.events.some((event) => event.id === eventId)).toBe(false);
    expect(await f.store.verifyPersistedRevision(receipt)).toMatchObject({ kind: "verified", isCurrent: true });
    expect(f.store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.draft?.kind).toBe("new");
  }, 60_000);

  it("rejects a copied token without issuing a read", async () => {
    const f = await fixture();
    const before = f.calls.length;
    expect((await f.store.verifyPersistedRevision({ ...f.receipt })).kind).toBe("failed");
    expect(f.calls).toHaveLength(before);
  });

  it.each(["failed", "missing", "disabled", "cancelled"] as const)("does not verify a %s read", async (failure) => {
    const f = await fixture();
    const controller = new AbortController();
    if (failure === "failed") f.setRead(async () => new Response("unavailable", { status: 503 }));
    if (failure === "missing") f.setRead(async () => Response.json([]));
    if (failure === "disabled") f.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    if (failure === "cancelled") controller.abort();
    const proof = await f.store.verifyPersistedRevision(f.receipt, { signal: controller.signal });
    expect(proof.kind).toBe(failure === "missing" ? "failed" : failure);
    expect(f.store.getCurrent().meta.title).toBe("accepted-fixture");
  });

  it.each(["target", "content"] as const)("rejects wrong %s even when current_sha256 is unchanged", async (mismatch) => {
    const f = await fixture();
    const different = structuredClone(f.row());
    if (mismatch === "target") different.project_id = "another-project";
    else different.current_json.meta.title = "other-content";
    f.setRead(async () => Response.json([different]));
    expect(await f.store.verifyPersistedRevision(f.receipt)).toMatchObject({ kind: "mismatch", reason: mismatch });
  });

  it("keeps a failed proof retryable for the same accepted revision", async () => {
    const f = await fixture();
    let reads = 0;
    f.setRead(async () => ++reads === 1 ? new Response("unavailable", { status: 503 }) : Response.json([f.row()]));
    expect((await f.store.verifyPersistedRevision(f.receipt)).kind).toBe("failed");
    expect(await f.store.verifyPersistedRevision(f.receipt)).toMatchObject({ kind: "verified", isCurrent: true, receipt: f.receipt });
    expect(reads).toBe(2);
    expect(f.calls.filter((call) => call.url.pathname === "/rest/v1/projects" && call.method !== "GET")).toHaveLength(1);
  });

  it("preserves newer local edits during the read and does not attach old proof to them", async () => {
    const f = await fixture();
    const started = deferred<void>();
    const reply = deferred<Response>();
    f.setRead(() => { started.resolve(); return reply.promise; });
    const reading = f.store.verifyPersistedRevision(f.receipt);
    await started.promise;
    f.store.update((draft) => { draft.meta.title = "newer-local-edit"; });
    const live = f.store.getCurrent();
    reply.resolve(Response.json([f.row()]));
    expect(await reading).toMatchObject({ kind: "verified", isCurrent: false, receipt: f.receipt });
    expect(f.store.isPersistenceReceiptCurrent(f.receipt)).toBe(false);
    expect(f.store.getCurrent()).toBe(live);
    expect(f.store.getCurrent().meta.title).toBe("newer-local-edit");
    expect(f.store.hasUnsavedChanges()).toBe(true);
  });

  it("pins the original target across a configuration change during read", async () => {
    const f = await fixture();
    const started = deferred<void>();
    const reply = deferred<Response>();
    f.setRead(() => { started.resolve(); return reply.promise; });
    const reading = f.store.verifyPersistedRevision(f.receipt);
    await started.promise;
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "new-target");
    reply.resolve(Response.json([f.row()]));
    expect(await reading).toMatchObject({ kind: "verified", isCurrent: false });
    const gets = f.calls.filter((call) => call.method === "GET");
    expect(gets.map((call) => call.url.searchParams.get("project_id"))).toEqual([`eq.${projectId}`, `eq.${projectId}`]);
  });

  it.each(["cancelled", "disabled"] as const)("does not verify when %s while the read is in flight", async (failure) => {
    const f = await fixture();
    const started = deferred<void>();
    const reply = deferred<Response>();
    const controller = new AbortController();
    f.setRead(() => { started.resolve(); return reply.promise; });
    const reading = f.store.verifyPersistedRevision(f.receipt, { signal: controller.signal });
    await started.promise;
    if (failure === "cancelled") controller.abort();
    else f.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    reply.resolve(Response.json([f.row()]));
    expect((await reading).kind).toBe(failure);
  });
});
