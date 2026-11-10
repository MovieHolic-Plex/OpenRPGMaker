import { describe, expect, it } from "vitest";
import { isQuotaOrRateLimitError, lowestRemaining, quotaFailureCopy, usageChipSuffix, usageDetail, type ProviderUsageSnapshot } from "@/ai/providerQuota";

describe("isQuotaOrRateLimitError", () => {
  it.each([
    "429 Too Many Requests",
    '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}',
    "Cloud Code Assist API error (429): RESOURCE_EXHAUSTED",
    "rate_limit_error: Number of request tokens has exceeded your per-minute rate limit",
    "You've hit your usage limit. Resets in 3h12m0s",
    "요청 한도 초과(429): 잠시 후 다시 시도하세요.",
  ])("한도 문구로 판정한다: %s", (message) => {
    expect(isQuotaOrRateLimitError(message)).toBe(true);
  });

  it.each([
    "502 Bad Gateway",
    "socket hang up",
    "stream ended without a finish reason",
    "인증 실패(401): API 키가 없거나 잘못되었습니다.",
    "",
  ])("일시 끊김·인증 오류는 한도로 보지 않는다: %s", (message) => {
    expect(isQuotaOrRateLimitError(message)).toBe(false);
  });
});

describe("quotaFailureCopy", () => {
  it("제공자 이름과 전환 안내를 넣고 성공을 말하지 않는다", () => {
    const text = quotaFailureCopy("Codex(ChatGPT)", false);
    expect(text).toContain("Codex(ChatGPT)");
    expect(text).toContain("다른 AI 연결");
    expect(text).toContain("적용하지 않았어요");
    expect(text).not.toMatch(/완료|적용했/);
  });

  it("이미 반영한 변경이 있으면 그 사실을 남긴다", () => {
    expect(quotaFailureCopy("Antigravity", true)).toContain("반영한 변경은 남아 있고");
  });
});

describe("usage 칩 문구", () => {
  const readable: ProviderUsageSnapshot = {
    provider: "openai-codex",
    readable: true,
    fetchedAt: 0,
    windows: [
      { label: "5시간", remainingFraction: 0.63, resetsAt: 30 * 60_000 },
      { label: "주간", remainingFraction: 0.9 },
    ],
  };

  it("읽을 수 있으면 가장 적게 남은 창의 비율을 보인다", () => {
    expect(lowestRemaining(readable)).toBeCloseTo(0.63);
    expect(usageChipSuffix(readable)).toBe("남음 63%");
    expect(usageDetail(readable, 0)).toBe("5시간: 63% 남음 · 30분 뒤 초기화 / 주간: 90% 남음");
  });

  it("소진 창은 0% 로 센다", () => {
    expect(usageChipSuffix({ ...readable, windows: [{ label: "5시간", exhausted: true }, { label: "주간", remainingFraction: 0.5 }] })).toBe("남음 0%");
  });

  it("읽을 수 없으면 숫자를 지어내지 않고 「알 수 없음」 과 이유를 보인다", () => {
    const unknown: ProviderUsageSnapshot = { provider: "openai-compat:x", readable: false, fetchedAt: 0, windows: [], reason: "이 연결은 남은 한도를 알려 주지 않아요." };
    expect(usageChipSuffix(unknown)).toBe("남은 한도 알 수 없음");
    expect(usageChipSuffix(null)).toBe("남은 한도 알 수 없음");
    expect(usageDetail(unknown)).toBe("이 연결은 남은 한도를 알려 주지 않아요.");
  });
});
