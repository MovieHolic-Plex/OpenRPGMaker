// 이 저장소가 직접 소유하는 OAuth 자격 표현.
//
// 전송(@oh-my-pi/pi-ai `complete`)이 되읽는 필드 이름은 협상 대상이 아니다:
// `providers/google-gemini-cli.ts:373 parseGeminiCliCredentials` 가 `token` + `projectId`
// 를 요구하고, 없으면 ValidationError 로 죽는다. 그래서 여기서 미리 던져 원인을 앞당긴다.

export const ANTIGRAVITY_PROVIDER_ID = "google-antigravity";
export const CODEX_PROVIDER_ID = "openai-codex";

export type PortedOAuthProviderId = typeof ANTIGRAVITY_PROVIDER_ID | typeof CODEX_PROVIDER_ID;

export interface PortedOAuthCredentials {
  access: string;
  refresh: string;
  /** epoch ms. 0 은 "만료됨"으로 취급한다 — 호출부가 먼저 갱신해야 한다. */
  expires: number;
  projectId?: string;
  email?: string;
  accountId?: string;
  apiEndpoint?: string;
  enterpriseUrl?: string;
  orgId?: string;
  orgName?: string;
  authorizedAt?: number;
}

function base64UrlDecode(segment: string): string | null {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const json = base64UrlDecode(parts[1] ?? "");
  if (json === null) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** 토큰의 `exp`(초) 를 epoch ms 로. 못 읽으면 0 — 즉 만료로 취급된다. */
export function jwtExpiryMs(token: string): number {
  const exp = decodeJwtPayload<{ exp?: unknown }>(token)?.exp;
  return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : 0;
}

/**
 * 요청 시점 자격 문자열. pi-ai 의 `getOAuthApiKey`(registry/oauth/index.ts:113) 를 대체한다.
 *
 * **만료된 자격은 던진다.** 만료 토큰을 상류로 POST 하면 제공자가 그것을 잘못된 자격으로
 * 분류해 계정을 잠글 수 있어서, 갱신 책임을 호출부에 되돌린다.
 */
export function packRequestApiKey(
  providerId: PortedOAuthProviderId,
  credentials: PortedOAuthCredentials,
  now: number = Date.now(),
): string {
  if (!credentials.access.trim()) {
    throw new Error(`${providerId}: access token is missing — log in again.`);
  }
  if (now >= credentials.expires) {
    throw new Error(`${providerId}: credential is expired — refresh before use.`);
  }
  if (providerId === CODEX_PROVIDER_ID) return credentials.access;

  if (!credentials.projectId?.trim()) {
    throw new Error(`${providerId}: credential has no projectId — re-run project discovery.`);
  }
  return JSON.stringify({
    apiEndpoint: credentials.apiEndpoint,
    token: credentials.access,
    enterpriseUrl: credentials.enterpriseUrl,
    projectId: credentials.projectId,
    refreshToken: credentials.refresh,
    expiresAt: credentials.expires,
    email: credentials.email,
    accountId: credentials.accountId,
  });
}
