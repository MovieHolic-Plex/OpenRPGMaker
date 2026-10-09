import { DEFAULT_CHATGPT_BASE_URL } from "@/ai/llmClient";
import { companionToken, companionTokenHeaders } from "@/ai/companionToken";
import {
  DEFAULT_OH_MY_PI_PROVIDER,
  parseOhMyPiProvider,
  type OhMyPiAuthKind,
} from "@/ai/ohMyPiProviders";

const DEFAULT_ORIGINLESS_COMPANION = DEFAULT_CHATGPT_BASE_URL.replace(/\/v1\/?$/u, "");

/** 일렉트론은 페이지 출처가 app:// 라 루프백 동반 서비스 출처를 브리지에서 받는다(설계 7.4). */
function companionOrigin(): string {
  if (typeof window !== "undefined" && window.oprn?.companionOrigin) return window.oprn.companionOrigin;
  return DEFAULT_ORIGINLESS_COMPANION;
}


/** Authentication only: streaming agent calls keep their own cancellation and timeout. */
export function companionAuthHeaders(initial: HeadersInit = {}): Headers {
  const headers = new Headers(initial);
  const token = companionToken();
  if (token) headers.set("x-oprn-companion-token", token);
  return headers;
}

export function companionAuthUrl(path: string, providerId?: string): string {
  const provider = parseOhMyPiProvider(providerId, DEFAULT_OH_MY_PI_PROVIDER);
  const query = new URLSearchParams({ provider });
  return `${companionOrigin()}${path}?${query.toString()}`;
}

/**
 * 동반 서비스가 알려주는 자격 증명 상태.
 *
 * 예전에는 `connected`/`planType` 만 받고 나머지를 버려서, 브라우저가 "자격이 없다"와
 * "셸 환경 변수만 있다"와 "만료됐다"를 구분할 수 없었다. 서버는 처음부터
 * `{connected, authKind, expired, env}` 를 준다(`ohMyPiPiAiRuntime.publicProviderStatus`).
 */
export interface ChatGptAuthStatus {
  readonly connected: boolean;
  readonly planType?: string;
  /** 저장된 자격의 종류. 제공자 레지스트리의 authKind 와 다를 수 있다(oauth 제공자에 키가 저장된 경우). */
  readonly authKind?: OhMyPiAuthKind;
  /** OAuth 토큰이 만료됐는가. */
  readonly expired?: boolean;
  /** 자격의 출처가 셸 환경 변수인가 — 에디터가 만들지도, 지우지도 못하는 자격이다. */
  readonly env?: boolean;
  /** 환경 변수 스캔 동의. ask 이면 아직 고르지 않았다. */
  readonly envScan?: "ask" | "allow" | "deny";
  readonly lastLoginError?: string;
  readonly pendingLogin?: CompanionLoginStart;
}

/**
 * 요청에 쓸 수 있는 자격인가. 저장된 로그인과, 사용자가 동의한 뒤 찾은 환경 변수 키를 포함한다.
 * 환경 변수는 에디터가 지우지 못하므로 연결 해제 버튼은 `hasStoredCompanionCredential` 만 본다.
 */
export function hasUsableCompanionCredential(status: ChatGptAuthStatus): boolean {
  return status.connected && status.expired !== true;
}

/** 에디터가 지울 수 있는 저장 자격. 환경 변수만 있으면 false. */
export function hasStoredCompanionCredential(status: ChatGptAuthStatus): boolean {
  return hasUsableCompanionCredential(status) && status.env !== true;
}

/** 동반 서비스가 미연결/만료를 말하면 로그인이 필요하다. 서비스에 닿지 못한 경우는 false — 전송 오류 경로가 담당한다. */
export async function companionCredentialMissing(providerId?: string): Promise<boolean> {
  try {
    return !hasUsableCompanionCredential(await fetchChatGptAuthStatus(providerId));
  } catch {
    return false;
  }
}

export interface ChatGptLoginStart {
  readonly verificationUrl: string;
  readonly userCode: string;
}

/**
 * 로컬 연결 서비스(companion)가 응답은 했지만 실패(4xx/5xx)한 경우의 오류 — 경우 (B).
 * 라우트는 살아 있고 그 안에서 깨진 것이다(예: codex 자식 프로세스가 초기화 중 종료).
 * 서버에 아예 닿지 못한 경우 — 경우 (A), fetch 가 TypeError 를 던짐 — 와 클래스를 분리해
 * 호출자가 안내 문구를 갈라 쓸 수 있게 한다:
 * - ChatGptCompanionUnreachableError (A) → 동반 서비스가 켜져 있지 않음. npm run ai:oauth 가 해결책.
 * - ChatGptCompanionResponseError    (B) → 동반 서비스가 응답했지만 내부 오류. serverMessage 가 원인.
 */
export class ChatGptCompanionResponseError extends Error {
  readonly httpStatus: number;
  /** 응답 본문 JSON 의 `error` 필드. dev 플러그인(vite.config.ts)과 단독 동반 서비스
   * (scripts/chatgpt-oauth-companion.mjs) 모두 실패 시 { error: string } 으로 응답한다. */
  readonly serverMessage?: string;
  constructor(httpStatus: number, serverMessage?: string) {
    super(serverMessage ?? `OAuth companion responded with ${httpStatus}`);
    this.name = "ChatGptCompanionResponseError";
    this.httpStatus = httpStatus;
    this.serverMessage = serverMessage;
  }
}

/**
 * 서버에 아예 닿지 못한 경우 — 경우 (A). 동반 서비스가 없다는 뜻.
 *
 * 세 가지가 여기로 모인다. 사용자에게는 모두 "보조 프로그램이 응답하지 않는다"이므로 같은
 * 클래스로 두고, 원인은 `reason` 으로 구분해 진단 문구만 갈라 쓴다.
 * - `network`: fetch 가 던졌다(연결 거부).
 * - `timeout`: 소켓은 잡혔지만 응답이 없다. **타임아웃이 없던 동안 상태 칩이 "확인 중"에서
 *   영구히 멈췄고, 재시도 가드까지 풀리지 않아 우클릭 새로고침도 무력했다.**
 * - `not-mounted`: 2xx 인데 JSON 이 아니다 — vite SPA 폴백이 에디터 HTML 을 준 것이므로
 *   그 경로가 등록되지 않았다는 뜻이다(죽은 `/api/cliproxy` 가 "사용 가능"으로 보였던 것과 같은 함정).
 */
export type CompanionUnreachableReason = "network" | "timeout" | "not-mounted";

export class ChatGptCompanionUnreachableError extends Error {
  readonly reason: CompanionUnreachableReason;
  constructor(cause?: unknown, reason: CompanionUnreachableReason = "network") {
    super("OAuth companion is unreachable", { cause });
    this.name = "ChatGptCompanionUnreachableError";
    this.reason = reason;
  }
}

/** 오류가 "서버가 응답했지만 실패" (B) 인지 판별. 닿지 못한 경우 (A) 에는 false. */
export function isChatGptCompanionResponseError(error: unknown): error is ChatGptCompanionResponseError {
  return error instanceof ChatGptCompanionResponseError;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? Object.fromEntries(Object.entries(value)) : null;
}

/**
 * 동반 서비스 호출 타임아웃. 상태 조회는 로컬 루프백이라 정상이면 수 ms 다 — 6초를 넘기면
 * 서비스가 살아 있다고 볼 수 없다. 무한 대기는 상태 칩을 "확인 중"에 영구히 묶는다.
 */
export const COMPANION_TIMEOUT_MS = 6000;

/**
 * fetch 를 감싸 "서버에 닿지 못함" (A) 을 별도 오류로 변환한다. 응답이 도착한 경우는 그대로 반환.
 * 타임아웃을 직접 건다 — 예전에는 AbortController 가 없어 소켓만 잡히면 영원히 매달렸다.
 */
async function companionFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = typeof AbortController === "function" ? new AbortController() : undefined;
  const timer = controller && typeof setTimeout === "function"
    ? setTimeout(() => controller.abort(), COMPANION_TIMEOUT_MS)
    : undefined;
  const token = companionTokenHeaders();
  const withToken: RequestInit = Object.keys(token).length
    ? { ...init, headers: { ...(init?.headers ?? {}), ...token } }
    : (init ?? {});
  try {
    return await fetch(url, controller ? { ...withToken, signal: controller.signal } : withToken);
  } catch (error) {
    // 우리가 건 abort 는 네트워크 단절과 원인이 다르다 — 진단 문구를 갈라 쓸 수 있게 표시한다.
    throw new ChatGptCompanionUnreachableError(error, controller?.signal.aborted ? "timeout" : "network");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * 2xx 응답을 JSON 으로 읽는다. JSON 이 아니면 그 경로가 **등록되지 않은** 것이다 —
 * vite dev 서버는 미등록 경로 GET 에 SPA 폴백으로 200 text/html(에디터 index.html)을 준다(실측).
 * 이 비대칭을 걸러내지 않으면 동반 서비스가 안 켜졌는데 "응답 성공"으로 읽는다.
 */
async function readJsonBody(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers?.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new ChatGptCompanionUnreachableError(
      new Error(`companion route returned ${contentType || "no content-type"} instead of JSON`),
      "not-mounted",
    );
  }
  return objectValue(await response.json());
}

/** `/auth/status`·`/auth/refresh`·`/auth/key` 가 모두 같은 상태 모양을 준다 — 읽기를 한 곳에 모은다. */
function readAuthStatus(payload: Record<string, unknown> | null): ChatGptAuthStatus {
  const authKind = payload?.authKind;
  return {
    connected: payload?.connected === true,
    planType: typeof payload?.planType === "string" ? payload.planType : undefined,
    authKind: authKind === "oauth" || authKind === "apiKey" || authKind === "local" ? authKind : undefined,
    expired: typeof payload?.expired === "boolean" ? payload.expired : undefined,
    env: typeof payload?.env === "boolean" ? payload.env : undefined,
    envScan: payload?.envScan === "allow" || payload?.envScan === "deny" || payload?.envScan === "ask"
      ? payload.envScan
      : undefined,
    lastLoginError: typeof payload?.lastLoginError === "string" ? payload.lastLoginError : undefined,
    pendingLogin: readLoginStart(objectValue(payload?.pendingLogin)),
  };
}

export async function setCompanionEnvScan(decision: "allow" | "deny", providerId?: string): Promise<ChatGptAuthStatus> {
  const response = await companionFetch(companionAuthUrl("/auth/env-scan", providerId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
  return readAuthStatus(await readJsonBody(response));
}

/** 실패 응답 본문의 `error` 필드를 읽는다. 본문이 없거나 JSON 이 아니면 undefined — 원인을 못 읽어도 (B) 는 (B) 다. */
async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const payload = objectValue(await response.json());
    return typeof payload?.error === "string" && payload.error.trim() ? payload.error : undefined;
  } catch {
    return undefined;
  }
}

export interface CompanionLoginStart extends ChatGptLoginStart {
  readonly needsApiKey?: boolean;
  readonly instructions?: string;
  readonly connected?: boolean;
  /** 루프백 OAuth 를 원격 origin 으로 연 경우, 돌아온 localhost 콜백 URL 을 붙여넣어야 한다. */
  readonly pasteCallback?: boolean;
  readonly startedAt?: number;
  readonly expiresAt?: number;
}

function readLoginStart(payload: Record<string, unknown> | null): CompanionLoginStart | undefined {
  if (!payload || typeof payload.verificationUrl !== "string" || !payload.verificationUrl) return undefined;
  return {
    verificationUrl: payload.verificationUrl,
    userCode: typeof payload.userCode === "string" ? payload.userCode : "",
    instructions: typeof payload.instructions === "string" ? payload.instructions : undefined,
    needsApiKey: payload.needsApiKey === true,
    connected: payload.connected === true,
    pasteCallback: payload.pasteCallback === true,
    startedAt: typeof payload.startedAt === "number" ? payload.startedAt : undefined,
    expiresAt: typeof payload.expiresAt === "number" ? payload.expiresAt : undefined,
  };
}

export async function cancelCompanionLogin(providerId: string): Promise<ChatGptAuthStatus> {
  const response = await companionFetch(companionAuthUrl("/auth/login-cancel", providerId), { method: "POST" });
  if (!response.ok) throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  return readAuthStatus(await readJsonBody(response));
}

/** 동반 서비스가 실제로 아는 제공자 한 줄. `/auth/providers` 응답 모양이다. */
export interface CompanionProvider {
  readonly id: string;
  readonly label: string;
  readonly authKind: OhMyPiAuthKind;
  readonly defaultModel: string;
  readonly hasLogin: boolean;
  readonly hasRefresh: boolean;
}

/**
 * 동반 서비스가 아는 제공자 목록. 서버는 처음부터 이걸 주는데 브라우저 클라이언트가 없어서
 * UI 는 정적 레지스트리(`OH_MY_PI_PROVIDERS`)만 보고 있었다 — 둘이 어긋나면 알 방법이 없었다.
 * 레지스트리를 대체하지는 않는다(오프라인에서도 목록은 보여야 한다). 어긋남 진단용이다.
 */
export async function fetchCompanionProviders(): Promise<readonly CompanionProvider[]> {
  const response = await companionFetch(`${companionOrigin()}/auth/providers`);
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
  const payload = await readJsonBody(response);
  const rows = Array.isArray(payload?.providers) ? payload.providers : [];
  return rows.flatMap((row): readonly CompanionProvider[] => {
    const item = objectValue(row);
    const id = typeof item?.id === "string" ? item.id : "";
    if (!id) return [];
    const authKind = item?.authKind;
    return [{
      id,
      label: typeof item?.label === "string" ? item.label : id,
      authKind: authKind === "oauth" || authKind === "local" ? authKind : "apiKey",
      defaultModel: typeof item?.defaultModel === "string" ? item.defaultModel : "",
      hasLogin: item?.hasLogin === true,
      hasRefresh: item?.hasRefresh === true,
    }];
  });
}

export async function fetchChatGptAuthStatus(providerId?: string): Promise<ChatGptAuthStatus> {
  const response = await companionFetch(companionAuthUrl("/auth/status", providerId));
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
  return readAuthStatus(await readJsonBody(response));
}

export async function startChatGptLogin(providerId?: string, apiKey?: string): Promise<CompanionLoginStart> {
  const provider = parseOhMyPiProvider(providerId, DEFAULT_OH_MY_PI_PROVIDER);
  const response = await companionFetch(companionAuthUrl("/auth/login", provider), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey: apiKey?.trim() || undefined }),
  });
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
  const payload = await readJsonBody(response);
  const verificationUrl = typeof payload?.verificationUrl === "string" ? payload.verificationUrl : "";
  const userCode = typeof payload?.userCode === "string" ? payload.userCode : "";
  if (!verificationUrl && payload?.needsApiKey !== true && payload?.connected !== true) {
    throw new Error("OAuth companion returned an invalid login response");
  }
  return {
    verificationUrl,
    userCode,
    needsApiKey: payload?.needsApiKey === true,
    instructions: typeof payload?.instructions === "string" ? payload.instructions : undefined,
    connected: payload?.connected === true,
    pasteCallback: payload?.pasteCallback === true,
    startedAt: typeof payload?.startedAt === "number" ? payload.startedAt : undefined,
    expiresAt: typeof payload?.expiresAt === "number" ? payload.expiresAt : undefined,
  };
}

export async function completeOAuthPaste(callbackUrl: string): Promise<void> {
  const response = await companionFetch(companionAuthUrl("/auth/oauth-paste"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: callbackUrl }),
  });
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
}

export async function refreshCompanionAuth(providerId?: string): Promise<ChatGptAuthStatus> {
  const provider = parseOhMyPiProvider(providerId, DEFAULT_OH_MY_PI_PROVIDER);
  const response = await companionFetch(companionAuthUrl("/auth/refresh", provider), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
  return readAuthStatus(await readJsonBody(response));
}

export async function saveCompanionApiKey(providerId: string, apiKey: string): Promise<ChatGptAuthStatus> {
  const provider = parseOhMyPiProvider(providerId, DEFAULT_OH_MY_PI_PROVIDER);
  const response = await companionFetch(companionAuthUrl("/auth/key", provider), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey }),
  });
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
  return readAuthStatus(await readJsonBody(response));
}

/**
 * 연결 해제 — 동반 서비스가 보관하는 자격을 지운다.
 *
 * 이 경로가 없던 동안에는 잘못 저장한 키를 지울 방법이 없었다. 화면은 계속 "연결됨"이라 말하는데
 * 모든 턴이 401 이 되는 상태였다. 서버는 삭제 후의 상태를 `/auth/status` 와 같은 모양으로 준다.
 */
export async function disconnectCompanionAuth(providerId?: string): Promise<ChatGptAuthStatus> {
  const provider = parseOhMyPiProvider(providerId, DEFAULT_OH_MY_PI_PROVIDER);
  const response = await companionFetch(companionAuthUrl("/auth/logout", provider), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
  return readAuthStatus(await readJsonBody(response));
}
