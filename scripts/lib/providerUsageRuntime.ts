// 제공자 사용량(남은 한도) 조회 — Bun 워커 안에서만 돈다(@oh-my-pi/pi-ai 가 Bun 전용).
//
// 왜 (2026-11-10 ai-quota-aware): 조수가 한도 소진으로 멈췄을 때 사용자는 남은 양을 볼 곳이 없었다.
// pi-ai 18.16 은 제공자별 사용량 조회기(usage/*)를 이미 들고 있다 — Codex 는 계정 사용량 경로, Antigravity 는
// 모델별 quotaInfo. 토큰은 응답에 싣지 않는다(브라우저로 비밀이 나가지 않는다는 동반 서비스 불변식).
import { antigravityUsageProvider, openaiCodexUsageProvider, type UsageCredential, type UsageProvider, type UsageReport } from "@oh-my-pi/pi-ai";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "../../src/ai/oauth/credentials.ts";
import type { ProviderUsageSnapshot, ProviderUsageWindow } from "../../src/ai/providerQuota.ts";

const USAGE_TIMEOUT_MS = 10_000;

const USAGE_PROVIDERS: Readonly<Record<string, UsageProvider>> = {
  [CODEX_PROVIDER_ID]: openaiCodexUsageProvider,
  [ANTIGRAVITY_PROVIDER_ID]: antigravityUsageProvider,
};

function credentialFor(provider: string, apiKey: string): UsageCredential | null {
  if (provider === CODEX_PROVIDER_ID) return { type: "oauth", accessToken: apiKey };
  if (provider === ANTIGRAVITY_PROVIDER_ID) {
    try {
      const packed = JSON.parse(apiKey) as { token?: string; projectId?: string; expiresAt?: number; email?: string };
      if (!packed.token || !packed.projectId) return null;
      return { type: "oauth", accessToken: packed.token, projectId: packed.projectId, ...(packed.expiresAt ? { expiresAt: packed.expiresAt } : {}), ...(packed.email ? { email: packed.email } : {}) };
    } catch {
      return null;
    }
  }
  return null;
}

export function compactUsageReport(provider: string, report: UsageReport): ProviderUsageSnapshot {
  const windows: ProviderUsageWindow[] = report.limits.map((limit) => {
    const used = limit.amount.usedFraction;
    const remaining = limit.amount.remainingFraction ?? (used !== undefined ? 1 - used : undefined);
    return {
      label: limit.label,
      ...(remaining !== undefined && Number.isFinite(remaining) ? { remainingFraction: Math.min(1, Math.max(0, remaining)) } : {}),
      ...(limit.window?.resetsAt ? { resetsAt: limit.window.resetsAt } : {}),
      ...(limit.status === "exhausted" ? { exhausted: true } : {}),
    };
  });
  return { provider, readable: true, fetchedAt: report.fetchedAt || Date.now(), windows };
}

export async function fetchProviderUsage(provider: string, apiKey: string | undefined): Promise<ProviderUsageSnapshot> {
  const unknown = (reason: string): ProviderUsageSnapshot => ({ provider, readable: false, fetchedAt: Date.now(), windows: [], reason });
  const usageProvider = USAGE_PROVIDERS[provider];
  if (!usageProvider) return unknown("이 연결은 남은 한도를 알려 주지 않아요.");
  if (!apiKey) return unknown("로그인 정보가 없어 남은 한도를 확인하지 못했어요.");
  const credential = credentialFor(provider, apiKey);
  if (!credential) return unknown("이 연결의 로그인 정보로는 남은 한도를 확인할 수 없어요.");
  try {
    const report = await usageProvider.fetchUsage(
      { provider: provider as never, credential, signal: AbortSignal.timeout(USAGE_TIMEOUT_MS) },
      { fetch: globalThis.fetch.bind(globalThis) as never },
    );
    if (!report || report.limits.length === 0) return unknown("제공자가 남은 한도를 돌려주지 않았어요.");
    return compactUsageReport(provider, report);
  } catch (error) {
    console.warn(`[provider-usage] ${provider}: ${error instanceof Error ? error.name : "error"}`);
    return unknown("남은 한도를 확인하는 중 오류가 났어요.");
  }
}
