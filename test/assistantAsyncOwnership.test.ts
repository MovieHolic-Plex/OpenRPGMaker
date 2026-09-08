import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent, type TurnResult } from "@/ai/assistantSession";
import { defaultAiConfig, LlmError, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { SUMMARIZATION_SYSTEM_PROMPT } from "@/ai/contextCompaction";
import { declaredIntent, fixedDeclarer } from "./intentFixture";

const config = { ...defaultAiConfig(), agentMode: "auto" as const, model: "fixture", liteModel: "fixture", apiKey: "fixture", maxToolCalls: 1 };
const answer = (content = "ANSWER"): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const plan = answer(JSON.stringify({ action: "new_plan", goal: "OLD_PLANNER_GOAL",
  requirements: [{ id: "old-required", title: "Old", required: true, criteria: [
    { kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "Old target" },
  ] }], layers: [{ title: "Old", items: [{ title: "Title", instruction: "Set old title" }] }] }));
const tool = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: `held-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Ownership event did not settle")), 5000);
    })]);
  } finally { clearTimeout(timer); }
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetIntentDeclarationCache();
});
afterEach(() => { resetIntentDeclarationCache(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("public planner invocation ownership", () => {
  it.each(["success", "invalid", "rejected"] as const)("held %s planner cannot donate into a completed newer Ask", async outcome => {
    const project = createBlankProject(); store.replace(project);
    const initial = structuredClone(store.getCurrent()), entered = deferred(), held = deferred();
    const controller = new AbortController(), newerController = new AbortController();
    const oldEvents: SessionEvent[] = [], newEvents: SessionEvent[] = [];
    let calls = 0, newer: Promise<TurnResult> | undefined;
    const raw = outcome === "success" ? "Make the old title" : "Make the old title using the original full requirement throughout this planner fallback";
    const session = new AssistantSession(store.getCurrent(), { config, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      chat: async () => {
        if (++calls !== 1) return answer();
        entered.resolve(); await held.promise;
        if (outcome === "rejected") throw new LlmError("Old planner rejected", 400);
        return outcome === "invalid" ? answer("{invalid") : plan;
      },
    });
    const older = session.sendUserMessage(raw, event => oldEvents.push(event), controller.signal, { autonomous: true });
    try {
      await bounded(entered.promise);
      newer = session.sendUserMessage("What is the title?", event => newEvents.push(event), newerController.signal, { composerMode: "ask", autonomous: true });
      const result = await bounded(newer), frozen = structuredClone(result);
      expect(result.execution).toMatchObject({ requestId: "request-2", state: "answer" });
      const before = structuredClone(session.getHarnessSnapshot()), eventsBefore = structuredClone([oldEvents, newEvents]);
      expect(before.workPlan).toBeNull();
      expect(before.acceptance?.items.map(item => item.id)).toEqual(["request-1:source:0"]);
      held.resolve(); expect((await bounded(older)).stoppedReason).toBe("aborted");
      expect.soft(session.getWorkPlan()).toBeNull();
      expect.soft(calls).toBe(2);
      expect(session.getHarnessSnapshot()).toEqual(before);
      expect([oldEvents, newEvents]).toEqual(eventsBefore);
      expect(result).toEqual(frozen);
      expect(session.getProposedProject()).toEqual(initial);
      expect(store.getCurrent()).toEqual(initial);
      expect(result.appliedCalls).toEqual([]); expect(result.proposedCalls).toEqual([]);
    } finally { controller.abort(); newerController.abort(); held.resolve(); await bounded(Promise.all([older, newer])); }
  });

  it.each(["success", "invalid", "rejected"] as const)("retains prior native evidence, source baseline, draft and WorkPlan after stale %s", async outcome => {
    const project = createBlankProject(); store.replace(project);
    const entered = deferred(), held = deferred(), controller = new AbortController(), nextController = new AbortController();
    let calls = 0, newer: Promise<TurnResult> | undefined;
    const raw = "Inspect the current map", source = { start: 0, end: raw.length, quote: raw };
    const session = new AssistantSession(store.getCurrent(), { config, yieldToUi: async () => {},
      declareIntent: facts => fixedDeclarer({ mode: "modify", needsPlan: facts.userText !== raw,
        ...(facts.userText === raw ? { requestRequirements: { entries: [{ source: [source], bindings: [],
          criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] }] } } : {}),
      })(facts),
      chat: async () => {
        calls++;
        if (calls === 1) return { message: { role: "assistant", content: null, tool_calls: [
          ...tool("set_work_plan", { goal: "RETAINED_PLAN", layers: [{ title: "Inspect", items: [{ title: "Inspect", instruction: raw }] }] }).message.tool_calls!,
          ...tool("set_title_screen", { title: "RETAINED_DRAFT" }).message.tool_calls!,
          ...tool("run_lint", {}).message.tool_calls!,
        ] }, finishReason: "tool_calls" };
        if (calls !== 2) return answer();
        entered.resolve(); await held.promise;
        if (outcome === "rejected") throw new LlmError("Retired planner", 400);
        return outcome === "success" ? plan : answer("invalid");
      },
    });
    const prior = await bounded(session.sendUserMessage(raw)), historical = structuredClone(prior);
    expect(prior.proposedCalls.map(call => call.name)).toEqual(["set_title_screen"]);
    expect(session.getHarnessSnapshot().requests?.[0]?.units[0]?.coverage).toBe("declared");
    expect(session.getAcceptanceSnapshot()?.items[0]?.evidence.length).toBeGreaterThan(0);
    const older = session.sendUserMessage("Make the old title", undefined, controller.signal, { autonomous: true });
    try {
      await bounded(entered.promise);
      newer = session.sendUserMessage("What is the title?", undefined, nextController.signal, { composerMode: "ask" });
      const result = await bounded(newer), frozen = structuredClone(result);
      const before = structuredClone(session.getHarnessSnapshot()), draft = session.getProposedProject(), applied = structuredClone(store.getCurrent());
      expect(before.workPlan?.goal).toBe("RETAINED_PLAN");
      held.resolve(); expect((await bounded(older)).stoppedReason).toBe("aborted");
      expect(session.getHarnessSnapshot()).toEqual(before);
      expect(session.getProposedProject()).toEqual(draft); expect(store.getCurrent()).toEqual(applied);
      expect(prior).toEqual(historical); expect(result).toEqual(frozen); expect(calls).toBe(3);
    } finally { controller.abort(); nextController.abort(); held.resolve(); await bounded(Promise.all([older, newer])); }
  });

  it.each(["abort", "project-switch", "generation"] as const)("retires planner before adoption on %s", async boundary => {
    const project = createBlankProject(); store.replace(project);
    const entered = deferred(), held = deferred(), controller = new AbortController(); let calls = 0;
    const session = new AssistantSession(store.getCurrent(), { config, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }), chat: async () => {
        if (++calls !== 1) { controller.abort(); return answer(); }
        entered.resolve(); await held.promise; return plan;
      },
    });
    const older = session.sendUserMessage("Make the old title", undefined, controller.signal, { autonomous: true });
    try {
      await bounded(entered.promise);
      if (boundary === "abort") controller.abort();
      else if (boundary === "project-switch") store.replaceProject(createBlankProject());
      else await bounded(session.retryLastTurn()); // Same result/request owner, new public invocation generation.
      const before = structuredClone(session.getHarnessSnapshot()), applied = structuredClone(store.getCurrent());
      held.resolve(); const result = await bounded(older);
      expect(result.stoppedReason).toBe("aborted");
      expect(session.getWorkPlan()).toBeNull();
      expect(session.getHarnessSnapshot().requests).toEqual(before.requests);
      expect(session.getAcceptanceSnapshot()).toEqual(before.acceptance);
      expect(calls).toBe(1); expect(store.getCurrent()).toEqual(applied);
      if (boundary === "generation") expect(session.getHarnessSnapshot()).toEqual(before);
    } finally { controller.abort(); held.resolve(); await bounded(older); }
  });
});

describe("neighboring awaited ownership seams", () => {
  it("held native advisory cannot publish evidence after a newer Ask", async () => {
    const project = createBlankProject(); store.replace(project);
    const entered = deferred(), held = deferred(), controller = new AbortController(), nextController = new AbortController();
    let holding = false, calls = 0, newer: Promise<TurnResult> | undefined;
    const session = new AssistantSession(store.getCurrent(), { config: { ...config, agentMode: "chat" },
      yieldToUi: async () => { if (holding) { holding = false; entered.resolve(); await held.promise; } },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }), chat: async () => {
        if (++calls !== 1) return answer();
        return { message: { role: "assistant", content: null, tool_calls: [
          ...tool("set_work_plan", { goal: "Applied", layers: [{ title: "Edit", items: [{ title: "Title", instruction: "Set title", successTools: ["set_title_screen"] }] }] }).message.tool_calls!,
          ...tool("set_title_screen", { title: "Applied" }).message.tool_calls!,
        ] }, finishReason: "tool_calls" };
      },
    });
    const older = session.sendUserMessage("Set title", event => {
      if (event.type === "tool_started" && event.name === "run_lint") holding = true;
    }, controller.signal, { autonomous: true });
    try {
      await bounded(Promise.race([entered.promise, older.then(result => { throw new Error(`No advisory: ${JSON.stringify(result)}`); })]));
      newer = session.sendUserMessage("What is the title?", undefined, nextController.signal, { composerMode: "ask" });
      const result = await bounded(newer), frozen = structuredClone(result);
      const before = structuredClone(session.getHarnessSnapshot()), applied = structuredClone(store.getCurrent());
      expect(applied.meta.title).toBe("Applied");
      held.resolve(); expect((await bounded(older)).stoppedReason).toBe("aborted");
      expect(session.getHarnessSnapshot()).toEqual(before); expect(store.getCurrent()).toEqual(applied);
      expect(result).toEqual(frozen); expect(calls).toBe(2);
    } finally { controller.abort(); nextController.abort(); held.resolve(); await bounded(Promise.all([older, newer])); }
  });

  it("held retry cannot finalize into a newer invocation of the same request", async () => {
    const entered = deferred(), held = deferred(), controller = new AbortController(); let calls = 0;
    const session = new AssistantSession(createBlankProject(), { config: { ...config, agentMode: "chat" }, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "question" }), chat: async () => {
        if (++calls === 1) throw new LlmError("Initial failure", 400);
        entered.resolve(); await held.promise; return answer("OLD_RETRY");
      },
    });
    const prior = await bounded(session.sendUserMessage("Question")), frozen = structuredClone(prior);
    expect(session.canRetryLastTurn()).toBe(true);
    const older = session.retryLastTurn(undefined, controller.signal);
    try {
      await bounded(entered.promise); await bounded(session.retryLastTurn());
      const before = structuredClone(session.getHarnessSnapshot());
      held.resolve(); expect((await bounded(older)).stoppedReason).toBe("aborted");
      expect(session.getHarnessSnapshot()).toEqual(before); expect(prior).toEqual(frozen); expect(calls).toBe(2);
    } finally { controller.abort(); held.resolve(); await bounded(older); }
  });

  it.each(["success", "rejected"] as const)("retired %s conversation preparation cannot replace newer messages", async outcome => {
    const entered = deferred(), held = deferred(), controller = new AbortController(), newController = new AbortController();
    let calls = 0, summaries = 0, newer: Promise<TurnResult> | undefined;
    const session = new AssistantSession(createBlankProject(), { config: { ...config, agentMode: "chat" }, yieldToUi: async () => {},
      declareIntent: fixedDeclarer({ mode: "question" }), chat: async (_config, request) => {
        calls++;
        if (request.messages[0]?.content !== SUMMARIZATION_SYSTEM_PROMPT) return { ...answer("x".repeat(40000)), usage: { prompt_tokens: 1000, completion_tokens: 1 } };
        if (++summaries > 1) return answer("NEW_SUMMARY");
        entered.resolve(); await held.promise;
        if (outcome === "rejected") throw new Error("Retired summary rejected");
        return answer("OLD_SUMMARY");
      },
    });
    for (const text of ["First question", "Second question", "Third question"]) await bounded(session.sendUserMessage(text));
    const older = session.compactNow(undefined, controller.signal);
    try {
      await bounded(Promise.race([entered.promise, older.then(result => { throw new Error(JSON.stringify({ result, calls, messages: session.getMessages().map(message => [message.role, String(message.content).length]) })); })]));
      newer = session.sendUserMessage("What is the title?", undefined, newController.signal, { composerMode: "ask" });
      const result = await bounded(newer), frozen = structuredClone(result);
      const before = structuredClone(session.getHarnessSnapshot()), callsBefore = calls;
      held.resolve(); expect((await bounded(older)).kind).toBe("skipped");
      expect(session.getHarnessSnapshot()).toEqual(before); expect(result).toEqual(frozen); expect(calls).toBe(callsBefore);
    } finally { controller.abort(); newController.abort(); held.resolve(); await bounded(Promise.all([older, newer])); }
  });

  it.each(["declaration", "preparation", "tool-yield"] as const)("retired %s cannot publish into newer Ask", async seam => {
    const project = createBlankProject(); store.replace(project);
    const entered = deferred(), held = deferred(), controller = new AbortController(), newController = new AbortController();
    let calls = 0, newer: Promise<TurnResult> | undefined, holdingTool = false;
    const session = new AssistantSession(store.getCurrent(), { config: { ...config, agentMode: "chat" },
      yieldToUi: async () => { if (holdingTool) { holdingTool = false; entered.resolve(); await held.promise; } },
      prepareProjectWiki: async input => {
        if (seam === "preparation" && input.text === "Old request") {
          entered.resolve(); await held.promise;
          input.onDelivery?.({ kind: "applied", project: store.getCurrent() });
          throw new Error("Retired preparation failure");
        }
        return undefined;
      },
      declareIntent: async facts => {
        if (seam === "declaration" && facts.userText === "Old request") {
          entered.resolve(); await held.promise;
          return { intent: declaredIntent(), elapsedMs: 0, failure: { kind: "provider", message: "Old authorization failure", status: 401 } };
        }
        return fixedDeclarer({ mode: "question", needsPlan: false })(facts);
      },
      chat: async () => ++calls === 1 && seam === "tool-yield" ? tool("run_lint", {}) : answer(),
    });
    const older = session.sendUserMessage("Old request", event => {
      if (seam === "tool-yield" && event.type === "tool_started") holdingTool = true;
    }, controller.signal);
    try {
      await bounded(entered.promise);
      newer = session.sendUserMessage("What is the title?", undefined, newController.signal, { composerMode: "ask" });
      const result = await bounded(newer), frozen = structuredClone(result);
      const before = structuredClone(session.getHarnessSnapshot()), callsBefore = calls;
      held.resolve(); expect((await bounded(older)).stoppedReason).toBe("aborted");
      expect(session.getHarnessSnapshot()).toEqual(before);
      expect(calls).toBe(callsBefore); expect(result).toEqual(frozen);
      expect(result.runOutcome?.execution).toBe("response-final");
    } finally { controller.abort(); newController.abort(); held.resolve(); await bounded(Promise.all([older, newer])); }
  });
});
