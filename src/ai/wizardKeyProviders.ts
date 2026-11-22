// 첫 실행 마법사 「키가 있어요」 화면에서 고르는 키 제공자 목록.
// 주소·모델은 이미 있는 표(KEY_ROUTES, OPENAI_COMPAT_PRESETS, OPENROUTER_*)에서만 가져온다 — 새 숫자를 여기 적지 않는다.
// keyUrl 은 그 제공자에서 키를 만드는 페이지다(「키 받기」 링크).

import { KEY_ROUTES } from "./keyRoutes.ts";
import { OPENAI_COMPAT_PRESETS, OPENROUTER_BASE_URL, OPENROUTER_DEFAULT_MODEL, OPENROUTER_KEYS_URL } from "./openAiCompat.ts";
import type { OpenAiCompatReasoningMode } from "./openAiCompat.ts";

export interface WizardKeyProvider {
  readonly id: string;
  readonly label: string;
  /** "openrouter" 면 동반 서비스가 주소·이름을 정한다. */
  readonly kind: "openrouter" | "custom";
  readonly baseUrl: string;
  readonly model: string;
  readonly reasoningMode?: OpenAiCompatReasoningMode;
  readonly supportsImages?: boolean;
  readonly imageModels?: readonly string[];
  readonly keyUrl: string;
}

const xai = OPENAI_COMPAT_PRESETS.find((preset) => preset.id === "xai");

export const WIZARD_KEY_PROVIDERS: readonly WizardKeyProvider[] = [
  { id: "openrouter", label: "OpenRouter", kind: "openrouter", baseUrl: OPENROUTER_BASE_URL, model: OPENROUTER_DEFAULT_MODEL, keyUrl: OPENROUTER_KEYS_URL },
  { id: "deepseek", label: "DeepSeek", kind: "custom", baseUrl: KEY_ROUTES.deepseek.baseUrl, model: KEY_ROUTES.deepseek.models.deepseek ?? "deepseek-flash",
    reasoningMode: KEY_ROUTES.deepseek.reasoningMode, keyUrl: "https://platform.deepseek.com/api_keys" },
  ...(xai ? [{ id: "xai", label: "xAI Grok", kind: "custom" as const, baseUrl: xai.baseUrl, model: xai.suggestedModel ?? "grok-4.7",
    ...(xai.reasoningMode ? { reasoningMode: xai.reasoningMode } : {}), ...(xai.supportsImages ? { supportsImages: true } : {}),
    ...(xai.imageModels ? { imageModels: xai.imageModels } : {}), keyUrl: "https://console.x.ai" }] : []),
  { id: "claude", label: "Claude", kind: "custom", baseUrl: KEY_ROUTES.claude.baseUrl, model: KEY_ROUTES.claude.models.opus ?? "",
    reasoningMode: KEY_ROUTES.claude.reasoningMode, keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "google", label: "Gemini", kind: "custom", baseUrl: KEY_ROUTES.google.baseUrl, model: KEY_ROUTES.google.models.argon ?? "",
    reasoningMode: KEY_ROUTES.google.reasoningMode, keyUrl: "https://aistudio.google.com/apikey" },
];

export function wizardKeyProvider(id: string | undefined): WizardKeyProvider {
  return WIZARD_KEY_PROVIDERS.find((provider) => provider.id === id) ?? WIZARD_KEY_PROVIDERS[0]!;
}
