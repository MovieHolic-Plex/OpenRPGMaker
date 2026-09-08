import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { independentReviewPayload as payload } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";

const text = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const write = (price: number): ChatResult => ({ message: { role: "assistant", content: null, tool_calls: [{
  id: `write_${price}`, type: "function", function: { name: "upsert_item", arguments: JSON.stringify({
    item: { id: "item_potion", price }, reason: "Set the requested price" }) } }] }, finishReason: "tool_calls" });

describe("independent review evidence overflow", () => {
  it("reports why the draft could not be reviewed instead of its own refusal string", async () => {
    let reviewerCalls = 0;
    let writerCalls = 0;
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 12 },
      // A 16,384-token reviewer cannot hold any complete project evidence.
      reviewConfig: { ...defaultAiConfig(), providerId: "google-antigravity", model: "tab_flash_lite_preview" },
      declareIntent: fixedDeclarer({ mode: "modify", tools: ["upsert_item"],
        readBeforeWrite: { project: true, collections: ["items"], references: true } }),
      chat: async (_config, request) => {
        if (payload(request)) {
          reviewerCalls++;
          return text("{}");
        }
        writerCalls++;
        return writerCalls === 1 ? write(321) : text("Done");
      },
    });

    const result = await session.sendUserMessage("Set potion price to 654");

    // The envelope is refused before the request exists, so no reviewer round is spent.
    expect(reviewerCalls).toBe(0);
    expect(session.getResultReview()?.status).toBe("error");
    expect(result.error).toContain("검수 증거가 한 번에 들어가지 않아");
    expect(result.error).not.toContain("independent-review-window-exceeded");
    expect(result.error).not.toContain("complete evidence does not fit");
    // An unreviewable draft is still not approved.
    expect(result.stoppedReason).toBe("error");
  });

  it("carries the deterministic problems found before the reviewer was refused", async () => {
    let writerCalls = 0;
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 12 },
      reviewConfig: { ...defaultAiConfig(), providerId: "google-antigravity", model: "tab_flash_lite_preview" },
      declareIntent: fixedDeclarer({ mode: "modify", tools: ["upsert_item", "run_lint"],
        readBeforeWrite: { project: true, collections: ["items"], references: true } }),
      chat: async (_config, request) => {
        if (payload(request)) return text("{}");
        writerCalls++;
        if (writerCalls === 1) return { message: { role: "assistant", content: null, tool_calls: [{
          id: "declare-lint", type: "function", function: { name: "set_work_plan", arguments: JSON.stringify({
            goal: "Change price with required lint", layers: [{ title: "Check", items: [{ title: "Lint", instruction: "Revalidate lint",
              successTools: ["run_lint"], verificationChecks: [{ tool: "run_lint", args: {} }] }] }],
          }) },
        }, { id: "lint", type: "function", function: { name: "run_lint", arguments: "{}" } }] }, finishReason: "tool_calls" };
        if (writerCalls === 2) return write(321);
        return text("Done");
      },
    });

    const result = await session.sendUserMessage("Set potion price to 654");

    // run_lint ran, then a write made it stale: that is a required problem the user can act
    // on, and it used to be replaced by the harness's own window-exceeded string.
    expect(result.error).toContain("검수 증거가 한 번에 들어가지 않아");
    expect(result.error).toContain("run_lint");
  });
});
