import { expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { compactMessagesForRequest } from "@/ai/messageBudget";
import type { ChatMessage } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { goblinId, monsterContext } from "./monsterAiFixture";

function fixture() {
  const ctx = monsterContext();
  const args = { resourceId: goblinId };
  const result = runTool(ctx, "get_monster_resource", args);
  const read = { name: "get_monster_resource", args, result, callId: "current_read" };
  const messages: ChatMessage[] = [
    { role: "system", content: "test" },
    { role: "user", content: "read then write" },
    { role: "assistant", content: null, tool_calls: [{ id: read.callId, type: "function", function: { name: read.name, arguments: JSON.stringify(args) } }] },
    { role: "tool", name: read.name, tool_call_id: read.callId, content: JSON.stringify(result) },
  ];
  const evidence = new ToolReadEvidence();
  evidence.begin(undefined);
  const write = { enemy: { id: "new_enemy", name: "Custom Boss", monsterResourceId: goblinId }, appearanceTags: ["goblin"] };
  return { ctx, read, messages, evidence, write };
}

it("does not authorize a successful full lookup whose response was lost to the request budget", () => {
  // Given a successful executed read that the actual transport budget drops.
  const { ctx, read, messages, evidence, write } = fixture();
  evidence.observeExecutedRead(read);
  const recent: ChatMessage[] = Array.from({ length: 6 }, () => ({ role: "user", content: "preserved instruction" }));
  const transmitted = compactMessagesForRequest([...messages, ...recent], 1);
  expect(transmitted.some(message => message.tool_call_id === read.callId)).toBe(false);
  // When consuming the request copy, not raw execution results.
  evidence.observeRequest(transmitted);
  // Then the unobserved full result is not authorization.
  expect(evidence.beforeWrite(ctx.project, "upsert_enemy", write)?.issues?.[0]?.code).toBe("monster-resource-read-required");
});

it("authorizes full metadata only after the actual model request contains it", () => {
  // Given a successful current-request full lookup and a sufficient transport budget.
  const { ctx, read, messages, evidence, write } = fixture();
  evidence.observeExecutedRead(read);
  const transmitted = compactMessagesForRequest(messages);
  // When consuming its actual serialized payload.
  evidence.observeRequest(transmitted);
  // Then exact, current, delivered metadata authorizes selection.
  expect(evidence.beforeWrite(ctx.project, "upsert_enemy", write)).toBeNull();
});

it("cannot reuse historical full responses after a new user request begins", () => {
  // Given historical full responses still present in the conversation.
  const { ctx, messages, evidence, write } = fixture();
  // When the new request sees old tool messages without a current-request lookup.
  evidence.observeRequest(messages);
  // Then a prior user's lookup cannot authorize a new selection.
  expect(evidence.beforeWrite(ctx.project, "upsert_enemy", write)?.issues?.[0]?.code).toBe("monster-resource-read-required");
});
