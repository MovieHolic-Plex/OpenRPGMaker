import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatGptCompanionResponseError, ChatGptCompanionUnreachableError, COMPANION_TIMEOUT_MS, fetchChatGptAuthStatus, fetchCompanionProviders, hasStoredCompanionCredential, hasUsableCompanionCredential, companionAuthUrl, companionCredentialMissing, cancelCompanionLogin } from "@/ai/chatgptOAuthClient";
import { companionCompletionsBaseUrl, companionRequestBaseUrl, DEFAULT_CHATGPT_BASE_URL, humanizeLlmStatus } from "@/ai/llmClient";
import { DEFAULT_OH_MY_PI_PROVIDER } from "@/ai/ohMyPiProviders";
import { isolateTimers } from "./mergedTeardown";

// 동반 서비스 클라이언트 회귀 스펙.
//
// 세 결함을 고정한다(전부 2026-08-21 실측):
//  ① 상태 응답의 authKind/expired/env 를 버려서, 브라우저가 "자격 없음"과 "셸 env 만 있음"과
//     "만료"를 구분할 수 없었다.
//  ② companionFetch 에 타임아웃이 없어서 소켓만 잡히면 영원히 매달렸다 — 상태 칩이 "확인 중"에
//     영구히 멈추고 재시도 가드까지 안 풀렸다.
//  ③ 2xx 인데 JSON 이 아닌 응답(vite SPA 폴백 = 경로 미등록)을 성공으로 읽었다.
describe("aiCompanionAuthClient", () => {
  isolateTimers();
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  /** vite dev 서버가 미등록 경로 GET 에 주는 응답 모양. */
  function spaFallback(): Response {
    return new Response("<!doctype html><html lang=\"ko\"></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  describe("상태 응답을 버리지 않는다", () => {
    it("authKind·expired·env 를 그대로 실어 온다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
        connected: true, authKind: "oauth", expired: false, env: false, planType: "plus",
      })));

      const status = await fetchChatGptAuthStatus("openai-codex");

      expect(status).toMatchObject({
        connected: true, authKind: "oauth", expired: false, env: false, planType: "plus",
      });
    });

    it("모르는 authKind 값은 undefined 로 떨군다 (지어내지 않는다)", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ connected: true, authKind: "sorcery" })));
      expect((await fetchChatGptAuthStatus()).authKind).toBeUndefined();
    });
  });
  describe("hasStoredCompanionCredential — 환경 변수는 쓸 수 있지만 지우지는 못한다", () => {
    it("저장된 자격만 연결로 인정한다", () => {
      expect(hasStoredCompanionCredential({ connected: true, env: false })).toBe(true);
      expect(hasStoredCompanionCredential({ connected: true })).toBe(true);
    });

    it("환경 변수 키는 쓸 수 있지만 저장 자격은 아니다", () => {
      expect(hasUsableCompanionCredential({ connected: true, env: true })).toBe(true);
      expect(hasStoredCompanionCredential({ connected: true, env: true })).toBe(false);
    });

    it("만료된 자격은 인정하지 않는다", () => {
      expect(hasStoredCompanionCredential({ connected: true, expired: true })).toBe(false);
    });

    it("미연결은 당연히 인정하지 않는다", () => {
      expect(hasStoredCompanionCredential({ connected: false })).toBe(false);
    });
  });
  describe("도달 불가 (A) 의 세 원인을 구분한다", () => {
    it("fetch 가 던지면 network", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }));

      const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
      expect((error as ChatGptCompanionUnreachableError).reason).toBe("network");
    });

    it("응답이 오지 않으면 타임아웃으로 끊는다", async () => {
      // 타임아웃이 없던 동안 이 호출은 영원히 pending 이었다.
      vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })));
      vi.useFakeTimers();

      const pending = fetchChatGptAuthStatus().catch((cause: unknown) => cause);
      await vi.advanceTimersByTimeAsync(COMPANION_TIMEOUT_MS + 10);
      const error = await pending;

      expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
      expect((error as ChatGptCompanionUnreachableError).reason).toBe("timeout");
    });

    it("2xx 인데 앱 HTML 이면 경로 미등록으로 읽는다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => spaFallback()));

      const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
      expect((error as ChatGptCompanionUnreachableError).reason).toBe("not-mounted");
    });

    it("4xx 는 도달 불가가 아니라 응답 오류 (B) 다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, 500)));

      const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ChatGptCompanionResponseError);
      expect((error as ChatGptCompanionResponseError).serverMessage).toBe("boom");
    });
  });
  describe("fetchCompanionProviders", () => {
    it("제공자 목록을 정규화해 돌려준다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
        providers: [
          { id: "openai-codex", label: "OpenAI Codex", authKind: "oauth", defaultModel: "gpt-5.5", hasLogin: true, hasRefresh: true },
          { id: "zai", label: "zAI", authKind: "apiKey", defaultModel: "glm-5.3", hasLogin: true, hasRefresh: false },
          { label: "id 없는 줄은 버린다" },
        ],
      })));

      const providers = await fetchCompanionProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0]).toMatchObject({ id: "openai-codex", authKind: "oauth", hasRefresh: true });
      expect(providers[1]).toMatchObject({ id: "zai", authKind: "apiKey", hasRefresh: false });
    });

    it("목록이 없으면 빈 배열이다 (throw 하지 않는다)", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));
      expect(await fetchCompanionProviders()).toEqual([]);
    });
  });
});

// Preview/Tailscale 브라우저는 페이지 오리진의 /v1 로만 동반 서비스를 친다.
// 깨는 지점: import.meta.env.DEV=false 일 때 17832(브라우저 루프백)로 가면
// mdc-server:9888 에서 연 탭이 사용자 PC 의 127.0.0.1 을 두드린다.
describe("aiCompanionSameOrigin", () => {
  isolateTimers();
  afterEach(() => {
    vi.restoreAllMocks();
    // restoreAllMocks does not undo vi.stubGlobal; the Electron-bridge window stub leaked into the /auth case.
    vi.unstubAllGlobals();
  });
  describe("동반 서비스 같은 오리진", () => {
    it("preview(비-DEV)에서도 완결 URL 은 /v1 이다 — 127.0.0.1:17832 가 아니다", () => {
      expect(companionCompletionsBaseUrl({ DEV: false })).toBe("/v1");
      expect(companionCompletionsBaseUrl({ DEV: true })).toBe("/v1");
      expect(DEFAULT_CHATGPT_BASE_URL).toBe("/v1");
    });

    it("일렉트론 브리지가 있으면 채팅은 루프백 /v1 로 간다", () => {
      vi.stubGlobal("window", { oprn: { companionOrigin: "http://127.0.0.1:43123" } });
      expect(companionRequestBaseUrl()).toBe("http://127.0.0.1:43123/v1");
    });

    it("인증 경로는 같은 오리진 /auth 다", () => {
      expect(companionAuthUrl("/auth/status", DEFAULT_OH_MY_PI_PROVIDER)).toBe(
        `/auth/status?provider=${DEFAULT_OH_MY_PI_PROVIDER}`,
      );
    });
  });
  describe("Gemini 로그인 안내", () => {
    it("OAuth 401 은 Google Gemini 로그인을 말한다", () => {
      expect(humanizeLlmStatus(401, "", "chatgpt")).toMatch(/Gemini/);
      expect(humanizeLlmStatus(401, "", "chatgpt")).not.toMatch(/ChatGPT/);
    });

    it("동반 서비스가 미연결이면 로그인이 필요하다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ connected: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })));
      await expect(companionCredentialMissing(DEFAULT_OH_MY_PI_PROVIDER)).resolves.toBe(true);
    });

    it("저장된 자격이 있으면 로그인이 필요 없다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ connected: true, env: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })));
      await expect(companionCredentialMissing(DEFAULT_OH_MY_PI_PROVIDER)).resolves.toBe(false);
    });
  });
});

describe("chatgptOAuthClient", () => {
  isolateTimers();
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
});
