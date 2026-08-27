// 제공자 인증 런타임 — 로그인·갱신·상태·요청 자격을 이 저장소 코드로 처리한다.
//
// 불변식 1: 순수 Node 에서 돈다. 와이어 구현은 src/ai/oauth/* 의 fetch 전용 모듈이고,
//           Bun 은 완성(completion) 전송에만 필요하다. 인증 경로가 Bun 을 요구하면
//           Bun 없는 머신에서 /auth/* 전체가 HTTP 500 이 된다.
// 불변식 2: 비밀은 디스크 저장소(~/.rpg-zzu/oh-my-pi-auth.json)에만 있고 브라우저로 나가지 않는다.
//
// 비밀은 항상 디스크 저장소(~/.rpg-zzu/oh-my-pi-auth.json)에만 있고 브라우저로 나가지 않는다.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  ANTIGRAVITY_PROVIDER_ID,
  CODEX_PROVIDER_ID,
  jwtExpiryMs,
  packRequestApiKey,
  type PortedOAuthCredentials,
  type PortedOAuthProviderId,
} from "../../src/ai/oauth/credentials.ts";
import {
  exchangeCodexAuthorizationCode,
  pollCodexDeviceAuthorization,
  refreshCodexToken,
  startCodexDeviceAuthorization,
} from "../../src/ai/oauth/codexDeviceOAuth.ts";
import { beginCodexLogin } from "../../src/ai/oauth/codexBrowserOAuth.ts";
import {
  buildAntigravityAuthorizationUrl,
  CALLBACK_PATH,
  CALLBACK_PORT,
  discoverAntigravityProject,
  exchangeAntigravityCode,
  refreshAntigravityToken,
} from "../../src/ai/oauth/antigravityOAuth.ts";
import { getOhMyPiProvider, OH_MY_PI_PROVIDERS } from "../../src/ai/ohMyPiProviders.ts";
import { createOhMyPiAuthStore, defaultOhMyPiAuthPath } from "./ohMyPiAuthStore.mjs";
import { startOAuthCallbackServer } from "./oauth/loopbackCallbackServer.mjs";

const store = createOhMyPiAuthStore(defaultOhMyPiAuthPath());

/** Antigravity 는 projectId 없이는 요청이 불가능하므로 상태 판정에 그것까지 본다. */
const PROJECT_SCOPED_PROVIDERS = new Set<string>([ANTIGRAVITY_PROVIDER_ID]);

function testStub(): boolean {
  return process.env.RPG_ZZU_OH_MY_PI_TEST_STUB === "1";
}

function isKnown(provider: string): provider is PortedOAuthProviderId {
  return provider === ANTIGRAVITY_PROVIDER_ID || provider === CODEX_PROVIDER_ID;
}

function requireKnown(provider: string): PortedOAuthProviderId {
  if (!isKnown(provider)) {
    const error = new Error(`알 수 없는 제공자입니다: ${provider}`) as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  return provider;
}

function credentialsOf(provider: string): PortedOAuthCredentials | undefined {
  const row = store.get(provider);
  if (!row || row.kind !== "oauth") return undefined;
  if (!row.access && !row.refresh) return undefined;
  return {
    access: String(row.access ?? ""),
    refresh: String(row.refresh ?? ""),
    expires: Number(row.expires) || 0,
    projectId: row.projectId,
    email: row.email,
    accountId: row.accountId,
    apiEndpoint: row.apiEndpoint,
    enterpriseUrl: row.enterpriseUrl,
    orgId: row.orgId,
    orgName: row.orgName,
    authorizedAt: row.authorizedAt,
  };
}

/**
 * Codex CLI 로그인(`~/.codex/auth.json`)을 우리 저장소로 한 번 옮긴다.
 *
 * 이 단계가 없으면 이미 `codex login` 이 끝난 PC 에서도 디바이스 코드를 다시 승인해야 한다.
 * 사용자가 연결을 끊었다면(declined) 되살리지 않는다 — 그러면 해제가 눈속임이 된다.
 */
function adoptCodexCliCredentials(provider: string): boolean {
  if (provider !== CODEX_PROVIDER_ID || store.adoptionDeclined(CODEX_PROVIDER_ID)) return false;
  const path = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
  try {
    const tokens = JSON.parse(readFileSync(path, "utf8"))?.tokens;
    const access = typeof tokens?.access_token === "string" ? tokens.access_token : "";
    const refresh = typeof tokens?.refresh_token === "string" ? tokens.refresh_token : "";
    if (!refresh) return false;
    store.setOAuth(CODEX_PROVIDER_ID, { access, refresh, expires: jwtExpiryMs(access) });
    return true;
  } catch {
    return false;
  }
}

export function listOhMyPiProviders() {
  return OH_MY_PI_PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    authKind: provider.authKind,
    defaultModel: provider.defaultModel,
    hasLogin: true,
    hasRefresh: true,
  }));
}

export function publicProviderStatus(provider: string) {
  // HTTP 경계에서 들어온 이름이므로 여기서 막는다. 모를 제공자를 `connected:false` 로
  // 답하면 사용자는 "여기 로그인하면 된다"고 오해하게 된다 — 지원하지 않는 것이다.
  requireKnown(provider);
  const envVars = getOhMyPiProvider(provider)?.envVars ?? [];
  const envHit = envVars.some((name) => Boolean(process.env[name]?.trim()));
  if (!store.has(provider)) adoptCodexCliCredentials(provider);
  const disk = store.publicStatus(provider);
  const row = store.get(provider);
  const hasRequiredMetadata = !PROJECT_SCOPED_PROVIDERS.has(provider)
    || row?.kind !== "oauth"
    || Boolean(row.projectId);
  const pending = pendingLogins.get(provider);
  const extra = pending?.error ? { lastLoginError: pending.error } : {};
  if (disk.connected && !hasRequiredMetadata) {
    return { ...disk, ...extra, connected: false, provider, env: false };
  }
  if (disk.connected || envHit) {
    return { ...disk, ...extra, connected: true, provider, env: envHit };
  }
  return { connected: false, provider, ...extra };
}

/**
 * 승인 대기 중인 로그인. `/auth/login` 은 사용자에게 보여줄 URL·코드를 즉시 반환하고
 * 승인 대기는 백그라운드에서 계속되므로, 실패는 다음 `/auth/status` 의 `lastLoginError` 로만
 * 관측된다.
 */
const pendingLogins = new Map<string, { promise: Promise<void>; error?: string; abort: AbortController }>();

function trackLogin(provider: string, abort: AbortController, work: Promise<PortedOAuthCredentials>) {
  const entry: { promise: Promise<void>; error?: string; abort: AbortController } = {
    abort,
    promise: work
      .then((credentials) => {
        store.setOAuth(provider, credentials);
        pendingLogins.delete(provider);
      })
      .catch((error: unknown) => {
        entry.error = error instanceof Error ? error.message : String(error);
      }),
  };
  pendingLogins.set(provider, entry);
}

/**
 * 진행 중이던 로그인을 중단한다. Antigravity 는 고정 포트 51121 에 루프백 서버를 여므로
 * 이전 시도를 정리하지 않으면 다시 로그인할 때 EADDRINUSE 로 죽는다.
 */
export function cancelProviderLogin(provider: string): boolean {
  const pending = pendingLogins.get(provider);
  if (!pending) return false;
  pending.abort.abort(new Error("login superseded"));
  pendingLogins.delete(provider);
  return true;
}

export async function startProviderLogin(provider: string, _body: { apiKey?: string } = {}) {
  const id = requireKnown(provider);
  cancelProviderLogin(id);
  if (testStub()) {
    return {
      connected: false,
      provider: id,
      verificationUrl: `https://oauth.example.test/${id}`,
      userCode: "TEST-OK",
    };
  }

  const abort = new AbortController();
  if (id === CODEX_PROVIDER_ID) {
    const started = await beginCodexLogin({
      openCallbackServer: (options) => startOAuthCallbackServer(options),
      startDeviceAuthorization: () => startCodexDeviceAuthorization({}),
      signal: abort.signal,
    });
    if (started.mode === "browser") {
      trackLogin(id, abort, (async () => {
        const { code } = await started.waitForCode;
        return exchangeCodexAuthorizationCode({
          code,
          codeVerifier: started.codeVerifier,
          redirectUri: started.redirectUri,
        });
      })());
    } else {
      trackLogin(id, abort, pollCodexDeviceAuthorization({ ...started.device, signal: abort.signal }));
    }
    return {
      connected: false,
      provider: id,
      verificationUrl: started.verificationUrl,
      userCode: started.userCode,
      instructions: started.instructions,
    };
  }

  const state = crypto.randomUUID();
  // 콜백 서버를 먼저 띄우고 **실제로 바인드된 포트**로 redirect_uri 를 만든다. 선호 포트가
  // 점유돼 있으면 대체 포트로 붙으므로(Google 은 루프백 포트를 고정하지 않는다), 포트를 먼저
  // 확정하지 않으면 동의 화면의 redirect_uri 와 실제 대기 포트가 어긋나 승인이 유실된다.
  const handle = await startOAuthCallbackServer({
    preferredPort: CALLBACK_PORT,
    callbackPath: CALLBACK_PATH,
    expectedState: state,
    signal: abort.signal,
  });
  trackLogin(id, abort, (async () => {
    const { code } = await handle.waitForCode;
    const exchanged = await exchangeAntigravityCode({ code, redirectUri: handle.redirectUri });
    const projectId = await discoverAntigravityProject({ accessToken: exchanged.access });
    return { ...exchanged, projectId };
  })());
  return {
    connected: false,
    provider: id,
    verificationUrl: buildAntigravityAuthorizationUrl({ state, redirectUri: handle.redirectUri }),
    userCode: "",
    instructions: "브라우저에서 Google 계정으로 로그인하세요.",
  };
}

export async function refreshProvider(provider: string) {
  const id = requireKnown(provider);
  const credentials = credentialsOf(id);
  if (!credentials) return publicProviderStatus(id);
  if (testStub()) {
    store.setOAuth(id, { ...credentials, access: "stub-refreshed", expires: Date.now() + 60_000 });
    return { ...publicProviderStatus(id), refreshed: true };
  }
  const refreshed = id === CODEX_PROVIDER_ID
    ? await refreshCodexToken({ refreshToken: credentials.refresh })
    : await refreshAntigravityToken({
        refreshToken: credentials.refresh,
        projectId: credentials.projectId ?? "",
      });
  // 저장본 위에 병합한다: 갱신 응답은 orgId/projectId 같은 로그인 시점 메타데이터를 담지 않는다.
  store.setOAuth(id, { ...credentials, ...refreshed });
  return { ...publicProviderStatus(id), refreshed: true };
}

export function logoutProvider(provider: string) {
  const id = requireKnown(provider);
  cancelProviderLogin(id);
  const removed = store.remove(id);
  return { ...publicProviderStatus(id), removed };
}

export function seedOAuthForTests(
  provider: string,
  credentials: { access: string; refresh: string; expires: number; projectId?: string },
) {
  store.setOAuth(requireKnown(provider), credentials);
}

/**
 * 전송에 넘길 요청 시점 자격. 만료됐으면 먼저 갱신한다 —
 * `packRequestApiKey` 는 만료 자격을 의도적으로 거절하므로 이 순서가 계약이다.
 */
export async function resolveRequestApiKey(provider: string): Promise<string | undefined> {
  const id = requireKnown(provider);
  const envVars = getOhMyPiProvider(id)?.envVars ?? [];
  for (const name of envVars) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  let credentials = credentialsOf(id);
  if (!credentials) {
    adoptCodexCliCredentials(id);
    credentials = credentialsOf(id);
  }
  if (!credentials) return undefined;
  if (Date.now() >= credentials.expires) {
    await refreshProvider(id);
    credentials = credentialsOf(id);
    if (!credentials) return undefined;
  }
  return packRequestApiKey(id, credentials);
}

export const AUTH_STORE_PATH = defaultOhMyPiAuthPath();
