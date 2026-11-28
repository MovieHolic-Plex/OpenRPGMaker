// editor/panels/aiAutoProvider.ts
// 조수 연결 자동 선택 — 연결된 길·한도를 모아(collectProviderRoutes) 고르고(pickAutoProvider) 설정에 입힌다(applyAutoPick).
//
// 왜 (2026-11-23 ai-setup-adaptive): 공장 기본(ChatGPT)이 사용자 상태와 무관해서 Claude 만 연결한 사용자는 「ChatGPT 로그인 필요」로 잠겼다.
// 사용자가 AI 설정에서 직접 연결을 고르면 고정(pin)되고, 그때부터는 자동으로 바꾸지 않는다.
import { companionAuthUrl, ensureOpenAiCompatEndpointsKnown } from "@/ai/chatgptOAuthClient";
import { AUTH_STATUS_CACHE_MS, fetchCachedAuthStatus } from "@/ai/authStatusCache";
import { fetchCompanion } from "@/ai/companionConnection";
import { configForProviderSelection } from "@/ai/providerSelection";
import { AI_TRANSPORT_HEALTH_EVENT, getAiTransportHealth, loadAiConfig, resetAiTransportHealth, saveAiConfig } from "@/ai/llmClient";
import { hasActiveProviderLimit, noteProviderLimited, providerLimitedUntil } from "@/ai/providerLimits";
import { localCliOfProvider, localCliProviderId, loadAssistantEngine, saveAssistantEngine } from "@/ai/localCliEngine";
import { ANTHROPIC_PROVIDER_ID, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { listKnownOpenAiCompatEndpoints } from "@/ai/openAiCompat";
import { CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { pickAutoProvider, type AutoPick, type ProviderRouteState } from "@/ai/autoProviderPick";
import type { ProviderUsageSnapshot } from "@/ai/providerQuota";
import { loadProviderPin } from "@/ai/providerPin";
import { ASSISTANT_CLAUDE_EFFORT } from "@/ai/claudeDefault";
import { createLocalAgentsApi, localAgentsEnabled, ASSISTANT_ENGINE_CHANGED_EVENT } from "@/start/settings/localAgents";

export const AI_AUTO_PICK_EVENT = "oprn:ai-auto-pick";

/**
 * 계정(/auth/status)으로 확인하는 길. 남은 한도는 연결된 길마다 /auth/usage 로 묻는다.
 * Google Antigravity / Gemini CLI OAuth 는 계정 정지 위험으로 자동 선택 대상에서 제외한다.
 */
const ACCOUNT_ROUTES = [ANTHROPIC_PROVIDER_ID, CODEX_PROVIDER_ID, "github-copilot", "xai-oauth", "openrouter"] as const;

const usageCache = new Map<string, { readonly at: number; readonly value: Promise<ProviderUsageSnapshot | null> }>();

/** 남은 한도도 계정 상태와 같은 30초 동안 다시 쓴다 — 부팅에 고르기가 두 번 돌면 /auth/usage 가 두 번 나갔다. */
function fetchUsage(providerId: string): Promise<ProviderUsageSnapshot | null> {
  const hit = usageCache.get(providerId);
  if (hit && Date.now() - hit.at < AUTH_STATUS_CACHE_MS) return hit.value;
  const value = readUsage(providerId);
  usageCache.set(providerId, { at: Date.now(), value });
  return value;
}

async function readUsage(providerId: string): Promise<ProviderUsageSnapshot | null> {
  try {
    const response = await fetchCompanion(companionAuthUrl("/auth/usage", providerId));
    if (!response.ok) return null;
    const body = await response.json() as ProviderUsageSnapshot;
    return body && typeof body.readable === "boolean" ? body : null;
  } catch {
    return null;
  }
}

async function accountRoute(providerId: string, limitedUntil: (id: string) => number | undefined): Promise<ProviderRouteState> {
  try {
    const status = await fetchCachedAuthStatus(providerId);
    const connected = status.connected && status.expired !== true;
    const usage = connected ? await fetchUsage(providerId) : null;
    return { providerId, connected, usage, limitedUntil: limitedUntil(providerId) };
  } catch {
    return { providerId, connected: false };
  }
}

/** 지금 쓸 수 있는 길을 모두 모은다. 실패한 조회는 「연결 안 됨」으로 센다(지어내지 않는다). */
export async function collectProviderRoutes(limitedUntil: (id: string) => number | undefined = () => undefined): Promise<ProviderRouteState[]> {
  const accounts = Promise.all(ACCOUNT_ROUTES.map((id) => accountRoute(id, limitedUntil)));
  const locals = (async (): Promise<ProviderRouteState[]> => {
    if (!localAgentsEnabled()) return [];
    try {
      const report = await createLocalAgentsApi().detect(false);
      return report.clis.map((cli) => {
        const providerId = localCliProviderId(cli.id);
        return { providerId, connected: cli.state === "ready", limitedUntil: limitedUntil(providerId) };
      });
    } catch {
      return [];
    }
  })();
  const compat = (async (): Promise<ProviderRouteState[]> => {
    try { await ensureOpenAiCompatEndpointsKnown(); } catch { /* 목록을 못 받으면 아는 것만 */ }
    return listKnownOpenAiCompatEndpoints().map((endpoint) => ({ providerId: endpoint.id, connected: endpoint.hasKey, limitedUntil: limitedUntil(endpoint.id) }));
  })();
  return [...await accounts, ...await locals, ...await compat];
}

/** 현재 설정이 가리키는 길 — 로컬 CLI 엔진을 골라 두었으면 그 CLI. */
export function currentProviderId(): string {
  const engine = loadAssistantEngine();
  return engine ? localCliProviderId(engine.cli) : parseOhMyPiProvider(loadAiConfig().providerId);
}

/** 고른 길을 설정에 입힌다. 바뀐 것이 있으면 true. 사용자가 직접 고친 역할 칸은 configForProviderSelection 이 지킨다. */
export function applyAutoPick(providerId: string): boolean {
  if (currentProviderId() === providerId) return false;
  const cli = localCliOfProvider(providerId);
  if (cli) {
    // 엔진 선택의 강도 기본은 medium 이다 — Claude 는 조수 기본(Sonnet 5.5 · high)과 같게 맞춘다.
    saveAssistantEngine({ kind: "local-cli", cli, ...(cli === "claude" ? { effort: ASSISTANT_CLAUDE_EFFORT } : {}) });
  } else {
    if (loadAssistantEngine()) saveAssistantEngine(undefined);
    const config = loadAiConfig();
    if (parseOhMyPiProvider(config.providerId) !== providerId) saveAiConfig(configForProviderSelection(config, providerId));
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ASSISTANT_ENGINE_CHANGED_EVENT));
  return true;
}

let lastPick: AutoPick | null = null;
let lastRoutes: readonly ProviderRouteState[] = [];
let running: Promise<AutoPick | null> | null = null;

export function lastAutoPick(): AutoPick | null {
  return lastPick;
}

/** 마지막 고르기에서 모은 길 목록(설정 첫 화면의 「연결된 계정」이 쓴다). */
export function lastAutoRoutes(): readonly ProviderRouteState[] {
  return lastRoutes;
}

/**
 * 상태를 모아 고르고 입힌다. 고정돼 있으면 상태만 모아 알린다(바꾸지 않는다). 동시에 여러 번 불러도 한 번만 돈다.
 * `onChanged` 는 설정이 실제로 바뀌었을 때만 부른다(연결 상태 캐시를 다시 읽게 하는 데 쓴다).
 */
export function runAutoProviderPick(options: { readonly limitedUntil?: (id: string) => number | undefined; readonly onChanged?: () => void } = {}): Promise<AutoPick | null> {
  if (running) return running;
  running = (async () => {
    try {
      const routes = await collectProviderRoutes(options.limitedUntil ?? ((id) => providerLimitedUntil(id)));
      const pick = pickAutoProvider({ routes, pinnedProviderId: loadProviderPin(), now: Date.now() });
      lastPick = pick;
      lastRoutes = routes;
      const changed = pick.reason !== "pinned" && pick.providerId !== null && applyAutoPick(pick.providerId);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AI_AUTO_PICK_EVENT, { detail: pick }));
      if (changed) options.onChanged?.();
      return pick;
    } catch {
      return null;
    } finally {
      running = null;
    }
  })();
  return running;
}

const RECHECK_MS = 60_000;

/**
 * 한도에 걸리면 다음 길로 바꾼다. 요청이 429 로 막히면(전송 상태 이벤트) 지금 길에 풀리는 시각을 적고 다시 고른다.
 * 쉬는 길이 있는 동안에는 1분마다 다시 골라, 풀리면 우선순위 길로 돌아간다. 고정한 길은 바꾸지 않는다(칩이 한도만 보인다).
 * 부팅에서 한 번 고르는 일도 여기서 한다. 돌려주는 함수로 끄다.
 */
export function installAutoProviderSwitching(onChanged: () => void): () => void {
  const changed = (): void => { resetAiTransportHealth(); onChanged(); };
  const run = (): void => { void runAutoProviderPick({ onChanged: changed }); };
  const onHealth = (): void => {
    const health = getAiTransportHealth();
    if (!health) return;
    // 성공 신호로 기록을 지우지 않는다 — 다른 길로 바꾼 뒤의 성공이나 모델 호출이 아닌 /v1 성공도 「풀림」으로 보일 수 있다.
    // 기록은 풀리는 시각이 지나면 저절로 무시된다(providerLimitedUntil).
    if (health.ok || health.status !== 429) return;
    noteProviderLimited(currentProviderId(), health.message);
    run();
  };
  const win = typeof window === "undefined" ? undefined : window;
  win?.addEventListener?.(AI_TRANSPORT_HEALTH_EVENT, onHealth);
  const timer = win?.setInterval(() => {
    if (hasActiveProviderLimit() || lastPick?.reason === "fallback" || lastPick?.reason === "all-limited") run();
  }, RECHECK_MS);
  run();
  return () => {
    win?.removeEventListener?.(AI_TRANSPORT_HEALTH_EVENT, onHealth);
    if (timer !== undefined) win?.clearInterval(timer);
  };
}
