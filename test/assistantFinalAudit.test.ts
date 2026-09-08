import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { parseToolVerdict } from "@/ai/agentVerification";
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
    // Given a native lint failure, not a transport failure or a model verdict.
    const events: SessionEvent[] = [];
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
    const before = structuredClone(project);
    // When the current question explicitly executes the registered checker.
    const result = await session.sendUserMessage("Check the authored map", event => events.push(event));
    // Then the real negative verdict owns the final response and its publications.
    const lint = events.find(event => event.type === "tool_call" && event.name === "run_lint");
    expect(lint).toMatchObject({ result: { ok: true, data: { counts: { errors: expect.any(Number) } } } });
    if (lint?.type !== "tool_call") throw new Error("Missing native lint result");
    expect(parseToolVerdict(lint.name, lint.result).pass).toBe(false);
    expect(result.assistantText).not.toContain("MODEL_SUCCESS_SENTINEL");
    expect(result.assistantText).toContain("run_lint");
    expect(result.runOutcome).toEqual({ execution: "blocked", goal: "unassessed", delivery: "no-change" });
    expect(result.recap?.runOutcome).toEqual(result.runOutcome);
    expect(session.getHarnessSnapshot().runOutcome).toEqual(result.runOutcome);
    expect(events.at(-1)).toEqual({ type: "run_outcome", runOutcome: result.runOutcome });
    expect(events.filter(event => event.type === "assistant_message").at(-1)).toMatchObject({ content: result.assistantText });
    expect(session.getAuditEntries().filter(entry => entry.kind === "assistant").at(-1)?.text).toBe(result.assistantText);
    expect(project).toEqual(before);
    expect(session.getProposedProject()).toEqual(before);
    expect(session.getHarnessSnapshot().requests).toMatchObject([{ rawInstruction: "Check the authored map", authoring: false }]);
  });
});
