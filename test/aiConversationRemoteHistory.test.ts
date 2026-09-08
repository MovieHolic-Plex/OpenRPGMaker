import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_RECORD_STORES, readAllAiRecords, resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { listConversations, loadConversation, type ConversationRecord } from "@/ai/conversationStore";
import {
  closeAiConversationHistoryModal, openAiConversationHistoryModal, whenAiConversationHistoryModalSettled,
} from "@/editor/panels/aiConversationHistoryModal";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import * as bridge from "@/editor/aiAssistantBridge";
import { store } from "@/project/store";
import * as sync from "@/project/supabaseProjectSync";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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
function wire(value: ConversationRecord = record()): Record<string, unknown> {
  return { conversation_id: value.id, project_id: "history-project", project_context_key: value.projectContextKey,
    title: value.title, model: value.model, saved_at: new Date(value.savedAt).toISOString(), entries_json: value.entries };
}
function json(value: unknown): Response { return new Response(JSON.stringify(value), { status: 200 }); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
// The exact fetch-start and modal pending-work signals own all async assertions;
// Vitest's bounded test timeout reports a missing signal without timing retries.
function open(onOpen = vi.fn(), isCurrent = () => true) {
  const root = openAiConversationHistoryModal({ scopeKey: scope, currentConversationId: "active", onOpen, isCurrent });
  return { root: root as unknown as FakeElement, onOpen };
}
function click(root: FakeElement, id = "ai-history-open", index = 0): void {
  const node = root.querySelectorAll(`[data-testid=${id}]`)[index];
  expect(node, id).toBeDefined();
  (node as unknown as HTMLElement).click();
}
function rows(root: FakeElement) { return root.querySelectorAll("[data-testid=ai-history-row]"); }

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
    const url = new URL(String(input));
    requests.push(url);
    return respond(url);
  }));
});

afterEach(async () => {
  closeAiConversationHistoryModal();
  await whenAiConversationHistoryModalSettled();
  await panelCleanup?.();
  panelCleanup = undefined;
  // Assert outside fetch: a product catch must not swallow a failed mock assertion.
  for (const [input, init] of vi.mocked(fetch).mock.calls) {
    const url = new URL(String(input));
    expect(init?.method ?? "GET").toBe("GET");
    expect(url.origin).toBe("https://history.invalid");
    expect(url.pathname).toBe("/rest/v1/ai_conversations");
    expect(new Headers(init?.headers).get("Accept-Profile")).toBe("rpg_zzu");
  }
  resetAiRecordDbForTest();
  restoreDom();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public history UI with real conversation store and remote transport", () => {
  it("shows and opens a remote-only record without caching, concatenating or writing it", async () => {
    respond = async (url) => json(url.searchParams.has("conversation_id") ? [wire()] : [wire(), wire()]);
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    expect(rows(root)).toHaveLength(1);
    expect(findByTestId(root, "ai-history-delete")).toBeNull();
    click(root);
    await whenAiConversationHistoryModalSettled();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(record());
    expect(root.parentElement).toBeNull();
    expect(await readAllAiRecords(recordsStore)).toEqual([]);
    expect(requests).toHaveLength(2);
    for (const url of requests) {
      expect(url.searchParams.get("project_id")).toBe("eq.history-project");
      expect(url.searchParams.get("project_context_key")).toBe(`eq.${scope}`);
    }
    expect(requests[0]!.searchParams.get("select")).not.toContain("entries_json");
    expect(requests[1]!.searchParams.get("conversation_id")).toBe("eq.remote-only");
  });

  it.each([1_000, 9_000])("keeps the local duplicate authoritative even with remote timestamp %i", async (savedAt) => {
    const local = { ...record("duplicate", 5_000), title: "local-title", entries: [{ kind: "user" as const, text: "unsynced-local" }] };
    await writeAiRecords(recordsStore, [local, record("local-control", 100)]);
    respond = async () => json([wire(record("duplicate", savedAt)), wire(record("duplicate", savedAt))]);
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    expect(rows(root)).toHaveLength(2);
    expect(rows(root)[0]!.textContent).toContain(local.title);
    click(root);
    await whenAiConversationHistoryModalSettled();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(local);
    expect(await loadConversation(local.id)).toEqual(local);
    expect(requests).toHaveLength(1);
  });

  it.each([false, true])("reports a remote failure without losing local history (local=%s)", async (hasLocal) => {
    if (hasLocal) await writeAiRecords(recordsStore, [record("local-control")]);
    respond = async () => new Response("offline", { status: 503 });
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    expect(findByTestId(root, "ai-history-error")?.getAttribute("role")).toBe("alert");
    expect(findByTestId(root, "ai-history-empty")).toBeNull();
    expect(rows(root)).toHaveLength(hasLocal ? 1 : 0);
    if (hasLocal) {
      click(root);
      await whenAiConversationHistoryModalSettled();
      expect(onOpen).toHaveBeenCalledExactlyOnceWith(record("local-control"));
    }
  });

  it.each(["project_context_key", "project_id"])("refuses list rows with a foreign %s", async (field) => {
    respond = async () => json([{ ...wire(), [field]: "foreign" }]);
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    expect(requests).toHaveLength(1);
    expect(rows(root)).toHaveLength(0);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it.each(["project_context_key", "project_id", "conversation_id", "entries_json"])("refuses a selected record with invalid %s", async (field) => {
    respond = async (url) => json([url.searchParams.has("conversation_id") ? { ...wire(), [field]: "invalid" } : wire()]);
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    click(root);
    await whenAiConversationHistoryModalSettled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(findByTestId(root, "ai-history-error")).not.toBeNull();
    expect(root.parentElement).not.toBeNull();
  });

  it("reports remote load failure while keeping the list available", async () => {
    respond = async (url) => url.searchParams.has("conversation_id") ? new Response("offline", { status: 503 }) : json([wire()]);
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    click(root);
    await whenAiConversationHistoryModalSettled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(rows(root)).toHaveLength(1);
    expect(findByTestId(root, "ai-history-error")).not.toBeNull();
  });

  it.each(["dismiss", "scope", "newer-selection"])("ignores a pending open after %s", async (action) => {
    const started = deferred<void>();
    const response = deferred<Response>();
    let current = true;
    respond = (url) => {
      if (url.searchParams.has("conversation_id")) { started.resolve(); return response.promise; }
      return Promise.resolve(json([wire()]));
    };
    await writeAiRecords(recordsStore, [record("local-control", 100)]);
    const { root, onOpen } = open(vi.fn(), () => current);
    await whenAiConversationHistoryModalSettled();
    expect(rows(root)).toHaveLength(2);
    click(root);
    await started.promise;
    if (action === "dismiss") closeAiConversationHistoryModal();
    if (action === "scope") current = false;
    if (action === "newer-selection") click(root, "ai-history-open", 1);
    response.resolve(json([wire()]));
    await whenAiConversationHistoryModalSettled();
    if (action === "newer-selection") expect(onOpen).toHaveBeenCalledExactlyOnceWith(record("local-control", 100));
    else expect(onOpen).not.toHaveBeenCalled();
  });

  it.each(["valid", "503", "invalid"])("uses a local record created during the remote load (%s) instead of overwriting unsynced content", async (result) => {
    const warning = vi.spyOn(console, "warn");
    const started = deferred<void>();
    const response = deferred<Response>();
    respond = (url) => {
      if (url.searchParams.has("conversation_id")) { started.resolve(); return response.promise; }
      return Promise.resolve(json([wire()]));
    };
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    click(root);
    await started.promise;
    const local = { ...record(), entries: [{ kind: "user" as const, text: "new-local-content" }] };
    await writeAiRecords(recordsStore, [local]);
    response.resolve(result === "503" ? new Response("offline", { status: 503 }) :
      json([result === "invalid" ? { ...wire(), entries_json: "invalid" } : wire()]));
    await whenAiConversationHistoryModalSettled();
    expect(await loadConversation(local.id)).toEqual(local);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(local);
    expect(root.parentElement).toBeNull();
    expect(requests).toHaveLength(2);
    if (result === "valid") expect(warning).not.toHaveBeenCalled();
    else expect(warning).toHaveBeenCalledWith(expect.any(String), expect.any(sync.SupabaseProjectSyncError));
  });

  it.each([200, 503])("refreshes local list precedence and affordances after a pending remote list settles (%i)", async (status) => {
    const started = deferred<void>();
    const response = deferred<Response>();
    respond = () => { started.resolve(); return response.promise; };
    const { root, onOpen } = open();
    await started.promise;
    const local = { ...record("remote-only", 9_000), title: "new-local-title",
      entries: [{ kind: "user" as const, text: "new-unsynced-local-content" }] };
    await writeAiRecords(recordsStore, [local]);
    response.resolve(status === 503 ? new Response("offline", { status }) : json([wire(), wire()]));
    await whenAiConversationHistoryModalSettled();
    expect(await loadConversation(local.id)).toEqual(local);
    expect(rows(root)).toHaveLength(1);
    expect(rows(root)[0]!.textContent).toContain(local.title);
    expect(findByTestId(root, "ai-history-preview")?.textContent).toBe(local.entries[0]!.text);
    expect(findByTestId(root, "ai-history-delete")).not.toBeNull();
    expect(findByTestId(root, "ai-history-empty")).toBeNull();
    if (status === 503) expect(findByTestId(root, "ai-history-error")?.getAttribute("role")).toBe("alert");
    else expect(findByTestId(root, "ai-history-error")).toBeNull();
    click(root);
    await whenAiConversationHistoryModalSettled();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(local);
    expect(requests).toHaveLength(1);
  });

  it.each([{}, [null]])("reports malformed remote lists rather than successful empty history (%j)", async (payload) => {
    respond = async () => json(payload);
    const { root } = open();
    await whenAiConversationHistoryModalSettled();
    expect(findByTestId(root, "ai-history-error")).not.toBeNull();
    expect(findByTestId(root, "ai-history-empty")).toBeNull();
  });

  it("keeps the established explicit foreign-local open policy", async () => {
    const local = { ...record("foreign-local"), projectContextKey: "remote:other" };
    await writeAiRecords(recordsStore, [local]);
    respond = async () => json([]);
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    click(root);
    await whenAiConversationHistoryModalSettled();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(local);
    expect(requests).toHaveLength(1);
  });

  it("does not let an old list response repaint a replacement dialog", async () => {
    const started = deferred<void>();
    const response = deferred<Response>();
    respond = () => { started.resolve(); return response.promise; };
    const old = open();
    await started.promise;
    const replacement = openAiConversationHistoryModal({ scopeKey: "local:other::map", currentConversationId: "active", onOpen: vi.fn() });
    response.resolve(json([wire()]));
    await whenAiConversationHistoryModalSettled();
    expect(old.root.parentElement).toBeNull();
    expect(rows(old.root)).toHaveLength(0);
    expect(rows(replacement as unknown as FakeElement)).toHaveLength(0);
  });

  it.each(["valid", "503", "invalid"])("refuses a foreign local collision arriving during remote open (%s)", async (result) => {
    const started = deferred<void>();
    const response = deferred<Response>();
    respond = (url) => {
      if (url.searchParams.has("conversation_id")) { started.resolve(); return response.promise; }
      return Promise.resolve(json([wire()]));
    };
    const { root, onOpen } = open();
    await whenAiConversationHistoryModalSettled();
    click(root);
    await started.promise;
    const foreign = { ...record(), projectContextKey: "remote:other" };
    await writeAiRecords(recordsStore, [foreign]);
    response.resolve(result === "503" ? new Response("offline", { status: 503 }) :
      json([result === "invalid" ? { ...wire(), entries_json: "invalid" } : wire()]));
    await whenAiConversationHistoryModalSettled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(findByTestId(root, "ai-history-error")).not.toBeNull();
    expect(await loadConversation(foreign.id)).toEqual(foreign);
  });

  it("does not read remote history for a local scope or mismatched configured project", async () => {
    for (const scopeKey of ["local:title::map", "remote:another-project"]) {
      const root = openAiConversationHistoryModal({ scopeKey, currentConversationId: "active", onOpen: vi.fn() });
      await whenAiConversationHistoryModalSettled();
      expect(rows(root as unknown as FakeElement)).toHaveLength(0);
    }
    expect(requests).toEqual([]);
    expect(await listConversations()).toEqual([]);
  });

  it("restores through the shipped panel history button without reconstructing a private session", async () => {
    const registration = vi.spyOn(bridge, "registerAiAssistantBridge");
    vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "history-project" });
    // Teardown normally mirrors the restored audit; stub only that outbound boundary.
    vi.spyOn(sync, "recordSupabaseConversation").mockResolvedValue({ kind: "not-configured" });
    const panel = renderAiChatPanel() as unknown as FakeElement;
    panelCleanup = async () => { teardownAiChatPanel(); await whenAiChatPanelSettled(); };
    await whenAiChatPanelSettled();
    click(panel, "ai-open-conversations");
    await whenAiConversationHistoryModalSettled();
    const modal = findByTestId(document.body as unknown as FakeElement, "ai-history-modal")!;
    expect(rows(modal)).toHaveLength(1);
    click(modal);
    await whenAiConversationHistoryModalSettled();
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("answer-remote-only");
    expect(bridge.getAiAssistantAudit().map(({ kind, text }) => ({ kind, text }))).toEqual(record().entries);
    expect(registration).toHaveBeenCalledOnce();
    expect(registration.mock.calls[0]![0].getHarness()).toBeNull();
    expect(requests).toHaveLength(2);
  });

  it.each(["scope", "new-chat", "teardown"])("the real panel refuses a pending remote open after %s", async (action) => {
    const identity = vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "history-project" });
    vi.spyOn(sync, "recordSupabaseConversation").mockResolvedValue({ kind: "not-configured" });
    const started = deferred<void>();
    const response = deferred<Response>();
    respond = (url) => {
      if (url.searchParams.has("conversation_id")) { started.resolve(); return response.promise; }
      return Promise.resolve(json([wire()]));
    };
    const panel = renderAiChatPanel() as unknown as FakeElement;
    panelCleanup = async () => { teardownAiChatPanel(); await whenAiChatPanelSettled(); };
    await whenAiChatPanelSettled();
    click(panel, "ai-open-conversations");
    await whenAiConversationHistoryModalSettled();
    const modal = findByTestId(document.body as unknown as FakeElement, "ai-history-modal")!;
    expect(rows(modal)).toHaveLength(1);
    click(modal);
    await started.promise;
    if (action === "scope") identity.mockReturnValue({ kind: "remote", id: "other-project" });
    if (action === "new-chat") click(panel, "ai-new-chat");
    if (action === "teardown") teardownAiChatPanel();
    response.resolve(json([wire()]));
    await whenAiConversationHistoryModalSettled();
    await whenAiChatPanelSettled();
    expect(bridge.getAiAssistantAudit()).toEqual([]);
    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").not.toContain("answer-remote-only");
  });
});
