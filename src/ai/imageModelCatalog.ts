import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";

export const DEFAULT_IMAGE_PROVIDER_ID = ANTIGRAVITY_PROVIDER_ID;
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";
/**
 * 새 설정의 그림 기본값(2026-10-11) — ChatGPT(GPT Image). 같은 구조화 프롬프트로 견준 오프닝 4컷에서 GPT Image 가
 * 앵글·초점 지시를 더 잘 지켰고 해상도도 높았다. DEFAULT_* 는 저장값이 없던 옛 blob 의 바탕이라 Google 로 남긴다.
 * ChatGPT 가 연결돼 있지 않으면 generateAiImage 가 고르지 않은(고정 안 한) 설정에 한해 Google 로 대신한다.
 */
export const RECOMMENDED_IMAGE_PROVIDER_ID = CODEX_PROVIDER_ID;
export const RECOMMENDED_IMAGE_MODEL = "codex-image-default";

/** Image output routes only. Authentication is checked server-side, not inferred here. */
export const IMAGE_MODEL_CATALOG: readonly {
  providerId: string;
  providerLabel: string;
  model: string;
  label: string;
  supported: boolean;
}[] = [
  { providerId: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", model: DEFAULT_IMAGE_MODEL, label: "Gemini 3.1 Flash Image", supported: true },
  { providerId: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", model: "gemini-3-pro-image", label: "Gemini Pro Image · 현재 경로 미지원", supported: false },
  { providerId: CODEX_PROVIDER_ID, providerLabel: "ChatGPT", model: "codex-image-default", label: "GPT Image (Codex · god-tibo-imagen)", supported: true },
];
