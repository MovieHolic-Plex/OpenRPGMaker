// ai/autoProviderPick.ts
// 사용자의 지금 상태(연결된 길 · 한도 · 도구 호출)를 보고 조수가 쓸 연결을 고른다. 순수 함수다 — 상태 수집·저장·화면은 호출자 몫.
//
// 왜 (2026-11-23 ai-setup-adaptive, 오너: 「공장 기본값이고 나발이고 사용자에 따라서 달라져야하는 거 아닌가.
// 사용자의 현재 상태(실제로 쿼터까지 봐야할거같은데.)」): 공장 기본이 ChatGPT 라서 Claude 만 연결한 사용자도
// 칩이 「ChatGPT 로그인 필요」 였고 조수가 잠겼다. 한도에 걸린 길도 계속 골랐다.
//
// 규칙(위에서부터 먼저 맞는 것):
// 1. 사용자가 고정한 연결이 있으면 그것(한도라도 바꾸지 않는다 — 대신 limited 로 알린다).
// 2. 연결됐고 · 도구 호출이 안 된다고 알려지지 않았고 · 한도에 걸리지 않은 길 중 우선순위가 가장 높은 것.
// 3. 연결된 길이 모두 한도면 가장 빨리 풀리는 길(모르면 우선순위 순).
// 4. 연결된 길이 없으면 null.
// 한도를 모르는 길(readable:false·조회 실패)은 쓸 수 있는 것으로 본다 — 숫자를 지어내지 않고 「모름」 으로 둔다.

import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "./oauth/credentials.ts";
import { ANTHROPIC_PROVIDER_ID, OH_MY_PI_PROVIDERS } from "./ohMyPiProviders.ts";
import { isOpenAiCompatProviderId } from "./openAiCompat.ts";
import { localCliProviderId } from "./localCliEngine.ts";
import { lowestRemaining, type ProviderUsageSnapshot } from "./providerQuota.ts";

/** 한 길의 남은 사용량 판정. unknown = 이 길은 알려 주지 않거나 아직 모른다. */
export type ProviderQuotaState = "ok" | "low" | "exhausted" | "unknown";

export interface ProviderRouteState {
  readonly providerId: string;
  readonly connected: boolean;
  /** 동반 서비스 /auth/usage 응답. 없으면 모름. */
  readonly usage?: ProviderUsageSnapshot | null;
  /** 최근 요청이 429 로 막혔고 이 시각(ms)까지 쉬라고 했다(Retry-After). 지나면 무시한다. */
  readonly limitedUntil?: number;
  /** 도구 호출을 받는가. false 만 뺀다 — 모르면(undefined) 쓸 수 있는 것으로 본다. */
  readonly toolCalls?: boolean;
}

export type AutoPickReason = "pinned" | "best" | "fallback" | "all-limited" | "none";
export type SkipWhy = "not-connected" | "limited" | "no-tools";

export interface AutoPick {
  readonly providerId: string | null;
  readonly reason: AutoPickReason;
  /** 고른 길의 한도 상태. */
  readonly quota: ProviderQuotaState;
  /** 고른 길이 한도일 때 풀리는 시각(ms). 모르면 없다. */
  readonly resetsAt?: number;
  /** 고른 길보다 우선순위가 높은데 건너뛴 길과 이유 — 칩·설정이 「Claude 한도라 ChatGPT」 처럼 말하는 데 쓴다. */
  readonly skipped: readonly { readonly providerId: string; readonly why: SkipWhy }[];
}

/** 남은 비율이 이보다 적으면 low. 고르기에는 영향이 없고(그래도 쓴다) 칩 색에만 쓴다. */
export const LOW_QUOTA_FRACTION = 0.1;

/**
 * 자동 선택 우선순위. ChatGPT 길이 먼저다(조수 출하 기본 = ChatGPT GPT-6.2 Sol · high, 오너 결정 2026-11-28).
 * 편집기 안 ChatGPT 계정·이 PC 의 Codex CLI 구독, 그다음 Claude · Google, 그 밖의 키 길(xAI · OpenRouter · Gemini CLI …)은 레지스트리 순서,
 * 사용자 지정 엔드포인트(DeepSeek 등 OpenAI 호환)는 맨 뒤.
 */
export const AUTO_PROVIDER_PRIORITY: readonly string[] = [
  CODEX_PROVIDER_ID,
  localCliProviderId("codex"),
  ANTHROPIC_PROVIDER_ID,
  localCliProviderId("claude"),
  ANTIGRAVITY_PROVIDER_ID,
  ...OH_MY_PI_PROVIDERS.map((provider) => provider.id).filter((id) => id !== CODEX_PROVIDER_ID && id !== ANTHROPIC_PROVIDER_ID && id !== ANTIGRAVITY_PROVIDER_ID),
  localCliProviderId("gemini"),
];

/** 우선순위 순위. 모르는 id 는 뒤로, 사용자 지정 엔드포인트는 그보다도 뒤(같은 무리 안에서는 들어온 순서). */
function rank(providerId: string): number {
  const index = AUTO_PROVIDER_PRIORITY.indexOf(providerId);
  if (index >= 0) return index;
  return AUTO_PROVIDER_PRIORITY.length + (isOpenAiCompatProviderId(providerId) ? 1 : 0);
}

/** 한 길의 한도 상태. 최근 429(아직 쉬는 중)이거나 남은 비율 0 이면 exhausted. */
export function providerQuotaState(route: ProviderRouteState, now: number): ProviderQuotaState {
  if (route.limitedUntil !== undefined && route.limitedUntil > now) return "exhausted";
  const lowest = lowestRemaining(route.usage);
  if (lowest === null) return "unknown";
  if (lowest <= 0) return "exhausted";
  return lowest < LOW_QUOTA_FRACTION ? "low" : "ok";
}

/** 한도가 풀리는 시각(ms). 모르면 Infinity. */
function resetsAt(route: ProviderRouteState, now: number): number {
  const times: number[] = [];
  if (route.limitedUntil !== undefined && route.limitedUntil > now) times.push(route.limitedUntil);
  for (const window of route.usage?.readable ? route.usage.windows : []) {
    if ((window.exhausted || window.remainingFraction === 0) && window.resetsAt !== undefined && window.resetsAt > now) times.push(window.resetsAt);
  }
  return times.length ? Math.max(...times) : Infinity;
}

export function pickAutoProvider(input: {
  readonly routes: readonly ProviderRouteState[];
  /** 사용자가 직접 고정한 연결. 없으면 자동. */
  readonly pinnedProviderId?: string | null;
  readonly now: number;
}): AutoPick {
  const { now } = input;
  const ordered = [...input.routes].sort((a, b) => rank(a.providerId) - rank(b.providerId));
  if (input.pinnedProviderId) {
    const pinned = ordered.find((route) => route.providerId === input.pinnedProviderId);
    const quota = pinned ? providerQuotaState(pinned, now) : "unknown";
    const reset = pinned && quota === "exhausted" ? resetsAt(pinned, now) : Infinity;
    return {
      providerId: input.pinnedProviderId,
      reason: "pinned",
      quota,
      ...(Number.isFinite(reset) ? { resetsAt: reset } : {}),
      skipped: [],
    };
  }
  const skipped: { providerId: string; why: SkipWhy }[] = [];
  const connected = ordered.filter((route) => route.connected);
  for (const route of ordered) {
    if (!route.connected) continue;
    if (route.toolCalls === false) { skipped.push({ providerId: route.providerId, why: "no-tools" }); continue; }
    const quota = providerQuotaState(route, now);
    if (quota === "exhausted") { skipped.push({ providerId: route.providerId, why: "limited" }); continue; }
    return { providerId: route.providerId, reason: skipped.length ? "fallback" : "best", quota, skipped };
  }
  const usable = connected.filter((route) => route.toolCalls !== false);
  if (!usable.length) return { providerId: null, reason: "none", quota: "unknown", skipped };
  // 모두 한도 — 가장 빨리 풀리는 길(같으면 우선순위).
  const soonest = [...usable].sort((a, b) => resetsAt(a, now) - resetsAt(b, now) || rank(a.providerId) - rank(b.providerId))[0]!;
  const reset = resetsAt(soonest, now);
  return {
    providerId: soonest.providerId,
    reason: "all-limited",
    quota: "exhausted",
    ...(Number.isFinite(reset) ? { resetsAt: reset } : {}),
    skipped: skipped.filter((entry) => entry.providerId !== soonest.providerId),
  };
}

/**
 * 칩 꼬리에 붙는 자동 선택 설명. 알릴 것이 없으면(우선순위 길을 그대로 씀) undefined.
 * - 한도로 다음 길을 썼으면 「Claude 한도 · 자동 전환」
 * - 모두 한도이거나 고정한 길이 한도면 「한도 초과 · 15:02 풀림」(시각을 모르면 「한도 초과」)
 */
export function autoPickNote(pick: AutoPick | null, labelOf: (providerId: string) => string, formatTime: (ms: number) => string): string | undefined {
  if (!pick?.providerId) return undefined;
  if (pick.quota === "exhausted") return pick.resetsAt !== undefined ? `한도 초과 · ${formatTime(pick.resetsAt)} 풀림` : "한도 초과";
  const limited = pick.skipped.find((entry) => entry.why === "limited");
  if (pick.reason === "fallback" && limited) return `${labelOf(limited.providerId)} 한도 · 자동 전환`;
  return undefined;
}
