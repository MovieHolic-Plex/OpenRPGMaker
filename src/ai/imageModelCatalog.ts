import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";

export const DEFAULT_IMAGE_PROVIDER_ID = ANTIGRAVITY_PROVIDER_ID;
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";

/** Image output routes only. Authentication is checked server-side, not inferred here. */
export const IMAGE_MODEL_CATALOG: readonly {
  providerId: string;
  providerLabel: string;
  model: string;
  label: string;
  supported: boolean;
}[] = [
  { providerId: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google Antigravity", model: DEFAULT_IMAGE_MODEL, label: "Gemini 3.1 Flash Image", supported: true },
  { providerId: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google Antigravity", model: "gemini-3-pro-image", label: "Gemini Pro Image · 현재 경로 미지원", supported: false },
  { providerId: CODEX_PROVIDER_ID, providerLabel: "OpenAI Codex", model: "codex-image-default", label: "GPT Image 2 (Codex)", supported: true },
];
