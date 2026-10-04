import "fake-indexeddb/auto";
import { IDBCursor, IDBFactory, IDBIndex, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_RECORD_DB_NAME, AI_RECORD_STORES, mutateScopedAiRecord, readAiRecord, resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { listConversationArchiveMapIds, queryConversationArchive, type ConversationRecord } from "@/ai/conversationStore";

const store = AI_RECORD_STORES.conversations;
function record(id: string, savedAt: number, scope: string | undefined = "mine", map = "a"): ConversationRecord {
  return { id, title: `Title ${id}`, model: "fixture", savedAt, projectContextKey: scope,
    entries: [{ kind: "user", text: `Request ${id}`, context: { mapId: map, mapName: map, mapWidth: 16, mapHeight: 16 } },
      { kind: "assistant", text: "SEARCH PREVIEW" }] };
}
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("localStorage", { getItem: () => null, removeItem: vi.fn() });
  resetAiRecordDbForTest();
});
afterEach(() => { resetAiRecordDbForTest(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function refuseTranscriptScans() {
  const cursor = IDBObjectStore.prototype.openCursor;
  vi.spyOn(IDBObjectStore.prototype, "openCursor").mockImplementation(function (...args) {
    if (this.name === store) throw new Error("history enumerated transcripts");
    return cursor.apply(this, args);
  });
  vi.spyOn(IDBObjectStore.prototype, "getAll").mockImplementation(() => { throw new Error("history getAll"); });
}
describe("indexed conversation archive", () => {
  it("backfills old rows once without rewriting them, then queries scoped summaries and map keys only", async () => {
    const old = record("old", 1), legacy = { ...record("legacy", 2), projectContextKey: undefined };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(AI_RECORD_DB_NAME, 3);
      request.onupgradeneeded = () => {
        const rows = request.result.createObjectStore(store, { keyPath: "id" });
        [old, legacy, { id: "invalid", entries: "invalid" }].forEach(row => rows.put(row));
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
    expect((await queryConversationArchive({ projectContextKey: "mine" })).records.map(row => row.id)).toEqual(["old"]);
    refuseTranscriptScans();
    expect((await queryConversationArchive({ projectContextKey: null, query: "search preview" })).records.map(row => row.id)).toEqual(["legacy"]);
    expect(await listConversationArchiveMapIds("mine")).toEqual(["a"]);
    expect(await listConversationArchiveMapIds("other")).toEqual([]);
    expect(await readAiRecord(store, "old")).toEqual(old);
    expect(await readAiRecord(store, "invalid")).toEqual({ id: "invalid", entries: "invalid" });
  });

  it("uses an indexed count and cursor advance for pages, with no full transcript enumeration or cross-scope results", async () => {
    await writeAiRecords(store, Array.from({ length: 120 }, (_, i) => record(`row-${String(i).padStart(3, "0")}`, i, i < 100 ? "mine" : "other")));
    await queryConversationArchive({ projectContextKey: "mine", limit: 20 });
    refuseTranscriptScans();
    const advance = vi.spyOn(IDBCursor.prototype, "advance"), count = vi.spyOn(IDBIndex.prototype, "count");
    const page = await queryConversationArchive({ projectContextKey: "mine", mapId: "a", offset: 20, limit: 20 });
    expect(page).toMatchObject({ total: 100, hasMore: true, durable: true });
    expect(page.records).toHaveLength(20);
    expect(page.records[0]?.id).toBe("row-079");
    expect(page.records.at(-1)?.id).toBe("row-060");
    expect(advance).toHaveBeenCalledWith(20); expect(count).toHaveBeenCalled();
    expect((await queryConversationArchive({ projectContextKey: "mine", query: "SEARCH PREVIEW", limit: 2 })).total).toBe(100);
    const abort = new AbortController(); abort.abort();
    await expect(queryConversationArchive({ projectContextKey: "mine", signal: abort.signal })).rejects.toThrow();
  });

  it("retains localeCompare ordering across page boundaries inside a shared timestamp", async () => {
    const ids = ["Z", "a", "A", "z", "é", "E"];
    await writeAiRecords(store, ids.map(id => record(id, 10)));
    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    const page = await queryConversationArchive({ projectContextKey: "mine", offset: 2, limit: 3 });
    expect(page.records.map(row => row.id)).toEqual(sorted.slice(2, 5));
    const searched = await queryConversationArchive({ projectContextKey: "mine", query: "search preview", offset: 2, limit: 3 });
    expect(searched.records.map(row => row.id)).toEqual(sorted.slice(2, 5));
    expect(page.total).toBe(ids.length);
  });

  it("rolls back payload and summary together on summary failure, then removes both with scoped deletion suppression", async () => {
    const before = record("atomic", 1);
    await writeAiRecords(store, [before]);
    await queryConversationArchive({ projectContextKey: "mine" });
    const nativePut = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (...args) {
      if (this.name === "conversationSummaries") throw new Error("summary quota fixture");
      return nativePut.apply(this, args);
    });
    await expect(writeAiRecords(store, [{ ...before, savedAt: 2, title: "replacement" }])).rejects.toThrow("summary quota fixture");
    failure.mockRestore();
    expect(await readAiRecord(store, before.id)).toEqual(before);
    expect((await queryConversationArchive({ projectContextKey: "mine" })).records[0]?.title).toBe(before.title);
    await mutateScopedAiRecord<ConversationRecord>({ store, id: before.id, scope: "mine" }, null);
    expect(await readAiRecord(store, before.id)).toBeNull();
    expect((await queryConversationArchive({ projectContextKey: "mine" })).total).toBe(0);
    expect(await listConversationArchiveMapIds("mine")).toEqual([]);
    const retry = await mutateScopedAiRecord<ConversationRecord>({ store, id: before.id, scope: "mine" }, () => ({ ...before, savedAt: 3 }));
    expect(retry.written).toBe(false);
  });
});
