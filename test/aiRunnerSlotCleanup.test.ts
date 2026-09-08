import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession, type TurnResult } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview, getAgentGhostPreviewState } from "@/editor/agentGhostPreview";
import * as activityLog from "@/ai/activityLog";
import { bounded, deferred, epochRunner } from "./aiEpochFixture";
import { fixedDeclarer } from "./intentFixture";
import { installFakeDom } from "./fakeDom";

vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 } satisfies ReturnType<typeof defaultAiConfig>;
const final: ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
let restoreDom: (() => void) | undefined;
beforeEach(() => {
  // Commit-history transport has its own configuration; store persistence flags alone do not isolate it.
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  restoreDom = installFakeDom();
  vi.spyOn(activityLog, "recordAiActivity").mockImplementation(async entry => activityLog.buildAiActivityLogRecord(entry));
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject()); resetMapEditHistory();
});
afterEach(async () => {
  await store.flush(); clearAgentBlueprint(); clearAgentGhostPreview(); resetMapEditHistory();
  resetIntentDeclarationCache(); restoreDom?.(); vi.restoreAllMocks(); vi.unstubAllEnvs();
});

it.each(["operation", "session"])("releases its own runner slot after losing %s authority, then accepts the next send in the same test", async replacement => {
  const enteredB = deferred<void>(); const releaseB = deferred<ChatResult>();
  let replacing = false;
  let b: Promise<TurnResult> | undefined;
  let next = false;
  const chat = async () => {
    if (replacing && !next) { enteredB.resolve(); return releaseB.promise; }
    return final;
  };
  const aSession = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), chat });
  const bSession = replacement === "operation" ? aSession
    : new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), chat });
  const f = epochRunner(aSession);
  const end = vi.spyOn(f.surface, "endTurnProgress");
  vi.spyOn(f.surface, "refreshAbortButton").mockImplementation(() => { f.surface.sendButton.disabled = f.surface.turnBusy; });
  const proveA = vi.spyOn(aSession, "proveAppliedRevision");
  const a = f.runner.executeTurn(aSession, "A", (onEvent, signal) => aSession.sendUserMessage("A", event => {
    onEvent(event);
    if (event.type !== "run_outcome" || replacing) return;
    replacing = true;
    f.surface.controller.session = bSession;
    b = bSession.sendUserMessage("B", undefined, undefined, { goalAction: "new-goal" });
  }, signal));
  try {
    await bounded(enteredB.promise);
    const ownerB = bSession.getRunOperation();
    const beforeB = structuredClone(bSession.getHarnessSnapshot());
    await bounded(a);
    const released = { busy: f.surface.turnBusy, controller: f.surface.activeAbortController,
      sendDisabled: f.surface.sendButton.disabled, endCalls: end.mock.calls.length,
      settleCalls: vi.mocked(f.deps.settleWorkPlanTurn).mock.calls.length };
    expect(ownerB.signal.aborted).toBe(false);
    expect(bSession.getHarnessSnapshot()).toEqual(beforeB);
    expect(f.deps.applyProposal).not.toHaveBeenCalled();
    expect(proveA).not.toHaveBeenCalled();
    releaseB.resolve(final);
    if (!b) throw new Error("Callback did not start B");
    expect((await bounded(b)).stoppedReason).toBe("final");
    next = true;
    const nextExec = vi.fn((onEvent: Parameters<AssistantSession["sendUserMessage"]>[1], signal: AbortSignal) =>
      bSession.sendUserMessage("C", onEvent, signal, { goalAction: "new-goal" }));
    await bounded(f.runner.executeTurn(bSession, "C", nextExec));
    expect.soft(released).toEqual({ busy: false, controller: null, sendDisabled: false, endCalls: 1, settleCalls: 1 });
    expect(nextExec).toHaveBeenCalledTimes(1);
    expect(f.surface.turnBusy).toBe(false);
    expect(f.surface.activeAbortController).toBeNull();
  } finally { releaseB.resolve(final); await bounded(a); if (b) await bounded(b); }
});

it("does not release a real replacement runner's slot, progress or ghost when A completes late", async () => {
  const enteredA = deferred<void>(); const releaseA = deferred<ChatResult>();
  const enteredB = deferred<void>(); const releaseB = deferred<void>();
  const aSession = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: async () => { enteredA.resolve(); return releaseA.promise; } });
  let bRound = 0;
  const bSession = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    yieldToUi: async () => { enteredB.resolve(); await releaseB.promise; },
    chat: async () => bRound++ === 0 ? { message: { role: "assistant", content: null, tool_calls: [{ id: "B_read", type: "function",
      function: { name: "get_project_summary", arguments: "{}" } }] }, finishReason: "tool_calls" } : final });
  const f = epochRunner(aSession);
  const end = vi.spyOn(f.surface, "endTurnProgress");
  vi.spyOn(f.surface, "refreshAbortButton").mockImplementation(() => { f.surface.sendButton.disabled = f.surface.turnBusy; });
  const a = f.runner.executeTurn(aSession, "A", (onEvent, signal) => aSession.sendUserMessage("A", onEvent, signal));
  let b: Promise<void> | undefined;
  try {
    await bounded(enteredA.promise);
    // The host detaches A's slot, as New Conversation does, and accepts B before A settles.
    f.surface.activeAbortController?.abort();
    f.surface.activeAbortController = null;
    f.surface.turnBusy = false;
    f.surface.controller.session = bSession;
    b = f.runner.executeTurn(bSession, "B", (onEvent, signal) => bSession.sendUserMessage("B", onEvent, signal));
    const controllerB = f.surface.activeAbortController;
    await bounded(enteredB.promise);
    const snapshot = structuredClone(bSession.getHarnessSnapshot());
    await bounded(a);
    releaseA.resolve(final); await releaseA.promise;
    expect(f.surface.activeAbortController).toBe(controllerB);
    expect(controllerB).toMatchObject({ signal: { aborted: false } });
    expect(f.surface.turnBusy).toBe(true);
    expect(f.surface.sendButton.disabled).toBe(true);
    expect(end).not.toHaveBeenCalled();
    expect(f.deps.settleWorkPlanTurn).not.toHaveBeenCalled();
    expect(getAgentGhostPreviewState().runningToolName).toBe("get_project_summary");
    expect(bSession.getHarnessSnapshot()).toEqual(snapshot);
    releaseB.resolve(); await bounded(b);
    expect(f.surface.turnBusy).toBe(false);
    expect(f.surface.activeAbortController).toBeNull();
  } finally { releaseA.resolve(final); releaseB.resolve(); await bounded(a); if (b) await bounded(b); }
});
