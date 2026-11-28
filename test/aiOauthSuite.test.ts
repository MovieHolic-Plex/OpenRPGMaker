import { describe, expect, it, beforeAll, afterEach, beforeEach } from "vitest";
import { AUTH_URL, CALLBACK_PATH, CALLBACK_PORT, CLOUD_CODE_ENDPOINT, DAILY_CLOUD_CODE_ENDPOINT, SCOPES, TOKEN_URL, buildAntigravityAuthorizationUrl, discoverAntigravityProject, exchangeAntigravityCode, refreshAntigravityToken } from "@/ai/oauth/antigravityOAuth";
import { configureOAuthClients } from "@/ai/oauth/clientConfig";
import { packRequestApiKey, ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID, decodeJwtPayload, jwtExpiryMs, type PortedOAuthCredentials } from "@/ai/oauth/credentials";
import { CODEX_AUTHORIZE_URL, CODEX_BROWSER_CALLBACK_PATH, CODEX_BROWSER_CALLBACK_PORT, CODEX_BROWSER_REDIRECT_URI, CODEX_DEFAULT_ORIGINATOR, CODEX_SCOPES, beginCodexLogin, buildCodexAuthorizationUrl, generatePkcePair } from "@/ai/oauth/codexBrowserOAuth";
import { codexClientId, CODEX_DEVICE_VERIFICATION_URL } from "@/ai/oauth/codexDeviceOAuth";
import { isolateTimers } from "./mergedTeardown";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig, saveAiConfig, aiTransport, usesOhMyPiCompanion, type AiConfig, clampMaxTokens, DEFAULT_MAX_TOKENS, GEMINI_MAX_OUTPUT_TOKENS, providerCapability } from "@/ai/llmClient";
import { DEFAULT_OH_MY_PI_PROVIDER, OH_MY_PI_PROVIDERS, parseOhMyPiProvider, OH_MY_PI_AUTH_KIND_LABEL, ohMyPiAuthKind, ohMyPiProvidersByAuthKind, getOhMyPiProvider, ohMyPiOAuthProviders, RECOMMENDED_OH_MY_PI_PROVIDER } from "@/ai/ohMyPiProviders";
import { configForProviderSelection } from "@/ai/providerSelection";
import { configForConnectionKind, defaultProviderForKind, editorConnectionKind, editorHasProviderChoice, providersForKind } from "@/ai/aiConnectionKind";

describe("antigravityOAuthFlow", () => {
  isolateTimers();
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
});

describe("credentials", () => {
  isolateTimers();
  // 에디터가 고를 수 있는 제공자는 Antigravity 와 Codex 둘이다 — 셋째는 없다.
  //
  // 이 파일은 원래 "Antigravity 하나로 강제" 를 고정했다. 감독 요구가 바뀌어 Codex 도 1급
  // 선택지가 됐으므로 계약을 뒤집되, 그때 잡았던 회귀는 그대로 지킨다:
  //  1) 레지스트리에 없는(사라진·오타난) providerId 는 기본 제공자로 스냅한다 — 옛 zai/xiaomi
  //     같은 id 가 살아남아 동반 서비스로 실려 나가지 못하게.
  //  2) providerId 가 없는 옛 blob 도 기본 제공자(Antigravity)가 된다 — 예전에는 openai-codex 로
  //     남아 이미 쓰던 사용자가 새 기본으로 오지 않았다.
  //  3) 남의 네임스페이스 모델 ID 는 선택된 제공자의 기본 모델로 교정한다.
  // 새로 고정하는 것: **저장된 openai-codex 선택은 load/save 왕복을 살아남는다.**
  // authMode 는 이미 "chatgpt" 로 고정돼 있으므로(llmClient.ts) 이 스펙은 제공자·모델 축만 잡는다.
  describe("aiAntigravityOnly", () => {
    isolateTimers();
    let storage: Map<string, string>;
    beforeEach(() => {
      storage = new Map();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => void storage.set(key, String(value)),
          removeItem: (key: string) => void storage.delete(key),
          clear: () => storage.clear(),
        },
      });
    });
    afterEach(() => {
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    function storedProviderId(): string | undefined {
      const blob = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}") as { providerId?: string };
      return blob.providerId;
    }
    describe("제공자는 Antigravity·Codex 둘뿐이다", () => {
      it("옛 저장값은 Antigravity 로 읽고, 새 설정은 ChatGPT(GPT-6.2 Sol high)를 권한다", () => {
        expect(DEFAULT_OH_MY_PI_PROVIDER).toBe(ANTIGRAVITY_PROVIDER_ID);
        // 오너 결정 2026-11-28: 공장 기본은 ChatGPT GPT-6.2 Sol high 다. 옛 저장값을 읽는 기본 제공자는 그대로 Antigravity 다.
        expect(defaultAiConfig().providerId).toBe(CODEX_PROVIDER_ID);
      });

      it("처음 세 제공자는 순서가 고정이고, 나머지는 뒤에 덧붙기만 한다 — 순서가 바뀌어도 기존 사용자는 넘어가지 않는다", () => {
        // 2026-11-02: 예전에는 「둘뿐」 이었다. 이제 OMP 가 로그인해 둔 제공자를 그대로 쓰므로 목록이 늘었다.
        // 2026-11-16: Claude → 2026-11-19: ChatGPT → 2026-11-23: Claude → 2026-11-28: 다시 ChatGPT 가 맨 앞이다(오너 결정 — 조수는 GPT-6.2 Sol high).
        // 첫 항목은 권장값일 뿐이다 — 옛 저장값·모르는 id 의 제공자는 순서가 아니라 DEFAULT_OH_MY_PI_PROVIDER(Antigravity)가 정한다.
        const ids = OH_MY_PI_PROVIDERS.map((provider) => provider.id);
        expect(ids.slice(0, 3)).toEqual([
          CODEX_PROVIDER_ID,
          "anthropic",
          ANTIGRAVITY_PROVIDER_ID,
        ]);
        expect(ids.length).toBeGreaterThan(3);
        expect(parseOhMyPiProvider(undefined)).toBe(ANTIGRAVITY_PROVIDER_ID);
        expect(parseOhMyPiProvider("no-such-provider")).toBe(ANTIGRAVITY_PROVIDER_ID);
        // 중복이 없고 id·모델이 비지 않는다(비면 고르는 순간 호출이 400 이 된다).
        expect(new Set(ids).size).toBe(ids.length);
        for (const provider of OH_MY_PI_PROVIDERS) {
          expect(provider.defaultModel, provider.id).not.toBe("");
        }
      });

      it("Codex 의 옛 공장 기본 gpt-5.6-sol 은 gpt-6.2-sol 로 올리고, 모델 없는 Codex blob 에 Gemini 를 채우지 않는다", () => {
        storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: CODEX_PROVIDER_ID, model: "gpt-5.6-sol" }));
        expect(loadAiConfig().model).toBe("gpt-6.2-sol");
        storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: CODEX_PROVIDER_ID }));
        expect(loadAiConfig().model).toBe("gpt-6.2-sol");
        expect(loadAiConfig().liteModel).toBe("gpt-6.2-sol");
      });

      it("저장된 openai-codex 는 load/save 왕복을 살아남는다", () => {
        // 이전 구현은 여기서 Antigravity 로 되돌렸다 — 사용자가 고른 Codex 를 조용히 뒤집는 동작이다.
        storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: CODEX_PROVIDER_ID, model: "gpt-6-sol" }));

        const loaded = loadAiConfig();
        expect(loaded.providerId).toBe(CODEX_PROVIDER_ID);
        expect(loaded.model).toBe("gpt-6-sol");

        saveAiConfig(loaded);
        expect(storedProviderId()).toBe(CODEX_PROVIDER_ID);
        expect(loadAiConfig().providerId).toBe(CODEX_PROVIDER_ID);
      });

      it("Codex 를 골라 저장하면 그대로 적힌다", () => {
        saveAiConfig({ ...configForProviderSelection(defaultAiConfig(), CODEX_PROVIDER_ID), model: "gpt-6-sol", liteModel: "gpt-6-luna" });

        expect(storedProviderId()).toBe(CODEX_PROVIDER_ID);
        const loaded = loadAiConfig();
        expect(loaded.providerId).toBe(CODEX_PROVIDER_ID);
        expect(loaded.model).toBe("gpt-6-sol");
      });

      it("사라진 제공자 id 는 기본 제공자로 끌어온다", () => {
        // xiaomi·anthropic 은 abaa03e78f(2026-11-02) 로 레지스트리에 들어왔으므로 더 이상 «사라진» id 가 아니다.
        for (const stale of ["zai", "zenmux", "deepseek", "openai"]) {
          storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: stale }));

          expect(loadAiConfig().providerId, stale).toBe(ANTIGRAVITY_PROVIDER_ID);
        }
      });

      it("providerId 가 없는 옛 blob 도 Antigravity 다 (예전엔 openai-codex 로 남았다)", () => {
        storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gpt-5.6-sol" }));

        expect(loadAiConfig().providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
      });

      it("알 수 없는 제공자 문자열도 Antigravity 다", () => {
        storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "made-up-provider" }));

        expect(loadAiConfig().providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
      });

      it("사라진 제공자로 저장을 시도해도 디스크에는 두 id 중 하나만 남는다", () => {
        saveAiConfig({ ...defaultAiConfig(), providerId: "zai" });

        expect(storedProviderId()).toBe(ANTIGRAVITY_PROVIDER_ID);
        expect(loadAiConfig().providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
      });
    });
    describe("명시적 모델 선택은 자동으로 대체하지 않는다", () => {
      it("Antigravity에서도 명시적 모델 ID를 유지하여 전송 시 오류를 드러낸다", () => {
        for (const stale of ["z-ai/glm-5.2-ultrafast", "cpen/gpt-5-6-luna", "gpt-5.6-sol", "claude-opus-4-8", "mimo-v2.5"]) {
          storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
            providerId: ANTIGRAVITY_PROVIDER_ID,
            model: stale,
            liteModel: stale,
          }));

          const loaded = loadAiConfig();
          expect(loaded.model, stale).toBe(stale);
          expect(loaded.liteModel, stale).toBe(stale);
        }
      });

      it("Codex에서도 명시적 모델 ID를 유지한다", () => {
        // Preserve both selections; the exact runtime resolver rejects unsupported combinations.
        for (const stale of ["gemini-3.7-flash", "z-ai/glm-5.2-ultrafast", "cpen/gpt-5-6-luna", "gpt-5.1-codex"]) {
          storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
            providerId: CODEX_PROVIDER_ID,
            model: stale,
            liteModel: stale,
          }));

          const loaded = loadAiConfig();
          expect(loaded.providerId, stale).toBe(CODEX_PROVIDER_ID);
          expect(loaded.model, stale).toBe(stale);
          expect(loaded.liteModel, stale).toBe(stale);
        }
      });

      // 2026-08-26 실측: 기본값을 한동안 `gemini-3.7-flash-high` 로 강제했는데 Cloud Code Assist 가
      // 그 ID 를 404 `Requested entity was not found` 로 거부한다 — Antigravity 에서 `-high` 는
      // 독립 모델이 아니라 `thinking.effortRouting` 의 대상 이름이다. 그 사이에 에디터를 켠
      // 잘못된 ID는 그대로 드러내고 모델 설정에서 수정하게 한다.
      it("잘못된 사고 강도 변형도 몰래 대체하지 않는다", () => {
        for (const broken of ["gemini-3.7-flash-high", "gemini-3.7-flash-medium", "gemini-3.7-flash-low"]) {
          storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: broken, liteModel: broken }));

          const loaded = loadAiConfig();
          expect(loaded.model, broken).toBe(broken);
          expect(loaded.liteModel, broken).toBe(broken);
        }
      });

      it("gemini 변형은 직접 입력한 값을 존중한다(카탈로그를 화이트리스트로 쓰지 않는다)", () => {
        storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gemini-9-experimental" }));

        expect(loadAiConfig().model).toBe("gemini-9-experimental");
      });
    });
  });
  // 전송 축(동반 서비스 vs 주입 게이트웨이)과 자격 증명 축(oauth/apiKey/local)의 분리를 고정한다.
  //
  // 배경: `AiConfig.authMode: "chatgpt" | "apiKey"` 하나가 두 축을 겸해서, ① baseUrl 문자열이
  // 선언된 인증 모드를 덮어쓸 수 있었고 ② 제공자의 authKind 가 UI 에 전혀 반영되지 않았다.
  // 이 파일은 두 축이 각자 하나의 진실 원천을 갖는지, 그리고 **두 제공자가 모두 선택 가능한지** 본다.
  describe("aiConnectionKind", () => {
    isolateTimers();
    const GATEWAY: AiConfig = {
      authMode: "apiKey",
      baseUrl: "https://gateway.invalid/v1",
      model: "some/model",
      apiKey: "sk-injected",
      maxToolCalls: 8,
      maxTokens: 1024,
    };
    describe("전송 축 — authMode 만이 정한다", () => {
      it("authMode:chatgpt 는 동반 서비스 전송이다", () => {
        expect(aiTransport({ ...GATEWAY, authMode: "chatgpt" })).toBe("companion");
        expect(usesOhMyPiCompanion({ ...GATEWAY, authMode: "chatgpt" })).toBe(true);
      });

      it("authMode:apiKey 는 게이트웨이 전송이다", () => {
        expect(aiTransport(GATEWAY)).toBe("gateway");
        expect(usesOhMyPiCompanion(GATEWAY)).toBe(false);
      });

      it("baseUrl 문자열이 전송 축을 덮어쓰지 못한다", () => {
        // 옛 동작: isCompanionBaseUrl(baseUrl) 이 true 면 authMode:"apiKey" 인데도 동반 서비스로
        // 라우팅했다. 문자열이 선언된 모드를 이기는 구조라, 주입 설정의 의도를 조용히 바꿨다.
        for (const baseUrl of ["/v1", "http://127.0.0.1:17832/v1", "http://localhost:17832/v1"]) {
          expect(aiTransport({ ...GATEWAY, baseUrl })).toBe("gateway");
          expect(usesOhMyPiCompanion({ ...GATEWAY, baseUrl })).toBe(false);
        }
      });
    });
    describe("자격 증명 축 — providerId 만이 정한다", () => {
      it("두 제공자가 모두 oauth 로 분류된다", () => {
        for (const provider of OH_MY_PI_PROVIDERS) {
          expect(ohMyPiAuthKind(provider.id), provider.id).toBe(provider.authKind);
          expect(provider.authKind, provider.id).toBe("oauth");
        }
        expect(ohMyPiProvidersByAuthKind("oauth")).toHaveLength(OH_MY_PI_PROVIDERS.length);
        // apiKey·local 제공자는 없다 — 그래서 "API 키" 종류에 내놓을 제공자가 없다.
        expect(ohMyPiProvidersByAuthKind("apiKey")).toHaveLength(0);
        expect(ohMyPiProvidersByAuthKind("local")).toHaveLength(0);
      });

      it("모르는 id 는 기본 제공자의 종류로 떨어진다 (undefined 를 만들지 않는다)", () => {
        expect(ohMyPiAuthKind("no-such-provider")).toBe("oauth");
        expect(ohMyPiAuthKind(undefined)).toBe("oauth");
      });

      it("종류 라벨은 원시 enum 값이 아니다 — 영어 enum 을 UI 에 흘리지 않는다", () => {
        // "API 키" 처럼 정착한 외래어는 정상이다. 막으려는 것은 `authKind` 값을 그대로 붙여
        // "OpenAI Codex · oauth" 로 보이던 것 — 라벨이 enum 키와 같아지는 상태다.
        for (const [kind, label] of Object.entries(OH_MY_PI_AUTH_KIND_LABEL)) {
          expect(label).not.toBe(kind);
          expect(label.trim()).not.toHaveLength(0);
          expect(label).toMatch(/[가-힣]/u);
        }
      });
    });
    describe("에디터의 제공자 선택 — 두 구독 로그인", () => {
      it("두 제공자 모두 구독 로그인 종류로 읽힌다", () => {
        expect(editorConnectionKind({ ...GATEWAY, providerId: CODEX_PROVIDER_ID })).toBe("oauth");
        expect(editorConnectionKind({ ...GATEWAY, providerId: ANTIGRAVITY_PROVIDER_ID })).toBe("oauth");
        // 사라진 제공자 id 는 기본 제공자(oauth)로 스냅되므로 여기서도 oauth 다.
        expect(editorConnectionKind({ ...GATEWAY, providerId: "zai" })).toBe("oauth");
      });

      it("종류와 무관하게 같은 제공자 목록(앞의 셋은 ChatGPT·Claude·Google)을 노출하고, 사용자에게 선택권이 있다", () => {
        // 이전 계약은 "Antigravity 하나만", 그다음은 "둘뿐" 이었다. abaa03e78f(2026-11-02) 로 17종이 됐다.
        // 2026-11-16 Claude → 2026-11-19 ChatGPT → 2026-11-23 Claude → 2026-11-28(오너 결정: 조수는 GPT-6.2 Sol high)부터 ChatGPT 가 맨 앞이다. 앞의 셋 순서가 고정이다.
        for (const kind of ["oauth", "apiKey"] as const) {
          expect(providersForKind(kind).map((provider) => provider.id).slice(0, 3)).toEqual([
            CODEX_PROVIDER_ID,
            "anthropic",
            ANTIGRAVITY_PROVIDER_ID,
          ]);
          expect(providersForKind(kind).length).toBeGreaterThan(3);
        }
        expect(providersForKind("oauth")).toEqual(providersForKind("apiKey"));
        expect(editorHasProviderChoice()).toBe(true);
      });

      it("목록의 첫 항목은 기본 제공자(ChatGPT)이고 두 종류의 기본값이 같다", () => {
        expect(providersForKind("oauth")[0]?.id).toBe(CODEX_PROVIDER_ID);
        expect(defaultProviderForKind("oauth")).toBe(CODEX_PROVIDER_ID);
        // "API 키" 쪽에 내놓을 제공자가 없으므로 가짜 apiKey 제공자를 만들지 않고 같은 기본값을 쓴다.
        expect(defaultProviderForKind("apiKey")).toBe(CODEX_PROVIDER_ID);
        expect(ohMyPiAuthKind(defaultProviderForKind("apiKey"))).toBe("oauth");
      });

      it("configForConnectionKind 는 브라우저에 비밀을 남기지 않는다", () => {
        for (const kind of ["oauth", "apiKey"] as const) {
          const next = configForConnectionKind(GATEWAY, kind);
          expect(next.authMode).toBe("chatgpt"); // 에디터는 항상 동반 서비스 전송이다
          expect(next.baseUrl).toBe("");
          expect(next.apiKey).toBe("");
          // 두 제공자가 모두 oauth 이므로 파생 종류는 항상 oauth 다.
          expect(editorConnectionKind(next)).toBe("oauth");
        }
      });

      it("제공자를 Codex 로 바꿀 수 있고 되돌릴 수도 있다", () => {
        const base = defaultAiConfig();
        const codex = configForConnectionKind(base, "oauth", CODEX_PROVIDER_ID);
        expect(codex.providerId).toBe(CODEX_PROVIDER_ID);

        const back = configForConnectionKind(codex, "oauth", ANTIGRAVITY_PROVIDER_ID);
        expect(back.providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
      });

      it("제공자를 지정하지 않으면 기존 선택을 유지한다", () => {
        const codex = { ...defaultAiConfig(), providerId: CODEX_PROVIDER_ID };
        expect(configForConnectionKind(codex, "oauth").providerId).toBe(CODEX_PROVIDER_ID);
        expect(configForConnectionKind(codex, "apiKey").providerId).toBe(CODEX_PROVIDER_ID);
      });

      it("레지스트리에 없는 제공자를 주면 기본 제공자로 스냅한다", () => {
        const snapped = configForConnectionKind(defaultAiConfig(), "apiKey", "zai");
        expect(snapped.providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
      });

      it("기본 설정은 구독 로그인 종류다", () => {
        expect(editorConnectionKind(defaultAiConfig())).toBe("oauth");
      });
    });
  });
  // 공급자 max_tokens 상한 계약 — 실측 근거로 고정한다.
  //
  // 왜(2026-09-16 실측): 기본 설정의 maxTokens(200000)가 그대로 나가면 Cloud Code Assist 가
  // `400 INVALID_ARGUMENT — Request contains an invalid argument.` 로 거부해 DB AI 턴이
  // 레코드 준비 단계에서 매번 죽었다("프로젝트 기록 준비 실패: 요청 실패(400)").
  // 같은 요청에서 max_tokens 만 바꾼 실측: 65536 → 200, 100000 → 400.
  // 요청 덤프: /home/main/.omp/logs/http-400-requests/*.json 의 generationConfig.maxOutputTokens.
  describe("aiMaxTokensCeiling", () => {
    isolateTimers();
    function capabilityFor(providerId: string) {
      return providerCapability({ ...defaultAiConfig(), providerId });
    }
    describe("공급자 max_tokens 상한", () => {
      it("Antigravity 경로는 실측 상한을 선언한다", () => {
        expect(capabilityFor(ANTIGRAVITY_PROVIDER_ID).maxTokensCeiling).toBe(GEMINI_MAX_OUTPUT_TOKENS);
        // 상한을 손으로 낮추거나 올리면 이 실측값과 어긋난다 — 그때는 다시 재고 근거를 남겨라.
        expect(GEMINI_MAX_OUTPUT_TOKENS).toBe(65_536);
      });

      it("기본 예산(200000)이 그대로 나가지 않는다 — 400 의 직접 원인이었다", () => {
        expect(DEFAULT_MAX_TOKENS).toBeGreaterThan(GEMINI_MAX_OUTPUT_TOKENS);
        expect(clampMaxTokens(capabilityFor(ANTIGRAVITY_PROVIDER_ID), DEFAULT_MAX_TOKENS)).toBe(
          GEMINI_MAX_OUTPUT_TOKENS,
        );
      });

      it("상한 이하는 건드리지 않는다(경계 포함)", () => {
        const capability = capabilityFor(ANTIGRAVITY_PROVIDER_ID);
        expect(clampMaxTokens(capability, GEMINI_MAX_OUTPUT_TOKENS)).toBe(GEMINI_MAX_OUTPUT_TOKENS);
        expect(clampMaxTokens(capability, 8192)).toBe(8192);
      });

      it("상한이 선언되지 않은 공급자는 조용히 좁히지 않는다", () => {
        const capability = capabilityFor(CODEX_PROVIDER_ID);
        expect(capability.maxTokensCeiling).toBeUndefined();
        expect(clampMaxTokens(capability, DEFAULT_MAX_TOKENS)).toBe(DEFAULT_MAX_TOKENS);
      });
    });
  });
  // 우리 저장소가 직접 들고 있는 OAuth 자격 표현 계약.
  //
  // 왜 이 파일이 먼저인가: 지금까지 요청 시점 자격(apiKey)은 `@oh-my-pi/pi-ai` 의
  // `getOAuthApiKey` 가 만들어 줬다(registry/oauth/index.ts:113). 그 함수는
  //  - google-antigravity 처럼 요청 시점 메타데이터가 필요한 제공자에게 JSON 문자열을,
  //  - 그 밖에는 access 토큰 문자열을 준다.
  // 그리고 **만료된 자격이면 던진다** — 만료 토큰을 상류 토큰 엔드포인트로 POST 하지 않기 위한
  // 안전핀이다. 우리 포팅본이 그 계약을 그대로 지키는지 이 스펙이 고정한다.
  //
  // 전송(pi-ai `complete`)은 이 문자열을 `parseGeminiCliCredentials`
  // (providers/google-gemini-cli.ts:373) 로 되읽으므로 필드 이름은 협상 대상이 아니다:
  // `token` + `projectId` 가 없으면 전송이 ValidationError 로 죽는다.
  describe("oauthCredentials", () => {
    isolateTimers();
    const HOUR = 3_600_000;
    function creds(overrides: Partial<PortedOAuthCredentials> = {}): PortedOAuthCredentials {
      return {
        access: "access-token-value",
        refresh: "refresh-token-value",
        expires: Date.now() + HOUR,
        ...overrides,
      };
    }
    /** 서명 없는 테스트용 JWT — 페이로드만 읽는 디코더를 검증한다. */
    function fakeJwt(payload: Record<string, unknown>): string {
      const encode = (value: object) =>
        Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
      return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
    }
    describe("packRequestApiKey", () => {
      it("Codex 는 access 토큰 문자열 그대로다", () => {
        expect(packRequestApiKey(CODEX_PROVIDER_ID, creds({ access: "codex-access" }))).toBe("codex-access");
      });

      it("Antigravity 는 전송이 되읽는 JSON 자격을 만든다 (token + projectId 필수)", () => {
        const row = creds({
          access: "ag-access",
          refresh: "ag-refresh",
          projectId: "proj-1234",
          email: "user@example.test",
          accountId: "acct-9",
          apiEndpoint: "https://daily-cloudcode-pa.googleapis.com",
        });

        const packed = JSON.parse(packRequestApiKey(ANTIGRAVITY_PROVIDER_ID, row)) as Record<string, unknown>;

        expect(packed.token).toBe("ag-access");
        expect(packed.projectId).toBe("proj-1234");
        expect(packed.refreshToken).toBe("ag-refresh");
        expect(packed.expiresAt).toBe(row.expires);
        expect(packed.email).toBe("user@example.test");
        expect(packed.accountId).toBe("acct-9");
        expect(packed.apiEndpoint).toBe("https://daily-cloudcode-pa.googleapis.com");
      });

      it("만료된 자격은 던진다 — 만료 토큰을 상류로 보내지 않는다", () => {
        expect(() => packRequestApiKey(CODEX_PROVIDER_ID, creds({ expires: Date.now() - 1 })))
          .toThrow(/expired/i);
        expect(() => packRequestApiKey(ANTIGRAVITY_PROVIDER_ID, creds({ expires: Date.now() - 1, projectId: "p" })))
          .toThrow(/expired/i);
      });

      it("projectId 없는 Antigravity 자격은 던진다 — 전송이 ValidationError 로 죽는 자리를 앞당긴다", () => {
        expect(() => packRequestApiKey(ANTIGRAVITY_PROVIDER_ID, creds())).toThrow(/projectId/i);
      });

      it("access 가 빈 자격은 던진다", () => {
        expect(() => packRequestApiKey(CODEX_PROVIDER_ID, creds({ access: "" }))).toThrow(/access/i);
      });
    });
    describe("decodeJwtPayload", () => {
      it("base64url 페이로드를 읽는다", () => {
        const token = fakeJwt({ sub: "u1", "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } });

        expect(decodeJwtPayload<{ sub?: string }>(token)?.sub).toBe("u1");
      });

      it("형식이 아닌 토큰은 null 이다 (던지지 않는다)", () => {
        expect(decodeJwtPayload("not-a-jwt")).toBeNull();
        expect(decodeJwtPayload("a.b")).toBeNull();
        expect(decodeJwtPayload("a.%%%.c")).toBeNull();
      });

      it("exp 를 밀리초로 환산한다 — 없으면 0", () => {
        const exp = Math.floor((Date.now() + HOUR) / 1000);

        expect(jwtExpiryMs(fakeJwt({ exp }))).toBe(exp * 1000);
        expect(jwtExpiryMs(fakeJwt({}))).toBe(0);
        expect(jwtExpiryMs("garbage")).toBe(0);
      });
    });
  });
  // 제공자 레지스트리: 앞의 셋은 Claude · Codex(ChatGPT) · Antigravity(Gemini) 이고, 나머지는 뒤에 덧붙는다.
  //
  // 2026-11-02 abaa03e78f 로 레지스트리가 2종 → 17종(OMP 가 로그인해 둔 제공자)으로 늘었다. 첫 항목이 권장 제공자이고
  // (2026-11-23 오너 결정: Claude — 조수 기본은 Sonnet 5.5 high. 2026-11-19 에는 ChatGPT, 2026-11-16 에는 Claude 였다), 옛 저장값의 기본 제공자는 순서가 아니라 DEFAULT_OH_MY_PI_PROVIDER 다.
  // 모든 제공자는 구독 로그인(oauth)이다 — API 키 제공자는 없다.
  describe("ohMyPiProviders", () => {
    isolateTimers();
    describe("oh-my-pi provider catalog", () => {
      it("앞의 셋은 고정이고 권장 제공자(ChatGPT)가 맨 앞이다", () => {
        expect(OH_MY_PI_PROVIDERS.map((provider) => provider.id).slice(0, 3)).toEqual([
          CODEX_PROVIDER_ID,
          "anthropic",
          ANTIGRAVITY_PROVIDER_ID,
        ]);
        expect(OH_MY_PI_PROVIDERS.length).toBeGreaterThan(3);
        expect(RECOMMENDED_OH_MY_PI_PROVIDER).toBe(CODEX_PROVIDER_ID);
        expect(OH_MY_PI_PROVIDERS[0]?.id).toBe(RECOMMENDED_OH_MY_PI_PROVIDER);
      });

      it("id 문자열은 oauth/credentials.ts 의 상수와 같은 출처다", () => {
        // 전송 계층(packRequestApiKey)과 UI 가 같은 상수를 봐야 한 쪽만 개명되는 사고가 없다.
        expect(ANTIGRAVITY_PROVIDER_ID).toBe("google-antigravity");
        expect(CODEX_PROVIDER_ID).toBe("openai-codex");
      });

      it("id 가 겹치지 않는다", () => {
        const ids = OH_MY_PI_PROVIDERS.map((provider) => provider.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("모든 제공자가 구독 로그인(oauth)이다 — API 키 제공자는 없다", () => {
        for (const provider of OH_MY_PI_PROVIDERS) {
          expect(provider.authKind, provider.id).toBe("oauth");
          expect(ohMyPiAuthKind(provider.id), provider.id).toBe("oauth");
        }
        expect(ohMyPiProvidersByAuthKind("oauth")).toHaveLength(OH_MY_PI_PROVIDERS.length);
        expect(ohMyPiProvidersByAuthKind("apiKey")).toHaveLength(0);
        expect(ohMyPiProvidersByAuthKind("local")).toHaveLength(0);
        expect(ohMyPiOAuthProviders().map((provider) => provider.id)).toEqual(OH_MY_PI_PROVIDERS.map((provider) => provider.id));
      });

      it("레코드의 라벨·기본 모델이 계약대로다", () => {
        const antigravity = getOhMyPiProvider(ANTIGRAVITY_PROVIDER_ID);
        expect(antigravity?.label).toBe("Google");
        expect(antigravity?.defaultModel).toBe("gemini-4-argon");

        const codex = getOhMyPiProvider(CODEX_PROVIDER_ID);
        expect(codex?.label).toBe("ChatGPT");
        expect(codex?.defaultModel).toBe("gpt-6.2-sol");

        const claude = getOhMyPiProvider("anthropic");
        expect(claude?.label).toBe("Claude");
        expect(claude?.defaultModel).toBe("claude-sonnet-5-5");
      });

      it("옛 저장값을 읽을 때의 제공자는 Antigravity OAuth 다 — 권장 제공자가 Claude 로 바뀌어도 그대로다", () => {
        expect(DEFAULT_OH_MY_PI_PROVIDER).toBe(ANTIGRAVITY_PROVIDER_ID);
        expect(getOhMyPiProvider(DEFAULT_OH_MY_PI_PROVIDER)?.authKind).toBe("oauth");
      });

      it("등록된 id 는 그대로 통과하고, 사라진 제공자 id 는 기본 제공자로 되돌린다", () => {
        expect(parseOhMyPiProvider(ANTIGRAVITY_PROVIDER_ID)).toBe(ANTIGRAVITY_PROVIDER_ID);
        expect(parseOhMyPiProvider(CODEX_PROVIDER_ID)).toBe(CODEX_PROVIDER_ID);
        // anthropic·github-copilot 은 abaa03e78f 로 등록됐다 — 그대로 통과한다.
        for (const registered of ["anthropic", "github-copilot"]) {
          expect(parseOhMyPiProvider(registered), registered).toBe(registered);
        }
        // 레지스트리에 없는 id 는 저장돼 있어도 기본값으로 스냅한다.
        for (const gone of ["zai", "openai", "ollama", "not-a-provider"]) {
          expect(parseOhMyPiProvider(gone), gone).toBe(DEFAULT_OH_MY_PI_PROVIDER);
        }
        expect(parseOhMyPiProvider(undefined)).toBe(DEFAULT_OH_MY_PI_PROVIDER);
      });

      it("모르는 id 는 기본 제공자의 종류로 떨어진다 (undefined 를 만들지 않는다)", () => {
        expect(ohMyPiAuthKind("no-such-provider")).toBe("oauth");
        expect(ohMyPiAuthKind(undefined)).toBe("oauth");
      });
    });
  });
});
