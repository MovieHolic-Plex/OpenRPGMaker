export interface AiModelCatalogGroup {
  readonly label: string;
  readonly models: readonly string[];
}

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
  },
];

const API_GATEWAY_MODELS: readonly AiModelCatalogGroup[] = [
  ...CHATGPT_OAUTH_MODELS,
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

export function modelCatalogForAuthMode(authMode: "chatgpt" | "apiKey"): readonly AiModelCatalogGroup[] {
  return authMode === "chatgpt" ? CHATGPT_OAUTH_MODELS : API_GATEWAY_MODELS;
}

/**
 * 해당 authMode 의 권장 기본 모델. 카탈로그 첫 그룹의 첫 항목을 기준으로 한다.
 * connectionPresets 의 chatgpt 프리셋 기본 모델(gpt-5.6-sol)과 같은 출처다.
 * 카탈로그가 비어 있을 리 없지만(방어), 비어 있으면 빈 문자열을 돌려 호출자가 자기 폴백을 쓰게 한다.
 */
export function defaultModelForAuthMode(authMode: "chatgpt" | "apiKey"): string {
  const groups = modelCatalogForAuthMode(authMode);
  return groups[0]?.models[0] ?? "";
}

/**
 * 모델 ID 가 해당 authMode 에서 실제로 쓸 수 있는지 판정한다.
 *
 * modelCatalogForAuthMode 는 '추천 목록'이지 전체 허용 목록이 아니다. 설정 UI 문구
 * ("목록에서 고르거나 공급자별 모델 ID를 직접 입력하세요")가 안내하듯, 사용자가 목록에 없는
 * 공급자별 ID 를 직접 입력하는 것은 정상 사용이다. 그래서 '카탈로그에 없으면 무효' 로 판정하면
 * 정상 입력을 잘못 거부한다 — 이 함수는 절대 카탈로그를 화이트리스트로 쓰지 않는다.
 *
 * 대신 실측으로 확인된 명백한 불일치만 잡는다. 판정 근거는 다음 하나뿐이다:
 *   요청 실패(400) — {"detail":"The 'z-ai/glm-5.2-ultrafast' model is not supported when
 *   using Codex with a ChatGPT account."}
 * 즉 authMode === "chatgpt"(Codex)는 `gpt-` 로 시작하지 않는 모델을 거부한다.
 * 그 밖의 규칙은 실측 근거가 없으므로 추측해서 추가하지 않는다.
 * apiKey 모드는 공급자가 다양하므로 어떤 ID 든 허용한다.
 */
export function isModelValidForAuthMode(authMode: "chatgpt" | "apiKey", model: string): boolean {
  if (authMode !== "chatgpt") return true;
  return model.trim().toLowerCase().startsWith("gpt-");
}
