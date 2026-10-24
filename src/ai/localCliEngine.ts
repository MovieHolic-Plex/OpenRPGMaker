// 조수 엔진 선택 — 사용자 PC 의 에이전트 CLI(Claude Code · Codex · Gemini CLI)를 조수 루프로 쓰는 설정.
//
// 브라우저·Node 양쪽에서 읽는다(순수 모듈, node: 가져오기 없음). 실행은 동반 서비스 → Bun 워커의 runPiAgent 가
// provider `local-cli:<cli>` 를 보고 로컬 CLI 루프로 돈다(scripts/lib/localCliAgent/). 키는 어디에도 없다 —
// 사용자가 그 CLI 에 직접 로그인해 있다.
//
// 지금은 고른 사람만 쓴다(D1: 동등성 입증 전 opt-in). 설정 화면(첫 화면 개편, home-redesign-1)이 이 값을 쓴다.
// 화면이 오기 전에는 개발 콘솔에서: `localStorage.setItem("oprn:assistant-engine", JSON.stringify({ kind: "local-cli", cli: "claude" }))`.

import type { RoleModel, SpecialistModels, ThinkingEffort } from "./modelRoles";

export type LocalCliEngineId = "claude" | "codex" | "gemini";
export const LOCAL_CLI_ENGINE_IDS: readonly LocalCliEngineId[] = ["claude", "codex", "gemini"];
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
}

export const LOCAL_CLI_LABELS: Readonly<Record<LocalCliEngineId, string>> = {
  claude: "Claude Code (내 PC)",
  codex: "Codex · ChatGPT (내 PC)",
  gemini: "Gemini CLI (내 PC)",
};

/** CLI 별 권장 기본 모델(비용·품질 균형). 감지 API 가 실제 목록으로 덮는다. */
export const LOCAL_CLI_DEFAULT_MODELS: Readonly<Record<LocalCliEngineId, { routine: string; deep: string }>> = {
  claude: { routine: "sonnet", deep: "sonnet" },
  codex: { routine: "gpt-6-luna", deep: "gpt-6.1-sol" },
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
  return {
    kind: "local-cli", cli: value.cli as LocalCliEngineId,
    ...(routineModel ? { routineModel } : {}), ...(deepModel ? { deepModel } : {}),
    ...(value.effort === "low" || value.effort === "medium" || value.effort === "high" ? { effort: value.effort } : {}),
  };
}

/** 저장된 엔진 선택(없으면 undefined = 기존 Pi 엔진). */
export function loadAssistantEngine(): AssistantEngineChoice | undefined {
  try { return typeof localStorage === "undefined" ? undefined : parseAssistantEngine(localStorage.getItem(ASSISTANT_ENGINE_STORAGE_KEY)); }
  catch { return undefined; }
}

export function saveAssistantEngine(choice: AssistantEngineChoice | undefined): void {
  if (typeof localStorage === "undefined") return;
  if (choice) localStorage.setItem(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify(choice));
  else localStorage.removeItem(ASSISTANT_ENGINE_STORAGE_KEY);
}

/**
 * 엔진 선택을 설정에 입힌다 — 실행·시공·작문·시각 역할과 계획(ultrabrain)이 모두 같은 CLI 로 간다.
 * 키가 필요한 계정 역할을 섞지 않는다(우리는 키를 쥐지 않는다). 이미지 생성 칸은 건드리지 않는다(CLI 는 그림을 만들지 않는다).
 */
export function applyAssistantEngine<T extends { providerId?: string; model: string; liteModel?: string; roleModels?: SpecialistModels; pixelModel?: RoleModel; ultrabrainProviderId?: string; ultrabrainModel?: string; ultrabrainReasoningEffort?: ThinkingEffort }>(config: T, choice: AssistantEngineChoice | undefined): T {
  if (!choice) return config;
  const provider = localCliProviderId(choice.cli);
  const routine = choice.routineModel ?? LOCAL_CLI_DEFAULT_MODELS[choice.cli].routine;
  const deep = choice.deepModel ?? choice.routineModel ?? LOCAL_CLI_DEFAULT_MODELS[choice.cli].deep;
  const effort = choice.effort ?? "medium";
  const row = (model: string): RoleModel => ({ provider, model, thinkingLevel: effort });
  return {
    ...config,
    providerId: provider, model: routine, liteModel: routine,
    roleModels: { deep: row(routine), build: row(routine), writer: row(routine), vision: row(routine) },
    pixelModel: row(deep),
    ultrabrainProviderId: provider, ultrabrainModel: deep, ultrabrainReasoningEffort: effort,
  };
}

/** 비용 한 줄(D8). 구독이면 청구가 아니라 한도 사용이다. */
export function formatLocalCliCost(stats: { billing?: string; costUsd?: number; usage?: { input: number; output: number; cacheRead: number; cacheWrite: number } } | undefined): string | undefined {
  if (!stats?.billing) return undefined;
  const tokens = stats.usage ? stats.usage.input + stats.usage.output + stats.usage.cacheRead + stats.usage.cacheWrite : 0;
  const k = tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens);
  if (stats.billing === "subscription") return `구독 한도 사용(청구 아님)${stats.costUsd !== undefined ? ` · 환산 $${stats.costUsd.toFixed(2)}` : ""} · 토큰 ${k}`;
  return `${stats.costUsd !== undefined ? `비용 $${stats.costUsd.toFixed(2)} · ` : ""}토큰 ${k}`;
}
