import { loadAiConfig } from "@/ai/llmClient";

export type CpenTilesetRequest = {
  readonly prompt: string;
  readonly imageDataUrl: string;
};

type ChatCompletionResponse = {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: unknown;
    };
  }[];
};

// CPEN 타일셋 매핑은 감독 모델 설정을 재사용하고, 아래 값은 폴백일 뿐이다.
// baseUrl 폴백 없음 — loadAiConfig().baseUrl 또는 VITE_LLM_API_URL 필수.
const DEFAULT_LLM_MODEL = "google/gemini-3.1-flash-lite";
const MAX_INPUT_PER_1M = 0.1;
const MAX_OUTPUT_TOKENS = 8192;
const LOCAL_STORAGE_KEY = "rpg-zzu.llmApiKey";
const JSON_ONLY_SYSTEM_PROMPT =
  "Return exactly one JSON object for the requested tileset metadata. Do not quote the schema, do not include markdown, prose, code fences, or hidden reasoning. If uncertain, fill minimumQuestions and keep fields conservative.";

export async function requestCpenTilesetMapping(request: CpenTilesetRequest): Promise<string> {
  const mainConfig = loadAiConfig();
  const apiKey = mainConfig.apiKey?.trim() || readApiKey();
  if (!apiKey) return "AI 설정이 아직 연결되지 않았습니다. 로컬 설정을 확인해 주세요.";
  const baseUrl = (mainConfig.baseUrl?.trim() || readApiUrl()).replace(/\/$/, "");
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
            content: buildPrompt(request),
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
        routing: {
          max_input_per_1m: MAX_INPUT_PER_1M,
        },
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
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
  return readApiKey().length > 0;
}

function buildPrompt(request: CpenTilesetRequest): string {
  if (!request.imageDataUrl.startsWith("data:image/")) return request.prompt;
  return `${request.prompt}\n\n참고: 현재 AI 라우터는 이미지 멀티파트를 받지 않아 임시 맵의 lowerTiles/upperTiles 데이터와 선택 타일 설명을 기준으로 분석하세요.`;
}

function readApiKey(): string {
  const yunwuKey = import.meta.env.VITE_YUNWU_API_KEY?.trim();
  if (yunwuKey) return yunwuKey;
  const viteKey = import.meta.env.VITE_LLM_API_KEY?.trim();
  if (viteKey) return viteKey;
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(LOCAL_STORAGE_KEY)?.trim() ?? "";
}

function readApiUrl(): string {
  const configured = import.meta.env.VITE_LLM_API_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : "";
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
