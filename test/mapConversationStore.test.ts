import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetAiRecordDbForTest, writeAiRecords, AI_RECORD_DB_NAME } from "@/ai/aiRecordDb";
import * as conversations from "@/ai/conversationStore";
import { listConversations, loadConversation, saveConversation, type ConversationRecord } from "@/ai/conversationStore";

vi.mock("@/project/supabaseProjectSync", () => ({
  recordSupabaseConversation: vi.fn(async () => ({ kind: "not-configured" })),
}));

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
