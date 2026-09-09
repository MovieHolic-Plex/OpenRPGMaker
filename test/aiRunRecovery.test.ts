import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { AI_RECORD_STORES, resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import * as activity from "@/ai/activityLog";
import * as sync from "@/project/supabaseProjectSync";
import { store } from "@/project/store";
import { getAiAssistantAudit } from "@/editor/aiAssistantBridge";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { installFakeDom } from "./fakeDom";
import { bounded } from "./aiEpochFixture";

let restoreDom: (() => void) | undefined;
afterEach(async () => {
  teardownAiChatPanel();
  await bounded(whenAiChatPanelSettled());
  resetAiRecordDbForTest();
  restoreDom?.(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it.each(["indexeddb", "memory"] as const)("opens interrupted legacy history without admitting execution on %s", async backend => {
  restoreDom = installFakeDom();
  vi.stubGlobal("indexedDB", backend === "indexeddb" ? new IDBFactory() : undefined);
  resetAiRecordDbForTest();
  const values = new Map([[AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat" })]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "boot-recovery" });
  vi.spyOn(sync, "recordSupabaseConversation").mockResolvedValue({ kind: "not-configured" });
  vi.spyOn(activity, "recordAiActivity").mockImplementation(async entry => activity.buildAiActivityLogRecord(entry));
  // Observe admission at the actual session boundary. Fail closed if old boot code enters;
  // this test asserts admission, not tool execution or successful crash reconciliation.
  const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockRejectedValue(new Error("Unexpected boot admission"));
  const entries = [{ kind: "user" as const, text: "create-interrupted-fixture" }];
  await writeAiRecords(AI_RECORD_STORES.conversations, [{ id: "interrupted", title: "fixture", model: "fixture",
    savedAt: 1, projectContextKey: "remote:boot-recovery", entries }]);
  const before = structuredClone(store.getCurrent());
  document.body.append(renderAiChatPanel());
  // Public tracker includes the exact IDB boot adoption promise, not a timing delay.
  await bounded(whenAiChatPanelSettled());
  expect(send).not.toHaveBeenCalled();
  expect(getAiAssistantAudit().filter(entry => entry.kind === "user")).toEqual(entries);
  expect(store.getCurrent()).toEqual(before);
});
