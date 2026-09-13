import type { AiConfig } from "./llmClient";

export type SpecialistRole = "vision" | "writer" | "deep";
export interface RoleModel {
  provider: string;
  model: string;
  thinkingLevel: "off" | "low" | "medium" | "high";
}
export type SpecialistModels = Partial<Record<SpecialistRole, RoleModel>>;

/** Old settings remain a migration source, never override an explicit role selection. */
export function modelForRole(config: AiConfig, role: SpecialistRole): RoleModel {
  return config.roleModels?.[role] ?? {
    provider: config.providerId || "google-antigravity",
    model: (role === "deep" ? config.liteModel || config.model : config.model)?.trim() || "gemini-3.7-flash",
    thinkingLevel: role === "deep" ? "high" : "medium",
  };
}
export function configForRole(config: AiConfig, role: SpecialistRole): AiConfig {
  const selected = modelForRole(config, role);
  return { ...config, authMode: "chatgpt", apiKey: "", providerId: selected.provider,
    model: selected.model, reasoningEffort: selected.thinkingLevel };
}
export function parseRoleModels(raw: unknown): SpecialistModels {
  const result: SpecialistModels = {};
  if (!raw || typeof raw !== "object") return result;
  for (const role of ["vision", "writer", "deep"] as const) {
    const value = (raw as Record<string, unknown>)[role] as Partial<RoleModel> | undefined;
    if (!value || typeof value.provider !== "string" || !value.provider.trim()
      || typeof value.model !== "string" || !value.model.trim()) continue;
    result[role] = { provider: value.provider.trim(), model: value.model.trim(),
      thinkingLevel: value.thinkingLevel === "off" || value.thinkingLevel === "low" || value.thinkingLevel === "medium"
        ? value.thinkingLevel : "high" };
  }
  return result;
}
