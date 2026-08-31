import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";

describe("AssistantSession yieldToUi", () => {
  it("도구를 돌리기 전에 이벤트 루프를 한 번 양보한다", async () => {
    const yields: string[] = [];
    const chat = async (): Promise<{
      message: {
        role: "assistant";
        content: string | null;
        tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
      };
      finishReason: "tool_calls" | "stop";
    }> => {
      if (yields.length === 0) {
        return {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "call_1", type: "function", function: { name: "get_project_summary", arguments: "{}" } },
            ],
          },
          finishReason: "tool_calls",
        };
      }
      return { message: { role: "assistant", content: "요약했습니다." }, finishReason: "stop" };
    };

    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", apiKey: "sk-test" },
      chat: chat as never,
      yieldToUi: async () => {
        yields.push("yield");
      },
    });

    const started: string[] = [];
    const result = await session.sendUserMessage("프로젝트 요약해줘", (event) => {
      if (event.type === "tool_started") started.push(event.name);
    });

    expect(result.stoppedReason).toBe("final");
    expect(started).toEqual(["get_project_summary"]);
    expect(yields).toEqual(["yield"]);
  });
});
