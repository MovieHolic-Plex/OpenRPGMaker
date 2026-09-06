import { strict as assert } from "node:assert";
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { isCompactionSummaryMessage } from "@/ai/contextCompaction";
import type { AiConfig, ChatMessage, ChatRequest, ChatResult } from "@/ai/llmClient";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { requireRecord, requireString } from "@/project/io/guards";
import {
  AUDIO_TEST_CONFIG,
  audioPromptProject,
  uploadId,
} from "./support/audioPrompt";

function readReply(callId: string, resourceId: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: "",
      tool_calls: [{
        id: callId,
        type: "function",
        function: {
          name: "get_audio_resource",
          arguments: JSON.stringify({ kind: "music", resourceId, reason: "Inspect the current audio description" }),
        },
      }],
    },
    finishReason: "tool_calls",
    usage: { prompt_tokens: 1000, completion_tokens: 10 },
  };
}

describe("audio detail after session compaction", () => {
  it("returns current full detail when a clean session is synchronized after compaction", async () => {
    // Given: a real old tool result, followed by enough history for manual compaction.
    const oldDescription = "AUDIO_OLD_7E2A";
    const description = `AUDIO_CURRENT_4F9C ${"detail ".repeat(600)}`.slice(0, 4000).trim();
    const ctx: ToolContext = { project: audioPromptProject("music", [oldDescription]) };
    const resourceId = uploadId("music", 0);
    const filler: ChatResult = {
      message: { role: "assistant", content: "history ".repeat(5000) },
      finishReason: "stop",
      usage: { prompt_tokens: 1000, completion_tokens: 10 },
    };
    const replies: ChatResult[] = [
      readReply("audio-before", resourceId),
      filler, filler, filler, filler,
      {
        message: { role: "assistant", content: JSON.stringify({ snapshot: "AUDIO_SUMMARY" }) },
        finishReason: "stop",
      },
      readReply("audio-after", resourceId),
      { message: { role: "assistant", content: "DONE" }, finishReason: "stop" },
    ];
    const requests: {
      readonly messages: readonly ChatMessage[];
      readonly tools: readonly string[];
    }[] = [];
    const chat = async (_config: AiConfig, request: ChatRequest): Promise<ChatResult> => {
      requests.push({
        messages: structuredClone(request.messages),
        tools: request.tools?.map(tool => tool.function.name) ?? [],
      });
      const reply = replies.shift();
      assert.ok(reply, "Unexpected additional model request");
      return reply;
    };
    const session = new AssistantSession(ctx.project, { config: AUDIO_TEST_CONFIG, chat });
    await session.sendUserMessage("get_audio_resource", () => undefined);
    const oldTool = session.getMessages().find(message => message.tool_call_id === "audio-before");
    const oldData = requireRecord("old tool result", JSON.parse(requireString("content", oldTool?.content)));
    expect(oldData).toMatchObject({
      ok: true, data: { resource: { description: oldDescription } },
    });
    for (let turn = 0; turn < 3; turn += 1) {
      await session.sendUserMessage(`history-${turn}`, () => undefined);
    }
    const compacted = await session.compactNow();
    assert.equal(compacted.kind, "done");
    expect(session.getMessages().some(isCompactionSummaryMessage)).toBe(true);
    expect(session.getMessages().some(message => message.tool_call_id === "audio-before")).toBe(false);
    const edited = runTool(ctx, "set_audio_description", {
      kind: "music", resourceId, action: "set", description,
    });
    assert.ok(edited.ok, edited.summary);
    assert.ok(session.syncBaselineFromStoreIfClean(ctx.project));

    // When: execute the fresh detail tool through the existing session loop.
    const result = await session.sendUserMessage("get_audio_resource", () => undefined);

    // Then: the next model request receives the real tool's current, unabridged data.
    const sent = requests.at(-1);
    assert.ok(sent);
    const toolMessage = sent.messages.find(message => message.tool_call_id === "audio-after");
    const payload = requireRecord("tool result", JSON.parse(requireString("content", toolMessage?.content)));
    expect(result.stoppedReason).toBe("final");
    expect(sent.tools).toContain("get_audio_resource");
    expect(payload).toMatchObject({
      ok: true,
      data: { resource: { id: resourceId, description, descriptionSource: "project" } },
    });
    expect(description.length).toBeGreaterThan(2000);
    const system = requireString("system", sent.messages.find(message => message.role === "system")?.content);
    expect(system.includes(description)).toBe(false);
    expect(replies).toHaveLength(0);
  });
});
