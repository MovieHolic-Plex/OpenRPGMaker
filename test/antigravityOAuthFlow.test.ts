// Antigravity(Google) OAuth 을 이 저장소가 직접 수행한다는 계약 스펙.
//
// 여기서 실제 네트워크와 실제 시간은 절대 쓰지 않는다: fetch 와 sleep 을 모두 주입해
// loadCodeAssist -> onboardUser 폴링 재시도까지 즉시 끝낸다. 재시도 대기를 진짜로 기다리면
// (2000ms x 4) 스위트가 timeout 안에서 흔들린다.
import { describe, expect, it } from "vitest";
import {
  AUTH_URL,
  CALLBACK_PATH,
  CALLBACK_PORT,
  CLOUD_CODE_ENDPOINT,
  DAILY_CLOUD_CODE_ENDPOINT,
  SCOPES,
  TOKEN_URL,
  buildAntigravityAuthorizationUrl,
  discoverAntigravityProject,
  exchangeAntigravityCode,
  refreshAntigravityToken,
} from "@/ai/oauth/antigravityOAuth";
import { packRequestApiKey } from "@/ai/oauth/credentials";

const EXPECTED_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const EXPECTED_CLIENT_SECRET = "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";
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
});
