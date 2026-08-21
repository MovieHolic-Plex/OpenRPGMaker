// ai/llmClient.ts
// OpenAI Chat Completions 호환 LLM 클라이언트(의존성 추가 없이 fetch 직접 구현).
// 공급자: 사용자 설정 baseUrl(OpenAI 호환 엔드포인트). 기본 공급자를 하드코딩하지 않는다.
// - 스트리밍 SSE 파서(data: 라인 / [DONE] / tool_calls delta 조립) 포함.
// - 설정(baseUrl/model/liteModel/apiKey/maxToolCalls/maxTokens/reasoningEffort)은 localStorage(rpg-zzu:ai-config).
//   **API 키는 소스/프로젝트 JSON/localStorage 기본값에 하드코딩 금지.** 설정 UI로만 입력.
// - Node(테스트/스모크)에서는 config를 직접 주입해 사용한다.

import { defaultModelForAuthMode, isModelValidForAuthMode } from "@/ai/modelCatalog";
import { PRODUCT_BRAND } from "@/brand";
import { DEFAULT_OH_MY_PI_PROVIDER, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";

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
  authMode: "chatgpt" | "apiKey";
  /** oh-my-pi 제공자 id. 토큰/키는 브라우저에 두지 않고 동반 서비스가 보관한다. */
  providerId?: string;
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
  // 작업 모드: "auto" = 플래너(작업 분해) 라운드를 모델 구성과 무관하게 상시 동작,
  // "chat" = 종래 동작(감독·실행 모델이 다를 때만 플래너). 미지정(구형 blob/테스트 주입)은
  // loadAiConfig가 "auto"로 백필하지만, 직접 주입된 config는 종래 판정을 유지한다.
  agentMode?: "auto" | "chat";
  // 현재 맵의 경고 없는 저위험 타일 변경만 검토 없이 적용(그 외 제안은 항상 검토).
  autoApprove?: boolean;
}

// 기본값. apiKey는 localStorage 우선, 비어 있으면 dev env(VITE_LLM_API_KEY 등) 폴백.
// 저장 설정은 loadAiConfig가 존중한다.
export const DEFAULT_BASE_URL = "";
// DEV: vite.config.ts codexOAuthPlugin mounts the same handlers same-origin, so the
// browser calls /auth/* and /v1/chat/completions on the dev server itself (no separate
// `npm run ai:oauth` process). PROD (preview/dist): fall back to the standalone
// 127.0.0.1:17832 companion started via `npm run ai:oauth`.
export const DEFAULT_CHATGPT_BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.DEV ? "/v1" : "http://127.0.0.1:17832/v1";
// 기본 모델은 **에디터의 실제 요청**(툴 45개)을 통과하는 것으로 고른다.
// 실측(2026-07-26, 같은 본문을 모델만 바꿔 재생):
//   cpen/gemini-3-flash        503 upstream_unavailable — 5회 전부 실패
//   cpen/gemini-3-1-flash-lite 503
//   cpen/gemini-flash-2-5      503 → 200 → 200 (간헐적, 기본값으로 쓸 수 없음)
//   cpen/gpt-5-6-luna / terra / gpt-5-4-mini   200 안정
//
// 원인은 **페이로드 크기가 아니라 tools 자체**다. 2×2 로 갈라 재측정한 결과:
//   gemini-3-flash  tools=Y image=Y 152KB → 503 / tools=Y image=N  45KB → 503
//                   tools=N image=Y 120KB → 200 / tools=N image=N  13KB → 200
// 즉 tools 가 붙으면 크기와 무관하게 실패하고, 빼면 120KB 도 통과한다. cpen 의 gemini
// 라우트가 툴 호출을 못 받는 것으로 보인다. 채팅만 하면 gemini 도 200 이라
// "AI 가 되는데 에디터에서만 안 된다" 로 보였다.
export const DEFAULT_MODEL = "cpen/gpt-5-6-luna";
// DEFAULT_LITE_MODEL: 실행 단계용. 기본은 DEFAULT_MODEL과 동일 → 이원화 비활성.
export const DEFAULT_LITE_MODEL = "cpen/gpt-5-6-luna";
// cpenrouter(cpenrouter.space) 모델 함정(실측): 짧은 max_tokens 로 호출하면 추론 토큰만 먼저
// 소비되고 content 가 빈 문자열로 돌아온다(실측: max_tokens 16 → content "" 이면서 completion
// 13토큰 소비, 512 → 정상). 추론 토큰을 먼저 쓰는 모델이므로 출력 예산을 넉넉히 잡아야 한다.
export const DEFAULT_MAX_TOKENS = 32768;

/** Browser-exposed env keys (from .env.local via Vite). Never hardcode secrets in source. */
// VITE_LLM_API_KEY 는 클라이언트 번들에 키를 인라인하므로 보안 위험이다 — 게이트웨이 키는
// 서버 전용 APITOPIA_API_KEY (non-VITE) 로 두고 vite 프록시가 Authorization 을 주입한다.
// VITE_LLM_API_KEY 는 절대 URL(https://...) 게이트웨이를 직접 치는 사용자를 위해서만 남겨둔다.
function envApiKey(): string {
  try {
    const fromLlm = import.meta.env.VITE_LLM_API_KEY?.trim();
    if (fromLlm) return fromLlm;
    const fromYunwu = import.meta.env.VITE_YUNWU_API_KEY?.trim();
    if (fromYunwu) return fromYunwu;
  } catch {
    /* non-vite runtime */
  }
  return "";
}

function envBaseUrl(): string {
  try {
    const llm = import.meta.env.VITE_LLM_API_URL?.trim();
    if (llm && /^https?:\/\//i.test(llm)) return llm.replace(/\/$/, "");
    if (llm && llm.startsWith("/")) return llm.replace(/\/$/, "");
  } catch {
    /* non-vite runtime */
  }
  return "";
}

export function defaultAiConfig(): AiConfig {
  // env VITE_LLM_API_URL 이 있으면 apiKey 모드로 부팅한다 — 게이트웨이(apitopia 등) 경로로
  // glm 등 비-Codex 모델을 쓰겠다는 의도. 이때 키가 없으면 조용히 chatgpt OAuth 로 넘어가는 대신
  // apiKey 모드를 유지해 상태바 "AI 연동" 칩과 영역 작업 모달이 "API 키 없음" 을 명시적으로 알리게
  // 한다. (이전 동작: URL 만 있고 키가 없으면 chatgpt OAuth 로 폴백 → /v1 → codex 인증 실패가
  // 되어 "영역 AI 가 왜 안 되나" 원인을 알 수 없었다.) env 가 아예 없으면 chatgpt OAuth fallback.
  const envUrl = envBaseUrl();
  const envKey = envApiKey();
  const wantsGateway = !!envUrl;
  // 상대 baseUrl(/api/ai 등)은 동일 오리진 vite 프록시 → 서버가 Authorization 을 주입하므로
  // 클라이언트에 키가 없어도 된다(proxyAuth). 절대 URL(https://...)은 클라이언트 키 필요.
  return {
    authMode: wantsGateway ? "apiKey" : "chatgpt",
    providerId: wantsGateway ? "openai" : DEFAULT_OH_MY_PI_PROVIDER,
    baseUrl: envUrl || DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    liteModel: DEFAULT_LITE_MODEL,
    apiKey: envKey,
    maxToolCalls: 200,
    maxTokens: DEFAULT_MAX_TOKENS,
    // 장문 reasoning 모델(MiniMax 등)을 감독으로 쓸 때만 low 캡이 의미 있음.
    reasoningEffort: "low",
    agentMode: "auto",
    autoApprove: false,
  };
}

export const AI_CONFIG_STORAGE_KEY = "rpg-zzu:ai-config";

// localStorage 로드. 저장된 값이 없거나 깨졌으면 기본값. 저장값은 기본값 위에 병합.
// apiKey가 빈 문자열로 저장된 경우(미설정) env 폴백을 허용한다.
export function loadAiConfig(): AiConfig {
  const base = defaultAiConfig();
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    const storedKey = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
    const authMode = parsed.authMode === "chatgpt" || parsed.authMode === "apiKey"
      ? parsed.authMode
      : storedKey || (typeof parsed.baseUrl === "string" && parsed.baseUrl.trim())
        ? "apiKey"
        : "chatgpt";
    // 저장된 사용자 모델은 존중하되 비었으면 기본값.
    // trim 한 저장값을 먼저 뽑고 || 폴백으로 단순화한다 — 각 표현식이 모두 string 으로 끝나
    // TS 가 string 으로 확정한다(아래 isModelValidForAuthMode 가 string 을 요구). base.liteModel 은
    // AiConfig 의 선택 필드지만 defaultAiConfig() 가 항상 DEFAULT_LITE_MODEL 을 채우므로 ?? base.model 로
    // undefined 여지만 없앤다. 런타임 값은 이전 삼항 표현식과 동일하다.
    const storedModel = typeof parsed.model === "string" ? parsed.model.trim() : "";
    let model: string = storedModel || base.model;
    const storedLiteModel = typeof parsed.liteModel === "string" ? parsed.liteModel.trim() : "";
    let liteModel: string = storedLiteModel || storedModel || (base.liteModel ?? base.model);
    const providerId = parseOhMyPiProvider(
      parsed.providerId,
      authMode === "chatgpt" ? DEFAULT_OH_MY_PI_PROVIDER : "openai",
    );
    // openai-codex + chatgpt 만 gpt- 가 아닌 모델을 거부한다. 다른 oh-my-pi 제공자는 카탈로그 모델을 존중한다.
    if (!isModelValidForAuthMode(authMode, model, providerId) || !isModelValidForAuthMode(authMode, liteModel, providerId)) {
      const fallback = defaultModelForAuthMode(authMode, providerId) || base.model;
      if (!isModelValidForAuthMode(authMode, model, providerId)) {
        console.warn(`[llmClient] authMode(${authMode})에서 쓸 수 없는 모델 '${model}' 을(를) 권장 기본 '${fallback}' 으로 바꿨습니다.`);
        model = fallback;
      }
      if (!isModelValidForAuthMode(authMode, liteModel, providerId)) {
        console.warn(`[llmClient] authMode(${authMode})에서 쓸 수 없는 실행 모델 '${liteModel}' 을(를) 권장 기본 '${fallback}' 으로 바꿨습니다.`);
        liteModel = fallback;
      }
    }
    return {
      authMode,
      providerId,
      baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : base.baseUrl,
      model,
      liteModel,
      apiKey: parsed.authMode === "apiKey" && typeof parsed.apiKey === "string"
        ? storedKey
        : storedKey || base.apiKey || envApiKey(),
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
      // agentMode 백필(위 liteModel 패턴과 동일): 필드가 없는 옛 blob과 이상한 값은
      // 기본값 "auto"로 정규화한다. "chat"만 명시적으로 유지된다.
      agentMode: parsed.agentMode === "chat" ? "chat" : "auto",
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
  // liteModel 미설정 시 감독 model을 따라간다(일원화). 감독을 바꾸면 영역 작업 실행도 함께 바뀌고,
  // 각 authMode(chatgpt OAuth / apiKey)의 baseUrl·게이트웨이 경로가 일관되게 유지된다.
  // DEFAULT_LITE_MODEL은 defaultAiConfig() 초기값으로만 의미를 가진다.
  const liteModel = config.liteModel?.trim() || config.model.trim() || DEFAULT_LITE_MODEL;
  // 실행(툴 루프) 단계는 추론 비활성 — 벽시계·비용 폭주 방지.
  return { ...config, model: liteModel, liteModel, reasoningEffort: "off" };
}

/** minimax 등 장문 reasoning 모델 탐지. */
export function isLongReasoningModel(model: string): boolean {
  return model.trim().toLowerCase().includes("minimax");
}

/**
 * 요청 직전 reasoning 정책 적용.
 * - lite/execute: 이미 off
 * - MiniMax + medium → low 로 캡(사용자가 high를 고른 경우만 medium까지 허용)
 * - 그 외는 설정 유지
 */
export function configWithReasoningPolicy(config: AiConfig): AiConfig {
  if (config.reasoningEffort === "off") return config;
  if (!isLongReasoningModel(config.model)) return config;
  if (config.reasoningEffort === "medium") {
    return { ...config, reasoningEffort: "low" };
  }
  if (config.reasoningEffort === "high") {
    return { ...config, reasoningEffort: "medium" };
  }
  return config;
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
  // AssistantSession처럼 상위 계층이 라운드 단위 재시도를 맡을 때 llmClient의 1회 재시도를 끈다.
  disableTransientRetry?: boolean;
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

function humanizeStatus(status: number, body: string, authMode: AiConfig["authMode"]): string {
  const detail = body ? ` — ${body.slice(0, 300)}` : "";
  switch (status) {
    case 401:
      return authMode === "chatgpt"
        ? `ChatGPT 로그인 실패(401): 로컬 OAuth 동반 서비스에서 다시 로그인하세요.${detail}`
        : `인증 실패(401): API 키가 없거나 잘못되었습니다. 어시스턴트 설정에서 API 키와 엔드포인트(baseUrl)를 확인하세요.${detail}`;
    case 402:
      return `결제/크레딧 오류(402): LLM 공급자 잔액 또는 과금 설정을 확인하세요.${detail}`;
    case 429:
      return `요청 한도 초과(429): 잠시 후 다시 시도하세요.${detail}`;
    default:
      if (status >= 500) return `서버 오류(${status}): 공급자 측 문제입니다. 잠시 후 재시도하세요.${detail}`;
      return `요청 실패(${status}).${detail}`;
  }
}

export function isCompanionBaseUrl(url: string): boolean {
  const trimmed = url.trim().replace(/\/$/, "");
  return trimmed === "/v1"
    || trimmed === "http://127.0.0.1:17832/v1"
    || trimmed === "http://localhost:17832/v1";
}

/** ChatGPT 모드이거나 동반 서비스 baseUrl 이면 oh-my-pi 동반 경로를 탄다. */
export function usesOhMyPiCompanion(config: AiConfig): boolean {
  if (config.authMode === "chatgpt") return true;
  return isCompanionBaseUrl(config.baseUrl);
}

function endpoint(config: AiConfig): string {
  const baseUrl = usesOhMyPiCompanion(config) ? DEFAULT_CHATGPT_BASE_URL : config.baseUrl;
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

/**
 * 상대 baseUrl(/api/ai 등)은 동일 오리진 vite 프록시 — 서버가 Authorization 을 주입하므로
 * 클라이언트 apiKey 가 필요 없다. 전송 가드·헤더 구성은 물론 UI 의 "준비됨" 판정도 이 함수로
 * 통일한다: 중복 구현된 검사가 이 면제를 빼먹어 프록시 환경에서 전송이 막히는 결함이 있었음.
 * 참조 구현: editor/panels/aiConnectionStatus.ts(proxyAuth 판정).
 */
export function isProxyAuth(config: AiConfig): boolean {
  return config.authMode === "apiKey" && config.baseUrl.trim().startsWith("/");
}

function headers(config: AiConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (usesOhMyPiCompanion(config)) {
    h["X-Rpgzzu-Provider"] = parseOhMyPiProvider(config.providerId);
    return h;
  }
  // proxyAuth: 프록시가 서버 측에서 Authorization 을 주입한다 — 클라이언트는 키를 보내지 않는다.
  if (config.authMode === "apiKey" && !isProxyAuth(config)) {
    h.Authorization = `Bearer ${config.apiKey}`;
    if (typeof location !== "undefined") h["HTTP-Referer"] = location.origin;
    h["X-Title"] = `${PRODUCT_BRAND} Editor`;
  }
  return h;
}

// ── 공급자 능력(capability) 선언 ─────────────────────────────────────────────
// 공급자마다 지원하는 요청 필드가 다르다. 제약을 하드코딩 전역 하향으로 때우면 큰 max_tokens·
// 스트리밍·reasoning 을 지원하는 다른 공급자(apitopia/qwencloud/ChatGPT)까지 손해 본다.
// 그래서 제약을 데이터로 선언하고 본문 구성(requestBody)·전송 방식(chatCompletionOnce)에서 걸러낸다.
//
// cpenrouter(CPEN v1) 실측 근거(dev 서버 경유 curl, 모델 cpen/gemini-3-flash):
//   - max_tokens 8192        → 200 OK
//   - max_tokens 32768       → 422 "Request body does not match the CPEN v1 chat schema"
//   - stream: true           → 400 "Streaming currently supports text-only cpen/gpt-* chat"
//   - reasoning:{effort:low} → 400 "This OpenAI-compatible field is not supported by CPEN v1"
// 즉 cpen 은 reasoning 전체 미지원, 스트리밍은 cpen/gpt-* 만 지원, max_tokens 는 8192 가 실측
// 통과 안전값이다(정확한 상한은 미확인 — 32768 이 실패했으므로 통과가 확인된 8192 를 상한으로 쓴다).
export interface ProviderCapability {
  /** 스트리밍(stream:true) 지원 여부. false 면 비스트리밍 경로를 탄다. */
  readonly supportsStreaming: boolean;
  /** OpenAI 호환 reasoning 필드 지원 여부. false 면 본문에서 reasoning 을 뺀다. */
  readonly supportsReasoningField: boolean;
  /** max_tokens 상한. undefined 면 제한 없음. */
  readonly maxTokensCeiling?: number;
  /** 메시지의 `name` 필드 지원 여부. false 면 본문에서 떼어낸다(실측: CPEN v1 400). */
  readonly supportsMessageName: boolean;
}

/**
 * cpenrouter 경로 식별. model 접두사(`cpen/`)를 주 판정으로 쓴다 — 사용자가 절대 URL
 * (https://cpenrouter.space/v1 등)로 게이트웨이를 직접 치면 baseUrl 에 `/api/cpen` 이 나타나지
 * 않지만 model ID 는 여전히 `cpen/` 로 시작하므로 model 쪽이 더 견고하다. baseUrl(`/api/cpen`)은
 * 프록시 경로를 쓰는 기본 사례를 잡는 보조 판정으로 OR 한다.
 */
function isCpenProvider(config: AiConfig): boolean {
  if (config.model.trim().toLowerCase().startsWith("cpen/")) return true;
  return config.baseUrl.trim().toLowerCase().includes("/api/cpen");
}

/**
 * 설정에서 공급자 능력을 판정한다. 비-cpen 공급자는 전부 지원(제한 없음)으로 둔다.
 *
 * hasTools: 이번 요청에 tools 배열이 붙는가. cpen 스트리밍 판정에 필요하다 — 오류 문구의
 * "text-only" 가 문자 그대로라, 툴이 하나라도 붙으면 gpt-* 라도 스트리밍이 거부된다.
 */
export function providerCapability(
  config: AiConfig,
  opts?: { readonly hasTools?: boolean },
): ProviderCapability {
  if (!isCpenProvider(config)) {
    return { supportsStreaming: true, supportsReasoningField: true, supportsMessageName: true };
  }
  // cpen 스트리밍은 "text-only cpen/gpt-* chat" 만 지원한다. 두 조건 다 필요하다:
  //   모델이 cpen/gpt-* 이고 (gemini-* 는 툴이 없어도 스트리밍 불가)
  //   이번 요청에 tools 가 없어야 한다.
  // 실측(2026-07-26, 에디터 실제 본문 tools=45):
  //   cpen/gpt-5-6-luna  stream=true  → 400 unsupported_streaming_request
  //                                     "Streaming currently supports text-only cpen/gpt-* chat."
  //   cpen/gpt-5-6-luna  stream=false → 200
  // 모델 접두사만 보고 스트리밍을 켜던 탓에 에디터의 모든 턴이 400 이었다.
  const isGpt = config.model.trim().toLowerCase().startsWith("cpen/gpt-");
  const supportsStreaming = isGpt && !opts?.hasTools;
  return {
    supportsStreaming,
    supportsReasoningField: false,
    supportsMessageName: false,
    // 실측: 8192 통과, 32768 실패. 정확한 상한은 모르므로 통과가 확인된 8192 를 안전 상한으로 쓴다.
    maxTokensCeiling: 8192,
  };
}

// 공급자 제약으로 본문/전송 방식을 조정한 사실을 개발자에게 한 번만 알린다(매 요청 스팸 방지).
const capabilityWarned = new Set<string>();
function warnCapabilityOnce(key: string, message: string): void {
  if (capabilityWarned.has(key)) return;
  capabilityWarned.add(key);
  console.warn(message);
}

/**
 * 메시지에서 `name` 을 떼어낸 사본. 원본은 건드리지 않는다.
 *
 * OpenAI 는 tool 결과 메시지에 `{role:"tool", tool_call_id, name, content}` 를 허용하지만
 * CPEN v1 은 이 필드를 거부한다(실측 400):
 *   {"code":"unsupported_field","param":"messages[3].name"}
 * 첫 요청에는 tool 메시지가 없어 200 이 나고 **툴을 한 번 쓴 다음 턴부터** 깨졌다 —
 * 그래서 "AI 가 답은 하는데 아무것도 못 만든다" 로 보였다.
 * tool_call_id 가 어느 호출의 결과인지 이미 지목하므로 name 은 없어도 의미가 보존된다.
 */
function stripMessageNames(messages: readonly ChatMessage[]): readonly ChatMessage[] {
  if (!messages.some((message) => message.name !== undefined)) return messages;
  return messages.map((message) => {
    if (message.name === undefined) return message;
    const { name: _dropped, ...rest } = message;
    return rest;
  });
}

function requestBody(config: AiConfig, req: ChatRequest, stream: boolean): string {
  const effective = configWithReasoningPolicy(config);
  const capability = providerCapability(effective, { hasTools: Boolean(req.tools && req.tools.length > 0) });
  // 공급자 max_tokens 상한이 있으면 클램프한다(실측: cpen 은 32768 → 422, 8192 → 200).
  let maxTokens = effective.maxTokens;
  if (capability.maxTokensCeiling !== undefined && maxTokens > capability.maxTokensCeiling) {
    warnCapabilityOnce(
      `maxTokens:${effective.model}`,
      `[llmClient] 공급자 제약: ${effective.model} 의 max_tokens 를 ${maxTokens} → ${capability.maxTokensCeiling} 로 클램프했습니다(실측 기반 상한).`,
    );
    maxTokens = capability.maxTokensCeiling;
  }
  const body: Record<string, unknown> = {
    model: effective.model,
    messages: capability.supportsMessageName ? req.messages : stripMessageNames(req.messages),
    stream,
    max_tokens: maxTokens,
  };
  // 스트리밍에서도 usage(prompt_tokens 등)를 마지막 청크로 받는다(OpenAI 호환).
  // 미지원 공급자가 usage를 안 주면 소비 측(tokenBudget 관측)이 조용히 건너뛴다.
  if (stream) body.stream_options = { include_usage: true };
  if (req.tools && req.tools.length > 0) { body.tools = req.tools; body.tool_choice = req.tool_choice ?? "auto"; }
  // reasoning 필드는 공급자가 지원할 때만 붙인다(실측: cpen 은 reasoning → 400).
  if (effective.reasoningEffort && effective.reasoningEffort !== "off") {
    if (capability.supportsReasoningField) {
      body.reasoning = { effort: effective.reasoningEffort };
    } else {
      warnCapabilityOnce(
        `reasoning:${effective.model}`,
        `[llmClient] 공급자 제약: ${effective.model} 은(는) reasoning 필드를 지원하지 않아 본문에서 뺐습니다(실측: CPEN v1 400).`,
      );
    }
  }
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
  onReasoning?: (delta: string) => void,
  signal?: AbortSignal
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
  try {
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
  } catch (cause) {
    if (signal?.aborted || isLlmAbortError(cause)) throw new LlmAbortError();
    const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : "";
    throw new LlmError(`네트워크 오류: 스트리밍 연결이 끊겼습니다.${detail}`);
  }

  if (!done && finishReason === null) {
    throw new LlmError("네트워크 오류: 스트리밍 연결이 조기 종료되었습니다.");
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

// 단일 LLM 요청 수명 상한(실측 2026-08-15 자율 런): cpen 게이트웨이가 매달려 응답을
// 안 주면 턴이 영원히 대기했다. 게이트웨이 정상 응답은 50초 안팎까지 관측되므로 넉넉한
// 180초로 매달림만 잡고 정상 체감은 해치지 않는다. 초과 시 504 로 일시 오류 처리(재시도 경로).
export const LLM_REQUEST_TIMEOUT_MS = 180_000;

// 재시도해 볼 만한 오류인가 — 네트워크(상태 없음)/요청 한도(429)/서버 오류(5xx).
// 인증(401)/크레딧(402) 같은 영구 오류는 재시도하지 않는다.
export function isRetryableLlmError(error: unknown): boolean {
  if (!(error instanceof LlmError)) return false;
  return error.status === undefined || error.status === 429 || error.status >= 500;
}

/** 매달림(응답 없는 fetch)을 일시 오류로 감지한다 — AbortController.abort() 는 AbortError 를 던진다. */
export function isLlmTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
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
  if (req.disableTransientRetry) return await chatCompletionOnce(config, guardedReq);
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

// ── 전송 건강 상태(상태바 칩 진실화) ─────────────────────────────
// "AI 연결됨" 칩이 설정 모양만 보고 판정하면, 프록시 미등록(404)·게이트웨이 다운(5xx)에도
// 연결됨이라고 거짓말한다(2026-08-19 적대 평가 P0). 실제 요청 결과를 여기 기록하고
// 칩(getAiConnectionStatus)이 함께 판정한다. 성공 1회면 자동 복구.
export interface AiTransportHealth {
  readonly ok: boolean;
  readonly status?: number;
  readonly message?: string;
  readonly at: number;
}

export const AI_TRANSPORT_HEALTH_EVENT = "rpgzzu:ai-transport-health";

let aiTransportHealth: AiTransportHealth | null = null;

export function getAiTransportHealth(): AiTransportHealth | null {
  return aiTransportHealth;
}

/** 테스트용 — 상태를 초기화한다. */
export function resetAiTransportHealth(): void {
  aiTransportHealth = null;
}

export function reportTransportHealth(ok: boolean, status?: number, message?: string): void {
  const changed = !aiTransportHealth || aiTransportHealth.ok !== ok || aiTransportHealth.status !== status;
  aiTransportHealth = { ok, status, message, at: Date.now() };
  if (changed && typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(AI_TRANSPORT_HEALTH_EVENT));
  }
}

// 단일 Chat Completions 호출. 키가 없으면 즉시 사람이 읽을 오류.
async function chatCompletionOnce(config: AiConfig, req: ChatRequest): Promise<ChatResult> {
  const companion = usesOhMyPiCompanion(config);
  // proxyAuth(상대 baseUrl)는 프록시가 서버 측에서 Authorization 을 주입하므로 클라이언트 키 불필요.
  if (!companion && config.authMode === "apiKey" && !isProxyAuth(config) && (!config.apiKey || !config.apiKey.trim())) {
    throw new LlmError("API 키가 설정되지 않았습니다. 어시스턴트 설정에서 API 키를 입력하세요.", 401);
  }
  if (!companion && config.authMode === "apiKey" && (!config.baseUrl || !config.baseUrl.trim())) {
    throw new LlmError("LLM 엔드포인트(baseUrl)가 설정되지 않았습니다. 어시스턴트 설정에서 OpenAI 호환 baseUrl을 입력하세요.", 400);
  }
  const wantsStream = req.stream ?? Boolean(req.onToken || req.onReasoning);
  // 공급자가 스트리밍을 지원하지 않으면 비스트리밍으로 확정한다(실측: cpen 은 stream:true → 400).
  // 여기서 확정해야 아래 requestBody(본문)와 응답 파싱 분기가 같은 stream 값으로 일관된다 —
  // 본문에서만 stream 을 false 로 바꾸면 응답 파싱이 SSE 를 기대해 깨진다.
  let stream = wantsStream;
  const hasTools = Boolean(req.tools && req.tools.length > 0);
  if (stream && !providerCapability(config, { hasTools }).supportsStreaming) {
    warnCapabilityOnce(
      `stream:${config.model}:${hasTools ? "tools" : "text"}`,
      `[llmClient] 공급자 제약: ${config.model}${hasTools ? "(툴 포함 요청)" : ""} 은(는) 스트리밍을 지원하지 않아 비스트리밍으로 전환했습니다(실측: CPEN v1 400).`,
    );
    stream = false;
  }
  let response: Response;
  try {
    // 실측(2026-08-15 자율 런): cpen 게이트웨이가 요청을 조용히 매달아(응답 없음) 턴이
    // 영원히 대기했다(수동 중단 외 복구 불가). 요청 수명을 LLM_REQUEST_TIMEOUT_MS 로 제한해
    // 매달림을 일시 오류로 바꾸고 기존 재시도 경로로 넘긴다(공급자 상한 — 게이트웨이는 느려도
    // 정상 응답이 50초 안팎이라 넉넉히 잡는다). 호출자 signal(중단)과 합성한다.
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);
    const onCallerAbort = () => controller.abort();
    req.signal?.addEventListener("abort", onCallerAbort, { once: true });
    try {
      response = await fetch(endpoint(config), {
        method: "POST",
        headers: headers(config),
        body: requestBody(config, req, stream),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutTimer);
      req.signal?.removeEventListener("abort", onCallerAbort);
    }
  } catch (cause) {
    // 매달림/응답 지연 — 내부 타임아웃 컨트롤러가 abort 한 경우만 여기(호출자 signal 과 구분).
    if (isLlmTimeoutError(cause) && !req.signal?.aborted) {
      // 공급자 일시 오류로 취급해 재시도 가능하게 한다.
      reportTransportHealth(false, 504, "요청 시간 초과");
      throw new LlmError(`요청 시간 초과(${LLM_REQUEST_TIMEOUT_MS / 1000}s): 공급자가 응답하지 않았습니다.`, 504);
    }
    if (req.signal?.aborted || isLlmAbortError(cause)) throw new LlmAbortError();
    const target = usesOhMyPiCompanion(config) ? DEFAULT_CHATGPT_BASE_URL : config.baseUrl;
    const hint = usesOhMyPiCompanion(config) ? " npm run ai:oauth로 로컬 동반 서비스를 실행하세요." : "";
    reportTransportHealth(false, undefined, `네트워크 오류(${target})`);
    throw new LlmError(`네트워크 오류: LLM 엔드포인트에 연결할 수 없습니다(${target}).${hint} ${cause instanceof Error ? cause.message : ""}`);
  }

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      /* ignore */
    }
    // 429(사용량 제한)는 연결 문제 아님 — 칩까지 붉히지 않는다.
    if (response.status !== 429) {
      reportTransportHealth(false, response.status, humanizeStatus(response.status, body, config.authMode));
    }
    throw new LlmError(humanizeStatus(response.status, body, config.authMode), response.status);
  }
  reportTransportHealth(true, response.status);

  const contentType = response.headers?.get("Content-Type") ?? "";
  if (stream && response.body && !contentType.toLowerCase().includes("application/json")) {
    return await parseSseStream(response.body, req.onToken, req.onReasoning, req.signal);
  }
  const json = (await response.json()) as Record<string, unknown>;
  return parseNonStream(json);
}
