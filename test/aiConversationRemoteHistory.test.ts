import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_RECORD_STORES, readAllAiRecords, resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import * as conversations from "@/ai/conversationStore";
import type { ConversationRecord } from "@/ai/conversationStore";
import { closeAiConversationHistoryModal, openAiConversationHistoryModal, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import * as bridge from "@/editor/aiAssistantBridge";
import { store } from "@/project/store";
import * as sync from "@/project/supabaseProjectSync";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// Explicit migration authorized by main-history-policy-adjudication.md.
// Browse/Open stay local; only Recover imports, never opens or mirrors a record.
const scope = "remote:history-project";
const recordsStore = AI_RECORD_STORES.conversations;
let restoreDom: () => void;
let panelCleanup: (() => Promise<void>) | undefined;
let requests: URL[];
let respond: (url: URL) => Promise<Response>;
function record(id = "remote-only", savedAt = 2_000): ConversationRecord {
  return { id, title: id, model: "history-model", savedAt, projectContextKey: scope,
    entries: [{ kind: "user", text: `request-${id}` }, { kind: "assistant", text: `answer-${id}` }] };
}
function wire(value = record()): Record<string, unknown> {
  return { conversation_id: value.id, project_id: "history-project", project_context_key: value.projectContextKey,
    title: value.title, model: value.model, saved_at: new Date(value.savedAt).toISOString(), entries_json: value.entries };
}
const json = (value: unknown) => Response.json(value);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function click(root: FakeElement, id = "ai-history-open", index = 0) {
  const node = root.querySelectorAll(`[data-testid=${id}]`)[index];
  expect(node, id).toBeDefined();
  (node as unknown as HTMLElement).click();
}
const rows = (root: FakeElement) => root.querySelectorAll("[data-testid=ai-history-row]");
function open(onOpen = vi.fn(), isCurrent = () => true, scopeKey = scope) {
  const root = openAiConversationHistoryModal({ scopeKey, currentConversationId: "active", currentMapId: null,
    knownMaps: [], onOpen, isCurrent }) as unknown as FakeElement;
  click(root, "ai-history-filter-all");
  return { root, onOpen };
}
const settled = whenAiConversationHistoryModalSettled;
const put = (value: ConversationRecord) => writeAiRecords(recordsStore, [value]);
const read = (id = "remote-only") => conversations.loadConversation(id);
const recoveryState = (root: FakeElement) => findByTestId(root, "ai-history-recover-status")?.dataset.state;

beforeEach(() => {
  restoreDom = installFakeDom();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetAiRecordDbForTest();
  vi.stubEnv("VITE_SUPABASE_URL", "https://history.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-only-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "history-project");
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "false");
  requests = [];
  respond = async () => json([wire()]);
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input)); requests.push(url); return respond(url);
  }));
});
afterEach(async () => {
  closeAiConversationHistoryModal(); await settled();
  await panelCleanup?.(); panelCleanup = undefined;
  for (const [input, init] of vi.mocked(fetch).mock.calls) {
    const url = new URL(String(input));
    expect(init?.method ?? "GET").toBe("GET");
    expect(url.origin).toBe("https://history.invalid");
    expect(url.pathname).toBe("/rest/v1/ai_conversations");
    expect(new Headers(init?.headers).get("Accept-Profile")).toBe("rpg_zzu");
  }
  resetAiRecordDbForTest(); restoreDom(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("public history with separate explicit recovery", () => {
  it("browses locally, explicitly recovers exact retained entries, then opens without another GET or transcript mutation", async () => {
    respond = async () => json([wire(), wire()]);
    const mirror = vi.spyOn(sync, "recordSupabaseConversation");
    const { root, onOpen } = open(); await settled();
    expect(rows(root)).toHaveLength(0); expect(requests).toEqual([]);
    click(root, "ai-history-recover"); await settled();
    expect(rows(root)).toHaveLength(1); expect(onOpen).not.toHaveBeenCalled();
    expect(findByTestId(root, "ai-history-delete")).not.toBeNull();
    const imported = await read();
    expect(imported).toMatchObject(record()); expect(imported?.entries).toEqual(record().entries);
    expect(await readAllAiRecords(recordsStore)).toEqual([imported]);
    click(root); await settled();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(imported);
    expect(root.parentElement).toBeNull(); expect(await read()).toEqual(imported);
    expect(requests).toHaveLength(1); expect(mirror).not.toHaveBeenCalled();
    expect(requests[0]!.searchParams.get("project_id")).toBe("eq.history-project");
    expect(requests[0]!.searchParams.get("project_context_key")).toBe(`eq.${scope}`);
    expect(requests[0]!.searchParams.get("select")).toContain("entries_json");
  });

  it.each([1_000, 9_000])("ordinary Open keeps local authoritative without consulting remote timestamp %i", async savedAt => {
    const local = { ...record("duplicate", 5_000), title: "local-title", entries: [{ kind: "user" as const, text: "unsynced-local" }] };
    await put(local); await put(record("local-control", 100));
    respond = async () => json([wire(record("duplicate", savedAt))]);
    const { root, onOpen } = open(); await settled();
    expect(rows(root)).toHaveLength(2); expect(rows(root)[0]!.textContent).toContain(local.title);
    click(root); await settled();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(local); expect(await read(local.id)).toEqual(local);
    expect(requests).toEqual([]);
  });

  it.each([1_000, 5_000, 9_000])("explicit recovery replaces only unchanged older local (remote=%i)", async savedAt => {
    const local = record("duplicate", 5_000), remote = { ...record("duplicate", savedAt), title: "remote-title" };
    await put(local); respond = async () => json([wire(remote)]);
    const { root, onOpen } = open(); await settled(); click(root, "ai-history-recover"); await settled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(await read(local.id)).toMatchObject(savedAt > local.savedAt ? remote : local);
    click(root); await settled(); expect(onOpen).toHaveBeenCalledExactlyOnceWith(await read(local.id));
    expect(requests).toHaveLength(1);
  });

  it.each([false, true])("shows recovery failure while keeping usable local history (local=%s)", async hasLocal => {
    if (hasLocal) await put(record("local-control"));
    respond = async () => new Response("offline", { status: 503 });
    const { root, onOpen } = open(); await settled(); click(root, "ai-history-recover"); await settled();
    expect(recoveryState(root)).toBe("error"); expect(rows(root)).toHaveLength(hasLocal ? 1 : 0);
    expect(onOpen).not.toHaveBeenCalled();
    if (hasLocal) { click(root); await settled(); expect(onOpen).toHaveBeenCalledExactlyOnceWith(record("local-control")); }
  });

  it.each(["project_context_key", "project_id", "entries_json", "saved_at", "conversation_id"])("rejects invalid recovered %s without adoption", async field => {
    respond = async () => json([{ ...wire(), [field]: field === "conversation_id" ? "" : "invalid" }]);
    const { root, onOpen } = open(); await settled(); click(root, "ai-history-recover"); await settled();
    expect(recoveryState(root)).toBe("incomplete"); expect(rows(root)).toHaveLength(0);
    expect(onOpen).not.toHaveBeenCalled(); expect(await readAllAiRecords(recordsStore)).toEqual([]);
    expect(requests).toHaveLength(1);
  });

  it.each([{}, [null]])("malformed recovery is a visible failure, not successful empty history (%j)", async payload => {
    respond = async () => json(payload);
    const { root } = open(); await settled(); click(root, "ai-history-recover"); await settled();
    expect(recoveryState(root)).toBe("error");
  });

  it.each(["valid", "503", "invalid"])("refreshes local title, preview, deletion and entries after recovery %s", async outcome => {
    const started = deferred<void>(), response = deferred<Response>();
    respond = () => { started.resolve(); return response.promise; };
    const { root, onOpen } = open(); await settled(); click(root, "ai-history-recover"); await started.promise;
    const local = { ...record("remote-only", 1), title: "new-local-title", entries: [{ kind: "user" as const, text: "new-unsynced-local-content" }] };
    await put(local);
    response.resolve(outcome === "503" ? new Response("offline", { status: 503 }) : json(outcome === "invalid" ? {} : [wire()]));
    await settled();
    expect(await read()).toEqual(local); expect(rows(root)).toHaveLength(1);
    expect(rows(root)[0]!.textContent).toContain(local.title);
    expect(findByTestId(root, "ai-history-preview")?.textContent).toBe(local.entries[0]!.text);
    expect(findByTestId(root, "ai-history-delete")).not.toBeNull();
    expect(findByTestId(root, "ai-history-empty")).toBeNull();
    expect(recoveryState(root)).toBe(outcome === "valid" ? "ok" : "error");
    expect(onOpen).not.toHaveBeenCalled(); click(root); await settled();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(local); expect(requests).toHaveLength(1);
  });

  it("excludes foreign-local history without deleting the foreign stored record", async () => {
    const foreign = { ...record("foreign-local"), projectContextKey: "remote:other" };
    await put(foreign);
    const { root, onOpen } = open(); await settled();
    expect(rows(root)).toHaveLength(0); expect(onOpen).not.toHaveBeenCalled();
    expect(await conversations.loadConversationForScope(foreign.id, "remote:other")).toEqual(foreign);
    click(root, "ai-history-filter-legacy"); await settled(); expect(rows(root)).toHaveLength(0);
    expect(requests).toEqual([]);
  });

  it.each(["valid", "503", "invalid"])("keeps a foreign ID collision introduced during recovery %s", async outcome => {
    const started = deferred<void>(), response = deferred<Response>();
    respond = () => { started.resolve(); return response.promise; };
    const { root, onOpen } = open(); await settled(); click(root, "ai-history-recover"); await started.promise;
    const foreign = { ...record(), projectContextKey: "remote:other" }; await put(foreign);
    response.resolve(outcome === "503" ? new Response("offline", { status: 503 }) : json(outcome === "invalid" ? {} : [wire()]));
    await settled(); expect(onOpen).not.toHaveBeenCalled(); expect(rows(root)).toHaveLength(0);
    expect(await read()).toEqual(foreign);
    expect(recoveryState(root)).toBe(outcome === "valid" ? "ok" : "error");
  });

  it.each(["dismiss", "scope", "replace", "newer-selection", "legacy-roundtrip"])("ignores pending local Open after %s", async action => {
    await put(record()); await put(record("local-control", 100));
    const started = deferred<void>(), release = deferred<void>(); let current = true;
    const native = conversations.loadConversationForScope;
    vi.spyOn(conversations, "loadConversationForScope").mockImplementation(async (id, key) => {
      if (id === "remote-only") { started.resolve(); await release.promise; }
      return native(id, key);
    });
    const { root, onOpen } = open(vi.fn(), () => current); await settled(); click(root); await started.promise;
    if (action === "dismiss") closeAiConversationHistoryModal();
    if (action === "scope") current = false;
    if (action === "replace") open();
    if (action === "newer-selection") click(root, "ai-history-open", 1);
    if (action === "legacy-roundtrip") { click(root, "ai-history-filter-legacy"); click(root, "ai-history-filter-all"); }
    release.resolve(); await settled();
    if (action === "newer-selection") expect(onOpen).toHaveBeenCalledExactlyOnceWith(record("local-control", 100));
    else expect(onOpen).not.toHaveBeenCalled();
    if (action === "legacy-roundtrip") { click(root); await settled(); expect(onOpen).toHaveBeenCalledExactlyOnceWith(record()); }
    expect(requests).toEqual([]);
  });

  it.each([false, true])("newer local selection retires an earlier read even when the earlier read settles first (failure=%s)", async failure => {
    await put(record()); await put(record("local-control", 100));
    const entered = [deferred<void>(), deferred<void>()], release = [deferred<void>(), deferred<void>()];
    const native = conversations.loadConversationForScope;
    const loads = vi.spyOn(conversations, "loadConversationForScope").mockImplementation(async (id, key) => {
      const index = id === "remote-only" ? 0 : 1;
      const retained = await native(id, key);
      entered[index]!.resolve(); await release[index]!.promise;
      if (index === 0 && failure) throw new Error("Retired read failure");
      return retained;
    });
    const { root, onOpen } = open(); await settled();
    try {
      click(root); await entered[0]!.promise;
      click(root, "ai-history-open", 1); await entered[1]!.promise;
      const first = loads.mock.results[0]!.value;
      const completed = first.then(() => undefined, () => undefined);
      release[0]!.resolve(); await completed;
      expect(onOpen).not.toHaveBeenCalled();
      expect(recoveryState(root)).toBe("idle");
      release[1]!.resolve(); await settled();
      expect(onOpen).toHaveBeenCalledExactlyOnceWith(record("local-control", 100));
    } finally { release[0]!.resolve(); release[1]!.resolve(); await settled(); }
  });

  it.each(["dismiss", "scope", "replace", "legacy-roundtrip"])("refuses pending recovery admission and painting after %s", async action => {
    const started = deferred<void>(), response = deferred<Response>(); let current = true;
    respond = () => { started.resolve(); return response.promise; };
    const { root, onOpen } = open(vi.fn(), () => current); await settled(); click(root, "ai-history-recover"); await started.promise;
    if (action === "dismiss") closeAiConversationHistoryModal();
    if (action === "scope") current = false;
    const replacement = action === "replace" ? open().root : null;
    if (action === "legacy-roundtrip") { click(root, "ai-history-filter-legacy"); click(root, "ai-history-filter-all"); }
    response.resolve(json([wire()])); await settled();
    expect(onOpen).not.toHaveBeenCalled(); expect(await readAllAiRecords(recordsStore)).toEqual([]);
    if (replacement) expect(rows(replacement)).toHaveLength(0);
    else expect(rows(root)).toHaveLength(0);
  });

  it("does not contact remote history while browsing local or differently configured scopes", async () => {
    for (const key of ["local:title::map", "remote:another-project"]) { const { root } = open(vi.fn(), () => true, key); await settled(); expect(rows(root)).toHaveLength(0); }
    expect(requests).toEqual([]); expect(await conversations.listConversations()).toEqual([]);
  });

  it("restores through shipped clock, Recover, All and Open without reconstructing a private session", async () => {
    const registration = vi.spyOn(bridge, "registerAiAssistantBridge");
    vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "history-project" });
    // Outgoing transcript checkpoints/mirroring are preserved; only their outbound boundary is stubbed.
    vi.spyOn(sync, "recordSupabaseConversation").mockResolvedValue({ kind: "not-configured" });
    const panel = renderAiChatPanel() as unknown as FakeElement;
    panelCleanup = async () => { teardownAiChatPanel(); await whenAiChatPanelSettled(); };
    await whenAiChatPanelSettled(); click(panel, "ai-open-conversations"); await settled();
    const modal = findByTestId(document.body as unknown as FakeElement, "ai-history-modal")!;
    expect(requests).toEqual([]); click(modal, "ai-history-recover"); await settled();
    click(modal, "ai-history-filter-all"); await settled(); expect(rows(modal)).toHaveLength(1);
    click(modal); await settled();
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("answer-remote-only");
    expect(bridge.getAiAssistantAudit().map(({ kind, text }) => ({ kind, text }))).toEqual(record().entries);
    expect(registration).toHaveBeenCalledOnce(); expect(registration.mock.calls[0]![0].getHarness()).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it.each(["scope", "new-chat", "teardown"].flatMap(action => ["open", "recover"].map(retrieval => ({ action, retrieval }))))(
    "real panel refuses pending $retrieval after $action", async ({ action, retrieval }) => {
    const identity = vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "history-project" });
    vi.spyOn(sync, "recordSupabaseConversation").mockResolvedValue({ kind: "not-configured" });
    const started = deferred<void>(), response = deferred<Response>();
    respond = () => { started.resolve(); return response.promise; };
    const panel = renderAiChatPanel() as unknown as FakeElement;
    panelCleanup = async () => { teardownAiChatPanel(); await whenAiChatPanelSettled(); };
    await whenAiChatPanelSettled();
    if (retrieval === "open") {
      await put(record());
      const native = conversations.loadConversationForScope;
      vi.spyOn(conversations, "loadConversationForScope").mockImplementation(async (id, key) => {
        started.resolve(); await response.promise; return native(id, key);
      });
    }
    click(panel, "ai-open-conversations"); await settled();
    const modal = findByTestId(document.body as unknown as FakeElement, "ai-history-modal")!;
    if (retrieval === "open") { click(modal, "ai-history-filter-all"); await settled(); }
    click(modal, retrieval === "open" ? "ai-history-open" : "ai-history-recover"); await started.promise;
    if (action === "scope") identity.mockReturnValue({ kind: "remote", id: "other-project" });
    if (action === "new-chat") click(panel, "ai-new-chat");
    if (action === "teardown") teardownAiChatPanel();
    response.resolve(json([wire()])); await settled(); await whenAiChatPanelSettled();
    expect(bridge.getAiAssistantAudit()).toEqual([]);
    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").not.toContain("answer-remote-only");
    expect(await readAllAiRecords(recordsStore)).toEqual(retrieval === "open" ? [record()] : []);
    expect(requests).toHaveLength(retrieval === "open" ? 0 : 1);
  });
});
