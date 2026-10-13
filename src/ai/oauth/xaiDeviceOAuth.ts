// xAI Grok 디바이스 코드 OAuth — oh-my-pi pi-catalog `auth/xai-oauth.kdl` 와 같은 흐름.
//
// 로그인 kind 는 device-code 다. 디바이스 주소·스코프·폼 본문·OIDC 토큰 주소·갱신 grant 는
// 그 정책과 pi-ai 의 device-code/refresh 엔진을 따른다. client id 는 저장소에 적지 않고
// oauthClient("xaiClientId") 로 읽는다.
//
// node:/Bun API 를 쓰지 않는다. 에디터 번들과 동반 서비스가 같은 코드를 쓴다.

import { oauthClient } from "./clientConfig.ts";
import { decodeJwtPayload, type PortedOAuthCredentials } from "./credentials.ts";

export const xaiClientId = (): string => oauthClient("xaiClientId");

export const XAI_DEVICE_CODE_URL = "https://auth.x.ai/oauth2/device/code";
export const XAI_OIDC_DISCOVERY_URL = "https://auth.x.ai/.well-known/openid-configuration";
export const XAI_USERINFO_URL = "https://auth.x.ai/oauth2/userinfo";
/** 카탈로그 scopes 를 공백으로 잇는다. */
export const XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access";
export const XAI_DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
/** 카탈로그 credential.expires.skewMs. expires_in 초에서 이만큼 뺀다. */
export const XAI_EXPIRY_SKEW_MS = 300_000;

const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_INTERVAL_SECONDS = 5;
const MINIMUM_INTERVAL_MS = 1_000;
const SLOW_DOWN_INCREMENT_MS = 5_000;
const DEFAULT_EXPIRES_SECONDS = 600;

type FetchImpl = typeof globalThis.fetch;
type SleepImpl = (ms: number) => Promise<void>;

const defaultFetch = (): FetchImpl => globalThis.fetch;
const defaultSleep: SleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** 발견 문서의 token_endpoint 를 HTTPS `x.ai` / `*.x.ai` 로만 받는다. */
export function validateXaiAuthUrl(url: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid xAI ${field}: ${url}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || (host !== "x.ai" && !host.endsWith(".x.ai"))) {
    throw new Error(`Invalid xAI ${field}: ${url}`);
  }
  return url;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function errorCode(body: unknown): string | undefined {
  return nonEmpty(asRecord(body)?.error);
}

async function postForm(
  fetchImpl: FetchImpl,
  url: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ response: Response; body: unknown }> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  return { response, body: await readJson(response) };
}

export async function discoverXaiTokenEndpoint(options: {
  fetch?: FetchImpl;
  signal?: AbortSignal;
} = {}): Promise<string> {
  const fetchImpl = options.fetch ?? defaultFetch();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const response = await fetchImpl(XAI_OIDC_DISCOVERY_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  });
  const body = asRecord(await readJson(response));
  const endpoint = nonEmpty(body?.token_endpoint);
  if (!response.ok || !endpoint) {
    throw new Error(`xai-oauth: OIDC discovery failed: ${response.status}`);
  }
  return validateXaiAuthUrl(endpoint, "token_endpoint");
}

export interface XaiDeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  instructions: string;
  intervalSeconds: number;
  expiresInSeconds: number;
}

export async function startXaiDeviceAuthorization(options: {
  fetch?: FetchImpl;
  signal?: AbortSignal;
} = {}): Promise<XaiDeviceAuthorization> {
  const fetchImpl = options.fetch ?? defaultFetch();
  const { response, body } = await postForm(fetchImpl, XAI_DEVICE_CODE_URL, {
    client_id: xaiClientId(),
    scope: XAI_OAUTH_SCOPE,
  }, options.signal);
  const record = asRecord(body);
  const userCode = nonEmpty(record?.user_code);
  const deviceCode = nonEmpty(record?.device_code);
  const verificationUri = nonEmpty(record?.verification_uri);
  if (!response.ok || !userCode || !deviceCode || !verificationUri) {
    const detail = errorCode(body) ?? response.status;
    throw new Error(`xai-oauth: device authorization failed: ${detail}`);
  }
  const interval = record?.interval;
  const intervalSeconds = typeof interval === "number" && Number.isFinite(interval) && interval > 0
    ? interval
    : DEFAULT_INTERVAL_SECONDS;
  const expires = record?.expires_in;
  const expiresInSeconds = typeof expires === "number" && Number.isFinite(expires) && expires > 0
    ? expires
    : DEFAULT_EXPIRES_SECONDS;
  const complete = nonEmpty(record?.verification_uri_complete);
  return {
    deviceCode,
    userCode,
    verificationUrl: complete ?? verificationUri,
    instructions: `코드 ${userCode} 를 입력하세요.`,
    intervalSeconds,
    expiresInSeconds,
  };
}

function credentialsFromTokenBody(
  body: unknown,
  previousRefresh?: string,
): PortedOAuthCredentials {
  const record = asRecord(body);
  const access = nonEmpty(record?.access_token);
  if (!access) throw new Error("xai-oauth: token response missing access_token");
  const refresh = nonEmpty(record?.refresh_token) ?? previousRefresh ?? "";
  if (!refresh) throw new Error("xai-oauth: token response missing refresh_token");
  const expiresIn = record?.expires_in;
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn)) {
    throw new Error("xai-oauth: token response missing expires_in");
  }
  const subject = nonEmpty(decodeJwtPayload<{ sub?: unknown }>(access)?.sub);
  return {
    access,
    refresh,
    expires: Date.now() + expiresIn * 1000 - XAI_EXPIRY_SKEW_MS,
    ...(subject ? { accountId: subject } : {}),
  };
}

async function applyUserinfo(
  fetchImpl: FetchImpl,
  credentials: PortedOAuthCredentials,
  signal?: AbortSignal,
): Promise<PortedOAuthCredentials> {
  try {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response = await fetchImpl(XAI_USERINFO_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.access}`,
      },
      redirect: "error",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) return credentials;
    const record = asRecord(await readJson(response));
    const email = nonEmpty(record?.email)?.toLowerCase();
    const accountId = nonEmpty(record?.sub) ?? credentials.accountId;
    return {
      ...credentials,
      ...(email ? { email } : {}),
      ...(accountId ? { accountId } : {}),
    };
  } catch {
    return credentials;
  }
}

async function sleepAbortable(sleep: SleepImpl, ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("xai-oauth: device authorization cancelled");
  if (!signal) {
    await sleep(ms);
    return;
  }
  await Promise.race([
    sleep(ms),
    new Promise<void>((_, reject) => {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        reject(new Error("xai-oauth: device authorization cancelled"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }),
  ]);
}

export async function pollXaiDeviceAuthorization(options: {
  deviceCode: string;
  intervalSeconds?: number;
  expiresInSeconds?: number;
  fetch?: FetchImpl;
  sleep?: SleepImpl;
  signal?: AbortSignal;
}): Promise<PortedOAuthCredentials> {
  const fetchImpl = options.fetch ?? defaultFetch();
  const sleep = options.sleep ?? defaultSleep;
  const tokenUrl = await discoverXaiTokenEndpoint({ fetch: fetchImpl, signal: options.signal });
  const deadline = Date.now() + (options.expiresInSeconds ?? DEFAULT_EXPIRES_SECONDS) * 1000;
  let intervalMs = Math.max(MINIMUM_INTERVAL_MS, Math.floor((options.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS) * 1000));

  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new Error("xai-oauth: device authorization cancelled");
    const { response, body } = await postForm(fetchImpl, tokenUrl, {
      grant_type: XAI_DEVICE_GRANT,
      client_id: xaiClientId(),
      device_code: options.deviceCode,
    }, options.signal);
    const error = errorCode(body);
    if (response.ok && !error) {
      const credentials = credentialsFromTokenBody(body);
      return applyUserinfo(fetchImpl, credentials, options.signal);
    }
    if (error === "authorization_pending") {
      // keep polling
    } else if (error === "slow_down") {
      intervalMs += SLOW_DOWN_INCREMENT_MS;
    } else if (error === "expired_token") {
      throw new Error("xai-oauth: device code expired; restart the login");
    } else if (error === "access_denied") {
      throw new Error("xai-oauth: device authorization was denied");
    } else {
      const description = nonEmpty(asRecord(body)?.error_description);
      throw new Error(`xai-oauth: device token request failed: ${response.status} ${description ?? error ?? ""}`.trim());
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleepAbortable(sleep, Math.min(intervalMs, remaining), options.signal);
  }
  throw new Error("xai-oauth: device authorization timed out");
}

export async function refreshXaiOAuthToken(options: {
  refreshToken: string;
  fetch?: FetchImpl;
  signal?: AbortSignal;
}): Promise<PortedOAuthCredentials> {
  const fetchImpl = options.fetch ?? defaultFetch();
  const tokenUrl = await discoverXaiTokenEndpoint({ fetch: fetchImpl, signal: options.signal });
  const { response, body } = await postForm(fetchImpl, tokenUrl, {
    grant_type: "refresh_token",
    client_id: xaiClientId(),
    refresh_token: options.refreshToken,
  }, options.signal);
  if (!response.ok) {
    const description = nonEmpty(asRecord(body)?.error_description) ?? errorCode(body) ?? "";
    throw new Error(`xai-oauth: token refresh failed: ${response.status} ${description}`.trim());
  }
  const credentials = credentialsFromTokenBody(body, options.refreshToken);
  return applyUserinfo(fetchImpl, credentials, options.signal);
}

/** 요청 Bearer. Antigravity JSON 묶음이 아니다. */
export function packXaiOAuthAccess(credentials: PortedOAuthCredentials, now: number = Date.now()): string {
  if (!credentials.access.trim()) {
    throw new Error("xai-oauth: access token is missing — log in again.");
  }
  if (now >= credentials.expires) {
    throw new Error("xai-oauth: credential is expired — refresh before use.");
  }
  return credentials.access;
}
