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
    // deep 기본값이 high 여서 실행 루프가 매 턴 보이는 만큼 늘어졌다 — 실측(2026-09-26, 3턴 도구 사용 실행):
    // thinking high 는 턴당 약 2.9s, low 는 약 2.1s(전제가 1k→30k 토큰으로 커지는 데는 0.5s 밖에 안 밀리므로
    // 지연은 사고 강도가 지배한다). 사용자가 역할로 지정해 저장한 값은 이 반환에 닿지 않고 그대로 이긴다.
    thinkingLevel: role === "deep" ? "low" : "medium",
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
