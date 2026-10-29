// ai/companionConnection.ts
/**
 * 동반 서비스(/auth/*, /v1/*) 요청의 한 입구.
 *
 * 왜 필요한가(2026-10-21 사용자 신고 「한 번 오류가 난 뒤 ChatGPT 연결이 계속 실패」):
 * 브라우저 로컬 서버(oprn-serve)는 실행마다 동반 서비스 토큰과 브리지 토큰을 새로 만든다.
 * 서버가 다시 시작되면 이미 열린 페이지는 HTML 에 박힌 **옛 토큰**을 계속 실어 보내고, 모든 AI 요청이
 * 403(`companion token required`)으로 막혔다 — 새로고침 전까지 영원히.
 *
 * 그래서 모든 호출이 여기를 지난다:
 *  1. 요청마다 **지금** 토큰을 싣는다(옛 값을 붙잡지 않는다).
 *  2. 401/403 이면 연결을 한 번 다시 맺고(`window.oprn.refreshConnection`), 토큰이 바뀌었으면 같은 요청을 한 번 다시 보낸다.
 *  3. 그래도 실패하거나 경로가 404 이면 한국어 알림 하나에 「다시 연결」 단추를 띄운다. 다음 요청이 성공하면 알림을 걷는다.
 * 상태는 진행 중인 재연결 약속 하나뿐이고, 끝나면 비운다 — 실패 한 번이 다음 요청을 막지 않는다.
 */
import { companionToken } from "@/ai/companionToken";
import { dismissToastsByKey, toast } from "@/util/toast";

const TOKEN_HEADER = "x-oprn-companion-token";
const NOTICE_KEY = Symbol("companion-connection");

export interface CompanionFetchOptions {
  /** 테스트·호출자 주입용 fetch. */
  readonly fetchImpl?: typeof fetch;
  /** 이 호출에서 404 는 정상 결과다(예: 끝난 실행 이어 받기). 알림을 띄우지 않는다. */
  readonly expect404?: boolean;
}

export interface CompanionRefreshResult {
  /** 다시 맺기를 할 수 있는 환경인가(브라우저 로컬 서버). 일렉트론·vite dev 는 false. */
  readonly supported: boolean;
  /** 토큰이 바뀌었는가 — 바뀌었으면 같은 요청을 다시 보낼 가치가 있다. */
  readonly changed: boolean;
  readonly error?: string;
}

let refreshing: Promise<CompanionRefreshResult> | null = null;

/** 연결을 다시 맺는다. 동시에 여러 요청이 403 을 받아도 한 번만 맺는다. 끝나면 상태를 남기지 않는다. */
export function refreshCompanionConnection(): Promise<CompanionRefreshResult> {
  if (refreshing) return refreshing;
  const refresh = typeof window !== "undefined" ? window.oprn?.refreshConnection : undefined;
  if (typeof refresh !== "function") return Promise.resolve({ supported: false, changed: false });
  refreshing = (async () => {
    try {
      const result = await refresh();
      return { supported: true, changed: result.companionTokenChanged || result.bridgeTokenChanged };
    } catch (error) {
      return { supported: true, changed: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function routeOf(input: string): string {
  try { return new URL(input, typeof location !== "undefined" ? location.href : "http://local").pathname; }
  catch { return input.split("?")[0] ?? input; }
}

function withCurrentToken(init: RequestInit | undefined): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  const token = companionToken();
  if (token) headers.set(TOKEN_HEADER, token);
  else headers.delete(TOKEN_HEADER);
  return { ...init, headers };
}

/** 본문이 스트림이면 다시 보낼 수 없다. 문자열·바이트·FormData 는 다시 보낼 수 있다. */
function replayable(init: RequestInit | undefined): boolean {
  return !(typeof ReadableStream !== "undefined" && init?.body instanceof ReadableStream);
}

async function errorText(response: Response): Promise<string> {
  try {
    const text = await response.clone().text();
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed?.error === "string") return parsed.error;
    } catch { /* JSON 이 아니다 */ }
    return text.trim().slice(0, 160);
  } catch { return ""; }
}

export type CompanionProblemKind = "token" | "login" | "denied" | "route" | "provider-route";

export interface CompanionProblem {
  readonly kind: CompanionProblemKind;
  readonly status: number;
  readonly route: string;
  readonly detail: string;
}

/** 실패를 사람이 읽을 한 줄로. 알림과 호출자 오류 문구가 같은 말을 쓴다. */
export function describeCompanionProblem(problem: CompanionProblem): string {
  switch (problem.kind) {
    case "token":
      return `AI 연결이 끊겼습니다(${problem.status}, ${problem.route}). 로컬 서버가 다시 시작돼 연결 정보가 바뀐 것 같습니다. 「다시 연결」을 눌러 주세요.`;
    case "login":
      // 공급자 원문(영어 오류 문장)은 보이지 않는다 — 사람이 할 일만. 원문은 problem.detail 로 진단 화면에 남는다.
      return "AI 계정 로그인이 만료됐거나 취소됐어요. AI 설정에서 그 계정으로 다시 로그인해 주세요.";
    case "denied":
      return `AI 요청이 거절됐습니다(${problem.status}, ${problem.route})${problem.detail ? `: ${problem.detail}` : ""}`;
    case "route":
      return `로컬 서버에서 AI 경로 ${problem.route} 를 찾지 못했습니다(404). 서버와 편집기 판본이 다르거나 서버가 다시 시작되는 중일 수 있습니다. 「다시 연결」을 눌러 주세요.`;
    case "provider-route":
      return `AI 공급자가 ${problem.route} 요청에 404 를 돌려줬습니다${problem.detail ? `: ${problem.detail}` : ""}. 모델 이름이나 로그인을 확인한 뒤 「다시 연결」을 눌러 주세요.`;
  }
}

/**
 * 공급자가 사용자 로그인(OAuth)을 거절한 401 — 동반 서비스 토큰 문제가 아니라 다시 로그인해야 풀린다.
 * 실측(2026-10-21, ChatGPT 계정): `{"error":"Encountered invalidated oauth token for user, failing request"}` 를 「로컬 서버가 다시 시작돼…」로 잘못 안내했다.
 */
const PROVIDER_LOGIN_REJECTED = /invalidated oauth|oauth token|invalid_grant|refresh token|token (?:has )?expired|re-?authenticate|unauthenticated/iu;

function classify(status: number, route: string, detail: string, json: boolean): CompanionProblem | null {
  if ((status === 401 || status === 403) && json && PROVIDER_LOGIN_REJECTED.test(detail) && !/companion token/iu.test(detail)) {
    return { kind: "login", status, route, detail };
  }
  if (status === 401 || status === 403) {
    const kind: CompanionProblemKind = /token|origin|로그인/iu.test(detail) || status === 401 ? "token" : "denied";
    return { kind, status, route, detail };
  }
  if (status === 404) {
    // 동반 서비스가 경로를 처리했으면 JSON 오류를 준다. 정적 파일 서버의 「not found」(평문)는 서버가 그 경로를 모른다는 뜻이다.
    return { kind: json ? "provider-route" : "route", status, route, detail };
  }
  return null;
}

/** 호출자 오류 문구용 — 연결 문제(401/403/404)면 알림과 같은 한국어 문장, 아니면 null(호출자의 기존 문구를 쓴다). */
export function describeCompanionFailure(response: Response, route: string, detail: string): string | null {
  const problem = classify(response.status, route, detail, isJson(response));
  return problem ? describeCompanionProblem(problem) : null;
}

function isJson(response: Response): boolean {
  return (response.headers?.get("content-type") ?? "").includes("json");
}

let lastProblem: CompanionProblem | null = null;

/** 지금 떠 있는 연결 문제(없으면 null). 테스트·진단용. */
export function currentCompanionProblem(): CompanionProblem | null {
  return lastProblem;
}

function clearProblem(): void {
  if (!lastProblem) return;
  lastProblem = null;
  dismissToastsByKey(NOTICE_KEY);
}

function reportProblem(problem: CompanionProblem): void {
  lastProblem = problem;
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("oprn:companion-connection", { detail: problem }));
  }
  dismissToastsByKey(NOTICE_KEY);
  toast(describeCompanionProblem(problem), {
    key: NOTICE_KEY,
    kind: "error",
    durationMs: 60_000,
    action: { label: "다시 연결", testid: "companion-reconnect", onClick: () => { void reconnectFromNotice(); } },
  });
}

/** 「다시 연결」 단추. 페이지를 새로 고치지 않고 연결을 다시 맺은 뒤 상태를 한 번 확인한다. */
export async function reconnectFromNotice(): Promise<boolean> {
  const refreshed = await refreshCompanionConnection();
  // 다시 맺기를 못 하는 환경(일렉트론·vite dev)이라도 상태 확인으로 지금 연결이 사는지 본다.
  try {
    const response = await fetchCompanion(`${typeof window !== "undefined" && window.oprn?.companionOrigin ? window.oprn.companionOrigin : ""}/auth/status?provider=openai-codex`, { method: "GET" });
    if (response.ok) {
      clearProblem();
      // 상단 연결 칩(「응답 오류(403)」)도 바로 풀어 준다 — 다음 조수 요청까지 붉게 남지 않게. llmClient 가 이 모듈을 가져오므로 늦게 부른다.
      void import("@/ai/llmClient").then((llm) => llm.reportTransportHealth(true, response.status)).catch(() => undefined);
      toast(refreshed.changed ? "AI 연결을 다시 맺었습니다." : "AI 연결이 살아 있습니다.", { kind: "ok", durationMs: 2500 });
      return true;
    }
  } catch (error) {
    toast(`다시 연결하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`, { kind: "error" });
    return false;
  }
  if (refreshed.error) toast(`다시 연결하지 못했습니다: ${refreshed.error}`, { kind: "error" });
  return false;
}

/**
 * 동반 서비스에 요청한다. 토큰은 매번 지금 값으로 싣고, 401/403 이면 한 번 다시 맺어 다시 보낸다.
 * 응답은 그대로 돌려준다 — 오류 문구·재시도는 호출자의 기존 경로가 계속 맡는다. 이 함수는 연결만 책임진다.
 */
export async function fetchCompanion(input: string, init?: RequestInit, options: CompanionFetchOptions = {}): Promise<Response> {
  const doFetch = options.fetchImpl ?? fetch;
  let response = await doFetch(input, withCurrentToken(init));
  if ((response.status === 401 || response.status === 403) && replayable(init) && !init?.signal?.aborted) {
    const refreshed = await refreshCompanionConnection();
    if (refreshed.changed) {
      void response.body?.cancel().catch(() => undefined);
      response = await doFetch(input, withCurrentToken(init));
    }
  }
  // 사용 한도(429)는 연결 문제가 아니라 사용 가능 여부다 — 칩·설정 머리가 「연결됨」으로 남지 않게 전송 상태로 알린다(C-67).
  // 한도에 걸려 있던 뒤의 첫 성공은 그 표시를 걷는다. llmClient 가 이 모듈을 가져오므로 늦게 부른다.
  if (response.status === 429) {
    void import("@/ai/llmClient").then((llm) => llm.reportTransportHealth(false, 429, "사용 한도 초과")).catch(() => undefined);
  } else if (response.ok && routeOf(input).startsWith("/v1/")) {
    // 로그인 확인(/auth/*) 성공은 한도가 풀렸다는 뜻이 아니다 — 실제 모델 호출(/v1/*)이 성공했을 때만 걷는다.
    void import("@/ai/llmClient").then((llm) => { if (llm.getAiTransportHealth()?.status === 429) llm.reportTransportHealth(true, response.status); }).catch(() => undefined);
  }
  if (response.ok) { clearProblem(); return response; }
  if (response.status === 404 && options.expect404) return response;
  const route = routeOf(input);
  const problem = classify(response.status, route, await errorText(response), isJson(response));
  if (problem) reportProblem(problem);
  return response;
}
