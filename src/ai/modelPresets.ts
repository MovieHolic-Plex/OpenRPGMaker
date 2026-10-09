// 모델 품질 프리셋 — 「빠르게 / 균형 / 최고 품질」 한 번의 선택을 역할별 모델·추론 조합으로 푼다.
//
// 설정 모달은 역할 4개 × (제공자·모델·추론) 컨트롤 12개를 상시 노출했는데, 대부분의 사용자는
// "전반적으로 빠르게/정확하게" 만 고르고 싶다. 프리셋은 그 상위 의도의 단일 출처다 — 카드 선택이
// 역할 컨트롤 각각을 채우고, 역할 컨트롤을 손대면 어떤 프리셋도 일치하지 않게 되어 체크가 풀린다.
//
// 티어 → 실제 모델 ID 매핑은 제공자 카탈로그(modelCatalog)에 있는 ID 여야 한다 — 프리셋이
// 카탈로그 밖 ID 를 채우면 무효 모델 경고가 뜬다.

import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "./oauth/credentials";
import type { RoleModel, SpecialistRole } from "./modelRoles";

/** 빠른 모델(비용·지연 우선)과 최상위 모델(품질 우선) 두 티어. */
export type ModelTier = "fast" | "strong";

export type ModelPresetId = "fast" | "balanced" | "quality";

export interface ModelPresetRoleSpec {
  readonly tier: ModelTier;
  readonly thinking: RoleModel["thinkingLevel"];
}

export interface ModelPreset {
  readonly id: ModelPresetId;
  readonly label: string;
  readonly description: string;
  /** Ultrabrain 은 thinkingLevel 에 "off" 가 없다 — 여기선 low/medium/high 만 쓴다. */
  readonly ultrabrain: ModelPresetRoleSpec;
  readonly roles: Readonly<Record<SpecialistRole, ModelPresetRoleSpec>>;
}

/**
 * 제공자별 티어 → 모델 ID. 두 제공자의 카탈로그(modelCatalog) 첫/대표 항목으로 맞춘다.
 * fast: 각 제공자의 기본 모델(레지스트리 defaultModel 과 일치), strong: 최상위 모델.
 */
const PROVIDER_TIER_MODELS: Readonly<Record<string, Readonly<Record<ModelTier, string>>>> = {
  [ANTIGRAVITY_PROVIDER_ID]: { fast: "gemini-3.8-flash", strong: "gemini-3-pro" },
  // Codex 는 두 티어 모두 gpt-6.1-sol 이고 사고 강도로만 가른다(2026-10-07 조수 시험에서 기본으로 채택).
  [CODEX_PROVIDER_ID]: { fast: "gpt-6.1-sol", strong: "gpt-6.1-sol" },
};

/** 티어의 실제 모델 ID. 매핑이 없는 제공자면 null — 호출부는 그 역할의 모델을 건드리지 않는다. */
export function tierModelFor(providerId: string, tier: ModelTier): string | null {
  return PROVIDER_TIER_MODELS[providerId]?.[tier] ?? null;
}

export const MODEL_PRESETS: readonly ModelPreset[] = [
  {
    id: "fast",
    label: "빠르게",
    description: "모든 역할을 빠른 모델로 맞춥니다. 응답이 가장 빠릅니다.",
    ultrabrain: { tier: "fast", thinking: "medium" },
    roles: {
      vision: { tier: "fast", thinking: "low" },
      writer: { tier: "fast", thinking: "low" },
      deep: { tier: "fast", thinking: "medium" },
      build: { tier: "fast", thinking: "medium" },
    },
  },
  {
    id: "balanced",
    label: "균형",
    description: "계획은 깊게, 실행은 보통 강도로. 대부분의 작업에 적합합니다.",
    ultrabrain: { tier: "strong", thinking: "high" },
    roles: {
      vision: { tier: "fast", thinking: "medium" },
      writer: { tier: "fast", thinking: "medium" },
      deep: { tier: "fast", thinking: "medium" },
      build: { tier: "fast", thinking: "medium" },
    },
  },
  {
    id: "quality",
    label: "최고 품질",
    description: "모든 역할을 최상위 모델로. 느리지만 가장 정밀합니다.",
    ultrabrain: { tier: "strong", thinking: "high" },
    roles: {
      vision: { tier: "strong", thinking: "high" },
      writer: { tier: "strong", thinking: "high" },
      deep: { tier: "strong", thinking: "high" },
      build: { tier: "strong", thinking: "high" },
    },
  },
];
