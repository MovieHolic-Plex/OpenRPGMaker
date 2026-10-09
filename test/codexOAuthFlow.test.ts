// Codex 디바이스 코드 OAuth 를 자체 구현으로 포팅한 것에 대한 스펙.
//
// 이 스위트는 실제 시간을 절대 기다리지 않는다: sleep 을 주입해 즉시 resolve 시키고,
// 폴링 한계는 "스텁이 몇 번 불렸나"로 검증한다. 5초 * 120회를 실제로 기다리면
// vitest testTimeout(15s) 로는 애초에 통과가 불가능하다.
import { describe, expect, it } from "vitest";
import {
  codexClientId,
  CODEX_DEVICE_MAX_POLLS,
  CODEX_DEVICE_REDIRECT_URI,
  CODEX_DEVICE_TOKEN_URL,
  CODEX_DEVICE_USERCODE_URL,
  CODEX_DEVICE_VERIFICATION_URL,
  CODEX_TOKEN_URL,
  pollCodexDeviceAuthorization,
  refreshCodexToken,
  startCodexDeviceAuthorization,
} from "@/ai/oauth/codexDeviceOAuth";
import { configureOAuthClients } from "@/ai/oauth/clientConfig";

// 실제 Codex client id 는 저장소에 없다(clientConfig.ts) — 가짜 값으로 와이어만 본다.
configureOAuthClients({ codexClientId: "test-codex-client" });

const AUTH_CLAIM = "https://api.openai.com/auth";
const PROFILE_CLAIM = "https://api.openai.com/profile";

function base64Url(json: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jwt(payload: Record<string, unknown>): string {
  return `${base64Url({ alg: "none" })}.${base64Url(payload)}.sig`;
}

const ACCESS_TOKEN = jwt({
  [AUTH_CLAIM]: { chatgpt_account_id: "acct-42" },
  [PROFILE_CLAIM]: { email: "  Dev@Example.COM " },
});
const ID_TOKEN = jwt({ [AUTH_CLAIM]: { chatgpt_plan_type: "Pro" } });

interface Call {
  url: string;
  method: string;
  body: string;
}

function stubFetch(responses: Array<() => Response>): { fetch: typeof globalThis.fetch; calls: Call[] } {
  const calls: Call[] = [];
  let index = 0;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body;
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: body instanceof URLSearchParams ? body.toString() : typeof body === "string" ? body : "",
    });
    const factory = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (!factory) throw new Error("stub fetch: no response configured");
    return factory();
  }) as unknown as typeof globalThis.fetch;
  return { fetch: fetchImpl, calls };
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const noSleep = async (): Promise<void> => {};

describe("Codex 디바이스 코드 로그인", () => {
  it("usercode → 403/404 대기 폴링 → 승인 → 코드 교환까지 완주한다", async () => {
    const start = stubFetch([() => json(200, { device_auth_id: "dev-1", user_code: "WXYZ-1234", interval: 5 })]);

    const authorization = await startCodexDeviceAuthorization({ fetch: start.fetch });

    expect(start.calls).toEqual([
      {
        url: CODEX_DEVICE_USERCODE_URL,
        method: "POST",
        body: JSON.stringify({ client_id: codexClientId() }),
      },
    ]);
    expect(CODEX_DEVICE_USERCODE_URL).toBe("https://auth.openai.com/api/accounts/deviceauth/usercode");
    expect(authorization.deviceAuthId).toBe("dev-1");
    expect(authorization.userCode).toBe("WXYZ-1234");
    expect(authorization.verificationUrl).toBe("https://auth.openai.com/codex/device");
    expect(CODEX_DEVICE_VERIFICATION_URL).toBe("https://auth.openai.com/codex/device");
    expect(authorization.pollIntervalMs).toBeGreaterThan(0);

    const poll = stubFetch([
      () => json(403, { error: "authorization_pending" }),
      () => json(404, {}),
      () => json(200, { authorization_code: "auth-code-1", code_verifier: "verifier-1" }),
      () =>
        json(200, {
          access_token: ACCESS_TOKEN,
          refresh_token: "refresh-1",
          id_token: ID_TOKEN,
          expires_in: 3600,
        }),
    ]);

    const credentials = await pollCodexDeviceAuthorization({
      ...authorization,
      fetch: poll.fetch,
      sleep: noSleep,
    });

    expect(poll.calls.map((call) => [call.url, call.method])).toEqual([
      [CODEX_DEVICE_TOKEN_URL, "POST"],
      [CODEX_DEVICE_TOKEN_URL, "POST"],
      [CODEX_DEVICE_TOKEN_URL, "POST"],
      [CODEX_TOKEN_URL, "POST"],
    ]);
    expect(CODEX_DEVICE_TOKEN_URL).toBe("https://auth.openai.com/api/accounts/deviceauth/token");
    expect(CODEX_TOKEN_URL).toBe("https://auth.openai.com/oauth/token");
    expect(JSON.parse(poll.calls[0]!.body)).toEqual({ device_auth_id: "dev-1", user_code: "WXYZ-1234" });

    const exchangeBody = new URLSearchParams(poll.calls[3]!.body);
    expect(exchangeBody.get("grant_type")).toBe("authorization_code");
    expect(exchangeBody.get("client_id")).toBe(codexClientId());
    expect(exchangeBody.get("code")).toBe("auth-code-1");
    expect(exchangeBody.get("code_verifier")).toBe("verifier-1");
    expect(exchangeBody.get("redirect_uri")).toBe(CODEX_DEVICE_REDIRECT_URI);
    expect(CODEX_DEVICE_REDIRECT_URI).toBe("https://auth.openai.com/deviceauth/callback");

    expect(credentials.access).toBe(ACCESS_TOKEN);
    expect(credentials.refresh).toBe("refresh-1");
    expect(credentials.expires).toBeGreaterThan(Date.now());
    expect(credentials.accountId).toBe("acct-42");
    expect(credentials.orgId).toBe("acct-42");
    expect(credentials.orgName).toBe("pro");
    expect(credentials.email).toBe("dev@example.com");
  });

  it("갱신은 refresh_token grant 로 새 자격을 만든다", async () => {
    const refresh = stubFetch([
      () => json(200, { access_token: ACCESS_TOKEN, refresh_token: "refresh-2", expires_in: 1800 }),
    ]);

    const credentials = await refreshCodexToken({ refreshToken: "refresh-1", fetch: refresh.fetch });

    expect(refresh.calls[0]!.url).toBe(CODEX_TOKEN_URL);
    expect(refresh.calls[0]!.method).toBe("POST");
    const body = new URLSearchParams(refresh.calls[0]!.body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-1");
    expect(body.get("client_id")).toBe(codexClientId());

    expect(credentials.access).toBe(ACCESS_TOKEN);
    expect(credentials.refresh).toBe("refresh-2");
    expect(credentials.expires).toBeGreaterThan(Date.now());
    expect(credentials.accountId).toBe("acct-42");
    // 갱신 결과는 org 를 의도적으로 비운다 — 호출부가 저장본 위에 병합해 워크스페이스를 보존한다.
    expect(credentials.orgId).toBeUndefined();
    expect(credentials.orgName).toBeUndefined();
  });
});

describe("Codex 디바이스 코드 실패 경로", () => {
  it("usercode 응답에 device_auth_id 나 user_code 가 없으면 던진다", async () => {
    for (const body of [{ user_code: "AAAA" }, { device_auth_id: "dev-1" }, {}]) {
      const stub = stubFetch([() => json(200, body)]);
      await expect(startCodexDeviceAuthorization({ fetch: stub.fetch })).rejects.toThrow();
    }
  });

  it("승인 응답에 authorization_code 나 code_verifier 가 없으면 던진다", async () => {
    for (const body of [{ authorization_code: "auth-code-1" }, { code_verifier: "verifier-1" }, {}]) {
      const stub = stubFetch([() => json(200, body)]);
      await expect(
        pollCodexDeviceAuthorization({
          deviceAuthId: "dev-1",
          userCode: "WXYZ-1234",
          pollIntervalMs: 5000,
          fetch: stub.fetch,
          sleep: noSleep,
        }),
      ).rejects.toThrow();
    }
  });

  it("끝내 승인되지 않으면 120회 폴링 후 타임아웃으로 던진다", async () => {
    const stub = stubFetch([() => json(403, { error: "authorization_pending" })]);

    await expect(
      pollCodexDeviceAuthorization({
        deviceAuthId: "dev-1",
        userCode: "WXYZ-1234",
        pollIntervalMs: 5000,
        fetch: stub.fetch,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/timed out/i);

    expect(CODEX_DEVICE_MAX_POLLS).toBe(120);
    expect(stub.calls).toHaveLength(120);
  });

  it("갱신 400 응답의 error/error_description 을 메시지에 담는다", async () => {
    const stub = stubFetch([
      () => json(400, { error: "invalid_grant", error_description: "refresh token expired" }),
    ]);

    await expect(refreshCodexToken({ refreshToken: "dead", fetch: stub.fetch })).rejects.toThrow(
      /400.*invalid_grant.*refresh token expired/s,
    );
  });
});
