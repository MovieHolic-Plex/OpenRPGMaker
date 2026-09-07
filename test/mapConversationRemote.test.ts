import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as conversations from "@/ai/conversationStore";
import { resetAiRecordDbForTest } from "@/ai/aiRecordDb";
import { listSupabaseConversations, loadSupabaseConversation, recordSupabaseConversation } from "@/project/supabaseProjectSync";
import { enqueueRemoteWrite, flushRemoteOutbox, listRemoteOutbox } from "@/project/remoteOutbox";

const state = vi.hoisted(() => ({ config: { url: "http://archive.test", anonKey: "test-only", projectId: "P" } }));
vi.mock("@/project/supabaseProjectConfig", () => ({ supabaseProjectConfig: () => state.config }));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetAiRecordDbForTest();
  state.config = { url: "http://archive.test", anonKey: "test-only", projectId: "P" };
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); resetAiRecordDbForTest(); });

it("Given a second remote page When listed Then offset and deterministic tie ordering reach transport", async () => {
  const urls: URL[] = [];
  vi.stubGlobal("fetch", (async input => { urls.push(new URL(String(input))); return Response.json([]); }) satisfies typeof fetch);
  await listSupabaseConversations({ limit: 100, offset: 100 });
  expect(urls[0]?.searchParams.get("offset")).toBe("100");
  expect(urls[0]?.searchParams.get("order")).toBe("saved_at.desc,conversation_id.asc");
  expect(urls[0]?.searchParams.has("project_context_key")).toBe(false);
});

it("Given transport failure When listing or loading Then recovery rejects rather than returning empty success", async () => {
  vi.stubGlobal("fetch", (async () => new Response("unavailable", { status: 503 })) satisfies typeof fetch);
  await expect(listSupabaseConversations()).rejects.toMatchObject({ status: 503 });
  await expect(loadSupabaseConversation("broken")).rejects.toMatchObject({ status: 503 });
});

it("Given origin P and current Q When replaying a conversation write Then transport keeps P", async () => {
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", (async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body))); return new Response(null, { status: 201 });
  }) satisfies typeof fetch);
  state.config = { ...state.config, projectId: "Q" };
  await recordSupabaseConversation({ conversationId: "origin", title: "origin", model: "test", savedAt: 1,
    projectContextKey: "remote:P", destinationProjectId: "P", entries: [] });
  expect(bodies).toMatchObject([[{ project_id: "P", project_context_key: "remote:P", entries_json: [] }]]);
});

const remoteRow = (index: number) => ({ project_id: "P", conversation_id: `remote-${index}`, title: `remote ${index}`,
  model: "test", project_context_key: "remote:P", saved_at: new Date(1000 - index).toISOString(),
  entries_json: [{ kind: "user", text: `request ${index}`, context: { mapId: index === 100 ? "B" : "A", mapName: null } }],
});

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("uninitialized signal"); };
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

it("Given 101 remote rows When explicitly hydrated twice Then the older B record is recovered once with zero mirror writes", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => remoteRow(index));
  const offsets: number[] = [];
  vi.stubGlobal("fetch", (async (input, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const url = new URL(String(input));
    expect(url.searchParams.get("project_id")).toBe("eq.P");
    expect(url.searchParams.get("project_context_key")).toBe("eq.remote:P");
    expect(url.searchParams.get("select")?.split(",")).toContain("entries_json");
    const offset = Number(url.searchParams.get("offset")); offsets.push(offset);
    return Response.json(rows.slice(offset, offset + 100));
  }) satisfies typeof fetch);
  expect(await conversations.hydrateConversationArchive({ projectContextKey: "remote:P" })).toEqual({ imported: 101, skipped: 0, rejected: 0, durable: true });
  resetAiRecordDbForTest();
  expect(await conversations.hydrateConversationArchive({ projectContextKey: "remote:P" })).toEqual({ imported: 0, skipped: 101, rejected: 0, durable: true });
  expect(offsets).toEqual([0, 100, 0, 100]);
  expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P", mapId: "B" })).records.map(row => row.id)).toEqual(["remote-100"]);
  expect((await conversations.loadConversationForScope("remote-100", "remote:P"))?.entries).toEqual(rows[100]?.entries_json);
});

it("Given newer local and deleted rows When remote copies arrive Then neither can replace local decisions", async () => {
  const rows = [remoteRow(0), remoteRow(1)];
  const methods: string[] = [];
  vi.stubGlobal("fetch", (async (_input, init) => {
    methods.push(init?.method ?? "GET");
    return init?.method === "POST" ? new Response(null, { status: 201 }) : Response.json(rows);
  }) satisfies typeof fetch);
  await conversations.saveConversation({ id: "remote-0", title: "newer", model: "local", savedAt: 5000,
    projectContextKey: "remote:P", entries: [{ kind: "user", text: "local" }] });
  await conversations.deleteConversationForScope("remote-1", "remote:P");
  resetAiRecordDbForTest();
  methods.length = 0;
  expect(await conversations.hydrateConversationArchive({ projectContextKey: "remote:P" })).toMatchObject({ imported: 0, skipped: 2 });
  expect((await conversations.loadConversationForScope("remote-0", "remote:P"))?.savedAt).toBe(5000);
  expect(await conversations.loadConversationForScope("remote-1", "remote:P")).toBeNull();
  expect(methods).toEqual(["GET"]);
});

it("Given malformed foreign and unattributed remote rows When hydrated Then rejected rows are counted and never adopted", async () => {
  vi.stubGlobal("fetch", (async () => Response.json([
    { ...remoteRow(0), project_id: "Q" }, { ...remoteRow(1), project_context_key: "remote:Q" },
    { ...remoteRow(2), project_context_key: null }, { ...remoteRow(3), saved_at: "invalid" },
    { ...remoteRow(4), entries_json: [{ kind: "assistant", toolCalls: [42], text: "invalid" }] },
    { ...remoteRow(5), entries_json: { entries: [] } },
  ])) satisfies typeof fetch);
  expect(await conversations.hydrateConversationArchive({ projectContextKey: "remote:P" })).toMatchObject({ imported: 0, rejected: 6 });
  expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).total).toBe(0);
});

it("Given compacted remote provenance When imported Then the map association is explicitly partial", async () => {
  vi.stubGlobal("fetch", (async () => Response.json([{ ...remoteRow(0), entries_json: [
    ...remoteRow(0).entries_json, { kind: "tool", name: "paint", args: { _truncated: true, preview: "mapId B" }, ok: true, summary: "done" },
  ] }])) satisfies typeof fetch);
  await conversations.hydrateConversationArchive({ projectContextKey: "remote:P" });
  expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).records[0]).toMatchObject({
    mapIds: ["A"], mapAttribution: "partial", transcriptCompacted: true,
  });
});

it.each(["abort", "project-switch"])("Given delayed transport When %s occurs Then the old response cannot import", async mode => {
  const requested = deferred<void>(); const response = deferred<Response>();
  const controller = new AbortController(); let current = true;
  vi.stubGlobal("fetch", (async (_input, init) => {
    expect(init?.signal).toBe(controller.signal); requested.resolve(); return response.promise;
  }) satisfies typeof fetch);
  const pending = conversations.hydrateConversationArchive({ projectContextKey: "remote:P", signal: controller.signal, isCurrent: () => current });
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await requested.promise;
  if (mode === "abort") controller.abort(); else { current = false; state.config = { ...state.config, projectId: "Q" }; }
  response.resolve(Response.json([remoteRow(0)]));
  await rejected;
  expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).total).toBe(0);
  expect((await conversations.queryConversationArchive({ projectContextKey: "remote:Q" })).total).toBe(0);
});

it("Given an aborted recovery before starting When called Then no transport request is made", async () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController(); controller.abort();
  await expect(conversations.hydrateConversationArchive({ projectContextKey: "remote:P", signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([503, 200])("Given failed or malformed recovery transport (%s) When hydrating Then the error reaches the caller", async status => {
  vi.stubGlobal("fetch", (async () => Response.json({ invalid: true }, { status })) satisfies typeof fetch);
  await expect(conversations.hydrateConversationArchive({ projectContextKey: "remote:P" })).rejects.toBeInstanceOf(Error);
});

it("Given P save and Q switch before local persistence When mirror fails and outbox replays Then both sends target P without stored credentials", async () => {
  const failed = deferred<void>(); const bodies: unknown[] = [];
  vi.spyOn(console, "error").mockImplementation(() => failed.resolve());
  vi.stubGlobal("fetch", (async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: bodies.length === 1 ? 503 : 201 });
  }) satisfies typeof fetch);
  const pending = conversations.saveConversation({ id: "frozen", title: "frozen", model: "test", savedAt: 1,
    projectContextKey: "local:origin::A", entries: [{ kind: "user", text: "request" }] });
  state.config = { ...state.config, projectId: "Q" };
  await pending; await failed.promise;
  expect(listRemoteOutbox()[0]?.payload).toMatchObject({ destinationProjectId: "P" });
  expect(listRemoteOutbox()[0]?.payload).not.toHaveProperty("anonKey");
  expect(await flushRemoteOutbox()).toMatchObject({ sent: 1, failed: 0 });
  expect(bodies).toMatchObject([[{ project_id: "P" }], [{ project_id: "P" }]]);
});

it.each([
  { snapshot: "equal-timestamp replacement", replace: true, savedAt: 1000, counts: [1, 2, 2] },
  { snapshot: "equal-timestamp current retry", replace: false, savedAt: 1000, counts: [1, 1] },
  { snapshot: "strictly newer replacement", replace: true, savedAt: 1001, counts: [1, 2] },
])("Given a failed mirror and $snapshot When flushing under Q Then the authoritative snapshot stays at P", async ({ replace, savedAt, counts }) => {
  const queued = deferred<void>(); const replaced = deferred<void>();
  const writes: Array<{ conversation_id: string; project_id: string; project_context_key: string; title: string;
    model: string; saved_at: string; entries_json: unknown[] }> = [];
  const remote = new Map<string, (typeof writes)[number]>();
  const setItem = localStorage.setItem.bind(localStorage);
  vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
    setItem(key, value);
    if (listRemoteOutbox().some(entry => entry.id === "C")) queued.resolve();
  });
  const mirrorError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", (async (_input, init) => {
    expect(init?.method).toBe("POST");
    const [row] = JSON.parse(String(init?.body)) as typeof writes;
    if (!row) throw new Error("Missing conversation row");
    writes.push(row);
    if (writes.length === 1) return new Response(null, { status: 503 });
    remote.set(row.conversation_id, row);
    replaced.resolve();
    return new Response(null, { status: 201 });
  }) satisfies typeof fetch);
  const initial: conversations.ConversationRecord = { id: "C", title: "old", model: "initial", savedAt: 1000,
    projectContextKey: "local:origin::A", entries: [{ kind: "user", text: "request" }] };
  expect(await conversations.saveConversation(initial)).toMatchObject({ ok: true, durable: true });
  await queued.promise;
  expect(mirrorError).toHaveBeenCalledTimes(1);
  expect(listRemoteOutbox()).toHaveLength(1);
  expect(listRemoteOutbox()[0]?.payload).toMatchObject({ title: initial.title, savedAt: initial.savedAt, entries: initial.entries });
  const authoritative: conversations.ConversationRecord = replace ? { ...initial, title: "final", model: "updated", savedAt,
    entries: [...initial.entries, { kind: "assistant", text: "done" }] } : initial;
  if (replace) {
    expect(await conversations.saveConversation(authoritative)).toMatchObject({ ok: true, durable: true });
    await replaced.promise;
  }
  expect(await conversations.loadConversationForScope("C", initial.projectContextKey ?? null)).toMatchObject(authoritative);
  state.config = { ...state.config, projectId: "Q" };
  expect(await flushRemoteOutbox()).toEqual({ sent: 1, failed: 0, skipped: 0 });
  expect.soft(writes.map(row => row.entries_json.length)).toEqual(counts);
  expect.soft(remote.get("C")).toEqual({ conversation_id: "C", project_id: "P", project_context_key: authoritative.projectContextKey,
    title: authoritative.title, model: authoritative.model, saved_at: new Date(authoritative.savedAt).toISOString(), entries_json: authoritative.entries });
  expect(writes.every(row => row.project_id === "P" && row.project_context_key === initial.projectContextKey)).toBe(true);
  expect(listRemoteOutbox()).toEqual([]);
});

it("Given old outbox payloads When replayed under Q Then explicit remote P is safe and ambiguous local origin is retained as failure", async () => {
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", (async (_input, init) => { bodies.push(JSON.parse(String(init?.body))); return new Response(null, { status: 201 }); }) satisfies typeof fetch);
  state.config = { ...state.config, projectId: "Q" };
  for (const [id, projectContextKey] of [["safe", "remote:P"], ["ambiguous", "local:old::A"]]) {
    enqueueRemoteWrite({ id, kind: "ai-conversation", payload: { conversationId: id, projectContextKey, title: id, model: "test", savedAt: 1, entries: [] } });
  }
  expect(await flushRemoteOutbox()).toMatchObject({ sent: 1, failed: 1 });
  expect(bodies).toMatchObject([[{ project_id: "P" }]]);
  expect(listRemoteOutbox().map(entry => entry.id)).toEqual(["ambiguous"]);
});

it("Given a tombstoned outbox write When replayed Then no remote write occurs", async () => {
  await conversations.deleteConversationForScope("deleted", "remote:P");
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  enqueueRemoteWrite({ id: "deleted", kind: "ai-conversation", payload: {
    conversationId: "deleted", projectContextKey: "remote:P", destinationProjectId: "P", title: "deleted", model: "test", savedAt: 1, entries: [],
  } });
  expect(await flushRemoteOutbox()).toMatchObject({ sent: 1, failed: 0 });
  expect(fetchMock).not.toHaveBeenCalled();
});
