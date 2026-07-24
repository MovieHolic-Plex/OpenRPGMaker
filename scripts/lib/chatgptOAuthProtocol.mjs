function textContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
}

function messageContent(content, role) {
  if (typeof content === "string") {
    return [{ type: role === "assistant" ? "output_text" : "input_text", text: content }];
  }
  if (!Array.isArray(content)) return [];
  return content.flatMap((part) => {
    if (part?.type === "text" && typeof part.text === "string") {
      return [{ type: role === "assistant" ? "output_text" : "input_text", text: part.text }];
    }
    if (role !== "assistant" && part?.type === "image_url" && typeof part.image_url?.url === "string") {
      return [{ type: "input_image", image_url: part.image_url.url, detail: part.image_url.detail ?? "auto" }];
    }
    return [];
  });
}

export function chatCompletionsToCodexRequest(body) {
  const instructions = [];
  const input = [];
  for (const message of Array.isArray(body.messages) ? body.messages : []) {
    if (message?.role === "system") {
      const text = textContent(message.content);
      if (text) instructions.push(text);
      continue;
    }
    if (message?.role === "tool") {
      input.push({ type: "function_call_output", call_id: String(message.tool_call_id ?? ""), output: textContent(message.content) });
      continue;
    }
    if (message?.role !== "user" && message?.role !== "assistant") continue;
    const content = messageContent(message.content, message.role);
    if (content.length > 0) input.push({ type: "message", role: message.role, content });
    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (call?.type !== "function") continue;
        input.push({
          type: "function_call",
          call_id: String(call.id ?? ""),
          name: String(call.function?.name ?? ""),
          arguments: String(call.function?.arguments ?? ""),
        });
      }
    }
  }
  const tools = Array.isArray(body.tools)
    ? body.tools.flatMap((tool) => tool?.type === "function" && tool.function
      ? [{
          type: "function",
          name: String(tool.function.name ?? ""),
          description: String(tool.function.description ?? ""),
          parameters: tool.function.parameters ?? { type: "object", properties: {} },
          strict: false,
        }]
      : [])
    : [];
  const request = {
    model: typeof body.model === "string" && body.model ? body.model : "gpt-5.4",
    instructions: instructions.join("\n\n"),
    input,
    store: false,
    stream: true,
    include: ["reasoning.encrypted_content"],
    text: { verbosity: "low" },
  };
  if (tools.length > 0) {
    request.tools = tools;
    request.tool_choice = body.tool_choice ?? "auto";
  }
  const effort = body.reasoning?.effort;
  if (effort === "low" || effort === "medium" || effort === "high") request.reasoning = { effort };
  return request;
}

function chunk(delta, finishReason = null, usage) {
  const value = { id: "chatcmpl-rpg-zzu", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), choices: [{ index: 0, delta, finish_reason: finishReason }] };
  if (usage) value.usage = usage;
  return value;
}

function toolIndex(state, itemId, callId) {
  const existing = state.toolIndexes.get(itemId) ?? state.toolIndexes.get(callId);
  if (typeof existing === "number") return existing;
  const index = state.nextToolIndex;
  state.nextToolIndex += 1;
  if (itemId) state.toolIndexes.set(itemId, index);
  if (callId) state.toolIndexes.set(callId, index);
  return index;
}

export function codexEventToChatCompletionChunks(event, state) {
  if (!(state.toolIndexes instanceof Map)) state.toolIndexes = new Map();
  if (typeof state.nextToolIndex !== "number") state.nextToolIndex = 0;
  if (event?.type === "response.output_text.delta" && typeof event.delta === "string") {
    state.content = `${state.content ?? ""}${event.delta}`;
    return [chunk({ content: event.delta })];
  }
  if ((event?.type === "response.reasoning_summary_text.delta" || event?.type === "response.reasoning_text.delta") && typeof event.delta === "string") {
    state.reasoning = `${state.reasoning ?? ""}${event.delta}`;
    return [chunk({ reasoning: event.delta })];
  }
  if (event?.type === "response.output_item.added" && event.item?.type === "function_call") {
    const callId = String(event.item.call_id ?? event.item.id ?? "");
    const itemId = String(event.item.id ?? callId);
    const index = toolIndex(state, itemId, callId);
    state.sawToolCall = true;
    state.toolCalls ??= [];
    state.toolCalls[index] = { id: callId, type: "function", function: { name: String(event.item.name ?? ""), arguments: String(event.item.arguments ?? "") } };
    return [chunk({ tool_calls: [{ index, id: callId, type: "function", function: { name: String(event.item.name ?? ""), arguments: String(event.item.arguments ?? "") } }] })];
  }
  if (event?.type === "response.function_call_arguments.delta" && typeof event.delta === "string") {
    const itemId = String(event.item_id ?? event.call_id ?? "");
    const index = toolIndex(state, itemId, String(event.call_id ?? ""));
    if (state.toolCalls?.[index]) state.toolCalls[index].function.arguments += event.delta;
    return [chunk({ tool_calls: [{ index, function: { arguments: event.delta } }] })];
  }
  if ((event?.type === "response.output_item.done" && event.item?.type === "function_call") || event?.type === "response.function_call_arguments.done") {
    const item = event.item ?? event;
    const itemId = String(item.id ?? event.item_id ?? item.call_id ?? "");
    const callId = String(item.call_id ?? event.call_id ?? "");
    const index = toolIndex(state, itemId, callId);
    const finalArguments = String(item.arguments ?? event.arguments ?? "");
    const accumulated = state.toolCalls?.[index]?.function.arguments ?? "";
    const delta = finalArguments.startsWith(accumulated) ? finalArguments.slice(accumulated.length) : accumulated ? "" : finalArguments;
    if (state.toolCalls?.[index]) state.toolCalls[index].function.arguments = finalArguments;
    return delta ? [chunk({ tool_calls: [{ index, function: { arguments: delta } }] })] : [];
  }
  if (event?.type === "response.completed" || event?.type === "response.done" || event?.type === "response.incomplete") {
    const rawUsage = event.response?.usage ?? event.usage;
    const usage = rawUsage ? {
      prompt_tokens: rawUsage.input_tokens,
      completion_tokens: rawUsage.output_tokens,
      total_tokens: rawUsage.total_tokens,
    } : undefined;
    state.finishReason = state.sawToolCall ? "tool_calls" : "stop";
    state.usage = usage;
    return [chunk({}, state.finishReason, usage)];
  }
  if (event?.type === "error" || event?.type === "response.failed") {
    const message = event.message ?? event.error?.message ?? event.response?.error?.message ?? "ChatGPT Codex request failed";
    throw new Error(String(message));
  }
  return [];
}

export function nonStreamCompletion(state) {
  const message = { role: "assistant", content: state.content || null };
  if (state.reasoning) message.reasoning = state.reasoning;
  if (Array.isArray(state.toolCalls) && state.toolCalls.length > 0) message.tool_calls = state.toolCalls.filter(Boolean);
  const response = { id: "chatcmpl-rpg-zzu", object: "chat.completion", created: Math.floor(Date.now() / 1000), choices: [{ index: 0, message, finish_reason: state.finishReason ?? "stop" }] };
  if (state.usage) response.usage = state.usage;
  return response;
}
