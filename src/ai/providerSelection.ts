import type { AiConfig } from "./llmClient";
import { modelForRole, type RoleModel, type SpecialistRole } from "./modelRoles";
import { MODEL_PRESETS, tierModelFor } from "./modelPresets";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "./oauth/credentials";
import { IMAGE_MODEL_CATALOG } from "./imageModelCatalog";
import { parseOhMyPiProvider } from "./ohMyPiProviders";
import { configForUltrabrain } from "./ultrabrainConfig";

/**
 * 계정별 작문(Writer) 기본값. ChatGPT 계정은 도구 실행·검수를 gpt-6.1-sol 에 맡기되 이야기·대사 문장은
 * Gemini 가 낫다는 판단(사용자 결정 2026-10-07)으로 작문만 Gemini 에 둔다. Google 연결이 없으면
 * 실행기가 작문을 실행 모델로 대신 돌린다(scripts/lib/piAgentRuntime.ts) — 연결을 강제하지 않는다.
 */
const WRITER_FOR_PROVIDER: Readonly<Record<string, RoleModel>> = {
  [CODEX_PROVIDER_ID]: { provider: ANTIGRAVITY_PROVIDER_ID, model: "gemini-3.8-flash", thinkingLevel: "medium" },
};

/** 계정을 바꿀 때 역할별 사고 강도는 「균형」 프리셋을 따른다. 같은 계정 안에서는 기존 값을 둔다. */
const BALANCED = MODEL_PRESETS.find(preset => preset.id === "balanced")!;

/** 작문을 다른 계정에 둘 수 있는지 — 그 계정이 없어도 작업은 시작된다(작문만 실행 모델로 대신한다). */
export function isOptionalWriterProvider(config: AiConfig): boolean {
  const writer = modelForRole(config, "writer");
  return writer.provider !== parseOhMyPiProvider(config.providerId);
}

/** A connection choice updates defaults, never silently replaces a directly edited slot. */
export function configForProviderSelection(config: AiConfig, providerId: string, force = false): AiConfig {
  const next = { ...config, providerId: parseOhMyPiProvider(providerId), roleModels: { ...config.roleModels } };
  const pinned = config.modelSelectionOverrides ?? {};
  const model = (oldProvider: string, oldModel: string): string =>
    tierModelFor(next.providerId, oldModel === tierModelFor(oldProvider, "strong") ? "strong" : "fast")!;
  const thinking = (role: SpecialistRole, old: RoleModel): RoleModel["thinkingLevel"] =>
    old.provider === next.providerId ? old.thinkingLevel : BALANCED.roles[role].thinking;
  for (const role of ["vision", "writer", "deep"] as const) {
    const old = modelForRole(config, role);
    if (!force && pinned[role]) continue;
    const preferred = role === "writer" ? WRITER_FOR_PROVIDER[next.providerId] : undefined;
    next.roleModels[role] = preferred
      ? { ...preferred }
      : { provider: next.providerId, model: model(old.provider, old.model), thinkingLevel: thinking(role, old) };
  }
  const brain = configForUltrabrain(config);
  if (force || !pinned.ultrabrain) {
    next.ultrabrainProviderId = next.providerId;
    next.ultrabrainModel = model(brain.providerId!, brain.model);
    if (brain.providerId !== next.providerId) next.ultrabrainReasoningEffort = BALANCED.ultrabrain.thinking as "low" | "medium" | "high";
  }
  if (!pinned.image) {
    const image = IMAGE_MODEL_CATALOG.find(entry => entry.providerId === next.providerId && entry.supported)!;
    next.imageProviderId = image.providerId;
    next.imageModel = image.model;
  }
  // model 은 providerId 와 짝을 이루는 옛 감독 슬롯이다 — 작문이 다른 계정이면 실행 모델로 맞춘다.
  const writer = modelForRole(next, "writer");
  next.model = writer.provider === next.providerId ? writer.model : modelForRole(next, "deep").model;
  next.liteModel = modelForRole(next, "deep").model;
  next.modelSelectionOverrides = force ? (pinned.image ? { image: true } : {}) : { ...pinned };
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
