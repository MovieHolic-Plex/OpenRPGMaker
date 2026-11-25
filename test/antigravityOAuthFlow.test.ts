import { describe, expect, it, beforeAll } from "vitest";
import { AUTH_URL, CALLBACK_PATH, CALLBACK_PORT, CLOUD_CODE_ENDPOINT, DAILY_CLOUD_CODE_ENDPOINT, SCOPES, TOKEN_URL, buildAntigravityAuthorizationUrl, discoverAntigravityProject, exchangeAntigravityCode, refreshAntigravityToken } from "@/ai/oauth/antigravityOAuth";
import { configureOAuthClients } from "@/ai/oauth/clientConfig";
import { packRequestApiKey } from "@/ai/oauth/credentials";
import { CODEX_AUTHORIZE_URL, CODEX_BROWSER_CALLBACK_PATH, CODEX_BROWSER_CALLBACK_PORT, CODEX_BROWSER_REDIRECT_URI, CODEX_DEFAULT_ORIGINATOR, CODEX_SCOPES, beginCodexLogin, buildCodexAuthorizationUrl, generatePkcePair } from "@/ai/oauth/codexBrowserOAuth";
import { codexClientId, CODEX_DEVICE_VERIFICATION_URL } from "@/ai/oauth/codexDeviceOAuth";
import { isolateTimers } from "./mergedTeardown";

// Antigravity(Google) OAuth 을 이 저장소가 직접 수행한다는 계약 스펙.
//
// 여기서 실제 네트워크와 실제 시간은 절대 쓰지 않는다: fetch 와 sleep 을 모두 주입해
// loadCodeAssist -> onboardUser 폴링 재시도까지 즉시 끝낸다. 재시도 대기를 진짜로 기다리면
// (2000ms x 4) 스위트가 timeout 안에서 흔들린다.
describe("antigravityOAuthFlow", () => {
  isolateTimers();
  // 실제 값은 저장소에 없다(clientConfig.ts) — 와이어에 그대로 실리는지만 가짜 값으로 본다.
  const EXPECTED_CLIENT_ID = "test-antigravity-client.apps.googleusercontent.com";
  const EXPECTED_CLIENT_SECRET = "test-antigravity-secret";
  beforeAll(() => {
    configureOAuthClients({ antigravityClientId: EXPECTED_CLIENT_ID, antigravityClientSecret: EXPECTED_CLIENT_SECRET });
  });
  const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
  interface RecordedCall {
    url: string;
    init: RequestInit;
  }
  interface Stub {
    calls: RecordedCall[];
    fetch: (input: string, init: RequestInit) => Promise<Response>;
  }
  /** 응답 큐를 순서대로 돌려주는 fetch 스텁. 큐가 마르면 즉시 실패시켜 조용한 통과를 막는다. */
  function stubFetch(responses: Array<() => Response>): Stub {
    const calls: RecordedCall[] = [];
    let index = 0;
    return {
      calls,
      fetch: async (url, init) => {
        calls.push({ url, init });
        const next = responses[index++];
        if (!next) throw new Error(`unexpected fetch call #${index}: ${url}`);
        return next();
      },
    };
  }
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  function textResponse(text: string, status: number): Response {
    return new Response(text, { status });
  }
  function formBody(call: RecordedCall): URLSearchParams {
    const body = call.init.body;
    if (body instanceof URLSearchParams) return body;
    return new URLSearchParams(String(body));
  }
  function jsonBody(call: RecordedCall): Record<string, unknown> {
    return JSON.parse(String(call.init.body)) as Record<string, unknown>;
  }
  function collectSleeps(): { waits: number[]; sleep: (ms: number) => Promise<void> } {
    const waits: number[] = [];
    return {
      waits,
      sleep: async (ms: number) => {
        waits.push(ms);
      },
    };
  }
  const LOAD_OK_NO_PROJECT = {
    allowedTiers: [
      { id: "free-tier", isDefault: false },
      { id: "standard-tier", isDefault: true },
    ],
    currentTier: { id: "legacy-tier" },
  };
  describe("Antigravity 인가 URL", () => {
    it("클라이언트 id, 루프백 redirect_uri, 다섯 스코프를 모두 담는다", () => {
      const url = new URL(buildAntigravityAuthorizationUrl({ state: "state-abc", redirectUri: REDIRECT_URI }));

      expect(`${url.origin}${url.pathname}`).toBe(AUTH_URL);
      expect(url.searchParams.get("client_id")).toBe(EXPECTED_CLIENT_ID);
      expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:51121/oauth-callback");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("state")).toBe("state-abc");
      expect(url.searchParams.get("access_type")).toBe("offline");
      expect(url.searchParams.get("prompt")).toBe("consent");

      const scopes = (url.searchParams.get("scope") ?? "").split(" ");
      expect(scopes).toEqual([
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/cclog",
        "https://www.googleapis.com/auth/experimentsandconfigs",
      ]);
      expect(scopes).toEqual([...SCOPES]);
    });
  });
  describe("Antigravity 코드 교환", () => {
    it("client_id/secret 과 authorization_code 로 POST 하고 미래 만료의 자격을 돌려준다", async () => {
      const stub = stubFetch([
        () => jsonResponse({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 }),
      ]);

      const creds = await exchangeAntigravityCode({
        code: "auth-code-1",
        redirectUri: REDIRECT_URI,
        fetch: stub.fetch,
      });

      expect(stub.calls).toHaveLength(1);
      expect(stub.calls[0].url).toBe(TOKEN_URL);
      expect(stub.calls[0].init.method).toBe("POST");
      const body = formBody(stub.calls[0]);
      expect(body.get("client_id")).toBe(EXPECTED_CLIENT_ID);
      expect(body.get("client_secret")).toBe(EXPECTED_CLIENT_SECRET);
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("auth-code-1");
      expect(body.get("redirect_uri")).toBe(REDIRECT_URI);
      expect(body.get("code_verifier")).toBeNull();

      expect(creds.access).toBe("at-1");
      expect(creds.refresh).toBe("rt-1");
      expect(creds.expires).toBeGreaterThan(Date.now());
    });

    it("code_verifier 가 있으면 함께 보낸다", async () => {
      const stub = stubFetch([
        () => jsonResponse({ access_token: "at-2", refresh_token: "rt-2", expires_in: 3600 }),
      ]);

      await exchangeAntigravityCode({
        code: "auth-code-2",
        redirectUri: REDIRECT_URI,
        codeVerifier: "verifier-xyz",
        fetch: stub.fetch,
      });

      expect(formBody(stub.calls[0]).get("code_verifier")).toBe("verifier-xyz");
    });

    it("access_token 이 없으면 던진다", async () => {
      const stub = stubFetch([() => jsonResponse({ refresh_token: "rt-only" })]);

      await expect(
        exchangeAntigravityCode({ code: "c", redirectUri: REDIRECT_URI, fetch: stub.fetch }),
      ).rejects.toThrow(/access_token/i);
    });

    it("응답이 not ok 면 던진다", async () => {
      const stub = stubFetch([() => textResponse("invalid_grant", 400)]);

      await expect(
        exchangeAntigravityCode({ code: "c", redirectUri: REDIRECT_URI, fetch: stub.fetch }),
      ).rejects.toThrow(/invalid_grant/);
    });
  });
  describe("Antigravity 프로젝트 발견", () => {
    it("cloudaicompanionProject 가 문자열이면 그것을 쓴다", async () => {
      const stub = stubFetch([() => jsonResponse({ cloudaicompanionProject: "proj-string" })]);
      const timing = collectSleeps();

      const projectId = await discoverAntigravityProject({
        accessToken: "at-1",
        fetch: stub.fetch,
        sleep: timing.sleep,
      });

      expect(projectId).toBe("proj-string");
      expect(stub.calls).toHaveLength(1);
      expect(stub.calls[0].url).toBe(`${DAILY_CLOUD_CODE_ENDPOINT}/v1internal:loadCodeAssist`);
      expect(stub.calls[0].init.headers).toMatchObject({ Authorization: "Bearer at-1" });
      expect(jsonBody(stub.calls[0])).toEqual({ metadata: { ideType: "ANTIGRAVITY" } });
      expect(timing.waits).toEqual([]);
    });

    it("cloudaicompanionProject 가 { id } 객체여도 읽는다", async () => {
      const stub = stubFetch([() => jsonResponse({ cloudaicompanionProject: { id: "proj-object" } })]);

      const projectId = await discoverAntigravityProject({ accessToken: "at-1", fetch: stub.fetch });

      expect(projectId).toBe("proj-object");
    });

    it("daily 엔드포인트가 404 면 프로덕션 엔드포인트로 폴백한다", async () => {
      const stub = stubFetch([
        () => textResponse("not found", 404),
        () => jsonResponse({ projectId: "proj-prod" }),
      ]);

      const projectId = await discoverAntigravityProject({ accessToken: "at-1", fetch: stub.fetch });

      expect(projectId).toBe("proj-prod");
      expect(stub.calls.map((call) => call.url)).toEqual([
        `${DAILY_CLOUD_CODE_ENDPOINT}/v1internal:loadCodeAssist`,
        `${CLOUD_CODE_ENDPOINT}/v1internal:loadCodeAssist`,
      ]);
    });

    it("프로젝트가 없으면 기본 tier 로 온보딩하고, done 이 될 때까지 재시도한다", async () => {
      const stub = stubFetch([
        () => jsonResponse(LOAD_OK_NO_PROJECT),
        () => jsonResponse(LOAD_OK_NO_PROJECT),
        () => jsonResponse({ done: false }),
        () => jsonResponse({ done: true, response: { cloudaicompanionProject: { id: "proj-onboarded" } } }),
      ]);
      const timing = collectSleeps();
      const progress: string[] = [];

      const projectId = await discoverAntigravityProject({
        accessToken: "at-1",
        fetch: stub.fetch,
        sleep: timing.sleep,
        onProgress: (message) => progress.push(message),
      });

      expect(projectId).toBe("proj-onboarded");
      expect(stub.calls.map((call) => call.url)).toEqual([
        `${DAILY_CLOUD_CODE_ENDPOINT}/v1internal:loadCodeAssist`,
        `${CLOUD_CODE_ENDPOINT}/v1internal:loadCodeAssist`,
        `${DAILY_CLOUD_CODE_ENDPOINT}/v1internal:onboardUser`,
        `${DAILY_CLOUD_CODE_ENDPOINT}/v1internal:onboardUser`,
      ]);

      const onboard = jsonBody(stub.calls[2]);
      expect(onboard.tier_id).toBe("standard-tier");
      expect(onboard.metadata).toMatchObject({ ide_type: "ANTIGRAVITY", ide_name: "antigravity" });
      expect(typeof (onboard.metadata as { ide_version?: unknown }).ide_version).toBe("string");

      // 재시도는 있었고, 실제 시간 대기는 없었다.
      expect(timing.waits).toEqual([2000]);
      expect(progress.length).toBeGreaterThan(0);
    });

    it("onboardUser 가 프로젝트 id 를 끝내 안 주면 5회 후 던진다", async () => {
      const stub = stubFetch([
        () => jsonResponse(LOAD_OK_NO_PROJECT),
        () => jsonResponse(LOAD_OK_NO_PROJECT),
        () => jsonResponse({ done: false }),
        () => jsonResponse({ done: false }),
        () => jsonResponse({ done: false }),
        () => jsonResponse({ done: false }),
        () => jsonResponse({ done: true, response: {} }),
      ]);
      const timing = collectSleeps();

      await expect(
        discoverAntigravityProject({ accessToken: "at-1", fetch: stub.fetch, sleep: timing.sleep }),
      ).rejects.toThrow(/5 attempts/);

      expect(stub.calls).toHaveLength(7);
      expect(timing.waits).toEqual([2000, 2000, 2000, 2000]);
    });

    it("모든 loadCodeAssist 엔드포인트가 실패하면 마지막 status 를 담아 던진다", async () => {
      const stub = stubFetch([
        () => textResponse("nope", 404),
        () => textResponse("boom", 503),
      ]);

      await expect(
        discoverAntigravityProject({ accessToken: "at-1", fetch: stub.fetch }),
      ).rejects.toThrow(/503/);
    });
  });
  describe("Antigravity 토큰 갱신", () => {
    it("새 자격을 돌려주고 projectId 를 유지한다", async () => {
      const stub = stubFetch([
        () => jsonResponse({ access_token: "at-new", refresh_token: "rt-new", expires_in: 3600 }),
      ]);

      const creds = await refreshAntigravityToken({
        refreshToken: "rt-old",
        projectId: "proj-1",
        fetch: stub.fetch,
      });

      const body = formBody(stub.calls[0]);
      expect(stub.calls[0].url).toBe(TOKEN_URL);
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("rt-old");
      expect(body.get("client_id")).toBe(EXPECTED_CLIENT_ID);
      expect(body.get("client_secret")).toBe(EXPECTED_CLIENT_SECRET);

      expect(creds.access).toBe("at-new");
      expect(creds.refresh).toBe("rt-new");
      expect(creds.projectId).toBe("proj-1");
      expect(creds.expires).toBeGreaterThan(Date.now());
      expect(creds.expires).toBeLessThanOrEqual(Date.now() + 3600 * 1000 - 300_000);
    });

    it("응답이 refresh_token 을 생략하면 기존 것을 유지한다", async () => {
      const stub = stubFetch([() => jsonResponse({ access_token: "at-new2", expires_in: 3600 })]);

      const creds = await refreshAntigravityToken({
        refreshToken: "rt-keep",
        projectId: "proj-2",
        fetch: stub.fetch,
      });

      expect(creds.refresh).toBe("rt-keep");
      expect(creds.projectId).toBe("proj-2");
    });

    it("not ok 응답이면 던진다", async () => {
      const stub = stubFetch([() => textResponse("invalid_grant", 400)]);

      await expect(
        refreshAntigravityToken({ refreshToken: "rt-dead", projectId: "proj-3", fetch: stub.fetch }),
      ).rejects.toThrow(/invalid_grant/);
    });
  });
  describe("발견 직후 자격 패킹", () => {
    it("packRequestApiKey 가 token + projectId + refreshToken + expiresAt 을 담은 JSON 을 만든다", async () => {
      const exchangeStub = stubFetch([
        () => jsonResponse({ access_token: "at-pack", refresh_token: "rt-pack", expires_in: 3600 }),
      ]);
      const discoverStub = stubFetch([() => jsonResponse({ cloudaicompanionProject: "proj-pack" })]);

      const creds = await exchangeAntigravityCode({
        code: "code-pack",
        redirectUri: REDIRECT_URI,
        fetch: exchangeStub.fetch,
      });
      const projectId = await discoverAntigravityProject({
        accessToken: creds.access,
        fetch: discoverStub.fetch,
      });

      const packed = JSON.parse(packRequestApiKey("google-antigravity", { ...creds, projectId })) as Record<
        string,
        unknown
      >;

      expect(packed.token).toBe("at-pack");
      expect(packed.projectId).toBe("proj-pack");
      expect(packed.refreshToken).toBe("rt-pack");
      expect(packed.expiresAt).toBe(creds.expires);
    });

    it("refresh_token 이 없는 교환 응답은 거절한다", async () => {
      // 빈 refresh 를 저장하면 한 시간 뒤 갱신이 막히는데 상태는 연결됨으로 남는다.
      const stub = stubFetch([
        () => jsonResponse({ access_token: "access-only", expires_in: 3600 }),
      ]);

      await expect(
        exchangeAntigravityCode({ code: "code-1", redirectUri: REDIRECT_URI, fetch: stub.fetch }),
      ).rejects.toThrow(/refresh_token/);
    });
  });
});

// Codex 브라우저(루프백 PKCE) 로그인 스펙 — omp 의 loginOpenAICodex 와 같은 계약을 요구한다.
//
// 왜 이 스위트가 필요한가: 이 저장소는 Codex 로그인을 디바이스 코드 하나로만 포팅했었다.
// 그래서 사용자는 언제나 코드를 손으로 입력해야 했고, 1455 가 비어 있을 때 쓸 수 있는
// 원클릭 경로가 없었다. omp 는 브라우저 흐름을 주력으로 쓰고 디바이스는 대체로 둔다.
//
// 시간에 기대지 않는다: 콜백 서버와 디바이스 시작을 주입해 즉시 결정만 검증한다.
describe("codexBrowserOAuthFlow", () => {
  isolateTimers();
  beforeAll(() => {
    // 실제 Codex client id 는 저장소에 없다(clientConfig.ts) — 가짜 값으로 와이어만 본다.
    configureOAuthClients({ codexClientId: "test-codex-client" });
  });
  function base64UrlOfBytes(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  describe("Codex 인가 URL", () => {
    it("omp 가 보내는 파라미터 집합을 한 개도 빠뜨리지 않는다", () => {
      const url = new URL(
        buildCodexAuthorizationUrl({
          state: "state-1",
          redirectUri: CODEX_BROWSER_REDIRECT_URI,
          codeChallenge: "challenge-1",
        }),
      );

      expect(`${url.origin}${url.pathname}`).toBe(CODEX_AUTHORIZE_URL);
      const params = url.searchParams;
      expect(params.get("response_type")).toBe("code");
      expect(params.get("client_id")).toBe(codexClientId());
      expect(params.get("redirect_uri")).toBe(CODEX_BROWSER_REDIRECT_URI);
      expect(params.get("scope")).toBe(CODEX_SCOPES.join(" "));
      expect(params.get("code_challenge")).toBe("challenge-1");
      expect(params.get("code_challenge_method")).toBe("S256");
      expect(params.get("state")).toBe("state-1");
      // 이 두 개가 빠지면 로그인은 되지만 조직 선택이 없는 토큰이 와서 accountId 추출이 깨진다.
      expect(params.get("id_token_add_organizations")).toBe("true");
      expect(params.get("codex_cli_simplified_flow")).toBe("true");
      expect(params.get("originator")).toBe(CODEX_DEFAULT_ORIGINATOR);
    });

    it("고정 redirect_uri 는 OpenAI 허용목록 값과 한 글자도 다르지 않다", () => {
      // omp 주석: OpenAI 는 http://localhost:1455/auth/callback 만 허용한다. 포트가 점유돼
      // 임의 포트로 옮기면 교환이 403 이 된다 — 그래서 이 값은 상수여야 한다.
      expect(CODEX_BROWSER_CALLBACK_PORT).toBe(1455);
      expect(CODEX_BROWSER_CALLBACK_PATH).toBe("/auth/callback");
      expect(CODEX_BROWSER_REDIRECT_URI).toBe("http://localhost:1455/auth/callback");
    });

    it("originator 를 넘기면 그 값이 나간다", () => {
      const url = new URL(
        buildCodexAuthorizationUrl({
          state: "s",
          redirectUri: CODEX_BROWSER_REDIRECT_URI,
          codeChallenge: "c",
          originator: "custom_originator",
        }),
      );
      expect(url.searchParams.get("originator")).toBe("custom_originator");
    });
  });
  describe("PKCE", () => {
    it("challenge 는 verifier 의 SHA-256 을 base64url 로 담는다", async () => {
      const pair = await generatePkcePair();
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pair.verifier));
      expect(pair.challenge).toBe(base64UrlOfBytes(new Uint8Array(digest)));
    });

    it("verifier·challenge 에 URL 안전하지 않은 문자가 없다", async () => {
      const pair = await generatePkcePair();
      // +, /, = 가 남으면 인가 요청에서 퍼센트 인코딩되어 서버가 계산한 challenge 와 어긋난다.
      expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    });

    it("매번 다른 verifier 를 만든다", async () => {
      const [a, b] = await Promise.all([generatePkcePair(), generatePkcePair()]);
      expect(a.verifier).not.toBe(b.verifier);
    });
  });
  describe("로그인 경로 선택", () => {
    const deviceStart = {
      deviceAuthId: "dev-1",
      userCode: "WXYZ-1234",
      verificationUrl: CODEX_DEVICE_VERIFICATION_URL,
      pollIntervalMs: 5000,
    };

    it("1455 를 잡으면 브라우저 흐름으로 간다", async () => {
      const started = await beginCodexLogin({
        openCallbackServer: async () => ({
          port: CODEX_BROWSER_CALLBACK_PORT,
          redirectUri: CODEX_BROWSER_REDIRECT_URI,
          waitForCode: Promise.resolve({ code: "authcode", state: "state" }),
          close: () => {},
        }),
        startDeviceAuthorization: async () => {
          throw new Error("device 흐름을 타면 안 된다");
        },
      });

      expect(started.mode).toBe("browser");
      expect(started.verificationUrl.startsWith(CODEX_AUTHORIZE_URL)).toBe(true);
      expect(started.userCode).toBe("");
      expect(new URL(started.verificationUrl).searchParams.get("redirect_uri")).toBe(CODEX_BROWSER_REDIRECT_URI);
    });

    it("1455 가 점유되면 디바이스 흐름으로 내려가고 이유를 말한다", async () => {
      // 실측: 이 개발 머신은 docker-proxy 가 1455 를 잡고 있다. 이때 임의 포트로 옮기면
      // 교환이 403 이므로 유일하게 옳은 대체는 디바이스 흐름이다.
      const busy = Object.assign(new Error("listen EADDRINUSE 127.0.0.1:1455"), { code: "EADDRINUSE" });
      let deviceStarted = false;
      const started = await beginCodexLogin({
        openCallbackServer: async () => {
          throw busy;
        },
        startDeviceAuthorization: async () => {
          deviceStarted = true;
          return deviceStart;
        },
      });

      expect(deviceStarted).toBe(true);
      expect(started.mode).toBe("device");
      expect(started.verificationUrl).toBe(CODEX_DEVICE_VERIFICATION_URL);
      expect(started.userCode).toBe("WXYZ-1234");
      expect(started.instructions).toContain("1455");
    });

    it("다른 기기에서 접속하면 콜백 서버를 열지 않고 바로 코드 입력 방식으로 간다", async () => {
      // 원격 브라우저는 로그인 뒤 자기 기기의 localhost:1455 로 돌아가 「연결할 수 없음」이 된다.
      // 코드 입력 방식이면 주소를 복사해 붙여 넣는 단계가 없다.
      const started = await beginCodexLogin({
        remote: true,
        openCallbackServer: async () => {
          throw new Error("원격이면 루프백 콜백 서버를 열면 안 된다");
        },
        startDeviceAuthorization: async () => deviceStart,
      });

      expect(started.mode).toBe("device");
      expect(started.verificationUrl).toBe(CODEX_DEVICE_VERIFICATION_URL);
      expect(started.userCode).toBe("WXYZ-1234");
      expect(started.instructions).toContain("다른 기기");
    });

    it("포트 점유가 아닌 실패는 조용히 디바이스로 숨기지 않는다", async () => {
      // 권한 오류·잘못된 호스트 같은 실패를 디바이스 흐름으로 가려 버리면 원인이 사라진다.
      await expect(
        beginCodexLogin({
          openCallbackServer: async () => {
            throw new Error("EACCES: permission denied");
          },
          startDeviceAuthorization: async () => deviceStart,
        }),
      ).rejects.toThrow(/EACCES/);
    });
  });
});
