import type { AiConfig } from "./llmClient";
import { configForRoleModel, parseRoleModel, type RoleModel } from "./modelRoles";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "./oauth/credentials";
import { DEFAULT_ULTRABRAIN_EFFORT, DEFAULT_ULTRABRAIN_MODEL, DEFAULT_ULTRABRAIN_PROVIDER } from "./ultrabrainConfig";

/**
 * 도트 저작 모델 — 타일셋·캐릭터셋·맵 기물 같은 «도트» 를 만드는 **텍스트 모델** 칸(2026-10-16).
 *
 * 이미지 생성 모델이 아니다. 도트는 모델이 픽셀 한 칸 한 칸을 격자 문자열(행 배열)·좌표로 직접 써서
 * 만든다(`assistant-skills/pixel-dot-authoring`, 공방 `workshop-draw`). 생성형 이미지 모델은 도트 격자를
 * 지키지 못하므로(눈금·팔레트·3/4 시점) 이 용도에는 호출하지 않는다 — src/ai/imageRoute.ts 가 막는다.
 *
 * 저장값이 없으면(옛 설정) 기존 동작을 그대로 둔다: 공방 그리기는 계획·최종 판단(ultrabrain) 모델을 썼다.
 * 새 설정(defaultAiConfig)만 Argon 보통으로 시작한다. 이 칸은 계정 선택을 따라 바뀌지 않는다 — 고른 값이 유지된다.
 */
export const DEFAULT_PIXEL_MODEL: RoleModel = { provider: ANTIGRAVITY_PROVIDER_ID, model: "gemini-4-argon", thinkingLevel: "medium" };

export interface PixelModelChoice {
  readonly provider: string;
  readonly providerLabel: string;
  readonly model: string;
  readonly label: string;
}

/**
 * 도트 저작 모델로 권하는 텍스트 모델. 모델 id 는 modelCatalog 의 계정별 목록에 있는 것만 쓴다(없는 id 를 지어내지 않는다).
 * 계정에서 실제로 쓸 수 있는지는 연결 상태가 정한다 — 목록은 선택지일 뿐 사용 가능 보증이 아니다.
 */
export const PIXEL_MODEL_CHOICES: readonly PixelModelChoice[] = [
  { provider: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", model: "gemini-4-argon", label: "Gemini 4 Argon" },
  { provider: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", model: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { provider: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", model: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { provider: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", model: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { provider: ANTIGRAVITY_PROVIDER_ID, providerLabel: "Google", model: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { provider: CODEX_PROVIDER_ID, providerLabel: "ChatGPT", model: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
];

/** 저장된 도트 저작 칸. 모양이 틀리거나 없으면 undefined(= 기존 동작 유지). */
export function parsePixelModel(raw: unknown): RoleModel | undefined {
  return parseRoleModel(raw);
}

/** 이 설정에서 도트 저작에 쓸 모델과, 저장값이 없어 계획 모델을 따라가는지. */
export function resolvePixelModel(config: Pick<AiConfig, "pixelModel" | "ultrabrainProviderId" | "ultrabrainModel" | "ultrabrainReasoningEffort">): {
  readonly model: RoleModel;
  readonly follows: boolean;
} {
  if (config.pixelModel) return { model: config.pixelModel, follows: false };
  return {
    follows: true,
    model: {
      provider: config.ultrabrainProviderId ?? DEFAULT_ULTRABRAIN_PROVIDER,
      model: config.ultrabrainModel?.trim() || DEFAULT_ULTRABRAIN_MODEL,
      thinkingLevel: config.ultrabrainReasoningEffort ?? DEFAULT_ULTRABRAIN_EFFORT,
    },
  };
}

/** 저장값이 있을 때만 호출 설정을 돌려준다. 없으면 undefined — 호출부는 자기 기존 경로(계획 모델)를 쓴다. */
export function configForPixel(config: AiConfig): AiConfig | undefined {
  return config.pixelModel ? configForRoleModel(config, config.pixelModel) : undefined;
}
