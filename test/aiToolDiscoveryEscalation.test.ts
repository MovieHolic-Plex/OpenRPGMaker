import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { runTool } from "@/editor/tools";
import { getTool } from "@/editor/tools/toolRegistry";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults/defaultProject";

const CHAT_CONFIG = {
  authMode: "apiKey" as const,
  baseUrl: "x",
  model: "test-model",
  liteModel: "test-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 512,
  agentMode: "chat" as const,
};

function toolCall(name: string, args: Record<string, unknown>): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function final(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
}

describe("AI tool discovery escalation", () => {
  it("finds the project-settings facade from Korean and field-name queries", () => {
    for (const query of ["프로젝트 설정", "제목 저자 용어", "terms author"]) {
      const result = runTool({ project: createBlankProject() }, "find_tools", { query });
      expect(result.ok, result.summary).toBe(true);
      expect(JSON.stringify(result.data), query).toContain("set_project_settings");
    }
  });

  it("discovers an unexposed tool and exposes its schema on the next round", async () => {
    const requests: ChatRequest[] = [];
    const responses = [toolCall("find_tools", { query: "엔딩" }), final("찾았습니다.")];
    const session = new AssistantSession(createBlankProject(), {
      config: CHAT_CONFIG,
      chat: async (_config, request) => {
        requests.push(request);
        const response = responses.shift();
        if (!response) throw new Error("scripted chat exhausted");
        return response;
      },
    });

    await session.sendUserMessage("마을 만들고 NPC 넣고 퀘스트 주고 상성표 만들고 엔딩 조건까지", () => {});

    const firstNames = requests[0]?.tools?.map((tool) => tool.function.name) ?? [];
    const secondNames = requests[1]?.tools?.map((tool) => tool.function.name) ?? [];
    expect(firstNames).toContain("find_tools");
    expect(firstNames).not.toContain("define_ending");
    const reserved = new Set(["find_tools", "set_build_spec", "author_story_arc", "define_quest", "create_quest", "verify_quest", "lint_quest", "generate_walkthrough"]);
    // Session controls are not ordinary domain tools or discovery reservations.
    const sessionControls = new Set(["correct_verification"]);
    expect(getTool("correct_verification")).toBeUndefined();
    expect(firstNames.filter((name) => !reserved.has(name) && !sessionControls.has(name))).toHaveLength(40);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      const controls = request.tools?.filter((tool) => sessionControls.has(tool.function.name)) ?? [];
      expect(controls).toHaveLength(1);
      expect(controls[0]).toMatchObject({ type: "function", function: {
        name: "correct_verification",
        parameters: {
          type: "object", additionalProperties: false,
          required: ["checkId", "args", "reason"],
          properties: {
            checkId: { type: "string" },
            args: { type: "object", additionalProperties: true },
            reason: { type: "string", minLength: 1 },
          },
        },
      } });
      expect(request.tools!.length).toBeLessThanOrEqual(96);
    }
    expect(secondNames).toContain("define_ending");
    expect(secondNames.length).toBeLessThanOrEqual(96);
    const statusTexts = session.getAuditEntries().flatMap((entry) => entry.kind === "status" ? [entry.text] : []);
    expect(statusTexts.filter((text) => text.startsWith("tools:exposed")).length).toBe(2);
    expect(statusTexts.some((text) => text.startsWith("tools:escalated ") && text.includes("define_ending"))).toBe(true);
  });
});
