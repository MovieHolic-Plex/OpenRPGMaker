import type { ChatRequest, ContentPart } from "@/ai/llmClient";
import { composeSystemPrompt } from "@/ai/systemPromptEnvelope";

export type CpenTilesetRequest = {
  readonly prompt: string;
  readonly imageDataUrl: string;
};

const SAMPLING_TEMPERATURE = 0.2;
const JSON_ONLY_SYSTEM_PROMPT =
  "Return exactly one JSON object for the requested tileset metadata. Do not quote the schema, do not include markdown, prose, code fences, or hidden reasoning. If uncertain, fill minimumQuestions and keep fields conservative.";

export function buildTilesetMappingRequest(request: CpenTilesetRequest): ChatRequest {
  return {
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
      };
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

function messageContent(request: CpenTilesetRequest): string | ContentPart[] {
  if (!request.imageDataUrl.startsWith("data:image/")) return request.prompt;
  return [
    { type: "text", text: request.prompt },
    { type: "image_url", image_url: { url: request.imageDataUrl } },
  ];
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
