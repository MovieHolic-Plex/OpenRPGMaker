import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

describe("authoring revalidates explicit checks before finalizing", () => {
  it("continues after a final claim when a real write made the prior lint stale", async () => {
    const project = createBlankProject();
    const item = project.database.items[0];
    const events: SessionEvent[] = [];
    const calls = [
      { name: "run_lint", args: {} },
      { name: "upsert_item", args: { item: { id: item.id, price: 321 } } },
      null,
      { name: "run_lint", args: {} },
    ];
    let round = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({ mode: "modify", space: "none", targetMapId: null, needsPlan: false, tools: ["run_lint", "upsert_item"] }),
      chat: async (): Promise<ChatResult> => {
        const index = round++, call = calls[index];
        return call
          ? { finishReason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{
            id: `call-${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
          }] } }
          : { finishReason: "stop", message: { role: "assistant", content: index < 4 ? "EARLY_FINAL" : "REVALIDATED_FINAL" } };
      },
    });
    const result = await session.sendUserMessage("Change the item price and verify it", event => events.push(event));
    expect(events.filter(event => event.type === "tool_call" && event.name === "run_lint")).toHaveLength(2);
    expect(result.assistantText).toBe("REVALIDATED_FINAL");
    expect(session.getProposedProject().database.items.find(record => record.id === item.id)?.price).toBe(321);
  });

  it("does not turn advisory-only findings into automatic authoring requirements", () => {
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_lint", {}, { ok: true, data: { issues: [{ severity: "error", message: "existing advisory finding" }] } }, "advisory");
    expect(evidence.problems()).toHaveLength(1);
    expect(evidence.problems("explicit")).toEqual([]);
  });
});
