import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelCompanionLogin, companionAuthUrl, fetchChatGptAuthStatus } from "@/ai/chatgptOAuthClient";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("companionAuthUrl", () => {
  it("선택한 oh-my-pi 제공자를 쿼리에 넣는다", () => {
    vi.stubEnv("DEV", "true");
    // 레지스트리에 있는 두 제공자는 그대로 실린다.
    expect(companionAuthUrl("/auth/status", "openai-codex")).toContain("provider=openai-codex");
    expect(companionAuthUrl("/auth/status", "google-antigravity")).toContain("provider=google-antigravity");
    // 레지스트리 밖 값(옛 제공자 id·오타)은 기본 제공자로 스냅한다 — 동반 서비스에 모르는
    // 제공자를 물어보면 404 로 돌아오고, 화면은 그것을 "로그인 필요" 로 오해한다.
    expect(companionAuthUrl("/auth/login", "groq")).toContain("provider=google-antigravity");
    expect(companionAuthUrl("/auth/login", "not-a-provider")).toContain("provider=google-antigravity");
  });
});


describe("login attempt status", () => {
  it("preserves denial and resumable instructions returned by the companion", async () => {
    const pendingLogin = {
      verificationUrl: "https://example.invalid/login", userCode: "CODE",
      startedAt: 100, expiresAt: 200, pasteCallback: true,
    };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      connected: false, lastLoginError: "Authorization denied", pendingLogin,
    })));
    const status = await fetchChatGptAuthStatus("openai-codex");
    expect(status.lastLoginError).toBe("Authorization denied");
    expect(status.pendingLogin).toMatchObject(pendingLogin);
  });

  it("cancels a login through the companion without calling logout", async () => {
    const fetch = vi.fn(async () => Response.json({ connected: false }));
    vi.stubGlobal("fetch", fetch);
    expect((await cancelCompanionLogin("openai-codex")).connected).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/auth/login-cancel?provider=openai-codex");
    expect(init.method).toBe("POST");
  });
});
