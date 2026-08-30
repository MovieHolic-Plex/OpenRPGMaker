// 타일셋 매핑 호출. **전송은 llmClient.chatCompletion 하나로 모은다.**
//
// 예전에는 이 파일이 직접 fetch 하면서 companion/proxyAuth 분기와 X-Rpgzzu-Provider·Authorization
// 헤더를 손으로 조립했다. 그 중복 때문에 에디터 AI 가 OAuth 전용으로 바뀐 뒤 여기만 갱신되지 않아
// 타일셋 AI 가 무증상으로 죽어 있었다(실측 2026-08-21). 헤더·인증·엔드포인트 판정을 llmClient 에
// 넘기면 그 사고 유형이 구조적으로 막히고, 1회 자동 재시도·타임아웃·전송 건강/모델 강등 보고도 함께 붙는다.
//
// 버린 것: routing.max_input_per_1m (cpenrouter 게이트웨이 전용 비용 상한). 동반 서비스 경로에서는
// 이미 보내지 않고 있었고, 인증이 OAuth 전용이 된 뒤 남은 경로가 없다. 비용은 모델 선택으로 통제한다.
// 지킨 것: max_tokens 8192(매핑 JSON 이 길다 — 설정의 기본 예산으로는 잘린다), temperature 0.2.
import {
  chatCompletion,
  isProxyAuth,
  loadAiConfig,
  LlmError,
  usesOhMyPiCompanion,
  type ContentPart,
} from "@/ai/llmClient";
import { composeSystemPrompt } from "@/ai/systemPromptEnvelope";

export type CpenTilesetRequest = {
  readonly prompt: string;
  readonly imageDataUrl: string;
};

const MAX_OUTPUT_TOKENS = 8192;
const SAMPLING_TEMPERATURE = 0.2;
const LOCAL_STORAGE_KEY = "oprn:llmApiKey";
const JSON_ONLY_SYSTEM_PROMPT =
  "Return exactly one JSON object for the requested tileset metadata. Do not quote the schema, do not include markdown, prose, code fences, or hidden reasoning. If uncertain, fill minimumQuestions and keep fields conservative.";

export async function requestCpenTilesetMapping(request: CpenTilesetRequest): Promise<string> {
  const config = loadAiConfig();
  // 인증 준비 판정만 여기서 한다(버튼 게이트와 같은 기준). 실제 헤더 조립은 llmClient 몫이다.
  if (!usesOhMyPiCompanion(config) && !isProxyAuth(config) && !(config.apiKey?.trim() || readApiKey())) {
    return "AI 설정이 아직 연결되지 않았습니다. 로컬 설정을 확인해 주세요.";
  }

  try {
    const result = await chatCompletion(
      // 매핑 JSON 은 길다 — 설정의 maxTokens(기본 예산)를 쓰면 중간에서 잘린다.
      { ...config, maxTokens: MAX_OUTPUT_TOKENS },
      {
        messages: [
          {
            role: "system",
            // 공용 봉투 경유. 정책·성향 모두 끈다 — 산출물이 스키마 고정 JSON 이라 사람 취향이
            // 분류 결과에 개입할 자리가 없고, 톤 규칙은 JSON 출력과 충돌한다.
            content: composeSystemPrompt({ surface: "tileset-analysis", body: JSON_ONLY_SYSTEM_PROMPT }),
          },
          { role: "user", content: messageContent(request) },
        ],
        response_format: { type: "json_object" },
        temperature: SAMPLING_TEMPERATURE,
      },
    );
    const content = result.message.content;
    const responseText = typeof content === "string"
      ? content
      : (content ?? []).map((part) => (part.type === "text" ? part.text : "")).filter(Boolean).join("\n");
    return responseText ? normalizeCpenResponseText(responseText) : "AI 응답을 읽지 못했습니다.";
  } catch (error) {
    // LlmError.message 는 humanizeLlmStatus 가 만든 문장이다(401/402/429 에 조치 안내가 붙는다).
    // 예전의 `HTTP <status> <body>` 원문 덤프보다 사용자가 할 일을 알 수 있다.
    if (error instanceof LlmError) return `AI 호출 실패: ${error.message}`;
    if (error instanceof Error && error.name === "AbortError") {
      return "AI 응답 시간이 초과되었습니다. 다시 분석해 주세요.";
    }
    if (error instanceof TypeError) {
      return "AI 호출 실패: 네트워크 연결 또는 프록시 설정을 확인해 주세요.";
    }
    throw error;
  }
}

export function normalizeCpenResponseText(responseText: string): string {
  const trimmed = responseText.trim();
  if (isMappingJson(trimmed)) return trimmed;
  const fencedJson = extractFencedJson(trimmed);
  if (fencedJson && isMappingJson(fencedJson)) return fencedJson;
  const objectJson = extractBalancedObject(trimmed);
  if (objectJson && isMappingJson(objectJson)) return objectJson;
  return responseText;
}

export function hasCpenTilesetApiKey(): boolean {
  const config = loadAiConfig();
  // OAuth 는 클라이언트 키가 없는 것이 정상이다 — 키 유무로 게이트하면 타일셋 AI 버튼이
  // OAuth 환경에서 영구히 잠긴다.
  return usesOhMyPiCompanion(config) || isProxyAuth(config) || (config.apiKey?.trim() || readApiKey()).length > 0;
}

// llmClient 의 ContentPart 를 그대로 쓴다 — 사본 타입을 두면 필드가 어긋나도 컴파일러가
// 못 잡는다(전송층을 합친 이유와 같다). ChatMessage.content 가 가변 배열이므로 readonly 를 붙이지 않는다.
function messageContent(request: CpenTilesetRequest): string | ContentPart[] {
  if (!request.imageDataUrl.startsWith("data:image/")) return request.prompt;
  return [
    { type: "text", text: request.prompt },
    { type: "image_url", image_url: { url: request.imageDataUrl } },
  ];
}

/**
 * 옛 브라우저 보관 키를 읽던 자리. **env 키 폴백을 걷었다.**
 *
 * `VITE_YUNWU_API_KEY`/`VITE_LLM_API_KEY` 는 값을 클라이언트 번들에 인라인하는 통로였고,
 * 인증이 동반 서비스 전용이 된 뒤로는 쓸 데도 없다. 남긴 것은 레거시 localStorage 키
 * 하나뿐이며, 주입 설정(노드 스크립트)이 config.apiKey 로 넘기는 경로는 그대로 산다.
 */
function readApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(LOCAL_STORAGE_KEY)?.trim() ?? "";
}

// 삭제됨: readApiUrl / fetchWithTimeout / readFailureBody / httpFailureMessage / readResponseText /
// readContentPart / isChatCompletionResponse. 엔드포인트 해석·타임아웃·HTTP 실패 문구·응답 파싱은
// 모두 llmClient 가 이미 하는 일이었고, 여기 사본이 있는 동안 그 사본만 갱신에서 빠져 죽었다.

function extractFencedJson(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match?.[1]?.trim() ?? null;
}

function extractBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return null;
}

function isMappingJson(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return false;
    const source = parsed as Record<string, unknown>;
    return Array.isArray(source.tiles) || Array.isArray(source.groups) || Array.isArray(source.patternBlocks);
  } catch {
    return false;
  }
}
