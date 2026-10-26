import { describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

// Each test here drives a full assistant/editor session over the ~63MB blank project
// (createBlankProject + fingerprint/copy per session). On 4-core CI runners with 8 workers
// these legitimately exceed vitest's 15s default, so the budget is raised for this file only.
vi.setConfig({ testTimeout: 120_000 });

const CHAT_CONFIG = {
  authMode: "apiKey" as const,
  agentMode: "chat" as const,
  baseUrl: "x",
  model: "test-model",
  liteModel: "test-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 2048,
};

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
  it("destructive editor-wide tools remain marked for audit but are not gated", async () => {
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
      config: CHAT_CONFIG,
      chat,
    });

    const result = await session.sendUserMessage("현재 맵을 삭제해줘");

    expect(result.proposedCalls, JSON.stringify(session.getAuditEntries())).toHaveLength(1);
    expect(result.proposedCalls[0]).toMatchObject({ name: "remove_map", destructive: true, requiresApproval: true });
    expect(session.getProposedProject().maps.map_delete_me).toBeUndefined();
  });

  it("unknown and malformed calls return typed failures instead of throwing", () => {
    const unknown = runTool({ project: createBlankProject() }, "totally_unknown_editor_tool", {});
    const malformed = runTool({ project: createBlankProject() }, "set_project_settings", { battle: { initialTroopId: "missing" } });

    expect(unknown).toMatchObject({ ok: false, issues: [{ severity: "error", code: "unknown-tool" }] });
    expect(malformed).toMatchObject({ ok: false, issues: [{ severity: "error", code: "troop-not-found" }] });
  });
});
