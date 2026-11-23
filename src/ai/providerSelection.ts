import type { AiConfig } from "./llmClient";
import { modelForRole, type RoleModel, type SpecialistRole } from "./modelRoles";
import { MODEL_PRESETS, tierModelFor } from "./modelPresets";
import { CODEX_PROVIDER_ID } from "./oauth/credentials";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID } from "./imageModelCatalog";
import { CHATGPT_DEFAULT_EFFORT, CLAUDE_DEFAULT_EFFORT, CLAUDE_DEFAULT_MODEL, getOhMyPiProvider, parseOhMyPiProvider } from "./ohMyPiProviders";
import { configForUltrabrain } from "./ultrabrainConfig";

/** 계정을 바꿀 때 역할별 사고 강도는 「균형」 프리셋을 따른다. 같은 계정 안에서는 기존 값을 둔다. */
const BALANCED = MODEL_PRESETS.find(preset => preset.id === "balanced")!;

/**
 * 계정을 바꿀 때의 사고 강도. 조수 기본 모델(Claude Sonnet 5.5)로 맞춰지는 칸은 모든 역할·감독이 그 기본 강도(high)다 —
 * 오너 결정(2026-11-23): 「조수는 sonnet 5.5 high 만」. Claude 계정과 Anthropic 키로 만든 사용자 지정 엔드포인트가 여기에 든다.
 * 다른 모델은 그대로 「균형」 프리셋 강도다.
 */
function ultrabrainEffortFor(model: string): "low" | "medium" | "high" {
  return model === CLAUDE_DEFAULT_MODEL ? CLAUDE_DEFAULT_EFFORT : BALANCED.ultrabrain.thinking as "low" | "medium" | "high";
}

function roleEffortFor(role: SpecialistRole, model: string): RoleModel["thinkingLevel"] {
  return model === CLAUDE_DEFAULT_MODEL ? CLAUDE_DEFAULT_EFFORT : BALANCED.roles[role].thinking;
}

/** 작문을 다른 계정에 둘 수 있는지 — 그 계정이 없어도 작업은 시작된다(작문만 실행 모델로 대신한다). */
export function isOptionalWriterProvider(config: AiConfig): boolean {
  const writer = modelForRole(config, "writer");
  return writer.provider !== parseOhMyPiProvider(config.providerId);
}

/** A connection choice updates defaults, never silently replaces a directly edited slot. */
export function configForProviderSelection(config: AiConfig, providerId: string, force = false): AiConfig {
  const next = { ...config, providerId: parseOhMyPiProvider(providerId), roleModels: { ...config.roleModels } };
  const pinned = config.modelSelectionOverrides ?? {};
  // 티어 매핑이 없는 계정(xAI Grok · OpenRouter 등)으로 바꿀 때 이전 제공자의 모델 id 를 남기면 그 계정에 없는 모델을 부른다
  // (2026-11-23 실측: Grok 만 연결 → xai-oauth + claude-sonnet-5-5). 그때는 그 계정의 기본 모델을 쓴다.
  const model = (oldProvider: string, oldModel: string): string =>
    tierModelFor(next.providerId, oldModel === tierModelFor(oldProvider, "strong") ? "strong" : "fast")
      ?? (parseOhMyPiProvider(oldProvider) !== next.providerId ? getOhMyPiProvider(next.providerId)?.defaultModel || oldModel : oldModel);
  const thinking = (role: SpecialistRole, old: RoleModel, newModel: string): RoleModel["thinkingLevel"] =>
    old.provider === next.providerId ? old.thinkingLevel : roleEffortFor(role, newModel);
  for (const role of ["vision", "writer", "deep", "build"] as const) {
    const old = modelForRole(config, role);
    if (!force && pinned[role]) continue;
    const newModel = model(old.provider, old.model);
    next.roleModels[role] = { provider: next.providerId, model: newModel, thinkingLevel: thinking(role, old, newModel) };
  }
  const brain = configForUltrabrain(config);
  if (force || !pinned.ultrabrain) {
    next.ultrabrainProviderId = next.providerId;
    next.ultrabrainModel = model(brain.providerId!, brain.model);
    if (brain.providerId !== next.providerId) next.ultrabrainReasoningEffort = next.providerId === CODEX_PROVIDER_ID
      ? CHATGPT_DEFAULT_EFFORT : ultrabrainEffortFor(next.ultrabrainModel);
  }
  next.imageProviderId = DEFAULT_IMAGE_PROVIDER_ID;
  next.imageModel = DEFAULT_IMAGE_MODEL;
  // model 은 providerId 와 짝을 이루는 옛 감독 슬롯이다 — 작문이 다른 계정이면 실행 모델로 맞춘다.
  const writer = modelForRole(next, "writer");
  next.model = writer.provider === next.providerId ? writer.model : modelForRole(next, "deep").model;
  next.liteModel = modelForRole(next, "deep").model;
  // 도트 저작 칸(pixelModel)은 계정 선택을 따라 바뀌지 않는다 — 맞추기(force)에서도 고른 표시를 지우지 않는다.
  next.modelSelectionOverrides = force
    ? { ...(pinned.pixel ? { pixel: true as const } : {}) }
    : { ...pinned };
  return next;
}

/**
 * 작업을 시작하려면 연결돼 있어야 하는 계정. 그림 생성과, 주 계정과 다른 계정에 둔 작문은 선택이다 —
 * 그 계정이 없다고 글이 아닌 작업까지 막지 않는다.
 */
export function workProviderIds(config: AiConfig): readonly string[] {
  const roles = (["vision", "writer", "deep"] as const).filter(role => role !== "writer" || !isOptionalWriterProvider(config));
  return [...new Set([
    configForUltrabrain(config).providerId!,
    ...roles.map(role => modelForRole(config, role).provider),
  ].map(id => parseOhMyPiProvider(id)))];
}
