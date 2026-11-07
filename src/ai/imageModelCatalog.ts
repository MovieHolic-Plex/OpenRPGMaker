import { pickNewestImageModel, type ImageModelCandidate } from "@/ai/imageModelResolution";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";

/**
 * 새 설정과 「그림 칸이 저장돼 있지 않은 옛 blob」 의 기본은 ChatGPT(GPT Image)다 — 오너 규칙(2026-11-07, 그대로):
 * 「엥 ? 이미지는 chatgpt 로 그려」. Google 은 사용자가 **직접 고를 때만** 쓴다(카탈로그에 그대로 남아 있다).
 */
export const DEFAULT_IMAGE_PROVIDER_ID = CODEX_PROVIDER_ID;

/**
 * Image output routes only. Authentication is checked server-side, not inferred here.
 *
 * `revision` 은 「지금 가장 새 그림 모델이 무엇인가」를 런타임에 계산하는 입력이다(2026-11-07).
 * 모델 이름을 상수로 박으면 제공자가 새 모델을 내놓아도 사용자는 옛 이름을 계속 본다 — 실제로 Codex 경로가
 * `gpt-image-2.5-sunburst` 를 고정해 보내는 동안 백엔드는 `gpt-image-2-codex` 를 쓰고 있었다.
 * 새 모델을 쓰게 하려면 아래 표에 줄을 더한다. 기본값이 따라온다.
 */
export const IMAGE_MODEL_ROWS: readonly (ImageModelCandidate & {
  readonly providerId: string;
  readonly providerLabel: string;
  readonly label: string;
  readonly supported: boolean;
})[] = [
  {
    providerId: CODEX_PROVIDER_ID, providerLabel: "ChatGPT", id: "codex-image-default", kind: "image",
    revision: "2.0.0", label: "GPT Image (Codex · god-tibo-imagen)", supported: true,
  },
  {
    providerId: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", id: "gemini-3.1-flash-image", kind: "image",
    revision: "3.1.0", label: "Gemini 3.1 Flash Image", supported: true,
  },
  {
    providerId: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", id: "gemini-3-pro-image", kind: "image",
    revision: "3.0.0", label: "Nano Banana Pro · 현재 경로 미지원", supported: false,
  },
];

/** 이 제공자의 「지원되는 그림 모델 중 가장 새 것」. 표에 없으면 null. */
export function newestSupportedImageModel(providerId: string): string | null {
  return pickNewestImageModel(IMAGE_MODEL_ROWS.filter((row) => row.providerId === providerId && row.supported));
}

/**
 * `codex-image-default` 는 모델 이름이 아니라 「제공자가 자기 목록에서 고르게 한다」는 선택 id 다 —
 * 이 값이 오면 워커는 image_generation.model 을 보내지 않고, 응답이 보고한 모델을 그대로 기록한다.
 */
export const RECOMMENDED_IMAGE_PROVIDER_ID = CODEX_PROVIDER_ID;
export const RECOMMENDED_IMAGE_MODEL = "codex-image-default";

/**
 * 저장된 그림 칸이 없던 옛 blob 의 그림 기본값. 기본 제공자가 ChatGPT 이므로 그 선택 id 를 쓴다.
 * (Google 계열 값을 쓰던 시절의 blob 은 `imageProviderId` 가 저장돼 있으므로 그 값이 그대로 살아남는다.)
 */
export const DEFAULT_IMAGE_MODEL = RECOMMENDED_IMAGE_MODEL;

export const IMAGE_MODEL_CATALOG: readonly {
  providerId: string;
  providerLabel: string;
  model: string;
  label: string;
  supported: boolean;
}[] = IMAGE_MODEL_ROWS.map((row) => ({
  providerId: row.providerId, providerLabel: row.providerLabel, model: row.id, label: row.label, supported: row.supported,
}));
