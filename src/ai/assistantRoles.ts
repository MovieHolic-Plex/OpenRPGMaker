// 조수 역할 배정 — 연결된 계정과 역할 × 계정 표(assistantRoleMatrix.json)로 역할마다 모델 하나를 고른다.
//
// 역할 여섯: main(주 작업) · smol(잔일) · advisor(검토자) · vision(눈) · image(그림 생성) · pixel(도트).
// 그림 생성과 도트는 다른 역할이다 — 도트는 텍스트 모델이 격자 문자열로 찍고(src/ai/pixelModel.ts), 그림 생성은 이미지 출력 모델이다.
//
// 규칙
// - 할 수 없는 모델은 배정하지 않는다: 표에 칸이 없는 계정은 그 역할 후보가 아니다(예: Claude·DeepSeek 은 그림 생성 없음).
//   눈(vision)은 그림 입력이 되는 경로만 — 사용자 지정 엔드포인트는 supportsImages 가 켜졌을 때만.
// - 검토자는 주 모델과 다른 모델을 먼저 고른다(다른 계열 → 같은 계열의 다른 모델 → 같은 모델 순).
// - 잔일은 주 모델과 같은 계정의 싼 모델을 먼저 고른다.
// - 채울 수 없는 역할은 빈칸이 아니라 «무엇으로 물러나는지»를 말한다: 잔일·도트 → 주 모델, 검토자 → 꺼짐, 눈 → 그림 검사 없음.
// - 사용자가 직접 고른 칸(overrides)이 자동 배정을 이긴다. 그 계정이 연결돼 있지 않으면 쓰지 않고 이유를 말한다.
import matrix from "./assistantRoleMatrix.json";
import type { AiConfig } from "./llmClient";
import { modelForRole, type RoleModel, type ThinkingEffort } from "./modelRoles";
import { openAiCompatBaseModelId, openAiCompatModelSeesImages } from "./openAiCompat";
import { resolvePixelModel } from "./pixelModel";

export type AssistantRole = "main" | "smol" | "advisor" | "vision" | "image" | "pixel";
export const ASSISTANT_ROLES: readonly AssistantRole[] = ["main", "smol", "advisor", "vision", "image", "pixel"];
export type ModelFamily = "claude" | "gpt" | "gemini" | "deepseek";
export const MODEL_FAMILIES: readonly ModelFamily[] = ["gemini", "gpt", "claude", "deepseek"];

/** 연결된 경로 하나. models 는 그 경로가 실제로 내놓은 모델 목록(사용자 지정 엔드포인트의 시험 결과) — 비우면 표를 믿는다. */
export interface AvailableRoute {
  readonly provider: ModelFamily;
  readonly providerId: string;
  readonly models?: readonly string[];
  /** 사용자 지정 엔드포인트가 그림 입력을 받는가. 다른 경로는 표가 정한다. */
  readonly supportsImages?: boolean;
  /** 사용자 지정 엔드포인트의 그림 모델 패턴·그림 시험에서 못 본 모델(openAiCompatModelSeesImages). */
  readonly imageModels?: readonly string[];
  readonly imageBlindModels?: readonly string[];
}

export type RoleAssignment =
  | { readonly status: "ok"; readonly model: RoleModel; readonly source: "auto" | "override"; readonly family: ModelFamily; readonly note?: string }
  | { readonly status: "missing"; readonly degrade: string };

/** 사용자가 직접 고른 칸. "off" = 일부러 끔(검토자·잔일 등). */
export type RoleOverrides = Partial<Record<AssistantRole, RoleModel | "off">>;

interface MatrixEntry { readonly model: string; readonly thinkingLevel: string; readonly requiresEndpointImages?: boolean }
interface MatrixRoute { readonly providerId: string; readonly match?: string; readonly roles: Partial<Record<AssistantRole, readonly MatrixEntry[]>> }
interface MatrixFamily { readonly label: string; readonly routes: readonly MatrixRoute[] }
interface RoleCopy { readonly label: string; readonly desc: string; readonly missing: string }
const MATRIX = matrix as unknown as {
  readonly roles: Record<AssistantRole, RoleCopy>;
  readonly familyOrder: readonly ModelFamily[];
  readonly mainFamilyOrder: readonly ModelFamily[];
  readonly families: Record<ModelFamily, MatrixFamily>;
};

export const ROLE_COPY: Readonly<Record<AssistantRole, RoleCopy>> = MATRIX.roles;
export const FAMILY_LABEL: Readonly<Record<ModelFamily, string>> = Object.fromEntries(
  MODEL_FAMILIES.map((family) => [family, MATRIX.families[family].label])) as Record<ModelFamily, string>;

/** 그림 생성은 GPT Image 를 먼저 권한다(src/ai/imageModelCatalog.ts RECOMMENDED_IMAGE_PROVIDER_ID). 나머지는 표 순서. */
// 주 작업은 Claude(Opus 5.5 medium)를 먼저 본다 — 사용자 결정(2026-10-25). Claude 가 없으면 Gemini Argon medium.
const ROLE_FAMILY_ORDER: Partial<Record<AssistantRole, readonly ModelFamily[]>> = { image: ["gpt", "gemini", "claude", "deepseek"], main: MATRIX.mainFamilyOrder };

interface Candidate { readonly family: ModelFamily; readonly providerId: string; readonly entry: MatrixEntry }

function routeMatches(route: MatrixRoute, available: AvailableRoute): boolean {
  if (route.providerId.endsWith(":*")) return available.providerId.startsWith(route.providerId.slice(0, -1));
  return route.providerId === available.providerId;
}

/**
 * 그 경로가 이 칸의 모델을 실제로 낼 수 있는가. 목록이 없으면 표를 믿고, 있으면 목록에 있어야 한다(접두 일치 — gemini-4-argon-medium 같은 이름 포함,
 * 거꾸로 칸이 gemini-4-argon-high 처럼 강도 접미사를 단 이름이면 목록의 기본 이름 gemini-4-argon 으로도 낸다).
 * 그림이 필요한 칸은 그 모델(칸에 적힌 최종 ID)이 그림을 실제로 보는 경우만 — 2026-10-25 8318 실측: 같은 엔드포인트에서도 모델마다 다르다.
 */
function entryUsable(entry: MatrixEntry, route: MatrixRoute, available: AvailableRoute): boolean {
  if (entry.requiresEndpointImages && !openAiCompatModelSeesImages({
    supportsImages: available.supportsImages === true,
    ...(available.imageModels ? { imageModels: available.imageModels } : {}),
    ...(available.imageBlindModels ? { imageBlindModels: available.imageBlindModels } : {}),
  }, entry.model)) return false;
  const listed = available.models ?? [];
  if (!listed.length) return true;
  const base = openAiCompatBaseModelId(entry.model);
  return listed.some((model) => model === entry.model || model.startsWith(`${entry.model}-`) || (base !== entry.model && model === base)
    || (route.match ? model.includes(route.match) && model.includes(entry.model) : false));
}

function candidatesFor(role: AssistantRole, available: readonly AvailableRoute[]): Candidate[] {
  const order = ROLE_FAMILY_ORDER[role] ?? MATRIX.familyOrder;
  const out: Candidate[] = [];
  for (const family of order) {
    for (const route of MATRIX.families[family].routes) {
      const entries = route.roles[role];
      if (!entries?.length) continue;
      for (const connected of available) {
        if (connected.provider !== family || !routeMatches(route, connected)) continue;
        for (const entry of entries) if (entryUsable(entry, route, connected)) out.push({ family, providerId: connected.providerId, entry });
      }
    }
  }
  return out;
}

const toModel = (candidate: Candidate): RoleModel => ({
  provider: candidate.providerId, model: candidate.entry.model, thinkingLevel: candidate.entry.thinkingLevel as ThinkingEffort,
});
const same = (a: RoleModel, b: RoleModel): boolean => a.provider === b.provider && a.model === b.model;

/**
 * 역할마다 모델 하나. 연결이 하나도 없으면 전부 missing 이다.
 * overrides 의 계정이 available 에 없으면 그 칸은 쓰지 않는다 — 자동 배정으로 말없이 바꾸지도 않는다(이유를 남긴다).
 */
export function resolveAssistantRoles(available: readonly AvailableRoute[], overrides: RoleOverrides = {}): Record<AssistantRole, RoleAssignment> {
  const connectedIds = new Set(available.map((route) => route.providerId));
  const familyOf = (providerId: string): ModelFamily | undefined => available.find((route) => route.providerId === providerId)?.provider;
  const result = {} as Record<AssistantRole, RoleAssignment>;
  const missing = (role: AssistantRole, why?: string): RoleAssignment => ({ status: "missing", degrade: why ?? ROLE_COPY[role].missing });

  const pickOverride = (role: AssistantRole): RoleAssignment | undefined => {
    const chosen = overrides[role];
    if (!chosen) return undefined;
    if (chosen === "off") return missing(role, `직접 끔 — ${ROLE_COPY[role].missing}`);
    const family = familyOf(chosen.provider);
    if (!family || !connectedIds.has(chosen.provider)) return missing(role, `직접 고른 계정(${chosen.provider})이 연결돼 있지 않음 — ${ROLE_COPY[role].missing}`);
    return { status: "ok", model: chosen, source: "override", family };
  };

  // 1) 주 작업 — 나머지 역할의 기준이다.
  const mainCandidates = candidatesFor("main", available);
  result.main = pickOverride("main") ?? (mainCandidates[0]
    ? { status: "ok", model: toModel(mainCandidates[0]), source: "auto", family: mainCandidates[0].family }
    : missing("main"));
  const main = result.main.status === "ok" ? result.main : undefined;

  // 2) 잔일 — 주 모델과 같은 계정의 싼 모델 먼저. 주 모델과 같은 모델이면 따로 둘 이유가 없다(주 모델이 대신한다).
  result.smol = pickOverride("smol") ?? (() => {
    const all = candidatesFor("smol", available).filter((candidate) => !main || !same(toModel(candidate), main.model));
    const pick = (main && all.find((candidate) => candidate.providerId === main.model.provider)) ?? all[0];
    return pick ? { status: "ok", model: toModel(pick), source: "auto", family: pick.family } : missing("smol");
  })();

  // 3) 검토자 — 다른 계열 → 같은 계열의 다른 모델 → 같은 모델(다른 문맥) 순.
  result.advisor = pickOverride("advisor") ?? (() => {
    const all = candidatesFor("advisor", available);
    if (!all.length) return missing("advisor");
    const otherFamily = main ? all.find((candidate) => candidate.family !== main.family) : undefined;
    const otherModel = main ? all.find((candidate) => !same(toModel(candidate), main.model)) : undefined;
    const pick = otherFamily ?? otherModel ?? all[0]!;
    const note = main && same(toModel(pick), main.model) ? "주 모델과 같은 모델 — 문맥만 따로" : undefined;
    return { status: "ok", model: toModel(pick), source: "auto", family: pick.family, ...(note ? { note } : {}) };
  })();

  // 4) 눈·그림 생성·도트 — 할 수 있는 첫 경로. 주 모델과 같은 계정을 먼저 본다(계정을 하나 더 쓰지 않게).
  for (const role of ["vision", "image", "pixel"] as const) {
    result[role] = pickOverride(role) ?? (() => {
      const all = candidatesFor(role, available);
      const pick = (role !== "image" && main && all.find((candidate) => candidate.providerId === main.model.provider)) || all[0];
      return pick ? { status: "ok", model: toModel(pick), source: "auto", family: pick.family } : missing(role);
    })();
  }
  return result;
}

/** 사용자 지정 엔드포인트의 계열 — 모델 이름으로 가른다. 모르면 undefined(표에 칸이 없으니 배정하지 않는다). */
export function familyOfModels(models: readonly string[]): ModelFamily | undefined {
  const text = models.join(" ").toLowerCase();
  if (/deepseek/u.test(text)) return "deepseek";
  if (/gemini/u.test(text)) return "gemini";
  if (/claude|sonnet|opus|haiku/u.test(text)) return "claude";
  if (/\bgpt|o\d-|codex/u.test(text)) return "gpt";
  return undefined;
}

/** 경로 id 의 계열. 사용자 지정 엔드포인트는 모델 목록이 정한다(familyOfModels). */
export function familyOfProviderId(providerId: string, models: readonly string[] = []): ModelFamily | undefined {
  if (providerId === "google-antigravity" || providerId === "local-cli:gemini") return "gemini";
  if (providerId === "openai-codex" || providerId === "local-cli:codex") return "gpt";
  if (providerId === "local-cli:claude") return "claude";
  if (providerId.startsWith("openai-compat:")) return familyOfModels(models);
  return undefined;
}

/**
 * 이 설정에서 그 역할에 쓸 모델. undefined = 그 역할을 채울 수 없다 → 잔일: 주 모델을 쓴다 · 검토자: 끈다 · 눈: 그림 검사를 건너뛴다.
 * main·vision·pixel·image 는 기존 칸을 그대로 읽는다(설정 화면이 이미 그 칸을 채운다). smol·advisor 는 assistantRoles 칸이다.
 */
export function assistantRoleModel(config: AiConfig, role: AssistantRole): RoleModel | undefined {
  switch (role) {
    case "main": return modelForRole(config, "deep");
    case "vision": return modelForRole(config, "vision");
    case "pixel": return resolvePixelModel(config).model;
    case "image": return config.imageProviderId && config.imageModel
      ? { provider: config.imageProviderId, model: config.imageModel, thinkingLevel: "off" } : undefined;
    case "smol":
    case "advisor": {
      const slot = config.assistantRoles?.[role];
      return slot && slot !== "off" ? slot : undefined;
    }
  }
}

/**
 * 자동 배정 결과를 설정의 잔일·검토자 칸에 쓴다. 사용자가 직접 고른 칸(modelSelectionOverrides.smol/advisor)은 건드리지 않는다.
 * 채울 수 없으면 칸을 비운다(→ 물러남). 다른 칸(주·눈·도트·그림)은 기존 계정 선택 경로가 맡는다.
 */
export function configWithAutoAssistantRoles(config: AiConfig, available: readonly AvailableRoute[]): AiConfig {
  const pinned = config.modelSelectionOverrides ?? {};
  const resolved = resolveAssistantRoles(available, {
    main: modelForRole(config, "deep"),
    ...(pinned.smol && config.assistantRoles?.smol ? { smol: config.assistantRoles.smol } : {}),
    ...(pinned.advisor && config.assistantRoles?.advisor ? { advisor: config.assistantRoles.advisor } : {}),
  });
  const next: NonNullable<AiConfig["assistantRoles"]> = { ...config.assistantRoles };
  for (const role of ["smol", "advisor"] as const) {
    if (pinned[role]) continue;
    const assignment = resolved[role];
    if (assignment.status === "ok") next[role] = assignment.model;
    else delete next[role];
  }
  return { ...config, assistantRoles: next };
}
