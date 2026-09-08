import { IDBFactory, IDBDatabase } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "@/ai/aiRecordDb";
import * as conversations from "@/ai/conversationStore";
import type { ConversationRecord } from "@/ai/conversationStore";

const scope = "remote:recovery-test";
const state = vi.hoisted(() => ({ config: { url: "https://recovery.invalid", anonKey: "test-only", projectId: "recovery-test" } }));
vi.mock("@/project/supabaseProjectConfig", () => ({ supabaseProjectConfig: () => state.config }));
const records = db.AI_RECORD_STORES.conversations;
function local(id = "record", savedAt = 100): ConversationRecord {
  return { id, title: "Local", model: "model", savedAt, projectContextKey: scope,
    entries: [{ kind: "user", text: "aaaa", context: { mapId: "A", mapName: "Map A" } }],
    mapIndex: { viewedMapIds: ["A"], targetMapIds: [], mapAttribution: "complete" } };
}
function wire(value = local("record", 900)) {
  return { conversation_id: value.id, project_id: "recovery-test", project_context_key: value.projectContextKey,
    title: value.title, model: value.model, saved_at: new Date(value.savedAt).toISOString(), entries_json: value.entries };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function put(value: ConversationRecord) { await db.writeAiRecords(records, [value]); }
async function read(id = "record") { return db.readAiRecord<ConversationRecord>(records, id); }

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => { db.resetAiRecordDbForTest(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe.each(["indexeddb", "memory"] as const)("explicit recovery admission on %s", backend => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", backend === "indexeddb" ? new IDBFactory() : undefined);
    db.resetAiRecordDbForTest();
  });

  it.each(["created", "entries", "nested", "title", "model", "mapIndex", "undefined-property"] as const)("preserves %s changed during retrieval, even below the remote timestamp", async field => {
    if (field !== "created") await put(local());
    const started = deferred<void>(), response = deferred<Response>();
    const transport = vi.fn(async () => { started.resolve(); return response.promise; });
    vi.stubGlobal("fetch", transport);
    const recovery = conversations.hydrateConversationArchive({ projectContextKey: scope });
    await started.promise;
    const changed = local();
    if (field === "entries") changed.entries[0] = { kind: "user", text: "bbbb", context: { mapId: "A", mapName: "Map A" } };
    if (field === "nested") changed.entries[0] = { kind: "user", text: "aaaa", context: { mapId: "B", mapName: "Map B" } };
    if (field === "title") changed.title = "Other";
    if (field === "model") changed.model = "other";
    if (field === "mapIndex") changed.mapIndex = { viewedMapIds: ["B"], targetMapIds: ["C"], mapAttribution: "partial" };
    if (field === "undefined-property") Object.assign(changed.entries[0]!, { at: undefined });
    await put(changed);
    response.resolve(Response.json([wire()]));
    expect(await recovery).toMatchObject({ imported: 0, skipped: 1, rejected: 0, durable: backend === "indexeddb" });
    expect(await read()).toEqual(changed);
    expect(transport).toHaveBeenCalledOnce();
  });

  it("captures memory-backed records by value rather than retaining aliases", async () => {
    await put(local());
    const started = deferred<void>(), response = deferred<Response>();
    vi.stubGlobal("fetch", async () => { started.resolve(); return response.promise; });
    const recovery = conversations.hydrateConversationArchive({ projectContextKey: scope });
    await started.promise;
    const changed = (await read())!;
    changed.entries[0] = { kind: "user", text: "bbbb" };
    await put(changed);
    response.resolve(Response.json([wire()]));
    expect(await recovery).toMatchObject({ imported: 0, skipped: 1 });
    expect(await read()).toEqual(changed);
  });

  it.each([50, 100, 900])("replaces only an unchanged strictly older baseline (remote=%s), then is idempotent", async savedAt => {
    await put(local());
    const remote = { ...local("record", savedAt), title: "Remote", entries: [{ kind: "user" as const, text: "remote whole transcript" }] };
    const transport = vi.fn(async (_input, init) => {
      expect(init?.method ?? "GET").toBe("GET");
      return Response.json([wire(remote)]);
    });
    vi.stubGlobal("fetch", transport);
    expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: savedAt > 100 ? 1 : 0, skipped: savedAt > 100 ? 0 : 1 });
    expect((await read())?.entries).toEqual(savedAt > 100 ? remote.entries : local().entries);
    expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: 0, skipped: 1 });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("keeps one baseline across all remote pages", async () => {
    const page2 = deferred<void>(), response = deferred<Response>();
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      if (new URL(String(input)).searchParams.get("offset") === "0") {
        await put(local("later", 1));
        return Response.json(Array.from({ length: 100 }, (_, index) => wire(local(`page1-${index}`, 900))));
      }
      page2.resolve(); return response.promise;
    });
    const recovery = conversations.hydrateConversationArchive({ projectContextKey: scope });
    await page2.promise;
    response.resolve(Response.json([wire(local("later", 900))]));
    expect(await recovery).toMatchObject({ imported: 100, skipped: 1 });
    expect(await read("later")).toEqual(local("later", 1));
  });

  it.each(["tombstone", "foreign", "owner"] as const)("preserves a pending %s decision", async change => {
    const started = deferred<void>(), response = deferred<Response>();
    let current = true;
    vi.stubGlobal("fetch", async () => { started.resolve(); return response.promise; });
    const recovery = conversations.hydrateConversationArchive({ projectContextKey: scope, isCurrent: () => current });
    const outcome = change === "owner" ? expect(recovery).rejects.toMatchObject({ name: "AbortError" }) : recovery;
    await started.promise;
    if (change === "tombstone") await conversations.deleteConversationForScope("record", scope);
    if (change === "foreign") await put({ ...local(), projectContextKey: "remote:foreign" });
    if (change === "owner") current = false;
    response.resolve(Response.json([wire()]));
    if (change === "owner") await outcome;
    else expect(await outcome).toMatchObject({ imported: 0, skipped: 1 });
    expect(await read()).toEqual(change === "foreign" ? { ...local(), projectContextKey: "remote:foreign" } : null);
  });

  it("checks the complete baseline at transactional admission, not before it", async () => {
    await put(local());
    const changed = { ...local(), title: "Changed after response" };
    let intercepted = false;
    if (backend === "indexeddb") {
      const transaction = IDBDatabase.prototype.transaction;
      // Queue a genuine competing write transaction before the recovery transaction.
      vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (this: IDBDatabase, names, mode, options) {
        if (!intercepted && mode === "readwrite" && Array.isArray(names) && names.includes("conversationTombstones")) {
          intercepted = true;
          const concurrent = transaction.call(this, records, "readwrite");
          concurrent.objectStore(records).put(changed);
        }
        return transaction.call(this, names, mode, options);
      });
    } else {
      const mutate = db.mutateScopedAiRecord;
      vi.spyOn(db, "mutateScopedAiRecord").mockImplementation(async (key, update) => {
        if (!intercepted) { intercepted = true; await put(changed); }
        return mutate(key, update);
      });
    }
    vi.stubGlobal("fetch", async () => Response.json([wire()]));
    expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: 0, skipped: 1 });
    expect(intercepted).toBe(true);
    expect(await read()).toEqual(changed);
  });
});
