// 첫 실행 자동 감지 → 요금제별 조수 기본값 (2026-11-03 사용자 결정, Claude 는 2026-11-16 오너 결정으로 바뀜,
// 2026-11-19 오너 결정으로 ChatGPT 가 먼저였다가 2026-11-23 오너 결정으로 다시 Claude 가 먼저다 — 후보 순서도 Claude 가 먼저다).
//
// 대부분의 사용자는 낮은 요금제 하나(Claude 또는 ChatGPT)만 갖고 있다. 그래서 첫 실행 관문(editor/ui/aiConnectGate.ts)이
// 이 PC 에서 이미 로그인된 구독을 찾아 「연결됨: <이름> · 이걸로 시작」 한 장으로 보이고, 고르면 그 요금제에 맞는 팀을 고른다.
//   - Claude 구독(Claude Code CLI, authMethod oauth_token): Sonnet 5.5 · high 하나가 계획부터 짓기까지(오너 결정 2026-11-23,
//     그 전 2026-11-16 은 Opus 5.5 · medium. 팀장·워커 나누기는 설정에서 고를 수 있다).
//   - ChatGPT 구독(Codex CLI)·편집기 안 ChatGPT 로그인: GPT-6.2 Sol · medium 하나가 계획부터 짓기까지.
//   - 그 밖(Gemini CLI 구글 로그인, 편집기 안 Google 로그인): 지금 기본값 그대로.
// API 키 로그인·환경 변수 키·이미 엔진을 고른 사용자는 후보가 아니다(기본값을 바꾸지 않는다).
// 순수 모듈 — 감지 결과를 받아 후보만 만든다. 저장·호출은 관문이 한다.

import type { AssistantEngineChoice, LocalCliEngineId } from "./localCliEngine";
import type { RoleModel, SpecialistModels, ThinkingEffort } from "./modelRoles";
import { ASSISTANT_CLAUDE_EFFORT, ASSISTANT_CLAUDE_MODEL } from "./claudeDefault.ts";
import { ASSISTANT_CHATGPT_EFFORT, ASSISTANT_CHATGPT_MODEL, atLeastMediumEffort } from "./chatgptDefault.ts";

/** LocalCliStatus(src/start/settings/localAgents.ts)의 부분. */
export interface DetectedCli {
  readonly id: LocalCliEngineId;
  readonly state: string;
  readonly billing: string;
}

/** ChatGptAuthStatus(src/ai/chatgptOAuthClient.ts)의 부분 + 제공자 id. */
export interface DetectedAccount {
  readonly providerId: string;
  readonly connected: boolean;
  readonly authKind?: string;
  readonly expired?: boolean;
  readonly env?: boolean;
}

export type PlanCandidate =
  | { readonly key: string; readonly kind: "local-cli"; readonly name: string; readonly setup: string; readonly engine: AssistantEngineChoice }
  | { readonly key: string; readonly kind: "account"; readonly name: string; readonly setup: string; readonly providerId: string };

export const CODEX_ACCOUNT_PROVIDER_ID = "openai-codex";
export const GOOGLE_ACCOUNT_PROVIDER_ID = "google-antigravity";

/** Claude 구독 기본: Sonnet 5.5 · high 하나가 계획부터 짓기까지 한다(같은 CLI, 키 없음, 팀장·워커로 나누지 않는다). */
export const CLAUDE_SUBSCRIPTION_ENGINE: AssistantEngineChoice = {
  kind: "local-cli", cli: "claude", routineModel: ASSISTANT_CLAUDE_MODEL, deepModel: ASSISTANT_CLAUDE_MODEL, effort: ASSISTANT_CLAUDE_EFFORT,
};

/** ChatGPT 구독 기본: Sol 하나가 계획부터 짓기까지 한다. */
export const CHATGPT_SUBSCRIPTION_ENGINE: AssistantEngineChoice = {
  kind: "local-cli", cli: "codex", routineModel: ASSISTANT_CHATGPT_MODEL, deepModel: ASSISTANT_CHATGPT_MODEL, effort: ASSISTANT_CHATGPT_EFFORT,
};

const ready = (rows: readonly DetectedCli[], id: LocalCliEngineId): boolean =>
  rows.some((row) => row.id === id && row.state === "ready" && row.billing === "subscription");

/** 저장된 로그인(OAuth)만 — 키·환경 변수 자격은 구독 로그인이 아니다. */
const signedIn = (accounts: readonly DetectedAccount[], providerId: string): boolean =>
  accounts.some((row) => row.providerId === providerId && row.connected && row.expired !== true && row.env !== true && row.authKind === "oauth");

/** 후보 목록 — ChatGPT(기본, 2026-11-28 오너 결정), Claude, 나머지 순. 같은 요금제는 한 장만(CLI 가 있으면 CLI). 없으면 빈 배열. */
export function planCandidates(rows: readonly DetectedCli[], accounts: readonly DetectedAccount[]): PlanCandidate[] {
  const out: PlanCandidate[] = [];
  if (ready(rows, "codex")) {
    out.push({ key: "codex-cli", kind: "local-cli", name: "ChatGPT 구독", setup: "GPT-6.2 Sol 하나가 계획부터 만들기까지 해요.", engine: CHATGPT_SUBSCRIPTION_ENGINE });
  } else if (signedIn(accounts, CODEX_ACCOUNT_PROVIDER_ID)) {
    out.push({ key: "codex-account", kind: "account", name: "ChatGPT 로그인", setup: "GPT-6.2 Sol 하나가 계획부터 만들기까지 해요.", providerId: CODEX_ACCOUNT_PROVIDER_ID });
  }
  if (ready(rows, "claude")) {
    out.push({ key: "claude-cli", kind: "local-cli", name: "Claude 구독", setup: "Sonnet 5.5 하나가 계획부터 만들기까지 해요.", engine: CLAUDE_SUBSCRIPTION_ENGINE });
  }
  // Google Antigravity 직접 OAuth와 종료된 Gemini CLI 는 추천 후보에서 제외한다(계정 정지 방지).
  return out;
}

/** 편집기 안 ChatGPT 로그인도 Sol 혼자 — 실행·시공·작문·시각·계획이 모두 같은 모델. */
export const CHATGPT_ACCOUNT_MODEL = ASSISTANT_CHATGPT_MODEL;

type PlanAccountConfig = {
  providerId?: string; model: string; liteModel?: string; roleModels?: SpecialistModels;
  reasoningEffort?: ThinkingEffort;
  ultrabrainProviderId?: string; ultrabrainModel?: string; ultrabrainReasoningEffort?: ThinkingEffort;
  modelSelectionOverrides?: Partial<Record<string, true>>;
};

/**
 * 계정 후보를 골랐을 때 역할 모델. 제공자 선택(configForProviderSelection)을 이미 거친 설정을 받는다.
 * ChatGPT 만 Sol · high 로 맞춘다(사람이 직접 고른 칸은 그대로). 다른 계정은 받은 그대로.
 */
export function configForPlanAccount<T extends PlanAccountConfig>(config: T, providerId: string): T {
  if (providerId !== CODEX_ACCOUNT_PROVIDER_ID) return config;
  const pinned = config.modelSelectionOverrides ?? {};
  const effortFor = (prevProvider: string | undefined, prevEffort: ThinkingEffort | undefined): ThinkingEffort =>
    prevProvider === providerId && prevEffort ? atLeastMediumEffort(prevEffort) : ASSISTANT_CHATGPT_EFFORT;
  const row = (old: RoleModel | undefined): RoleModel => ({
    provider: providerId, model: CHATGPT_ACCOUNT_MODEL, thinkingLevel: effortFor(old?.provider, old?.thinkingLevel),
  });
  const roleModels: SpecialistModels = { ...config.roleModels };
  for (const role of ["deep", "build", "writer", "vision"] as const) if (!pinned[role]) roleModels[role] = row(roleModels[role]);
  return {
    ...config,
    providerId, model: CHATGPT_ACCOUNT_MODEL, liteModel: CHATGPT_ACCOUNT_MODEL, roleModels,
    reasoningEffort: effortFor(config.providerId, config.reasoningEffort),
    ...(pinned.ultrabrain ? {} : {
      ultrabrainProviderId: providerId, ultrabrainModel: CHATGPT_ACCOUNT_MODEL,
      ultrabrainReasoningEffort: effortFor(config.ultrabrainProviderId, config.ultrabrainReasoningEffort),
    }),
  };
}
