import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const CHAT_AUTO_APPROVE_CONFIG = {
  agentMode: "chat" as const,
  autoApprove: true,
  baseUrl: "x",
  model: "test-model",
  liteModel: "test-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 2048,
};

function scriptedChat(steps: readonly ChatResult[]) {
  let index = 0;
  return async (): Promise<ChatResult> => {
    const step = steps[index++];
    if (!step) throw new Error("scripted chat exhausted");
    return step;
  };
}

function toolCall(name: string, args: unknown): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalMessage(): ChatResult {
  return { message: { role: "assistant", content: "완료", tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}

describe("AI editor-wide tool safety", () => {
  it("auto mode still marks destructive editor-wide tools as approval-required", async () => {
    const context = { project: createBlankProject() };
    const created = runTool(context, "create_map", { id: "map_delete_me", name: "삭제 대상", width: 8, height: 8 });
    expect(created.ok, created.summary).toBe(true);
    const calls: ChatResult[] = [];
    const chat = async (): Promise<ChatResult> => {
      const step = calls.shift();
      if (!step) throw new Error("scripted chat exhausted");
      return step;
    };
    calls.push(toolCall("remove_map", { mapId: "map_delete_me" }), finalMessage());
    const session = new AssistantSession(context.project, {
      config: CHAT_AUTO_APPROVE_CONFIG,
      chat,
    });

    const result = await session.sendUserMessage("현재 맵을 삭제해줘");

    expect(result.proposedCalls, JSON.stringify(session.getAuditEntries())).toHaveLength(1);
    expect(result.proposedCalls[0]).toMatchObject({ name: "remove_map", destructive: true, requiresApproval: true });
  });

  it("unknown and malformed calls return typed failures instead of throwing", () => {
    const unknown = runTool({ project: createBlankProject() }, "totally_unknown_editor_tool", {});
    const malformed = runTool({ project: createBlankProject() }, "set_project_settings", { battle: { initialTroopId: "missing" } });

    expect(unknown).toMatchObject({ ok: false, issues: [{ severity: "error", code: "unknown-tool" }] });
    expect(malformed).toMatchObject({ ok: false, issues: [{ severity: "error", code: "troop-not-found" }] });
  });
});
