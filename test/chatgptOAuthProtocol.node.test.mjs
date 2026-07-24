import assert from "node:assert/strict";
import test from "node:test";
import {
  chatCompletionsToCodexRequest,
  codexEventToChatCompletionChunks,
} from "../scripts/lib/chatgptOAuthProtocol.mjs";

test("Chat Completions messages and tools become Codex Responses input", () => {
  const request = chatCompletionsToCodexRequest({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: "안전하게 편집한다." },
      { role: "user", content: "맵 이름을 알려줘" },
      { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "get_project_summary", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "call_1", content: "{\"name\":\"샘플\"}" },
    ],
    tools: [{ type: "function", function: { name: "get_project_summary", description: "요약", parameters: { type: "object" } } }],
    reasoning: { effort: "low" },
  });

  assert.equal(request.instructions, "안전하게 편집한다.");
  assert.ok(request.input.some((item) => item.type === "function_call" && item.call_id === "call_1"));
  assert.ok(request.input.some((item) => item.type === "function_call_output" && item.output === "{\"name\":\"샘플\"}"));
  assert.deepEqual(request.tools[0], { type: "function", name: "get_project_summary", description: "요약", parameters: { type: "object" }, strict: false });
  assert.equal(request.store, false);
  assert.equal(request.stream, true);
  assert.equal("max_output_tokens" in request, false);
});

test("Codex output and tool-call events become Chat Completions chunks", () => {
  const state = { toolIndexes: new Map(), nextToolIndex: 0, sawToolCall: false };
  const text = codexEventToChatCompletionChunks({ type: "response.output_text.delta", delta: "안녕" }, state);
  assert.equal(text[0].choices[0].delta.content, "안녕");
  const added = codexEventToChatCompletionChunks({ type: "response.output_item.added", item: { type: "function_call", call_id: "call_1", name: "get_project_summary", arguments: "" } }, state);
  assert.equal(added[0].choices[0].delta.tool_calls[0].function.name, "get_project_summary");
  const args = codexEventToChatCompletionChunks({ type: "response.function_call_arguments.delta", item_id: "call_1", delta: "{}" }, state);
  assert.equal(args[0].choices[0].delta.tool_calls[0].function.arguments, "{}");
  const completed = codexEventToChatCompletionChunks({ type: "response.completed", response: { usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 } } }, state);
  assert.equal(completed[0].choices[0].finish_reason, "tool_calls");
  assert.deepEqual(completed[0].usage, { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 });
});

test("a completed function-call item supplies arguments when no delta arrived", () => {
  const state = { toolIndexes: new Map(), nextToolIndex: 0, sawToolCall: false };
  codexEventToChatCompletionChunks({ type: "response.output_item.added", item: { type: "function_call", id: "item_1", call_id: "call_1", name: "get_project_summary", arguments: "" } }, state);
  const completed = codexEventToChatCompletionChunks({ type: "response.output_item.done", item: { type: "function_call", id: "item_1", call_id: "call_1", name: "get_project_summary", arguments: "{\"detail\":true}" } }, state);
  assert.equal(completed[0].choices[0].delta.tool_calls[0].function.arguments, "{\"detail\":true}");
});
