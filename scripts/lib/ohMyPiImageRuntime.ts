import { complete } from "@oh-my-pi/pi-ai";
import { getBundledModel } from "@oh-my-pi/pi-catalog";
import { ImageReferenceError, parseImageReferences } from "../../src/ai/imageReferences";

export const IMAGE_PROVIDER_ID = "google-antigravity";
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

export interface GeneratedImage {
  readonly provider: string;
  readonly model: string;
  readonly mimeType: string;
  readonly base64: string;
}

const IMAGE_AUTH_MESSAGE = "이미지를 만들려면 AI 설정 → Google Antigravity 로그인에서 연결해 주세요.";

function isCredentialFailure(upstreamStatus: number | undefined, message: string): boolean {
  return upstreamStatus === 401 || upstreamStatus === 403
    || /Use \/login to re-authenticate|invalid authentication credentials|Missing token or projectId|invalid_grant|UNAUTHENTICATED/i.test(message);
}

function statusError(message: string, status: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function testStub(): boolean {
  return process.env.RPG_ZZU_OH_MY_PI_TEST_STUB === "1";
}

function collectInlineImages(node: unknown, out: { mimeType: string; base64: string }[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectInlineImages(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const inline = record.inlineData ?? record.inline_data;
  if (inline && typeof inline === "object") {
    const fields = inline as Record<string, unknown>;
    const rawMime = typeof fields.mimeType === "string"
      ? fields.mimeType
      : typeof fields.mime_type === "string" ? fields.mime_type : "";
    const data = fields.data;
    if (typeof data === "string" && data.length > 0 && rawMime.startsWith("image/")) {
      out.push({ mimeType: rawMime, base64: data });
    }
  }
  for (const value of Object.values(record)) collectInlineImages(value, out);
}

function harvestSseImages(text: string): { mimeType: string; base64: string }[] {
  const found: { mimeType: string; base64: string }[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      collectInlineImages(JSON.parse(payload) as unknown, found);
    } catch {
      continue;
    }
  }
  return found;
}

/**
 * pi-ai 의 Google 응답 파서는 `inlineData` 를 버린다(실측: 응답 파트를 만드는 곳이
 * `type:"image"` 를 전혀 만들지 않는다). 그래서 이미지 바이트는 전송 계층에서 직접 줍는다.
 * 재생 Response 에 `url` 을 다시 심는 이유도 실측이다 — 이게 없으면 pi-ai 가
 * "Missing request URL" 로 스트림 파싱을 중단한다.
 */
function harvestingFetch(
  sink: { mimeType: string; base64: string }[],
  failureSink: { status?: number },
  baseFetch: typeof fetch,
): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const response = await baseFetch(input, init);
    if (!response.ok) {
      failureSink.status = response.status;
      return response;
    }
    const text = await response.text();
    sink.push(...harvestSseImages(text));
    const replay = new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    Object.defineProperty(replay, "url", { value: response.url, configurable: true });
    return replay;
  }) as typeof fetch;
}

function withImageModality(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return undefined;
  const body = { ...(payload as Record<string, unknown>) };
  const nested = body.request && typeof body.request === "object" ? { ...(body.request as Record<string, unknown>) } : null;
  const target = nested ?? body;
  const generationConfig = target.generationConfig && typeof target.generationConfig === "object"
    ? { ...(target.generationConfig as Record<string, unknown>) }
    : {};
  generationConfig.responseModalities = ["TEXT", "IMAGE"];
  target.generationConfig = generationConfig;
  if (nested) body.request = nested;
  return body;
}

function imagePartsOfMessage(message: unknown): { mimeType: string; base64: string }[] {
  const content = (message as { content?: unknown })?.content;
  if (!Array.isArray(content)) return [];
  const found: { mimeType: string; base64: string }[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    if (record.type !== "image") continue;
    if (typeof record.data !== "string" || record.data.length === 0) continue;
    found.push({
      mimeType: typeof record.mimeType === "string" ? record.mimeType : "image/png",
      base64: record.data,
    });
  }
  return found;
}

function biggest(images: readonly { mimeType: string; base64: string }[]): { mimeType: string; base64: string } | undefined {
  let best: { mimeType: string; base64: string } | undefined;
  for (const image of images) {
    if (!best || image.base64.length > best.base64.length) best = image;
  }
  return best;
}

export function imageGenerationProviderFor(requested: string): string {
  return requested === IMAGE_PROVIDER_ID ? IMAGE_PROVIDER_ID : "";
}

export async function generateProviderImage(
  provider: string,
  body: Record<string, unknown>,
  options?: { apiKey?: string; fetch?: typeof fetch },
): Promise<GeneratedImage> {
  if (imageGenerationProviderFor(provider) === "") {
    throw statusError(
      `${provider} 경로에서는 이미지를 생성할 수 없습니다. 이미지 생성은 Google Antigravity 구독 경로만 지원합니다.`,
      409,
    );
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw statusError("prompt 가 필요합니다.", 400);
  let referenceImages;
  try {
    referenceImages = parseImageReferences(body.referenceImages);
  } catch (error) {
    if (error instanceof ImageReferenceError) throw statusError(error.message, 400);
    throw error;
  }

  const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
  const modelId = requestedModel || DEFAULT_IMAGE_MODEL;

  if (testStub()) {
    return { provider, model: modelId, mimeType: "image/png", base64: TRANSPARENT_PNG_BASE64 };
  }

  const model = getBundledModel(IMAGE_PROVIDER_ID as never, modelId);
  if (!model) throw statusError(`oh-my-pi 카탈로그에 ${IMAGE_PROVIDER_ID} 이미지 모델 ${modelId}이 없습니다. 다른 이미지 모델을 선택해 주세요.`, 400);

  // 로그인이 아예 없으면(resolveRequestApiKey → undefined) pi-ai 가 HTTP 요청을 만들기 전에
  // MissingApiKeyError 로 끊는다. 그러면 상류 상태가 없어 아래 판별이 닿지 못하고 영어 원문이
  // 그대로 사용자에게 간다 — 가장 흔한 미로그인 상태이므로 여기서 먼저 끊는다.
  if (!options?.apiKey) throw statusError(IMAGE_AUTH_MESSAGE, 401);

  const harvested: { mimeType: string; base64: string }[] = [];
  // pi-ai는 제공자 HTTP 오류를 throw하지 않고 오류 메시지로 resolve하므로 전송 계층 상태를 따로 보존한다.
  const upstreamFailure: { status?: number } = {};
  const context = {
    systemPrompt: [
      "You are a game art generator for a 2D top-down JRPG maker.",
      "Always answer by producing the requested image. Keep the subject centered on a plain background.",
    ],
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...referenceImages.map((image) => ({ type: "image", ...image })),
      ],
      timestamp: Date.now(),
    }],
  };

  let message: unknown;
  let failure: unknown;
  try {
    // The image model's catalog entry omits vision input even though this endpoint
    // supports image editing. Otherwise pi-ai replaces references with omission text.
    message = await complete({ ...model, input: ["text", "image"] } as never, context as never, {
      ...(options?.apiKey ? { apiKey: options.apiKey } : {}),
      fetch: harvestingFetch(harvested, upstreamFailure, options?.fetch ?? fetch),
      onPayload: withImageModality,
    } as never);
  } catch (error) {
    failure = error;
  }

  const image = biggest(imagePartsOfMessage(message)) ?? biggest(harvested);
  if (!image) {
    const reason = failure instanceof Error
      ? failure.message
      : failure !== undefined ? String(failure) : (message as { errorMessage?: string })?.errorMessage || "응답에 이미지가 없습니다.";
    if (isCredentialFailure(upstreamFailure.status, reason)) throw statusError(IMAGE_AUTH_MESSAGE, 401);
    throw statusError(`이미지 생성 실패: ${reason.slice(0, 400)}`, 502);
  }
  return { provider: IMAGE_PROVIDER_ID, model: model.id, mimeType: image.mimeType, base64: image.base64 };
}
