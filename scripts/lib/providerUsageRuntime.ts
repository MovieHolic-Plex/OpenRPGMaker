// 제공자 사용량(남은 한도) 조회 — 순수 Node fetch 로 동작한다(@oh-my-pi 의존 제거).
//
// Codex(ChatGPT 구독)는 ChatGPT 백엔드 usage 엔드포인트를 조회하고,
// Google Antigravity 직접 OAuth 는 계정 정지 위험으로 비활성화되어 조회하지 않는다.
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "../../src/ai/oauth/credentials.ts";
import type { ProviderUsageSnapshot, ProviderUsageWindow } from "../../src/ai/providerQuota.ts";

const USAGE_TIMEOUT_MS = 10_000;
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

interface CodexRateLimitWindow {
  readonly used_percent?: number;
  readonly reset_at?: number;
  readonly limit_window_seconds?: number;
}

interface CodexUsageResponse {
  readonly rate_limit?: {
    readonly primary_window?: CodexRateLimitWindow | null;
    readonly secondary_window?: CodexRateLimitWindow | null;
  } | null;
}

function toWindow(label: string, win: CodexRateLimitWindow | null | undefined): ProviderUsageWindow | null {
  if (!win || typeof win !== "object") return null;
  const used = typeof win.used_percent === "number" && Number.isFinite(win.used_percent) ? win.used_percent / 100 : undefined;
  const remaining = used !== undefined ? Math.min(1, Math.max(0, 1 - used)) : undefined;
  const resetsAt = typeof win.reset_at === "number" && Number.isFinite(win.reset_at)
    ? (win.reset_at < 1e12 ? win.reset_at * 1000 : win.reset_at)
    : undefined;
  return {
    label,
    ...(remaining !== undefined ? { remainingFraction: remaining } : {}),
    ...(resetsAt !== undefined ? { resetsAt } : {}),
    ...(remaining !== undefined && remaining <= 0 ? { exhausted: true } : {}),
  };
}

function windowLabel(seconds: number | undefined, fallback: string): string {
  if (!seconds || !Number.isFinite(seconds)) return fallback;
  const hours = Math.round(seconds / 3600);
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24}일 한도`;
  if (hours >= 1) return `${hours}시간 한도`;
  return fallback;
}

export async function fetchProviderUsage(provider: string, apiKey: string | undefined): Promise<ProviderUsageSnapshot> {
  const unknown = (reason: string): ProviderUsageSnapshot => ({ provider, readable: false, fetchedAt: Date.now(), windows: [], reason });
  if (provider === ANTIGRAVITY_PROVIDER_ID) {
    return unknown("Google 계정 직접 로그인은 비활성화되어 있습니다.");
  }
  if (provider !== CODEX_PROVIDER_ID) {
    return unknown("이 연결은 남은 한도를 알려 주지 않아요.");
  }
  if (!apiKey) return unknown("로그인 정보가 없어 남은 한도를 확인하지 못했어요.");
  try {
    const response = await fetch(CODEX_USAGE_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(USAGE_TIMEOUT_MS),
    });
    if (!response.ok) return unknown("제공자가 남은 한도를 돌려주지 않았어요.");
    const data = (await response.json()) as CodexUsageResponse;
    const primary = toWindow(windowLabel(data.rate_limit?.primary_window?.limit_window_seconds, "5시간 한도"), data.rate_limit?.primary_window);
    const secondary = toWindow(windowLabel(data.rate_limit?.secondary_window?.limit_window_seconds, "주간 한도"), data.rate_limit?.secondary_window);
    const windows = [primary, secondary].filter((w): w is ProviderUsageWindow => w !== null);
    if (windows.length === 0) return unknown("제공자가 남은 한도를 돌려주지 않았어요.");
    return { provider, readable: true, fetchedAt: Date.now(), windows };
  } catch (error) {
    console.warn(`[provider-usage] ${provider}: ${error instanceof Error ? error.name : "error"}`);
    return unknown("남은 한도를 확인하는 중 오류가 났어요.");
  }
}
