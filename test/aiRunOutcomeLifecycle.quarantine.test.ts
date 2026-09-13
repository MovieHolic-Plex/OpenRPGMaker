import { afterEach, expect, it, vi } from "vitest";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { registerAiAssistantBridge, unregisterAiAssistantBridge, withdrawAiRequirement } from "@/editor/aiAssistantBridge";
import { fixture, plan, size, skip } from "./requiredOutcomeFixture";
import { AssistantSession } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

afterEach(async () => {
  try { await drainOutcomeFixtures(); }
  finally {
    unregisterAiAssistantBridge();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory(); resetIntentDeclarationCache();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

it.each(["tools", "tokens"] as const)("projects budget exhaustion when the %s limit ends execution", async (budget) => {
  // Given an actual title tool under the selected limit.
  const f = applyFixture();
  f.session.updateConfig({ ...defaultAiConfig(), model: "test", liteModel: "test", agentMode: "chat", apiKey: "test",
    maxToolCalls: budget === "tools" ? 1 : 4, maxTokens: budget === "tokens" ? 1 : 1024 });
  // When the real budget boundary returns a draft.
  const result = await f.run();
  // Then budgets never imply delivery or goal satisfaction.
  expect(result.runOutcome).toEqual({ execution: "budget-exhausted", goal: "unassessed", delivery: "draft" });
  expect(result.stoppedReason).toBe(budget === "tools" ? "max-tool-calls" : "token-budget");
});

it("preserves the driver user-wait decision after a tool-budget return", async () => {
  // Given an unfinished native plan and a real pending-user boundary.
  const session = new AssistantSession(createBlankProject(), {
    config: { ...defaultAiConfig(), model: "test", liteModel: "test", agentMode: "chat", maxToolCalls: 1 },
    declareIntent: fixedDeclarer({ mode: "other" }), peekPendingUserMessage: () => "User queued",
    chat: async () => ({ message: { role: "assistant", content: null, tool_calls: [{ id: "plan", type: "function", function: {
      name: "set_work_plan", arguments: JSON.stringify(plan().args),
    } }] }, finishReason: "tool_calls" }),
  });
  // When the driver yields to the user after the inner budget limit.
  const result = await session.sendUserMessage("Inspect", undefined, undefined, { autonomous: true });
  // Then the later actual decision wins without rewriting legacy stoppedReason.
  expect(result.stoppedReason).toBe("max-tool-calls");
  expect(result.runOutcome).toEqual({ execution: "awaiting-user", goal: "unassessed", delivery: "no-change" });
});

it("projects a recovered retry without inventing application", async () => {
  // Given a real transport error followed by a successful response.
  let calls = 0;
  const f = applyFixture(async () => {
    if (calls++ === 0) throw Object.assign(new Error("Transport fixture"), { name: "LlmError", status: 401 });
    return { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
  });
  const failed = await f.run();
  expect(failed.runOutcome).toEqual({ execution: "failed", goal: "unassessed", delivery: "no-change" });
  // When the public retry entry point resumes the model loop.
  const recovered = await f.session.retryLastTurn();
  // Then the new execution is final without granting delivery.
  expect(recovered.runOutcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change" });
});

it("retains both applied milestones and pending calls when a later transport fails", async () => {
  // Given two native writes separated by a real milestone application.
  const tool = (name: string, args: Record<string, unknown>): ChatResult => ({ message: { role: "assistant", content: null,
    tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
  const responses = [tool("set_work_plan", { goal: "Titles", layers: [{ title: "Titles", items: [
    { title: "First", instruction: "First title", successTools: ["set_title_screen"] },
  ] }] }), tool("set_title_screen", { title: "Applied first" }),
    { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" } satisfies ChatResult,
    tool("set_title_screen", { title: "Pending second" })];
  let round = 0;
  const f = applyFixture(async () => {
    const response = responses[round++];
    if (!response) throw Object.assign(new Error("Transport fixture"), { name: "LlmError", status: 401 });
    return response;
  });
  const first = await f.session.sendUserMessage("Set title", undefined, undefined, { autonomous: true });
  expect(first.review?.status).toBe("approved");
  // When a later authorized continuation fails after its pending write.
  const result = await f.session.sendUserMessage("Continue", undefined, undefined, { autonomous: true, goalAction: "resume" });
  // Then draft precedence neither erases nor replays the first milestone.
  expect(result.runOutcome).toEqual({ execution: "failed", goal: "unassessed", delivery: "draft" });
  expect(result.appliedCalls?.map(call => call.args.title)).toEqual(["Applied first"]);
  expect(result.proposedCalls.map(call => call.args.title)).toEqual(["Pending second"]);
  expect(store.getCurrent().system.titleScreen?.title).toBe("Applied first");
});

it("routes an explicit user withdrawal to the sole session authority", async () => {
  // Given an actual retained required obligation and a registered local user action.
  const f = fixture();
  const result = await f.run([[plan([size]), skip]]);
  const snapshot = f.session.getAcceptanceSnapshot();
  if (!snapshot) throw new Error("Missing canonical contract");
  const status = { ready: true, turnBusy: false, configReady: true, lastStatus: "", bridgeConnected: false, panelMounted: true };
  registerAiAssistantBridge({ send: async () => ({ ok: true, status, audit: [], harness: null }),
    getStatus: () => status, getAudit: () => [], getHarness: () => f.session.getHarnessSnapshot(), abort: () => {},
    withdrawRequirement: action => f.session.withdrawRequirement(action),
  });
  // When the user invokes the explicit scoped boundary (not an LLM tool).
  const accepted = withdrawAiRequirement({ acceptanceId: snapshot.id, requirementId: "size", reason: "User scope change" });
  // Then only the denominator changes; execution and unmet evidence remain truthful.
  expect(accepted).toBe(true);
  expect(result.runOutcome).toEqual({ execution: "blocked", goal: "satisfied", delivery: "no-change" });
  expect(f.session.getAcceptanceSnapshot()?.items[0]?.status).not.toBe("verified");
});
