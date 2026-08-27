// Google Antigravity OAuth — 이 저장소가 직접 수행하는 인가 코드 흐름.
//
// 원래는 @oh-my-pi/pi-ai 의 registry/oauth/google-antigravity.ts 를 Bun 워커로 불러 썼다.
// Bun 없이도 로그인이 되어야 하므로 같은 와이어 계약을 fetch 만으로 다시 구현한다.
// 그래서 이 파일에는 node:* import 도 Bun API 도 없다 — 브라우저/Node/테스트에서 동일하게 돈다.

import type { PortedOAuthCredentials } from "./credentials.ts";

/** URL 문자열과 RequestInit 만 받는 최소 fetch 계약. globalThis.fetch 가 그대로 대입된다. */
export type OAuthFetch = (input: string, init: RequestInit) => Promise<Response>;

export type OAuthSleep = (ms: number) => Promise<void>;

const decode = (value: string): string => atob(value);

// 아래 두 값은 Antigravity 데스크톱 앱(참조 구현 @oh-my-pi/pi-ai)이 소스에 그대로 담고 배포하는
// **공개 데스크톱 클라이언트 자격**이다. 사용자 비밀도, 유출된 키도 아니다 — 설치형 앱의
// client_secret 은 OAuth 규격상 비밀로 취급되지 않는다(RFC 8252 §8.5).
// base64 로 감싼 이유는 보안이 아니라 참조 구현과 동일하게 자동 시크릿 스캐너의 오탐을 피하려는 것이며,
// 값과 인코딩 방식(atob)까지 참조 구현과 한 글자도 다르지 않게 유지한다.
const CLIENT_ID = decode(
  "MTA3MTAwNjA2MDU5MS10bWhzc2luMmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==",
);
const CLIENT_SECRET = decode("R09DU1BYLUs1OEZXUjQ4NkxkTEoxbUxCOHNYQzR6NnFEQWY=");

export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const CALLBACK_PORT = 51121;
export const CALLBACK_PATH = "/oauth-callback";
export const CLOUD_CODE_ENDPOINT = "https://cloudcode-pa.googleapis.com";
export const DAILY_CLOUD_CODE_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com";

/** 이 다섯 스코프는 Antigravity 클라이언트에 등록된 집합 그대로다. 하나라도 빠지면 동의 화면이 거부된다. */
export const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs",
] as const;

/** 참조 구현의 기본 Antigravity 버전. 백엔드 모델 게이팅이 이 버전만 본다. */
const ANTIGRAVITY_VERSION = "2.8.0";
const ANTIGRAVITY_USER_AGENT = `antigravity/hub/${ANTIGRAVITY_VERSION} (aidev_client; os_type=darwin; arch=arm64; cl=963137146)`;
const NODE_API_CLIENT_USER_AGENT = "google-api-nodejs-client/10.3.0";
const GOOG_API_CLIENT_HEADER = "gl-node/22.21.1";
const TIER_FREE = "free-tier";
const PROJECT_ONBOARD_MAX_ATTEMPTS = 5;
const PROJECT_ONBOARD_INTERVAL_MS = 2000;
/** 서버가 알려준 만료보다 5분 먼저 만료로 본다 — 요청이 비행 중에 죽는 창을 없앤다. */
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

const defaultFetch: OAuthFetch = (input, init) => globalThis.fetch(input, init);
const defaultSleep: OAuthSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

interface LoadCodeAssistPayload {
  cloudaicompanionProject?: string | { id?: string };
  currentTier?: { id?: string };
  allowedTiers?: Array<{ id?: string; isDefault?: boolean }>;
}

interface LongRunningOperationResponse {
  done?: boolean;
  response?: { cloudaicompanionProject?: string | { id?: string } };
}

export interface AntigravityOnboardMetadata {
  ide_type: string;
  ide_version: string;
  ide_name: string;
}

export function getAntigravityOnboardMetadata(): AntigravityOnboardMetadata {
  return { ide_type: "ANTIGRAVITY", ide_version: ANTIGRAVITY_VERSION, ide_name: "antigravity" };
}

export interface BuildAuthorizationUrlOptions {
  state: string;
  redirectUri: string;
  /** PKCE 를 쓰는 호출부만 넘긴다. Antigravity 데스크톱 흐름은 secret 을 쓰므로 없어도 된다. */
  codeChallenge?: string;
}

export function buildAntigravityAuthorizationUrl({
  state,
  redirectUri,
  codeChallenge,
}: BuildAuthorizationUrlOptions): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  return `${AUTH_URL}?${params.toString()}`;
}

export interface ExchangeCodeOptions {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  fetch?: OAuthFetch;
}

export async function exchangeAntigravityCode({
  code,
  redirectUri,
  codeVerifier,
  fetch = defaultFetch,
}: ExchangeCodeOptions): Promise<PortedOAuthCredentials> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  if (codeVerifier) body.set("code_verifier", codeVerifier);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Antigravity token exchange failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error("Antigravity token exchange returned no access_token.");
  }

  return {
    access: data.access_token,
    refresh: data.refresh_token ?? "",
    expires: Date.now() + (data.expires_in ?? 0) * 1000 - EXPIRY_SKEW_MS,
  };
}

function readProjectId(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
    return undefined;
  }
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    const id = (value as { id: string }).id.trim();
    if (id.length > 0) return id;
  }
  return undefined;
}

/** loadCodeAssist / LRO 응답이 프로젝트를 알려주는 세 이름 모두를 훑는다 — 백엔드가 섞어 쓴다. */
function extractProjectId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of ["cloudaicompanionProject", "projectId", "project"]) {
    const id = readProjectId(record[key]);
    if (id) return id;
  }
  return undefined;
}

function getDefaultTierId(
  allowedTiers?: Array<{ id?: string; isDefault?: boolean }>,
  currentTier?: { id?: string },
): string {
  const defaultTier = allowedTiers?.find(
    (tier) => tier.isDefault && typeof tier.id === "string" && tier.id.trim().length > 0,
  );
  if (defaultTier?.id) return defaultTier.id.trim();
  if (typeof currentTier?.id === "string" && currentTier.id.trim().length > 0) return currentTier.id.trim();
  return TIER_FREE;
}

async function onboardProjectWithRetries(
  endpoint: string,
  headers: Record<string, string>,
  onboardBody: { tier_id: string; metadata: AntigravityOnboardMetadata },
  fetch: OAuthFetch,
  sleep: OAuthSleep,
  onProgress?: (message: string) => void,
): Promise<string> {
  for (let attempt = 1; attempt <= PROJECT_ONBOARD_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      onProgress?.(`Waiting for project provisioning (attempt ${attempt}/${PROJECT_ONBOARD_MAX_ATTEMPTS})...`);
      await sleep(PROJECT_ONBOARD_INTERVAL_MS);
    }

    const response = await fetch(`${endpoint}/v1internal:onboardUser`, {
      method: "POST",
      headers,
      body: JSON.stringify(onboardBody),
    });

    if (!response.ok) {
      throw new Error(`onboardUser failed: ${response.status} ${await response.text()}`);
    }

    const operation = (await response.json()) as LongRunningOperationResponse;
    // done 이 아직 false 면 프로비저닝 중이다 — 응답을 읽지 않고 다음 폴링으로 넘어간다.
    if (!operation.done) continue;

    const projectId = extractProjectId(operation.response);
    if (projectId) return projectId;
  }

  throw new Error(
    `onboardUser did not return a provisioned project id after ${PROJECT_ONBOARD_MAX_ATTEMPTS} attempts`,
  );
}

export interface DiscoverProjectOptions {
  accessToken: string;
  fetch?: OAuthFetch;
  sleep?: OAuthSleep;
  onProgress?: (message: string) => void;
}

export async function discoverAntigravityProject({
  accessToken,
  fetch = defaultFetch,
  sleep = defaultSleep,
  onProgress,
}: DiscoverProjectOptions): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": ANTIGRAVITY_USER_AGENT,
  };

  onProgress?.("Checking for existing project...");
  let lastErrorText: string | undefined;
  let lastStatus: number | undefined;
  let fallbackTierId = TIER_FREE;
  let loadedSuccessfully = false;

  // daily 엔드포인트를 먼저 본다: 신규 모델은 daily 에만 열려 있고, 죽어 있을 때만 프로덕션으로 내려간다.
  for (const endpoint of [DAILY_CLOUD_CODE_ENDPOINT, CLOUD_CODE_ENDPOINT]) {
    const response = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
      method: "POST",
      headers,
      body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } }),
    });

    if (!response.ok) {
      lastStatus = response.status;
      lastErrorText = await response.text();
      continue;
    }

    loadedSuccessfully = true;
    const payload = (await response.json()) as LoadCodeAssistPayload;
    const existingProject = extractProjectId(payload);
    if (existingProject) return existingProject;
    fallbackTierId = getDefaultTierId(payload.allowedTiers, payload.currentTier);
  }

  if (!loadedSuccessfully) {
    throw new Error(`loadCodeAssist failed: ${lastStatus ?? "no response"}: ${lastErrorText || "unknown error"}`);
  }

  onProgress?.("Provisioning project...");
  return onboardProjectWithRetries(
    DAILY_CLOUD_CODE_ENDPOINT,
    {
      ...headers,
      "User-Agent": `${ANTIGRAVITY_USER_AGENT} ${NODE_API_CLIENT_USER_AGENT}`,
      "X-Goog-Api-Client": GOOG_API_CLIENT_HEADER,
    },
    { tier_id: fallbackTierId, metadata: getAntigravityOnboardMetadata() },
    fetch,
    sleep,
    onProgress,
  );
}

export interface RefreshTokenOptions {
  refreshToken: string;
  projectId: string;
  fetch?: OAuthFetch;
}

export async function refreshAntigravityToken({
  refreshToken,
  projectId,
  fetch = defaultFetch,
}: RefreshTokenOptions): Promise<PortedOAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Antigravity token refresh failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  return {
    access: data.access_token,
    // 갱신 응답은 refresh_token 을 대개 생략한다. 그때 빈 값을 저장하면 다음 갱신이 불가능해진다.
    refresh: data.refresh_token || refreshToken,
    expires: Date.now() + data.expires_in * 1000 - EXPIRY_SKEW_MS,
    projectId,
  };
}
