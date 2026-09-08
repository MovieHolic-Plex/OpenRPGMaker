import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, isWriteToolName, type SessionEvent } from "@/ai/assistantSession";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { appearanceGenerationController, registerAppearanceGenerationUI, startAppearanceGenerationFromAssistant } from "@/editor/characterAppearanceGeneration";
import { runTool } from "@/editor/tools";
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
