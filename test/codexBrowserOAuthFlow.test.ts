// Codex 브라우저(루프백 PKCE) 로그인 스펙 — omp 의 loginOpenAICodex 와 같은 계약을 요구한다.
//
// 왜 이 스위트가 필요한가: 이 저장소는 Codex 로그인을 디바이스 코드 하나로만 포팅했었다.
// 그래서 사용자는 언제나 코드를 손으로 입력해야 했고, 1455 가 비어 있을 때 쓸 수 있는
// 원클릭 경로가 없었다. omp 는 브라우저 흐름을 주력으로 쓰고 디바이스는 대체로 둔다.
//
// 시간에 기대지 않는다: 콜백 서버와 디바이스 시작을 주입해 즉시 결정만 검증한다.
import { describe, expect, it } from "vitest";
import {
  CODEX_AUTHORIZE_URL,
  CODEX_BROWSER_CALLBACK_PATH,
  CODEX_BROWSER_CALLBACK_PORT,
  CODEX_BROWSER_REDIRECT_URI,
  CODEX_DEFAULT_ORIGINATOR,
  CODEX_SCOPES,
  beginCodexLogin,
  buildCodexAuthorizationUrl,
  generatePkcePair,
} from "@/ai/oauth/codexBrowserOAuth";
import { codexClientId, CODEX_DEVICE_VERIFICATION_URL } from "@/ai/oauth/codexDeviceOAuth";
import { configureOAuthClients } from "@/ai/oauth/clientConfig";

// 실제 Codex client id 는 저장소에 없다(clientConfig.ts) — 가짜 값으로 와이어만 본다.
configureOAuthClients({ codexClientId: "test-codex-client" });

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
