import { afterEach, describe, expect, it, vi } from "vitest";

const fetchChatGptAuthStatus = vi.fn(async (providerId?: string) => ({ connected: providerId === "anthropic" }));
vi.mock("@/ai/chatgptOAuthClient", () => ({
  COMPANION_AUTH_CHANGED_EVENT: "oprn:companion-auth-changed",
  fetchChatGptAuthStatus: (...args: [string?]) => fetchChatGptAuthStatus(...args),
}));

const { AUTH_STATUS_CACHE_MS, clearCachedAuthStatus, fetchCachedAuthStatus } = await import("@/ai/authStatusCache");

afterEach(() => {
  clearCachedAuthStatus();
  fetchChatGptAuthStatus.mockClear();
  vi.useRealTimers();
});

describe("계정 상태 짧은 캐시", () => {
  it("같은 계정을 동시에·연달아 물어도 요청은 한 번이다", async () => {
    const results = await Promise.all([fetchCachedAuthStatus("anthropic"), fetchCachedAuthStatus("anthropic"), fetchCachedAuthStatus("openai-codex")]);
    await fetchCachedAuthStatus("anthropic");
    expect(results.map(r => r.connected)).toEqual([true, true, false]);
    expect(fetchChatGptAuthStatus.mock.calls.map(c => c[0])).toEqual(["anthropic", "openai-codex"]);
  });

  it("만료가 지나면 다시 묻는다", async () => {
    vi.useFakeTimers();
    await fetchCachedAuthStatus("anthropic");
    vi.setSystemTime(Date.now() + AUTH_STATUS_CACHE_MS + 1);
    await fetchCachedAuthStatus("anthropic");
    expect(fetchChatGptAuthStatus).toHaveBeenCalledTimes(2);
  });

  it("실패는 캐시에 남기지 않고, 한 호출의 중단이 다른 호출을 끊지 않는다", async () => {
    fetchChatGptAuthStatus.mockRejectedValueOnce(new Error("down"));
    await expect(fetchCachedAuthStatus("anthropic")).rejects.toThrow("down");
    const aborter = new AbortController();
    const aborted = fetchCachedAuthStatus("anthropic", aborter.signal);
    const other = fetchCachedAuthStatus("anthropic");
    aborter.abort(new Error("closed"));
    await expect(aborted).rejects.toThrow("closed");
    await expect(other).resolves.toMatchObject({ connected: true });
    expect(fetchChatGptAuthStatus).toHaveBeenCalledTimes(2);
  });
});
