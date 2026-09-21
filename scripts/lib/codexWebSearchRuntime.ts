// 조수 웹 검색의 업스트림 런타임 — ChatGPT 백엔드의 네이티브 `web_search` 를 우리가 직접 부른다.
//
// 왜 별도 요청인가: Pi 코어의 툴은 전부 함수 툴이고 호스티드 툴 슬롯이 없다(pi-agent-core
// `AgentTool` 에 `native` 필드가 없다 — 실측). 그래서 "검색해서 답을 가져와라" 를 한 번의
// 독립 완결로 만들어 함수 툴 뒤에 숨긴다. 조수 턴의 본문 모델은 그 결과 텍스트만 본다.
//
// 계약은 실측으로 고정했다(2026-09-21, 실제 ChatGPT 구독 자격):
//   POST https://chatgpt.com/backend-api/codex/responses
//   Authorization: Bearer <access> · ChatGPT-Account-Id: <claim>
//   body: { tools: [{ type: "web_search" }], stream: true, store: false, ... }
//   → SSE. `response.web_search_call.completed` 의 action.sources 에 출처 URL,
//     `response.output_text.delta` 에 답 본문, 최종 `response.completed` 에 annotations.
//   주의: `stream: false` 는 400 "Stream must be set to true" 다 — 비스트리밍은 존재하지 않는다.
//
// 자격은 이 파일이 다루지 않는다. 호출부(동반 서비스·워커)가 이미 해결한 access 토큰을 넘긴다 —
// `codexImageRuntime.ts` 와 같은 경계다. 토큰은 로그·오류 본문에 절대 싣지 않는다.

import { CODEX_PROVIDER_ID, decodeJwtPayload } from "../../src/ai/oauth/credentials.ts";
import type { WebSearchOutcome, WebSearchSource } from "../../src/ai/webSearch/types.ts";

export const CODEX_WEB_SEARCH_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses";
/** ChatGPT 백엔드가 받는 검색 요청의 기본 모델. 자격이 있는 계정이면 이 이름으로 검색이 돈다. */
export const CODEX_WEB_SEARCH_MODEL = "gpt-6-astra";
const SEARCH_TIMEOUT_MS = 120_000;
const MAX_QUERY_LENGTH = 400;
const DEFAULT_MAX_SOURCES = 6;

function statusError(message: string, status: number, code?: string): Error & { status: number; code?: string } {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}

/**
 * 검색 요청에 쓸 accountId. Codex 자격은 access 토큰의 JWT claim 안에만 계정이 있다
 * (`codexImageRuntime.ts` 와 같은 추출). 없으면 업스트림이 401 로 닫으므로 먼저 던진다.
 */
export function codexAccountIdFromToken(token: string): string | null {
  const claims = decodeJwtPayload<{ "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown } }>(token);
  const accountId = claims?.["https://api.openai.com/auth"]?.chatgpt_account_id;
  if (typeof accountId !== "string" || !accountId.trim() || /[\r\n]/.test(accountId)) return null;
  return accountId;
}

function normalizeQuery(value: unknown): string {
  const query = typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
  if (!query) throw statusError("검색어(query)가 필요합니다.", 400, "invalid-args");
  if (query.length > MAX_QUERY_LENGTH) {
    throw statusError(`검색어는 ${MAX_QUERY_LENGTH}자 이하여야 합니다.`, 400, "invalid-args");
  }
  return query;
}

function pushSource(sources: WebSearchSource[], seen: Set<string>, rawUrl: unknown, rawTitle?: unknown): void {
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  // 업스트림이 리다이렉트 래퍼를 섞어 보내기도 한다 — 절대 URL 만 남긴다.
  if (!/^https?:\/\//iu.test(url) || seen.has(url)) return;
  seen.add(url);
  const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim().slice(0, 200) : undefined;
  sources.push({ url, ...(title ? { title } : {}) });
}

/** 한 SSE data 줄을 소비해 본문·출처·질의를 모은다. 모르는 이벤트는 조용히 넘긴다. */
function consumeEvent(event: Record<string, unknown>, acc: {
  text: string[];
  sources: WebSearchSource[];
  seen: Set<string>;
  queries: string[];
}): void {
  const type = typeof event.type === "string" ? event.type : "";
  if (type === "response.output_text.delta" && typeof event.delta === "string") {
    acc.text.push(event.delta);
    return;
  }
  if (type === "response.output_item.done") {
    const item = event.item as Record<string, unknown> | undefined;
    if (!item || item.type !== "web_search_call") return;
    const action = (item.action ?? {}) as Record<string, unknown>;
    const queries = action.queries;
    if (Array.isArray(queries)) {
      for (const query of queries) if (typeof query === "string" && query.trim()) acc.queries.push(query.trim());
    }
    const sources = action.sources;
    if (Array.isArray(sources)) for (const source of sources) {
      const record = (source ?? {}) as Record<string, unknown>;
      pushSource(acc.sources, acc.seen, record.url, record.title);
    }
    return;
  }
  if (type === "response.completed") {
    const response = event.response as Record<string, unknown> | undefined;
    const output = response?.output;
    if (!Array.isArray(output)) return;
    for (const raw of output) {
      const item = (raw ?? {}) as Record<string, unknown>;
      if (item.type !== "message" || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        const record = (part ?? {}) as Record<string, unknown>;
        // annotations 가 최종 출처의 정본이다 — action.sources 가 비어도 여기서 채워진다.
        if (Array.isArray(record.annotations)) {
          for (const annotation of record.annotations) {
            const entry = (annotation ?? {}) as Record<string, unknown>;
            pushSource(acc.sources, acc.seen, entry.url, entry.title);
          }
        }
      }
    }
  }
}

export interface CodexWebSearchOptions {
  /** 이미 해결된 Codex access 토큰. 없으면 401 로 닫는다. */
  readonly apiKey?: string;
  readonly fetch?: typeof fetch;
  readonly model?: string;
  readonly maxSources?: number;
}

/**
 * 검색 한 건. 실패는 던지지 않고 `ok:false` 로 돌려준다 — 툴 결과로 그대로 실려
 * 모델이 다른 방법을 택하거나 사용자에게 이유를 말할 수 있어야 한다.
 */
export async function searchWebWithCodex(
  rawQuery: unknown,
  options: CodexWebSearchOptions = {},
  signal?: AbortSignal,
): Promise<WebSearchOutcome> {
  let query: string;
  try {
    query = normalizeQuery(rawQuery);
  } catch (error) {
    return {
      ok: false, answer: error instanceof Error ? error.message : "검색어가 올바르지 않습니다.",
      sources: [], queries: [], provider: CODEX_PROVIDER_ID, code: "invalid-args",
    };
  }

  const token = options.apiKey?.trim();
  const accountId = token ? codexAccountIdFromToken(token) : null;
  if (!token || !accountId) {
    return {
      ok: false,
      answer: "웹 검색에는 ChatGPT(Codex) 로그인이 필요합니다. AI 설정에서 Codex 연결을 확인해 주세요.",
      sources: [], queries: [], provider: CODEX_PROVIDER_ID, code: "codex-required",
    };
  }

  const maxSources = Math.max(1, Math.min(12, Math.trunc(options.maxSources ?? DEFAULT_MAX_SOURCES)));
  const deadline = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
  const composed = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(CODEX_WEB_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "ChatGPT-Account-Id": accountId,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        originator: "codex_cli_rs",
      },
      body: JSON.stringify({
        model: options.model ?? CODEX_WEB_SEARCH_MODEL,
        instructions: [
          "You are a web research assistant for a game authoring editor.",
          "Search the web and answer the question with current, verifiable facts.",
          "Answer in the language of the question. Be concise and concrete.",
          "Cite the pages you used; never invent URLs or numbers.",
        ].join(" "),
        input: [{ type: "message", role: "user", content: [{ type: "input_text", text: query }] }],
        tools: [{ type: "web_search" }],
        tool_choice: "auto",
        parallel_tool_calls: false,
        store: false,
        // 비스트리밍은 업스트림이 400 으로 거절한다 — 이 요청의 유일한 형태다.
        stream: true,
        include: ["web_search_call.action.sources"],
      }),
      signal: composed,
      redirect: "manual",
    });
  } catch (error) {
    if (deadline.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      return { ok: false, answer: "웹 검색이 120초 안에 끝나지 않았습니다.", sources: [], queries: [], provider: CODEX_PROVIDER_ID, code: "timeout" };
    }
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { ok: false, answer: "웹 검색 서버에 연결하지 못했습니다.", sources: [], queries: [], provider: CODEX_PROVIDER_ID, code: "transport" };
  }

  if (!response.ok) {
    // 업스트림 본문에는 자격 관련 문구가 섞일 수 있다 — 그대로 흘리지 않고 상태만 말한다.
    const status = response.status;
    const answer = status === 401 || status === 403
      ? "ChatGPT 로그인이 만료되었거나 권한이 없습니다. AI 설정에서 Codex를 다시 연결해 주세요."
      : `웹 검색이 실패했습니다 (HTTP ${status}).`;
    return { ok: false, answer, sources: [], queries: [], provider: CODEX_PROVIDER_ID, code: status === 401 || status === 403 ? "codex-unauthorized" : "upstream" };
  }

  const acc = { text: [] as string[], sources: [] as WebSearchSource[], seen: new Set<string>(), queries: [] as string[] };
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("no body");
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          continue;
        }
        consumeEvent(event, acc);
        if (event.type === "response.completed" || event.type === "response.failed") { finished = true; break; }
      }
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, answer: "웹 검색 응답을 읽지 못했습니다.", sources: [], queries: [], provider: CODEX_PROVIDER_ID, code: "stream" };
  }

  const answer = acc.text.join("").trim();
  if (!answer) {
    return { ok: false, answer: "웹 검색이 빈 답변을 돌려줬습니다. 검색어를 바꿔 다시 시도하세요.", sources: acc.sources.slice(0, maxSources), queries: acc.queries, provider: CODEX_PROVIDER_ID, code: "empty" };
  }
  return {
    ok: true,
    answer,
    sources: acc.sources.slice(0, maxSources),
    queries: [...new Set(acc.queries)],
    provider: CODEX_PROVIDER_ID,
    model: options.model ?? CODEX_WEB_SEARCH_MODEL,
  };
}
