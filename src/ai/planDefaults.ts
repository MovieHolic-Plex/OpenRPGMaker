// 첫 실행 자동 감지 → 요금제별 조수 기본값 (2026-11-03 사용자 결정).
//
// 대부분의 사용자는 낮은 요금제 하나(Claude 또는 ChatGPT)만 갖고 있다. 그래서 첫 실행 관문(editor/ui/aiConnectGate.ts)이
// 이 PC 에서 이미 로그인된 구독을 찾아 「연결됨: <이름> · 이걸로 시작」 한 장으로 보이고, 고르면 그 요금제에 맞는 팀을 고른다.
//   - Claude 구독(Claude Code CLI, authMethod oauth_token): Opus 팀장 + Haiku 워커(측정 lead-worker-split: 체크리스트 91%, $0.30/요청).
//   - ChatGPT 구독(Codex CLI ChatGPT 로그인): Terra 혼자(gpt-6.1-terra, 3판 24/25, $0.74/요청).
//   - 편집기 안 ChatGPT 로그인: 앱 경로 카탈로그에 gpt-6.1-terra 가 없어(scripts/lib/ohMyPiModel.ts 가 400 으로 거절) 그 계정의 지금 기본값.
//   - 그 밖(Gemini CLI 구글 로그인, 편집기 안 Google 로그인): 지금 기본값 그대로.
// API 키 로그인·환경 변수 키·이미 엔진을 고른 사용자는 후보가 아니다(기본값을 바꾸지 않는다).
// 순수 모듈 — 감지 결과를 받아 후보만 만든다. 저장·호출은 관문이 한다.

import type { AssistantEngineChoice, LocalCliEngineId } from "./localCliEngine";

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

/** Claude 구독 기본: Haiku 5.5 가 짓고 Opus 5.5 가 팀장으로 계획·검토한다(같은 CLI, 키 없음). */
export const CLAUDE_SUBSCRIPTION_ENGINE: AssistantEngineChoice = {
  kind: "local-cli", cli: "claude", routineModel: "claude-haiku-5-5", deepModel: "claude-opus-5-5", effort: "medium", teamLead: true,
};

/** ChatGPT 구독 기본: Terra 하나가 계획부터 짓기까지 한다. */
export const CHATGPT_SUBSCRIPTION_ENGINE: AssistantEngineChoice = {
  kind: "local-cli", cli: "codex", routineModel: "gpt-6.1-terra", deepModel: "gpt-6.1-terra", effort: "medium",
};

const ready = (rows: readonly DetectedCli[], id: LocalCliEngineId): boolean =>
  rows.some((row) => row.id === id && row.state === "ready" && row.billing === "subscription");

/** 저장된 로그인(OAuth)만 — 키·환경 변수 자격은 구독 로그인이 아니다. */
const signedIn = (accounts: readonly DetectedAccount[], providerId: string): boolean =>
  accounts.some((row) => row.providerId === providerId && row.connected && row.expired !== true && row.env !== true && row.authKind === "oauth");

/** 후보 목록 — Claude, ChatGPT, 나머지 순. 같은 요금제는 한 장만(CLI 가 있으면 CLI). 없으면 빈 배열. */
export function planCandidates(rows: readonly DetectedCli[], accounts: readonly DetectedAccount[]): PlanCandidate[] {
  const out: PlanCandidate[] = [];
  if (ready(rows, "claude")) {
    out.push({ key: "claude-cli", kind: "local-cli", name: "Claude 구독", setup: "Opus 가 팀장으로 계획·검토하고 Haiku 가 만들어요.", engine: CLAUDE_SUBSCRIPTION_ENGINE });
  }
  if (ready(rows, "codex")) {
    out.push({ key: "codex-cli", kind: "local-cli", name: "ChatGPT 구독", setup: "GPT-6.1 Terra 하나가 계획부터 만들기까지 해요.", engine: CHATGPT_SUBSCRIPTION_ENGINE });
  } else if (signedIn(accounts, CODEX_ACCOUNT_PROVIDER_ID)) {
    out.push({ key: "codex-account", kind: "account", name: "ChatGPT 로그인", setup: "ChatGPT 계정의 기본 모델(GPT-6.1 Sol)로 해요.", providerId: CODEX_ACCOUNT_PROVIDER_ID });
  }
  if (ready(rows, "gemini")) {
    out.push({ key: "gemini-cli", kind: "local-cli", name: "Gemini CLI 구글 로그인", setup: "Gemini CLI 기본 모델로 해요.", engine: { kind: "local-cli", cli: "gemini", effort: "medium" } });
  } else if (signedIn(accounts, GOOGLE_ACCOUNT_PROVIDER_ID)) {
    out.push({ key: "google-account", kind: "account", name: "Google 로그인", setup: "Google 계정의 기본 모델(Gemini 4 Argon)로 해요.", providerId: GOOGLE_ACCOUNT_PROVIDER_ID });
  }
  return out;
}
