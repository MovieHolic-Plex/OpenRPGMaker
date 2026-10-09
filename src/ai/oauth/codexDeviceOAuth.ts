// OpenAI Codex(ChatGPT) 디바이스 코드 OAuth — 이 저장소가 직접 소유한다.
//
// node:/Bun API 를 하나도 쓰지 않는다: 이 모듈은 에디터 번들(브라우저)과 스크립트
// 양쪽에서 같은 코드로 돌아야 하고, 예전 경로처럼 Bun 워커에 로그인을 위임하면
// Bun 없는 환경에서 인증 자체가 불가능해진다.

import { oauthClient } from "./clientConfig.ts";
import { decodeJwtPayload, type PortedOAuthCredentials } from "./credentials.ts";

/** Codex CLI 의 client id — 저장소에 적지 않는다(clientConfig.ts). */
export const codexClientId = (): string => oauthClient("codexClientId");
export const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
export const CODEX_DEVICE_USERCODE_URL = "https://auth.openai.com/api/accounts/deviceauth/usercode";
export const CODEX_DEVICE_TOKEN_URL = "https://auth.openai.com/api/accounts/deviceauth/token";
/** 디바이스 흐름 전용 redirect_uri. 등록된 허용목록 값과 한 글자도 달라선 안 된다 — 다르면 교환이 403 이다. */
export const CODEX_DEVICE_REDIRECT_URI = "https://auth.openai.com/deviceauth/callback";
export const CODEX_DEVICE_VERIFICATION_URL = "https://auth.openai.com/codex/device";
/** 서버가 계속 대기 상태만 돌려줄 때 무한 루프에 빠지지 않도록 하는 폴링 상한. */
export const CODEX_DEVICE_MAX_POLLS = 120;

const AUTH_CLAIM = "https://api.openai.com/auth";
const PROFILE_CLAIM = "https://api.openai.com/profile";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;
const DEVICE_POLL_INTERVAL_MS = 5_000;
/** 서버가 준 interval 에 얹는 여유. 경계에서 딱 맞춰 때리면 slow_down 을 받는다. */
const DEVICE_POLL_SAFETY_MARGIN_MS = 3_000;

type FetchImpl = typeof globalThis.fetch;
type SleepImpl = (ms: number) => Promise<void>;

const defaultFetch = (): FetchImpl => globalThis.fetch;
const defaultSleep: SleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

interface CodexJwtPayload {
  [AUTH_CLAIM]?: { chatgpt_account_id?: unknown; chatgpt_plan_type?: unknown };
  [PROFILE_CLAIM]?: { email?: unknown };
  [key: string]: unknown;
}

export interface CodexTokenProfile {
  accountId?: string;
  email?: string;
  planType?: string;
}

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * 토큰 클레임에서 신원 조각을 읽는다. `chatgpt_account_id` 는 토큰이 한도를 끌어오는
 * 구독 풀(워크스페이스)이라 계정 이메일 하나가 여러 개를 가질 수 있고,
 * `chatgpt_plan_type` 은 access token 에 없고 id token 에만 있는 경우가 있다.
 */
export function readCodexTokenProfile(accessToken: string, idToken?: string): CodexTokenProfile {
  const payload = decodeJwtPayload<CodexJwtPayload>(accessToken);
  const idPayload = idToken ? decodeJwtPayload<CodexJwtPayload>(idToken) : null;
  const auth = payload?.[AUTH_CLAIM];
  const idAuth = idPayload?.[AUTH_CLAIM];
  const email = nonEmpty(payload?.[PROFILE_CLAIM]?.email)?.toLowerCase();
  const planType = (nonEmpty(auth?.chatgpt_plan_type) ?? nonEmpty(idAuth?.chatgpt_plan_type))?.toLowerCase();
  return {
    accountId: nonEmpty(auth?.chatgpt_account_id),
    email,
    planType,
  };
}

function describeValue(value: unknown): string | undefined {
  if (typeof value === "string") return nonEmpty(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const code = describeValue(record.code ?? record.error);
  const message = describeValue(record.message ?? record.error_description ?? record.description);
  if (code && message && code !== message) return `${code}: ${message}`;
  return code ?? message ?? JSON.stringify(value);
}

/** 토큰 엔드포인트 실패를 사람이 읽을 수 있게 만든다 — 상태 코드만 남기면 원인 추적이 불가능하다. */
export function formatCodexTokenEndpointError(status: number, bodyText: string): string {
  const trimmed = bodyText.trim();
  if (trimmed.length === 0) return `${status}`;
  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch {
    return `${status} ${trimmed}`;
  }
  if (body === null || typeof body !== "object") return `${status} ${trimmed}`;
  const record = body as Record<string, unknown>;
  const error = describeValue(record.error);
  const description = describeValue(record.error_description);
  if (error && description && error !== description) return `${status} ${error}: ${description}`;
  return `${status} ${error ?? description ?? describeValue(record.message) ?? trimmed}`;
}

interface CodexTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  id_token?: unknown;
  expires_in?: unknown;
}

function requireTokenFields(data: CodexTokenResponse): {
  access: string;
  refresh: string;
  idToken?: string;
  expiresIn: number;
} {
  const access = nonEmpty(data.access_token);
  const refresh = nonEmpty(data.refresh_token);
  const expiresIn = data.expires_in;
  if (!access || !refresh || typeof expiresIn !== "number" || !Number.isFinite(expiresIn)) {
    throw new Error("openai-codex: token response missing required fields");
  }
  return { access, refresh, idToken: nonEmpty(data.id_token), expiresIn };
}

export interface CodexDeviceAuthorization {
  deviceAuthId: string;
  userCode: string;
  pollIntervalMs: number;
  verificationUrl: string;
}

export async function startCodexDeviceAuthorization(
  options: { fetch?: FetchImpl } = {},
): Promise<CodexDeviceAuthorization> {
  const fetchImpl = options.fetch ?? defaultFetch();
  const response = await fetchImpl(CODEX_DEVICE_USERCODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: codexClientId() }),
    signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`openai-codex: device authorization initiation failed: ${response.status}`);
  }

  const data = (await response.json()) as { device_auth_id?: unknown; user_code?: unknown; interval?: unknown };
  const deviceAuthId = nonEmpty(data.device_auth_id);
  const userCode = nonEmpty(data.user_code);
  if (!deviceAuthId || !userCode) {
    throw new Error("openai-codex: device authorization response missing device_auth_id or user_code");
  }

  const intervalSeconds =
    typeof data.interval === "number" && Number.isFinite(data.interval)
      ? data.interval
      : Number.parseInt(String(data.interval ?? "5"), 10) || 5;

  return {
    deviceAuthId,
    userCode,
    pollIntervalMs: intervalSeconds * 1000 + DEVICE_POLL_SAFETY_MARGIN_MS,
    verificationUrl: CODEX_DEVICE_VERIFICATION_URL,
  };
}

export interface PollCodexDeviceAuthorizationOptions extends Omit<CodexDeviceAuthorization, "verificationUrl"> {
  verificationUrl?: string;
  fetch?: FetchImpl;
  sleep?: SleepImpl;
  signal?: AbortSignal;
}

export async function pollCodexDeviceAuthorization(
  options: PollCodexDeviceAuthorizationOptions,
): Promise<PortedOAuthCredentials> {
  const fetchImpl = options.fetch ?? defaultFetch();
  const sleep = options.sleep ?? defaultSleep;

  for (let poll = 0; poll < CODEX_DEVICE_MAX_POLLS; poll += 1) {
    // 첫 대기만 짧게 간다: 사용자가 이미 코드를 넣어둔 경우를 빠르게 잡는다.
    await sleep(poll === 0 ? Math.min(options.pollIntervalMs, DEVICE_POLL_INTERVAL_MS) : options.pollIntervalMs);

    if (options.signal?.aborted) {
      throw new Error("openai-codex: device authorization cancelled");
    }

    const response = await fetchImpl(CODEX_DEVICE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_auth_id: options.deviceAuthId, user_code: options.userCode }),
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });

    // 403/404 는 실패가 아니라 "아직 승인 안 됨"이다 — 여기서 던지면 정상 로그인이 깨진다.
    if (response.status === 403 || response.status === 404) continue;

    if (!response.ok) {
      throw new Error(`openai-codex: device token polling failed: ${response.status}`);
    }

    const data = (await response.json()) as { authorization_code?: unknown; code_verifier?: unknown };
    const code = nonEmpty(data.authorization_code);
    const codeVerifier = nonEmpty(data.code_verifier);
    if (!code || !codeVerifier) {
      throw new Error("openai-codex: device token response missing authorization_code or code_verifier");
    }

    return exchangeCodexAuthorizationCode({
      code,
      codeVerifier,
      redirectUri: CODEX_DEVICE_REDIRECT_URI,
      fetch: fetchImpl,
    });
  }

  throw new Error("openai-codex: device authorization timed out — login was not completed in time");
}

export async function exchangeCodexAuthorizationCode(options: {
  code: string;
  codeVerifier: string;
  redirectUri?: string;
  fetch?: FetchImpl;
}): Promise<PortedOAuthCredentials> {
  const fetchImpl = options.fetch ?? defaultFetch();
  const response = await fetchImpl(CODEX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: codexClientId(),
      code: options.code,
      code_verifier: options.codeVerifier,
      redirect_uri: options.redirectUri ?? CODEX_DEVICE_REDIRECT_URI,
    }),
    signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `openai-codex: token exchange failed: ${formatCodexTokenEndpointError(response.status, bodyText)}`,
    );
  }

  const tokens = requireTokenFields((await response.json()) as CodexTokenResponse);
  const { accountId, email, planType } = readCodexTokenProfile(tokens.access, tokens.idToken);
  if (!accountId) {
    throw new Error("openai-codex: token has no chatgpt_account_id claim");
  }

  return {
    access: tokens.access,
    refresh: tokens.refresh,
    expires: Date.now() + tokens.expiresIn * 1000,
    accountId,
    email,
    orgId: accountId,
    orgName: planType,
  };
}

export async function refreshCodexToken(options: {
  refreshToken: string;
  fetch?: FetchImpl;
}): Promise<PortedOAuthCredentials> {
  const fetchImpl = options.fetch ?? defaultFetch();
  const response = await fetchImpl(CODEX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: options.refreshToken,
      client_id: codexClientId(),
    }),
    signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `openai-codex: token refresh failed: ${formatCodexTokenEndpointError(response.status, bodyText)}`,
    );
  }

  const tokens = requireTokenFields((await response.json()) as CodexTokenResponse);
  const { accountId, email } = readCodexTokenProfile(tokens.access);

  // org 필드는 의도적으로 비운다: 자격이 묶인 워크스페이스는 로그인 시점에 정해지고,
  // 호출부는 갱신 결과를 저장본 위에 병합하므로 여기서 빼면 기존 값이 그대로 남는다.
  return {
    access: tokens.access,
    refresh: tokens.refresh,
    expires: Date.now() + tokens.expiresIn * 1000,
    accountId,
    email,
  };
}
