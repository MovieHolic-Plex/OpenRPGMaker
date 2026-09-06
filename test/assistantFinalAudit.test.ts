import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

describe("authoritative final response audit", () => {
  it("persists the harness verdict instead of leaving the model success as the latest response", async () => {
    // Given a real session whose model claims success while an authored condition is unmet.
    const project = createBlankProject();
    let round = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: project.startMapId }),
      chat: async (): Promise<ChatResult> => round++ === 0
        ? { finishReason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [
          { id: "plan", type: "function", function: { name: "set_work_plan", arguments: JSON.stringify({
            goal: "Keep the original map dimensions contract",
            acceptance: [{ id: "size", title: "Required dimensions", criteria: [
              { kind: "mapDimensions", target: { mapId: project.startMapId }, width: 128, height: 128 },
            ] }],
            layers: [{ title: "Work", items: [{ id: "inspect", title: "Inspect", instruction: "Inspect the target" }] }],
          }) } },
          { id: "skip", type: "function", function: { name: "skip_work_item", arguments: "{}" } },
        ] } }
        : { finishReason: "stop", message: { role: "assistant", content: "MODEL_SUCCESS_SENTINEL" } },
    });
    // When finalization replaces the model response with the authoritative incomplete verdict.
    const result = await session.sendUserMessage("Complete the requested map");
    const assistantEntries = session.getAuditEntries().filter(entry => entry.kind === "assistant");
    // Then bridge/history consumers of the latest audited response see that same verdict.
    expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(result.assistantText).not.toBe("MODEL_SUCCESS_SENTINEL");
    expect(assistantEntries.at(-1)?.text).toBe(result.assistantText);
    expect(session.getHarnessSnapshot()).toMatchObject({ acceptance: { status: "blocked" } });
  });

  it("does not duplicate an unchanged ordinary final response", async () => {
    // Given a nonspatial read-only response with no harness replacement.
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test" },
      declareIntent: fixedDeclarer({ mode: "question", needsPlan: false }),
      chat: async (): Promise<ChatResult> => ({ finishReason: "stop", message: { role: "assistant", content: "UNCHANGED_RESPONSE" } }),
    });
    // When the turn finishes, then the original audit remains a single ordinary response.
    await session.sendUserMessage("Inspect only");
    expect(session.getAuditEntries().filter(entry => entry.kind === "assistant")).toHaveLength(1);
  });

  it("does not lead with model success when explicit verification still fails", async () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.upperTiles[map.width + 5] = 260;
    let round = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test" },
      declareIntent: fixedDeclarer({ mode: "question", needsPlan: false, tools: ["run_lint"] }),
      chat: async (): Promise<ChatResult> => round++ === 0
        ? { finishReason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [
          { id: "lint", type: "function", function: { name: "run_lint", arguments: "{}" } },
        ] } }
        : { finishReason: "stop", message: { role: "assistant", content: "MODEL_SUCCESS_SENTINEL" } },
    });
    const result = await session.sendUserMessage("Check the authored map");
    expect(result.assistantText).not.toContain("MODEL_SUCCESS_SENTINEL");
    expect(session.getAuditEntries().filter(entry => entry.kind === "assistant").at(-1)?.text).toBe(result.assistantText);
  });
});
