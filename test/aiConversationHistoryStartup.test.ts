import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_RECORD_STORES, aiRecordBackendKind, resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import * as conversations from "@/ai/conversationStore";
import { closeAiConversationHistoryModal, openAiConversationHistoryModal, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// Observe the real tracker without replacing its scheduling or settlement behavior.
// This lets startup finish while Recover's GET is still deliberately pending.
const observed = vi.hoisted(() => ({ work: [] as Promise<unknown>[] }));
vi.mock("@/util/pendingWork", async importOriginal => {
  const original = await importOriginal<typeof import("@/util/pendingWork")>();
  return { ...original, createPendingWorkTracker: () => {
    const tracker = original.createPendingWorkTracker();
    return { ...tracker, track<T>(work: Promise<T>) { observed.work.push(work); return tracker.track(work); } };
  } };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(signal: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([signal, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("History signal did not settle")), 5_000);
    })]);
  } finally { clearTimeout(timer); }
}
const scope = "remote:history-startup-fixture";
const entries = [
  { kind: "user" as const, text: "startup-recover-request", context: { mapId: "start", mapName: "Start", mapWidth: 10, mapHeight: 10 } },
  { kind: "assistant" as const, text: "startup-recover-answer" },
];
let restoreDom: () => void;
const settled = whenAiConversationHistoryModalSettled;
function open(isCurrent = () => true) {
  const onOpen = vi.fn();
  const root = openAiConversationHistoryModal({ scopeKey: scope, currentConversationId: "active",
    currentMapId: "start", knownMaps: [{ id: "start", name: "Start" }], isCurrent, onOpen }) as unknown as FakeElement;
  return { root, onOpen, startup: observed.work.at(-1)! };
}
function holdCatalog() {
  const entered = deferred<void>(), release = deferred<void>();
  const native = conversations.queryConversationArchive;
  const query = vi.spyOn(conversations, "queryConversationArchive").mockImplementationOnce(async options => {
    const result = await native(options); // Real archive read and IndexedDB transaction finish first.
    entered.resolve();
    await release.promise;
    return result;
  });
  return { entered, release, query };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  resetAiRecordDbForTest();
  vi.stubEnv("VITE_LEGACY_DB_URL", "https://history.invalid");
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "fixture-only");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "history-startup-fixture");
  vi.stubEnv("VITE_LEGACY_DB_USE_PROXY", "false");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
  observed.work.length = 0;
});
afterEach(async () => {
  closeAiConversationHistoryModal();
  await bounded(settled());
  resetAiRecordDbForTest(); restoreDom(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("history startup ownership", () => {
  it("finishes normal startup and lists the current map without recovering or opening", async () => {
    await writeAiRecords(AI_RECORD_STORES.conversations, [{ id: "local", title: "local", model: "fixture", savedAt: 1,
      projectContextKey: scope, entries }]);
    const query = vi.spyOn(conversations, "queryConversationArchive");
    const { root, onOpen, startup } = open();
    await bounded(startup);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]![0]).toMatchObject({ projectContextKey: scope, mapId: "start" });
    expect(root.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(1);
    expect(findByTestId(root, "ai-history-recover-status")?.dataset.state).toBe("idle");
    expect(onOpen).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["close", "owner"])("does not start a list query after startup loses %s ownership", async action => {
    const catalog = holdCatalog(); let current = true;
    const { startup, onOpen } = open(() => current);
    try {
      await bounded(catalog.entered.promise);
      if (action === "close") closeAiConversationHistoryModal(); else current = false;
      catalog.release.resolve(); await bounded(startup);
      expect(catalog.query).toHaveBeenCalledTimes(1);
      expect(onOpen).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    } finally { catalog.release.resolve(); await bounded(settled()); }
  });
});
