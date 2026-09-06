// 완성(completion) 전송 전용 pi-ai 어댑터.
//
// 분리 경계: 자감·로그인·갱신은 scripts/lib/aiAuthRuntime.ts 가 순수 Node 에서 다 처리하고,
// 이 파일은 이미 부혼 자겁문자열(apiKey)를 받아 모델 호출만 한다. pi-ai 는 bun:sqlite 를
// 싣고 오므로 Bun 에서만 로드되며, 그 Bun 의존이 인증 경로로 새지 않는 것이 이 경계의 목적이다.

import { complete } from "@oh-my-pi/pi-ai";
import { getBundledModel, getBundledModels } from "@oh-my-pi/pi-catalog";
import { getOhMyPiProvider } from "../../src/ai/ohMyPiProviders.ts";
import type { ImageDelivery } from "../../src/ai/imageDelivery.ts";
import { convertUserContent, hasImagePart, ImageTransportError } from "./ohMyPiUserContent.ts";

function testStub(): boolean {
  return process.env.RPG_ZZU_OH_MY_PI_TEST_STUB === "1";
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const rec = part as { type?: string; text?: string };
      return rec.type === "text" ? String(rec.text ?? "") : "";
    })
    .join("");
}

function toolArgumentsOf(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function openaiToContext(provider: string, body: Record<string, unknown>, supportsImages: boolean) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const systemPrompt: string[] = [];
  const converted: unknown[] = [];
  const imageDelivery: ImageDelivery[] = [];
  for (const [messageIndex, raw] of messages.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as { role?: string; content?: unknown; tool_call_id?: string; name?: string; tool_calls?: unknown };
    if (msg.role !== "user" && hasImagePart(msg.content)) {
      throw new ImageTransportError("unsupported-image-role", `messages[${messageIndex}]: image parts require the user role`);
    }
    if (msg.role === "system") {
      const text = textOf(msg.content);
      if (text) systemPrompt.push(text);
      continue;
    }
    if (msg.role === "user") {
      const content = convertUserContent(msg.content, supportsImages);
      content.forEach((part, partIndex) => {
        if (part.type === "image") imageDelivery.push({ messageIndex, partIndex });
      });
      if (provider === "openai-codex" && content.some(part => part.type === "image")) {
        // Codex's SDK groups text before images within a message. End each segment
        // at its image so labels and trailing text retain their original ordering.
        let start = 0;
        content.forEach((part, index) => {
          if (part.type !== "image") return;
          converted.push({ role: "user", content: content.slice(start, index + 1), timestamp: Date.now() });
          start = index + 1;
        });
        if (start < content.length) converted.push({ role: "user", content: content.slice(start), timestamp: Date.now() });
      } else {
        converted.push({ role: "user", content, timestamp: Date.now() });
      }
      continue;
    }
    if (msg.role === "assistant") {
      const content: unknown[] = [];
      const text = textOf(msg.content);
      if (text) content.push({ type: "text", text });
      if (Array.isArray(msg.tool_calls)) {
        for (const call of msg.tool_calls) {
          if (!call || typeof call !== "object") continue;
          const rec = call as { id?: string; function?: { name?: string; arguments?: string } };
          content.push({
            type: "toolCall",
            id: rec.id ?? "call",
            name: rec.function?.name ?? "tool",
            arguments: toolArgumentsOf(rec.function?.arguments),
          });
        }
      }
      converted.push({
        role: "assistant",
        content,
        api: "openai-completions",
        provider,
        model: String(body.model ?? ""),
        usage: {},
        stopReason: "stop",
        timestamp: Date.now(),
      });
      continue;
    }
    if (msg.role === "tool") {
      converted.push({
        role: "toolResult",
        toolCallId: String(msg.tool_call_id ?? ""),
        toolName: String(msg.name ?? "tool"),
        content: [{ type: "text", text: textOf(msg.content) }],
        isError: false,
        timestamp: Date.now(),
      });
    }
  }
  const tools = Array.isArray(body.tools)
    ? body.tools.map((tool) => {
        const rec = tool as { function?: { name?: string; description?: string; parameters?: unknown } };
        return {
          name: rec.function?.name ?? "tool",
          description: rec.function?.description ?? "",
          parameters: rec.function?.parameters ?? { type: "object", properties: {} },
        };
      })
    : undefined;
  return { context: { systemPrompt, messages: converted as never[], tools }, imageDelivery };
}

function resolveModel(provider: string, modelId: string) {
  const exact = getBundledModel(provider as never, modelId);
  if (exact && typeof exact === "object" && "id" in exact) return exact;
  const fallbackId = getOhMyPiProvider(provider)?.defaultModel;
  if (fallbackId) {
    const fallback = getBundledModel(provider as never, fallbackId);
    if (fallback && typeof fallback === "object" && "id" in fallback) return fallback;
  }
  return getBundledModels(provider as never)[0];
}

function assistantToOpenAI(message: {
  content?: unknown[];
  errorMessage?: string;
  errorStatus?: number;
  stopReason?: string;
  model?: string;
}) {
  if (message.errorMessage || message.stopReason === "error" || message.stopReason === "aborted") {
    const err = new Error(message.errorMessage ?? `Provider completion ${message.stopReason}`) as Error & { status?: number };
    err.status = message.errorStatus || 500;
    throw err;
  }
  const texts: string[] = [];
  const tool_calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
  for (const part of message.content ?? []) {
    if (!part || typeof part !== "object") continue;
    const rec = part as { type?: string; text?: string; id?: string; name?: string; arguments?: unknown };
    if (rec.type === "text" && rec.text) texts.push(rec.text);
    if (rec.type === "toolCall") {
      // id 폴백은 호출마다 달라야 한다. 예전 `?? "call"` 은 id 없는 병렬 toolCall 두 건에
      // **같은 tool_call_id** 를 붙였고, 세션은 id 마다 role:"tool" 응답을 실으므로 중복
      // function response 가 되어 다음 라운드가 400 으로 죽는다(2026-08-30 실측 계열 결함).
      tool_calls.push({
        id: rec.id ?? `call_${tool_calls.length}_${rec.name ?? "tool"}`,
        type: "function",
        function: {
          name: rec.name ?? "tool",
          arguments: typeof rec.arguments === "string" ? rec.arguments : JSON.stringify(rec.arguments ?? {}),
        },
      });
    }
  }
  const finish = message.stopReason === "toolUse" ? "tool_calls" : "stop";
  return {
    id: `oh-my-pi-${Date.now()}`,
    object: "chat.completion",
    model: message.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: texts.join("") || null,
          tool_calls: tool_calls.length ? tool_calls : undefined,
        },
        finish_reason: finish,
      },
    ],
  };
}

export async function completeProvider(
  provider: string,
  body: Record<string, unknown>,
  options?: { fetch?: typeof fetch; apiKey?: string },
) {
  const modelId = typeof body.model === "string" ? body.model : getOhMyPiProvider(provider)?.defaultModel ?? "";
  const model = resolveModel(provider, modelId);
  if (!model) {
    const err = new Error(`oh-my-pi 카탈로그에 ${provider} 모델이 없습니다`);
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  const { context, imageDelivery } = openaiToContext(provider, body, model.input.includes("image"));
  if (testStub()) {
    return {
      stream: false,
      completion: {
        id: "oh-my-pi-stub",
        object: "chat.completion",
        model: (model as { id?: string }).id ?? modelId,
        provider,
        choices: [{
          index: 0,
          message: { role: "assistant", content: `stub:${provider}` },
          finish_reason: "stop",
        }],
      },
    };
  }
  const apiKey = options?.apiKey;
  const message = await complete(model as never, context as never, {
    ...(apiKey ? { apiKey } : {}),
    fetch: options?.fetch,
  } as never);
  const completion = assistantToOpenAI(message);
  return { stream: false, completion: { ...completion, image_delivery: imageDelivery } };
}
