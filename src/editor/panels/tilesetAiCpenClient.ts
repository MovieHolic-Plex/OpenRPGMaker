import { DEFAULT_CHATGPT_BASE_URL, isProxyAuth, loadAiConfig, usesOhMyPiCompanion } from "@/ai/llmClient";
import { parseOhMyPiProvider } from "@/ai/ohMyPiProviders";

export type CpenTilesetRequest = {
  readonly prompt: string;
  readonly imageDataUrl: string;
};

type CpenTilesetContentPart =
  | { readonly text: string; readonly type: "text" }
  | { readonly image_url: { readonly url: string }; readonly type: "image_url" };

type ChatCompletionResponse = {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: unknown;
    };
  }[];
};

// 타일셋 매핑은 감독 모델 설정을 재사용하고, 아래 값은 폴백일 뿐이다.
// 자격 증명은 동반 서비스가 보관한다 — 이 파일은 키를 읽지 않는다(아래 readApiKey 주석 참고).
const DEFAULT_LLM_MODEL = "google/gemini-3.1-flash-lite";
const MAX_INPUT_PER_1M = 0.1;
const MAX_OUTPUT_TOKENS = 8192;
const LOCAL_STORAGE_KEY = "rpg-zzu.llmApiKey";
const JSON_ONLY_SYSTEM_PROMPT =
  "Return exactly one JSON object for the requested tileset metadata. Do not quote the schema, do not include markdown, prose, code fences, or hidden reasoning. If uncertain, fill minimumQuestions and keep fields conservative.";

export async function requestCpenTilesetMapping(request: CpenTilesetRequest): Promise<string> {
  const mainConfig = loadAiConfig();
  // OAuth(동반 서비스) 경로를 먼저 본다. 이 클라이언트는 llmClient 를 우회해 직접 fetch 하므로,
  // 예전에는 OAuth 모드에서 apiKey 도 proxyAuth 도 없어 **첫 줄에서 막혔다** — 에디터 AI 가
  // OAuth 전용이 된 뒤 타일셋 AI 만 조용히 죽어 있던 원인이다(실측 2026-08-21).
  const companion = usesOhMyPiCompanion(mainConfig);
  const proxyAuth = isProxyAuth(mainConfig);
  const apiKey = mainConfig.apiKey?.trim() || readApiKey();
  if (!companion && !apiKey && !proxyAuth) return "AI 설정이 아직 연결되지 않았습니다. 로컬 설정을 확인해 주세요.";
  const baseUrl = (companion ? DEFAULT_CHATGPT_BASE_URL : mainConfig.baseUrl?.trim() || readApiUrl()).replace(/\/$/, "");
  if (!baseUrl) return "AI 엔드포인트(baseUrl)가 설정되지 않았습니다. 어시스턴트 설정에서 OpenAI 호환 baseUrl을 입력하세요.";
  const model = mainConfig.model?.trim() || DEFAULT_LLM_MODEL;

  try {
    const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: JSON_ONLY_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: messageContent(request),
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
        // routing 은 cpenrouter 게이트웨이 전용 필드다 — 동반 서비스(pi-ai)로는 보내지 않는다.
        ...(companion ? {} : { routing: { max_input_per_1m: MAX_INPUT_PER_1M } }),
        temperature: 0.2,
      }),
      headers: {
        "Content-Type": "application/json",
        // 동반 서비스는 제공자를 헤더로 받고 자격 증명을 자기 저장소에서 꺼낸다(llmClient.headers 와 동일 관례).
        ...(companion ? { "X-Rpgzzu-Provider": parseOhMyPiProvider(mainConfig.providerId) } : {}),
        ...(!companion && !proxyAuth ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      method: "POST",
    });
    if (!response.ok) return httpFailureMessage(response.status, await readFailureBody(response));
    const data: unknown = await response.json();
    const responseText = readResponseText(data);
    return responseText ? normalizeCpenResponseText(responseText) : "AI 응답을 읽지 못했습니다.";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
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

function messageContent(request: CpenTilesetRequest): string | readonly CpenTilesetContentPart[] {
  if (!request.imageDataUrl.startsWith("data:image/")) return request.prompt;
  return [
    { text: request.prompt, type: "text" },
    { image_url: { url: request.imageDataUrl }, type: "image_url" },
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

/**
 * 옛 env baseUrl 을 읽던 자리. **걷었다** — `VITE_LLM_API_URL` 이 에디터의 인증 모드를
 * 정하던 통로였고 그게 AI 를 반복적으로 죽인 원인이다(llmClient.defaultAiConfig 주석).
 * 동반 서비스 경로는 DEFAULT_CHATGPT_BASE_URL 로 고정이고, 주입 설정은 자기 baseUrl 을 든다.
 */
function readApiUrl(): string {
  return "";
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readFailureBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.trim().slice(0, 400);
}

function httpFailureMessage(status: number, body: string): string {
  return body ? `AI 호출 실패: HTTP ${status} ${body}` : `AI 호출 실패: HTTP ${status}`;
}

function readResponseText(data: unknown): string | null {
  if (!isChatCompletionResponse(data)) return null;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(readContentPart).filter(Boolean).join("\n") || null;
  return null;
}

function readContentPart(part: unknown): string {
  if (!part || typeof part !== "object" || !("text" in part)) return "";
  const text = part.text;
  return typeof text === "string" ? text : "";
}

function isChatCompletionResponse(data: unknown): data is ChatCompletionResponse {
  return Boolean(data && typeof data === "object" && "choices" in data);
}

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
