import { CODEX_PROVIDER_ID } from "./oauth/credentials.ts";

/**
 * 오너 결정(2026-11-19): 에디터의 생성형 그림은 ChatGPT 로만 그린다.
 * 선택 ID 는 Codex 가 실제 그림 모델을 고르게 하고, 응답에 보고된 모델을 기록한다.
 */
export const RECOMMENDED_IMAGE_PROVIDER_ID = CODEX_PROVIDER_ID;
export const RECOMMENDED_IMAGE_MODEL = "codex-image-default";
export const DEFAULT_IMAGE_PROVIDER_ID = RECOMMENDED_IMAGE_PROVIDER_ID;
export const DEFAULT_IMAGE_MODEL = RECOMMENDED_IMAGE_MODEL;

export const IMAGE_CHATGPT_LOGIN_REQUIRED =
  "그림은 ChatGPT 로만 그려요(대화 AI 와는 따로예요). AI 설정에서 ChatGPT 로그인을 연결해 주세요.";

export const IMAGE_MODEL_CATALOG = [{
  providerId: DEFAULT_IMAGE_PROVIDER_ID,
  providerLabel: "ChatGPT",
  model: DEFAULT_IMAGE_MODEL,
  label: "GPT Image (Codex · god-tibo-imagen)",
}] as const;
