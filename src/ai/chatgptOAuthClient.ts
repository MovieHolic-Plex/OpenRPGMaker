import { DEFAULT_CHATGPT_BASE_URL } from "@/ai/llmClient";
import { DEFAULT_OH_MY_PI_PROVIDER, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";

const companionOrigin = DEFAULT_CHATGPT_BASE_URL.replace(/\/v1\/?$/u, "");

export function companionAuthUrl(path: string, providerId?: string): string {
  const provider = parseOhMyPiProvider(providerId, DEFAULT_OH_MY_PI_PROVIDER);
  const query = new URLSearchParams({ provider });
  return `${companionOrigin}${path}?${query.toString()}`;
}

export interface ChatGptAuthStatus {
  readonly connected: boolean;
  readonly planType?: string;
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

/** 서버에 아예 닿지 못한 경우(네트워크 오류/연결 거부)의 오류 — 경우 (A). 동반 서비스가 없다는 뜻. */
export class ChatGptCompanionUnreachableError extends Error {
  constructor(cause?: unknown) {
    super("OAuth companion is unreachable", { cause });
    this.name = "ChatGptCompanionUnreachableError";
  }
}

/** 오류가 "서버가 응답했지만 실패" (B) 인지 판별. 닿지 못한 경우 (A) 에는 false. */
export function isChatGptCompanionResponseError(error: unknown): error is ChatGptCompanionResponseError {
  return error instanceof ChatGptCompanionResponseError;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? Object.fromEntries(Object.entries(value)) : null;
}

/** fetch 를 감싸 "서버에 닿지 못함" (A) 을 별도 오류로 변환한다. 응답이 도착한 경우는 그대로 반환. */
async function companionFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new ChatGptCompanionUnreachableError(error);
  }
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
}

export async function fetchChatGptAuthStatus(providerId?: string): Promise<ChatGptAuthStatus> {
  const response = await companionFetch(companionAuthUrl("/auth/status", providerId));
  if (!response.ok) {
    throw new ChatGptCompanionResponseError(response.status, await readErrorBody(response));
  }
  const payload = objectValue(await response.json());
  return {
    connected: payload?.connected === true,
    planType: typeof payload?.planType === "string" ? payload.planType : undefined,
  };
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
  const payload = objectValue(await response.json());
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
  };
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
  const payload = objectValue(await response.json());
  return {
    connected: payload?.connected === true,
    planType: typeof payload?.planType === "string" ? payload.planType : undefined,
  };
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
  const payload = objectValue(await response.json());
  return {
    connected: payload?.connected === true,
    planType: typeof payload?.planType === "string" ? payload.planType : undefined,
  };
}
