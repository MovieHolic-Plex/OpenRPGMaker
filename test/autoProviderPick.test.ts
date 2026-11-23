import { describe, expect, it } from "vitest";
import { pickAutoProvider, providerQuotaState, type ProviderRouteState } from "@/ai/autoProviderPick";
import type { ProviderUsageSnapshot } from "@/ai/providerQuota";

const NOW = 1_000_000;
const CLAUDE = "anthropic";
const CLAUDE_CLI = "local-cli:claude";
const CHATGPT = "openai-codex";
const GOOGLE = "google-antigravity";
const DEEPSEEK = "openai-compat:deepseek";

const usage = (provider: string, remainingFraction: number, resetsAt?: number): ProviderUsageSnapshot => ({
  provider, readable: true, fetchedAt: NOW,
  windows: [{ label: "5시간", remainingFraction, exhausted: remainingFraction === 0, resetsAt }],
});
const on = (providerId: string, extra: Partial<ProviderRouteState> = {}): ProviderRouteState => ({ providerId, connected: true, ...extra });
const off = (providerId: string): ProviderRouteState => ({ providerId, connected: false });

describe("pickAutoProvider — 상태 조합 표", () => {
  it.each<[string, ProviderRouteState[], string | null, string]>([
    ["Claude 만", [on(CLAUDE), off(CHATGPT)], CLAUDE, "best"],
    ["ChatGPT 만", [off(CLAUDE), on(CHATGPT)], CHATGPT, "best"],
    ["둘 다 — Claude 먼저", [on(CHATGPT), on(CLAUDE)], CLAUDE, "best"],
    ["Claude 구독 CLI 만", [on(CLAUDE_CLI), on(DEEPSEEK)], CLAUDE_CLI, "best"],
    ["Claude 한도(사용량 0%) → ChatGPT", [on(CLAUDE, { usage: usage(CLAUDE, 0) }), on(CHATGPT)], CHATGPT, "fallback"],
    ["Claude 최근 429 쉬는 중 → ChatGPT", [on(CLAUDE, { limitedUntil: NOW + 60_000 }), on(CHATGPT)], CHATGPT, "fallback"],
    ["Claude 429 시각이 지났으면 다시 Claude", [on(CLAUDE, { limitedUntil: NOW - 1 }), on(CHATGPT)], CLAUDE, "best"],
    ["한도 모름은 쓸 수 있다", [on(CLAUDE, { usage: { provider: CLAUDE, readable: false, fetchedAt: NOW, windows: [] } }), on(CHATGPT)], CLAUDE, "best"],
    ["도구 호출 불가 길은 건너뛴다", [on(CLAUDE, { toolCalls: false }), on(GOOGLE)], GOOGLE, "fallback"],
    ["키 길은 사용자 지정 엔드포인트보다 앞", [on(DEEPSEEK), on("xai-oauth")], "xai-oauth", "best"],
    ["사용자 지정 엔드포인트만", [on(DEEPSEEK)], DEEPSEEK, "best"],
    ["연결 없음", [off(CLAUDE), off(CHATGPT)], null, "none"],
    ["빈 목록", [], null, "none"],
  ])("%s", (_name, routes, providerId, reason) => {
    const pick = pickAutoProvider({ routes, now: NOW });
    expect(pick.providerId).toBe(providerId);
    expect(pick.reason).toBe(reason);
  });

  it("건너뛴 길과 이유를 남긴다", () => {
    const pick = pickAutoProvider({ routes: [on(CLAUDE, { usage: usage(CLAUDE, 0) }), on(CLAUDE_CLI, { toolCalls: false }), on(CHATGPT)], now: NOW });
    expect(pick.skipped).toEqual([{ providerId: CLAUDE, why: "limited" }, { providerId: CLAUDE_CLI, why: "no-tools" }]);
  });

  it("모두 한도면 가장 빨리 풀리는 길을 고르고 exhausted 로 알린다", () => {
    const pick = pickAutoProvider({
      routes: [on(CLAUDE, { usage: usage(CLAUDE, 0, NOW + 3_600_000) }), on(CHATGPT, { limitedUntil: NOW + 600_000 })],
      now: NOW,
    });
    expect(pick).toMatchObject({ providerId: CHATGPT, reason: "all-limited", quota: "exhausted" });
  });

  it("고정한 연결은 한도라도 바꾸지 않는다", () => {
    const pick = pickAutoProvider({ routes: [on(CLAUDE), on(CHATGPT, { limitedUntil: NOW + 1 })], pinnedProviderId: CHATGPT, now: NOW });
    expect(pick).toMatchObject({ providerId: CHATGPT, reason: "pinned", quota: "exhausted", skipped: [] });
  });
});

describe("providerQuotaState", () => {
  it.each<[string, ProviderRouteState, string]>([
    ["넉넉함", on(CLAUDE, { usage: usage(CLAUDE, 0.6) }), "ok"],
    ["10% 아래", on(CLAUDE, { usage: usage(CLAUDE, 0.05) }), "low"],
    ["소진", on(CLAUDE, { usage: usage(CLAUDE, 0) }), "exhausted"],
    ["읽을 수 없음", on(CLAUDE, { usage: null }), "unknown"],
    ["429 쉬는 중이 사용량보다 우선", on(CLAUDE, { usage: usage(CLAUDE, 0.9), limitedUntil: NOW + 1 }), "exhausted"],
  ])("%s", (_name, route, expected) => {
    expect(providerQuotaState(route, NOW)).toBe(expected);
  });
});
