import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import * as llm from "@/ai/llmClient";
import * as adapter from "@/editor/tools/applyChangesetToStore";
import * as sync from "@/project/supabaseProjectSync";
import * as activity from "@/ai/activityLog";
import { AI_RECORD_STORES, readAllAiRecords, resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import type { RunCheckpoint } from "@/ai/runCheckpointStore";
import { checkpointContentIdentity } from "@/ai/runRecovery";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { fixedDeclarer } from "./intentFixture";
import { bounded, deferred } from "./aiEpochFixture";
import { installFakeDom } from "./fakeDom";

const host = { conversationId: "negative", projectId: "P", projectContextKey: "remote:P" };
const config = { ...llm.defaultAiConfig(), agentMode: "chat" as const, model: "fixture", liteModel: "fixture" };
const final: llm.ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
let restoreDom: () => void;
beforeEach(() => {
  restoreDom = installFakeDom(); vi.stubGlobal("indexedDB", new IDBFactory()); resetAiRecordDbForTest();
  const values = new Map([[llm.AI_CONFIG_STORAGE_KEY, JSON.stringify(config)]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubEnv("VITE_SUPABASE_URL", ""); vi.stubEnv("VITE_SUPABASE_ANON_KEY", ""); vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null }); store.replace(createBlankProject());
  vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "P" });
  vi.spyOn(sync, "recordSupabaseConversation").mockResolvedValue({ kind: "not-configured" });
  vi.spyOn(activity, "recordAiActivity").mockImplementation(async entry => activity.buildAiActivityLogRecord(entry));
});
afterEach(async () => {
  teardownAiChatPanel(); await bounded(whenAiChatPanelSettled()); await store.flush(); resetAiRecordDbForTest();
  restoreDom(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

it.each([
  ["preapply", "needs-reconciliation"], ["apply-uncertain", "needs-reconciliation"], ["saving", "needs-reconciliation"],
  ["save-unproven", "needs-reconciliation"], ["other-project", "unsupported"], ["human-edit", "needs-reconciliation"],
  ["malformed", "unsupported"], ["memory", "unsupported"], ["cancelled", "terminal"], ["awaiting-user", "terminal"],
] as const)("real panel opens %s history without automatic writes", async (scenario, expected) => {
  const entered = deferred<void>(), response = deferred<llm.ChatResult>();
  const original = structuredClone(store.getCurrent());
  const session = new AssistantSession(store.getCurrent(), { config, checkpoint: host, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: async () => { entered.resolve(); return response.promise; } });
  const running = session.sendUserMessage("Original unfinished work");
  let row: RunCheckpoint & { id: string };
  try {
    await bounded(entered.promise); await bounded(session.whenCheckpointed());
    const rows = await readAllAiRecords<RunCheckpoint & { id: string }>(AI_RECORD_STORES.runCheckpoints);
    const captured = rows[0]; if (!captured?.runtime) throw new Error("Missing actual captured runtime state");
    row = captured;
  } finally { session.retireRun(); response.resolve(final); await bounded(running); await bounded(session.whenCheckpointed()); }
  resetAiRecordDbForTest(); vi.stubGlobal("indexedDB", scenario === "memory" ? undefined : new IDBFactory()); resetAiRecordDbForTest();
  if (scenario === "preapply" || scenario === "apply-uncertain") {
    const draft = structuredClone(original); draft.meta.title = "Prepared candidate";
    row = { ...row, pending: { operationId: "candidate", stage: scenario === "preapply" ? "proposal-ready" : "applying", proposal: {
      baseContentIdentity: row.currentContentIdentity, contentIdentity: checkpointContentIdentity(draft), project: draft, calls: [],
    } } };
  }
  if (scenario === "saving") row = { ...row, pending: { operationId: "save", stage: "saving", proposal: null } };
  if (scenario === "save-unproven") row = { ...row, save: { projectId: "P", revisionId: "historical", mutationGeneration: 1, contentIdentity: "unproven" } };
  if (scenario === "other-project") row = { ...row, projectId: "other" };
  if (scenario === "cancelled" || scenario === "awaiting-user") {
    if (!row.runtime) throw new Error("Missing captured runtime");
    row = { ...row, runtime: { ...row.runtime, execution: scenario } };
  }
  await writeAiRecords(AI_RECORD_STORES.runCheckpoints, [scenario === "malformed" ? { ...row, runtime: { schemaVersion: 999 } } : row]);
  await writeAiRecords(AI_RECORD_STORES.conversations, [{ id: host.conversationId, title: "Original", model: "fixture", savedAt: 1,
    projectContextKey: host.projectContextKey, entries: [{ kind: "user", text: "Original unfinished work" }] }]);
  if (scenario === "human-edit") store.update(project => { project.meta.title = "New human title"; });
  const before = structuredClone(store.getCurrent());
  const apply = vi.spyOn(adapter, "applyProposedProject"), completion = vi.spyOn(llm, "chatCompletion"), mutations = vi.fn();
  const unsubscribe = store.subscribe(mutations);
  try {
    const panel = renderAiChatPanel(); document.body.append(panel); await bounded(whenAiChatPanelSettled());
    const notice = panel.querySelector('[data-testid="ai-run-recovery"]') as HTMLElement | null;
    expect(notice?.dataset.state).toBe(expected);
    expect(panel.querySelector('[data-testid="ai-run-continue"]')).toBeNull();
    expect(apply).not.toHaveBeenCalled(); expect(completion).not.toHaveBeenCalled(); expect(mutations).not.toHaveBeenCalled();
    expect(store.getCurrent()).toEqual(before);
  } finally { unsubscribe(); }
});
