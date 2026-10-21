// 완성(completion) 전송 전용 pi-ai 어댑터.
//
// 분리 경계: 자감·로그인·갱신은 scripts/lib/aiAuthRuntime.ts 가 순수 Node 에서 다 처리하고,
// 이 파일은 이미 부혼 자겁문자열(apiKey)를 받아 모델 호출만 한다. pi-ai 는 bun:sqlite 를
// 싣고 오므로 Bun 에서만 로드되며, 그 Bun 의존이 인증 경로로 새지 않는 것이 이 경계의 목적이다.

import { localCliIdOf } from "./localCliAgent/types.ts";
import { LOCAL_CLI_ADAPTERS, localCliBinary } from "./localCliAgent/registry.ts";
import { completeSimple } from "@oh-my-pi/pi-ai";
import { resolveOhMyPiModel } from "./ohMyPiModel.ts";
import { getOhMyPiProvider } from "../../src/ai/ohMyPiProviders.ts";
import type { ImageDelivery } from "../../src/ai/imageDelivery.ts";
import { convertUserContent, hasImagePart, ImageTransportError } from "./ohMyPiUserContent.ts";
import { antigravityToolEnumPayload } from "./ohMyPiToolEnums.ts";
import { applyLegacyEnvAliases } from "./oprnEnv.mjs";
import { codexVersionFetch } from "./codexClientVersion.ts";
import { isOpenAiCompatProviderId } from "../../src/ai/openAiCompat.ts";
import { explainOpenAiCompatRunError, guardedOpenAiCompatFetch, shapeOpenAiCompatCall } from "./openAiCompatModel.ts";

applyLegacyEnvAliases();

function testStub(): boolean {
  return process.env.OPRN_OH_MY_PI_TEST_STUB === "1";
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

export function openaiToContext(provider: string, body: Record<string, unknown>) {
  return openaiToContextWithDelivery(provider, body, true).context;
}

function openaiToContextWithDelivery(provider: string, body: Record<string, unknown>, supportsImages: boolean) {
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
  const finish = message.stopReason === "toolUse" ? "tool_calls" : message.stopReason === "length" ? "length" : "stop";
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

/** OpenAI chat 본문 → CLI 한 차례 지시문. 그림은 싣지 않는다(이름만 남긴다). JSON 응답 요청은 문장으로 옮긴다. */
function openAiBodyAsPrompt(body: Record<string, unknown>): { prompt: string; images: { mimeType: string; data: string }[]; imageDelivery: ImageDelivery[] } {
  const messages = Array.isArray(body.messages) ? body.messages as { role?: string; content?: unknown }[] : [];
  // 실제로 CLI 에 실은 그림의 자리(메시지·파트 번호). 검수 호출자(unusableReviewReason)는 이 영수증이 없으면 「그림이 안 갔다」로 보고
  // 응답을 버린다 — 예전에는 로컬 CLI 경로가 이걸 돌려주지 않아 Claude Code 엔진의 전체 맵 검수가 매번 「검수 응답을 받지 못했습니다」로
  // 끝났다(2026-10-22 조수 능력 루프 r3: 21건 중 7건 화면에 「#4 전체 검수 작업을 끝내지 못했어요」).
  const imageDelivery: ImageDelivery[] = [];
  // 그림(image_url data URL)은 글로 바꾸지 않고 CLI 에 실제 그림으로 넘긴다 — 시각 검토가 그림 없이 판정하던 문제(2026-10-20 실측:
  // 「이미지 생략」을 받은 검토자가 판정 불가로 답했다). 원격 URL 그림은 받지 않는다(우리 쪽에서 내려받지 않는다).
  const images: { mimeType: string; data: string }[] = [];
  const text = messages.map((message, messageIndex) => {
    const content = typeof message.content === "string" ? message.content
      : Array.isArray(message.content) ? message.content.map((part, partIndex) => {
        const p = part as { type?: string; text?: string; image_url?: { url?: string } | string };
        if (p.type === "text" || p.type === "input_text") return p.text ?? "";
        const url = typeof p.image_url === "string" ? p.image_url : p.image_url?.url;
        const match = typeof url === "string" ? /^data:(image\/[a-z+.-]+);base64,(.+)$/isu.exec(url) : null;
        if (p.type === "image_url" && match) { images.push({ mimeType: match[1]!, data: match[2]! }); imageDelivery.push({ messageIndex, partIndex }); return `[그림 ${images.length}]`; }
        return p.type ? `[${p.type} 생략]` : "";
      }).join("\n") : "";
    return `[${message.role ?? "user"}]\n${content}`;
  }).join("\n\n");
  const format = (body.response_format as { type?: string } | undefined)?.type;
  return { prompt: format === "json_object" || format === "json_schema" ? `${text}\n\n[응답 형식] 다른 말 없이 JSON 객체 하나만 출력하라.` : text, images, imageDelivery };
}

export async function completeProvider(
  provider: string,
  body: Record<string, unknown>,
  options?: { fetch?: typeof fetch; apiKey?: string; signal?: AbortSignal },
) {
  const modelId = typeof body.model === "string" ? body.model : getOhMyPiProvider(provider)?.defaultModel ?? "";
  // 로컬 CLI 엔진(local-cli:*): 보조 글 생성(의도 선언·JSON 응답 등)도 사용자의 CLI 가 한다. 도구 호출(tools)은 싣지 않는다 —
  // 그런 호출자는 글 응답을 받는다(조수 본 루프의 도구는 runPiAgent 가 MCP 로 따로 준다).
  const cli = localCliIdOf(provider);
  if (cli) {
    const { prompt, images, imageDelivery } = openAiBodyAsPrompt(body);
    const text = await LOCAL_CLI_ADAPTERS[cli].complete(prompt, { binary: localCliBinary(cli), ...(modelId ? { model: modelId } : {}), ...(options?.signal ? { signal: options.signal } : {}), ...(images.length ? { images } : {}) });
    return { stream: false, completion: { id: `local-cli-${Date.now()}`, object: "chat.completion", model: modelId, provider,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], image_delivery: imageDelivery } };
  }
  const model = resolveOhMyPiModel(provider, modelId);
  if (!model) {
    const err = new Error(`oh-my-pi 카탈로그에 ${provider} 모델이 없습니다`);
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  const { context, imageDelivery } = openaiToContextWithDelivery(provider, body, model.input.includes("image"));
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
  // 사용자 지정 엔드포인트: 추론 강도를 엔드포인트가 정한 방식(none/field/suffix)으로 맞춘다. 차단 모델은 여기서도 403 으로 거절한다.
  const shaped = isOpenAiCompatProviderId(provider)
    ? shapeOpenAiCompatCall(provider, model as { id: string; name?: string }, completionThinkingOptions(body, provider))
    : { model, options: completionThinkingOptions(body, provider) };
  const message = await completeSimple(shaped.model as never, context as never, {
    ...(apiKey ? { apiKey } : {}),
    fetch: provider === "openai-codex" ? codexVersionFetch(options?.fetch ?? fetch)
      : isOpenAiCompatProviderId(provider) ? guardedOpenAiCompatFetch(options?.fetch ?? fetch) : options?.fetch,
    signal: options?.signal,
    ...shaped.options,
    // 사용자 지정 엔드포인트는 출력 상한을 서버가 모른 채 거절하는 일이 흔하다 — 엔드포인트 설정의 상한으로 낮춰 보낸다.
    ...(typeof body.max_tokens === "number"
      ? { maxTokens: isOpenAiCompatProviderId(provider) && typeof model.maxTokens === "number" ? Math.min(body.max_tokens, model.maxTokens) : body.max_tokens }
      : {}),
    ...(provider === "google-antigravity" && context.tools?.length
      ? { onPayload: antigravityToolEnumPayload(model.id, context.tools) }
      : {}),
  } as never);
  let completion;
  try {
    completion = assistantToOpenAI(message);
  } catch (error) {
    // 사용자 지정 엔드포인트는 원문 오류(401·404·도구 미지원…)를 「무엇을 고치면 되는지」 문장으로 바꿔 올린다.
    if (isOpenAiCompatProviderId(provider) && error instanceof Error) error.message = explainOpenAiCompatRunError(provider, error.message) ?? error.message;
    throw error;
  }
  return { stream: false, completion: { ...completion, image_delivery: imageDelivery } };
}

/** OpenAI envelope -> OMP simple options, which own wire model/effort routing. */
export function completionThinkingOptions(body: Record<string, unknown>, provider?: string) {
  const effort = (body.reasoning as { effort?: unknown } | undefined)?.effort;
  if (effort === "low" || effort === "medium" || effort === "high") return { reasoning: effort };
  return provider === "google-antigravity" ? { reasoning: "low" as const } : {};
}
