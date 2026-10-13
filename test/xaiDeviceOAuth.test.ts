// xAI 디바이스 코드는 pi-catalog 정책과 같은 주소·폼·스코프·만료 여유를 쓴다.
// 네트워크는 가짜 fetch 다. client id 는 테스트 값만 쓴다.
import { afterEach, describe, expect, it } from "vitest";
import { configureOAuthClients } from "@/ai/oauth/clientConfig";
import {
  XAI_DEVICE_CODE_URL,
  XAI_DEVICE_GRANT,
  XAI_EXPIRY_SKEW_MS,
  XAI_OAUTH_SCOPE,
  XAI_OIDC_DISCOVERY_URL,
  discoverXaiTokenEndpoint,
  pollXaiDeviceAuthorization,
  refreshXaiOAuthToken,
  startXaiDeviceAuthorization,
} from "@/ai/oauth/xaiDeviceOAuth";

delete process.env.OPRN_XAI_CLIENT_ID;
configureOAuthClients({ xaiClientId: "test-xai-client" });

function jwt(payload: Record<string, unknown>): string {
  const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${segment({ alg: "none" })}.${segment(payload)}.sig`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  delete process.env.OPRN_XAI_CLIENT_ID;
});

describe("xAI device-code OAuth", () => {
  it("디바이스 요청은 폼으로 client id 와 스코프를 보내고 완료 URL 을 고른다", async () => {
    const started = await startXaiDeviceAuthorization({
      fetch: async (input, init) => {
        expect(String(input)).toBe(XAI_DEVICE_CODE_URL);
        expect(init?.method).toBe("POST");
        const headers = new Headers(init?.headers);
        expect(headers.get("Content-Type")).toContain("application/x-www-form-urlencoded");
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("client_id")).toBe("test-xai-client");
        expect(body.get("scope")).toBe(XAI_OAUTH_SCOPE);
        return jsonResponse({
          user_code: "ABCD-1234",
          device_code: "device-1",
          verification_uri: "https://auth.x.ai/activate",
          verification_uri_complete: "https://auth.x.ai/activate?user_code=ABCD-1234",
          interval: 5,
          expires_in: 600,
        });
      },
    });
    expect(started.userCode).toBe("ABCD-1234");
    expect(started.deviceCode).toBe("device-1");
    expect(started.verificationUrl).toBe("https://auth.x.ai/activate?user_code=ABCD-1234");
    expect(started.instructions).toContain("ABCD-1234");
  });

  it("토큰 주소가 x.ai 가 아니면 폴링을 시작하지 않는다", async () => {
    await expect(discoverXaiTokenEndpoint({
      fetch: async () => jsonResponse({ token_endpoint: "https://evil.example/token" }),
    })).rejects.toThrow(/Invalid xAI token_endpoint/);
  });

  it("대기 뒤 토큰을 받고 만료는 skew 만큼 당긴다", async () => {
    const access = jwt({ sub: "user-1" });
    const sleeps: number[] = [];
    let polls = 0;
    const before = Date.now();
    const credentials = await pollXaiDeviceAuthorization({
      deviceCode: "device-1",
      intervalSeconds: 5,
      expiresInSeconds: 60,
      sleep: async (ms) => { sleeps.push(ms); },
      fetch: async (input, init) => {
        const url = String(input);
        if (url === XAI_OIDC_DISCOVERY_URL) {
          return jsonResponse({ token_endpoint: "https://auth.x.ai/oauth2/token" });
        }
        if (url === "https://auth.x.ai/oauth2/userinfo") return jsonResponse({ email: "User@X.AI", sub: "user-1" });
        polls += 1;
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("grant_type")).toBe(XAI_DEVICE_GRANT);
        expect(body.get("client_id")).toBe("test-xai-client");
        expect(body.get("device_code")).toBe("device-1");
        if (polls === 1) return jsonResponse({ error: "authorization_pending" }, 400);
        return jsonResponse({ access_token: access, refresh_token: "refresh-1", expires_in: 3600 });
      },
    });
    expect(sleeps).toEqual([5000]);
    expect(credentials.access).toBe(access);
    expect(credentials.refresh).toBe("refresh-1");
    expect(credentials.accountId).toBe("user-1");
    expect(credentials.email).toBe("user@x.ai");
    expect(credentials.expires).toBeGreaterThanOrEqual(before + 3600 * 1000 - XAI_EXPIRY_SKEW_MS - 50);
    expect(credentials.expires).toBeLessThanOrEqual(Date.now() + 3600 * 1000 - XAI_EXPIRY_SKEW_MS + 50);
  });

  it("slow_down 은 간격을 5초 늘리고 access_denied 는 실패다", async () => {
    const sleeps: number[] = [];
    await expect(pollXaiDeviceAuthorization({
      deviceCode: "device-1",
      intervalSeconds: 5,
      expiresInSeconds: 30,
      sleep: async (ms) => { sleeps.push(ms); },
      fetch: async (input) => {
        const url = String(input);
        if (url === XAI_OIDC_DISCOVERY_URL) return jsonResponse({ token_endpoint: "https://auth.x.ai/oauth2/token" });
        if (sleeps.length === 0) return jsonResponse({ error: "slow_down" }, 400);
        return jsonResponse({ error: "access_denied" }, 400);
      },
    })).rejects.toThrow(/denied/);
    expect(sleeps[0]).toBe(10_000);
  });

  it("갱신은 refresh_token grant 이고 응답에 refresh 가 없으면 기존 값을 남긴다", async () => {
    const access = jwt({ sub: "user-2" });
    const credentials = await refreshXaiOAuthToken({
      refreshToken: "refresh-old",
      fetch: async (input, init) => {
        const url = String(input);
        if (url === XAI_OIDC_DISCOVERY_URL) return jsonResponse({ token_endpoint: "https://auth.x.ai/oauth2/token" });
        if (url.endsWith("/userinfo")) return jsonResponse({}, 404);
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("grant_type")).toBe("refresh_token");
        expect(body.get("client_id")).toBe("test-xai-client");
        expect(body.get("refresh_token")).toBe("refresh-old");
        expect(body.get("client_secret")).toBeNull();
        return jsonResponse({ access_token: access, expires_in: 1800 });
      },
    });
    expect(credentials.access).toBe(access);
    expect(credentials.refresh).toBe("refresh-old");
    expect(credentials.accountId).toBe("user-2");
  });
});
