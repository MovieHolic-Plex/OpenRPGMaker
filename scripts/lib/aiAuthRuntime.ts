// 제공자 인증 런타임 — 로그인·갱신·상태·요청 자격을 이 저장소 코드로 처리한다.
//
// 불변식 1: 순수 Node 에서 돈다. 와이어 구현은 src/ai/oauth/* 의 fetch 전용 모듈이고,
//           Bun 은 완성(completion) 전송에만 필요하다. 인증 경로가 Bun 을 요구하면
//           Bun 없는 머신에서 /auth/* 전체가 HTTP 500 이 된다.
// 불변식 2: 비밀은 로컬 OMP/companion 저장소에만 있고 브라우저로 나가지 않는다.
//
// 기본 로그인 원본은 OMP의 ~/.omp/agent/agent.db 이며, companion 캐시는
// ~/.oprn/oh-my-pi-auth.json 이다. 둘 다 로컬에만 있고 브라우저로 나가지 않는다.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
import { applyLegacyEnvAliases } from "./oprnEnv.mjs";
import { configureOAuthClients } from "../../src/ai/oauth/clientConfig.ts";
import { readOAuthClientsFromPiAi } from "./oauthClients.mjs";

applyLegacyEnvAliases();
// 남의 앱 OAuth 클라이언트 값은 저장소에 없다 — 설치된 참조 구현에서 읽는다(환경변수가 있으면 그것이 이긴다).
configureOAuthClients(readOAuthClientsFromPiAi());

const store = createOhMyPiAuthStore(defaultOhMyPiAuthPath());

/** Antigravity 는 projectId 없이는 요청이 불가능하므로 상태 판정에 그것까지 본다. */
const PROJECT_SCOPED_PROVIDERS = new Set<string>([ANTIGRAVITY_PROVIDER_ID]);
const OMP_PROBE_TTL_MS = 2_000;

/**
 * 프로브 스크립트 경로. **호출 시점에** 푼다.
 *
 * 왜 지연인가: esbuild 가 Electron 메인을 CJS 로 번들하면 `import.meta.url` 이 빈 값이 된다
 * (`"import.meta" is not available with the "cjs" output format`). 모듈 로드 시점에
 * `new URL(..., import.meta.url)` 을 평가하면 **앱이 창을 띄우기도 전에 죽는다** —
 * 2026-09-22 실측: 패키징 AppImage 가 `TypeError: Invalid URL` 로 시작 실패했다.
 * 지연 평가면 이 값을 쓰지 않는 경로(대부분의 실행)가 영향을 받지 않는다.
 */
function ompAuthProbeScript(): string {
  return process.env.OPRN_OMP_AUTH_PROBE_SCRIPT || fileURLToPath(new URL("./omp-auth-probe.mjs", import.meta.url));
}

type OmpProbeResult = {
  available: boolean;
  credentials?: PortedOAuthCredentials;
};

const ompProbeCache = new Map<string, { checkedAt: number; result: OmpProbeResult }>();

function testStub(): boolean {
  return process.env.OPRN_OH_MY_PI_TEST_STUB === "1";
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

function shouldProbeOmpAuth(): boolean {
  // Tests and explicitly isolated auth paths must never read a user's global
  // OMP database. Production's default store is opt-in to the shared login.
  return !testStub()
    && !process.env.OPRN_OH_MY_PI_AUTH_PATH
    && process.env.OPRN_DISABLE_OMP_AUTH_REUSE !== "1";
}

function ompCommand(): string {
  const configured = process.env.OPRN_BUN_PATH?.trim();
  if (configured) return configured;
  const local = join(homedir(), ".bun", "bin", "bun");
  return existsSync(local) ? local : "bun";
}

/**
 * Read OMP's own AuthStorage through a tiny Bun boundary. The editor's Node
 * auth owner must not import bun:sqlite, but it can safely receive the JSON
 * result over a private child-process pipe. No probe error is surfaced as an
 * auth failure: the editor's own store remains a valid fallback.
 */
function probeOmpAuth(provider: string): OmpProbeResult {
  if (!shouldProbeOmpAuth()) return { available: false };
  const now = Date.now();
  const cached = ompProbeCache.get(provider);
  if (cached && now - cached.checkedAt < OMP_PROBE_TTL_MS) return cached.result;

  let result: OmpProbeResult = { available: false };
  try {
    const output = execFileSync(ompCommand(), [ompAuthProbeScript(), provider], {
      cwd: process.cwd(),
      env: { ...process.env },
      encoding: "utf8",
      timeout: 3_000,
      maxBuffer: 256 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const line = String(output).trim().split(/\r?\n/u).filter(Boolean).pop();
    const parsed = line ? JSON.parse(line) as { available?: unknown; credentials?: unknown } : undefined;
    const raw = parsed?.credentials;
    if (parsed?.available === true && raw && typeof raw === "object" && !Array.isArray(raw)) {
      const candidate = raw as Record<string, unknown>;
      const access = typeof candidate.access === "string" ? candidate.access : "";
      const refresh = typeof candidate.refresh === "string" ? candidate.refresh : "";
      const expires = Number(candidate.expires) || 0;
      if (access && refresh && expires > 0) {
        result = {
          available: true,
          credentials: {
            access,
            refresh,
            expires,
            projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined,
            email: typeof candidate.email === "string" ? candidate.email : undefined,
            accountId: typeof candidate.accountId === "string" ? candidate.accountId : undefined,
            apiEndpoint: typeof candidate.apiEndpoint === "string" ? candidate.apiEndpoint : undefined,
            enterpriseUrl: typeof candidate.enterpriseUrl === "string" ? candidate.enterpriseUrl : undefined,
            orgId: typeof candidate.orgId === "string" ? candidate.orgId : undefined,
            orgName: typeof candidate.orgName === "string" ? candidate.orgName : undefined,
            authorizedAt: Number(candidate.authorizedAt) || undefined,
          },
        };
      } else {
        result = { available: true };
      }
    } else if (parsed?.available === true) {
      result = { available: true };
    }
  } catch {
    // Bun is optional for the status/login surface. Keep the custom store
    // authoritative when the OMP probe cannot run.
  }
  ompProbeCache.set(provider, { checkedAt: now, result });
  return result;
}

function isUsableCredentials(provider: string, credentials: PortedOAuthCredentials | undefined): boolean {
  return Boolean(
    credentials?.access
      && credentials.refresh
      && credentials.expires > Date.now()
      && (!PROJECT_SCOPED_PROVIDERS.has(provider) || credentials.projectId),
  );
}

function shouldReplaceImportedCredentials(provider: string, current: PortedOAuthCredentials | undefined, external: PortedOAuthCredentials): boolean {
  if (!current) return true;
  if (!isUsableCredentials(provider, current)) return true;
  // OMP normally refreshes by extending the expiry. Do not overwrite a fresh
  // local refresh with an older SQLite snapshot.
  return external.expires > current.expires;
}

/** Adopt OMP's existing login into the companion cache without opening OAuth. */
function adoptOmpCliCredentials(provider: string): boolean {
  if (!shouldProbeOmpAuth() || store.adoptionDeclined(provider)) return false;
  const currentRow = store.get(provider);
  const current = credentialsOf(provider);
  const probe = probeOmpAuth(provider);

  if (!probe.available) return false;
  if (!probe.credentials) {
    // If this row came from OMP and OMP no longer has it (logout), do not keep
    // presenting a stale editor connection. A manual editor disconnect uses
    // store.remove(), which records declined and remains authoritative.
    if (currentRow?.source === "omp") store.clear(provider);
    return false;
  }
  if (!current || currentRow?.source === "omp" || !isUsableCredentials(provider, current)) {
    if (shouldReplaceImportedCredentials(provider, current, probe.credentials)) {
      store.setOAuth(provider, probe.credentials, { source: "omp" });
      return true;
    }
  }
  return false;
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

function envScanDecision(): "ask" | "allow" | "deny" {
  const value = store.envScan();
  return value === "allow" || value === "deny" ? value : "ask";
}

export function setEnvScanDecision(decision: "allow" | "deny"): "allow" | "deny" {
  return store.setEnvScan(decision);
}

export function publicProviderStatus(provider: string) {
  // HTTP 경계에서 들어온 이름이므로 여기서 막는다. 모를 제공자를 `connected:false` 로
  // 답하면 사용자는 "여기 로그인하면 된다"고 오해하게 된다 — 지원하지 않는 것이다.
  requireKnown(provider);
  const envScan = envScanDecision();
  // 동의(allow) 전에는 process.env 를 보지 않는다. deny 도 마찬가지다.
  const envVars = envScan === "allow" ? (getOhMyPiProvider(provider)?.envVars ?? []) : [];
  const envHit = envVars.some((name) => Boolean(process.env[name]?.trim()));
  adoptOmpCliCredentials(provider);
  if (!store.has(provider)) adoptCodexCliCredentials(provider);
  const disk = store.publicStatus(provider);
  const row = store.get(provider);
  const hasRequiredMetadata = !PROJECT_SCOPED_PROVIDERS.has(provider)
    || row?.kind !== "oauth"
    || Boolean(row.projectId);
  let pending = pendingLogins.get(provider);
  if (pending?.login && !pending.error && pending.login.expiresAt <= Date.now()) {
    cancelProviderLogin(provider);
    pending = undefined;
  }
  const extra = pending?.error ? { lastLoginError: pending.error }
    : pending?.login ? { pendingLogin: pending.login } : {};
  if (disk.connected && !hasRequiredMetadata) {
    return { ...disk, ...extra, connected: false, provider, env: false, envScan };
  }
  if (disk.connected || envHit) {
    return { ...disk, ...extra, connected: true, provider, env: envHit, envScan };
  }
  return { connected: false, provider, ...extra, envScan };
}

/**
 * 승인 대기 중인 로그인. `/auth/login` 은 사용자에게 보여줄 URL·코드를 즉시 반환하고
 * 승인 대기는 백그라운드에서 계속되므로, 실패는 다음 `/auth/status` 의 `lastLoginError` 로만
 * 관측된다.
 */
type PendingLogin = {
  verificationUrl: string;
  userCode: string;
  instructions?: string;
  startedAt: number;
  expiresAt: number;
};
const pendingLogins = new Map<string, { promise: Promise<void>; error?: string; abort: AbortController; login: PendingLogin }>();
const startingLogins = new Map<string, AbortController>();

function trackLogin(provider: string, abort: AbortController, work: Promise<PortedOAuthCredentials>, login: PendingLogin) {
  const entry: { promise: Promise<void>; error?: string; abort: AbortController; login: PendingLogin } = {
    abort,
    login,
    promise: work
      .then((credentials) => {
        if (abort.signal.aborted || pendingLogins.get(provider) !== entry) return;
        store.setOAuth(provider, credentials);
        pendingLogins.delete(provider);
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted || pendingLogins.get(provider) !== entry) return;
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
  const starting = startingLogins.get(provider);
  if (!pending && !starting) return false;
  starting?.abort(new Error("login canceled"));
  pending?.abort.abort(new Error("login canceled"));
  startingLogins.delete(provider);
  pendingLogins.delete(provider);
  return true;
}

/**
 * `remote` = 편집기를 공개 주소로(다른 기기에서) 열었다. Codex 는 코드 입력 방식으로 바로 간다.
 * Antigravity 는 루프백 redirect 만 허용돼 원격에서도 흐름이 같다(붙여넣기는 편집기가 안내).
 */
export async function startProviderLogin(
  provider: string,
  _body: { apiKey?: string } = {},
  options: { remote?: boolean } = {},
) {
  const id = requireKnown(provider);
  cancelProviderLogin(id);
  const abort = new AbortController();
  startingLogins.set(id, abort);
  try {
    return await launchProviderLogin(id, options, abort);
  } finally {
    if (startingLogins.get(id) === abort) startingLogins.delete(id);
  }
}

async function launchProviderLogin(id: string, options: { remote?: boolean }, abort: AbortController) {
  if (testStub()) {
    return {
      connected: false,
      provider: id,
      verificationUrl: `https://oauth.example.test/${id}`,
      userCode: "TEST-OK",
    };
  }

  const startedAt = Date.now();
  const expiresAt = startedAt + 10 * 60 * 1000;
  const loginFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
    globalThis.fetch(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([abort.signal, init.signal]) : abort.signal,
    });
  if (id === CODEX_PROVIDER_ID) {
    const started = await beginCodexLogin({
      openCallbackServer: (options) => startOAuthCallbackServer(options),
      startDeviceAuthorization: () => startCodexDeviceAuthorization({ fetch: loginFetch }),
      remote: options.remote === true,
      signal: abort.signal,
    });
    if (abort.signal.aborted) {
      if (started.mode === "browser") void started.waitForCode.catch(() => undefined);
      throw abort.signal.reason;
    }
    const login = {
      verificationUrl: started.verificationUrl, userCode: started.userCode,
      instructions: started.instructions, startedAt, expiresAt,
    };
    if (started.mode === "browser") {
      trackLogin(id, abort, (async () => {
        const { code } = await started.waitForCode;
        return exchangeCodexAuthorizationCode({
          code,
          codeVerifier: started.codeVerifier,
          redirectUri: started.redirectUri,
          fetch: loginFetch,
        });
      })(), login);
    } else {
      trackLogin(id, abort, pollCodexDeviceAuthorization({ ...started.device, signal: abort.signal, fetch: loginFetch }), login);
    }
    return {
      connected: false,
      provider: id,
      verificationUrl: started.verificationUrl,
      userCode: started.userCode,
      instructions: started.instructions,
      startedAt,
      expiresAt,
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
  if (abort.signal.aborted) {
    void handle.waitForCode.catch(() => undefined);
    throw abort.signal.reason;
  }
  const login = {
    verificationUrl: buildAntigravityAuthorizationUrl({ state, redirectUri: handle.redirectUri }),
    userCode: "", instructions: "브라우저에서 Google 계정으로 로그인하세요.", startedAt, expiresAt,
  };
  trackLogin(id, abort, (async () => {
    const { code } = await handle.waitForCode;
    const exchanged = await exchangeAntigravityCode({ code, redirectUri: handle.redirectUri, fetch: loginFetch });
    abort.signal.throwIfAborted();
    const projectId = await discoverAntigravityProject({ accessToken: exchanged.access, fetch: loginFetch });
    return { ...exchanged, projectId };
  })(), login);
  return {
    connected: false,
    provider: id,
    ...login,
  };
}

/** 갱신 호출 본체. 호출자는 반드시 `refreshSingleFlight` 를 거친다. */
async function refreshProviderNow(id: PortedOAuthProviderId) {
  adoptOmpCliCredentials(id);
  const credentials = credentialsOf(id);
  if (!credentials) return publicProviderStatus(id);
  if (testStub()) {
    // 대기 한 번: 동시 호출이 실제로 겹치게 해서 single-flight 를 시험할 수 있게 한다.
    await new Promise((resolve) => setTimeout(resolve, 10));
    refreshStats.attempts += 1;
    if (process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL === "1") throw new Error("stub refresh failed");
    store.setOAuth(id, { ...credentials, access: "stub-refreshed", expires: Date.now() + 60_000 });
    return { ...publicProviderStatus(id), refreshed: true };
  }
  refreshStats.attempts += 1;
  const refreshed = id === CODEX_PROVIDER_ID
    ? await refreshCodexToken({ refreshToken: credentials.refresh })
    : await refreshAntigravityToken({
        refreshToken: credentials.refresh,
        projectId: credentials.projectId ?? "",
      });
  // 저장본 위에 병합한다: 갱신 응답은 orgId/projectId 같은 로그인 시점 메타데이터를 담지 않는다.
  store.setOAuth(id, { ...credentials, ...refreshed }, {
    ...(store.get(id)?.source === "omp" ? { source: "omp" } : {}),
  });
  return { ...publicProviderStatus(id), refreshed: true };
}

/**
 * 제공자별 갱신은 한 번에 하나만 돈다. Codex 는 refresh_token 을 회전시키므로 상태 폴링·요청·
 * 수동 갱신이 겹쳐 두 번 쏘면 뒤쪽이 소모된 토큰으로 invalid_grant 를 받아 멀쩡한 로그인을 깬다.
 */
const inflightRefresh = new Map<string, Promise<ReturnType<typeof publicProviderStatus> & { refreshed?: boolean }>>();
/** 자동(상태 조회발) 갱신 실패 기록 — 다음 자동 시도는 retryAt 이후에만 한다. */
const refreshFailures = new Map<string, { count: number; retryAt: number; error: string }>();
const refreshStats = { attempts: 0 };
export const AUTO_REFRESH_BACKOFF_BASE_MS = 30_000;
export const AUTO_REFRESH_BACKOFF_MAX_MS = 10 * 60_000;
/** 상태 응답이 기다리는 최대 시간. 브라우저 상태 요청 제한(COMPANION_TIMEOUT_MS 6초)보다 짧아야 한다. */
const STATUS_REFRESH_WAIT_MS = 4_000;

function refreshSingleFlight(id: PortedOAuthProviderId) {
  const existing = inflightRefresh.get(id);
  if (existing) return existing;
  const work = refreshProviderNow(id)
    .then((result) => {
      refreshFailures.delete(id);
      return result;
    }, (error: unknown) => {
      const count = (refreshFailures.get(id)?.count ?? 0) + 1;
      const delay = Math.min(AUTO_REFRESH_BACKOFF_BASE_MS * 2 ** (count - 1), AUTO_REFRESH_BACKOFF_MAX_MS);
      refreshFailures.set(id, { count, retryAt: Date.now() + delay, error: error instanceof Error ? error.message : String(error) });
      throw error;
    })
    .finally(() => inflightRefresh.delete(id));
  inflightRefresh.set(id, work);
  return work;
}

/** 수동 갱신(`POST /auth/refresh`)과 요청 경로. 자동 갱신의 백오프는 무시하되 진행 중인 갱신에는 합류한다. */
export async function refreshProvider(provider: string) {
  return refreshSingleFlight(requireKnown(provider));
}

/** 만료됐지만 갱신 토큰이 있어 사용자 조작 없이 되살릴 수 있는 저장본인가. */
function canAutoRefresh(id: PortedOAuthProviderId): boolean {
  if (pendingLogins.has(id)) return false;
  const credentials = credentialsOf(id);
  return Boolean(
    credentials?.refresh
      && Date.now() >= credentials.expires
      && (!PROJECT_SCOPED_PROVIDERS.has(id) || credentials.projectId),
  );
}

/**
 * `GET /auth/status`. 저장본이 만료됐어도 갱신 토큰이 있으면 먼저 갱신을 시도한다 —
 * 예전엔 `expires` 가 지나면 곧바로 connected:false 라 에디터가 「로그인 필요」를 띄웠고,
 * 누군가 `/auth/refresh` 를 누를 때까지 그 상태가 이어졌다(9888, 2026-09-23).
 * 제공자를 두드리지 않도록 갱신은 single-flight, 실패하면 지수 백오프(30초→10분) 동안은 다시 시도하지 않는다.
 */
export async function providerStatus(provider: string) {
  const id = requireKnown(provider);
  const status = publicProviderStatus(id);
  if (status.connected || !canAutoRefresh(id)) return status;
  const failure = refreshFailures.get(id);
  if (failure && Date.now() < failure.retryAt) {
    return { ...status, refreshError: failure.error, refreshRetryAt: failure.retryAt };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"pending">((resolve) => { timer = setTimeout(() => resolve("pending"), STATUS_REFRESH_WAIT_MS); });
  try {
    const outcome = await Promise.race([refreshSingleFlight(id), timedOut]);
    // 늦는 갱신은 뒤에서 계속 돈다. 다음 폴링이 결과를 본다.
    if (outcome === "pending") return { ...publicProviderStatus(id), refreshing: true };
    return publicProviderStatus(id);
  } catch (error) {
    return { ...publicProviderStatus(id), refreshError: error instanceof Error ? error.message : String(error) };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function authRefreshStatsForTests() {
  return { attempts: refreshStats.attempts, inflight: inflightRefresh.size, failures: Object.fromEntries(refreshFailures) };
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
/**
 * 요청 키로 내줄 OAuth 토큰의 최소 남은 수명. Pi 실행은 시작 때 한 번 푼 키를 워커에 고정 문자열로 넘겨 실행 내내 쓴다 —
 * 만료 직전 토큰을 그대로 주면 실행 도중 pi-ai 가 「OAuth token expired before request」로 턴 전체를 실패시킨다
 * (2026-09-24 추리 도그푸딩: 새 프로젝트 첫 생성이 0:56 에 실패, 직후 토큰은 다른 프로세스가 갱신해 52분 남아 있었다).
 * pi-ai 의 AuthStorage 는 60초 앞당겨 갱신하지만 이 경로는 AuthStorage 를 거치지 않는다.
 */
export const REQUEST_KEY_MIN_LIFETIME_MS = 15 * 60_000;

export async function resolveRequestApiKey(provider: string): Promise<string | undefined> {
  const id = requireKnown(provider);
  if (envScanDecision() === "allow") {
    const envVars = getOhMyPiProvider(id)?.envVars ?? [];
    for (const name of envVars) {
      const value = process.env[name]?.trim();
      if (value) return value;
    }
  }
  adoptOmpCliCredentials(id);
  let credentials = credentialsOf(id);
  if (!credentials) {
    adoptCodexCliCredentials(id);
    credentials = credentialsOf(id);
  }
  if (!credentials) return undefined;
  const expired = Date.now() >= credentials.expires;
  const expiringSoon = !expired && credentials.expires - Date.now() < REQUEST_KEY_MIN_LIFETIME_MS;
  // 조기 갱신은 실패 백오프 중이면 건너뛴다 — 아직 살아 있는 토큰으로 매 요청 제공자를 두드리지 않는다.
  const backingOff = (refreshFailures.get(id)?.retryAt ?? 0) > Date.now();
  if (expired || (expiringSoon && !backingOff)) {
    try {
      await refreshProvider(id);
    } catch (error) {
      // 아직 살아 있는 토큰이면 조기 갱신 실패로 요청을 막지 않는다 — 원래 토큰으로 진행한다.
      if (!expired && isUsableCredentials(id, credentialsOf(id))) return packRequestApiKey(id, credentialsOf(id)!);
      // 갱신실패의 흔한 원인은 refresh_token 재사용이다 — codex CLI 같은 다른 도구가 먼저 갱신하면 우리 저장본의 refresh 토큰은 이미 소모된 뒤다.
      // 그럴 때 CLI 로그인은 더 신선할 수 있으므로 채용을 시도하고, 그것도 쓸 수 없으면 원래 오류를 올린다.
      // 이 경로가 없으면 한 번 낙은 저장본 행이 검색·완성을 영구히 막는다(2026-09-21 실측).
      if (!adoptCodexCliCredentials(id)) throw error;
      const adopted = credentialsOf(id);
      if (!adopted || !isUsableCredentials(id, adopted)) throw error;
    }
    credentials = credentialsOf(id);
    if (!credentials) return undefined;
  }
  return packRequestApiKey(id, credentials);
}

export const AUTH_STORE_PATH = defaultOhMyPiAuthPath();
