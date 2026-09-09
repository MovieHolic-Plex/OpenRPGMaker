import "fake-indexeddb/auto";
import { IDBDatabase, IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AI_RECORD_DB_NAME, aiRecordBackendKind, isScopedAiRecordDeleted, readAiRecord, readAllAiRecords,
  resetAiRecordDbForTest, writeAiRecords,
} from "@/ai/aiRecordDb";
import { CONVERSATION_MAX_RECORDS, listConversations, loadConversation, type ConversationRecord } from "@/ai/conversationStore";
import type { RunCheckpoint } from "@/ai/runCheckpointStore";
import { createBlankProject } from "@/project/defaults";

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
    expect(db.version).toBe(3);
    expect([...db.objectStoreNames]).toEqual(["conversationTombstones", "conversations", "runCheckpoints"]);
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
    proposal: { baseContentIdentity: "base", contentIdentity: "draft", project: createBlankProject(), calls: [] } };
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
