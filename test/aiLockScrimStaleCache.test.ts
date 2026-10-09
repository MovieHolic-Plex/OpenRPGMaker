/** @vitest-environment happy-dom */
// 잠금 막 × 공유 연결 캐시 — 다른 표면이 시작한 조회가 캐시를 바꿔도 막이 따라 걷혀야 한다.
//
// 실측(2026-09-26): 부팅 첫 `/auth/status` 가 실패(offline)하면 막이 덮이고, 이어서 다른 호출부
// (부팅 warm-up·설정 모달·칩)가 한 조회가 `connected:true` 를 받아도 막은 자기 콜백이 불린
// 적이 없어 그대로 남았다. Google 에 로그인돼 있는데도 「AI 연결이 필요합니다」 가 떴다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchChatGptAuthStatus = vi.fn();
vi.mock("@/ai/chatgptOAuthClient", () => ({
  fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
  startChatGptLogin: vi.fn(),
}));

const { createAiLockScrim } = await import("@/editor/panels/aiLockScrim");
const { refreshAiConnectionStatus, resetAiConnectionStatusCache } = await import("@/editor/panels/aiConnectionStatus");

beforeEach(() => {
  localStorage.setItem("oprn:ai-config", JSON.stringify({ authMode: "chatgpt", providerId: "google-antigravity", model: "gemini-3.8-flash", maxTokens: 32768 }));
});

afterEach(() => {
  resetAiConnectionStatusCache();
  localStorage.clear();
  fetchChatGptAuthStatus.mockReset();
});

describe("잠금 막은 공유 캐시 변화를 따라간다", () => {
  it("첫 조회가 실패해 덮인 뒤, 다른 호출부의 조회가 연결됨을 받으면 걷힌다", async () => {
    fetchChatGptAuthStatus.mockRejectedValueOnce(new Error("companion offline"));
    await refreshAiConnectionStatus();

    const scrim = createAiLockScrim({ onOpenSettings: () => undefined });
    expect(scrim.sync()).toBe(true);

    // 막이 아닌 다른 표면(부팅 warm-up·설정 모달)이 콜백 없이 다시 조회한다.
    fetchChatGptAuthStatus.mockResolvedValueOnce({ connected: true, expired: false });
    await refreshAiConnectionStatus();

    expect(scrim.element.hidden).toBe(true);
    scrim.dispose();
  });

  it("진행 중인 조회에 합류한 호출부도 결과를 받는다", async () => {
    let resolve!: (value: { connected: boolean }) => void;
    fetchChatGptAuthStatus.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const first = refreshAiConnectionStatus();
    const seen: string[] = [];
    const joined = refreshAiConnectionStatus(() => seen.push("changed"));
    resolve({ connected: true });
    await Promise.all([first, joined]);
    expect(seen).toEqual(["changed"]);
  });
});
