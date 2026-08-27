// Preview/Tailscale 브라우저는 페이지 오리진의 /v1 로만 동반 서비스를 친다.
// 깨는 지점: import.meta.env.DEV=false 일 때 17832(브라우저 루프백)로 가면
// mdc-server:9888 에서 연 탭이 사용자 PC 의 127.0.0.1 을 두드린다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { companionCompletionsBaseUrl, DEFAULT_CHATGPT_BASE_URL, humanizeLlmStatus } from "@/ai/llmClient";
import { companionAuthUrl, companionCredentialMissing } from "@/ai/chatgptOAuthClient";
import { DEFAULT_OH_MY_PI_PROVIDER } from "@/ai/ohMyPiProviders";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("동반 서비스 같은 오리진", () => {
  it("preview(비-DEV)에서도 완결 URL 은 /v1 이다 — 127.0.0.1:17832 가 아니다", () => {
    expect(companionCompletionsBaseUrl({ DEV: false })).toBe("/v1");
    expect(companionCompletionsBaseUrl({ DEV: true })).toBe("/v1");
    expect(DEFAULT_CHATGPT_BASE_URL).toBe("/v1");
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
