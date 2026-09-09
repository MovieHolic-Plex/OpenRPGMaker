import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, isWriteToolName, type SessionEvent, type TurnResult } from "@/ai/assistantSession";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { appearanceGenerationController, registerAppearanceGenerationUI, startAppearanceGenerationFromAssistant } from "@/editor/characterAppearanceGeneration";
import { runTool } from "@/editor/tools";
import { ToolError } from "@/editor/tools/types";
import { bounded, deferred } from "./aiEpochFixture";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";

const toolName = "generate_character_appearance";
const config = {
  authMode: "apiKey" as const, baseUrl: "x", model: "stub", liteModel: "stub", apiKey: "sk",
  maxToolCalls: 3, maxTokens: 512, agentMode: "chat" as const,
};
function projectFixture() {
  const project = createBlankProject();
  project.database.characterAppearances = [{ id: "appearance", name: "Mira", description: "Green coat" }];
  store.replaceProject(project);
  return project;
}
afterEach(() => {
  appearanceGenerationController.cancel();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("appearance assistant handoff", () => {
  it("keeps replacement B unchanged after cancelled A's held UI opener rejects with ToolError", async () => {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    const project = projectFixture();
    const entered = deferred<void>();
    const opening = deferred<void>();
    const aProducerSettled = deferred<PromiseSettledResult<TurnResult>>();
    const unregister = registerAppearanceGenerationUI(() => {
      entered.resolve();
      return opening.promise;
    });
    const steps: ChatResult[] = [
      { message: { role: "assistant", content: null, tool_calls: [{
        id: "A-appearance-call", type: "function", function: {
          name: toolName, arguments: JSON.stringify({ appearanceId: "appearance", slot: "face" }),
        },
      }] }, finishReason: "tool_calls" },
      { message: { role: "assistant", content: "B_READ_ONLY" }, finishReason: "stop" },
    ];
    const session = new AssistantSession(project, {
      config,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      yieldToUi: async () => {},
      chat: async () => {
        const step = steps.shift();
        if (!step) throw new Error("Unexpected model call");
        return step;
      },
    });
    // Observe the real producer, not sendUserMessage's cancellation race.
    // Return its original promise unchanged, including its rejection behavior.
    const execute = session["executeTurnLoop"];
    let observedA = false;
    session["executeTurnLoop"] = function (...args) {
      const producer = execute.apply(this, args);
      if (!observedA) {
        observedA = true;
        void producer.then(
          value => aProducerSettled.resolve({ status: "fulfilled", value }),
          reason => aProducerSettled.resolve({ status: "rejected", reason }),
        );
      }
      return producer;
    };
    const abort = new AbortController();
    const a = session.sendUserMessage(toolName, undefined, abort.signal);
    try {
      await bounded(entered.promise);
      abort.abort();
      expect((await bounded(a)).stoppedReason).toBe("aborted");
      const b = await bounded(session.sendUserMessage("B inspect only", undefined, undefined, {
        goalAction: "new-goal", composerMode: "ask",
      }));
      expect(b.runOutcome).toMatchObject({ execution: "response-final", goal: "unassessed", delivery: "no-change" });
      const before = {
        audit: JSON.stringify(session.getAuditEntries()),
        messages: JSON.stringify(session.getHarnessSnapshot().messages),
        harness: JSON.stringify(session.getHarnessSnapshot()),
        project: JSON.stringify(store.getCurrent()),
      };
      opening.reject(new ToolError("UI_OPEN_FAILURE", { code: "appearance-ui-open-failure" }));
      await bounded(aProducerSettled.promise);
      expect({
        audit: JSON.stringify(session.getAuditEntries()),
        messages: JSON.stringify(session.getHarnessSnapshot().messages),
        harness: JSON.stringify(session.getHarnessSnapshot()),
        project: JSON.stringify(store.getCurrent()),
      }).toEqual(before);
      const messages = session.getHarnessSnapshot().messages;
      expect(messages.flatMap(message => message.tool_calls ?? [])
        .filter(call => call.id === "A-appearance-call")).toHaveLength(1);
      const responses = messages.filter(message => message.role === "tool" && message.tool_call_id === "A-appearance-call");
      expect(responses).toHaveLength(1);
      const response = responses[0];
      if (typeof response?.content !== "string") throw new Error("Missing A protocol response");
      expect(JSON.parse(response.content)).toMatchObject({ ok: false, code: "run-cancelled" });
      expect(steps).toHaveLength(0);
    } finally {
      abort.abort();
      opening.resolve();
      unregister();
      await bounded(a);
      if (observedA) await bounded(aProducerSettled.promise);
      session["executeTurnLoop"] = execute;
      appearanceGenerationController.cancel();
      await store.flush();
    }
  });

  it("does not open another DB record over an already active candidate", async () => {
    const project = projectFixture();
    vi.spyOn(appearanceGenerationController, "getState").mockReturnValue({ status: "candidate" });
    const open = vi.fn(() => { appearanceGenerationController.cancel(); });
    const release = registerAppearanceGenerationUI(open);
    try {
      const result = await startAppearanceGenerationFromAssistant(
        project, { appearanceId: "appearance", slot: "face" }, store.getProjectIdentity(),
      );
      expect(result.ok).toBe(false);
      expect(open).not.toHaveBeenCalled();
    } finally {
      release();
    }
  });

  it.each([false, true])("awaits DB opening and rechecks project identity (switched=%s)", async (switched) => {
    const project = projectFixture();
    const identity = store.getProjectIdentity();
    let opened: () => void = () => {};
    const opening = new Promise<void>((resolve) => { opened = resolve; });
    const release = registerAppearanceGenerationUI(() => opening);
    const generate = vi.spyOn(appearanceGenerationController, "generate").mockResolvedValue();

    const pending = startAppearanceGenerationFromAssistant(project, { appearanceId: "appearance", slot: "face" }, identity);
    try {
      expect(generate).not.toHaveBeenCalled();
      if (switched) store.replaceProject(structuredClone(project));
      opened();
      const result = await pending;
      if (switched) {
        expect(generate).not.toHaveBeenCalled();
        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "appearance-stale" })]));
      } else {
        expect(generate).toHaveBeenCalledTimes(1);
        expect(result.data).toMatchObject({ status: "generating" });
      }
    } finally {
      opened();
      release();
    }
  });

  it.each([
    "캐릭터 외형의 빈 얼굴 그림을 만들어줘",
    "캐릭터 외형의 상반신 그림 후보를 만들어줘",
    "Generate a face portrait for this character appearance",
  ])("advertises generation for portrait intent: %s", async (requestText) => {
    const requests: ChatRequest[] = [];
    const session = new AssistantSession(projectFixture(), {
      config,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, tools: ["get_database_records"] }),
      chat: async (_config, request) => {
        requests.push(request);
        return { message: { role: "assistant", content: "Ready." }, finishReason: "stop" };
      },
    });

    await session.sendUserMessage(requestText, () => {}, undefined, { composerMode: "do" });

    expect(requests[0]?.tools?.map((tool) => tool.function.name)).toContain(toolName);
  });

  it("discovers authored appearance IDs through the existing database reader without image bytes", () => {
    const project = projectFixture();

    const result = runTool({ project }, "get_database_records", { collection: "characterAppearances", include: "full" });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ records: [{ id: "appearance", name: "Mira", description: "Green coat" }] });
    expect(JSON.stringify(result)).not.toContain("data:image");
  });

  it("classifies generation as a write capability for Ask filtering", () => {
    expect(isWriteToolName(toolName)).toBe(true);
  });

  it("reports UI-required preparation synchronously to headless tools without mutation", () => {
    const project = projectFixture();
    const before = JSON.stringify(project);

    const result = runTool({ project }, toolName, { appearanceId: "appearance", slot: "face" });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ status: "ui-required", appearanceId: "appearance", slot: "face" });
    expect(JSON.stringify(project)).toBe(before);
  });

  it.each(["do", "ask", "switched"] as const)("routes %s through the real client without auto-accepting", async (scenario) => {
    const composerMode = scenario === "ask" ? "ask" : "do";
    const project = projectFixture();
    const before = JSON.stringify(store.getCurrent());
    const open = vi.fn();
    const release = registerAppearanceGenerationUI(open);
    const generate = vi.spyOn(appearanceGenerationController, "generate");
    const fetchImage = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      image: { dataUrl: "data:image/png;base64,aGVsbG8=", mimeType: "image/png" },
    })));
    vi.stubGlobal("fetch", fetchImage);
    let stopWatching = () => {};
    const settled = new Promise<void>((resolve) => {
      stopWatching = appearanceGenerationController.subscribe((state) => {
        if (state.status === "candidate" || state.status === "error") resolve();
      });
    });
    const steps: ChatResult[] = [
      { message: { role: "assistant", content: null, tool_calls: [{
        id: "appearance-call", type: "function", function: {
          name: toolName, arguments: JSON.stringify({ appearanceId: "appearance", slot: "face" }),
        },
      }] }, finishReason: "tool_calls" },
      { message: { role: "assistant", content: "Review the candidate in the database." }, finishReason: "stop" },
    ];
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, {
      config,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      chat: async () => {
        const step = steps.shift();
        if (!step) throw new Error("unexpected model call");
        return step;
      },
    });
    try {
      if (scenario === "switched") store.replaceProject(structuredClone(project));
      const result = await session.sendUserMessage(
        "generate_character_appearance", (event) => events.push(event), undefined, { composerMode },
      );
      const call = events.find((event) => event.type === "tool_call");

      if (scenario === "do") {
        await settled;
        expect(open).toHaveBeenCalledWith("appearance");
        expect(generate).toHaveBeenCalledWith({ appearanceId: "appearance", slot: "face" });
        expect(call?.type === "tool_call" && call.result.data).toMatchObject({ status: "generating" });
        expect(fetchImage).toHaveBeenCalledTimes(1);
        expect(appearanceGenerationController.getState().status).toBe("candidate");
        expect(JSON.stringify(events)).not.toContain("data:image");
        expect(result).toMatchObject({
          appearanceGeneration: { status: "generating", appearanceId: "appearance", slot: "face" },
        });
        steps.push({ message: { role: "assistant", content: "Another turn." }, finishReason: "stop" });
        const next = await session.sendUserMessage("외형 설명을 읽어줘", () => {}, undefined, { composerMode: "ask" });
        expect(next).not.toHaveProperty("appearanceGeneration");
      } else {
        expect(open).not.toHaveBeenCalled();
        expect(generate).not.toHaveBeenCalled();
        expect(call?.type === "tool_call" && call.result.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({ code: scenario === "ask" ? "composer-mode-ask" : "appearance-stale" }),
        ]));
      }
      expect(result.proposedCalls).toEqual([]);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
    } finally {
      stopWatching();
      release();
    }
  });
});
