import type { AiConfig } from "./llmClient";

export const DEFAULT_ULTRABRAIN_PROVIDER = "google-antigravity";
export const DEFAULT_ULTRABRAIN_MODEL = "gemini-3.8-flash";
export const DEFAULT_ULTRABRAIN_EFFORT = "high";

/** Independent of the writer's model, provider, and autonomy dial. */
export function configForUltrabrain(config: AiConfig): AiConfig {
  return { ...config, authMode: "chatgpt", apiKey: "",
    providerId: config.ultrabrainProviderId ?? DEFAULT_ULTRABRAIN_PROVIDER,
    model: config.ultrabrainModel?.trim() || DEFAULT_ULTRABRAIN_MODEL,
    reasoningEffort: config.ultrabrainReasoningEffort ?? DEFAULT_ULTRABRAIN_EFFORT,
    maxTokens: Math.min(config.maxTokens, 4096),
  };
}

/** Once role settings are saved, retained region sessions also use the planner selection.
 * Explicit legacy/test configurations without role settings keep their existing contract.
 */
export function configForLegacySupervisor(config: AiConfig): AiConfig {
  return config.roleModels && Object.keys(config.roleModels).length > 0
    ? { ...configForUltrabrain(config), maxTokens: config.maxTokens } : config;
}
