// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LIMIT_PAUSE_MS, clearProviderLimit, hasActiveProviderLimit, noteProviderLimited, parseRetryAfterMs, providerLimitedUntil } from "@/ai/providerLimits";
import { autoPickNote, pickAutoProvider } from "@/ai/autoProviderPick";

describe("parseRetryAfterMs", () => {
  it.each<[string, number | undefined]>([
    ["사용 한도 초과 (Retry-After 3600)", 3_600_000],
    ["429 Rate limit exceeded. retry-after: 120", 120_000],
    ["You've hit your usage limit. Resets in 3h12m0s", (3 * 60 + 12) * 60_000],
    ["Please try again in 20s.", 20_000],
    ["Retry in 1m30s", 90_000],
    ["사용 한도 초과", undefined],
    ["타일 429번", undefined],
    ["", undefined],
  ])("%s", (message, expected) => {
    expect(parseRetryAfterMs(message)).toBe(expected);
  });
});

describe("제공자별 한도 기록", () => {
  beforeEach(() => localStorage.clear());
  const NOW = 1_000_000;

  it("Retry-After 만큼 쉬고, 지나면 풀린다", () => {
    expect(noteProviderLimited("anthropic", "Retry-After 60", NOW)).toBe(NOW + 60_000);
    expect(providerLimitedUntil("anthropic", NOW + 59_999)).toBe(NOW + 60_000);
    expect(providerLimitedUntil("anthropic", NOW + 60_000)).toBeUndefined();
    expect(providerLimitedUntil("openai-codex", NOW)).toBeUndefined();
  });

  it("시각을 모르면 기본 간격만 쉰다", () => {
    expect(noteProviderLimited("anthropic", "사용 한도 초과", NOW)).toBe(NOW + DEFAULT_LIMIT_PAUSE_MS);
    expect(hasActiveProviderLimit(NOW)).toBe(true);
    clearProviderLimit("anthropic");
    expect(hasActiveProviderLimit(NOW)).toBe(false);
  });

  it("429 를 적으면 자동 선택이 다음 길로 넘어가고 칩이 그 사실을 말한다", () => {
    noteProviderLimited("anthropic", "Retry-After 600", NOW);
    const pick = pickAutoProvider({
      routes: ["anthropic", "openai-codex"].map((providerId) => ({ providerId, connected: true, limitedUntil: providerLimitedUntil(providerId, NOW) })),
      now: NOW,
    });
    expect(pick.providerId).toBe("openai-codex");
    expect(autoPickNote(pick, (id) => (id === "anthropic" ? "Claude" : id), () => "")).toBe("Claude 한도 · 자동 전환");
  });
});

describe("autoPickNote", () => {
  const label = (id: string): string => id;
  const time = (ms: number): string => `T${ms}`;
  it("우선순위 길을 그대로 썼으면 말하지 않는다", () => {
    expect(autoPickNote({ providerId: "anthropic", reason: "best", quota: "unknown", skipped: [] }, label, time)).toBeUndefined();
    expect(autoPickNote(null, label, time)).toBeUndefined();
  });
  it("모두 한도·고정 길 한도는 풀리는 시각을 말한다", () => {
    expect(autoPickNote({ providerId: "a", reason: "all-limited", quota: "exhausted", resetsAt: 5, skipped: [] }, label, time)).toBe("한도 초과 · T5 풀림");
    expect(autoPickNote({ providerId: "a", reason: "pinned", quota: "exhausted", skipped: [] }, label, time)).toBe("한도 초과");
  });
});
