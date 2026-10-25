// 사용자 지정(OpenAI 호환) 엔드포인트 — Bun 워커 쪽 모델 구성과 전송 보호.
//
// 새 전송을 만들지 않는다. oh-my-pi 는 이미 `openai-completions` 전송(Chat Completions + SSE + 도구 호출 + 이미지 content part +
// reasoning_effort)을 갖고 있고, `buildModel`(@oh-my-pi/pi-catalog)이 임의의 baseUrl·헤더·호환 플래그로 모델을 만든다 —
// oh-my-pi 자신의 models.yml 사용자 지정 제공자가 쓰는 같은 경로다. 여기서는 에디터 저장소가 고른 값으로 그 모델을 만들 뿐이다.
//
// 워커에는 인증·저장소가 없다(oh-my-pi-worker.ts 머리말). 호스트가 요청마다 `compatEndpoints` 를 실어 보내고,
// 키는 기존 providerApiKeys 로 따로 온다. 브라우저가 보낸 값은 여기에 닿지 않는다 — 주소는 항상 호스트 저장소의 것이다.

import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { lookup } from "node:dns/promises";
import {
  checkOpenAiCompatBaseUrl,
  explainOpenAiCompatError,
  isBlockedOpenAiCompatHost,
  isOpenAiCompatProviderId,
  openAiCompatModelSeesImages,
  openAiCompatModelVerdict,
  openAiCompatSuffixedModelId,
  type OpenAiCompatWorkerEndpoint,
} from "../../src/ai/openAiCompat.ts";

const registry = new Map<string, OpenAiCompatWorkerEndpoint>();

/** 요청이 싣고 온 엔드포인트 정의를 등록한다. 같은 id 는 최신 값으로 갈아 끼운다. */
export function registerOpenAiCompatEndpoints(list: Record<string, OpenAiCompatWorkerEndpoint> | undefined): void {
  if (!list || typeof list !== "object") return;
  for (const [id, endpoint] of Object.entries(list)) {
    if (isOpenAiCompatProviderId(id) && endpoint && typeof endpoint.baseUrl === "string") registry.set(id, endpoint);
  }
}

export function openAiCompatEndpoint(id: string): OpenAiCompatWorkerEndpoint | undefined {
  return registry.get(id);
}

/** 모델 구성 — 실패하면 status 400 의 사람 말 오류. 모델 ID 를 다른 것으로 대체하지 않는다. */
export function resolveOpenAiCompatModel(provider: string, requested?: string) {
  const endpoint = registry.get(provider);
  if (!endpoint) {
    throw Object.assign(new Error("사용자 지정 엔드포인트 정보가 이 실행에 실려 오지 않았습니다. AI 설정 → 연결에서 엔드포인트를 확인하세요. 다른 모델로 대체하지 않았습니다."), { status: 400 });
  }
  const id = requested?.trim();
  if (!id) {
    throw Object.assign(new Error(`${endpoint.name}: 모델이 선택되지 않았어요. AI 설정에서 모델을 고르거나 모델 ID 를 입력하세요.`), { status: 400 });
  }
  // 차단·비허용 모델은 모델 구성 단계에서 거절한다 — 요청이 네트워크에 나가기 전이고 다른 모델로 바꾸지 않는다.
  const verdict = openAiCompatModelVerdict(endpoint, id);
  if (!verdict.allowed) {
    throw Object.assign(new Error(`${endpoint.name}: 모델 「${id}」 호출을 거절했어요. ${verdict.reason ?? ""} 다른 모델로 바꿔 보내지 않아요.`), { status: 403 });
  }
  const timeoutMs = endpoint.firstTokenTimeoutSec * 1000;
  return buildModel({
    id,
    name: id,
    api: "openai-completions",
    provider: provider as never,
    baseUrl: endpoint.baseUrl,
    // reasoning 을 끄면 pi-ai 는 reasoning_effort 를 실을 이유가 없다 — 모르는 인자를 400 으로 거절하는 서버의 기본 경로.
    reasoning: endpoint.reasoningMode === "field",
    // 그림은 모델마다 따진다 — 같은 엔드포인트에서도 그림을 못 보는 모델은 그림이 든 요청에 빈 답을 준다(2026-10-25 실측).
    // 그림을 못 보는 모델이면 pi-ai 가 그림 자리를 글 한 줄로 바꿔 보낸다. 강도 접미사가 붙는 경우는 shapeOpenAiCompatCall 이 최종 ID 로 다시 정한다.
    input: openAiCompatModelSeesImages(endpoint, id) ? ["text", "image"] : ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: endpoint.contextWindow,
    maxTokens: endpoint.maxOutputTokens,
    ...(Object.keys(endpoint.headers).length ? { headers: { ...endpoint.headers } } : {}),
    compat: {
      supportsReasoningEffort: endpoint.reasoningMode === "field",
      // 서드파티 서버의 공통 분모: store·developer 역할을 모르고, max_tokens 가 가장 널리 통한다.
      supportsStore: false,
      supportsDeveloperRole: false,
      maxTokensField: "max_tokens",
      // 도구 스키마는 strict 없이 보낸다 — strict 를 모르는 서버(LM Studio·일부 vLLM)가 400 으로 거절한다.
      toolStrictMode: "none",
      streamFirstEventTimeoutMs: timeoutMs,
      streamIdleTimeoutMs: Math.max(timeoutMs, 120_000),
    },
  } as never);
}

/**
 * 호출 직전에 추론 강도를 엔드포인트가 정한 방식으로 맞춘다. pi-ai 는 `options.reasoning` 을 `reasoning_effort` 필드로 옮기는데
 * (model.reasoning 이 켜진 경우만), 그 방식이 맞지 않는 서버에서는 필드를 막고 모델 ID 접미사로 돌린다.
 *  - none:   reasoning 옵션을 지운다 → 요청 본문에 강도가 없다.
 *  - field:  그대로 둔다.
 *  - suffix: 모델 ID 에 -low/-medium/-high 를 붙이고 reasoning 옵션을 지운다.
 */
export function shapeOpenAiCompatCall<M extends { id: string; name?: string }, O extends Record<string, unknown> | undefined>(
  provider: string, model: M, options: O,
): { model: M; options: O } {
  const endpoint = registry.get(provider);
  if (!endpoint) return { model, options };
  const direct = openAiCompatModelVerdict(endpoint, model.id);
  if (!direct.allowed) throw Object.assign(new Error(`${endpoint.name}: 모델 「${model.id}」 호출을 거절했어요. ${direct.reason ?? ""} 다른 모델로 바꿔 보내지 않아요.`), { status: 403 });
  if (endpoint.reasoningMode === "field" || !options) return { model: withImageInput(endpoint, model, model.id), options };
  const { reasoning, ...rest } = options as Record<string, unknown>;
  if (endpoint.reasoningMode === "none") return { model: withImageInput(endpoint, model, model.id), options: rest as O };
  const id = openAiCompatSuffixedModelId(model.id, typeof reasoning === "string" ? reasoning : undefined);
  // 접미사가 붙은 최종 ID 도 같은 패턴을 지켜야 한다(허용 패턴이 접미사를 막을 수 있다).
  const verdict = openAiCompatModelVerdict(endpoint, id);
  if (!verdict.allowed) throw Object.assign(new Error(`${endpoint.name}: 모델 「${id}」 호출을 거절했어요. ${verdict.reason ?? ""} 다른 모델로 바꿔 보내지 않아요.`), { status: 403 });
  return { model: withImageInput(endpoint, id === model.id ? model : { ...model, id, name: id }, id), options: rest as O };
}

/** 최종 모델 ID 가 그림을 보는지에 맞춰 input 을 고친다(바뀔 때만 사본). */
function withImageInput<M extends { id: string }>(endpoint: OpenAiCompatWorkerEndpoint, model: M, finalId: string): M {
  const current = (model as { input?: readonly string[] }).input;
  if (!Array.isArray(current)) return model;
  const sees = openAiCompatModelSeesImages(endpoint, finalId);
  if (sees === current.includes("image")) return model;
  return { ...model, input: sees ? ["text", "image"] : ["text"] };
}

/**
 * 전송용 fetch. 리다이렉트를 따라가지 않고(호스트가 검증한 주소 밖으로 자격이 새는 길을 닫는다),
 * 요청 직전에 호스트가 메타데이터·링크로컬이 아닌지 다시 본다. 사용자가 고른 주소의 호스트만 받는다.
 */
export function guardedOpenAiCompatFetch(base: typeof fetch = fetch): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const check = checkOpenAiCompatBaseUrl(raw);
    if (!check.ok) throw Object.assign(new Error(check.error ?? "허용되지 않는 주소입니다."), { status: 400 });
    const host = new URL(raw).hostname;
    if (isBlockedOpenAiCompatHost(host)) throw Object.assign(new Error("이 주소(클라우드 메타데이터·링크로컬)에는 연결하지 않아요."), { status: 400 });
    if (!/^[\d.]+$/u.test(host) && !host.includes(":")) {
      try {
        const addresses = await lookup(host, { all: true });
        if (addresses.some((entry) => isBlockedOpenAiCompatHost(entry.address))) {
          throw Object.assign(new Error(`${host} 이(가) 클라우드 메타데이터·링크로컬 주소로 연결돼 있어 막았어요.`), { status: 400 });
        }
      } catch (error) {
        if (error && typeof error === "object" && "status" in error) throw error;
      }
    }
    const send = async (body: RequestInit["body"] | undefined): Promise<Response> => {
      const response = await base((typeof input === "string" || input instanceof URL ? input : raw) as never, { ...init, ...(body !== undefined ? { body } : {}), redirect: "manual" });
      if (response.status >= 300 && response.status < 400) {
        throw Object.assign(new Error(`서버가 다른 주소로 넘기려 해요(${response.status}). 보안상 따라가지 않아요. 최종 주소를 기본 주소로 넣으세요.`), { status: 502 });
      }
      return response;
    };
    const response = await send(undefined);
    if (!isChatCompletionsCall(raw, init)) return response;
    // 빈 답 지키기. CLIProxyAPI(mdc-server:8318)는 이미지가 든 요청에 200 + 빈 내용(content:null, 도구 호출 없음, stop)을 돌려준다
    // (2026-10-25 실측, /v1/chat/completions·/v1/messages 둘 다). 그대로 넘기면 조수는 아무 말 없이 턴을 끝낸다.
    // 이미지가 있었으면 이미지 자리를 「못 봤다」는 글로 바꿔 한 번 더 보내고, 그래도 비면 사람 말 오류로 바꾼다.
    const first = await inspectChatReply(response);
    if (!first.empty) return first.response;
    const stripped = typeof init?.body === "string" ? stripImageParts(init.body) : null;
    if (stripped !== null) {
      const retry = await send(stripped);
      if (!retry.ok) return retry;
      const second = await inspectChatReply(retry);
      if (!second.empty) return second.response;
    }
    return emptyReplyResponse(stripped !== null);
  }) as typeof fetch;
}

// ── 빈 답 지키기 ──────────────────────────────────────────────────────────────

/** 서버가 이미지를 받지 못해 빼고 다시 보냈다는 표시. 모델이 그림을 본 척하지 않도록 이미지 자리에 남긴다. */
export const OPENAI_COMPAT_IMAGE_OMITTED_NOTE = "[이미지 생략: 이 서버가 이미지가 든 요청에 빈 답을 돌려줘서 이미지 없이 다시 보냈어요. 이 그림은 보지 못했어요.]";

function isChatCompletionsCall(url: string, init: RequestInit | undefined): boolean {
  return (init?.method ?? "GET").toUpperCase() === "POST" && /\/chat\/completions(?:\?|$)/u.test(url);
}

/** 요청 본문(JSON 문자열)의 image_url 조각을 글 조각으로 바꾼다. 이미지가 없거나 JSON 이 아니면 null. */
export function stripImageParts(body: string): string | null {
  if (!body.includes("image_url")) return null;
  let parsed: { messages?: unknown };
  try { parsed = JSON.parse(body) as { messages?: unknown }; } catch { return null; }
  if (!Array.isArray(parsed.messages)) return null;
  let changed = false;
  const messages = parsed.messages.map((message) => {
    const content = (message as { content?: unknown })?.content;
    if (!Array.isArray(content)) return message;
    let replaced = false;
    const next = content.flatMap((part) => {
      if ((part as { type?: unknown })?.type !== "image_url") return [part];
      changed = true;
      // 이미지 여러 장이 연달아 있으면 표시는 한 번만 남긴다.
      if (replaced) return [];
      replaced = true;
      return [{ type: "text", text: OPENAI_COMPAT_IMAGE_OMITTED_NOTE }];
    });
    return { ...(message as object), content: next };
  });
  return changed ? JSON.stringify({ ...parsed, messages }) : null;
}

type ChatChoice = { delta?: Record<string, unknown>; message?: Record<string, unknown> };

/** 모델이 무언가를 돌려준 조각인가 — 글·도구 호출·생각(추론)·오류. 역할만 있는 첫 조각과 usage 조각은 아니다. */
function chunkHasSubstance(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  if ("error" in payload) return true;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return false;
  return choices.some((choice: ChatChoice) => {
    const part = choice?.delta ?? choice?.message;
    if (!part || typeof part !== "object") return false;
    const nonEmpty = (value: unknown) => (typeof value === "string" && value.length > 0) || (Array.isArray(value) && value.length > 0);
    return nonEmpty(part.content) || nonEmpty(part.tool_calls) || nonEmpty(part.function_call ? [part.function_call] : undefined)
      || nonEmpty(part.reasoning_content) || nonEmpty(part.reasoning) || nonEmpty(part.reasoning_details) || nonEmpty(part.refusal);
  });
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)));
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

/**
 * 응답이 빈 답인지 본다. 스트림(SSE)은 내용이 담긴 첫 조각이 올 때까지만 모아 두었다가, 오면 모은 것부터 그대로 흘려보낸다
 * (스트림 전체를 붙잡지 않는다). 내용 없이 끝나면 empty. 200 이 아니거나 본문이 없으면 건드리지 않는다.
 */
export async function inspectChatReply(response: Response): Promise<{ empty: boolean; response: Response }> {
  if (!response.ok || !response.body) return { empty: false, response };
  const init = { status: response.status, statusText: response.statusText, headers: response.headers };
  const isStream = (response.headers.get("content-type") ?? "").includes("text/event-stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const held: Uint8Array[] = [];
  let pending = "";
  let substance = false;
  let finished = false;
  while (!substance) {
    const { value, done } = await reader.read();
    if (done) { finished = true; break; }
    held.push(value);
    if (!isStream) continue; // JSON 본문은 끝까지 모아 한 번에 본다
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split(/\r?\n/u);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      try { if (chunkHasSubstance(JSON.parse(data))) { substance = true; break; } } catch { substance = true; break; } // 모르는 형식은 그대로 넘긴다
    }
  }
  if (!isStream && finished) {
    const bytes = concatBytes(held);
    try { substance = chunkHasSubstance(JSON.parse(new TextDecoder().decode(bytes))); } catch { substance = true; }
    return { empty: !substance, response: new Response(bytes, init) };
  }
  if (finished) {
    if (!substance && pending.trim()) {
      const data = pending.startsWith("data:") ? pending.slice(5).trim() : "";
      try { substance = Boolean(data && data !== "[DONE]" && chunkHasSubstance(JSON.parse(data))); } catch { substance = true; }
    }
    return { empty: !substance, response: new Response(concatBytes(held), init) };
  }
  // 내용이 왔다 — 모아 둔 조각을 먼저 내보내고 나머지는 원래 스트림에서 그대로 잇는다.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { for (const chunk of held) controller.enqueue(chunk); },
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) controller.close(); else controller.enqueue(value);
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return { empty: false, response: new Response(stream, init) };
}

/** 빈 답을 사람 말 오류로. 422 — 5xx 처럼 SDK 가 같은 요청을 자동 재시도하지 않게 한다. 「empty reply」 는 explainOpenAiCompatError 의 표지다. */
function emptyReplyResponse(retriedWithoutImages: boolean): Response {
  const message = `empty reply: 서버가 빈 답을 돌려줬어요(글·도구 호출 없음)${retriedWithoutImages ? ". 이미지를 빼고 다시 보내도 빈 답이었어요" : ""}.`;
  return new Response(JSON.stringify({ error: { message, type: "empty_reply" } }), { status: 422, headers: { "content-type": "application/json" } });
}

/** 실행 오류 원문을 「무엇을 고치면 되는지」 로 바꾼다(원문은 뒤에 남는다). 사용자 지정 제공자가 아니면 그대로. */
export function explainOpenAiCompatRunError(provider: string, message: string | undefined): string | undefined {
  if (!message || !isOpenAiCompatProviderId(provider)) return message;
  const endpoint = registry.get(provider);
  return explainOpenAiCompatError(message, { name: endpoint?.name ?? "사용자 지정 엔드포인트", ...(endpoint ? { baseUrl: endpoint.baseUrl } : {}) });
}
