// 조수 엔진 선택 — 사용자 PC 의 에이전트 CLI(Claude Code · Codex · Gemini CLI)를 조수 루프로 쓰는 설정.
//
// 브라우저·Node 양쪽에서 읽는다(순수 모듈, node: 가져오기 없음). 실행은 동반 서비스 → Bun 워커의 runPiAgent 가
// provider `local-cli:<cli>` 를 보고 로컬 CLI 루프로 돈다(scripts/lib/localCliAgent/). 키는 어디에도 없다 —
// 사용자가 그 CLI 에 직접 로그인해 있다.
//
// 지금은 고른 사람만 쓴다(D1: 동등성 입증 전 opt-in). 설정 화면(첫 화면 개편, home-redesign-1)이 이 값을 쓴다.
// 화면이 오기 전에는 개발 콘솔에서: `localStorage.setItem("oprn:assistant-engine", JSON.stringify({ kind: "local-cli", cli: "claude" }))`.

import type { RoleModel, SpecialistModels, ThinkingEffort } from "./modelRoles";
import { ASSISTANT_CLAUDE_EFFORT, ASSISTANT_CLAUDE_MODEL } from "./claudeDefault.ts";
import { ASSISTANT_CHATGPT_EFFORT, ASSISTANT_CHATGPT_MODEL, atLeastMediumEffort, isLegacyTerraModel } from "./chatgptDefault.ts";

export type LocalCliEngineId = "claude" | "codex" | "agy" | "gemini";
export const LOCAL_CLI_ENGINE_IDS: readonly LocalCliEngineId[] = ["claude", "codex", "agy", "gemini"];
export const LOCAL_CLI_PROVIDER_PREFIX = "local-cli:";
export const ASSISTANT_ENGINE_STORAGE_KEY = "oprn:assistant-engine";

export interface AssistantEngineChoice {
  readonly kind: "local-cli";
  readonly cli: LocalCliEngineId;
  /** 일상 편집(실행·시공·작문) 모델. 비우면 CLI 기본값. */
  readonly routineModel?: string;
  /** 계획·팀장·큰 판단 모델. 비우면 routineModel. */
  readonly deepModel?: string;
  readonly effort?: "low" | "medium" | "high";
  /**
   * 팀장·워커(조수 v2 리드, src/ai/v2/turn/split.ts). 켜면 deepModel 이 팀장으로 할 일·사양을 쓰고 단계 끝에서 검토하며,
   * routineModel 이 워커로 짓는다(같은 CLI). deepModel 이 routineModel 과 같으면 나누지 않는다 — 설정의 「한 모델로 합치기」가 곴 끄기다.
   * 기본으로는 켜지 않는다(오너 결정: Claude 구독도 한 모델 — 2026-11-23 부터 Sonnet 5.5 · high, planDefaults.ts). 설정에서 모델을 나눈 사람만 쓴다.
   * OPRN_V2_SPLIT 이 있으면 그 값이 이긴다.
   */
  readonly teamLead?: boolean;
}

export const LOCAL_CLI_LABELS: Readonly<Record<LocalCliEngineId, string>> = {
  claude: "Claude Code (내 PC)",
  codex: "Codex · ChatGPT (내 PC)",
  agy: "Antigravity · Google (내 PC)",
  gemini: "Gemini CLI (내 PC)",
};

/**
 * CLI 별 권장 기본 모델. 감지 API 가 실제 목록으로 덮는다.
 * Claude 는 Sonnet 5.5 하나(오너 결정 2026-11-23 — 조수 기본은 Claude Sonnet 5.5 · high). 별칭 `sonnet` 이 아니라 정식 ID 를 박는다:
 * 별칭이 가리키는 세대는 CLI 판마다 다르다(scripts/lib/localCliAgent/claude.ts MODELS 머리말).
 */
export const LOCAL_CLI_DEFAULT_MODELS: Readonly<Record<LocalCliEngineId, { routine: string; deep: string }>> = {
  claude: { routine: ASSISTANT_CLAUDE_MODEL, deep: ASSISTANT_CLAUDE_MODEL },
  codex: { routine: ASSISTANT_CHATGPT_MODEL, deep: ASSISTANT_CHATGPT_MODEL },
  agy: { routine: "gemini-4-argon", deep: "gemini-4-neon" },
  gemini: { routine: "auto", deep: "auto" },
};

export function localCliProviderId(cli: LocalCliEngineId): string {
  return `${LOCAL_CLI_PROVIDER_PREFIX}${cli}`;
}

export function isLocalCliProviderId(value: unknown): value is string {
  return typeof value === "string" && LOCAL_CLI_ENGINE_IDS.some((id) => value === localCliProviderId(id));
}

export function localCliOfProvider(value: unknown): LocalCliEngineId | undefined {
  return isLocalCliProviderId(value) ? (value.slice(LOCAL_CLI_PROVIDER_PREFIX.length) as LocalCliEngineId) : undefined;
}

export function parseAssistantEngine(raw: unknown): AssistantEngineChoice | undefined {
  const value = (typeof raw === "string" ? (() => { try { return JSON.parse(raw) as unknown; } catch { return undefined; } })() : raw) as Partial<AssistantEngineChoice> | undefined;
  if (!value || typeof value !== "object" || value.kind !== "local-cli" || !LOCAL_CLI_ENGINE_IDS.includes(value.cli as LocalCliEngineId)) return undefined;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const routineModel = text(value.routineModel);
  const deepModel = text(value.deepModel);
  return migrateCodexEngine({
    kind: "local-cli", cli: value.cli as LocalCliEngineId,
    ...(routineModel ? { routineModel } : {}), ...(deepModel ? { deepModel } : {}), ...(value.teamLead === true ? { teamLead: true } : {}),
    ...(value.effort === "low" || value.effort === "medium" || value.effort === "high" ? { effort: value.effort } : {}),
  });
}

// Claude 정책 표식과 별개로, 직접 고른 Codex Terra 도 읽을 때 Sol 로 옮긴다.
function migrateCodexEngine(choice: AssistantEngineChoice): AssistantEngineChoice {
  const routineWasTerra = isLegacyTerraModel(choice.routineModel);
  const deepWasTerra = isLegacyTerraModel(choice.deepModel);
  if (choice.cli !== "codex" || (!routineWasTerra && !deepWasTerra)) return choice;
  return {
    ...choice,
    routineModel: routineWasTerra ? ASSISTANT_CHATGPT_MODEL : choice.routineModel,
    deepModel: deepWasTerra ? ASSISTANT_CHATGPT_MODEL : choice.deepModel,
    effort: atLeastMediumEffort(choice.effort),
  };
}

/**
 * 저장 꼴의 정책 버전. 2 = Claude 구독 기본이 Opus 5.5 하나로 바뀐 2026-11-16 이후에 저장한 선택,
 * 3 = Sonnet 5.5 · high 하나로 바뀐 2026-11-23 이후에 저장한 선택.
 * 표식이 없는 옛 저장만 소급 대상이다 — 표식이 찍힌 뒤에 사람이 다시 고른 「Opus 팀장 + Haiku 워커」 는 그대로 둔다
 * (llmClient 의 roleModelsPolicyVersion 과 같은 패턴: 모양만 보고 올리면 일부러 고른 값을 읽을 때마다 잃는다).
 */
export const ASSISTANT_ENGINE_POLICY_VERSION = 3;

/** 표식 버전별 옛 Claude 구독 기본. 표식이 그 버전보다 낮은 저장만 그 기본과 비교한다. */
const LEGACY_CLAUDE_ENGINE_DEFAULTS: readonly { readonly before: number; readonly routineModel: string; readonly deepModel: string; readonly effort: string; readonly teamLead?: true }[] = [
  // 2026-11-16 까지: Opus 팀장 + Haiku 워커, medium.
  { before: 2, routineModel: "claude-haiku-5-5", deepModel: "claude-opus-5-5", effort: "medium", teamLead: true },
  // 2026-11-16 ~ 2026-11-23: Opus 5.5 하나, medium.
  { before: 3, routineModel: "claude-opus-5-5", deepModel: "claude-opus-5-5", effort: "medium" },
];

/**
 * 표식이 낮은 옛 저장이 그 버전의 옛 Claude 구독 기본과 **똑같으면** 새 기본(Sonnet 5.5 하나, high)으로 읽는다. 디스크에는 쓰지 않는다 —
 * 다음 저장이 표식을 찍는다. 한 칸이라도 다르면(사람이 고친 것) 그대로 둔다. PR #2535 의 옛 공장 기본 소급과 같은 규칙이다.
 */
export function promoteLegacyEngineDefault(choice: AssistantEngineChoice, policyVersion: unknown): AssistantEngineChoice {
  const version = Number(policyVersion) || 0;
  if (version >= ASSISTANT_ENGINE_POLICY_VERSION || choice.cli !== "claude") return choice;
  const matches = LEGACY_CLAUDE_ENGINE_DEFAULTS.some((legacy) => version < legacy.before
    && choice.routineModel === legacy.routineModel && choice.deepModel === legacy.deepModel
    && choice.effort === legacy.effort && choice.teamLead === legacy.teamLead);
  if (!matches) return choice;
  const model = LOCAL_CLI_DEFAULT_MODELS.claude.routine;
  return { kind: "local-cli", cli: "claude", routineModel: model, deepModel: model, effort: ASSISTANT_CLAUDE_EFFORT };
}

/** 저장된 엔진 선택(없으면 undefined = 기존 Pi 엔진). */
export function loadAssistantEngine(): AssistantEngineChoice | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const raw = localStorage.getItem(ASSISTANT_ENGINE_STORAGE_KEY);
    const choice = parseAssistantEngine(raw);
    if (!choice) return undefined;
    const stored = JSON.parse(raw ?? "null") as { policyVersion?: unknown } | null;
    return promoteLegacyEngineDefault(choice, stored?.policyVersion);
  }
  catch { return undefined; }
}

export function saveAssistantEngine(choice: AssistantEngineChoice | undefined): void {
  if (typeof localStorage === "undefined") return;
  if (choice) localStorage.setItem(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify({ ...migrateCodexEngine(choice), policyVersion: ASSISTANT_ENGINE_POLICY_VERSION }));
  else localStorage.removeItem(ASSISTANT_ENGINE_STORAGE_KEY);
}

/**
 * 엔진 선택을 설정에 입힌다 — 실행·시공·작문·시각 역할과 계획(ultrabrain)이 모두 같은 CLI 로 간다.
 * 키가 필요한 계정 역할을 섞지 않는다(우리는 키를 쥐지 않는다). 이미지 생성 칸은 건드리지 않는다(CLI 는 그림을 만들지 않는다).
 */
export function applyAssistantEngine<T extends { providerId?: string; model: string; liteModel?: string; reasoningEffort?: ThinkingEffort; roleModels?: SpecialistModels; pixelModel?: RoleModel; ultrabrainProviderId?: string; ultrabrainModel?: string; ultrabrainReasoningEffort?: ThinkingEffort }>(config: T, choice: AssistantEngineChoice | undefined): T {
  if (!choice) return config;
  choice = migrateCodexEngine(choice);
  const provider = localCliProviderId(choice.cli);
  const defaults = LOCAL_CLI_DEFAULT_MODELS[choice.cli];
  const routine = choice.routineModel ?? (choice.cli === "codex" ? defaults.deep : defaults.routine);
  const deep = choice.deepModel ?? (choice.cli === "codex" ? defaults.deep : choice.routineModel ?? defaults.deep);
  const effort = choice.effort ?? (choice.cli === "codex" ? ASSISTANT_CHATGPT_EFFORT : choice.cli === "claude" ? ASSISTANT_CLAUDE_EFFORT : "medium");
  const row = (model: string): RoleModel => ({ provider, model, thinkingLevel: effort });
  return {
    ...config,
    providerId: provider, model: routine, liteModel: routine, reasoningEffort: effort,
    roleModels: { deep: row(routine), build: row(routine), writer: row(routine), vision: row(routine) },
    pixelModel: row(deep),
    ultrabrainProviderId: provider, ultrabrainModel: deep, ultrabrainReasoningEffort: effort,
  };
}

/**
 * 조수 v2 팀장(리드) — 엔진 선택이 teamLead 를 켜고 deepModel 이 routineModel 과 다를 때만. 같은 CLI 로 부른다(키 없음).
 * 기본(Sonnet 5.5 하나)에서는 팀장이 없다.
 * 강도는 측정한 조합(2026-11-03 lead-worker-split, `lead:claude:claude-opus-5-5:medium`)을 따라 medium 으로 둔다.
 */
export function assistantEngineLead(choice: AssistantEngineChoice | undefined): RoleModel | undefined {
  if (choice) choice = migrateCodexEngine(choice);
  if (!choice?.teamLead || !choice.deepModel || choice.deepModel === (choice.routineModel ?? LOCAL_CLI_DEFAULT_MODELS[choice.cli].routine)) return undefined;
  return { provider: localCliProviderId(choice.cli), model: choice.deepModel, thinkingLevel: "medium" };
}

/** 비용 한 줄(D8). 구독이면 청구가 아니라 한도 사용이다. */
export function formatLocalCliCost(stats: { billing?: string; costUsd?: number; usage?: { input: number; output: number; cacheRead: number; cacheWrite: number } } | undefined): string | undefined {
  if (!stats?.billing) return undefined;
  const tokens = stats.usage ? stats.usage.input + stats.usage.output + stats.usage.cacheRead + stats.usage.cacheWrite : 0;
  const k = tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens);
  if (stats.billing === "subscription") return `구독 한도 사용(청구 아님)${stats.costUsd !== undefined ? ` · 환산 $${stats.costUsd.toFixed(2)}` : ""} · 토큰 ${k}`;
  return `${stats.costUsd !== undefined ? `비용 $${stats.costUsd.toFixed(2)} · ` : ""}토큰 ${k}`;
}
