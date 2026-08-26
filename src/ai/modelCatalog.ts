import { getOhMyPiProvider, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";

export interface AiModelCatalogGroup {
  readonly label: string;
  readonly models: readonly string[];
}

/**
 * Codex(ChatGPT 구독) 경로에서 실제로 고를 수 있는 모델.
 *
 * 이 경로는 @oh-my-pi/pi-ai 가 전송을 맡고, 모델은 @oh-my-pi/pi-catalog 의
 * `getBundledModels("openai-codex")` 에서만 해석된다. 카탈로그에 없는 ID 를 보내면 오류가 아니라
 * **조용히 제공자 기본 모델로 떨어진다** — 실측(2026-08-21, 동반 서비스에 같은 본문을 모델만 바꿔 재생):
 *   gpt-5.5           → model=gpt-5.5  "OK"
 *   gpt-5.1-codex-max → model=gpt-5.5  "OK"   ← 카탈로그 밖. 요청한 모델이 무시됐다.
 *   cpen/gpt-5-6-luna → model=gpt-5.5  "OK"   ← 마찬가지
 * 그래서 목록은 pi-catalog 와 동일해야 한다. 옛 목록에는 codex 계열 11개가 더 있었지만
 * 전부 이 조용한 강등에 걸렸다. 첫 항목은 기존 기본값(gpt-5.6-sol)을 유지한다.
 */
const CHATGPT_OAUTH_MODELS: readonly AiModelCatalogGroup[] = [
  {
    label: "ChatGPT 구독 · Codex",
    models: [
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex-spark",
      "gpt-daybreak-blue-latest",
    ],
  },
];

/** 게이트웨이/직접 API 는 pi-catalog 제약을 받지 않으므로 OpenAI 계열을 넓게 유지한다. */
const OPENAI_GATEWAY_MODELS: AiModelCatalogGroup = {
  label: "OpenAI · API/게이트웨이",
  models: [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
    "gpt-5.3-codex",
    "gpt-5.3-codex-spark",
    "gpt-5.2-codex",
    "gpt-5.2",
    "gpt-5.1-codex-max",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    "gpt-5.1",
    "gpt-5-codex",
    "gpt-5-codex-mini",
    "gpt-5",
    "codex-auto-review",
  ],
};

const API_GATEWAY_MODELS: readonly AiModelCatalogGroup[] = [
  OPENAI_GATEWAY_MODELS,
  {
    label: "Anthropic · API/게이트웨이",
    models: ["claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"],
  },
  {
    label: "Google Gemini · API/게이트웨이",
    models: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    label: "xAI Grok · API/게이트웨이",
    models: ["grok-4.3", "grok-code-fast-1", "grok-build-0.1", "grok-4.1-fast", "grok-4"],
  },
  {
    label: "그 외 GJC 레지스트리 · API/게이트웨이",
    models: ["deepseek-v4-pro", "deepseek-v4-flash", "qwen3.7-max", "qwen3.7-plus", "MiniMax-M3", "kimi-k2.7-code", "glm-5.2", "glm-5.2-ultrafast", "z-ai/glm-5.2-ultrafast"],
  },
  {
    // qwencloud(알리바바 MaaS) 전용 경로 — baseUrl 을 /api/qwen 으로 설정해야 동작한다.
    label: "Qwen · qwencloud",
    models: ["qwen3.8-max-preview"],
  },
  {
    // cpenrouter.space 전용 경로 — baseUrl 을 /api/cpen 으로 설정해야 동작한다.
    // 모델 목록은 라이브 GET https://cpenrouter.space/v1/models 응답(12종) 그대로다.
    // cpen/100/... 변종 6종은 같은 모델 이름에 100/ 이 끼워진 형태(컨텍스트 변형).
    // 기본 선택이 쉽도록 채팅 완성 실측 성공 모델 cpen/gemini-3-flash 를 맨 앞에 둔다.
    label: "cpenrouter · cpenrouter.space",
    models: [
      "cpen/gemini-3-flash",
      "cpen/gpt-5-6-luna",
      "cpen/gpt-5-6-terra",
      "cpen/gpt-5-4-mini",
      "cpen/gemini-3-1-flash-lite",
      "cpen/gemini-flash-2-5",
      "cpen/100/gemini-3-flash",
      "cpen/100/gpt-5-6-luna",
      "cpen/100/gpt-5-6-terra",
      "cpen/100/gpt-5-4-mini",
      "cpen/100/gemini-3-1-flash-lite",
      "cpen/100/gemini-flash-2-5",
    ],
  },
];

/**
 * Provider-native choices that the editor intentionally recommends ahead of the broad
 * gateway catalog. Keep the first item equal to the provider default.
 */
const OH_MY_PI_PROVIDER_MODELS: Readonly<Record<string, readonly string[]>> = {
  "google-antigravity": [
    "gemini-3.7-flash-high",
    "gemini-3.7-flash",
    "gemini-3.1-pro",
  ],
};

export function modelCatalogForAuthMode(
  authMode: "chatgpt" | "apiKey",
  providerId?: string,
): readonly AiModelCatalogGroup[] {
  const provider = getOhMyPiProvider(parseOhMyPiProvider(providerId));
  if (authMode === "chatgpt" && (!provider || provider.id === "openai-codex")) {
    return CHATGPT_OAUTH_MODELS;
  }
  if (authMode === "chatgpt" && provider && provider.id !== "openai-codex") {
    const providerModels = OH_MY_PI_PROVIDER_MODELS[provider.id];
    if (providerModels) {
      return [{ label: `${provider.label} · oh-my-pi`, models: providerModels }];
    }
    return [
      { label: `${provider.label} · oh-my-pi`, models: [provider.defaultModel] },
      ...API_GATEWAY_MODELS,
    ];
  }
  return API_GATEWAY_MODELS;
}

/**
 * 해당 authMode 의 권장 기본 모델. 카탈로그 첫 그룹의 첫 항목을 기준으로 한다.
 * 공장 기본은 Antigravity 의 gemini-3.7-flash-high — 모든 모델 슬롯이 이 값을 기본으로 쓴다
 * (감독 지시 2026-08-26, 계약은 test/aiDefaultModelForced.test.ts 가 고정한다).
 * Codex 카탈로그 첫 항목은 gpt-5.6-sol.
 * 카탈로그가 비어 있을 리 없지만(방어), 비어 있으면 빈 문자열을 돌려 호출자가 자기 폴백을 쓰게 한다.
 */
export function defaultModelForAuthMode(authMode: "chatgpt" | "apiKey", providerId?: string): string {
  const groups = modelCatalogForAuthMode(authMode, providerId);
  return groups[0]?.models[0] ?? "";
}

/**
 * 모델 ID 가 해당 authMode 에서 실제로 쓸 수 있는지 판정한다.
 *
 * 일반 원칙은 그대로다 — 카탈로그는 '추천 목록'이지 화이트리스트가 아니고, 사용자가 공급자별
 * ID 를 직접 입력하는 것은 정상 사용이다. apiKey 모드는 어떤 ID 든 허용한다.
 *
 * 예외는 Codex(ChatGPT 구독) 하나다. 이 경로는 pi-catalog 에 등재된 ID 만 해석되고,
 * 나머지는 오류 없이 제공자 기본 모델로 강등된다(근거는 CHATGPT_OAUTH_MODELS 주석의 실측).
 * 조용히 다른 모델이 답하는 편보다 미리 거부하는 편이 낫기 때문에, 여기서만 카탈로그를
 * 허용 목록으로 쓴다. 옛 판정("gpt- 로 시작하면 통과")은 gpt-5.1-codex 같은 강등 대상을
 * 그대로 통과시켰다.
 */
export function isModelValidForAuthMode(
  authMode: "chatgpt" | "apiKey",
  model: string,
  providerId?: string,
): boolean {
  if (authMode !== "chatgpt") return true;
  if (parseOhMyPiProvider(providerId) !== "openai-codex") return true;
  const wanted = model.trim().toLowerCase();
  return CHATGPT_OAUTH_MODELS.some((group) => group.models.some((id) => id.toLowerCase() === wanted));
}
