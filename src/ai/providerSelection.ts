import type { AiConfig } from "./llmClient";
import { modelForRole } from "./modelRoles";
import { tierModelFor } from "./modelPresets";
import { IMAGE_MODEL_CATALOG } from "./imageModelCatalog";
import { parseOhMyPiProvider } from "./ohMyPiProviders";
import { configForUltrabrain } from "./ultrabrainConfig";

/** A connection choice updates defaults, never silently replaces a directly edited slot. */
export function configForProviderSelection(config: AiConfig, providerId: string, force = false): AiConfig {
  const next = { ...config, providerId: parseOhMyPiProvider(providerId), roleModels: { ...config.roleModels } };
  const pinned = config.modelSelectionOverrides ?? {};
  const model = (oldProvider: string, oldModel: string): string =>
    tierModelFor(next.providerId, oldModel === tierModelFor(oldProvider, "strong") ? "strong" : "fast")!;
  for (const role of ["vision", "writer", "deep"] as const) {
    const old = modelForRole(config, role);
    if (force || !pinned[role]) next.roleModels[role] = { ...old, provider: next.providerId, model: model(old.provider, old.model) };
  }
  const brain = configForUltrabrain(config);
  if (force || !pinned.ultrabrain) {
    next.ultrabrainProviderId = next.providerId;
    next.ultrabrainModel = model(brain.providerId!, brain.model);
  }
  if (!pinned.image) {
    const image = IMAGE_MODEL_CATALOG.find(entry => entry.providerId === next.providerId && entry.supported)!;
    next.imageProviderId = image.providerId;
    next.imageModel = image.model;
  }
  next.model = modelForRole(next, "writer").model;
  next.liteModel = modelForRole(next, "deep").model;
  next.modelSelectionOverrides = force ? (pinned.image ? { image: true } : {}) : { ...pinned };
  return next;
}

/** Image generation is optional; its account must not lock text authoring. */
export function workProviderIds(config: AiConfig): readonly string[] {
  return [...new Set([
    configForUltrabrain(config).providerId!,
    ...(["vision", "writer", "deep"] as const).map(role => modelForRole(config, role).provider),
  ].map(id => parseOhMyPiProvider(id)))];
}
