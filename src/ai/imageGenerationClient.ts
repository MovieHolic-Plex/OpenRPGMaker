import { companionCompletionsBaseUrl, loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import { parseImageReferences, type ImageReference } from "@/ai/imageReferences";

/** Legacy exports name the defaults, not the current user selection. */
export const IMAGE_GENERATION_PROVIDER_ID = DEFAULT_IMAGE_PROVIDER_ID;
export const IMAGE_GENERATION_MODEL = DEFAULT_IMAGE_MODEL;

const IMAGE_REQUEST_TIMEOUT_MS = 180_000;

export interface GeneratedImageAsset {
  readonly dataUrl: string;
  readonly mimeType: string;
  readonly model: string;
  readonly provider: string;
}

export interface GenerateAiImageRequest {
  readonly prompt: string;
  readonly model?: string;
  readonly providerId?: string;
  readonly signal?: AbortSignal;
  readonly referenceImages?: readonly ImageReference[];
}

export interface GenerateAiImageDeps {
  readonly fetch?: typeof fetch;
}

export class ImageGenerationError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ImageGenerationError";
    this.status = status;
  }
}

export function imageGenerationEndpoint(): string {
  return `${companionCompletionsBaseUrl().replace(/\/$/, "")}/images/generations`;
}

export function imageGenerationUsesOtherProvider(config: AiConfig): boolean {
  return config.providerId !== (config.imageProviderId ?? IMAGE_GENERATION_PROVIDER_ID);
}

function parseImage(payload: unknown, model: string, provider: string): GeneratedImageAsset {
  const image = (payload as { image?: unknown })?.image;
  if (!image || typeof image !== "object") {
    throw new ImageGenerationError("이미지 응답 형식이 올바르지 않습니다.");
  }
  const record = image as Record<string, unknown>;
  const dataUrl = typeof record.dataUrl === "string" ? record.dataUrl : "";
  if (!dataUrl.startsWith("data:image/")) {
    throw new ImageGenerationError("이미지 응답에 dataUrl 이 없습니다.");
  }
  return {
    dataUrl,
    mimeType: typeof record.mimeType === "string" ? record.mimeType : "image/png",
    model: typeof record.model === "string" ? record.model : model,
    provider: typeof record.provider === "string" ? record.provider : provider,
  };
}

export async function generateAiImage(
  request: GenerateAiImageRequest,
  deps: GenerateAiImageDeps = {},
): Promise<GeneratedImageAsset> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new ImageGenerationError("그림 설명(prompt)이 비어 있습니다.");
  const referenceImages = parseImageReferences(request.referenceImages);
  const config = loadAiConfig();
  const providerId = request.providerId ?? config.imageProviderId ?? IMAGE_GENERATION_PROVIDER_ID;
  const model = request.model ?? config.imageModel ?? IMAGE_GENERATION_MODEL;

  const doFetch = deps.fetch ?? fetch;
  const timeout = AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await doFetch(imageGenerationEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Oprn-Provider": providerId,
      },
      body: JSON.stringify({
        prompt,
        model,
        ...(referenceImages.length > 0 ? { referenceImages } : {}),
      }),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new ImageGenerationError(
        request.signal?.aborted ? "생성을 취소했습니다" : "이미지 생성이 시간 안에 끝나지 않았습니다.",
      );
    }
    throw new ImageGenerationError(
      `이미지 생성 요청을 보내지 못했습니다: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const detail = (payload as { error?: unknown })?.error;
    const message = typeof detail === "string" && detail ? detail : `이미지 생성 실패 (HTTP ${response.status})`;
    throw new ImageGenerationError(message, response.status);
  }
  return parseImage(payload, model, providerId);
}
