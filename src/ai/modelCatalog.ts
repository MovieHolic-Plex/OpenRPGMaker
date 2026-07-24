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
];

export function modelCatalogForAuthMode(authMode: "chatgpt" | "apiKey"): readonly AiModelCatalogGroup[] {
  return authMode === "chatgpt" ? CHATGPT_OAUTH_MODELS : API_GATEWAY_MODELS;
}
