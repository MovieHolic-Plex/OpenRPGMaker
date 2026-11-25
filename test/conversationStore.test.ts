import { afterEach, beforeEach, expect, it, vi, describe, type MockInstance } from "vitest";
import { IDBDatabase, IDBFactory, IDBObjectStore, IDBCursor, IDBIndex } from "fake-indexeddb";
import { AI_RECORD_DB_NAME, aiRecordBackendKind, isScopedAiRecordDeleted, readAiRecord, readAllAiRecords, resetAiRecordDbForTest, writeAiRecords, AI_RECORD_STORES, mutateScopedAiRecord } from "@/ai/aiRecordDb";
import { CONVERSATION_MAX_RECORDS, listConversations, loadConversation, type ConversationRecord, listConversationArchiveMapIds, queryConversationArchive, CONVERSATION_ARGS_MAX_CHARS, CONVERSATION_RECORD_MAX_CHARS, CONVERSATION_TRIM_MARKER, LEGACY_CONVERSATION_STORAGE_KEY, clearConversations, deleteConversation, deriveTitle, loadLatestConversationForScope, saveConversation, searchConversations } from "@/ai/conversationStore";
import type { RunCheckpoint } from "@/ai/runCheckpointStore";
import type { AuditEntry } from "@/ai/assistantSession";
import type { MemoryRepository } from "@/project/persistence/memoryRepository";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";
import * as db from "@/ai/aiRecordDb";
import * as conversations from "@/ai/conversationStore";
import { installElectronBridgeSession, type ElectronBridgeSession } from "./support/electronBridgeSession";
import "fake-indexeddb/auto";
import { isolateTimers } from "./mergedTeardown";

describe("aiRunCheckpointStore", () => {
  isolateTimers();
  // Dynamic import keeps the migration RED at the actual v2 storage seam before the new module exists.
  const api = () => import("@/ai/runCheckpointStore");
  const checkpointStore = "runCheckpoints";
  const originalIndexedDb = globalThis.indexedDB;
  const conversation: ConversationRecord = {
    id: "conversation-1", title: "Keep me", model: "test", savedAt: 1, entries: [{ kind: "user", text: "Original goal" }], projectContextKey: "remote:P",
  };
  function fixture(overrides: Partial<RunCheckpoint> = {}): RunCheckpoint {
    return {
      schemaVersion: 1, conversationId: conversation.id, runId: "run-1", epoch: 1, projectId: "P", projectContextKey: "remote:P", savedAt: 1,
      status: "active", request: { requestId: "request-1", text: "Original goal", scope: null },
      baseContentIdentity: "base", currentContentIdentity: "current",
      workPlan: {
        id: "plan-1", goal: "Original goal", createdAt: "2026-09-08T00:00:00Z", currentLayerIndex: 0, currentItemId: "item-1",
        requirements: [{ id: "requirement-1", title: "Keep the goal", required: true, criteria: null }],
        layers: [{ id: "layer-1", title: "Work", items: [{ id: "item-1", title: "Work", instruction: "Remaining work", status: "in_progress", requirementIds: ["requirement-1"] }] }],
      },
      budget: { remainingToolCalls: 2, remainingOutputTokens: 100, remainingAutoRunSteps: 3, remainingWorkPlanSteps: 4,
        ralphAttemptsByItemId: [["item-1", 2]], repeatedToolFailures: [["item-1", [["tool:target:code", { target: "map-1", count: 1, summary: "Failed target" }]]]] },
      verification: { requirements: [], findings: [], attempts: [], approaches: [], resolutions: [] }, acceptance: null,
      applied: null, save: null, proof: null, pending: null,
      ...overrides,
    };
  }
  function opened(version?: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = version === undefined ? indexedDB.open(AI_RECORD_DB_NAME) : indexedDB.open(AI_RECORD_DB_NAME, version);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function seed(version: 1 | 2): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(AI_RECORD_DB_NAME, version);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("conversations", { keyPath: "id" });
        store.createIndex("savedAt", "savedAt"); store.createIndex("projectContextKey", "projectContextKey");
        store.put(conversation);
        if (version === 2) request.result.createObjectStore("conversationTombstones", { keyPath: "id" })
          .put({ id: JSON.stringify(["remote:P", "deleted-1"]) });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
  }
  beforeEach(() => {
    resetAiRecordDbForTest();
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("localStorage", undefined);
  });
  afterEach(() => {
    resetAiRecordDbForTest(); vi.restoreAllMocks(); vi.unstubAllGlobals(); globalThis.indexedDB = originalIndexedDb;
  });
  it.each([1, 2] as const)("upgrades v%i at the real IDB seam without replacing conversations, indexes or tombstones", async version => {
    await seed(version);
    expect(await aiRecordBackendKind()).toBe("indexeddb");
    const db = await opened();
    try {
      // v4 가 대화 요약 저장소 둘을 더했다(src/ai/aiRecordDb.ts AI_RECORD_DB_VERSION, public baseline 0d4f13e7c8).
      expect(db.version).toBe(4);
      expect([...db.objectStoreNames]).toEqual(["conversationSummaries", "conversationSummaryMeta", "conversationTombstones", "conversations", "runCheckpoints"]);
      const transaction = db.transaction(["conversations", checkpointStore], "readonly");
      const done = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error);
      });
      expect([...transaction.objectStore("conversations").indexNames]).toEqual(["projectContextKey", "savedAt"]);
      expect([...transaction.objectStore(checkpointStore).indexNames]).toEqual(["conversationId", "projectContextKey", "savedAt"]);
      await done;
    } finally { db.close(); }
    expect(await loadConversation(conversation.id)).toEqual(conversation);
    expect(await isScopedAiRecordDeleted("deleted-1", "remote:P")).toBe(version === 2);
    const { saveRunCheckpoint, readRunCheckpoint } = await api();
    expect(await saveRunCheckpoint(fixture())).toEqual({ durable: true, written: true });
    resetAiRecordDbForTest();
    expect(await readRunCheckpoint(fixture())).toMatchObject({ kind: "found", durable: true, checkpoint: fixture() });
    expect(await loadConversation(conversation.id)).toEqual(conversation);
    expect(await isScopedAiRecordDeleted("deleted-1", "remote:P")).toBe(version === 2);
  });
  it("awaits transaction completion and atomically replaces the one pending snapshot for the same run/epoch", async () => {
    const { saveRunCheckpoint, readRunCheckpoint } = await api();
    let completed = 0;
    const native = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (this: IDBDatabase, ...args) {
      const transaction = native.apply(this, args);
      if (transaction.objectStoreNames.contains(checkpointStore)) transaction.addEventListener("complete", () => completed++, { once: true });
      return transaction;
    });
    const proposal = { operationId: "op-1", stage: "applying" as const,
      proposal: { baseContentIdentity: "base", contentIdentity: "draft", calls: [] } };
    await saveRunCheckpoint(fixture({ pending: proposal }));
    expect(completed).toBe(1);
    await saveRunCheckpoint(fixture({ savedAt: 2, pending: { ...proposal, operationId: "op-2" } }));
    expect(completed).toBe(2);
    expect(await readAllAiRecords(checkpointStore)).toHaveLength(1);
    expect(await readRunCheckpoint(fixture())).toMatchObject({ checkpoint: { pending: { operationId: "op-2" } } });
    expect(await saveRunCheckpoint(fixture())).toEqual({ durable: true, written: false });
    await saveRunCheckpoint(fixture({ savedAt: 3, pending: null, status: "terminal" }));
    expect(await readRunCheckpoint(fixture())).toMatchObject({ checkpoint: { pending: null, status: "terminal" } });
    expect(await saveRunCheckpoint(fixture({ savedAt: 4 }))).toEqual({ durable: true, written: false });
  });
  it("propagates an actual transaction abort rather than reporting durable success or falling back", async () => {
    const { saveRunCheckpoint, readRunCheckpoint } = await api();
    await saveRunCheckpoint(fixture());
    const native = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = native.apply(this, args);
      if (this.name === checkpointStore) this.transaction.abort();
      return request;
    });
    await expect(saveRunCheckpoint(fixture({ savedAt: 2 }))).rejects.toThrow();
    spy.mockRestore();
    expect(await readRunCheckpoint(fixture())).toMatchObject({ durable: true, checkpoint: { savedAt: 1 } });
  });
  it("checks the row budget before cloning or starting an IndexedDB write", async () => {
    const { saveRunCheckpoint, readRunCheckpoint } = await api();
    await saveRunCheckpoint(fixture());
    const clone = vi.spyOn(globalThis, "structuredClone");
    const request = { ...fixture().request, text: "x".repeat(9 * 1024 * 1024) };
    await expect(saveRunCheckpoint(fixture({ savedAt: 2, request }))).rejects.toThrow("snapshot budget");
    expect(clone).not.toHaveBeenCalled();
    clone.mockRestore();
    expect(await readRunCheckpoint(fixture())).toMatchObject({ checkpoint: { savedAt: 1 } });
  });
  it.each([
    { schemaVersion: 0 }, { schemaVersion: 99 }, { epoch: -1 }, { epoch: 1.5 }, { conversationId: "" }, { runId: "" }, { projectId: "" },
    { projectContextKey: "" }, { currentContentIdentity: "" }, { savedAt: NaN }, { workPlan: {} }, { budget: {} },
    { save: { revisionId: "receipt", projectId: "FOREIGN", mutationGeneration: 1, contentIdentity: "current" } },
    { arbitraryModelTruth: { passed: true } }, { execute: () => true },
  ])("rejects malformed write %# without damaging the existing row or conversation", async changes => {
    const { saveRunCheckpoint, readRunCheckpoint } = await api();
    await seed(2); await saveRunCheckpoint(fixture());
    await expect(saveRunCheckpoint({ ...fixture(), ...changes } as RunCheckpoint)).rejects.toThrow(TypeError);
    expect(await readRunCheckpoint(fixture())).toMatchObject({ kind: "found", checkpoint: { savedAt: 1 } });
    expect(await loadConversation(conversation.id)).toEqual(conversation);
  });
  it("rejects foreign project and scope keys without overwriting the rightful row", async () => {
    const { saveRunCheckpoint, readRunCheckpoint } = await api();
    await saveRunCheckpoint(fixture());
    for (const foreign of [fixture({ projectId: "Q" }), fixture({ projectContextKey: "remote:Q" })]) {
      expect(await readRunCheckpoint(foreign)).toEqual({ kind: "unsupported", reason: "identity-mismatch", durable: true });
      await expect(saveRunCheckpoint(foreign)).rejects.toThrow(TypeError);
    }
    expect(await readRunCheckpoint(fixture())).toMatchObject({ kind: "found", checkpoint: { projectId: "P" } });
  });
  it.each(["version", "malformed", "foreign-id"] as const)("retains unsupported %s data and keeps its conversation readable", async mode => {
    const { saveRunCheckpoint, readRunCheckpoint, runCheckpointId, deleteTerminalRunCheckpointsForConversation } = await api();
    await seed(2);
    const raw = { ...fixture({ status: "terminal" }), id: runCheckpointId(fixture()),
      ...(mode === "version" ? { schemaVersion: 99 } : mode === "malformed" ? { budget: null } : { conversationId: "another" }) };
    await writeAiRecords(checkpointStore, [raw]);
    expect(await readRunCheckpoint(fixture())).toMatchObject({ kind: "unsupported" });
    await expect(saveRunCheckpoint(fixture())).rejects.toThrow(TypeError);
    expect(await deleteTerminalRunCheckpointsForConversation(conversation.id, "remote:P")).toEqual({ durable: true, deleted: 0 });
    expect(await readAiRecord(checkpointStore, raw.id)).toEqual(raw);
    expect(await loadConversation(conversation.id)).toEqual(conversation);
  });
  it("exposes only explicit terminal cleanup; recent-list limits cannot prune active, awaiting-user or foreign rows", async () => {
    const { saveRunCheckpoint, readRunCheckpoint, deleteTerminalRunCheckpointsForConversation } = await api();
    const checkpoints = [fixture(), fixture({ runId: "waiting", status: "awaiting-user" }), fixture({ runId: "done", status: "terminal" }),
      fixture({ runId: "foreign", projectId: "Q", projectContextKey: "remote:Q", status: "terminal" })];
    for (const checkpoint of checkpoints) await saveRunCheckpoint(checkpoint);
    await writeAiRecords("conversations", Array.from({ length: CONVERSATION_MAX_RECORDS + 2 }, (_, i) => ({ ...conversation, id: `c-${i}`, savedAt: i })));
    expect(await listConversations()).toHaveLength(CONVERSATION_MAX_RECORDS);
    for (const checkpoint of checkpoints) expect(await readRunCheckpoint(checkpoint)).toMatchObject({ kind: "found" });
    expect(await deleteTerminalRunCheckpointsForConversation(conversation.id, "remote:P")).toEqual({ durable: true, deleted: 1 });
    for (const checkpoint of checkpoints) {
      expect(await readRunCheckpoint(checkpoint)).toMatchObject({ kind: checkpoint.runId === "done" ? "missing" : "found" });
    }
  });
  it.each(["absent", "open-failed"] as const)("reports nondurability and snapshots by value when IndexedDB is %s", async backend => {
    const { saveRunCheckpoint, readRunCheckpoint } = await api();
    if (backend === "absent") vi.stubGlobal("indexedDB", undefined);
    else {
      vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new DOMException("Unavailable", "SecurityError"); });
      vi.spyOn(console, "warn").mockImplementation(() => {});
    }
    const input = fixture();
    const saved = saveRunCheckpoint(input);
    Reflect.set(input.budget, "remainingToolCalls", 999);
    expect(await saved).toEqual({ durable: false, written: true });
    const first = await readRunCheckpoint(input);
    expect(first).toMatchObject({ kind: "found", durable: false, checkpoint: { budget: { remainingToolCalls: 2 } } });
    if (first.kind !== "found") throw new Error("Checkpoint missing");
    Reflect.set(first.checkpoint.budget, "remainingToolCalls", 888);
    expect(await readRunCheckpoint(input)).toMatchObject({ durable: false, checkpoint: { budget: { remainingToolCalls: 2 } } });
    resetAiRecordDbForTest();
    expect(await readRunCheckpoint(input)).toEqual({ kind: "missing", durable: false });
  });
});

describe("assistantUx2HistoryIndex", () => {
  isolateTimers();
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
});

// test/conversationStore.test.ts
// 대화 기록 저장소 — IndexedDB(정본) + 레거시 localStorage 이관 + 압축·예산·무예외 계약.
//
// 실측 결함(2026-09-03): 대화 50건을 localStorage 한 키에 통째로 다시 쓰다 오리진 한도(약 5MB)를
// 넘겨 「오류: Failed to execute 'setItem' on 'Storage': … exceeded the quota.」 로 조수 턴이 끊겼다.
// 저장소를 IndexedDB 로 옮기고(레코드 단위 비동기 쓰기, 용량 수백 MB), 예전 키는 첫 접근에 이관한다.
// Node 에는 IndexedDB 가 없어 fake-indexeddb 로 실제 IDB 의미론을 돌린다.
describe("conversationStore", () => {
  isolateTimers();
  // 원격 미러는 포트가 받는다. 예전에는 sync 모듈을 목킹했는데 그 목은 기본 어댑터가 LegacyDb 일 때만
  // 살아 있었다 — 저장소를 심고 그 ai.recordConversation 을 본다.
  let session: MemoryProjectSession | null = null;
  let recordConversationSpy: MockInstance<MemoryRepository["ai"]["recordConversation"]> | null = null;
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalIndexedDb = globalThis.indexedDB;
  function createMemoryStorage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      removeItem: (key: string) => void values.delete(key),
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  }
  function installStorage(storage: Storage): void {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  }
  function user(text: string): AuditEntry {
    return { kind: "user", text };
  }
  function assistant(text: string): AuditEntry {
    return { kind: "assistant", text };
  }
  function tool(name: string): AuditEntry {
    return { kind: "tool", name, args: {}, ok: true, summary: `${name} ok` };
  }
  function record(id: string, savedAt: number, entries: readonly AuditEntry[] = [user(`대화 ${id}`)]): ConversationRecord {
    return {
      id,
      title: deriveTitle(entries),
      model: "stub-model",
      savedAt,
      entries: [...entries],
    };
  }
  const bulkyArgs = (chars: number): Record<string, unknown> => ({
    mapId: "map_village",
    cells: Array.from({ length: Math.ceil(chars / 12) }, (_, index) => ({ x: index % 100, y: Math.floor(index / 100), t: 342 })),
  });
  const bulkyTool = (name: string, chars: number): AuditEntry => ({ kind: "tool", name, args: bulkyArgs(chars), ok: true, summary: `${name} 적용` });
  const bulkyRecord = (id: string, savedAt: number, toolCalls: number, charsPerCall: number): ConversationRecord =>
    record(id, savedAt, [user(`대화 ${id}`), ...Array.from({ length: toolCalls }, (_, index) => bulkyTool(`place_${index}`, charsPerCall))]);
  beforeEach(() => {
    session = installMemoryProjectSession();
    recordConversationSpy = vi.spyOn(session.repository.ai, "recordConversation");
    recordConversationSpy.mockResolvedValue({ kind: "not-configured" });
    installStorage(createMemoryStorage());
    // 테스트마다 새 IndexedDB 세계 — 연결 캐시와 이관 표식도 같이 리셋한다.
    globalThis.indexedDB = new IDBFactory();
    resetAiRecordDbForTest();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    session?.dispose();
    session = null;
    globalThis.indexedDB = originalIndexedDb;
    resetAiRecordDbForTest();
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
      return;
    }
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  describe("conversationStore", () => {
    it("Given saved conversations When listed Then summaries include turn counts and newest records first", async () => {
      await saveConversation(record("old", 100, [user("첫 번째 요청"), assistant("응답")]));
      await saveConversation(record("new", 200, [assistant("준비"), user("두 번째 요청"), tool("create_map"), user("수정 요청")]));

      // preview(마지막 조수/사용자 발화)는 데크(2026-09-03)에서 추가된 목록 필드다 — 여기서는 나머지 모양만 잠근다.
      expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
        { id: "new", title: "두 번째 요청", model: "stub-model", savedAt: 200, turnCount: 2 },
        { id: "old", title: "첫 번째 요청", model: "stub-model", savedAt: 100, turnCount: 1 },
      ]);
    });

    it("Given an existing conversation id When saved again Then it replaces the record without a duplicate", async () => {
      await saveConversation(record("same", 100, [user("처음")]));
      await saveConversation(record("same", 300, [user("교체됨"), assistant("응답")]));

      expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
        { id: "same", title: "교체됨", model: "stub-model", savedAt: 300, turnCount: 1 },
      ]);
    });

    it("Given a saved conversation When loaded Then entries roundtrip and the outcome says durable", async () => {
      const saved = record("roundtrip", 123, [user("저장해줘"), assistant("저장했습니다"), tool("set_tile_metadata")]);

      const outcome = await saveConversation(saved);

      expect(outcome).toEqual({ ok: true, durable: true, evicted: 0 });
      expect(await loadConversation("roundtrip")).toMatchObject(saved);
    });

    it("Given a tool audit with reason When saved Then local load and remote payload keep the reason", async () => {
      const withReason: AuditEntry = {
        kind: "tool",
        name: "tile_erase",
        args: { mapId: "map_hub" },
        ok: true,
        summary: "754칸",
        reason: "다음에 author_village 를 찍을 자리를 비운다",
      };
      await saveConversation(record("reason", 400, [user("검토해줘"), withReason]));
      expect((await loadConversation("reason"))?.entries).toEqual([user("검토해줘"), withReason]);
      const remote = recordConversationSpy!.mock.calls.at(-1)?.[0] as { entries?: AuditEntry[] } | undefined;
      expect(remote?.entries).toEqual([user("검토해줘"), withReason]);
    });

    it("Given saved conversations When one is deleted Then only the other remains", async () => {
      await saveConversation(record("keep", 200));
      await saveConversation(record("delete", 300));

      await deleteConversation("delete");

      expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
        { id: "keep", title: "대화 keep", model: "stub-model", savedAt: 200, turnCount: 1 },
      ]);
    });

    it("Given the only saved conversation When deleted Then the list is empty and stays empty after reopening", async () => {
      await saveConversation(record("only", 100));

      await deleteConversation("only");

      expect(await listConversations()).toEqual([]);
      resetAiRecordDbForTest(); // 연결을 끊고 다시 열어도(새로 고침) 지운 것이 되살아나지 않는다.
      expect(await listConversations()).toEqual([]);
    });

    it("Given saved conversations When cleared Then the list is empty", async () => {
      await saveConversation(record("one", 100));
      await saveConversation(record("two", 200));

      await clearConversations();

      expect(await listConversations()).toEqual([]);
    });

    it("Given more than the recent cap When saved Then older records remain loadable and no eviction is reported", async () => {
      let last = await saveConversation(record("c1", 1));
      for (let index = 2; index <= CONVERSATION_MAX_RECORDS + 5; index += 1) last = await saveConversation(record(`c${index}`, index));

      const summaries = await listConversations();

      expect(summaries).toHaveLength(CONVERSATION_MAX_RECORDS);
      expect(summaries[0]!.id).toBe(`c${CONVERSATION_MAX_RECORDS + 5}`);
      expect(summaries.at(-1)?.id).toBe("c6");
      expect((await loadConversation("c5"))?.id).toBe("c5");
      expect(last).toEqual({ ok: true, durable: true, evicted: 0 });
    });

    it("Given saved conversations When searched by title Then partial case-insensitive matches return", async () => {
      await saveConversation(record("a", 1, [user("마을에 집 지어줘")]));
      await saveConversation(record("b", 2, [user("NPC Dialogue 수정")]));

      expect((await searchConversations("집")).map((conversation) => conversation.id)).toEqual(["a"]);
      expect((await searchConversations("npc dialogue")).map((conversation) => conversation.id)).toEqual(["b"]);
      expect((await searchConversations("")).map((conversation) => conversation.id)).toEqual(["b", "a"]);
      expect(await searchConversations("없는검색어")).toHaveLength(0);
    });

    it("Given audit entries When deriving a title Then it uses the first user text with a short fallback", () => {
      expect(deriveTitle([assistant("ignored"), user("   0123456789012345678901234567890123456789 beyond   ")])).toBe(
        "0123456789012345678901234567890123456789...",
      );
      expect(deriveTitle([assistant("no user")])).toBe("(빈 대화)");
      expect(deriveTitle([user("   ")])).toBe("(빈 대화)");
    });

    it("Given a machine-appended context footer When deriving a title Then only the human sentence survives", () => {
      expect(deriveTitle([user("우물을 놔줘\n\n[컨텍스트] 현재 맵: 이슬 장터 마을 (100x100)")])).toBe("우물을 놔줘");
      expect(deriveTitle([user("표지판을 세워줘")])).toBe("표지판을 세워줘");
    });

    it("Given a remote mirror failure When saving Then the failure is visible without losing the local record", async () => {
      const failure = new Error("missing ai_conversations migration");
      const failureReported = new Promise<void>(resolve => {
        vi.spyOn(console, "error").mockImplementation(() => resolve());
      });
      recordConversationSpy!.mockRejectedValueOnce(failure);

      await saveConversation(record("remote-failure", 400));
      await failureReported;

      expect((await loadConversation("remote-failure"))?.id).toBe("remote-failure");
      // 원격 미러는 이제 프로젝트 저장소(SQLite 호스트)다 — 로그 문구도 바뀌었다.
      expect(console.error).toHaveBeenCalledWith("[ai-conversation] Project storage mirror failed:", failure);
    });
  });
  describe("loadLatestConversationForScope", () => {
    it("남의 프로젝트 대화가 더 최근이어도 내 범위의 최신을 돌려준다", async () => {
      await saveConversation({ ...record("conv_mine_old", 100), projectContextKey: "remote:mine" });
      await saveConversation({ ...record("conv_mine_new", 200), projectContextKey: "remote:mine" });
      await saveConversation({ ...record("conv_other", 999), projectContextKey: "remote:other" });

      expect((await loadLatestConversationForScope("remote:mine"))?.id).toBe("conv_mine_new");
      expect((await loadLatestConversationForScope("remote:other"))?.id).toBe("conv_other");
    });

    it("범위에 저장본이 없으면 null 이다 — 남의 대화를 끌어오지 않는다", async () => {
      await saveConversation({ ...record("conv_other", 999), projectContextKey: "remote:other" });
      expect(await loadLatestConversationForScope("remote:mine")).toBeNull();
    });

    it("저장 순서가 흐트러져도 savedAt 최댓값을 고른다", async () => {
      await saveConversation({ ...record("conv_new", 500), projectContextKey: "remote:mine" });
      await saveConversation({ ...record("conv_old", 100), projectContextKey: "remote:mine" });
      expect((await loadLatestConversationForScope("remote:mine"))?.id).toBe("conv_new");
    });
  });
  // ── 레거시 localStorage 이관 ───────────────────────────────────────────────────────────────
  describe("conversationStore — 레거시 localStorage 이관", () => {
    it("Given 옛 키에 부풀린 대화 3건 When 처음 읽는다 Then IndexedDB 로 옮기며 인자를 압축하고 옛 키를 지운다", async () => {
      const legacy = [bulkyRecord("legacy_c", 3, 10, 20_000), bulkyRecord("legacy_b", 2, 10, 20_000), bulkyRecord("legacy_a", 1, 10, 20_000)];
      const seeded = JSON.stringify(legacy);
      expect(seeded.length).toBeGreaterThan(300_000);
      localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, seeded);

      expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["legacy_c", "legacy_b", "legacy_a"]);
      expect(localStorage.getItem(LEGACY_CONVERSATION_STORAGE_KEY)).toBeNull();
      const migrated = (await loadConversation("legacy_a"))!;
      const firstTool = migrated.entries[1];
      expect(firstTool.kind).toBe("tool");
      if (firstTool.kind !== "tool") return;
      expect(firstTool.args._truncated).toBe(true);
      expect(JSON.stringify(migrated).length).toBeLessThan(40_000);
    });

    it("Given 옛 키가 다시 심어졌다(e2e 시드·QA 스크립트) When 다시 읽는다 Then 같은 id 는 중복되지 않고 최신 savedAt 이 남는다", async () => {
      localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([record("seed", 100, [user("시드 1")])]));
      expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["seed"]);
      await saveConversation(record("seed", 200, [user("시드 1"), assistant("응답")]));

      // 새로 고침을 흉내낸다: 연결을 끊고, e2e addInitScript 처럼 옛 키를 다시 심는다.
      resetAiRecordDbForTest();
      localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([record("seed", 100, [user("시드 1")])]));

      const summaries = await listConversations();
      expect(summaries.map((conversation) => conversation.id)).toEqual(["seed"]);
      expect(summaries[0]!.savedAt).toBe(200);
      expect((await loadConversation("seed"))?.entries).toHaveLength(2);
    });

    it("Given 옛 키가 깨진 JSON 이다 When 읽는다 Then 무시하고 빈 목록이며 키는 정리된다", async () => {
      localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, "{broken json");

      expect(await listConversations()).toEqual([]);
      expect(localStorage.getItem(LEGACY_CONVERSATION_STORAGE_KEY)).toBeNull();
    });
  });
  // ── 압축 ─────────────────────────────────────────────────────────────────────────────────
  describe("conversationStore — 압축", () => {
    it("Given 인자가 큰 툴콜 When 저장한다 Then 인자는 미리보기로 잘리고 작은 인자와 요약·이유는 그대로다", async () => {
      const small: AuditEntry = { kind: "tool", name: "place_npc", args: { mapId: "map_hub", x: 3, y: 4, name: "상인" }, ok: true, summary: "NPC 1명", reason: "시장 입구" };
      const big = bulkyTool("paint_cells", CONVERSATION_ARGS_MAX_CHARS * 4);
      const assistantWithCalls: AuditEntry = {
        kind: "assistant",
        text: "칸을 채웁니다.",
        toolCalls: [
          { name: "place_npc", args: JSON.stringify(small.kind === "tool" ? small.args : {}) },
          { name: "paint_cells", args: "x".repeat(CONVERSATION_ARGS_MAX_CHARS * 3) },
        ],
      };

      await saveConversation(record("clip", 5, [user("채워줘"), assistantWithCalls, small, big]));

      const stored = (await loadConversation("clip"))!;
      expect(stored.entries[2]).toEqual(small);
      const storedBig = stored.entries[3]!;
      expect(storedBig.kind).toBe("tool");
      if (storedBig.kind !== "tool") return;
      expect(storedBig.name).toBe("paint_cells");
      expect(storedBig.summary).toBe("paint_cells 적용");
      expect(storedBig.args._truncated).toBe(true);
      expect(typeof storedBig.args.preview).toBe("string");
      expect(JSON.stringify(storedBig.args).length).toBeLessThanOrEqual(CONVERSATION_ARGS_MAX_CHARS + 64);
      const storedAssistant = stored.entries[1]!;
      expect(storedAssistant.kind).toBe("assistant");
      if (storedAssistant.kind !== "assistant") return;
      expect(storedAssistant.text).toBe("칸을 채웁니다.");
      expect(storedAssistant.toolCalls?.[0]).toEqual(assistantWithCalls.kind === "assistant" ? assistantWithCalls.toolCalls?.[0] : undefined);
      expect(storedAssistant.toolCalls?.[1]?.args.length).toBeLessThanOrEqual(CONVERSATION_ARGS_MAX_CHARS + 1);
    });

    it("Given 레코드 하나가 예산을 넘는 긴 대화 When 저장한다 Then 머리와 꼬리를 남기고 가운데를 표식 하나로 접는다", async () => {
      const line = (index: number): AuditEntry => user(`${index}번째 요청 ${"가".repeat(1_000)}`);
      const entries = Array.from({ length: Math.ceil((CONVERSATION_RECORD_MAX_CHARS * 2) / 1_000) }, (_, index) => line(index));
      const last = entries.length - 1;

      const outcome = await saveConversation(record("long", 7, entries));

      expect(outcome.ok).toBe(true);
      const stored = (await loadConversation("long"))!;
      expect(JSON.stringify(stored.entries).length).toBeLessThanOrEqual(CONVERSATION_RECORD_MAX_CHARS + 1_200);
      expect(stored.entries[0]).toEqual(line(0));
      expect(stored.entries.at(-1)).toEqual(line(last));
      const markers = stored.entries.filter((entry) => entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER));
      expect(markers).toHaveLength(1);
      const dropped = entries.length - (stored.entries.length - 1);
      expect(markers[0]!.kind === "status" ? markers[0]!.text : "").toContain(String(dropped));

      await saveConversation(record("long", 8, [...stored.entries, line(last + 1), line(last + 2)]));
      const again = (await loadConversation("long"))!;
      const markersAgain = again.entries.filter((entry) => entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER));
      expect(markersAgain).toHaveLength(1);
      expect(again.entries.at(-1)).toEqual(line(last + 2));
      expect(again.entries[0]).toEqual(line(0));
    });

    it("Given 인자가 큰 툴콜 When 저장한다 Then 원격 미러도 로컬과 같은 압축본을 받는다", async () => {
      await saveConversation(record("mirror", 3, [user("미러"), bulkyTool("paint_cells", CONVERSATION_ARGS_MAX_CHARS * 4)]));

      const remote = recordConversationSpy!.mock.calls.at(-1)?.[0] as { entries?: AuditEntry[] } | undefined;
      const remoteTool = remote?.entries?.[1];
      expect(remoteTool?.kind).toBe("tool");
      if (remoteTool?.kind !== "tool") return;
      expect(remoteTool.args._truncated).toBe(true);
      expect(remote?.entries).toEqual((await loadConversation("mirror"))?.entries);
    });
  });
  // ── 저장소가 없거나 고장났을 때 ─────────────────────────────────────────────────────────────
  describe("conversationStore — 폴백", () => {
    it("Given IndexedDB 가 없는 환경(Node) When 저장·조회한다 Then 던지지 않고 메모리에서 동작하며 durable:false 를 돌려준다", async () => {
      Reflect.deleteProperty(globalThis, "indexedDB");
      resetAiRecordDbForTest();

      const outcome = await saveConversation(record("memory-only", 100));

      expect(outcome).toEqual({ ok: true, durable: false, evicted: 0 });
      expect((await loadConversation("memory-only"))?.id).toBe("memory-only");
      await deleteConversation("memory-only");
      await clearConversations();
      expect(await listConversations()).toEqual([]);
    });

    it("Given IndexedDB 열기가 실패한다(프라이빗 모드 등) When 저장한다 Then 메모리로 내려가고 경고는 한 번만 찍는다", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const broken = { open: () => { throw new Error("InvalidStateError: A mutation operation was attempted on a database that did not allow mutations."); } };
      globalThis.indexedDB = broken as unknown as IDBFactory;
      resetAiRecordDbForTest();

      const first = await saveConversation(record("broken_1", 1));
      const second = await saveConversation(record("broken_2", 2));

      expect(first).toEqual({ ok: true, durable: false, evicted: 0 });
      expect(second.durable).toBe(false);
      expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["broken_2", "broken_1"]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain("[ai-records]");
    });

    it("Given Node without localStorage When the store is used Then legacy migration is skipped safely", async () => {
      Reflect.deleteProperty(globalThis, "localStorage");

      await saveConversation(record("missing-storage", 100));
      expect((await loadConversation("missing-storage"))?.id).toBe("missing-storage");
      await deleteConversation("missing-storage");
      await clearConversations();
      expect(await listConversations()).toEqual([]);
    });
  });
  describe("listConversations 미리보기 (데크 2026-09-03)", () => {
    it("마지막 조수 발화를 80자 안으로 잘라 preview 로 준다 — 없으면 마지막 사용자 발화", async () => {
      // Break: 이전 대화 목록이 제목·날짜·턴 수만 보여 어느 대화인지 고를 근거가 없다.
      await saveConversation({
        id: "conv_preview",
        title: "광장",
        model: "m",
        savedAt: 10,
        projectContextKey: "local:x::m1",
        entries: [
          { kind: "user", text: "우물 놓아줘" },
          { kind: "assistant", text: "광장 북쪽 (24,11) 에 우물을 놓았습니다. " + "다음으로 상점 창을 붙일까요? ".repeat(6) },
        ],
      });
      await saveConversation({
        id: "conv_preview_user_only",
        title: "질문만",
        model: "m",
        savedAt: 20,
        projectContextKey: "local:x::m1",
        entries: [{ kind: "user", text: "이 맵에 상점이 몇 개야?" }],
      });
      const rows = await listConversations();
      const withAssistant = rows.find((row) => row.id === "conv_preview");
      expect(withAssistant?.preview?.startsWith("광장 북쪽 (24,11) 에 우물을 놓았습니다.")).toBe(true);
      expect((withAssistant?.preview ?? "").length).toBeLessThanOrEqual(81);
      expect(withAssistant?.preview?.endsWith("…")).toBe(true);
      expect(rows.find((row) => row.id === "conv_preview_user_only")?.preview).toBe("이 맵에 상점이 몇 개야?");
    });
  });
});

describe("historyRecoveryAdmission", () => {
  isolateTimers();
  const scope = "remote:recovery-test";
  const records = db.AI_RECORD_STORES.conversations;
  let session: ElectronBridgeSession | null = null;
  function serveList(entered: () => void, response: Promise<Response>): void {
    session!.setConversationListImpl(async () => { entered(); return (await response).json(); });
  }
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
  afterEach(() => {
    session?.dispose();
    session = null;
    db.resetAiRecordDbForTest();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  describe.each(["indexeddb", "memory"] as const)("explicit recovery admission on %s", backend => {
    beforeEach(async () => {
      vi.stubGlobal("indexedDB", backend === "indexeddb" ? new IDBFactory() : undefined);
      db.resetAiRecordDbForTest();
      session = await installElectronBridgeSession({ projectDir: "/tmp/oprn-history-recovery", projectId: "recovery-test" });
    });

    it.each(["created", "entries", "nested", "title", "model", "mapIndex", "undefined-property"] as const)("preserves %s changed during retrieval, even below the remote timestamp", async field => {
      if (field !== "created") await put(local());
      const started = deferred<void>(), response = deferred<Response>();
      serveList(() => started.resolve(), response.promise);
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
      expect(session!.calls.conversationList).toBe(1);
    });

    it("captures memory-backed records by value rather than retaining aliases", async () => {
      await put(local());
      const started = deferred<void>(), response = deferred<Response>();
      serveList(() => started.resolve(), response.promise);
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
      session!.setConversationListImpl(async () => [wire(remote)]);
      expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: savedAt > 100 ? 1 : 0, skipped: savedAt > 100 ? 0 : 1 });
      expect((await read())?.entries).toEqual(savedAt > 100 ? remote.entries : local().entries);
      expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: 0, skipped: 1 });
      expect(session!.calls.conversationList).toBe(2);
    });

    it("keeps one baseline across all remote pages", async () => {
      const page2 = deferred<void>(), response = deferred<Response>();
      session!.setConversationListImpl(async options => {
        if (Number(options.offset ?? 0) === 0) {
          await put(local("later", 1));
          return Array.from({ length: 100 }, (_, index) => wire(local(`page1-${index}`, 900)));
        }
        page2.resolve();
        return (await response.promise).json();
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
      serveList(() => started.resolve(), response.promise);
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
      session!.setConversationListImpl(async () => [wire()]);
      expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: 0, skipped: 1 });
      expect(intercepted).toBe(true);
      expect(await read()).toEqual(changed);
    });
  });
});

describe("mapConversationStore", () => {
  isolateTimers();
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetAiRecordDbForTest();
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  });
  afterEach(() => { resetAiRecordDbForTest(); vi.unstubAllGlobals(); });
  it("Given 151 records When reopened Then the oldest remains loadable and the recent list stays 50", async () => {
    for (let index = 0; index < 151; index++) {
      await saveConversation({ id: `retention-${index}`, title: `record ${index}`, model: "test", savedAt: index,
        projectContextKey: "remote:P", entries: [{ kind: "user", text: `request ${index}` }] });
    }
    resetAiRecordDbForTest();
    expect(await listConversations()).toHaveLength(50);
    expect((await loadConversation("retention-0"))?.id).toBe("retention-0");
  });
  const record = (id: string, savedAt = 1, projectContextKey = "remote:P"): ConversationRecord => ({
    id, savedAt, projectContextKey, title: id, model: "test", entries: [{ kind: "user", text: id,
      context: { mapId: "A", mapName: "origin" } }],
  });
  it("Given A context and large B target When saved Then both map queries find the whole conversation before argument compaction", async () => {
    const input = record("mixed");
    input.entries.push({ kind: "tool", name: "paint_cells", args: { mapId: "B", cells: "x".repeat(4000) }, ok: true, summary: "done" });
    await saveConversation(input);
    expect(conversations).toHaveProperty("queryConversationArchive");
    for (const mapId of ["A", "B"]) {
      const result = await conversations.queryConversationArchive({ projectContextKey: "remote:P", mapId });
      expect(result.records.map(row => row.id)).toEqual(["mixed"]);
      expect(result.records[0]).toMatchObject({ viewedMapIds: ["A"], targetMapIds: ["B"], mapAttribution: "complete", transcriptCompacted: true });
    }
  });
  it("Given an out of order update When saved Then newer local transcript survives", async () => {
    await saveConversation(record("newer", 200));
    await saveConversation({ ...record("newer", 100), title: "stale" });
    expect((await loadConversation("newer"))?.savedAt).toBe(200);
  });
  it("Given a deletion When a delayed save arrives after reopening Then it cannot resurrect the record", async () => {
    await saveConversation(record("deleted"));
    await conversations.deleteConversation("deleted");
    resetAiRecordDbForTest();
    await saveConversation(record("deleted", 999));
    expect(await loadConversation("deleted")).toBeNull();
  });
  it("Given same map IDs in P and Q When querying loading or deleting P Then Q is untouched", async () => {
    await saveConversation(record("p"));
    await saveConversation(record("q", 1, "remote:Q"));
    expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P", mapId: "A" })).records.map(row => row.id)).toEqual(["p"]);
    expect(await conversations.loadConversationForScope("q", "remote:P")).toBeNull();
    await conversations.deleteConversationForScope("q", "remote:P");
    expect((await conversations.loadConversationForScope("q", "remote:Q"))?.id).toBe("q");
    await saveConversation({ ...record("q", 200), title: "wrong owner" });
    expect((await loadConversation("q"))?.projectContextKey).toBe("remote:Q");
  });
  it("Given tied timestamps When searching and paging Then order is stable by id and totals describe the filtered archive", async () => {
    for (const id of ["c", "a", "b"]) await saveConversation({ ...record(id), title: `Needle ${id}` });
    const page = await conversations.queryConversationArchive({ projectContextKey: "remote:P", query: "NEEDLE", limit: 2 });
    expect(page).toMatchObject({ total: 3, hasMore: true, durable: true });
    expect(page.records.map(row => row.id)).toEqual(["a", "b"]);
    const tail = await conversations.queryConversationArchive({ projectContextKey: "remote:P", query: "needle", offset: 2, limit: 2 });
    expect(tail.records.map(row => row.id)).toEqual(["c"]);
    expect(tail.hasMore).toBe(false);
  });
  it("Given legacy unscoped and malformed metadata When read Then attribution is unknown or recovered without current-map inference", async () => {
    await writeAiRecords("conversations", [
      { ...record("unknown"), projectContextKey: undefined, entries: [{ kind: "user", text: "mapId A in prose" }] },
      { ...record("malformed"), mapIndex: { viewedMapIds: [42], targetMapIds: "B", mapAttribution: "complete" } },
      { ...record("invalid"), entries: [{ kind: "assistant", text: "x", toolCalls: [null] }] },
    ]);
    expect((await conversations.queryConversationArchive({ projectContextKey: null, unknownOnly: true })).records.map(row => row.id)).toEqual(["unknown"]);
    const scoped = await conversations.queryConversationArchive({ projectContextKey: "remote:P" });
    expect(scoped.records.map(row => row.id)).toEqual(["malformed"]);
    expect(scoped.records[0]?.mapIds).toEqual(["A"]);
  });
  it("Given known endpoint fields and unrelated nested strings When indexed Then only recognized map references are used", async () => {
    const input = record("endpoints");
    input.entries.push({ kind: "tool", name: "link_maps", args: { a: { mapId: "B" }, b: { toMapId: "C" },
      arbitrary: { mapId: "not-a-target" }, name: "map_D" }, ok: true, summary: "done" });
    input.entries.push({ kind: "assistant", text: "", toolCalls: [{ name: "transfer", args: JSON.stringify({ toMapId: "D" }) }] });
    await saveConversation(input);
    expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).records[0]?.mapIds).toEqual(["A", "B", "C", "D"]);
  });
  it("Given a target only in the trimmed middle When saved and continued Then its association and original retained transcript survive", async () => {
    const input = record("long");
    input.entries.push(...Array.from({ length: 400 }, (_, index) => ({ kind: "user" as const, text: "x".repeat(1000),
      context: { mapId: index === 100 ? "middle" : "A", mapName: null } })));
    await saveConversation(input);
    const loaded = await conversations.loadConversationForScope("long", "remote:P");
    expect(loaded).not.toBeNull();
    if (!loaded) throw new Error("missing saved conversation");
    expect(loaded.entries.some(entry => entry.kind === "user" && entry.context?.mapId === "middle")).toBe(false);
    await saveConversation({ ...loaded, savedAt: 2, entries: [...loaded.entries, { kind: "user", text: "continue", context: { mapId: "B", mapName: null } }] });
    const restored = await conversations.loadConversationForScope("long", "remote:P");
    expect(restored?.entries[0]).toEqual(input.entries[0]);
    expect(restored?.id).toBe(input.id);
    expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P", mapId: "middle" })).total).toBe(1);
  });
  it("Given same-millisecond live updates When the transcript grows Then the final update is retained", async () => {
    const input = record("equal");
    await saveConversation(input);
    await saveConversation({ ...input, entries: [...input.entries, { kind: "assistant", text: "final" }] });
    expect((await loadConversation("equal"))?.entries).toHaveLength(2);
  });
  it("Given simultaneous saves and deletion When all settle Then the tombstone wins regardless of scheduling", async () => {
    await saveConversation(record("race"));
    await Promise.all([saveConversation(record("race", 2)), conversations.deleteConversationForScope("race", "remote:P"), saveConversation(record("race", 3))]);
    resetAiRecordDbForTest();
    expect(await loadConversation("race")).toBeNull();
  });
  it("Given legacy records at clear When a legacy seed returns after reopen Then clear suppression remains durable", async () => {
    const legacy = record("legacy-cleared");
    localStorage.setItem(conversations.LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([legacy]));
    await conversations.clearConversations();
    resetAiRecordDbForTest();
    localStorage.setItem(conversations.LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([{ ...legacy, savedAt: 999 }]));
    expect(await loadConversation(legacy.id)).toBeNull();
  });
  it("Given no IndexedDB When saving deleting and querying Then memory operation never claims durability", async () => {
    vi.stubGlobal("indexedDB", undefined);
    resetAiRecordDbForTest();
    expect((await saveConversation(record("memory"))).durable).toBe(false);
    expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).durable).toBe(false);
    expect(await conversations.deleteConversationForScope("memory", "remote:P")).toEqual({ durable: false });
    await saveConversation(record("memory", 2));
    expect(await loadConversation("memory")).toBeNull();
  });
  it("Given a v1 IndexedDB When archive opens Then migration preserves old rows and adds durable deletion suppression", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(AI_RECORD_DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("conversations", { keyPath: "id" }).put(record("v1"));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
    expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).records[0]?.id).toBe("v1");
    await conversations.deleteConversationForScope("v1", "remote:P");
    resetAiRecordDbForTest();
    await saveConversation(record("v1", 2));
    expect(await loadConversation("v1")).toBeNull();
  });
});
