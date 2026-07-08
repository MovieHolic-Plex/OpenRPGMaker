// ai/llmClient.ts
// OpenAI Chat Completions 호환 LLM 클라이언트(의존성 추가 없이 fetch 직접 구현).
// 공급자: OpenRouter(https://openrouter.ai/api/v1) — 브라우저 CORS 지원.
// - 스트리밍 SSE 파서(data: 라인 / [DONE] / tool_calls delta 조립) 포함.
// - 설정(baseUrl/model/liteModel/apiKey/maxToolCalls/maxTokens/reasoningEffort)은 localStorage(rpg-zzu:ai-config).
//   **API 키는 소스/프로젝트 JSON/localStorage 기본값에 하드코딩 금지.** 설정 UI로만 입력.
// - Node(테스트/스모크)에서는 config를 직접 주입해 사용한다.

// OpenAI 메시지 규약(우리가 쓰는 필드만).
export interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }

export type ChatRole = "system" | "user" | "assistant" | "tool";

// 멀티모달 content 파트(OpenAI 호환). 비전 모델에 타일/영역 이미지를 보여줄 때 쓴다.
export interface TextPart { type: "text"; text: string }
export interface ImageUrlPart { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
export type ContentPart = TextPart | ImageUrlPart;

export interface ChatMessage {
  role: ChatRole;
  // string = 일반 텍스트, ContentPart[] = 멀티모달(이미지 포함) 메시지.
  content: string | ContentPart[] | null;
  reasoning?: string;
  // assistant가 툴을 호출할 때.
  tool_calls?: ToolCall[];
  // role:"tool" 응답이 참조하는 tool_call id / 이름.
  tool_call_id?: string;
  name?: string;
}

export interface AiConfig {
  baseUrl: string;
  // 감독 모델: 계획/공간추론/스펙 작성/검수 AssistantSession 대화 루프.
  model: string;
  // 실행 모델: 쓰기 툴 루프와 반복/배치 보조 호출. 저장값이 없으면 DEFAULT_LITE_MODEL을 쓴다.
  liteModel?: string;
  apiKey: string;
  // 라운드 안전핀(사용자 노출 X). 사용자 제한은 maxTokens(출력 토큰 예산) 하나다.
  maxToolCalls: number;
  maxTokens: number;
  reasoningEffort?: "off" | "low" | "medium" | "high";
  // 제안(changeset)을 검토 없이 즉시 프로젝트에 적용.
  autoApprove?: boolean;
}

// 기본값. apiKey는 항상 빈값.
// DEFAULT_MODEL: 감독(계획·검수)은 minimax-m3. 저장된 사용자 지정 모델은 loadAiConfig가 존중한다.
export const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "minimax/minimax-m3";
// DEFAULT_LITE_MODEL: 실행(툴 루프)은 flash-lite로 분리해 긴 작업의 벽시계를 줄인다.
export const DEFAULT_LITE_MODEL = "google/gemini-3.1-flash-lite";
export const DEFAULT_MAX_TOKENS = 32768;

export function defaultAiConfig(): AiConfig {
  return {
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    liteModel: DEFAULT_LITE_MODEL,
    apiKey: "",
    maxToolCalls: 200,
    maxTokens: DEFAULT_MAX_TOKENS,
    reasoningEffort: "medium",
    autoApprove: false,
  };
}

export const AI_CONFIG_STORAGE_KEY = "rpg-zzu:ai-config";

// localStorage 로드. 저장된 값이 없거나 깨졌으면 기본값. 저장값은 기본값 위에 병합.
export function loadAiConfig(): AiConfig {
  const base = defaultAiConfig();
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : base.baseUrl,
      // 저장된 사용자 모델은 존중하되 비었으면 기본값.
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : base.model,
      liteModel: typeof parsed.liteModel === "string" && parsed.liteModel.trim() ? parsed.liteModel.trim() : base.liteModel,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : base.apiKey,
      maxToolCalls: Number.isFinite(parsed.maxToolCalls) && Number(parsed.maxToolCalls) > 0
        ? Math.floor(Number(parsed.maxToolCalls))
        : base.maxToolCalls,
      // 옛 기본값 2048/10240이 저장돼 있으면 미설정으로 간주하고 새 기본으로 승격.
      maxTokens: Number.isFinite(parsed.maxTokens) && Number(parsed.maxTokens) !== 2048 && Number(parsed.maxTokens) !== 10240
        ? Number(parsed.maxTokens)
        : base.maxTokens,
      reasoningEffort:
        parsed.reasoningEffort === "off" || parsed.reasoningEffort === "low" || parsed.reasoningEffort === "medium" || parsed.reasoningEffort === "high"
          ? parsed.reasoningEffort
          : base.reasoningEffort,
      autoApprove: parsed.autoApprove === true,
    };
  } catch {
    return base;
  }
}

export function saveAiConfig(config: AiConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function configForLiteModel(config: AiConfig): AiConfig {
  const liteModel = config.liteModel?.trim() || DEFAULT_LITE_MODEL;
  return { ...config, model: liteModel, liteModel };
}

// OpenAI tools 배열의 요소 형태(toolRegistry.toOpenAiTools() 결과와 동일 구조).
export interface OpenAiToolSchema { type: "function"; function: { name: string; description: string; parameters: unknown } }

export interface ChatRequest {
  messages: readonly ChatMessage[];
  tools?: readonly OpenAiToolSchema[];
  tool_choice?: "auto" | "none" | "required";
  stream?: boolean;
  // 스트리밍 토큰 콜백(있으면 stream:true로 강제).
  onToken?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
  signal?: AbortSignal;
}

export interface ChatResult { message: ChatMessage; finishReason: string | null; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }

// 사람이 읽을 수 있는 LLM 오류. status로 401/402/429/5xx를 구분한다.
export class LlmError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message); this.name = "LlmError"; this.status = status;
  }
}

export class LlmAbortError extends Error {
  constructor(message = "사용자가 중단했습니다") {
    super(message);
    this.name = "LlmAbortError";
  }
}

function humanizeStatus(status: number, body: string): string {
  const detail = body ? ` — ${body.slice(0, 300)}` : "";
  switch (status) {
    case 401:
      return `인증 실패(401): API 키가 없거나 잘못되었습니다. 설정에서 OpenRouter 키를 확인하세요.${detail}`;
    case 402:
      return `크레딧 부족(402): OpenRouter 잔액이 부족합니다.${detail}`;
    case 429:
      return `요청 한도 초과(429): 잠시 후 다시 시도하세요.${detail}`;
    default:
      if (status >= 500) return `서버 오류(${status}): 공급자 측 문제입니다. 잠시 후 재시도하세요.${detail}`;
      return `요청 실패(${status}).${detail}`;
  }
}

function endpoint(config: AiConfig): string {
  return `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function headers(config: AiConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` };
  // OpenRouter 권장 헤더(선택). 브라우저 환경에서만 의미 있음.
  if (typeof location !== "undefined") h["HTTP-Referer"] = location.origin;
  h["X-Title"] = "RPG ZZU Editor";
  return h;
}

function requestBody(config: AiConfig, req: ChatRequest, stream: boolean): string {
  const body: Record<string, unknown> = { model: config.model, messages: req.messages, stream, max_tokens: config.maxTokens };
  if (req.tools && req.tools.length > 0) { body.tools = req.tools; body.tool_choice = req.tool_choice ?? "auto"; }
  if (config.reasoningEffort && config.reasoningEffort !== "off") body.reasoning = { effort: config.reasoningEffort };
  return JSON.stringify(body);
}

// 스트리밍 tool_calls delta 누적기(index별로 id/name/arguments를 이어붙인다).
interface ToolCallAccum { id: string; name: string; arguments: string }

function assembleToolCalls(accum: Map<number, ToolCallAccum>): ToolCall[] | undefined {
  if (accum.size === 0) return undefined;
  return [...accum.entries()].sort((a, b) => a[0] - b[0]).map(([, tc]) => ({ id: tc.id || `call_${tc.name}`, type: "function" as const, function: { name: tc.name, arguments: tc.arguments } }));
}

function applyToolCallDelta(accum: Map<number, ToolCallAccum>, deltas: unknown): void {
  if (!Array.isArray(deltas)) return;
  for (const d of deltas as Array<Record<string, unknown>>) {
    const index = typeof d.index === "number" ? d.index : 0;
    const cur = accum.get(index) ?? { id: "", name: "", arguments: "" };
    if (typeof d.id === "string") cur.id = d.id;
    const fn = d.function as Record<string, unknown> | undefined;
    if (fn) {
      if (typeof fn.name === "string") cur.name += fn.name;
      if (typeof fn.arguments === "string") cur.arguments += fn.arguments;
    }
    accum.set(index, cur);
  }
}

// SSE 스트림을 파싱해 content/tool_calls를 조립한다. onToken은 content delta마다 호출.
async function parseSseStream(
  body: ReadableStream<Uint8Array>,
  onToken?: (delta: string) => void,
  onReasoning?: (delta: string) => void
): Promise<ChatResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let finishReason: string | null = null;
  let usage: ChatResult["usage"] | undefined;
  const toolAccum = new Map<number, ToolCallAccum>();

  const handleData = (payload: string): boolean => {
    // true 반환 = 스트림 종료([DONE]).
    if (payload === "[DONE]") return true;
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(payload);
    } catch {
      return false; // 부분 청크 — 다음 라인에서 온전해질 수 있으나 SSE 경계상 무시.
    }
    if (json.usage) usage = json.usage as ChatResult["usage"];
    const choices = json.choices as Array<Record<string, unknown>> | undefined;
    const choice = choices?.[0];
    if (!choice) return false;
    if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
    const delta = choice.delta as Record<string, unknown> | undefined;
    if (delta) {
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        onToken?.(delta.content);
      }
      if (typeof delta.reasoning === "string" && delta.reasoning) {
        reasoning += delta.reasoning;
        onReasoning?.(delta.reasoning);
      }
      if (delta.tool_calls) applyToolCallDelta(toolAccum, delta.tool_calls);
    }
    return false;
  };

  let done = false;
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 이벤트는 개행으로 구분. "data: " 접두 라인만 처리.
    let nlIndex: number;
    while ((nlIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nlIndex).replace(/\r$/, "");
      buffer = buffer.slice(nlIndex + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      if (handleData(payload)) {
        done = true;
        break;
      }
    }
  }

  const message: ChatMessage = {
    role: "assistant",
    content: content || null,
  };
  const toolCalls = assembleToolCalls(toolAccum);
  if (toolCalls) message.tool_calls = toolCalls;
  if (reasoning) message.reasoning = reasoning;
  return {
    message,
    finishReason,
    usage,
  };
}

// 비스트리밍 응답 파싱.
function parseNonStream(json: Record<string, unknown>): ChatResult {
  const choices = json.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const msg = (choice?.message ?? {}) as Record<string, unknown>;
  const rawToolCalls = msg.tool_calls as Array<Record<string, unknown>> | undefined;
  const tool_calls: ToolCall[] | undefined = rawToolCalls?.map((tc) => ({
    id: String(tc.id ?? ""),
    type: "function",
    function: {
      name: String((tc.function as Record<string, unknown> | undefined)?.name ?? ""),
      arguments: String((tc.function as Record<string, unknown> | undefined)?.arguments ?? ""),
    },
  }));
  const message: ChatMessage = {
    role: "assistant",
    content: typeof msg.content === "string" ? msg.content : null,
  };
  if (tool_calls && tool_calls.length > 0) message.tool_calls = tool_calls;
  if (typeof msg.reasoning === "string") message.reasoning = msg.reasoning;
  return {
    message,
    finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
    usage: json.usage as ChatResult["usage"] | undefined,
  };
}

// 일시 오류(네트워크/429/5xx) 자동 재시도 1회의 백오프(도그푸딩 결함 ⑥).
export const LLM_RETRY_BACKOFF_MS = 1500;

// 재시도해 볼 만한 오류인가 — 네트워크(상태 없음)/요청 한도(429)/서버 오류(5xx).
// 인증(401)/크레딧(402) 같은 영구 오류는 재시도하지 않는다.
export function isRetryableLlmError(error: unknown): boolean {
  if (!(error instanceof LlmError)) return false;
  return error.status === undefined || error.status === 429 || error.status >= 500;
}

export function isLlmAbortError(error: unknown): boolean {
  return error instanceof LlmAbortError || (error instanceof Error && error.name === "AbortError");
}

// Chat Completions 호출 + 일시 오류 자동 재시도 1회(지수 백오프).
// 스트리밍 도중(토큰이 이미 UI로 나간 뒤) 끊긴 경우는 중복 출력을 피하기 위해 재시도하지 않는다.
export async function chatCompletion(config: AiConfig, req: ChatRequest): Promise<ChatResult> {
  let streamedAny = false;
  const guardedReq: ChatRequest = {
    ...req,
    onToken: req.onToken
      ? (delta) => {
          streamedAny = true;
          req.onToken?.(delta);
        }
      : undefined,
    onReasoning: req.onReasoning
      ? (delta) => {
          streamedAny = true;
          req.onReasoning?.(delta);
        }
      : undefined,
  };
  try {
    return await chatCompletionOnce(config, guardedReq);
  } catch (cause) {
    if (!isRetryableLlmError(cause) || streamedAny || req.signal?.aborted) throw cause;
    await sleep(LLM_RETRY_BACKOFF_MS);
    try {
      return await chatCompletionOnce(config, guardedReq);
    } catch (retryCause) {
      if (retryCause instanceof LlmError) {
        throw new LlmError(`${retryCause.message} (자동 재시도 1회 실패)`, retryCause.status);
      }
      throw retryCause;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 단일 Chat Completions 호출. 키가 없으면 즉시 사람이 읽을 오류.
async function chatCompletionOnce(config: AiConfig, req: ChatRequest): Promise<ChatResult> {
  if (!config.apiKey || !config.apiKey.trim()) {
    throw new LlmError("API 키가 설정되지 않았습니다. 어시스턴트 설정에서 OpenRouter 키를 입력하세요.", 401);
  }
  const stream = req.stream ?? Boolean(req.onToken || req.onReasoning);
  let response: Response;
  try {
    response = await fetch(endpoint(config), {
      method: "POST",
      headers: headers(config),
      body: requestBody(config, req, stream),
      signal: req.signal,
    });
  } catch (cause) {
    if (req.signal?.aborted || isLlmAbortError(cause)) throw new LlmAbortError();
    throw new LlmError(`네트워크 오류: LLM 엔드포인트에 연결할 수 없습니다(${config.baseUrl}). ${cause instanceof Error ? cause.message : ""}`);
  }

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      /* ignore */
    }
    throw new LlmError(humanizeStatus(response.status, body), response.status);
  }

  if (stream && response.body) {
    return await parseSseStream(response.body, req.onToken, req.onReasoning);
  }
  const json = (await response.json()) as Record<string, unknown>;
  return parseNonStream(json);
}
