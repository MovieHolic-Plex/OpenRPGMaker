// ai/llmClient.ts
// OpenAI Chat Completions 호환 LLM 클라이언트(의존성 추가 없이 fetch 직접 구현).
// 공급자: 사용자 설정 baseUrl(OpenAI 호환 엔드포인트). 기본 공급자를 하드코딩하지 않는다.
// - 스트리밍 SSE 파서(data: 라인 / [DONE] / tool_calls delta 조립) 포함.
// - 설정(baseUrl/model/liteModel/apiKey/maxToolCalls/maxTokens/reasoningEffort)은 localStorage(oprn:ai-config).
//   **API 키는 소스/프로젝트 JSON/localStorage 기본값에 하드코딩 금지.** 설정 UI로만 입력.
// - Node(테스트/스모크)에서는 config를 직접 주입해 사용한다.

import { defaultModelForAuthMode, isModelValidForAuthMode } from "@/ai/modelCatalog";
import { DEFAULT_EXECUTION_ROUTE, DEFAULT_PI_APPLY, isExecutionRoute, type ExecutionRoute, type PiApplyMode } from "@/ai/piAgent/executionRoute";
import type { AutonomyLevel } from "@/ai/autonomyLevels";
import { AUTONOMY_LEVEL_IDS } from "@/ai/autonomyLevels";
import { PRODUCT_BRAND } from "@/brand";
import { DEFAULT_OH_MY_PI_PROVIDER, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { parseImageDelivery, type ImageDelivery } from "./imageDelivery";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";

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
  /** Image output selection is independent of both chat models; credentials remain server-side. */
  imageProviderId?: string;
  imageModel?: string;
  baseUrl: string;
  // 감독 모델: 계획/공간추론/스펙 작성/검수 AssistantSession 대화 루프.
  model: string;
  // 실행 모델: 쓰기 툴 루프와 반복/배치 보조 호출. 저장값이 없으면 DEFAULT_LITE_MODEL을 쓴다.
  liteModel?: string;
  apiKey: string;
  // 라운드 안전핀. 기본은 후하게 잡고(2000), 설정 UI 에 노출하지 않는다. 사용자 제한은 maxTokens.
  maxToolCalls: number;
  maxTokens: number;
  reasoningEffort?: "off" | "low" | "medium" | "high";
  // 자율성 다이얼(설정 모달·컴포저 공용). agentMode·예산·planOnly 의 원천 — 다이얼 선택 시
  // 호출자가 resolveAutonomy 프리셋을 reasoningEffort·agentMode 에 함께 저장하므로, 세션은
  // reasoningEffort 수동값을 그대로 쓴다(다이얼 덮어쓰기 없음). 미지정(구형 blob/
  // 직접 주입 config)은 종래 동작 그대로 — 하네스는 필드가 있을 때만 레벨을 적용한다.
  autonomyLevel?: AutonomyLevel;
  // 작업 모드: "auto" = 플래너(작업 분해) 라운드를 모델 구성과 무관하게 상시 동작,
  // "chat" = 종래 동작(감독·실행 모델이 다를 때만 플래너). 미지정(구형 blob/테스트 주입)은
  // loadAiConfig가 "auto"로 백필하지만, 직접 주입된 config는 종래 판정을 유지한다.
  agentMode?: "auto" | "chat";
  // 지시의 기본 실행 경로(컴포저 「경로」 셀렉트·설정 공용). 미지정 옛 blob 은 Pi 에이전트.
  executionRoute?: ExecutionRoute;
  // Pi 경로의 적용 방식: review = 검토 카드에서 승인 후 적용(기본), auto = 게이트 통과 즉시 적용.
  piApply?: PiApplyMode;
}

// 기본값. apiKey는 localStorage 우선, 비어 있으면 dev env(VITE_LLM_API_KEY 등) 폴백.
// 저장 설정은 loadAiConfig가 존중한다.
export const DEFAULT_BASE_URL = "";
// 브라우저는 항상 페이지와 같은 오리진의 /v1 을 친다.
//
// 예전 preview 경로는 `http://127.0.0.1:17832/v1` 로 고정돼 있었다. 그건 oh-my-pi
// 동반 서비스가 **이 머신 루프백**에서 듣기 때문이다. `npm run dev` 는 vite 플러그인이
// 같은 포트에 /v1 을 붙이므로 괜찮았지만, `npm start`(preview) 를 Tailscale
// (`mdc-server:9888`) 로 열면 탭은 원격이고 127.0.0.1 은 **사용자 PC**라 동반 서비스에
// 닿지 않는다. 그래서 DEV/preview 를 가르지 않는다 — vite 가 configurePreviewServer 로
// 같은 핸들러를 붙인다.
export function companionCompletionsBaseUrl(_env?: { readonly DEV?: boolean }): string {
  return "/v1";
}
export const DEFAULT_CHATGPT_BASE_URL = companionCompletionsBaseUrl();
// 공장 기본은 Antigravity Gemini 3.7 Flash — 에디터 툴콜이 Codex 보다 안정적이다.
// 제공자는 Antigravity·Codex 둘 중 하나이고, 저장된 선택은 존중된다. providerId 가 없는
// 옛 blob 은 기본 제공자(Antigravity)로 읽히므로 이 상수가 그 blob 의 모델 기본값이기도 하다.
export const DEFAULT_MODEL = "gemini-3.7-flash";
// DEFAULT_LITE_MODEL: 실행 단계용. 기본은 DEFAULT_MODEL과 동일 → 이원화 비활성.
export const DEFAULT_LITE_MODEL = "gemini-3.7-flash";
// 추론 토큰을 먼저 쓰는 모델 함정(실측): 짧은 max_tokens 로 호출하면 추론 토큰만 소비되고
// content 가 빈 문자열로 돌아온다(실측: max_tokens 16 → content "" 이면서 completion 13토큰
// 소비, 512 → 정상). 그래서 출력 예산을 넉넉히 잡는다.
export const DEFAULT_MAX_TOKENS = 200_000;
export const DEFAULT_MAX_TOOL_CALLS = 2000;

/** 저장 blob·주입 config 의 autonomyLevel 검증. AUTONOMY_LEVEL_IDS(5단계) 만 통과한다. */
export function isAutonomyLevel(raw: unknown): raw is AutonomyLevel {
  return (AUTONOMY_LEVEL_IDS as readonly unknown[]).includes(raw);
}
/** 저장 blob 에 남아 있으면 '옛 공장 기본'으로 보고 새 기본으로 승격한다. */
const LEGACY_DEFAULT_MAX_TOKENS = new Set([2048, 10240, 32768]);
const LEGACY_DEFAULT_MAX_TOOL_CALLS = new Set([200]);

// envApiKey()/envBaseUrl() 은 제거했다. `VITE_LLM_API_URL` 이 에디터의 authMode·baseUrl 을 정하던
// 통로였고, 그게 AI 를 반복적으로 죽인 원인이다(근거는 defaultAiConfig 주석). OAuth 는 클라이언트
// 키를 쓰지 않으므로 `VITE_LLM_API_KEY`/`VITE_YUNWU_API_KEY` 폴백도 함께 없앴다 — 번들에 키를
// 인라인하던 경로이기도 하다. 게이트웨이가 필요한 소비자는 `src/benchmark/llmClient.ts` 처럼
// 자기 baseUrl·키를 자기가 들고 간다.

/**
 * 에디터 AI 의 기본 설정. **인증은 무조건 OAuth 다**(감독 지시 2026-08-21).
 *
 * env 는 authMode 를 정하지 못한다. 예전에는 `VITE_LLM_API_URL` 이 있으면 apiKey 모드로
 * 부팅했는데, 그 추론이 에디터 AI 를 반복적으로 죽인 단일 원인이었다. 실측(2026-08-21):
 * 커밋된 `.env` 1행 `VITE_LLM_API_URL=/api/ai` 와 `.env.local` 의 `/api/cliproxy` 가
 * authMode 를 apiKey 로 강제했고, `/api/cliproxy` 는 vite 프록시가 없어 POST 가 404 였다.
 * 같은 시점 OAuth 경로는 멀쩡했다(`POST /v1/chat/completions` → 200 "OK", gpt-5.6-sol).
 * 즉 env 한 줄이 에디터의 모든 AI(어시스턴트·이벤트·영역·타일셋)를 동시에 죽일 수 있었다.
 *
 * env 값을 지우는 것만으로 끝내지 않는 이유: 다음에 누가 `.env` 에 한 줄 넣으면 또 전부
 * 죽는다. 그래서 추론 자체를 없앤다. 게이트웨이가 필요한 소비자(벤치마크, 노드 스크립트)는
 * 자기 baseUrl 을 자기가 들고 간다 — 에디터 설정에 얹혀 가지 않는다.
 */
export function defaultAiConfig(): AiConfig {
  return {
    authMode: "chatgpt",
    providerId: DEFAULT_OH_MY_PI_PROVIDER,
    imageProviderId: DEFAULT_IMAGE_PROVIDER_ID,
    imageModel: DEFAULT_IMAGE_MODEL,
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    liteModel: DEFAULT_LITE_MODEL,
    // OAuth 는 클라이언트 키를 쓰지 않는다. 동반 서비스(pi-ai)가 자기 저장소의 자격 증명으로
    // 전송하므로 여기서 env 키를 실어 보내면 apiKey 경로가 되살아난다.
    apiKey: "",
    maxToolCalls: DEFAULT_MAX_TOOL_CALLS,
    maxTokens: DEFAULT_MAX_TOKENS,
    // 감독 단계 기본 추론 강도. 벽시계·비용을 아끼려고 낮게 시작한다(실행 단계는 off).
    reasoningEffort: "low",
    agentMode: "auto",
    autonomyLevel: "balanced",
  };
}

export const AI_CONFIG_STORAGE_KEY = "oprn:ai-config";

/** 저장 blob 스키마 버전. scrubStoredAiCredentials 의 멱등 표식이다. */
export const AI_CONFIG_VERSION = 2;

/**
 * 저장된 blob 에서 **평문 키와 죽은 게이트웨이 주소를 지운다.** 부팅 시 1회. 멱등.
 *
 * loadAiConfig 는 이미 그 필드들을 무시하지만, **디스크에는 blob 이 덮어써질 때까지 남는다.**
 * 인증 패널이 "브라우저에는 두지 않습니다" 라고 약속하는데 그게 미래 키에만 적용되면 약속이
 * 아니다. 남은 키는 export·디버그 덤프·raw blob 을 읽는 미래 코드에 그대로 실려 나간다.
 *
 * **loadAiConfig 안에 넣지 않는다** — `load*` 이름의 함수가 몰래 쓰기를 하면 반드시 누군가를
 * 물린다(테스트와 상태 칩이 이 함수를 수시로 호출한다). 부팅 시 명시적으로 한 번 부른다.
 */
export function scrubStoredAiCredentials(): {
  scrubbed: boolean;
  hadApiKey: boolean;
  hadBaseUrl: boolean;
} {
  const untouched = { scrubbed: false, hadApiKey: false, hadBaseUrl: false };
  if (typeof localStorage === "undefined") return untouched;
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return untouched;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Number(parsed.configVersion) >= AI_CONFIG_VERSION) return untouched;
    const hadApiKey = typeof parsed.apiKey === "string" && parsed.apiKey.trim().length > 0;
    const hadBaseUrl = typeof parsed.baseUrl === "string" && parsed.baseUrl.trim().length > 0;
    const next = {
      ...parsed,
      authMode: "chatgpt",
      apiKey: "",
      baseUrl: DEFAULT_BASE_URL,
      configVersion: AI_CONFIG_VERSION,
    };
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(next));
    return { scrubbed: true, hadApiKey, hadBaseUrl };
  } catch {
    // blob 이 깨져 있으면 건드리지 않는다 — loadAiConfig 가 기본값으로 처리한다.
    return untouched;
  }
}

// localStorage 로드. 저장된 값이 없거나 깨졌으면 기본값. 저장값은 기본값 위에 병합.
//
// **인증은 무조건 OAuth 다.** 저장값이 authMode 를 apiKey 로 되돌리지 못한다. 예전 판정은
// 저장된 baseUrl 이나 apiKey 가 있으면 apiKey 모드로 추론했는데, 그러면 감독이 한 번이라도
// 게이트웨이를 저장한 브라우저는 env 를 고쳐도 계속 죽은 경로를 쳤다 — 이번 장애의 절반이
// 이것이다(실측: 저장된 baseUrl `/api/cliproxy` 가 POST 404).
export function loadAiConfig(): AiConfig {
  const base = defaultAiConfig();
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    const authMode = "chatgpt" as const;
    if (parsed.authMode === "apiKey") {
      console.warn(
        "[llmClient] 저장된 apiKey 설정을 OAuth 로 승격했습니다 — 에디터 AI 의 인증은 OAuth 하나뿐입니다."
      );
    }
    // 저장된 사용자 모델은 존중하되 비었으면 기본값.
    // trim 한 저장값을 먼저 뽑고 || 폴백으로 단순화한다 — 각 표현식이 모두 string 으로 끝나
    // TS 가 string 으로 확정한다(아래 isModelValidForAuthMode 가 string 을 요구). base.liteModel 은
    // AiConfig 의 선택 필드지만 defaultAiConfig() 가 항상 DEFAULT_LITE_MODEL 을 채우므로 ?? base.model 로
    // undefined 여지만 없앤다. 런타임 값은 이전 삼항 표현식과 동일하다.
    const storedModel = typeof parsed.model === "string" ? parsed.model.trim() : "";
    let model: string = storedModel || base.model;
    const storedLiteModel = typeof parsed.liteModel === "string" ? parsed.liteModel.trim() : "";
    let liteModel: string = storedLiteModel || storedModel || (base.liteModel ?? base.model);
    // 제공자는 **Antigravity 와 Codex 둘 중 하나**다. 저장된 선택은 그대로 존중하고,
    // 레지스트리에 없는 값(옛 zai/xiaomi/… 나 오타)은 parseOhMyPiProvider 가 기본 제공자로
    // 스냅한다 — 사라진 제공자 id 가 살아남아 동반 서비스에 그대로 실려 나가는 것을 막는다.
    // providerId 가 없는 옛 blob 도 같은 경로로 기본 제공자가 된다.
    // authMode 는 위에서 이미 "chatgpt" 로 고정돼 있다.
    const providerId = parseOhMyPiProvider(parsed.providerId);
    // 모델 검증은 **선택된 제공자 기준**이다. 다른 제공자의 모델(Antigravity 에 gpt-5.6-sol,
    // Codex 에 gemini-3.7-flash)은 그대로 보내면 조용히 강등되거나 400 이 되므로, 여기서
    // 그 제공자의 권장 기본값으로 교정한다 — 사용자의 localStorage 가 스스로 낫는다.
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
      // Preserve explicit image choices, even unsupported ones; never silently demote them.
      imageProviderId: typeof parsed.imageProviderId === "string" && parsed.imageProviderId.trim()
        ? parsed.imageProviderId.trim() : DEFAULT_IMAGE_PROVIDER_ID,
      imageModel: typeof parsed.imageModel === "string" && parsed.imageModel.trim()
        ? parsed.imageModel.trim() : DEFAULT_IMAGE_MODEL,
      // 저장된 baseUrl 은 버린다. OAuth 는 동반 서비스 경로가 고정이고(endpoint() 가
      // usesOhMyPiCompanion 이면 DEFAULT_CHATGPT_BASE_URL 을 쓴다), 죽은 게이트웨이 URL 을
      // 남겨 두면 설정 화면·가용성 검지가 그것을 계속 진실처럼 보여 준다.
      baseUrl: base.baseUrl,
      model,
      liteModel,
      // OAuth 는 클라이언트 키를 쓰지 않는다 — 저장된 키도, env 키도 싣지 않는다.
      apiKey: "",
      maxToolCalls: Number.isFinite(parsed.maxToolCalls) && Number(parsed.maxToolCalls) > 0
        ? (LEGACY_DEFAULT_MAX_TOOL_CALLS.has(Math.floor(Number(parsed.maxToolCalls)))
          ? base.maxToolCalls
          : Math.floor(Number(parsed.maxToolCalls)))
        : base.maxToolCalls,
      // 옛 공장 기본(2048/10240/32768)이 저장돼 있으면 미설정으로 간주하고 새 기본으로 승격.
      maxTokens: Number.isFinite(parsed.maxTokens) && !LEGACY_DEFAULT_MAX_TOKENS.has(Number(parsed.maxTokens))
        ? Number(parsed.maxTokens)
        : base.maxTokens,
      reasoningEffort:
        parsed.reasoningEffort === "off" || parsed.reasoningEffort === "low" || parsed.reasoningEffort === "medium" || parsed.reasoningEffort === "high"
          ? parsed.reasoningEffort
          : base.reasoningEffort,
      // agentMode 백필(위 liteModel 패턴과 동일): 필드가 없는 옛 blob과 이상한 값은
      // 기본값 "auto"로 정규화한다. "chat"만 명시적으로 유지된다.
      agentMode: parsed.agentMode === "chat" ? "chat" : "auto",
      // 자율성 다이얼 백필: 알려진 id 만 인정하고, 없는 옛 blob·이상한 값은 "balanced".
      autonomyLevel: isAutonomyLevel(parsed.autonomyLevel) ? parsed.autonomyLevel : "balanced",
      executionRoute: isExecutionRoute(parsed.executionRoute) ? parsed.executionRoute : DEFAULT_EXECUTION_ROUTE,
      piApply: parsed.piApply === "auto" ? "auto" : DEFAULT_PI_APPLY,
    };
  } catch {
    return base;
  }
}

export function saveAiConfig(config: AiConfig): void {
  if (typeof localStorage === "undefined") return;
  // 제공자는 저장 시점에도 레지스트리 값으로 정규화한다. 프로그램 경로(설정 저장·마이그레이션)가
  // 레지스트리 밖 id 를 디스크에 남기면 다음 판독이 흔들리기 때문 — 두 제공자 중 하나로 못박되,
  // 사용자가 고른 Codex 를 Antigravity 로 되돌리지는 않는다.
  const normalized: AiConfig = { ...config, providerId: parseOhMyPiProvider(config.providerId) };
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
}

export function configForLiteModel(config: AiConfig): AiConfig {
  // liteModel 미설정 시 감독 model을 따라간다(일원화). 감독을 바꾸면 영역 작업 실행도 함께 바뀌고,
  // 각 authMode(chatgpt OAuth / apiKey)의 baseUrl·게이트웨이 경로가 일관되게 유지된다.
  // DEFAULT_LITE_MODEL은 defaultAiConfig() 초기값으로만 의미를 가진다.
  const liteModel = config.liteModel?.trim() || config.model.trim() || DEFAULT_LITE_MODEL;
  // 실행(툴 루프) 단계는 추론 비활성 — 벽시계·비용 폭주 방지.
  return { ...config, model: liteModel, liteModel, reasoningEffort: "off" };
}

// 모델 이름을 보고 reasoning effort 를 몰래 내리던 정책(`isLongReasoningModel` /
// `configWithReasoningPolicy`)은 걷어냈다. 그 캡은 특정 공급자 하나(장문 추론 모델)만
// 겨냥한 문자열 매칭이었고, 그 공급자를 더 쓰지 않으므로 남은 분기는 항등 함수였다.
// 사용자가 고른 reasoningEffort 는 이제 그대로 요청에 실린다. 공급자가 reasoning 필드를
// 아예 거부하는 경우는 ProviderCapability.supportsReasoningField 가 데이터로 처리한다.

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
  // JSON 전용 응답 강제(OpenAI 호환). 타일셋 매핑·성향 증류처럼 산출물이 JSON 객체 하나인 호출용.
  // 이 필드가 없던 동안 그런 호출들은 llmClient를 우회해 직접 fetch 했고, 그래서 OAuth 분기와
  // 재시도·타임아웃을 각자 재구현하다 조용히 죽었다(tilesetAiClient 주석의 2026-08-21 사고).
  response_format?: { type: "json_object" };
  // 분류/추출 호출의 표집 온도. 대화 경로는 지정하지 않아 공급자 기본값을 쓴다(현행 동작).
  // 직접 fetch 하던 타일셋 매핑이 0.2를 쓰고 있었고, 흡수하면서 그 값을 잃지 않으려 통과시킨다.
  temperature?: number;
}

export interface ChatResult { message: ChatMessage; finishReason: string | null; imageDelivery?: readonly ImageDelivery[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }

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

export function humanizeLlmStatus(status: number, body: string, authMode: AiConfig["authMode"]): string {
  const detail = body ? ` — ${body.slice(0, 300)}` : "";
  switch (status) {
    case 401:
      return authMode === "chatgpt"
        ? `Google Gemini 로그인이 필요합니다(401). AI 설정에서 Google 계정으로 로그인하세요.${detail}`
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

/**
 * 이 URL 이 동반 서비스 주소인가. **전송 축 판정에는 더 이상 쓰이지 않는다**(aiTransport 참고) —
 * 저장돼 있던 baseUrl 이 사실 동반 서비스였는지 사후 식별하는 진단·마이그레이션 용도로만 남긴다.
 */
export function isCompanionBaseUrl(url: string): boolean {
  const trimmed = url.trim().replace(/\/$/, "");
  return trimmed === "/v1"
    || trimmed === "http://127.0.0.1:17832/v1"
    || trimmed === "http://localhost:17832/v1";
}

/**
 * 전송 축 — 요청이 어디로 나가는가.
 *
 * - `companion`: 로컬 동반 서비스(oh-my-pi). 자격 증명은 그쪽이 보관하고, 브라우저는
 *   `X-Rpgzzu-Provider` 로 제공자만 지목한다. **에디터 UI 는 항상 이쪽이다.**
 * - `gateway`: `config.baseUrl` 로 직접 나간다(`Authorization: Bearer`). 노드 스크립트·evals·
 *   벤치마크처럼 **설정을 직접 주입하는 소비자 전용**이고 사용자 UI 는 없다.
 *
 * 자격 증명 종류(oauth/apiKey/local)는 이 축과 **무관**하다 — 그건 providerId 에서 파생한다
 * (`ohMyPiAuthKind`). 동반 서비스는 OAuth 토큰도 API 키도 자기 저장소에 보관하기 때문에,
 * "API 키를 쓴다"가 "게이트웨이로 나간다"를 뜻하지 않는다.
 *
 * `authMode` 값 이름(`"chatgpt"`)은 역사적 잔재다. 영속 포맷이자 주입 와이어 포맷이라
 * 개명하지 않고 뜻만 여기서 고정한다.
 */
export type AiTransport = "companion" | "gateway";

export function aiTransport(config: AiConfig): AiTransport {
  return config.authMode === "chatgpt" ? "companion" : "gateway";
}

/**
 * 동반 서비스 전송인가. `aiTransport(config) === "companion"` 의 별칭이다.
 *
 * 예전에는 `isCompanionBaseUrl(config.baseUrl)` 도 함께 봐서 **baseUrl 문자열이 선언된
 * authMode 를 덮어썼다.** 주입 설정(`authMode:"apiKey"`)의 의도를 조용히 뒤집는 구조라
 * 걷어냈다 — 전송 축은 authMode 하나만 정한다.
 */
export function usesOhMyPiCompanion(config: AiConfig): boolean {
  return aiTransport(config) === "companion";
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
// 스트리밍·reasoning 을 지원하는 공급자까지 손해 본다. 그래서 제약을 데이터로 선언하고 본문
// 구성(requestBody)·전송 방식(chatCompletionOnce)에서 걸러낸다.
//
// 지금 남은 공급자는 제약이 없어 providerCapability 가 전부 지원을 돌려준다. 제약이 있는
// 공급자가 다시 들어오면 이 선언에 그 공급자만 추가하면 된다.
export interface ProviderCapability {
  /** 스트리밍(stream:true) 지원 여부. false 면 비스트리밍 경로를 탄다. */
  readonly supportsStreaming: boolean;
  /** OpenAI 호환 reasoning 필드 지원 여부. false 면 본문에서 reasoning 을 뺀다. */
  readonly supportsReasoningField: boolean;
  /** max_tokens 상한. undefined 면 제한 없음. */
  readonly maxTokensCeiling?: number;
  /** 메시지의 `name` 필드 지원 여부. false 면 본문에서 떼어낸다. */
  readonly supportsMessageName: boolean;
}

/**
 * 설정에서 공급자 능력을 판정한다. 지금 남은 공급자(apitopia·동반 서비스 OAuth)는 스트리밍·
 * reasoning·message name 을 모두 지원하므로 제한이 없다.
 *
 * hasTools 는 공급자별 제약이 다시 생길 때를 위한 자리다 — 현재 판정에는 쓰이지 않는다.
 */
export function providerCapability(
  _config: AiConfig,
  _opts?: { readonly hasTools?: boolean },
): ProviderCapability {
  return { supportsStreaming: true, supportsReasoningField: true, supportsMessageName: true };
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
 * 이 필드를 거부하는 공급자가 있었다(실측 400 unsupported_field messages[3].name).
 * 첫 요청에는 tool 메시지가 없어 200 이 나고 **툴을 한 번 쓴 다음 턴부터** 깨져서
 * "AI 가 답은 하는데 아무것도 못 만든다" 로 보였다.
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
  const capability = providerCapability(config, { hasTools: Boolean(req.tools && req.tools.length > 0) });
  // 공급자 max_tokens 상한이 선언돼 있으면 클램프한다.
  let maxTokens = config.maxTokens;
  if (capability.maxTokensCeiling !== undefined && maxTokens > capability.maxTokensCeiling) {
    warnCapabilityOnce(
      `maxTokens:${config.model}`,
      `[llmClient] 공급자 제약: ${config.model} 의 max_tokens 를 ${maxTokens} → ${capability.maxTokensCeiling} 로 클램프했습니다(실측 기반 상한).`,
    );
    maxTokens = capability.maxTokensCeiling;
  }
  const body: Record<string, unknown> = {
    model: config.model,
    messages: capability.supportsMessageName ? req.messages : stripMessageNames(req.messages),
    stream,
    max_tokens: maxTokens,
  };
  // 스트리밍에서도 usage(prompt_tokens 등)를 마지막 청크로 받는다(OpenAI 호환).
  // 미지원 공급자가 usage를 안 주면 소비 측(tokenBudget 관측)이 조용히 건너뛴다.
  if (stream) body.stream_options = { include_usage: true };
  if (req.tools && req.tools.length > 0) { body.tools = req.tools; body.tool_choice = req.tool_choice ?? "auto"; }
  if (req.response_format) body.response_format = req.response_format;
  if (typeof req.temperature === "number" && Number.isFinite(req.temperature)) body.temperature = req.temperature;
  // reasoning 필드는 공급자가 지원할 때만 붙인다(실측: 과거 게이트웨이는 reasoning → 400).
  if (config.reasoningEffort && config.reasoningEffort !== "off") {
    if (capability.supportsReasoningField) {
      body.reasoning = { effort: config.reasoningEffort };
    } else {
      warnCapabilityOnce(
        `reasoning:${config.model}`,
        `[llmClient] 공급자 제약: ${config.model} 은(는) reasoning 필드를 지원하지 않아 본문에서 뺐습니다.`,
      );
    }
  }
  return JSON.stringify(body);
}

// 스트리밍 tool_calls delta 누적기(index별로 id/name/arguments를 이어붙인다).
interface ToolCallAccum { id: string; name: string; arguments: string }

/**
 * tool_call_id 를 **호출마다 유일**하게 만든다.
 *
 * 왜(2026-08-30 실측): 두 파싱 경계가 모두 id 없는 응답을 그대로 통과시켰다. 스트리밍은 빈 id 를
 * `call_${name}` 으로 채워 **같은 툴을 병렬로 2회 호출하면 두 호출이 같은 id** 를 갖고,
 * 비스트리밍은 `String(tc.id ?? "")` 로 **빈 문자열 id** 를 만들었다. 세션은 호출마다
 * `role:"tool"` 응답에 그 id 를 실으므로 결과는 중복·빈 `tool_call_id` 다 — OpenAI 호환
 * 게이트웨이는 400 으로 턴을 죽이고, Gemini Cloud Code Assist 는 function response 짝을
 * 못 맞춰 다음 라운드부터 대화를 거부한다. 공급자가 준 id 는 그대로 존중하고, 없거나 겹칠
 * 때만 위치를 섞어 유일하게 만든다.
 */
function uniqueToolCallId(raw: string, position: number, name: string, used: Set<string>): string {
  const trimmed = raw.trim();
  const base = trimmed.length > 0 ? trimmed : `call_${position}_${name.length > 0 ? name : "tool"}`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = position;
  let candidate = `${base}_${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

function assembleToolCalls(accum: Map<number, ToolCallAccum>): ToolCall[] | undefined {
  if (accum.size === 0) return undefined;
  const used = new Set<string>();
  return [...accum.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, tc], position) => ({
      id: uniqueToolCallId(tc.id, position, tc.name, used),
      type: "function" as const,
      function: { name: tc.name, arguments: tc.arguments },
    }));
}

/**
 * `index` 없는 delta 의 슬롯을 고른다.
 *
 * 왜(2026-08-30 실측): 옛 구현은 `index` 가 없으면 무조건 0 이었다. 한 delta 배치에 병렬 툴콜
 * 2건이 오면 둘이 같은 슬롯에 누적돼 이름과 인자가 이어붙었다 — `fill_region` + `place_npc`
 * → 이름 `"fill_regionplace_npc"`, 인자 `'{"a":1}{"b":2}'`. 남는 것은 `등록되지 않은 툴`
 * 한 건이고 두 호출은 통째로 사라진다.
 *
 * 규칙: 배치 안의 위치를 기본 슬롯으로 쓰고, 그 슬롯이 이미 **이름을 가진** 호출인데 이 delta
 * 가 또 새 이름을 선언하면 이어붙이기가 아니라 새 호출이므로 빈 슬롯을 새로 딴다. 인자만 담긴
 * 후속 청크는 이름을 선언하지 않으므로 같은 슬롯에 정상적으로 이어붙는다.
 */
function toolCallDeltaSlot(accum: Map<number, ToolCallAccum>, delta: Record<string, unknown>, position: number): number {
  if (typeof delta.index === "number") return delta.index;
  const existing = accum.get(position);
  const fn = delta.function as Record<string, unknown> | undefined;
  const declaresName = typeof fn?.name === "string" && fn.name.length > 0;
  if (!existing || existing.name.length === 0 || !declaresName) return position;
  return Math.max(...accum.keys()) + 1;
}

function applyToolCallDelta(accum: Map<number, ToolCallAccum>, deltas: unknown): void {
  if (!Array.isArray(deltas)) return;
  (deltas as Array<Record<string, unknown>>).forEach((d, position) => {
    const index = toolCallDeltaSlot(accum, d, position);
    const cur = accum.get(index) ?? { id: "", name: "", arguments: "" };
    if (typeof d.id === "string") cur.id = d.id;
    const fn = d.function as Record<string, unknown> | undefined;
    if (fn) {
      if (typeof fn.name === "string") cur.name += fn.name;
      if (typeof fn.arguments === "string") cur.arguments += fn.arguments;
    }
    accum.set(index, cur);
  });
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
function parseNonStream(json: Record<string, unknown>, requestedModel?: string): ChatResult {
  // 응답의 model 은 **해석된** 모델이다 — 요청한 것과 다르면 제공자가 조용히 바꾼 것이다.
  if (requestedModel && typeof json.model === "string") reportModelDemotion(requestedModel, json.model);
  const choices = json.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const msg = (choice?.message ?? {}) as Record<string, unknown>;
  const rawToolCalls = msg.tool_calls as Array<Record<string, unknown>> | undefined;
  const usedIds = new Set<string>();
  const tool_calls: ToolCall[] | undefined = rawToolCalls?.map((tc, position) => {
    const name = String((tc.function as Record<string, unknown> | undefined)?.name ?? "");
    return {
      // 숫자 id 를 주는 게이트웨이도 있다 — 문자열로 정규화만 하고 값은 버리지 않는다.
      id: uniqueToolCallId(tc.id === undefined || tc.id === null ? "" : String(tc.id), position, name, usedIds),
      type: "function" as const,
      function: {
        name,
        arguments: String((tc.function as Record<string, unknown> | undefined)?.arguments ?? ""),
      },
    };
  });
  const message: ChatMessage = {
    role: "assistant",
    content: typeof msg.content === "string" ? msg.content : null,
  };
  if (tool_calls && tool_calls.length > 0) message.tool_calls = tool_calls;
  if (typeof msg.reasoning === "string") message.reasoning = msg.reasoning;
  return {
    message,
    finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
    imageDelivery: parseImageDelivery(json.image_delivery),
    usage: json.usage as ChatResult["usage"] | undefined,
  };
}

// 일시 오류(네트워크/429/5xx) 자동 재시도 1회의 백오프(도그푸딩 결함 ⑥).
export const LLM_RETRY_BACKOFF_MS = 1500;

// 단일 LLM 요청 수명 상한(실측 2026-08-15 자율 런): 게이트웨이가 매달려 응답을
// 안 주면 턴이 영원히 대기했다. 게이트웨이 정상 응답은 50초 안팎까지 관측되므로 넉넉한
// 180초로 매달림만 잡고 정상 체감은 해치지 않는다. 초과 시 504 로 일시 오류 처리(재시도 경로).
export const LLM_REQUEST_TIMEOUT_MS = 180_000;

// 재시도해 볼 만한 오류인가 — 네트워크(상태 없음)/요청 한도(429)/서버 오류(5xx).
// 인증(401)/크레딧(402) 같은 영구 오류는 재시도하지 않는다.
export function isRetryableLlmError(error: unknown): boolean {
  if (!(error instanceof LlmError)) return false;
  return error.status === undefined || error.status === 0 || error.status === 429 || error.status >= 500;
}

/** 로컬 oh-my-pi Bun 워커 프로세스 크래시. 같은 페이로드로 3연타는 복구가 아니라 대기만 늘린다. */
export function isOhMyPiWorkerCrash(error: unknown): boolean {
  return error instanceof LlmError && /oh-my-pi worker exited/i.test(error.message);
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

export const AI_TRANSPORT_HEALTH_EVENT = "oprn:ai-transport-health";

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

/** 요청한 모델과 실제로 답한 모델이 다를 때의 기록. */
export interface AiModelDemotion {
  readonly requested: string;
  readonly served: string;
  readonly at: number;
}

let aiModelDemotion: AiModelDemotion | null = null;

export function getAiModelDemotion(): AiModelDemotion | null {
  return aiModelDemotion;
}

/** 테스트용 — 상태를 초기화한다. */
export function resetAiModelDemotion(): void {
  aiModelDemotion = null;
}

/**
 * **모델 강등을 조용히 넘기지 않는다.**
 *
 * 동반 서비스의 `resolveModel` 은 카탈로그 밖 모델 ID 를 오류가 아니라 제공자 기본 모델로
 * 바꿔 버린다 — 두 제공자 모두. 그래서 감독이 고른 모델이 아닌 것이 답해도 아무 신호가 없었다.
 * `isModelValidForAuthMode` 는 Codex 만 카탈로그 화이트리스트로 막고 Antigravity 는 gemini
 * 네임스페이스만 본다 — 사용자가 직접 입력한 새 gemini 변형이 강등되는 경우는 여기서만 보인다.
 *
 * 다행히 응답 본문의 `model` 은 **해석된** 모델이다(assistantToOpenAI 가 그렇게 채운다).
 * 서버를 고치지 않고도 요청 모델과 비교하면 강등이 보인다 — 이 함수가 그 비교를 기록한다.
 * 치명적으로 만들지는 않는다: 강등된 응답도 쓸 수 있는 응답이므로 크게 말하고 넘긴다.
 */
export function reportModelDemotion(requested: string, served: string): void {
  const a = requested.trim();
  const b = served.trim();
  if (!a || !b || a.toLowerCase() === b.toLowerCase()) return;
  const changed = aiModelDemotion?.requested !== a || aiModelDemotion?.served !== b;
  aiModelDemotion = { requested: a, served: b, at: Date.now() };
  if (!changed) return;
  console.warn(`[llmClient] 요청한 모델 '${a}' 대신 '${b}' 이(가) 답했습니다 — 제공자가 조용히 다른 모델로 바꿨습니다.`);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
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
  // 공급자가 스트리밍을 지원하지 않으면 비스트리밍으로 확정한다(실측: 과거 게이트웨이는 stream:true → 400).
  // 여기서 확정해야 아래 requestBody(본문)와 응답 파싱 분기가 같은 stream 값으로 일관된다 —
  // 본문에서만 stream 을 false 로 바꾸면 응답 파싱이 SSE 를 기대해 깨진다.
  let stream = wantsStream;
  const hasTools = Boolean(req.tools && req.tools.length > 0);
  if (stream && !providerCapability(config, { hasTools }).supportsStreaming) {
    warnCapabilityOnce(
      `stream:${config.model}:${hasTools ? "tools" : "text"}`,
      `[llmClient] 공급자 제약: ${config.model}${hasTools ? "(툴 포함 요청)" : ""} 은(는) 스트리밍을 지원하지 않아 비스트리밍으로 전환했습니다.`,
    );
    stream = false;
  }
  let response: Response;
  try {
    // 실측(2026-08-15 자율 런): 게이트웨이가 요청을 조용히 매달아(응답 없음) 턴이
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
    reportTransportHealth(false, 0, `네트워크 오류(${target})`);
    throw new LlmError(`네트워크 오류: LLM 엔드포인트에 연결할 수 없습니다(${target}).${hint} ${cause instanceof Error ? cause.message : ""}`, 0);
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
      reportTransportHealth(false, response.status, humanizeLlmStatus(response.status, body, config.authMode));
    }
    throw new LlmError(humanizeLlmStatus(response.status, body, config.authMode), response.status);
  }
  reportTransportHealth(true, response.status);

  const contentType = response.headers?.get("Content-Type") ?? "";
  if (stream && response.body && !contentType.toLowerCase().includes("application/json")) {
    return await parseSseStream(response.body, req.onToken, req.onReasoning, req.signal);
  }
  const json = (await response.json()) as Record<string, unknown>;
  // 요청 모델을 넘겨 응답의 model 과 비교한다 — 조용한 강등을 눈에 보이게 만든다.
  return parseNonStream(json, config.model);
}
