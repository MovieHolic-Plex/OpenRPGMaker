import type { AiConfig } from "./llmClient";

export const DEFAULT_ULTRABRAIN_PROVIDER = "google-antigravity";
export const DEFAULT_ULTRABRAIN_MODEL = "gemini-3.8-flash";
export const DEFAULT_ULTRABRAIN_EFFORT = "high";

/**
 * 검수 한 번의 출력 예산.
 *
 * 왜 4096 이 아닌가(2026-09-18 실측): 검수기는 `high` 추론으로 돌고 추론 토큰이 이 예산 안에서
 * 소모된다. 맵 한 장짜리 판정이 추론만으로 4096 을 다 써 JSON 을 못 뱉었고 — `finish=length` —
 * 재시도도 같은 예산이라 같은 자리에서 또 끊겼다. 실제로 필요한 «출력» 은 요약 한 줄 + 지적 몇 줄로
 * 1000 토큰이 안 되므로, 추론이 들어갈 자리를 준다. 제공자 상한(Gemini 65,536)보다는 한참 아래다.
 */
export const ULTRABRAIN_REVIEW_MAX_TOKENS = 16_384;

/** Independent of the writer's model, provider, and autonomy dial. */
export function configForUltrabrain(config: AiConfig): AiConfig {
  return { ...config, authMode: "chatgpt", apiKey: "",
    providerId: config.ultrabrainProviderId ?? DEFAULT_ULTRABRAIN_PROVIDER,
    model: config.ultrabrainModel?.trim() || DEFAULT_ULTRABRAIN_MODEL,
    reasoningEffort: config.ultrabrainReasoningEffort ?? DEFAULT_ULTRABRAIN_EFFORT,
    maxTokens: Math.min(config.maxTokens, ULTRABRAIN_REVIEW_MAX_TOKENS),
  };
}

/** Once role settings are saved, retained region sessions also use the planner selection.
 * Explicit legacy/test configurations without role settings keep their existing contract.
 */
export function configForLegacySupervisor(config: AiConfig): AiConfig {
  return config.roleModels && Object.keys(config.roleModels).length > 0
    ? { ...configForUltrabrain(config), maxTokens: config.maxTokens } : config;
}
