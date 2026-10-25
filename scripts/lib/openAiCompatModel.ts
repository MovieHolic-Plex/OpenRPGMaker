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
    const response = await base(input as never, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      throw Object.assign(new Error(`서버가 다른 주소로 넘기려 해요(${response.status}). 보안상 따라가지 않아요. 최종 주소를 기본 주소로 넣으세요.`), { status: 502 });
    }
    return response;
  }) as typeof fetch;
}

/** 실행 오류 원문을 「무엇을 고치면 되는지」 로 바꾼다(원문은 뒤에 남는다). 사용자 지정 제공자가 아니면 그대로. */
export function explainOpenAiCompatRunError(provider: string, message: string | undefined): string | undefined {
  if (!message || !isOpenAiCompatProviderId(provider)) return message;
  const endpoint = registry.get(provider);
  return explainOpenAiCompatError(message, { name: endpoint?.name ?? "사용자 지정 엔드포인트", ...(endpoint ? { baseUrl: endpoint.baseUrl } : {}) });
}
