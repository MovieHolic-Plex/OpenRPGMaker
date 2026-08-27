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
import { describe, expect, it } from "vitest";
import {
  ANTIGRAVITY_PROVIDER_ID,
  CODEX_PROVIDER_ID,
  decodeJwtPayload,
  jwtExpiryMs,
  packRequestApiKey,
  type PortedOAuthCredentials,
} from "@/ai/oauth/credentials";

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
