import type { AiConfig } from "./llmClient";

/**
 * build = 공간 시공(타일·맵·장소 짓기, 게임 전체 짓기). 지정하지 않으면 deep 과 같다.
 * 사용자 판단(2026-10-08): 타일 까는 일은 Gemini 가 훨씬 빠르다 — 조수 시험에서 같은 장르 게임 전체 짓기가 gemini-3.8-flash 10분·
 * gpt-6.1-sol 50분이었고, DB·이벤트·작은 수정은 GPT 가 더 정확했다. 그래서 실행 모델을 일의 종류로 나눈다(src/ai/buildRole.ts).
 */
export type SpecialistRole = "vision" | "writer" | "deep" | "build";
/**
 * pi-ai 의 Effort 와 같은 어휘다. xhigh·max 는 일부 서버(예: InferHub 의 deepseek-v4.1-flash)만 받지만,
 * 사용자가 그 서버를 골랐을 때 값을 조용히 high 로 낮추면 고른 강도가 사라진다 — 받는 서버가 판정한다.
 */
export type ThinkingEffort = "off" | "low" | "medium" | "high" | "xhigh" | "max";
export interface RoleModel {
  provider: string;
  model: string;
  thinkingLevel: ThinkingEffort;
}
export type SpecialistModels = Partial<Record<SpecialistRole, RoleModel>>;

/** Old settings remain a migration source, never override an explicit role selection. */
export function modelForRole(config: AiConfig, role: SpecialistRole): RoleModel {
  if (role === "build") return config.roleModels?.build ?? modelForRole(config, "deep");
  return config.roleModels?.[role] ?? {
    provider: config.providerId || "google-antigravity",
    // 이 리터럴은 llmClient 의 DEFAULT_MODEL 과 같은 값이어야 한다 — 갈라지면 config 가 빈 옛 blob 만
    // 조용히 옛 모델로 돈다(실측 2026-09-26: 3.8 이동에서 여기가 3.7 로 남아 있었다).
    // test/aiDefaultModelForced.test.ts 가 이 폴백을 강제 기본값에 고정한다.
    model: (role === "deep" ? config.liteModel || config.model : config.model)?.trim() || "gemini-4-argon",
    // deep 기본값이 high 여서 실행 루프가 매 턴 보이는 만큼 늘어졌다 — 실측(2026-09-26, 3턴 도구 사용 실행):
    // thinking high 는 턴당 약 2.9s, low 는 약 2.1s(전제가 1k→30k 토큰으로 커지는 데는 0.5s 밖에 안 밀리므로
    // 지연은 사고 강도가 지배한다). 사용자가 역할로 지정해 저장한 값은 이 반환에 닿지 않고 그대로 이긴다.
    thinkingLevel: role === "deep" ? "low" : "medium",
  };
}
/** 고른 한 칸(제공자·모델·강도)을 호출 설정으로 바꾼다. 역할 칸과 도트 저작 칸이 같이 쓴다. */
export function configForRoleModel(config: AiConfig, selected: RoleModel): AiConfig {
  return { ...config, authMode: "chatgpt", apiKey: "", providerId: selected.provider,
    model: selected.model, reasoningEffort: selected.thinkingLevel };
}
export function configForRole(config: AiConfig, role: SpecialistRole): AiConfig {
  return configForRoleModel(config, modelForRole(config, role));
}
/** 저장된 한 칸(제공자·모델·사고 강도)을 읽는다. 제공자·모델이 비면 undefined. 알 수 없는 강도는 high. */
export function parseRoleModel(raw: unknown): RoleModel | undefined {
  const value = raw as Partial<RoleModel> | null | undefined;
  if (!value || typeof value !== "object" || typeof value.provider !== "string" || !value.provider.trim()
    || typeof value.model !== "string" || !value.model.trim()) return undefined;
  return { provider: value.provider.trim(), model: value.model.trim(),
    thinkingLevel: value.thinkingLevel === "off" || value.thinkingLevel === "low" || value.thinkingLevel === "medium"
      || value.thinkingLevel === "xhigh" || value.thinkingLevel === "max"
      ? value.thinkingLevel : "high" };
}
export function parseRoleModels(raw: unknown): SpecialistModels {
  const result: SpecialistModels = {};
  if (!raw || typeof raw !== "object") return result;
  for (const role of ["vision", "writer", "deep", "build"] as const) {
    const parsed = parseRoleModel((raw as Record<string, unknown>)[role]);
    if (parsed) result[role] = parsed;
  }
  return result;
}
